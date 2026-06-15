import { proxyMasterGuard } from './master-guard'
import { logger } from '../logger'

describe('proxyMasterGuard', () => {
  beforeEach(() => {
    // Intercept the error log so it does nothing, preventing the stream write
    jest.spyOn(logger, 'error').mockReturnValue(undefined)
  })

  afterEach(() => {
    // Clean up the mock after the test so it doesn't leak
    jest.restoreAllMocks()
  })

  it('deny unapproved endpoints', async () => {
    const path = '/master/api/v1/namespaces/hawtio-dev/secrets'

    const result = proxyMasterGuard(path)
    expect(result.status).toBe(false)
    const msg = `Error (proxyMasterGuard): Access to ${path} is not permitted.`
    expect(result.errorMsg).toBe(msg)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('is not permitted'))
  })

  const endpointPaths = [
    { path: '/master/.well-known/oauth-authorization-server' },
    { path: '/master/apis/apps.openshift.io/v1' },
    { path: '/master/apis/user.openshift.io/v1/users/~' },
    { path: '/master/apis/project.openshift.io/v1/projects/hawtio-dev' },
    { path: '/master/api' },
    { path: '/master/api/v1/namespaces/hawtio-dev' },
    { path: '/master/api/v1/namespaces/hawtio-dev/pods?watch' },
    { path: '/master/api/v1/namespaces/openshift-config-managed/configmaps/console-public' },
  ]

  it.each(endpointPaths)('redirect to test master: $path', async ({ path }) => {
    const result = proxyMasterGuard(path)
    expect(result.status).toBe(true)
  })
})
