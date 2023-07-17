import * as helpers from './helpers'
import { WatchTypes } from './model'
import { OS_PREFIX, OS_API_VERSION, K8S_PREFIX, K8S_API_VERSION, K8S_EXT_PREFIX, K8S_EXT_VERSION } from './globals'
import fs from 'fs'
import path from 'path'
import { isObject } from './utils/objects'

describe('arrays', () => {
  test('masterApiUrl', () => {
    const result = helpers.masterApiUrl()
    expect(result).toEqual("")
  })

  test('namespaced', () => {
    expect(helpers.namespaced(WatchTypes.LIST)).toBeTruthy()
    expect(helpers.namespaced(WatchTypes.ENDPOINTS)).toBeTruthy()
    expect(helpers.namespaced(WatchTypes.EVENTS)).toBeTruthy()

    expect(helpers.namespaced(WatchTypes.POLICIES)).toBeFalsy()
    expect(helpers.namespaced(WatchTypes.OAUTH_CLIENTS)).toBeFalsy()
    expect(helpers.namespaced(WatchTypes.NAMESPACES)).toBeFalsy()
    expect(helpers.namespaced(WatchTypes.NODES)).toBeFalsy()
    expect(helpers.namespaced(WatchTypes.PERSISTENT_VOLUMES)).toBeFalsy()
    expect(helpers.namespaced(WatchTypes.PROJECTS)).toBeFalsy()
  })

  test('prefixes', () => {
    expect(helpers.kubernetesApiPrefix()).toBe(K8S_PREFIX + '/' + K8S_API_VERSION)
    expect(helpers.kubernetesApiExtensionPrefix()).toBe('apis/extensions/v1beta1')

    expect(helpers.openshiftApiPrefix('')).toBe(OS_PREFIX + '/' + OS_API_VERSION)
    expect(helpers.openshiftApiPrefix(WatchTypes.NODES)).toBe(OS_PREFIX + '/' + OS_API_VERSION)
    expect(helpers.openshiftApiPrefix(WatchTypes.BUILD_CONFIGS)).toBe(OS_PREFIX + '/build.openshift.io/' + OS_API_VERSION)

    expect(helpers.prefixForKind('')).toBeNull()
    expect(helpers.prefixForKind(WatchTypes.NAMESPACES)).toBe(K8S_PREFIX + '/' + K8S_API_VERSION)
    expect(helpers.prefixForKind(WatchTypes.DEPLOYMENTS)).toBe(K8S_EXT_PREFIX + '/' + K8S_EXT_VERSION)
    expect(helpers.prefixForKind(WatchTypes.CONFIG_MAPS)).toBe(K8S_PREFIX + '/' + K8S_API_VERSION)
    expect(helpers.prefixForKind(WatchTypes.IMAGE_STREAMS)).toBe(OS_PREFIX + '/' + OS_API_VERSION)
  })

  test('wsscheme', () => {
    expect(helpers.wsScheme('http://192.168.58.2:8443/apis/apps/v1/deployments')).toBe('ws')
    expect(helpers.wsScheme('https://192.168.58.2:8443/apis/apps/v1/deployments')).toBe('wss')
  })

  test('createShallowObject', () => {
    const expected = {
      apiVersion: "v1",
      kind: 'deployment',
      metadata: {
        name: 'test',
        namespace: 'scratch'
      },
    }

    expect(helpers.createShallowObject('test', 'deployment', 'scratch')).toEqual(expected)
  })

  test('pathGet', () => {
    const routeResourceJsonPath = path.resolve(__dirname, 'testdata', 'route-example.json')
    const routeResourceJson = fs.readFileSync(routeResourceJsonPath, { encoding: 'utf8', flag: 'r' })
    const routeResource = JSON.parse(routeResourceJson)
    expect(isObject(routeResource)).toBeTruthy()

    expect(helpers.getKind(routeResource)).toEqual('Route')
    const labels = '{"app":"hawtio"}'
    expect(JSON.stringify(helpers.getLabels(routeResource))).toEqual(labels)
  })
})
