import { log } from '../globals'

export type SimpleResponse = {
  status: number
  statusText: string
}

export type FetchPathCallback<T> = {
  success: (data: string) => T
  error: (err: Error, response?: SimpleResponse) => T
}

export async function fetchPath<T>(path: string, callback: FetchPathCallback<T>, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(path, options)
    if (!res.ok) {
      const msg = `Failed to fetch ${path} : ${res.status}, ${res.statusText}`
      log.error(msg)
      return callback.error(new Error(msg), { status: res.status, statusText: res.statusText })
    }

    const data = await res.text()
    return callback.success(data)
  } catch (err) {
    log.error('Failed to fetch', path, ':', err)
    return callback.error(
      err instanceof Error ? err : new Error('Fetch failed due to unknown error. See log for details'),
    )
  }
}
