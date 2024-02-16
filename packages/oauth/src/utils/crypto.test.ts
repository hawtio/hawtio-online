import { decrypt, encrypt, generateKey } from './crypto'

jest.mock('@thumbmarkjs/thumbmarkjs', () => ({
  getFingerprint: jest.fn(() => '123abc'),
}))

describe('crypto', () => {
  test('generateKey, encrypt, and decrypt', async () => {
    const salt = window.crypto.getRandomValues(new Uint8Array(16))
    const key = await generateKey(salt)
    expect(key).not.toBeNull()
    expect(key.algorithm).toEqual({ name: 'AES-GCM', length: 256 })
    const text = 'test'
    const encrypted = await encrypt(key, text)
    expect(encrypted).not.toEqual(text)
    const decrypted = await decrypt(key, encrypted)
    expect(decrypted).toEqual(text)
  })
})
