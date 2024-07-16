import { stringSorter, isString } from './strings'

export function isObject(value: unknown): value is object {
  const type = typeof value
  return value != null && (type === 'object' || type === 'function')
}

export function cloneObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function isEmpty(obj: object): boolean {
  return Object.keys(obj).length === 0
}

export function hasProperty(obj: object|undefined, property: string): boolean {
  if (! obj) return false
  return obj.hasOwnProperty(property)
}

export function isArray<T>(obj: T | T[]): obj is T[] {
  return Array.isArray(obj)
}

export function isError(obj: unknown): obj is Error {
  return obj instanceof Error
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function'
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

export function objectSorter(aValue: unknown, bValue: unknown, sortDesc?: boolean) {
  if (isNumber(aValue)) {
    // Numeric sort
    if (!sortDesc) {
      return (aValue as number) - (bValue as number)
    }
    return (bValue as number) - (aValue as number)
  } else {
    // String sort
    return stringSorter(aValue as string, bValue as string, sortDesc)
  }
}

/**
 * Navigates the given set of paths in turn on the source object
 * and returns the last most value of the path or null if it could not be found.
 *
 * @method pathGet
 * @for Core
 * @static
 * @param {Object} object the start object to start navigating from
 * @param {Array} paths an array of path names to navigate or a string of dot separated paths to navigate
 * @return {*} the last step on the path which is updated
 */
export function pathGet(object: object, paths: string[] | string): Record<string, unknown> | unknown {
  const pathArray = isArray(paths) ? paths : (paths || '').split('.')
  let value: unknown | null = object

  pathArray.forEach(name => {
    // Test that value is valid
    if (!value) return

    /*
     * If we are still traversing and value is not an object
     * then must return null since we are trying to navigate
     * inside a string or number
     */
    if (!isObject(value)) {
      value = null
      return
    }

    // Test that value has a property of name
    if (!Object.prototype.hasOwnProperty.call(value, name)) {
      value = null
      return
    }

    const valueObj = value as Record<string, unknown>
    const v = valueObj[name]

    // Test whether v is valid
    if (!v) {
      value = null
      return
    }

    value = v
    return
  })

  return value
}

export function pathGetString(entity: Record<string, unknown>, path: string[] | string): string | null {
  const v = pathGet(entity, path)
  return isString(v) ? (v as string) : null
}

export function pathGetObject(
  entity: Record<string, unknown>,
  path: string[] | string,
): Record<string, unknown> | null {
  const v = pathGet(entity, path)
  return isObject(v) ? (v as Record<string, unknown>) : null
}
