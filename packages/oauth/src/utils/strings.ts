export function isString(value: unknown): value is string {
  if (value != null && typeof value === 'string') {
    return true
  }
  return false
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

/**
 * Removes leading characters from a string.
 */
export function trimStart(text: string, chars: string): string {
  return text.replace(new RegExp(`^[${chars}]+`, 'g'), '')
}

/**
 * Removes trailing characters from a string.
 */
export function trimEnd(text: string, chars: string): string {
  return text.replace(new RegExp(`[${chars}]+$`, 'g'), '')
}

/**
 * Removes all quotes/apostrophes from the beginning and end of string.
 *
 * @param text
 * @returns {string}
 */
export function trimQuotes(text: string): string {
  if (text && text.length > 0) {
    // Make sure only enclosing quotes are removed
    const headTrimmed = trimStart(text, '\'"')
    if (headTrimmed.length < text.length) {
      return trimEnd(headTrimmed, '\'"')
    }
  }
  return text
}

export function stringSorter(a: string, b: string, sortDesc?: boolean): number {
  let res = 0
  if (a < b) {
    res = -1
  }
  if (a > b) {
    res = 1
  }
  if (sortDesc) {
    res *= -1
  }
  return res
}

export function parseBoolean(value: string): boolean {
  if (!value) return false

  return /^true$/i.test(value) || parseInt(value) === 1
}

/**
 * Will format a property to a standard human readable string with its spaces.
 * It will respect MBean and leave it together
 * @param str The property to transform
 * @returns The property with its proper spaces
 */
export function humanizeLabels(str: string): string {
  return str
    .split('-')
    .filter(str => !isBlank(str))
    .map(str => str.replace(/^./, str => str.toUpperCase()))
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b([A-Z]+)([A-Z])([a-z])/, '$1 $2$3')
    .replace('M Bean', 'MBean')
    .replace('Mbean', 'MBean')
    .replace(/^./, str => str.toUpperCase())
    .replace(/ +/, ' ')
    .trim()
}
