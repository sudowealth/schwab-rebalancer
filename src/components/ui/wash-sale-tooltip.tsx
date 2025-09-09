import { AlertTriangle, Info } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { SimpleTooltip } from './simple-tooltip';

export interface UIWashSaleInfo {
  soldDate: string;
  daysRemaining?: number;
  lossAmount?: number;
  accountName?: string;
}

interface WashSaleTooltipProps {
  washSaleInfo?: UIWashSaleInfo | null;
  className?: string;
}

export function WashSaleTooltip({ washSaleInfo, className = '' }: WashSaleTooltipProps) {
  const tooltipContent = generateWashSaleTooltipContent(washSaleInfo);

  return (
    <SimpleTooltip content={tooltipContent}>
      <AlertTriangle className={`h-3 w-3 text-yellow-500 flex-shrink-0 ${className}`} />
    </SimpleTooltip>
  );
}

interface WashSaleRestrictionIndicatorProps {
  blockingReason?: string;
  className?: string;
}

export function WashSaleRestrictionIndicator({
  blockingReason,
  className = '',
}: WashSaleRestrictionIndicatorProps) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span>Wash sale restriction</span>
      {blockingReason && (
        <SimpleTooltip content={blockingReason}>
          <Info className="w-4 h-4 text-blue-500" />
        </SimpleTooltip>
      )}
    </div>
  );
}

interface WashSaleRuleInfoProps {
  className?: string;
}

export function WashSaleRuleInfo({ className = '' }: WashSaleRuleInfoProps) {
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-md p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Info className="h-5 w-5 text-blue-400" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-blue-800">Wash-Sale Rule Information</h3>
          <div className="mt-2 text-sm text-blue-700">
            <p>{WASH_SALE_RULE_EXPLANATION}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Constants
export const WASH_SALE_RULE_EXPLANATION =
  'Securities are restricted for 31 days after a loss is realized to comply with IRS wash-sale rules. During this period, the system will not purchase these securities in any sleeve.';

function generateWashSaleTooltipContent(washSaleInfo?: UIWashSaleInfo | null): string {
  if (!washSaleInfo) return 'Wash Sale Risk';

  const soldDate = new Date(washSaleInfo.soldDate).toLocaleDateString();
  const daysRemaining = washSaleInfo.daysRemaining || 0;
  const lossAmount = formatCurrency(washSaleInfo.lossAmount || 0);
  const accountName = washSaleInfo.accountName || 'Unknown Account';

  return `Wash Sale Restriction
  
Sold: ${soldDate}
Account: ${accountName}
Loss: ${lossAmount}
Days until restriction lifts: ${daysRemaining}

${WASH_SALE_RULE_EXPLANATION}`;
}
