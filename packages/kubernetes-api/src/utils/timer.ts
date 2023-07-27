
export function debounce(delegate: (() => void), timeout = 300) {
  let timer: NodeJS.Timer

  return (...args: any[]) => {
    clearTimeout(timer)

    timer = setTimeout(() => { delegate.apply(args) }, timeout)
  }
}
