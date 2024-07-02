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
