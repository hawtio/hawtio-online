import { preferencesService } from '@hawtio/react'
import { decrypt, encrypt, generateKey, toBase64, toByteArray } from './crypto'

export const SESSION_KEY_SALT = 'online.oauth.salt'

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
  preferencesService.setProtectedItem(SESSION_KEY_SALT, toBase64(salt))

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
  preferencesService.setProtectedItem(storageKey, encrypted)
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
  // Re-hydrate the protected preferences registry.
  //
  // Because the JavaScript heap is destroyed on every browser refresh
  // (F5) or during the OAuth extraction redirect loop, the preferencesService
  // singleton loses its in-memory list of protected localStorage keys on
  // every boot.
  //
  // The OAuth salt and credentials must immediately be re-registered upon
  // initialization so they survive any subsequent user-initiated reset.
  //
  // Note: setProtectedItem() is used here to trigger the protection
  // side-effect. This intentionally performs a redundant overwrite of the
  // existing localStorage values with themselves to satisfy the @hawtio/react
  // API contract.
  // This "redundant" write should not be removed.
  //
  preferencesService.setProtectedItem(SESSION_KEY_SALT, saltItem as string)
  preferencesService.setProtectedItem(storageKey, encrypted)

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
