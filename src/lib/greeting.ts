/**
 * Saudação da Home — files_design/08 §8.
 *
 * Dynamic by DEVICE time, not a fixed text, and with no name (the product
 * does not store one) and no emoji. Takes the hour as a parameter, exactly
 * like the domain's own rule against reading a clock (src/domain/README.md) —
 * a screen reads `new Date()` once, this function stays pure and testable.
 */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}
