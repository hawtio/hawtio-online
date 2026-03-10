import { preferencesService } from '@hawtio/react'
import * as cryptoModule from './crypto'
import { secureStore, secureRetrieve, SESSION_KEY_SALT } from './secure-storage'

jest.mock('@thumbmarkjs/thumbmarkjs', () => ({
  getFingerprint: jest.fn(() => '123abc'),
}))

const SECURE_TEST_KEY = 'secure.test.key'

describe('secure-storage', () => {
  afterEach(() => {
    // Clean up all mocks after each test to prevent test bleed
    jest.restoreAllMocks()
  })

  test('secureStore', async () => {
    const text = 'test to be securely stored'

    await secureStore(SECURE_TEST_KEY, text)

    // Verify the salt was attempted to be protected
    expect(preferencesService.setProtectedItem).toHaveBeenCalledWith(SESSION_KEY_SALT, expect.any(String))

    // Verify the test key was attempted to be protected
    expect(preferencesService.setProtectedItem).toHaveBeenCalledWith(SECURE_TEST_KEY, expect.any(String))
  })

  test('secureRetrieve', async () => {
    // Setup mock data
    const mockSalt = 'bW9jay1zYWx0'
    const text = 'mock-string'

    // Mock localStorage.getItem to return our specific test data
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(key => {
      if (key === SESSION_KEY_SALT) return mockSalt
      if (key === SECURE_TEST_KEY) return text
      return null
    })

    const mockCryptoKey = {
      type: 'secret',
      extractable: true,
      algorithm: { name: 'AES-GCM' },
      usages: ['encrypt', 'decrypt'],
    } as CryptoKey

    jest.spyOn(cryptoModule, 'generateKey').mockResolvedValue(mockCryptoKey)
    jest.spyOn(cryptoModule, 'decrypt').mockResolvedValue(text)

    const retrieved = await secureRetrieve(SECURE_TEST_KEY)

    // Verify local storage was checked
    expect(getItemSpy).toHaveBeenCalledWith(SESSION_KEY_SALT)
    expect(getItemSpy).toHaveBeenCalledWith(SECURE_TEST_KEY)

    // Verify the salt was attempted to be protected
    expect(preferencesService.setProtectedItem).toHaveBeenCalledWith(SESSION_KEY_SALT, expect.any(String))

    // Verify the test key was attempted to be protected
    expect(preferencesService.setProtectedItem).toHaveBeenCalledWith(SECURE_TEST_KEY, expect.any(String))

    expect(retrieved).toEqual(text)
  })
})
