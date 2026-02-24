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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error(_text) {
    /* no-op */
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  info(_text) {
    /* no-op */
  }
}

const TaskState = {
  started: 0,
  skipped: 1,
  finished: 2,
  error: 3,
  0: 'started',
  1: 'skipped',
  2: 'finished',
  3: 'error',
}

const configManager = {
  initItem: jest.fn(),
  configureAuthenticationMethod: jest.fn().mockResolvedValue(undefined),
}

module.exports = { Logger, configManager, TaskState, Logger }
