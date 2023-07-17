import * as initFn from './init'
import path from 'path'
import fs from 'fs'
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

const configFilePath = path.resolve(__dirname, 'testdata', 'osconsole', 'config.json')
const configJson = fs.readFileSync(configFilePath, { encoding: 'utf8', flag: 'r' })
let expConfig = JSON.parse(configJson)

describe('init-functions', () => {

  beforeEach(() => {
    expConfig = JSON.parse(configJson)
    fetchMock.resetMocks()
    defaultMockFetch()
  })

  afterAll(() => {
    // Ensure the mocks are reset correctly to setupTests
    fetchMock.resetMocks()
    defaultMockFetch()
  })

  test('process-config', async () => {
    expect(expConfig).toBeDefined()
    expect(expConfig.openshift).toBeDefined()

    const response = {
      authorization_endpoint: 'http://localhost/auth',
      issuer: 'test'
    }

    /*
     * Override the mockResponse so return the correct response
     * for the oauth_metadata_uri
     */
    fetchMock.mockResponse(req => {
      if (req.url === 'osconsole/config.json') {
        return Promise.resolve(JSON.stringify(expConfig))
      }
      else if (req.url === expConfig.openshift.oauth_metadata_uri) {
        return Promise.resolve(JSON.stringify(response))
      }

      return Promise.resolve({})
    })

    const result = await initFn.fetchConfig()
    expect(result).toBeTruthy()

    const kubeConfig = kubernetesAPI.getKubeConfig()
    expect(kubeConfig).toBeDefined()

    const oSOAuthConfig = kubernetesAPI.getOSOAuthConfig()
    expect(oSOAuthConfig).toBeDefined()

    expect(oSOAuthConfig?.oauth_authorize_uri).toEqual(response.authorization_endpoint)
    expect(oSOAuthConfig?.issuer).toEqual(response.issuer)
  })

  test('extract-master', () => {
    expect(expConfig).toBeDefined()
    expect(expConfig.openshift).toBeDefined()

    hawtio.setBasePath('http://localhost:3000')

    expConfig.openshift.oauth_client_id = 'gjdjf'
    expConfig.openshift.oauth_authorize_uri = 'http://localhost/auth'
    expConfig.openshift.issuer = 'test'

    kubernetesAPI.setKubeConfig(expConfig)
    expect(kubernetesAPI.getOSOAuthConfig()?.issuer).toBeDefined()

    initFn.extractMaster()
    expect(kubernetesAPI.getMasterUrl()).toEqual('http://localhost/master')
  })
})
