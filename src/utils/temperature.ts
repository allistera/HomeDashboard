export function temperatureText(value: number | null, digits = 1): string {
  return value === null ? "—" : `${value.toFixed(digits)}°`;
}
