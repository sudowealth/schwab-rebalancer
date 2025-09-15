import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatQuantity(qty: number): string {
  // Show up to 3 decimals if fractional, else no decimals
  const hasFraction = Math.abs(qty % 1) > 1e-6;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: hasFraction ? 0 : 0,
    maximumFractionDigits: hasFraction ? 3 : 0,
  }).format(qty);
}

/**
 * Generate a clean, unique ID using UUID v4
 * Format: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
 */
export function generateId(): string {
  // Use crypto.randomUUID() for truly unique, collision-resistant IDs
  // Available in Node.js 14.17.0+ and modern browsers
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  // This is a simplified UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
