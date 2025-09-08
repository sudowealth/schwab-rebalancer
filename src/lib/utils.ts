import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatQuantity(qty: number): string {
  // Show up to 3 decimals if fractional, else no decimals
  const hasFraction = Math.abs(qty % 1) > 1e-6;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasFraction ? 0 : 0,
    maximumFractionDigits: hasFraction ? 3 : 0,
  }).format(qty);
}
