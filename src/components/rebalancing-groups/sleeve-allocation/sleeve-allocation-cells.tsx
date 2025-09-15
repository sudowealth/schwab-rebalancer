import { useState } from 'react';
import { CASH_TICKER } from '../../../lib/constants';
import { formatCurrency, formatPercent, formatQuantity } from '../../../lib/utils';
import { Badge } from '../../ui/badge';
import { calculateTradeMetrics } from '../sleeve-allocation/sleeve-allocation-utils';
import type { Trade } from './sleeve-allocation-types';

interface CellProps {
  className?: string;
  onClick?: () => void;
}

interface ValueCellProps extends CellProps {
  value: number;
  isPositive?: boolean;
}

interface PercentageCellProps extends CellProps {
  currentPercent: number;
  targetPercent: number;
}

interface Security {
  ticker: string;
  qty?: number;
  currentValue?: number;
  targetValue?: number;
  currentPercent?: number;
  targetPercent?: number;
  currentPrice?: number;
  costBasis?: number;
  openedAt?: Date | string;
  totalGainLoss?: number;
  longTermGainLoss?: number;
  shortTermGainLoss?: number;
  realizedGainLoss?: number;
  realizedLongTermGainLoss?: number;
  realizedShortTermGainLoss?: number;
  isHeld?: boolean;
  hasWashSaleRisk?: boolean;
  washSaleInfo?: unknown;
}

interface SleeveItem {
  sleeveId: string;
  sleeveName?: string;
  securities: Security[];
  currentValue?: number;
  targetValue?: number;
  currentPercent?: number;
  targetPercent?: number;
  difference?: number;
  totalGainLoss?: number;
  longTermGainLoss?: number;
  shortTermGainLoss?: number;
  ticker?: never;
}

interface SecurityItem extends Security {
  sleeveId?: undefined;
  securities?: undefined;
}

interface AccountItem {
  accountId: string;
  accountName?: string;
  accountType?: string;
  totalValue?: number;
  sleeves?: SleeveItem[];
  ticker?: undefined;
  securities?: undefined;
  sleeveId?: undefined;
}

export type TradeItem = SleeveItem | SecurityItem | AccountItem;

// Type guards
function isSleeveItem(item: TradeItem): item is SleeveItem {
  return 'securities' in item && item.securities !== undefined;
}

function isSecurityItem(item: TradeItem): item is SecurityItem {
  return 'ticker' in item && !('securities' in item) && !('accountId' in item);
}

interface TradeCellProps extends CellProps {
  item: TradeItem;
  trades: Trade[];
  itemType: 'sleeve' | 'security' | 'account';
}

interface PostTradeValueCellProps extends CellProps {
  currentValue: number;
  targetValue: number;
  trades: Trade[];
  tickers: string[];
  totalCurrentValue: number;
  isCashSleeve?: boolean;
}

export const ValueCell: React.FC<ValueCellProps> = ({
  value,
  isPositive,
  className = '',
  onClick,
}) => {
  const colorClass =
    isPositive !== undefined ? (isPositive ? 'text-green-600' : 'text-red-600') : '';

  if (onClick) {
    return (
      <td className={`p-2 text-right ${colorClass} ${className}`}>
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {formatCurrency(value)}
        </button>
      </td>
    );
  }
  return <td className={`p-2 text-right ${colorClass} ${className}`}>{formatCurrency(value)}</td>;
};

export const DifferenceCell: React.FC<ValueCellProps> = ({ value, className = '', onClick }) => (
  <ValueCell value={value} isPositive={value >= 0} className={className} onClick={onClick} />
);

export const PercentageDistanceCell: React.FC<PercentageCellProps> = ({
  currentPercent,
  targetPercent,
  className = '',
  onClick,
}) => {
  const percentDistanceFromTarget =
    targetPercent > 0 ? ((currentPercent - targetPercent) / targetPercent) * 100 : currentPercent;

  const colorClass = percentDistanceFromTarget >= 0 ? 'text-green-600' : 'text-red-600';

  const content = formatPercent(percentDistanceFromTarget / 100);
  if (onClick) {
    return (
      <td className={`p-2 text-right ${colorClass} ${className}`}>
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {content}
        </button>
      </td>
    );
  }
  return <td className={`p-2 text-right ${colorClass} ${className}`}>{content}</td>;
};

export const ActionCell: React.FC<TradeCellProps> = ({
  item,
  trades,
  itemType,
  className = '',
  onClick,
}) => {
  if (trades.length === 0) return null;

  // Cash always shows "-" for action
  if (itemType === 'sleeve' && item.sleeveId === 'cash') {
    return (
      <td className={`p-2 text-center ${className}`}>
        {onClick ? (
          <button type="button" className="w-full bg-transparent" onClick={onClick}>
            -
          </button>
        ) : (
          '-'
        )}
      </td>
    );
  }

  // Cash security always shows "-" for action
  if (itemType === 'security' && item.ticker === CASH_TICKER) {
    return (
      <td className={`p-2 text-center ${className}`}>
        {onClick ? (
          <button type="button" className="w-full bg-transparent" onClick={onClick}>
            -
          </button>
        ) : (
          '-'
        )}
      </td>
    );
  }

  const tickers =
    itemType === 'sleeve'
      ? isSleeveItem(item)
        ? item.securities.map((s: Security) => s.ticker)
        : []
      : isSleeveItem(item)
        ? []
        : [item.ticker];

  // Filter out cash trades for non-cash sleeves/securities
  const relevantTrades = trades.filter((t: Trade) => {
    const id = t.securityId || t.ticker || '';
    return tickers.includes(id) && id !== CASH_TICKER;
  });

  if (relevantTrades.length === 0) {
    return (
      <td className={`p-2 text-center ${className}`}>
        {onClick ? (
          <button type="button" className="w-full bg-transparent" onClick={onClick}>
            <Badge variant="outline">NONE</Badge>
          </button>
        ) : (
          <Badge variant="outline">NONE</Badge>
        )}
      </td>
    );
  }

  // For sleeve items, check if there are both buy and sell actions
  if (itemType === 'sleeve') {
    const buyTrades = relevantTrades.filter((t: Trade) => t.action === 'BUY');
    const sellTrades = relevantTrades.filter((t: Trade) => t.action === 'SELL');

    if (buyTrades.length > 0 && sellTrades.length > 0) {
      return (
        <td className={`p-2 text-center ${className}`}>
          {onClick ? (
            <button type="button" className="w-full bg-transparent" onClick={onClick}>
              <Badge className="bg-blue-600 text-white hover:bg-blue-600">BUY/SELL</Badge>
            </button>
          ) : (
            <Badge className="bg-blue-600 text-white hover:bg-blue-600">BUY/SELL</Badge>
          )}
        </td>
      );
    }

    // If all trades are the same action, show that action
    if (buyTrades.length > 0) {
      return (
        <td className={`p-2 text-center ${className}`}>
          {onClick ? (
            <button type="button" className="w-full bg-transparent" onClick={onClick}>
              <Badge className="bg-green-600 text-white hover:bg-green-600">BUY</Badge>
            </button>
          ) : (
            <Badge className="bg-green-600 text-white hover:bg-green-600">BUY</Badge>
          )}
        </td>
      );
    }
    if (sellTrades.length > 0) {
      return (
        <td className={`p-2 text-center ${className}`}>
          {onClick ? (
            <button type="button" className="w-full bg-transparent" onClick={onClick}>
              <Badge className="bg-red-600 text-white hover:bg-red-600">SELL</Badge>
            </button>
          ) : (
            <Badge className="bg-red-600 text-white hover:bg-red-600">SELL</Badge>
          )}
        </td>
      );
    }
  }

  // For individual securities, use the trade action directly
  const majorityAction = relevantTrades.length > 0 ? relevantTrades[0].action : null;
  if (majorityAction === 'BUY') {
    return (
      <td className={`p-2 text-center ${className}`}>
        {onClick ? (
          <button type="button" className="w-full bg-transparent" onClick={onClick}>
            <Badge className="bg-green-600 text-white hover:bg-green-600">BUY</Badge>
          </button>
        ) : (
          <Badge className="bg-green-600 text-white hover:bg-green-600">BUY</Badge>
        )}
      </td>
    );
  }
  if (majorityAction === 'SELL') {
    return (
      <td className={`p-2 text-center ${className}`}>
        {onClick ? (
          <button type="button" className="w-full bg-transparent" onClick={onClick}>
            <Badge className="bg-red-600 text-white hover:bg-red-600">SELL</Badge>
          </button>
        ) : (
          <Badge className="bg-red-600 text-white hover:bg-red-600">SELL</Badge>
        )}
      </td>
    );
  }

  return (
    <td className={`p-2 text-center ${className}`}>
      {onClick ? (
        <button type="button" className="w-full bg-transparent" onClick={onClick}>
          <Badge variant="outline">NONE</Badge>
        </button>
      ) : (
        <Badge variant="outline">NONE</Badge>
      )}
    </td>
  );
};

export const TradeQtyCell: React.FC<
  TradeCellProps & {
    onTradeQtyChange?: (ticker: string, newQty: number, isPreview?: boolean) => void;
  }
> = ({ item, trades, itemType, className = '', onClick, onTradeQtyChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  if (trades.length === 0) return null;

  // Cash always shows "-" for quantity
  if (itemType === 'sleeve' && item.sleeveId === 'cash') {
    return (
      <td className={`p-2 text-right ${className}`}>
        {onClick ? (
          <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
            -
          </button>
        ) : (
          '-'
        )}
      </td>
    );
  }

  // Cash security always shows "-" for quantity
  if (itemType === 'security' && item.ticker === CASH_TICKER) {
    return (
      <td className={`p-2 text-right ${className}`}>
        {onClick ? (
          <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
            -
          </button>
        ) : (
          '-'
        )}
      </td>
    );
  }

  const tickers =
    itemType === 'sleeve'
      ? isSleeveItem(item)
        ? item.securities.map((s: Security) => s.ticker)
        : []
      : isSleeveItem(item)
        ? []
        : [item.ticker];

  // Filter out cash trades for non-cash sleeves/securities
  const relevantTrades = trades.filter((t: Trade) => {
    const id = t.securityId || t.ticker || '';
    return tickers.includes(id) && id !== CASH_TICKER;
  });

  if (relevantTrades.length === 0 && itemType === 'sleeve') {
    return (
      <td className={`p-2 text-right ${className}`}>
        {onClick ? (
          <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
            -
          </button>
        ) : (
          '-'
        )}
      </td>
    );
  }

  const netQty = relevantTrades.reduce((sum, t) => sum + t.qty, 0);

  // Only allow editing for individual securities, not sleeve rows
  if (itemType === 'security' && onTradeQtyChange) {
    const handleEdit = () => {
      setEditValue(netQty !== 0 ? Math.abs(netQty).toString() : '');
      setIsEditing(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEditValue(value);

      // Show preview in real-time
      const newQty = Number.parseInt(value, 10) || 0;
      const finalQty = netQty < 0 ? -newQty : newQty;
      if (onTradeQtyChange && item.ticker) {
        onTradeQtyChange(item.ticker, finalQty, true); // true indicates preview
      }
    };

    const handleSave = () => {
      const newQty = Number.parseInt(editValue, 10) || 0;
      const finalQty = netQty < 0 ? -newQty : newQty;
      if (onTradeQtyChange && item.ticker) {
        onTradeQtyChange(item.ticker, finalQty, false); // false indicates final save
      }
      setIsEditing(false);
    };

    const handleBlur = () => {
      handleSave();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setEditValue('');
        // Reset to original value
        if (onTradeQtyChange && item.ticker) {
          onTradeQtyChange(item.ticker, netQty, false);
        }
      }
    };

    if (isEditing) {
      return (
        <td className={`p-2 text-right ${className}`}>
          <input
            type="number"
            value={editValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-20 px-1 py-0.5 text-right border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            min="0"
          />
        </td>
      );
    }

    return (
      <td className={`p-2 text-right ${className}`}>
        <button
          type="button"
          className="w-full text-right bg-transparent hover:bg-gray-100"
          onClick={handleEdit}
        >
          {netQty === 0 ? '-' : formatQuantity(Math.abs(netQty))}
        </button>
      </td>
    );
  }

  // Non-editable cell for sleeve rows
  return (
    <td className={`p-2 text-right ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {netQty === 0 ? '-' : formatQuantity(Math.abs(netQty))}
        </button>
      ) : netQty === 0 ? (
        '-'
      ) : (
        formatQuantity(Math.abs(netQty))
      )}
    </td>
  );
};

export const CurrentQtyCell: React.FC<{
  item: TradeItem;
  itemType: 'sleeve' | 'security' | 'account';
  className?: string;
  onClick?: () => void;
}> = ({ item, itemType, className = '', onClick }) => {
  if (itemType === 'sleeve') {
    if (item.sleeveId === 'cash') {
      return (
        <td className={`p-2 text-right ${className}`}>
          {onClick ? (
            <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
              -
            </button>
          ) : (
            '-'
          )}
        </td>
      );
    }

    const totalQty = isSleeveItem(item)
      ? item.securities?.reduce(
          (total: number, security: { qty?: number }) => total + (security.qty || 0),
          0,
        ) || 0
      : 0;

    return (
      <td className={`p-2 text-right ${className}`}>
        {onClick ? (
          <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
            {formatQuantity(totalQty)}
          </button>
        ) : (
          formatQuantity(totalQty)
        )}
      </td>
    );
  }

  if (itemType === 'account') {
    return (
      <td className={`p-2 text-right ${className}`}>
        {onClick ? (
          <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
            -
          </button>
        ) : (
          '-'
        )}
      </td>
    );
  }

  // For security
  return (
    <td className={`p-2 text-right ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {formatQuantity((isSecurityItem(item) ? item.qty : 0) || 0)}
        </button>
      ) : (
        formatQuantity((isSecurityItem(item) ? item.qty : 0) || 0)
      )}
    </td>
  );
};

export const TradeValueCell: React.FC<TradeCellProps> = ({
  item,
  trades,
  itemType,
  className = '',
  onClick,
}) => {
  if (trades.length === 0) return null;

  // Cash always shows "-" for trade value
  if (itemType === 'sleeve' && item.sleeveId === 'cash') {
    return (
      <td className={`p-2 text-right ${className}`}>
        {onClick ? (
          <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
            -
          </button>
        ) : (
          '-'
        )}
      </td>
    );
  }

  // Cash security always shows "-" for trade value
  if (itemType === 'security' && item.ticker === CASH_TICKER) {
    return (
      <td className={`p-2 text-right ${className}`}>
        {onClick ? (
          <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
            -
          </button>
        ) : (
          '-'
        )}
      </td>
    );
  }

  const tickers =
    itemType === 'sleeve'
      ? isSleeveItem(item)
        ? item.securities.map((s: Security) => s.ticker)
        : []
      : isSleeveItem(item)
        ? []
        : [item.ticker];

  // Filter out cash trades for non-cash sleeves/securities
  const relevantTrades = trades.filter((t: Trade) => {
    const id = t.securityId || t.ticker || '';
    return tickers.includes(id) && id !== CASH_TICKER;
  });

  if (relevantTrades.length === 0) {
    return (
      <td className={`p-2 text-right ${className}`}>
        {onClick ? (
          <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
            -
          </button>
        ) : (
          '-'
        )}
      </td>
    );
  }

  const netValue = relevantTrades.reduce((sum, t) => sum + t.estValue, 0);

  return (
    <td className={`p-2 text-right ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {netValue === 0 ? '-' : formatCurrency(Math.abs(netValue))}
        </button>
      ) : netValue === 0 ? (
        '-'
      ) : (
        formatCurrency(Math.abs(netValue))
      )}
    </td>
  );
};

export const PostTradeValueCell: React.FC<PostTradeValueCellProps & { isCashSleeve?: boolean }> = ({
  currentValue,
  trades,
  tickers,
  totalCurrentValue,
  className = '',
  onClick,
  isCashSleeve,
}) => {
  if (trades.length === 0) return null;

  const { postTradeValue } = calculateTradeMetrics.getPostTradeMetrics(
    currentValue,
    trades,
    tickers,
    totalCurrentValue,
    0,
    isCashSleeve,
  );

  return (
    <td className={`p-2 text-right ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {formatCurrency(postTradeValue)}
        </button>
      ) : (
        formatCurrency(postTradeValue)
      )}
    </td>
  );
};

export const PostTradeDiffCell: React.FC<PostTradeValueCellProps & { totalCashValue?: number }> = ({
  currentValue,
  targetValue,
  trades,
  tickers,
  className = '',
  onClick,
  isCashSleeve,
  totalCashValue,
}) => {
  if (trades.length === 0) return null;

  const postTradeDiff = calculateTradeMetrics.getPostTradeDiff(
    currentValue,
    targetValue,
    trades,
    tickers,
    isCashSleeve,
    totalCashValue,
  );

  const colorClass = postTradeDiff >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <td className={`p-2 text-right ${colorClass} ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {formatCurrency(postTradeDiff)}
        </button>
      ) : (
        formatCurrency(postTradeDiff)
      )}
    </td>
  );
};

export const PostTradePercentCell: React.FC<
  PostTradeValueCellProps & {
    targetPercent: number;
    isCashSleeve?: boolean;
    totalCashValue?: number;
  }
> = ({
  currentValue,
  trades,
  tickers,
  totalCurrentValue,
  className = '',
  onClick,
  isCashSleeve,
  totalCashValue,
}) => {
  if (trades.length === 0) return null;

  // Calculate total trade value to get final portfolio value
  const totalTradeValue = trades.reduce((sum, t) => sum + t.estValue, 0);
  const { postTradePercent } = calculateTradeMetrics.getPostTradeMetrics(
    currentValue,
    trades,
    tickers,
    totalCurrentValue,
    totalTradeValue,
    isCashSleeve,
    totalCashValue,
  );

  return (
    <td className={`p-2 text-right ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {formatPercent(postTradePercent / 100)}
        </button>
      ) : (
        formatPercent(postTradePercent / 100)
      )}
    </td>
  );
};

export const PostTradeDiffPercentCell: React.FC<
  PostTradeValueCellProps & {
    targetPercent: number;
    isCashSleeve?: boolean;
    totalCashValue?: number;
  }
> = ({
  currentValue,
  targetPercent,
  trades,
  tickers,
  totalCurrentValue,
  className = '',
  onClick,
  isCashSleeve,
  totalCashValue,
}) => {
  if (trades.length === 0) return null;

  // Calculate total trade value to get final portfolio value
  const totalTradeValue = trades.reduce((sum, t) => sum + t.estValue, 0);
  const { postTradePercent } = calculateTradeMetrics.getPostTradeMetrics(
    currentValue,
    trades,
    tickers,
    totalCurrentValue,
    totalTradeValue,
    isCashSleeve,
    totalCashValue,
  );

  // For cash, show the remaining percentage (since target is 0%)
  const percentDistanceFromTarget = isCashSleeve
    ? postTradePercent
    : targetPercent > 0
      ? ((postTradePercent - targetPercent) / targetPercent) * 100
      : postTradePercent;

  const colorClass = isCashSleeve
    ? '' // No color for cash since it's just showing remaining amount
    : percentDistanceFromTarget >= 0
      ? 'text-green-600'
      : 'text-red-600';

  return (
    <td className={`p-2 text-right ${colorClass} ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {formatPercent(percentDistanceFromTarget / 100)}
        </button>
      ) : (
        formatPercent(percentDistanceFromTarget / 100)
      )}
    </td>
  );
};

// Cost Basis Cell
export const CostBasisCell: React.FC<{
  item: TradeItem;
  className?: string;
  onClick?: () => void;
}> = ({ item, className = '', onClick }) => {
  const costBasis = (isSecurityItem(item) ? item.costBasis : 0) || 0;

  const cb = costBasis > 0 ? formatCurrency(costBasis) : '-';
  return (
    <td className={`p-2 text-right ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {cb}
        </button>
      ) : (
        cb
      )}
    </td>
  );
};

// Opened At Cell
export const OpenedAtCell: React.FC<{
  item: TradeItem;
  className?: string;
  onClick?: () => void;
}> = ({ item, className = '', onClick }) => {
  const openedAt = isSecurityItem(item) ? item.openedAt : undefined;

  const oa = openedAt ? new Date(openedAt).toLocaleDateString() : '-';
  return (
    <td className={`p-2 text-right ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {oa}
        </button>
      ) : (
        oa
      )}
    </td>
  );
};

// Total Gain/Loss Cell
export const TotalGainLossCell: React.FC<{
  item: TradeItem;
  className?: string;
  onClick?: () => void;
}> = ({ item, className = '', onClick }) => {
  const totalGainLoss = (isSecurityItem(item) || isSleeveItem(item) ? item.totalGainLoss : 0) || 0;
  const colorClass = totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600';

  const tgl = totalGainLoss !== 0 ? formatCurrency(totalGainLoss) : '-';
  return (
    <td className={`p-2 text-right ${colorClass} ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {tgl}
        </button>
      ) : (
        tgl
      )}
    </td>
  );
};

// Long Term Gain/Loss Cell
export const LongTermGainLossCell: React.FC<{
  item: TradeItem;
  className?: string;
  onClick?: () => void;
}> = ({ item, className = '', onClick }) => {
  const longTermGainLoss =
    (isSecurityItem(item) || isSleeveItem(item) ? item.longTermGainLoss : 0) || 0;
  const colorClass = longTermGainLoss >= 0 ? 'text-green-600' : 'text-red-600';

  const lt = longTermGainLoss !== 0 ? formatCurrency(longTermGainLoss) : '-';
  return (
    <td className={`p-2 text-right ${colorClass} ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {lt}
        </button>
      ) : (
        lt
      )}
    </td>
  );
};

// Short Term Gain/Loss Cell
export const ShortTermGainLossCell: React.FC<{
  item: TradeItem;
  className?: string;
  onClick?: () => void;
}> = ({ item, className = '', onClick }) => {
  const shortTermGainLoss =
    (isSecurityItem(item) || isSleeveItem(item) ? item.shortTermGainLoss : 0) || 0;
  const colorClass = shortTermGainLoss >= 0 ? 'text-green-600' : 'text-red-600';

  const st = shortTermGainLoss !== 0 ? formatCurrency(shortTermGainLoss) : '-';
  return (
    <td className={`p-2 text-right ${colorClass} ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {st}
        </button>
      ) : (
        st
      )}
    </td>
  );
};

// Realized Gain/Loss Cell
export const RealizedGainLossCell: React.FC<{
  item: TradeItem;
  className?: string;
  onClick?: () => void;
}> = ({ item, className = '', onClick }) => {
  const realizedGainLoss =
    (isSecurityItem(item) ? item.realizedGainLoss : (item as Partial<SleeveItem>).totalGainLoss) ||
    0;
  const colorClass = realizedGainLoss >= 0 ? 'text-green-600' : 'text-red-600';

  const rg = realizedGainLoss !== 0 ? formatCurrency(realizedGainLoss) : '-';
  return (
    <td className={`p-2 text-right ${colorClass} ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {rg}
        </button>
      ) : (
        rg
      )}
    </td>
  );
};

// Realized Long Term Gain/Loss Cell
export const RealizedLongTermGainLossCell: React.FC<{
  item: TradeItem;
  className?: string;
  onClick?: () => void;
}> = ({ item, className = '', onClick }) => {
  const realizedLongTermGainLoss =
    (isSecurityItem(item)
      ? item.realizedLongTermGainLoss
      : (item as Partial<SleeveItem> & { realizedLongTermGainLoss?: number })
          .realizedLongTermGainLoss) || 0;
  const colorClass = realizedLongTermGainLoss >= 0 ? 'text-green-600' : 'text-red-600';

  const rlt = realizedLongTermGainLoss !== 0 ? formatCurrency(realizedLongTermGainLoss) : '-';
  return (
    <td className={`p-2 text-right ${colorClass} ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {rlt}
        </button>
      ) : (
        rlt
      )}
    </td>
  );
};

// Realized Short Term Gain/Loss Cell
export const RealizedShortTermGainLossCell: React.FC<{
  item: TradeItem;
  className?: string;
  onClick?: () => void;
}> = ({ item, className = '', onClick }) => {
  const realizedShortTermGainLoss =
    (isSecurityItem(item)
      ? item.realizedShortTermGainLoss
      : (item as Partial<SleeveItem> & { realizedShortTermGainLoss?: number })
          .realizedShortTermGainLoss) || 0;
  const colorClass = realizedShortTermGainLoss >= 0 ? 'text-green-600' : 'text-red-600';

  const rst = realizedShortTermGainLoss !== 0 ? formatCurrency(realizedShortTermGainLoss) : '-';
  return (
    <td className={`p-2 text-right ${colorClass} ${className}`}>
      {onClick ? (
        <button type="button" className="w-full text-right bg-transparent" onClick={onClick}>
          {rst}
        </button>
      ) : (
        rst
      )}
    </td>
  );
};
