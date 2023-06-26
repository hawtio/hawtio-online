import * as helpers from './kubernetes-api-helpers'
import Logger from 'js-logger'

const mockTestLogger = Logger.get('test-logger')

jest.mock('@hawtio/react', () => ({
  Logger: () => mockTestLogger
}))

describe('arrays', () => {
  test('masterApiUrl', () => {
    const result = helpers.masterApiUrl()
    expect(result).toEqual("")
  })
})
