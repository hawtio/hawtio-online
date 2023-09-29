type Timer = ReturnType<typeof setTimeout>

export function debounce(delegate: () => void, timeout = 300) {
  let timer: Timer

  return () => {
    clearTimeout(timer)

    timer = setTimeout(() => {
      delegate()
    }, timeout)
  }
}
