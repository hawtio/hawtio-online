import { log } from '../globals'

export type SimpleResponse = {
  status: number
  statusText: string
  data?: string
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
      log.error(res)

      const errorDetails: SimpleResponse = { status: res.status, statusText: res.statusText }
      if (res.body != null) {
        const data = await res.text()
        errorDetails.data = data
      }

      return callback.error(new Error(msg), errorDetails)
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
