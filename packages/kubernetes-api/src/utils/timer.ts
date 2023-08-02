export function debounce(delegate: () => void, timeout = 300) {
  let timer: NodeJS.Timer

  return () => {
    clearTimeout(timer)

    timer = setTimeout(() => {
      delegate()
    }, timeout)
  }
}
