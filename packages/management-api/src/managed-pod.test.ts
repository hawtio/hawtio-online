import { KubePod, k8Api } from '@hawtio/online-kubernetes-api'
import { ManagedPod } from './managed-pod'
import { isMgmtApiRegistered } from '.'

describe('ManagedPod', () => {
  beforeAll(async () => {
    // Intercept initialize and return a successfully resolved Promise
    jest.spyOn(k8Api, 'initialize').mockResolvedValue(true)
    jest.spyOn(k8Api, 'initialized', 'get').mockReturnValue(true)
    const mockProfile = {
      hasError: jest.fn().mockReturnValue(false),
      getError: jest.fn(),
      getMasterUri: jest.fn().mockReturnValue(''),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiInternal = k8Api as any
    apiInternal._oAuthProfile = mockProfile
    apiInternal._error = null

    await isMgmtApiRegistered()
  })

  describe('jolokiaPort extraction', () => {
    it('should extract the specific jolokia container port when present', () => {
      const mockPod: KubePod = {
        spec: {
          containers: [
            {
              name: 'testPod',
              ports: [
                { name: 'http', containerPort: 8080 },
                { name: 'jolokia', containerPort: 9999 },
              ],
            },
          ],
        },
      }

      const pod = new ManagedPod(mockPod)
      expect(pod.jolokiaPort).toBe(9999)
    })

    it('should fall back to default port when containers have no ports defined', () => {
      const mockPod: KubePod = {
        spec: {
          containers: [{ name: 'my-app' }],
        },
      }

      const pod = new ManagedPod(mockPod)
      expect(pod.jolokiaPort).toBe(ManagedPod.DEFAULT_JOLOKIA_PORT)
    })

    it('should fall back to default port when ports exist but none are named jolokia', () => {
      const mockPod: KubePod = {
        spec: {
          containers: [
            {
              name: 'testPod',
              ports: [
                { name: 'http', containerPort: 8080 },
                { name: 'metrics', containerPort: 9090 },
              ],
            },
          ],
        },
      }

      const pod = new ManagedPod(mockPod)
      expect(pod.jolokiaPort).toBe(ManagedPod.DEFAULT_JOLOKIA_PORT)
    })

    it('should fall back to default port when jolokia port is found but lacks a containerPort value', () => {
      const mockPod = {
        spec: {
          containers: [
            {
              name: 'testPod',
              ports: [{ name: 'jolokia' }],
            },
          ],
        },
      } as KubePod

      const pod = new ManagedPod(mockPod)
      expect(pod.jolokiaPort).toBe(ManagedPod.DEFAULT_JOLOKIA_PORT)
    })
  })
})
