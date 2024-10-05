import * as yaml from 'yaml'
import * as fs from 'fs'
import * as rbac from './rbac'
import {
  MBeanInfoCache,
  OptimisedJmxDomains,
  OptimisedMBeanOperations,
  hasMBeanOperation,
  isOptimisedCachedDomains,
} from './globals'

const aclFile = fs.readFileSync(process.env['HAWTIO_ONLINE_RBAC_ACL'] || `${__dirname}/ACL.yaml`, 'utf8')
const aclYaml = yaml.parse(aclFile)
rbac.initACL(aclYaml)

const listMBeans = JSON.parse(fs.readFileSync(`${__dirname}/test.listMBeans.json`, 'utf8')).value

interface ArtemisOrder {
  broker: 1
  component: 2
  name: 3
  address: 3
  subcomponent: 4
  'routing-type': 5
  queue: 6
  [key: string]: number
}

// Roles
const admin = 'admin'
const viewer = 'viewer'

describe('check', () => {
  it('should handle a request with viewer role', () => {
    const result = rbac.check(
      {
        type: 'exec',
        mbean: 'org.apache.camel:type=context',
        operation: 'dumpRoutesAsXml()',
      },
      viewer,
    )
    expect(result.allowed).toBe(true)
  })

  it('should handle a request with arguments and no roles allowed', function () {
    const result1 = rbac.check(
      {
        type: 'exec',
        mbean: 'org.apache.karaf:type=bundle',
        operation: 'uninstall(java.lang.String)',
        arguments: ['0'],
      },
      admin,
    )
    expect(result1.allowed).toBe(false)
    const result2 = rbac.check(
      {
        type: 'exec',
        mbean: 'org.apache.karaf:type=bundle',
        operation: 'uninstall(java.lang.String)',
        arguments: ['0'],
      },
      viewer,
    )
    expect(result2.allowed).toBe(false)
  })

  it('should handle a request with arguments and only admin allowed', function () {
    const result1 = rbac.check(
      {
        type: 'exec',
        mbean: 'org.apache.karaf:type=bundle',
        operation: 'update(java.lang.String,java.lang.String)',
        arguments: ['50', 'value'],
      },
      admin,
    )
    expect(result1.allowed).toBe(true)
    const result2 = rbac.check(
      {
        type: 'exec',
        mbean: 'org.apache.karaf:type=bundle',
        operation: 'update(java.lang.String,java.lang.String)',
        arguments: ['50', 'value'],
      },
      viewer,
    )
    expect(result2.allowed).toBe(false)
  })
})

describe('intercept', function () {
  it('should intercept RBAC MBean search requests', function () {
    const result = rbac.intercept(
      {
        type: 'search',
        mbean: '*:type=security,area=jmx,*',
      },
      admin,
      listMBeans,
    )
    expect(result.intercepted).toBe(true)
    expect(result.response?.value).toEqual(['hawtio:type=security,area=jmx,name=HawtioOnlineRBAC'])
  })

  it('should intercept single canInvoke requests on RBAC MBean XXX', function () {
    const result = rbac.intercept(
      {
        type: 'exec',
        mbean: 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
        operation: 'canInvoke(java.lang.String)',
        arguments: ['java.lang:type=Memory'],
      },
      admin,
      listMBeans,
    )
    expect(result.intercepted).toBe(true)

    // canInvoke should be true
    expect(result.response?.value).toBe(true)
  })

  it('should intercept bulk canInvoke requests on RBAC MBean', function () {
    const result = rbac.intercept(
      {
        type: 'exec',
        mbean: 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
        operation: 'canInvoke(java.util.Map)',
        arguments: [
          {
            'java.lang:type=Memory': ['gc()'],
            'org.apache.camel:context=io.fabric8.quickstarts.karaf-camel-log-log-example-context,name="log-example-context",type=context':
              [
                'addOrUpdateRoutesFromXml(java.lang.String)',
                'addOrUpdateRoutesFromXml(java.lang.String,boolean)',
                'dumpStatsAsXml(boolean)',
                'getCamelId()',
                'getRedeliveries()',
                'sendStringBody(java.lang.String,java.lang.String)',
              ],
          },
        ],
      },
      admin,
      listMBeans,
    )
    expect(result.intercepted).toBe(true)
    expect(result.response?.value).toBeDefined()
  })

  it('should intercept RBACRegistry list requests', function () {
    const result = rbac.intercept(
      {
        type: 'list',
        path: 'hawtio/type=security,name=RBACRegistry',
      },
      admin,
      listMBeans,
    )
    expect(result.intercepted).toBe(true)
    expect(hasMBeanOperation(result.response?.value)).toBe(false)
  })

  it('should intercept optimised list MBeans requests', function () {
    const result = rbac.intercept(
      {
        type: 'exec',
        mbean: 'hawtio:type=security,name=RBACRegistry',
        operation: 'list()',
      },
      admin,
      listMBeans,
    )
    expect(result.intercepted).toBe(true)
    expect(isOptimisedCachedDomains(result.response?.value)).toBe(true)
    if (isOptimisedCachedDomains(result.response?.value)) {
      const cache: MBeanInfoCache = result.response?.value.cache
      expect(Object.getOwnPropertyNames(cache).length > 0).toBe(true)

      const domains: OptimisedJmxDomains = result.response?.value.domains
      expect(Object.getOwnPropertyNames(domains).length > 0).toBe(true)
    }
  })

  it('should not intercept other requests', function () {
    const result = rbac.intercept(
      {
        type: 'exec',
        mbean: 'java.lang.Memory',
        operation: 'gc()',
      },
      admin,
      listMBeans,
    )
    expect(result.intercepted).toBe(false)
    expect(result.response).toBeUndefined()
  })
})

describe('optimisedMBeans', function () {
  it('should optimise MBean list', function () {
    const result = rbac.testing.optimisedMBeans(listMBeans, admin)

    // cache
    expect(result.cache).toBeDefined()
    expect(result.cache).not.toEqual({})

    Object.entries(result.cache).forEach(info => {
      expect(info[1].canInvoke).toBe(true)
      expect(info[1].op).toBeDefined()

      const infoOp = info[1].op as OptimisedMBeanOperations
      Object.entries(infoOp).forEach(op => {
        const sigs = Array.isArray(op[1]) ? op[1] : [op[1]]
        sigs.forEach(sig => {
          expect(sig.canInvoke).toBe(true)
        })
      })
      expect(info[1].opByString).toBeDefined()
      expect(info[1].opByString).not.toEqual({})
    })
    expect(Object.keys(result.cache)).toContain('activemq.artemis:address')
    expect(Object.keys(result.cache)).toContain('activemq.artemis:queue')

    // domains
    expect(result.domains).toBeDefined()
    expect(result.domains).not.toEqual({})
    Object.entries(result.domains).forEach(domain => {
      Object.entries(domain[1]).forEach(info => {
        if (typeof info[1] === 'string') {
          expect(result.cache[info[1]]).toBeDefined()
        } else {
          expect(info[1].canInvoke).toBe(true)
        }

        if (info[1].op) {
          Object.entries(info[1].op).forEach(op => {
            const sigs = Array.isArray(op[1]) ? op[1] : [op[1]]
            sigs.forEach(sig => {
              expect(sig.canInvoke).toBe(true)
            })
          })
          expect(info[1].opByString).toBeDefined()
          expect(info[1].opByString).not.toEqual({})
        }

        // Artemis-specific checks
        if (domain[0] === 'org.apache.activemq.artemis') {
          // key order:
          //   broker > component > name | address > subcomponent > routing-type > queue
          const order: ArtemisOrder = {
            broker: 1,
            component: 2,
            name: 3,
            address: 3,
            subcomponent: 4,
            'routing-type': 5,
            queue: 6,
          }
          const regexp = /([^,]+)=([^,]+)+/g
          let match
          let previous = ''
          while ((match = regexp.exec(info[0])) !== null) {
            const current = match[1]
            expect(order[previous] || 0).toBeLessThanOrEqual(order[current])
            previous = current
          }
        }
      })
    })
  })
})

describe('parseProperties', function () {
  it('should parse properties as object', function () {
    expect(rbac.testing.parseProperties('context=MyCamel,name="simple-route",type=routes')).toEqual({
      context: 'MyCamel',
      name: '"simple-route"',
      type: 'routes',
    })
    expect(rbac.testing.parseProperties('name=PS Old Gen,type=MemoryPool')).toEqual({
      name: 'PS Old Gen',
      type: 'MemoryPool',
    })
    expect(rbac.testing.parseProperties('type=Memory')).toEqual({
      type: 'Memory',
    })
  })
})
