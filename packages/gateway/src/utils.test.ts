import { IP_ADDRESS_MASK, maskIPAddresses } from './utils'

describe('utils', () => {
  const ip1 = '192.168.126.11'
  const ip2 = '10.217.0.126'
  const input = {
    status: {
      containerStatuses: {
        image: 'image-registry.openshift-image-registry.svc:5000/hawtio-dev/camel-sb-4@sha256:19049',
      },
      name: 'spring-boot',
      ready: true,
      hostIP: ip1,
      hostIPs: [{ ip: ip1 }],
      phase: 'Running',
      podIP: ip2,
      podIPs: [{ ip: ip2 }],
    },
  }

  beforeEach(() => {
    jest.resetModules() // Most important - it clears the cache
  })

  it('maskIPAddresses', () => {
    const response = maskIPAddresses(input)
    expect(response).not.toContain(ip1)
    expect(response).not.toContain(ip2)
    expect(response).toContain(IP_ADDRESS_MASK)
  })
})
