// Formats a number as a currency string with thousands separators.
// Uses regex instead of toLocaleString to ensure consistent output on
// Android (Hermes engine) where locale support can be unreliable.
//
// fmt(1234.5)   → "1,234.50"
// fmt(-999.9)   → "-999.90"
// fmt(1000000)  → "1,000,000.00"
export function fmt(n) {
  const num = Number(n) || 0;
  const [int, dec] = Math.abs(num).toFixed(2).split('.');
  const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return num < 0 ? `-${intFormatted}.${dec}` : `${intFormatted}.${dec}`;
}
