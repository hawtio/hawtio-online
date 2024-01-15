import { jwtDecode } from './jwt-decode'

describe('decode', () => {
  test('not JWT token', () => {
    // False-positive for coverity SAST scan
    // Ignored in .gitleaks.toml as this is just a unit-test
    const token = 'c3ViamVjdDpvYmplY3Q6dGVzdA=='
    expect(() => jwtDecode(token)).toThrowError()
  })

  test('JWT token', () => {
    const expected = { iat: 1516239022, name: 'John Doe', sub: '1234567890' }
    // False-positive for coverity SAST scan
    // Ignored in .gitleaks.toml as this is just a unit-test
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const decoded = jwtDecode(token)

    expect(decoded).not.toBeNull()
    expect(decoded.iat).toEqual(expected.iat)
    expect(decoded.name).toEqual(expected.name)
    expect(decoded.sub).toEqual(expected.sub)
  })
})
