import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { Fragment, useMemo, useState } from 'react';
import { CASH_TICKER } from '../../../lib/constants';
import {
  type ExportSleeveAllocationToExcelSleeveAllocationData,
  type ExportSleeveAllocationToExcelSleeveTableData,
  exportSleeveAllocationToExcel,
} from '../../../lib/excel-export';
import { addGroupTradesToBlotterServerFn } from '../../../lib/server-functions';
import { formatCurrency, formatPercent } from '../../../lib/utils';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { ExportButton } from '../../ui/export-button';
import { type UIWashSaleInfo, WashSaleTooltip } from '../../ui/wash-sale-tooltip';
import { type ColumnConfig, ColumnManagementModal } from './column-management-modal';
import {
  ActionCell,
  CostBasisCell,
  CurrentQtyCell,
  DifferenceCell,
  LongTermGainLossCell,
  OpenedAtCell,
  PercentageDistanceCell,
  PostTradeDiffCell,
  PostTradeDiffPercentCell,
  PostTradePercentCell,
  RealizedGainLossCell,
  RealizedLongTermGainLossCell,
  RealizedShortTermGainLossCell,
  ShortTermGainLossCell,
  TotalGainLossCell,
  type TradeItem,
  TradeQtyCell,
  TradeValueCell,
  ValueCell,
} from './sleeve-allocation-cells';
import { SleeveAllocationHeader } from './sleeve-allocation-header';
import {
  getDefaultColumnConfigs,
  type SortDirection,
  type SortField,
  TableHeaders,
} from './sleeve-allocation-table-headers';
import type {
  AccountHolding,
  Security,
  SleeveAllocationData,
  SleeveAllocationTableProps,
  SleeveTableData,
  Trade,
} from './sleeve-allocation-types';
import { calculateTradeMetrics } from './sleeve-allocation-utils';

type SleeveData = SleeveTableData;
type AccountData = SleeveAllocationData;

// Helper function to calculate realized gains from trades
const calculateRealizedGains = (
  security: Security,
  trades: Trade[],
  accountHoldings?: AccountHolding[],
) => {
  const sellTrades = trades.filter(
    (trade) =>
      trade.action === 'SELL' &&
      (trade.securityId === security.ticker || trade.ticker === security.ticker) &&
      trade.accountId,
  );

  if (sellTrades.length === 0) {
    return {
      realizedGainLoss: 0,
      realizedLongTermGainLoss: 0,
      realizedShortTermGainLoss: 0,
    };
  }

  // Find holdings for this security to get cost basis
  let costBasis = security.costBasis || 0;
  let openedAt = security.openedAt;

  // If we don't have cost basis from the security, try to get it from account holdings
  if (!costBasis && accountHoldings) {
    for (const holding of accountHoldings) {
      if (holding.ticker === security.ticker) {
        costBasis = holding.costBasis || 0;
        openedAt = holding.purchaseDate;
        break;
      }
    }
  }

  let totalRealizedGain = 0;
  sellTrades.forEach((trade) => {
    const salePrice = trade.estPrice || 0;
    const gainPerShare = salePrice - costBasis;
    const tradeRealizedGain = gainPerShare * Math.abs(trade.qty || 0);
    totalRealizedGain += tradeRealizedGain;
  });

  // Determine if long-term (>1 year) or short-term
  const isLongTerm = openedAt
    ? Date.now() -
        (typeof openedAt === 'number'
          ? openedAt
          : openedAt instanceof Date
            ? openedAt.getTime()
            : typeof openedAt === 'object' && 'getTime' in openedAt
              ? openedAt.getTime()
              : new Date(openedAt).getTime()) >
      365 * 24 * 60 * 60 * 1000
    : false;

  return {
    realizedGainLoss: totalRealizedGain,
    realizedLongTermGainLoss: isLongTerm ? totalRealizedGain : 0,
    realizedShortTermGainLoss: isLongTerm ? 0 : totalRealizedGain,
  };
};

export function SleeveAllocationTable({
  sleeveTableData,
  expandedSleeves,
  expandedAccounts,
  groupMembers,
  sleeveAllocationData,
  groupingMode,
  onGroupingModeChange,
  onSleeveExpansionToggle,
  onAccountExpansionToggle,
  onTickerClick,
  onSleeveClick,
  onRebalance,
  onToggleExpandAll,
  isAllExpanded,
  trades = [],
  sortField,
  sortDirection,
  onSort,
  onTradeQtyChange,
  accountHoldings = [],
  renderSummaryCards,
  groupId,
}: SleeveAllocationTableProps) {
  // Column management state
  const [columns, setColumns] = useState<ColumnConfig[]>(() =>
    getDefaultColumnConfigs(trades.length > 0),
  );

  // Update columns when trades change
  useMemo(() => {
    setColumns((prev) => {
      const defaultColumns = getDefaultColumnConfigs(trades.length > 0);
      // Preserve user's visibility preferences but add/remove trade columns as needed
      const existingVisibility = prev.reduce(
        (acc, col) => {
          acc[col.id] = col.visible;
          return acc;
        },
        {} as Record<string, boolean>,
      );

      return defaultColumns.map((col) => ({
        ...col,
        visible: existingVisibility[col.id] ?? col.visible,
      }));
    });
  }, [trades.length]);

  const columnOrder = useMemo(() => columns.map((col) => col.id), [columns]);

  const [addingToBlotter, setAddingToBlotter] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const hasSingleAccount = useMemo(() => {
    const uniqueAccountIds = new Set(
      groupMembers.map((member) => member.accountId).filter(Boolean),
    );
    return uniqueAccountIds.size <= 1;
  }, [groupMembers]);
  const handleAddToBlotter = async () => {
    try {
      setAddingToBlotter(true);
      // Build lightweight trades payload from current trade rows
      const simpleTrades = trades
        .filter((t) => (t.securityId || t.ticker) && Math.abs(t.qty || 0) > 0)
        // Exclude cash tickers
        .filter((t) => {
          const sym = t.ticker || t.securityId || '';
          return sym !== '$$$' && sym !== 'MCASH';
        })
        .map((t) => ({
          ticker: t.ticker || String(t.securityId ?? ''),
          type: t.action as 'BUY' | 'SELL',
          qty: Math.abs(t.qty),
          currentPrice: t.estPrice,
          accountId: t.accountId,
        }));
      if (simpleTrades.length === 0) return;
      // Group id is not directly available here; infer from groupMembers props
      await addGroupTradesToBlotterServerFn({
        data: { groupId, trades: simpleTrades },
      });
      // Notify blotter to refresh immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('orders:refresh', { detail: { groupId } }));
      }
    } finally {
      setAddingToBlotter(false);
    }
  };

  // Create a function to render cells based on column ID and data type
  const renderCell = (
    columnId: string,
    item: Record<string, unknown> & Partial<Security & SleeveData & AccountData>,
    itemType: 'sleeve' | 'security' | 'account',
    className?: string,
  ) => {
    switch (columnId) {
      case 'name':
        if (itemType === 'sleeve') {
          const sleeveKey = String(item.sleeveId || '');
          const isSleeveExpanded = expandedSleeves.has(sleeveKey);
          return (
            <td className="p-2 sticky left-0 bg-white group-hover:bg-gray-50 z-25 shadow-[1px_0_0_0_rgba(229,231,235,1),2px_0_4px_-2px_rgba(0,0,0,0.1)] w-64 max-w-64">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => onSleeveExpansionToggle(sleeveKey)}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  {isSleeveExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onSleeveClick(item.sleeveId || '')}
                  className="text-blue-600 hover:underline font-medium truncate whitespace-nowrap min-w-0 flex-1 text-left"
                  title={item.sleeveName || ''}
                >
                  {item.sleeveName || ''}
                </button>
              </div>
            </td>
          );
        }
        if (itemType === 'security') {
          return (
            <td
              className={`p-2 sticky left-0 z-25 shadow-[1px_0_0_0_rgba(229,231,235,1),2px_0_4px_-2px_rgba(0,0,0,0.1)] w-64 max-w-64 ${className ? 'bg-gray-50' : 'bg-gray-50'}`}
            >
              <div className={`flex items-center gap-1 min-w-0 ${className ? 'pl-8' : 'pl-8'}`}>
                <button
                  type="button"
                  onClick={() => onTickerClick(item.ticker || '')}
                  className="text-blue-600 hover:underline truncate whitespace-nowrap min-w-0 flex-shrink"
                  title={item.ticker === 'MCASH' ? 'Manual Cash (MCASH)' : item.ticker || ''}
                >
                  {item.ticker === 'MCASH' ? 'Manual Cash' : item.ticker}
                </button>
                {item.hasWashSaleRisk && (
                  <WashSaleTooltip washSaleInfo={item.washSaleInfo as UIWashSaleInfo | null} />
                )}
              </div>
            </td>
          );
        }
        if (itemType === 'account') {
          const accountKey = item.accountId || '';
          const isAccountExpanded = expandedAccounts.has(accountKey);
          return (
            <td className="p-2 text-left w-64 max-w-64 sticky left-0 bg-white group-hover:bg-gray-50 z-25 shadow-[1px_0_0_0_rgba(229,231,235,1),2px_0_4px_-2px_rgba(0,0,0,0.1)]">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => onAccountExpansionToggle(accountKey || '')}
                  className="p-1 hover:bg-gray-200 rounded shrink-0"
                >
                  {isAccountExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <span className="font-medium truncate whitespace-nowrap" title={item.accountName}>
                  {item.accountName}
                </span>
              </div>
            </td>
          );
        }
        break;

      case 'currentValue':
        return <ValueCell value={item.currentValue || 0} />;

      case 'currentPercent':
        return (
          <td className="p-2 text-right">{formatPercent((item.currentPercent || 0) / 100)}</td>
        );

      case 'currentQty':
        return (
          <CurrentQtyCell item={item as TradeItem} itemType={itemType} className={className} />
        );

      case 'costBasis':
        if (itemType === 'security') {
          return <CostBasisCell item={item as TradeItem} className={className} />;
        }
        return <td className="p-2 text-right text-gray-400">-</td>;

      case 'price':
        if (itemType === 'security') {
          return (
            <td className={`p-2 text-right ${className || ''}`}>
              {formatCurrency(item.currentPrice || 0)}
            </td>
          );
        }
        return <td className="p-2 text-right text-gray-400">-</td>;

      case 'targetValue':
        return <ValueCell value={item.targetValue || 0} />;

      case 'targetPercent':
        return <td className="p-2 text-right">{formatPercent((item.targetPercent || 0) / 100)}</td>;

      case 'targetQty':
        if (itemType === 'sleeve' && item.sleeveId === 'cash') {
          return <td className="p-2 text-right">-</td>;
        }
        if (itemType === 'security') {
          return (
            <td className={`p-2 text-right ${className || ''}`}>
              {(item.currentPrice || 0) > 0
                ? Math.round((item.targetValue || 0) / (item.currentPrice || 1)).toLocaleString()
                : 0}
            </td>
          );
        }
        if (itemType === 'sleeve') {
          return (
            <td className="p-2 text-right">
              {(item.securities || [])
                .reduce((total: number, security: Security) => {
                  const targetQty =
                    (security.currentPrice || 0) > 0
                      ? Math.round((security.targetValue || 0 || 0) / (security.currentPrice || 1))
                      : 0;
                  return total + targetQty;
                }, 0)
                .toLocaleString()}
            </td>
          );
        }
        return <td className="p-2 text-right">-</td>;

      case 'difference':
        return <DifferenceCell value={item.difference || 0} className={className} />;

      case 'percentDistance':
        return (
          <PercentageDistanceCell
            currentPercent={item.currentPercent || 0}
            targetPercent={item.targetPercent || 0}
            className={className}
          />
        );

      case 'openedAt':
        if (itemType === 'security') {
          return <OpenedAtCell item={item as TradeItem} className={className} />;
        }
        return <td className="p-2 text-right text-gray-400">-</td>;

      case 'totalGainLoss':
        if (itemType === 'security' || itemType === 'sleeve') {
          return <TotalGainLossCell item={item as TradeItem} className={className} />;
        }
        return <td className="p-2 text-right text-gray-400">-</td>;

      case 'longTermGainLoss':
        if (itemType === 'security' || itemType === 'sleeve') {
          return <LongTermGainLossCell item={item as TradeItem} className={className} />;
        }
        return <td className="p-2 text-right text-gray-400">-</td>;

      case 'shortTermGainLoss':
        if (itemType === 'security' || itemType === 'sleeve') {
          return <ShortTermGainLossCell item={item as TradeItem} className={className} />;
        }
        return <td className="p-2 text-right text-gray-400">-</td>;

      case 'realizedGainLoss':
        if (itemType === 'security') {
          return (
            <RealizedGainLossCell
              item={
                {
                  ...item,
                  ...calculateRealizedGains(item as Security, trades, accountHoldings),
                } as TradeItem
              }
              className={className}
            />
          );
        }
        if (itemType === 'sleeve') {
          return <RealizedGainLossCell item={item as TradeItem} className={className} />;
        }
        return <td className="p-2 text-right text-gray-400">-</td>;

      case 'realizedLongTermGainLoss':
        if (itemType === 'security') {
          return (
            <RealizedLongTermGainLossCell
              item={
                {
                  ...item,
                  ...calculateRealizedGains(item as Security, trades, accountHoldings),
                } as TradeItem
              }
              className={className}
            />
          );
        }
        if (itemType === 'sleeve') {
          return <RealizedLongTermGainLossCell item={item as TradeItem} className={className} />;
        }
        return <td className="p-2 text-right text-gray-400">-</td>;

      case 'realizedShortTermGainLoss':
        if (itemType === 'security') {
          return (
            <RealizedShortTermGainLossCell
              item={
                {
                  ...item,
                  ...calculateRealizedGains(item as Security, trades, accountHoldings),
                } as TradeItem
              }
              className={className}
            />
          );
        }
        if (itemType === 'sleeve') {
          return <RealizedShortTermGainLossCell item={item as TradeItem} className={className} />;
        }
        return <td className="p-2 text-right text-gray-400">-</td>;

      // Trade columns
      case 'action':
        if (trades.length > 0) {
          return (
            <ActionCell
              item={item as TradeItem}
              trades={trades}
              itemType={itemType}
              className={className}
            />
          );
        }
        break;

      case 'tradeQty':
        if (trades.length > 0) {
          return (
            <TradeQtyCell
              item={item as TradeItem}
              trades={trades}
              itemType={itemType}
              className={className}
              onTradeQtyChange={onTradeQtyChange}
            />
          );
        }
        break;

      case 'tradeValue':
        if (trades.length > 0) {
          return (
            <TradeValueCell
              item={item as TradeItem}
              trades={trades}
              itemType={itemType}
              className={className}
            />
          );
        }
        break;

      case 'postTradePercent':
        if (trades.length > 0) {
          if (itemType === 'sleeve') {
            return (
              <PostTradePercentCell
                currentValue={item.currentValue || 0}
                targetValue={item.targetValue || 0}
                targetPercent={item.targetPercent || 0}
                trades={trades}
                tickers={(item.securities || []).map((s: Security) => s.ticker)}
                totalCurrentValue={sleeveTableData.reduce((sum, s) => sum + s.currentValue, 0)}
                isCashSleeve={item.sleeveId === 'cash'}
              />
            );
          }
          if (itemType === 'security') {
            return (
              <PostTradePercentCell
                currentValue={item.currentValue || 0}
                targetValue={item.targetValue || 0}
                targetPercent={item.targetPercent || 0}
                trades={trades}
                tickers={item.ticker ? [item.ticker] : []}
                totalCurrentValue={sleeveTableData.reduce((sum, s) => sum + s.currentValue, 0)}
                className={className}
                isCashSleeve={item.ticker === CASH_TICKER || item.ticker === 'MCASH'}
              />
            );
          }
        }
        break;

      case 'postTradeDiff':
        if (trades.length > 0) {
          if (itemType === 'sleeve') {
            return (
              <PostTradeDiffCell
                currentValue={item.currentValue || 0}
                targetValue={item.targetValue || 0}
                trades={trades}
                tickers={(item.securities || []).map((s: Security) => s.ticker)}
                totalCurrentValue={sleeveTableData.reduce((sum, s) => sum + s.currentValue, 0)}
                isCashSleeve={item.sleeveId === 'cash'}
              />
            );
          }
          if (itemType === 'security') {
            return (
              <PostTradeDiffCell
                currentValue={item.currentValue || 0}
                targetValue={item.targetValue || 0}
                trades={trades}
                tickers={item.ticker ? [item.ticker] : []}
                totalCurrentValue={sleeveTableData.reduce((sum, s) => sum + s.currentValue, 0)}
                className={className}
                isCashSleeve={item.ticker === CASH_TICKER || item.ticker === 'MCASH'}
              />
            );
          }
        }
        break;

      case 'postTradeDiffPercent':
        if (trades.length > 0) {
          if (itemType === 'sleeve') {
            return (
              <PostTradeDiffPercentCell
                currentValue={item.currentValue || 0}
                targetValue={item.targetValue || 0}
                targetPercent={item.targetPercent || 0}
                trades={trades}
                tickers={(item.securities || []).map((s: Security) => s.ticker)}
                totalCurrentValue={sleeveTableData.reduce((sum, s) => sum + s.currentValue, 0)}
                isCashSleeve={item.sleeveId === 'cash'}
              />
            );
          }
          if (itemType === 'security') {
            return (
              <PostTradeDiffPercentCell
                currentValue={item.currentValue || 0}
                targetValue={item.targetValue || 0}
                targetPercent={item.targetPercent || 0}
                trades={trades}
                tickers={item.ticker ? [item.ticker] : []}
                totalCurrentValue={sleeveTableData.reduce((sum, s) => sum + s.currentValue, 0)}
                className={className}
                isCashSleeve={item.ticker === CASH_TICKER || item.ticker === 'MCASH'}
              />
            );
          }
        }
        break;

      default:
        return <td className="p-2 text-right">-</td>;
    }

    return <td className="p-2 text-right">-</td>;
  };

  // Get visible columns in the correct order
  const getVisibleColumnIds = () => {
    return columns.filter((col) => col.visible).map((col) => col.id);
  };
  const getTradeValue = (
    item: Record<string, unknown> & Partial<Security & SleeveData & AccountData>,
    field: SortField,
  ) => {
    if (trades.length === 0) return 0;

    const tickers =
      groupingMode === 'sleeve'
        ? item.securities?.map((s: Security) => s.ticker) || [item.ticker]
        : [item.ticker];

    switch (field) {
      case 'action': {
        // Cash always shows "-"
        if (groupingMode === 'sleeve' && item.sleeveId === 'cash') {
          return '-';
        }
        // Filter out cash trades for non-cash sleeves/securities
        const nonCashTickers = tickers.filter(
          (t): t is string => typeof t === 'string' && t !== CASH_TICKER,
        );
        const nonCashTrades = trades.filter((t) => {
          const id = t.securityId || t.ticker || '';
          return nonCashTickers.includes(id) && id !== CASH_TICKER;
        });
        const netQty = nonCashTrades.reduce((sum, t) => sum + t.qty, 0);
        if (netQty > 0) return 'BUY';
        if (netQty < 0) return 'SELL';
        return 'NONE';
      }
      case 'tradeQty': {
        // Cash always shows "-"
        if (groupingMode === 'sleeve' && item.sleeveId === 'cash') {
          return 0; // Return 0 so it displays as "-"
        }
        // Filter out cash trades for non-cash sleeves/securities
        const nonCashTickers = tickers.filter(
          (t): t is string => typeof t === 'string' && t !== CASH_TICKER,
        );
        const nonCashTrades = trades.filter((t) => {
          const id = t.securityId || t.ticker || '';
          return nonCashTickers.includes(id) && id !== CASH_TICKER;
        });
        return nonCashTrades.reduce((sum, t) => sum + t.qty, 0);
      }
      case 'tradeValue': {
        // Cash always shows "-"
        if (groupingMode === 'sleeve' && item.sleeveId === 'cash') {
          return 0; // Return 0 so it displays as "-"
        }
        // Filter out cash trades for non-cash sleeves/securities
        const nonCashTickers = tickers.filter(
          (t): t is string => typeof t === 'string' && t !== CASH_TICKER,
        );
        const nonCashTrades = trades.filter((t) => {
          const id = t.securityId || t.ticker || '';
          return nonCashTickers.includes(id) && id !== CASH_TICKER;
        });
        return nonCashTrades.reduce((sum, t) => sum + t.estValue, 0);
      }
      case 'postTradePercent': {
        const totalCurrentValue =
          groupingMode === 'sleeve'
            ? sleeveTableData.reduce((sum, s) => sum + s.currentValue, 0)
            : sleeveAllocationData.reduce((sum, a) => sum + (a.totalValue || 0), 0);
        const { postTradePercent } = calculateTradeMetrics.getPostTradeMetrics(
          item.currentValue || 0,
          trades,
          tickers.filter((t): t is string => typeof t === 'string'),
          totalCurrentValue,
        );
        return postTradePercent;
      }
      case 'postTradeDiff':
        return calculateTradeMetrics.getPostTradeDiff(
          item.currentValue || 0,
          item.targetValue || 0,
          trades,
          tickers.filter((t): t is string => typeof t === 'string'),
          groupingMode === 'sleeve' && item.sleeveId === 'cash',
        );
      case 'postTradeDiffPercent': {
        const totalValue =
          groupingMode === 'sleeve'
            ? sleeveTableData.reduce((sum, s) => sum + s.currentValue, 0)
            : sleeveAllocationData.reduce((sum, a) => sum + (a.totalValue || 0), 0);
        const { postTradePercent: postPercent } = calculateTradeMetrics.getPostTradeMetrics(
          item.currentValue || 0,
          trades,
          tickers.filter((t): t is string => typeof t === 'string'),
          totalValue,
        );
        const targetPercent = item.targetPercent || 0;
        return targetPercent > 0
          ? ((postPercent - targetPercent) / targetPercent) * 100
          : postPercent;
      }
      default:
        return 0;
    }
  };

  const sortData = (
    data: (Record<string, unknown> & Partial<Security & SleeveData & AccountData>)[],
    field: SortField,
    direction: SortDirection,
  ) => {
    if (!direction || !field) return data;

    return [...data].sort((a, b) => {
      let aValue: string | number | undefined;
      let bValue: string | number | undefined;

      switch (field) {
        case 'name':
          aValue = groupingMode === 'sleeve' ? a.sleeveName : a.accountName;
          bValue = groupingMode === 'sleeve' ? b.sleeveName : b.accountName;
          break;
        case 'currentValue':
          aValue = a.currentValue || 0;
          bValue = b.currentValue || 0;
          break;
        case 'currentPercent':
          aValue = a.currentPercent || 0;
          bValue = b.currentPercent || 0;
          break;
        case 'targetValue':
          aValue = a.targetValue || 0;
          bValue = b.targetValue || 0;
          break;
        case 'targetPercent':
          aValue = a.targetPercent || 0;
          bValue = b.targetPercent || 0;
          break;
        case 'difference':
          aValue = a.difference || (a.currentValue || 0) - (a.targetValue || 0);
          bValue = b.difference || (b.currentValue || 0) - (b.targetValue || 0);
          break;
        case 'percentDistance':
          aValue = Math.abs((a.currentPercent || 0) - (a.targetPercent || 0));
          bValue = Math.abs((b.currentPercent || 0) - (b.targetPercent || 0));
          break;
        case 'totalGainLoss':
          aValue = a.totalGainLoss || 0;
          bValue = b.totalGainLoss || 0;
          break;
        case 'longTermGainLoss':
          aValue = a.longTermGainLoss || 0;
          bValue = b.longTermGainLoss || 0;
          break;
        case 'shortTermGainLoss':
          aValue = a.shortTermGainLoss || 0;
          bValue = b.shortTermGainLoss || 0;
          break;
        case 'realizedGainLoss':
          if (groupingMode === 'sleeve') {
            // For sleeves, calculate aggregated realized G/L from securities
            let aRealizedTotal = 0;
            let bRealizedTotal = 0;

            if (a.securities) {
              (a.securities as Security[]).forEach((security: Security) => {
                const realizedGains = calculateRealizedGains(security, trades, accountHoldings);
                aRealizedTotal += realizedGains.realizedGainLoss;
              });
            }

            if (b.securities) {
              (b.securities as Security[]).forEach((security: Security) => {
                const realizedGains = calculateRealizedGains(security, trades, accountHoldings);
                bRealizedTotal += realizedGains.realizedGainLoss;
              });
            }

            aValue = aRealizedTotal;
            bValue = bRealizedTotal;
          } else {
            aValue = a.realizedGainLoss || 0;
            bValue = b.realizedGainLoss || 0;
          }
          break;
        case 'realizedLongTermGainLoss':
          if (groupingMode === 'sleeve') {
            // For sleeves, calculate aggregated realized LT G/L from securities
            let aRealizedLTTotal = 0;
            let bRealizedLTTotal = 0;

            if (a.securities) {
              (a.securities as Security[]).forEach((security: Security) => {
                const realizedGains = calculateRealizedGains(security, trades, accountHoldings);
                aRealizedLTTotal += realizedGains.realizedLongTermGainLoss;
              });
            }

            if (b.securities) {
              (b.securities as Security[]).forEach((security: Security) => {
                const realizedGains = calculateRealizedGains(security, trades, accountHoldings);
                bRealizedLTTotal += realizedGains.realizedLongTermGainLoss;
              });
            }

            aValue = aRealizedLTTotal;
            bValue = bRealizedLTTotal;
          } else {
            aValue = a.realizedLongTermGainLoss || 0;
            bValue = b.realizedLongTermGainLoss || 0;
          }
          break;
        case 'realizedShortTermGainLoss':
          if (groupingMode === 'sleeve') {
            // For sleeves, calculate aggregated realized ST G/L from securities
            let aRealizedSTTotal = 0;
            let bRealizedSTTotal = 0;

            if (a.securities) {
              (a.securities as Security[]).forEach((security: Security) => {
                const realizedGains = calculateRealizedGains(security, trades, accountHoldings);
                aRealizedSTTotal += realizedGains.realizedShortTermGainLoss;
              });
            }

            if (b.securities) {
              (b.securities as Security[]).forEach((security: Security) => {
                const realizedGains = calculateRealizedGains(security, trades, accountHoldings);
                bRealizedSTTotal += realizedGains.realizedShortTermGainLoss;
              });
            }

            aValue = aRealizedSTTotal;
            bValue = bRealizedSTTotal;
          } else {
            aValue = a.realizedShortTermGainLoss || 0;
            bValue = b.realizedShortTermGainLoss || 0;
          }
          break;
        case 'action':
        case 'tradeQty':
        case 'tradeValue':
        case 'postTradePercent':
        case 'postTradeDiff':
        case 'postTradeDiffPercent':
          aValue = getTradeValue(a, field);
          bValue = getTradeValue(b, field);
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        // Special handling for action field to sort BUY > NONE > SELL
        if (field === 'action') {
          const actionOrder = { BUY: 2, NONE: 1, SELL: 0 };
          const aOrder = actionOrder[aValue as keyof typeof actionOrder] ?? -1;
          const bOrder = actionOrder[bValue as keyof typeof actionOrder] ?? -1;
          return direction === 'asc' ? bOrder - aOrder : aOrder - bOrder;
        }
        const comparison = aValue.localeCompare(bValue);
        return direction === 'asc' ? comparison : -comparison;
      }

      const numA = Number(aValue) || 0;
      const numB = Number(bValue) || 0;
      return direction === 'asc' ? numA - numB : numB - numA;
    });
  };

  const handleExportToExcel = async () => {
    exportSleeveAllocationToExcel(
      sleeveTableData as ExportSleeveAllocationToExcelSleeveTableData,
      sleeveAllocationData as ExportSleeveAllocationToExcelSleeveAllocationData,
      groupingMode,
      `sleeve-allocation-${groupingMode}`,
      trades,
    );
  };

  const handleExportClick = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await handleExportToExcel();
    } finally {
      setIsExporting(false);
    }
  };

  const summaryContent = typeof renderSummaryCards === 'function' ? renderSummaryCards() : null;
  const summarySection = <div className="px-6 py-4">{summaryContent}</div>;
  const controlsSection = (
    <div className="flex items-center justify-between">
      {groupMembers.length > 1 ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <Button
              variant={groupingMode === 'sleeve' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onGroupingModeChange('sleeve')}
              className="rounded-r-none"
            >
              By Sleeve
            </Button>
            <Button
              variant={groupingMode === 'account' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onGroupingModeChange('account')}
              className="rounded-l-none border-l-0"
            >
              By Account
            </Button>
          </div>
        </div>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-2">
        <ColumnManagementModal columns={columns} onColumnsChange={setColumns} />
        <ExportButton onExport={handleExportClick} isLoading={isExporting} />
      </div>
    </div>
  );

  if (sleeveTableData.length === 0) {
    return (
      <Card>
        <SleeveAllocationHeader onRebalance={onRebalance} />
        {summarySection}
        <CardContent className="pt-0 px-6">
          {controlsSection}
          <div className="text-center py-8">
            <p className="text-gray-500">No sleeve data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderSleeveGrouping = () => {
    const sortedData =
      sortField && sortDirection
        ? sortData(sleeveTableData, sortField, sortDirection)
        : sleeveTableData;
    return sortedData.map((sleeve) => {
      const sleeveKey = sleeve.sleeveId || '';
      const isSleeveExpanded = expandedSleeves.has(sleeveKey);

      return (
        <Fragment key={sleeveKey}>
          {/* Sleeve Row */}
          <tr className="border-b hover:bg-gray-50 group">
            {getVisibleColumnIds().map((columnId) => {
              // Special handling for gain/loss columns - need to aggregate data
              if (
                [
                  'totalGainLoss',
                  'longTermGainLoss',
                  'shortTermGainLoss',
                  'realizedGainLoss',
                  'realizedLongTermGainLoss',
                  'realizedShortTermGainLoss',
                ].includes(columnId)
              ) {
                let totalGainLoss = 0;
                let longTermGainLoss = 0;
                let shortTermGainLoss = 0;
                let realizedGainLoss = 0;
                let realizedLongTermGainLoss = 0;
                let realizedShortTermGainLoss = 0;

                (sleeve.securities || []).forEach((security: Security) => {
                  totalGainLoss += security.totalGainLoss || 0;
                  longTermGainLoss += security.longTermGainLoss || 0;
                  shortTermGainLoss += security.shortTermGainLoss || 0;

                  // Add realized gains from trades
                  const realizedGains = calculateRealizedGains(security, trades, accountHoldings);
                  realizedGainLoss += realizedGains.realizedGainLoss;
                  realizedLongTermGainLoss += realizedGains.realizedLongTermGainLoss;
                  realizedShortTermGainLoss += realizedGains.realizedShortTermGainLoss;
                });

                const aggregatedData = {
                  ...sleeve,
                  totalGainLoss,
                  longTermGainLoss,
                  shortTermGainLoss,
                  realizedGainLoss,
                  realizedLongTermGainLoss,
                  realizedShortTermGainLoss,
                };

                return (
                  <React.Fragment key={columnId}>
                    {renderCell(columnId, aggregatedData, 'sleeve')}
                  </React.Fragment>
                );
              }

              return (
                <React.Fragment key={columnId}>
                  {renderCell(columnId, sleeve, 'sleeve')}
                </React.Fragment>
              );
            })}
          </tr>

          {/* Nested Rows */}
          {isSleeveExpanded &&
            (() => {
              const relatedAccounts = sleeveAllocationData.filter((account) =>
                (account.sleeves || []).some(
                  (accSleeve: SleeveData) => accSleeve.sleeveId === sleeve.sleeveId,
                ),
              );

              if (hasSingleAccount) {
                const account = relatedAccounts[0];
                const accountSleeve = account?.sleeves.find(
                  (accSleeve: SleeveData) => accSleeve.sleeveId === sleeve.sleeveId,
                ) as SleeveData | undefined;

                if (!account || !accountSleeve) {
                  return null;
                }

                return (accountSleeve.securities || []).map((security: Security) => (
                  <tr key={`${sleeveKey}-${security.ticker}`} className="bg-gray-50">
                    {getVisibleColumnIds().map((columnId) => {
                      if (columnId === 'name') {
                        return (
                          <td key={columnId} className="p-2 pl-12">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onTickerClick(security.ticker)}
                                className="text-blue-600 hover:underline"
                              >
                                {security.ticker === 'MCASH' ? 'Manual Cash' : security.ticker}
                              </button>
                              {security.hasWashSaleRisk && (
                                <WashSaleTooltip
                                  washSaleInfo={security.washSaleInfo as UIWashSaleInfo | null}
                                />
                              )}
                            </div>
                          </td>
                        );
                      }

                      const securityData = {
                        ...security,
                        currentPercent:
                          ((security.currentValue || 0) / (account.totalValue || 1)) * 100,
                        targetPercent:
                          ((security.targetValue || 0) / (account.totalValue || 1)) * 100,
                        difference: (security.currentValue || 0) - (security.targetValue || 0),
                      } as Record<string, unknown>;

                      return (
                        <React.Fragment key={columnId}>
                          {renderCell(columnId, securityData, 'security', 'text-sm')}
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ));
              }

              return relatedAccounts.map((account) => {
                const accountKey = account.accountId || '';
                const compositeKey = `${sleeveKey}-${accountKey}`;
                const isAccountExpanded = expandedAccounts.has(compositeKey);
                const accountSleeve = (account.sleeves || []).find(
                  (accSleeve: SleeveData) => accSleeve.sleeveId === sleeve.sleeveId,
                ) as SleeveData | undefined;
                if (!accountSleeve) return null;

                return (
                  <Fragment key={compositeKey}>
                    {/* Account row under sleeve */}
                    <tr className="bg-blue-50">
                      {getVisibleColumnIds().map((columnId) => {
                        if (columnId === 'name') {
                          return (
                            <td key={columnId} className="p-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onAccountExpansionToggle(compositeKey)}
                                  className="p-1 hover:bg-gray-200 rounded"
                                >
                                  {isAccountExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                                <span className="font-medium truncate" title={account.accountName}>
                                  {account.accountName}
                                </span>
                              </div>
                            </td>
                          );
                        }

                        // Gain/loss aggregations for the sleeve within this account
                        if (
                          [
                            'totalGainLoss',
                            'longTermGainLoss',
                            'shortTermGainLoss',
                            'realizedGainLoss',
                            'realizedLongTermGainLoss',
                            'realizedShortTermGainLoss',
                          ].includes(columnId)
                        ) {
                          let totalGainLoss = 0;
                          let longTermGainLoss = 0;
                          let shortTermGainLoss = 0;
                          let realizedGainLoss = 0;
                          let realizedLongTermGainLoss = 0;
                          let realizedShortTermGainLoss = 0;

                          (accountSleeve.securities || []).forEach((security: Security) => {
                            totalGainLoss += security.totalGainLoss || 0;
                            longTermGainLoss += security.longTermGainLoss || 0;
                            shortTermGainLoss += security.shortTermGainLoss || 0;
                            const realizedGains = calculateRealizedGains(
                              security,
                              trades,
                              accountHoldings,
                            );
                            realizedGainLoss += realizedGains.realizedGainLoss;
                            realizedLongTermGainLoss += realizedGains.realizedLongTermGainLoss;
                            realizedShortTermGainLoss += realizedGains.realizedShortTermGainLoss;
                          });

                          const aggregatedData = {
                            ...accountSleeve,
                            currentPercent:
                              ((accountSleeve.currentValue || 0) / (account.totalValue || 1)) * 100,
                            targetPercent:
                              ((accountSleeve.targetValue || 0) / (account.totalValue || 1)) * 100,
                            difference:
                              (accountSleeve.currentValue || 0) - (accountSleeve.targetValue || 0),
                            totalGainLoss,
                            longTermGainLoss,
                            shortTermGainLoss,
                            realizedGainLoss,
                            realizedLongTermGainLoss,
                            realizedShortTermGainLoss,
                          } as Record<string, unknown>;

                          return (
                            <React.Fragment key={columnId}>
                              {renderCell(columnId, aggregatedData, 'sleeve')}
                            </React.Fragment>
                          );
                        }

                        const sleeveDataForAccount = {
                          ...accountSleeve,
                          currentPercent:
                            ((accountSleeve.currentValue || 0) / (account.totalValue || 1)) * 100,
                          targetPercent:
                            ((accountSleeve.targetValue || 0) / (account.totalValue || 1)) * 100,
                          difference:
                            (accountSleeve.currentValue || 0) - (accountSleeve.targetValue || 0),
                        } as Record<string, unknown>;

                        return (
                          <React.Fragment key={columnId}>
                            {renderCell(columnId, sleeveDataForAccount, 'sleeve')}
                          </React.Fragment>
                        );
                      })}
                    </tr>

                    {/* Securities within this account/sleeve */}
                    {isAccountExpanded &&
                      (accountSleeve.securities || []).map((security: Security) => (
                        <tr key={`${compositeKey}-${security.ticker}`} className="bg-gray-50">
                          {getVisibleColumnIds().map((columnId) => {
                            if (columnId === 'name') {
                              return (
                                <td key={columnId} className="p-2 pl-12">
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onTickerClick(security.ticker)}
                                      className="text-blue-600 hover:underline"
                                    >
                                      {security.ticker === 'MCASH'
                                        ? 'Manual Cash'
                                        : security.ticker}
                                    </button>
                                    {security.hasWashSaleRisk && (
                                      <WashSaleTooltip
                                        washSaleInfo={
                                          security.washSaleInfo as UIWashSaleInfo | null
                                        }
                                      />
                                    )}
                                  </div>
                                </td>
                              );
                            }

                            const securityData = {
                              ...security,
                              currentPercent:
                                ((security.currentValue || 0) / (account.totalValue || 1)) * 100,
                              targetPercent:
                                ((security.targetValue || 0) / (account.totalValue || 1)) * 100,
                              difference:
                                (security.currentValue || 0) - (security.targetValue || 0),
                            } as Record<string, unknown>;

                            return (
                              <React.Fragment key={columnId}>
                                {renderCell(columnId, securityData, 'security', 'text-sm')}
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                  </Fragment>
                );
              });
            })()}
        </Fragment>
      );
    });
  };

  const renderAccountGrouping = () => {
    const sortedData =
      sortField && sortDirection
        ? sortData(sleeveAllocationData, sortField, sortDirection)
        : sleeveAllocationData;
    return sortedData.map((account) => {
      const accountKey = account.accountId || '';
      const isAccountExpanded = expandedAccounts.has(accountKey);

      return (
        <Fragment key={accountKey}>
          {/* Account Row */}
          <tr className="hover:bg-gray-50 border-b font-medium group">
            {getVisibleColumnIds().map((columnId) => {
              // Special handling for account-level data
              const accountData = {
                ...account,
                currentValue: account.totalValue || 0,
                currentPercent:
                  ((account.totalValue || 0) /
                    sleeveAllocationData.reduce((sum, a) => sum + (a.totalValue || 0), 0)) *
                  100,
                targetValue: account.totalValue || 0, // For accounts, target equals current
                targetPercent:
                  ((account.totalValue || 0) /
                    sleeveAllocationData.reduce((sum, a) => sum + (a.totalValue || 0), 0)) *
                  100,
                difference: 0, // No difference for accounts
              };

              return (
                <React.Fragment key={columnId}>
                  {renderCell(columnId, accountData, 'account')}
                </React.Fragment>
              );
            })}
          </tr>

          {/* Sleeve Rows under Account */}
          {isAccountExpanded &&
            (account.sleeves || []).map((sleeve: SleeveData) => (
              <Fragment key={`${accountKey}-${sleeve.sleeveId}`}>
                <tr className="bg-blue-50">
                  {getVisibleColumnIds().map((columnId) => {
                    // Special handling for sleeve under account - need different styling for name column
                    if (columnId === 'name') {
                      return (
                        <td key={columnId} className="p-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() =>
                                onSleeveExpansionToggle(`${accountKey}-${sleeve.sleeveId}`)
                              }
                              className="p-1 hover:bg-gray-200 rounded shrink-0"
                            >
                              {expandedSleeves.has(`${accountKey}-${sleeve.sleeveId}`) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onSleeveClick(sleeve.sleeveId || '')}
                              className="text-blue-600 hover:underline truncate min-w-0 flex-1 text-left"
                            >
                              {sleeve.sleeveName}
                            </button>
                          </div>
                        </td>
                      );
                    }

                    // Handle gain/loss columns with aggregation
                    if (
                      [
                        'totalGainLoss',
                        'longTermGainLoss',
                        'shortTermGainLoss',
                        'realizedGainLoss',
                        'realizedLongTermGainLoss',
                        'realizedShortTermGainLoss',
                      ].includes(columnId)
                    ) {
                      let totalGainLoss = 0;
                      let longTermGainLoss = 0;
                      let shortTermGainLoss = 0;
                      let realizedGainLoss = 0;
                      let realizedLongTermGainLoss = 0;
                      let realizedShortTermGainLoss = 0;

                      (sleeve.securities || []).forEach((security: Security) => {
                        totalGainLoss += security.totalGainLoss || 0;
                        longTermGainLoss += security.longTermGainLoss || 0;
                        shortTermGainLoss += security.shortTermGainLoss || 0;

                        // Add realized gains from trades
                        const realizedGains = calculateRealizedGains(
                          security,
                          trades,
                          accountHoldings,
                        );
                        realizedGainLoss += realizedGains.realizedGainLoss;
                        realizedLongTermGainLoss += realizedGains.realizedLongTermGainLoss;
                        realizedShortTermGainLoss += realizedGains.realizedShortTermGainLoss;
                      });

                      const aggregatedData = {
                        ...sleeve,
                        currentPercent:
                          ((sleeve.currentValue || 0) / (account.totalValue || 1)) * 100,
                        targetPercent:
                          ((sleeve.targetValue || 0) / (account.totalValue || 1)) * 100,
                        difference: (sleeve.currentValue || 0) - (sleeve.targetValue || 0),
                        totalGainLoss,
                        longTermGainLoss,
                        shortTermGainLoss,
                        realizedGainLoss,
                        realizedLongTermGainLoss,
                        realizedShortTermGainLoss,
                      };

                      return (
                        <React.Fragment key={columnId}>
                          {renderCell(columnId, aggregatedData, 'sleeve')}
                        </React.Fragment>
                      );
                    }

                    // Handle other columns with adjusted percentages for account context
                    const sleeveData = {
                      ...sleeve,
                      currentPercent:
                        ((sleeve.currentValue || 0) / (account.totalValue || 1)) * 100,
                      targetPercent: ((sleeve.targetValue || 0) / (account.totalValue || 1)) * 100,
                      difference: (sleeve.currentValue || 0) - (sleeve.targetValue || 0),
                    };

                    return (
                      <React.Fragment key={columnId}>
                        {renderCell(columnId, sleeveData, 'sleeve')}
                      </React.Fragment>
                    );
                  })}
                </tr>

                {/* Securities under Sleeve */}
                {expandedSleeves.has(`${accountKey}-${sleeve.sleeveId}`) &&
                  (sleeve.securities || []).map((security: Security) => (
                    <tr
                      key={`${accountKey}-${sleeve.sleeveId}-${security.ticker}`}
                      className="bg-gray-50"
                    >
                      {getVisibleColumnIds().map((columnId) => {
                        // Special handling for security name under account/sleeve - needs deeper indent
                        if (columnId === 'name') {
                          return (
                            <td key={columnId} className="p-2 pl-12">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onTickerClick(security.ticker)}
                                  className="text-blue-600 hover:underline"
                                >
                                  {security.ticker === 'MCASH' ? 'Manual Cash' : security.ticker}
                                </button>
                                {security.hasWashSaleRisk && (
                                  <WashSaleTooltip
                                    washSaleInfo={security.washSaleInfo as UIWashSaleInfo | null}
                                  />
                                )}
                              </div>
                            </td>
                          );
                        }

                        // Adjust percentages for account context
                        const securityData = {
                          ...security,
                          currentPercent:
                            ((security.currentValue || 0) / (account.totalValue || 1)) * 100,
                          targetPercent:
                            ((security.targetValue || 0) / (account.totalValue || 1)) * 100,
                          difference: (security.currentValue || 0) - (security.targetValue || 0),
                        };

                        return (
                          <React.Fragment key={columnId}>
                            {renderCell(columnId, securityData, 'security', 'text-sm')}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
              </Fragment>
            ))}
        </Fragment>
      );
    });
  };

  return (
    <Card>
      <SleeveAllocationHeader
        onRebalance={onRebalance}
        addToBlotter={{
          onClick: handleAddToBlotter,
          disabled: addingToBlotter,
          visible: trades.length > 0,
          count: trades.length,
        }}
      />
      {summarySection}

      <CardContent className="pt-0">
        {controlsSection}
        <div className="w-full overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm" style={{ minWidth: '1200px' }}>
            <TableHeaders
              hasTrades={trades.length > 0}
              groupingMode={groupingMode}
              onToggleExpandAll={onToggleExpandAll}
              isAllExpanded={isAllExpanded}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
              visibleColumns={columns}
              columnOrder={columnOrder}
            />
            <tbody>
              {groupingMode === 'sleeve' ? renderSleeveGrouping() : renderAccountGrouping()}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
