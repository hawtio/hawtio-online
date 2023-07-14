import * as initFn from './init'
import path from 'path'
import { pathGet } from './utils/objects'
import { KubernetesConfig, OpenShiftOAuthConfig } from './model'
import { kubernetesAPI } from './globals'
import { hawtio } from '@hawtio/react'

function defaultMockFetch() {
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
}


describe('init-functions', () => {

  beforeAll(async () => {
    const configFile = path.resolve(__dirname, 'testdata', 'osconsole', 'config.js')
    await import(configFile)
  })

  beforeEach(() => {
    fetchMock.resetMocks()
    defaultMockFetch()
  })

  afterAll(() => {
    // Ensure the mocks are reset correctly to setupTests
    fetchMock.resetMocks()
    defaultMockFetch()
  })

  test('process-config', (done) => {
    const oSOAuthConfig = pathGet(window, ['window', 'OPENSHIFT_CONFIG', 'openshift']) as OpenShiftOAuthConfig
    expect(oSOAuthConfig).not.toBeNull()

    const response = {
      authorization_endpoint: 'http://localhost/auth',
      issuer: 'test'
    }

    /*
     * Override the mockResponse so return the correct response
     * for the oauth_metadata_uri
     */
    fetchMock.mockResponse(req => {
      if (req.url === oSOAuthConfig.oauth_metadata_uri) {

        return Promise.resolve(JSON.stringify(response))
      }

      return Promise.resolve({})
    })

    // Ensure that done() is called to complete the test
    const doneCb = (success: boolean) => {
      expect(success).toBeTruthy()

      const kubeConfig = kubernetesAPI.getKubeConfig()
      expect(kubeConfig).toBeDefined()

      const oSOAuthConfig = kubernetesAPI.getOSOAuthConfig()
      expect(oSOAuthConfig).toBeDefined()

      expect(oSOAuthConfig?.oauth_authorize_uri).toEqual(response.authorization_endpoint)
      expect(oSOAuthConfig?.issuer).toEqual(response.issuer)
      done()
    }

    initFn.processConfig(doneCb)
  })

  test('extract-master', () => {
    hawtio.setBasePath('http://localhost:3000')

    const kubeConfig: KubernetesConfig = window['OPENSHIFT_CONFIG']
    expect(kubernetesAPI.getKubeConfig()).toBeDefined()

    const oSOAuthConfig = kubernetesAPI.getKubeConfig().openshift as OpenShiftOAuthConfig
    expect(oSOAuthConfig).toBeDefined()
    oSOAuthConfig.oauth_client_id = 'gjdjf'
    oSOAuthConfig.oauth_authorize_uri = 'http://localhost/auth'
    oSOAuthConfig.issuer = 'test'
    kubernetesAPI.setKubeConfig(kubeConfig)
    expect(kubernetesAPI.getOSOAuthConfig()?.issuer).toBeDefined()

    initFn.extractMaster()
    expect(kubernetesAPI.getMasterUrl()).toEqual('http://localhost/master')
  })
})
