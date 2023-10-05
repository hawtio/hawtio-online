import { log } from '../globals'

export type FetchPathCallback<T> = {
  success: (data: string) => T
  error: (err: Error) => T
}

export type FetchOptions = {
  headers: Record<string, string>
}

export async function fetchPath<T>(path: string, callback: FetchPathCallback<T>, options?: FetchOptions): Promise<T> {
  try {
    const init: RequestInit = {}
    if (options)
      init.headers = options.headers

    const res = await fetch(path, init)
    if (!res.ok) {
      const msg = `Failed to fetch ${path} : ${res.status}, ${res.statusText}`
      log.error(msg)
      return callback.error(new Error(msg))
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
