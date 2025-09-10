/* eslint-disable no-console */
// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import fetchMock from 'jest-fetch-mock'

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
