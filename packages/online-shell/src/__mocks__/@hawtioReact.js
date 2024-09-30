class Logger {
  #name

  static get(name) {
    return new Logger(name)
  }

  constructor(name) {
    this.#name = name
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  debug(_text) {
    /* no-op */
  }
}

module.exports = { Logger }
