import util from 'util'

export const IP_ADDRESS_MASK = '***.***.***.***'

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

/**
 * Return true if the string is either null or empty.
 */
export function isBlank(str?: string): boolean {
  if (str === undefined || str === null) {
    return true
  }
  if (typeof str !== 'string') {
    // not null but also not a string...
    return false
  }

  return str.trim().length === 0
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
  if (!obj) return ''

  let jsonStr
  if (isObject(obj)) jsonStr = JSON.stringify(obj)
  else jsonStr = obj

  return !jsonStr || jsonStr.length === 0 ? jsonStr : jsonStr.replaceAll(ipPattern, IP_ADDRESS_MASK)
}

/**
 * Join the supplied strings together using '/', stripping any leading/ending '/'
 * from the supplied strings if needed, except the first and last string.
 */
export function joinPaths(...paths: string[]): string {
  const tmp: string[] = []
  paths.forEach((path, index) => {
    if (isBlank(path)) {
      return
    }
    if (path === '/') {
      tmp.push('')
      return
    }
    if (index !== 0 && path.match(/^\//)) {
      path = path.slice(1)
    }
    if (index < paths.length - 1 && path.match(/\/$/)) {
      path = path.slice(0, path.length - 1)
    }
    if (!isBlank(path)) {
      tmp.push(path)
    }
  })
  return tmp.join('/')
}

export function printObject(obj: unknown): string {
  return util.inspect(obj, false, null, true)
}
