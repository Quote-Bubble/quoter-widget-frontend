/** Compact UK postcode for APIs: "SW19 4EH" -> "SW194EH". */
export function normalisePostcode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Rough UK postcode shape (outward + inward). */
export function looksLikeUkPostcode(value: string): boolean {
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(normalisePostcode(value));
}

/** "SW194EH" -> "SW19 4EH" for display. */
export function prettyPostcode(value: string): string {
  const compact = normalisePostcode(value);
  if (compact.length < 5) return value.trim().toUpperCase();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}
