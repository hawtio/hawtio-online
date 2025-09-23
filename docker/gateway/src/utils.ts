export function isObject(value: unknown): value is object {
  if (!value) return false

  const type = typeof value
  return value != null && (type === 'object' || type === 'function')
}

export function cloneObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value) && typeof value === 'object'
}

export function isString(value: unknown): value is string {
  return typeof value === 'string' || value instanceof String
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const strings: string[] = []
  value.forEach(v => {
    strings.push(v.toString())
  })

  return strings
}

export function isError(obj: unknown): obj is Error {
  return obj instanceof Error
}

// IP Address Regex Matcher
const ipPattern =
  /\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/gm

export function maskIPAddresses(obj: string | object): string {
  let jsonStr
  if (isObject(obj)) jsonStr = JSON.stringify(obj)
  else jsonStr = obj

  const shouldMaskIPAddresses = process.env.HAWTIO_ONLINE_MASK_IP_ADDRESSES ?? 'true'
  // Return jsonStr if masking has been disabled
  if (shouldMaskIPAddresses.toLowerCase() !== 'true') return jsonStr

  return jsonStr.replaceAll(ipPattern, '<masked>')
}
