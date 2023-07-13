// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/extend-expect'
import fetchMock from 'jest-fetch-mock'
import $ from 'jquery'

fetchMock.enableMocks()

// Default mock response for every usage of fetch
fetchMock.mockResponse(req => {
  console.log('Mock fetch:', req.url)
  let res = '{}'
  switch (req.url) {
    case 'user':
      res = '"public"'
      break
    default:
  }
  return Promise.resolve(res)
})

// To fix "jQuery is not defined" error
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const global: any
global.$ = global.jQuery = $
