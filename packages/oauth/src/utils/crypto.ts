import { getFingerprint } from '@thumbmarkjs/thumbmarkjs'

export async function generateKey(salt: ArrayBufferView): Promise<CryptoKey> {
  const fingerprint = await getFingerprint()
  const data = new TextEncoder().encode(fingerprint as string)
  const key = await window.crypto.subtle.importKey('raw', data, { name: 'PBKDF2' }, false, ['deriveKey'])
  const algorithm = {
    name: 'PBKDF2',
    salt,
    iterations: 100000,
    hash: 'SHA-256',
  }
  const keyType = {
    name: 'AES-GCM',
    length: 256,
  }
  return window.crypto.subtle.deriveKey(algorithm, key, keyType, true, ['encrypt', 'decrypt'])
}

export function toBase64(data: Uint8Array): string {
  return window.btoa(String.fromCharCode(...Array.from(data)))
}

export function toByteArray(data: string): Uint8Array {
  return new Uint8Array(Array.from(window.atob(data)).map(c => c.charCodeAt(0)))
}

export async function encrypt(key: CryptoKey, data: string): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encodedData = new TextEncoder().encode(data)
  const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encodedData)
  return toBase64(iv) + '.' + toBase64(new Uint8Array(encrypted))
}

export async function decrypt(key: CryptoKey, data: string): Promise<string> {
  const iv = toByteArray(data.split('.')[0] ?? '')
  const encrypted = toByteArray(data.split('.')[1] ?? '')
  const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)
  return new TextDecoder('utf-8').decode(new Uint8Array(decrypted))
}
