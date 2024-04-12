import {
  Response as JolokiaResponse,
  ErrorResponse as JolokiaErrorResponse,
  VersionResponse as JolokiaVersionResponse,
} from 'jolokia.js'

export type ParseResult<T> = { hasError: false; parsed: T } | { hasError: true; error: string }

function isObject(value: unknown): value is object {
  const type = typeof value
  return value != null && (type === 'object' || type === 'function')
}

export function isJolokiaResponseType(o: unknown): o is JolokiaResponse {
  return isObject(o) && 'status' in o && 'timestamp' in o && 'value' in o
}

export function isJolokiaResponseErrorType(o: unknown): o is JolokiaErrorResponse {
  return isObject(o) && 'error_type' in o && 'error' in o
}

export function isJolokiaVersionResponseType(o: unknown): o is JolokiaVersionResponse {
  return isObject(o) && 'protocol' in o && 'agent' in o && 'info' in o
}

export function jolokiaResponseParse(text: string): ParseResult<JolokiaResponse> {
  try {
    const parsed = JSON.parse(text)

    if (isJolokiaResponseErrorType(parsed)) {
      const errorResponse: JolokiaErrorResponse = parsed as JolokiaErrorResponse
      return { error: errorResponse.error, hasError: true }
    } else if (isJolokiaResponseType(parsed)) {
      const response: JolokiaResponse = parsed as JolokiaResponse
      return { parsed: response, hasError: false }
    } else {
      return { error: 'Unrecognised jolokia response', hasError: true }
    }
  } catch (e) {
    let msg
    if (e instanceof Error) msg = e.message
    else msg = String(e)

    return { error: msg, hasError: true }
  }
}
