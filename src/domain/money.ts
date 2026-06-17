/**
 * Money math — one place, visible derivation, no hidden rounding (brief 09).
 * Pay Estimate line amount = quantity × unit price, rounded to cents once.
 */
export function lineAmount(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function sumAmounts(amounts: number[]): number {
  return Math.round(amounts.reduce((s, a) => s + a, 0) * 100) / 100;
}
