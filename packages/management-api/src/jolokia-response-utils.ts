import {
  JolokiaErrorResponse,
  VersionResponseValue as JolokiaVersionResponseValue,
  JolokiaSuccessResponse,
} from 'jolokia.js'

export type ParseResult<T> = { hasError: false; parsed: T } | { hasError: true; error: string }

function isObject(value: unknown): value is object {
  const type = typeof value
  return value != null && (type === 'object' || type === 'function')
}

export function isJolokiaResponseSuccessType(o: unknown): o is JolokiaSuccessResponse {
  return isObject(o) && 'status' in o && 'timestamp' in o && 'value' in o
}

export function isJolokiaResponseErrorType(o: unknown): o is JolokiaErrorResponse {
  return isObject(o) && 'error_type' in o && 'error' in o
}

export function isJolokiaVersionResponseType(o: unknown): o is JolokiaVersionResponseValue {
  return isObject(o) && 'protocol' in o && 'agent' in o && 'info' in o
}

export async function jolokiaResponseParse(
  response: Response,
): Promise<ParseResult<JolokiaSuccessResponse | JolokiaErrorResponse>> {
  try {
    const parsed = await response.json()

    if (isJolokiaResponseErrorType(parsed)) {
      const errorResponse: JolokiaErrorResponse = parsed as JolokiaErrorResponse
      return { error: errorResponse.error, hasError: true }
    } else if (isJolokiaResponseSuccessType(parsed)) {
      const parsedResponse: JolokiaSuccessResponse = parsed as JolokiaSuccessResponse
      return { parsed: parsedResponse, hasError: false }
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
