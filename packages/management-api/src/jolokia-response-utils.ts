import { JolokiaErrorResponse, JolokiaSuccessResponse } from 'jolokia.js'
import Jolokia from '@jolokia.js/simple'

export type ParseResult<T> = { hasError: false; parsed: T } | { hasError: true; error: string }

export async function jolokiaResponseParse(
  response: Response,
): Promise<ParseResult<JolokiaSuccessResponse | JolokiaErrorResponse>> {
  try {
    const parsed = await response.json()

    if (Jolokia.isResponseError(parsed)) {
      const errorResponse: JolokiaErrorResponse = parsed as JolokiaErrorResponse
      return { error: errorResponse.error, hasError: true }
    } else if (Jolokia.isResponseSuccess(parsed)) {
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
