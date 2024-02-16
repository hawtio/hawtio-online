import { decrypt, encrypt, generateKey, toBase64, toByteArray } from './crypto'

const SESSION_KEY_SALT = 'online.encrypt.salt'

export async function secureStore(storageKey: string, storageValue: string) {
  //
  // Generate the salt value ready for encryption
  //
  const salt = window.crypto.getRandomValues(new Uint8Array(16))

  //
  // Retain the salt value in storage for use with decryption
  //
  // Note: this is NOT a vulnerability since knowing the salt value does
  // not in any way compromise the encryption process or divulge the key
  //
  localStorage.setItem(SESSION_KEY_SALT, toBase64(salt))

  //
  // Generate the key for encryption of the credentials
  //
  const encKey = await generateKey(salt)

  //
  // Encrypt the token and metadata using the stored salt value
  //
  const encrypted = await encrypt(encKey, storageValue)

  //
  // Store the encryption string in local storage
  //
  localStorage.setItem(storageKey, encrypted)
}

export async function secureRetrieve(storageKey: string): Promise<string | null> {
  //
  // Recover the salt value ready for decryption
  //
  const saltItem = localStorage.getItem(SESSION_KEY_SALT)
  const salt = saltItem ? toByteArray(saltItem) : null
  const encrypted = localStorage.getItem(storageKey)
  if (!encrypted || !salt) {
    return null
  }

  //
  // Generate the key for decryption of the credentials
  //
  const key = await generateKey(salt)

  //
  // Decrypt the locally stored token and metadata using the stored salt value
  //
  return await decrypt(key, encrypted)
}

export function secureDispose(storageKey: string) {
  localStorage.removeItem(storageKey)
  localStorage.removeItem(SESSION_KEY_SALT)
}
