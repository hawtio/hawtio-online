import request from 'supertest'
import express from 'express'
import { proxyMasterGuard } from './master-guard'

const app = express()

app.get('/master/*', (req, res) => {
  const host = `http://${req.header('host')}` || ''

  /*
   * Provide this test server as the redirect target
   * representing the cluster api server
   */
  const gatewayOptions = {
    websvr: host
  }

  proxyMasterGuard(req, res, gatewayOptions)
})

function testApp(uri: string) {
  return request(app)
    .get(uri)
    .set('location-rule', 'MANAGEMENT')
    .set('X-Frame-Options', 'SAMEORIGIN')
    .set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    .set('Content-Security-Policy', "default-src 'self'; frame-ancestors 'self'; form-action 'self'; ")
}

describe('proxyMasterGuard', () => {
  it('deny unapproved endpoints', async () => {
    const path = '/master/api/v1/namespaces/hawtio-dev/secrets'
    return testApp(path)
      .expect(502)
      .then(res => {
        const msg = `Error (proxyMasterGuard): Access to ${path} is not permitted.`

        const json = JSON.parse(res.text)
        expect(json.message).toBe(msg)
      })
  })

  const endpointPaths = [
    '/master/.well-known/oauth-authorization-server',
    '/master/apis/apps.openshift.io/v1',
    '/master/apis/user.openshift.io/v1/users/~',
    '/master/apis/project.openshift.io/v1/projects/hawtio-dev',
    '/master/api',
    '/master/api/v1/namespaces/hawtio-dev',
    '/master/api/v1/namespaces/hawtio-dev/pods?watch',
    '/master/api/v1/namespaces/openshift-config-managed/configmaps/console-public'
  ]

  it.each(endpointPaths)('redirect to test master: $path', async (path: string) => {
    const redirectPath = path.replace('master', 'masterinternal')

    return testApp(path)
      .expect(302)
      .then(res => {
        const host = `http://${res.request.req.getHeader('host')}`
        expect(res.get('location')).toBe(`${host}${redirectPath}`)
        expect(res.text).toBe(`Found. Redirecting to ${host}${redirectPath}`)
      })
  })
})
