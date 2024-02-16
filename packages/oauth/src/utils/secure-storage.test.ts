import { secureStore, secureRetrieve } from './secure-storage'

jest.mock('@thumbmarkjs/thumbmarkjs', () => ({
  getFingerprint: jest.fn(() => '123abc'),
}))

const SECURE_TEST_KEY = 'secure.test.key'

describe('secure-storage', () => {
  test('secureStore, secureRetrieve', async () => {
    const text = 'test to be securely stored'

    await secureStore(SECURE_TEST_KEY, text)
    expect(localStorage.getItem(SECURE_TEST_KEY)).not.toBeNull()

    const retrieved = await secureRetrieve(SECURE_TEST_KEY)
    expect(retrieved).toEqual(text)
  })
})
