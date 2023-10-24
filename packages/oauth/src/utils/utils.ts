export function relToAbsUrl(relativeUrl: string): string {
  return new URL(relativeUrl, window.location.origin).href
}
