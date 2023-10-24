// Copied from:
// https://github.com/auth0/jwt-decode/blob/v3.1.2/build/jwt-decode.js

/**
 * The code was extracted from:
 * https://github.com/davidchambers/Base64.js
 */

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

class InvalidCharacterError extends Error {
  constructor(public message: string) {
    super(message)
  }

  name = 'InvalidCharacterError'
}

function polyfill(input: string) {
  const str = String(input).replace(/=+$/, '')
  if (str.length % 4 === 1) {
    throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.")
  }
  let output = ''
  for (
    // initialize result and counters
    let bc = 0, bs = 0, buffer, idx = 0;
    // get next character
    (buffer = str.charAt(idx++));
    // character found in table? initialize bit storage and add its ascii value
    ~buffer &&
    ((bs = bc % 4 ? bs * 64 + buffer : buffer),
    // and if not first of each 4 characters,
    // convert the first 8 bits to one ascii character
    bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    // try to find character in table (0-63, not found => -1)
    buffer = chars.indexOf(buffer)
  }
  return output
}

const atob = (typeof window !== 'undefined' && window.atob && window.atob.bind(window)) || polyfill

function b64DecodeUnicode(str: string) {
  return decodeURIComponent(
    atob(str).replace(/(.)/g, function (m, p) {
      let code = p.charCodeAt(0).toString(16).toUpperCase()
      if (code.length < 2) {
        code = '0' + code
      }
      return '%' + code
    }),
  )
}

function base64_url_decode(str: string): string | undefined {
  if (!str || str.length === 0) return undefined

  let output = str.replace(/-/g, '+').replace(/_/g, '/')

  switch (output.length % 4) {
    case 0:
      break
    case 2:
      output += '=='
      break
    case 3:
      output += '='
      break
    default:
      throw new Error('Illegal base64url string!')
  }

  try {
    return b64DecodeUnicode(output)
  } catch (err) {
    return atob(output)
  }
}

class TokenError extends Error {
  constructor(public message: string) {
    super(message)
    this.message = message
  }

  name = 'TokenError'
}

export interface DecodeOptions {
  header?: boolean
}

export function jwtDecode(token: string, options: DecodeOptions = {}): Record<string, string> {
  if (typeof token !== 'string') {
    throw new TokenError('Invalid token specified')
  }

  options = options || {}
  const pos = options.header === true ? 0 : 1
  try {
    if (!token.includes('.')) throw new Error('Token is not JWT')

    const base64 = base64_url_decode(token.split('.')[pos])
    if (!base64) throw new Error('Token cannot be decoded')
    return JSON.parse(base64)
  } catch (e) {
    if (e instanceof Error) throw new TokenError('JWT token decoding: ' + e.message)
    else throw new TokenError('JWT token decoding. Cannot be decoded')
  }
}
