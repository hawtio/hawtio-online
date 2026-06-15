import { IP_ADDRESS_MASK, maskIPAddresses } from './utils'

describe('utils', () => {
  const OLD_ENV = process.env
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
    process.env = { ...OLD_ENV } // Make a copy
  })

  afterAll(() => {
    process.env = OLD_ENV // Restore old environment
  })

  it('maskIPAddresses-true', () => {
    process.env.HAWTIO_ONLINE_MASK_IP_ADDRESSES = 'true'
    const response = maskIPAddresses(input)
    expect(response).not.toContain(ip1)
    expect(response).not.toContain(ip2)
    expect(response).toContain(IP_ADDRESS_MASK)
  })

  it('maskIPAddresses-false', () => {
    process.env.HAWTIO_ONLINE_MASK_IP_ADDRESSES = 'false'
    const response = maskIPAddresses(input)
    expect(response).toContain(ip1)
    expect(response).toContain(ip2)
  })
})
