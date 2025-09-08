export const CASH_TICKER = "$$$";
export const MANUAL_CASH_TICKER = "MCASH";

export function isBaseCashTicker(ticker: string | undefined | null): boolean {
  return ticker === CASH_TICKER;
}

export function isAnyCashTicker(ticker: string | undefined | null): boolean {
  return ticker === CASH_TICKER || ticker === MANUAL_CASH_TICKER;
}


