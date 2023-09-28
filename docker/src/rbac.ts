import { IJmxAttribute, IJmxDomains, IJmxMBean, IJmxOperation, IRequest } from "jolokia.js"
import { ACLCheck, BulkValue, Intercepted, isObject, OptimisedJmxMBean } from './globals'

type JmxOperationEntry = [string, IJmxOperation | IJmxOperation[]]
type JmxMBeanInfoCache = Record<string, IJmxMBean>
type JmxAttributeEntry = [string, IJmxAttribute]

interface JmxNamedOperation {
  name: string,
  operation: IJmxOperation
}

interface JmxUnionRequest {
  type: string,
  domain?: string,
  properties?: Record<string, string>,
  attribute?: string | string[],
  operation?: string,
  arguments?: unknown[]
}

let ACL: Record<string, unknown> = {} // Load ACL from nginx.js first
const regex = /^\/.*\/$/
const rbacSearchKeyword = '*:type=security,area=jmx,*'
const rbacMBean = 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC'
const rbacRegistryPath = 'hawtio/type=security,name=RBACRegistry'
const rbacRegistryMBean = 'hawtio:type=security,name=RBACRegistry'

const rbacRegistryEnabled = process.env['HAWTIO_ONLINE_DISABLE_RBAC_REGISTRY'] !== 'true'

// Expose private functions for testing
export const testing = { optimisedMBeans, identifySpecialMBean, parseProperties, decorateRBAC }

export function initACL(acl: unknown) {
  if (isObject(acl))
    ACL = acl as Record<string, unknown>
  else
    throw new Error('ACL has not loaded correctly')
}

export function isMBeanListRequired(request: IRequest) {
  return isCanInvokeRequest(request) || isExecRBACRegistryList(request)
}

export function isSearchRBACMBean(request: IRequest) {
  return request.type === 'search' && request.mbean === rbacSearchKeyword
}

export function isCanInvokeRequest(request: IRequest) {
  return request.type === 'exec' && request.mbean === rbacMBean && request.operation === 'canInvoke(java.lang.String)'
}

export function isBulkCanInvokeRequest(request: IRequest) {
  return request.type === 'exec' && request.mbean === rbacMBean && request.operation === 'canInvoke(java.util.Map)'
}

export function isListRBACRegistry(request: IRequest) {
  return request.type === 'list' && request.path === rbacRegistryPath
}

export function isExecRBACRegistryList(request: IRequest) {
  return request.type === 'exec' && request.mbean === rbacRegistryMBean && request.operation === 'list()'
}

// ===== intercept =========================================

export function intercept(request: IRequest, role: string, mbeans: IJmxDomains): Intercepted {
  const intercepted = (value: unknown) => ({
    intercepted: true,
    request: request,
    response: {
      status: 200,
      request: request,
      value: value,
      timestamp: new Date().getTime(),
    },
  })

  // Intercept client-side RBAC discovery request
  if (isSearchRBACMBean(request)) {
    return intercepted([rbacMBean])
  }

  // Intercept client-side RBAC canInvoke(java.lang.String) request
  if (isCanInvokeRequest(request) && 'arguments' in request) {
    const args: unknown[] = request.arguments || []
    if (args.length > 0) {

      const mbean = args[0] as string
      const i = mbean.indexOf(':')
      const domain = i === -1 ? mbean : mbean.substring(0, i)
      const properties = mbean.substring(i + 1)

      // MBeanInfo
      // https://docs.oracle.com/en/java/javase/11/docs/api/java.management/javax/management/MBeanInfo.html
      const info = (mbeans[domain] || {})[properties]
      if (!info) {
        return intercepted(false)
      }

      if (info.op) {
        // Check operations
        const entries: JmxOperationEntry[] = Object.entries(info.op)
        const namedOps: JmxNamedOperation[] = []
        entries.forEach(entry => {
          const name = entry[0]
          const opOrOps = entry[1]
          if (Array.isArray(opOrOps)) {
            opOrOps.forEach(op => { namedOps.push({name, operation: op}) })
          } else {
            namedOps.push({name, operation: opOrOps})
          }
        })

        const res = namedOps.find(namedOp => canInvoke(mbean, operationSignature(namedOp.name, namedOp.operation), role))
        if (res)
          return intercepted(true)
      }

      if (info.attr) {
        // Check attributes
        const entries: JmxAttributeEntry[] = Object.entries(info.attr)
        const res = entries.find(entry => {
          const name = entry[0]
          const attr = entry[1]

          return canInvokeGetter(mbean, name, attr, role) || canInvokeSetter(mbean, name, attr, role)
        })

        return intercepted(res ? true : false)
      }
    }
  }

  // Intercept client-side RBAC canInvoke(java.util.Map) request
  if (isBulkCanInvokeRequest(request) && 'arguments' in request) {
    const args: unknown[] = request.arguments || []
    if (args.length > 0 && isObject(args[0])) {
      const argObj = args[0] as Record<string, string[]>
      const argEntries = Object.entries(argObj)

      const value: Record<string, unknown> = {}
      argEntries.forEach(argEntry => {
        const mbean = argEntry[0]
        const operations = argEntry[1]

        operations.forEach(operation => {
          const bulkValue: BulkValue = {
            CanInvoke: canInvoke(mbean, operation, role),
            Method: operation,
            ObjectName: mbean,
          }
          value[operation] = bulkValue
        })
      })

      return intercepted(value)
    }
  }

  if (rbacRegistryEnabled) {
    // Intercept client-side RBACRegistry discovery request
    if (isListRBACRegistry(request)) {
      return intercepted({
        class: 'io.hawt.jmx.RBACRegistry',
        desc: 'Hawtio Online RBACRegistry',
        op: {
          list: {
            desc: 'Hawtio Online RBACRegistry - list',
            args: [],
            ret: 'java.util.Map',
          }
        },
      })
    }

    // Intercept client-side optimised list MBeans request
    if (isExecRBACRegistryList(request)) {
      return intercepted(optimisedMBeans(mbeans, role))
    }
  }

  return {
    intercepted: false,
    request: request,
  }
}

function operationSignature(name: string, op: IJmxOperation) {
  return `${name}(${op.args.map(arg => arg.type).toString()})`
}

function canInvoke(mbean: string, operation: string, role: string) {
  return check({ type: 'exec', mbean: mbean, operation: operation }, role).allowed
}

function canInvokeGetter(mbean: string, name: string, attribute: IJmxAttribute, role: string) {
  return canInvoke(mbean, `${attribute.type === 'boolean' ? 'is' : 'get'}${name}()`, role)
}

function canInvokeSetter(mbean: string, name: string, attribute: IJmxAttribute, role: string) {
  return canInvoke(mbean, `set${name}(${attribute.type})`, role)
}

function optimisedMBeans(mbeans: IJmxDomains, role: string) {
  // domain -> [mbean, mbean, ...], where mbean is either inline jsonified MBeanInfo
  // or a key to shared jsonified MBeanInfo
  const domains = {}
  // if MBean is found to be "special", we can cache JSONified MBeanInfo
  // (an object with "op", "attr" and "desc" properties)
  // key -> [mbeaninfo, mbeaninfo, ...]
  const cache: JmxMBeanInfoCache = {}

  const visited: Record<string, boolean> = {}

  // we don't use functional map & reduce to save memory
  Object.entries(mbeans).forEach(infos => {
    const domain = infos[0]
    Object.entries(infos[1]).forEach(i => {
      const props = reorderProperties(domain, i[0])
      const info = i[1]
      addMBeanInfo(cache, domains, visited, domain, props, info)
    })
  })

  // add RBAC info in advance so that client doesn't need to send another bulky request
  return decorateRBAC(domains, cache, role)
}

function reorderProperties(domain: string, props: string) {
  if (domain !== 'org.apache.activemq.artemis') {
    return props
  }

  // Artemis plugin requires a specific order of property keys:
  //   broker > component > name | address > subcomponent > routing-type > queue
  const properties = parseProperties(props)

  let newProps = ''

  // recurring reorder process
  const reorder = (key: string) => {
    const delimiter = newProps === '' ? '' : ','
    if (!properties[key]) {
      // unknown properties - done
      newProps += delimiter + toString(properties)
      return true
    }
    newProps += `${delimiter}${key}=${properties[key]}`
    delete properties[key]
    if (Object.keys(properties).length === 0) {
      // done
      return true
    }
    // not yet done
    return false
  }

  // broker > component
  if (reorder('broker') || reorder('component')) {
    return newProps
  }

  // name
  if (properties['name']) {
    if (reorder('name')) {
      return newProps
    } else {
      // properties with name stop here
      return newProps + ',' + toString(properties)
    }
  }

  // address > subcomponent > routing-type > queue
  if (reorder('address') || reorder('subcomponent') || reorder('routing-type') || reorder('queue')) {
    return newProps
  }

  return newProps + ',' + toString(properties)
}

function toString(properties: Record<string, string>) {
  return Object.entries(properties)
    .reduce((str, prop) => str + `${prop[0]}=${prop[1]},`, '')
    .slice(0, -1)
}

function addMBeanInfo(cache: JmxMBeanInfoCache, domains: IJmxDomains, visited: Record<string, boolean>, domain: string, props: string, mbeanInfo: IJmxMBean) {
  const objectName = `${domain}:${props}`
  if (visited[objectName]) {
    return
  }

  const cacheKey = identifySpecialMBean(domain, props, mbeanInfo)
  if (cacheKey && !cache[cacheKey]) {
    cache[cacheKey] = mbeanInfo
  }

  if (!domains[domain]) {
    domains[domain] = {}
  }
  if (cacheKey) {
    domains[domain][props] = cache[cacheKey]
  } else {
    domains[domain][props] = mbeanInfo
  }

  visited[objectName] = true
}

/*
 * If the ObjectName is detected as special (when we may have thousands of such MBeans),
 * we return a key to lookup already processed MBeanInfo.
 *
 * If some combination of ObjectName and MBean's class name is detected as special,
 * we may cache the MBeanInfo as well.
 */
function identifySpecialMBean(domain: string, props: string, mbeanInfo: IJmxMBean): string | null {
  switch (domain) {
    case 'org.apache.activemq': {
      const properties = parseProperties(props)
      const destType = properties['destinationType']
      // see: org.apache.activemq.command.ActiveMQDestination.getDestinationTypeAsString()
      switch (destType) {
        case 'Queue':
          return 'activemq:queue'
        case 'TempQueue':
          return 'activemq:tempqueue'
        case 'Topic':
          return 'activemq:topic'
        case 'TempTopic':
          return 'activemq:temptopic'
      }
      break
    }
    case 'org.apache.activemq.artemis':
    {
      const properties = parseProperties(props)
      const comp = properties['component']
      if (comp === 'addresses') {
        const subcomp = properties['subcomponent']
        if (!subcomp) {
          return 'activemq.artemis:address'
        } else if (subcomp === 'queues') {
          return 'activemq.artemis:queue'
        }
      }
      break
    }
    case 'org.apache.camel':
      // "type" attribute is not enough - we have to know real class of MBean
      return `camel::${mbeanInfo.desc}`
  }

  return null
}

function parseProperties(properties: string): Record<string, string> {
  const result: Record<string, string> = {}
  const regexp = /([^,]+)=([^,]+)+/g
  let match
  while ((match = regexp.exec(properties)) !== null) {
    result[match[1]] = match[2]
  }
  return result
}

/*
 * 1. each pair of MBean/operation has to be marked with RBAC flag (can/can't invoke)
 * 2. the information is provided by JMXSecurityMBean#canInvoke(java.util.Map)
 * 3. we'll peek into the ACL, to see which MBeans/operations have to be examined and
 *    which will produce same results
 * 4. only then we'll prepare Map as parameter for canInvoke()
 */
function decorateRBAC(domains: IJmxDomains, cache: Record<string, IJmxMBean>, role: string) {
  // the fact that some MBeans share JSON MBeanInfo doesn't mean that they can share RBAC info
  // - each MBean's name may have RBAC information configured in different ACLs.

  // when iterating through all repeating MBeans that share MBeanInfo (that doesn't have RBAC info
  // yet), we have to decide if it'll use shared info after RBAC check or will switch to dedicated
  // info. we have to be careful not to end with most MBeans *not* sharing MBeanInfo (in case if
  // somehow the shared info will be "special case" from RBAC point of view)

  // we don't use functional map & reduce to save memory
  Object.entries(domains).forEach(d => {
    const domain = d[0]
    const infos = d[1]
    Object.entries(infos).forEach(i => {
      const props = i[0]
      const mbean = `${domain}:${props}`
      let info = i[1]
      if (typeof info === 'string') {
        info = cache[info]
      }
      // skip already resolved ones
      if (typeof info.canInvoke !== 'undefined') {
        return
      }

      decorateMBeanInfo(mbean, info, role)
    })
  })

  return {
    cache: cache,
    domains: domains,
  }
}

function decorateMBeanInfo(mbean: string, info: IJmxMBean, role: string) {
  let rootCanInvoke = true
  if (info.op) {
    rootCanInvoke = decorateOperations(mbean, info, role)
  }
  info['canInvoke'] = rootCanInvoke
}

function decorateOperations(mbean: string, info: IJmxMBean, role: string) {
  // MBeanInfo root canInvoke is true if at least one op's canInvoke is true
  let rootCanInvoke = false
  if (!info.op) return rootCanInvoke

  let opByString: Record<string, IJmxOperation> = {}
  Object.entries(info.op).forEach(op => {
    const name = op[0]
    // handle overloaded methods
    const sigs = Array.isArray(op[1]) ? op[1] : [op[1]]
    sigs.forEach(sig => {
      const operation = operationSignature(name, sig)
      const ci = canInvoke(mbean, operation, role)
      sig['canInvoke'] = ci
      if (ci) {
        rootCanInvoke = true
      }
      opByString[operation] = {
        desc: sig.desc,
        args: sig.args,
        ret: sig.ret,
        canInvoke: ci,
      }
    })
  })

  const opInfo = info as OptimisedJmxMBean

  opInfo['opByString'] = opByString
  info = opInfo // Is this necessary?

  return rootCanInvoke
}

// ===== check =============================================

export function check(request: IRequest, role: string): ACLCheck {
  let domain
  let objectName
  if ('mbean' in request) {
    const mbean = request.mbean
    const i = mbean.indexOf(':')
    domain = i === -1 ? mbean : mbean.substring(0, i)
    const properties = mbean.substring(i + 1)
    objectName = parseProperties(properties)
  }
  return checkACLs(role, {
    type: request.type,
    domain: domain,
    properties: objectName,
    attribute: ('attribute' in request) ? request.attribute : undefined,
    operation: ('operation' in request) ? request.operation : undefined,
    arguments: ('arguments' in request) ? request.arguments : undefined,
  })
}

function checkACLs(role: string, jolokia: JmxUnionRequest): ACLCheck {
  let rbac
  // lookup ACL by domain and type
  if (jolokia.properties && jolokia.properties.type) {
    rbac = checkACL(role, jolokia, `${jolokia.domain}.${jolokia.properties.type}`)
    if (rbac) {
      return rbac
    }
  }
  // lookup ACL by domain
  if (jolokia.domain) {
    rbac = checkACL(role, jolokia, jolokia.domain)
    if (rbac) {
      return rbac
    }
  }
  // fallback to default ACL if any
  rbac = checkACL(role, jolokia, 'default')
  if (rbac) {
    return rbac
  }
  // unauthorize by default
  return { allowed: false, reason: `No ACL matching request ${JSON.stringify(jolokia)}` }
}

function checkACL(role: string, jolokia: JmxUnionRequest, name: string): ACLCheck|null {
  const acl: unknown = ACL[name]
  if (!acl) {
    return null
  }
  let member: string
  if (jolokia.operation) {
    if (jolokia.arguments && jolokia.arguments.length > 0) {
      member = jolokia.operation + '[' + jolokia.arguments.toString() + ']'
    } else {
      member = jolokia.operation.slice(0, -2)
    }
  } else if (jolokia.attribute && ! Array.isArray(jolokia.attribute)) {
    member = jolokia.attribute
  } else {
    member = jolokia.type.toLowerCase()
  }

  if (Array.isArray(acl)) {
    const entry = acl.map(a => Object.entries(a)[0])
      .find(e => e[0] === member || regex.test(e[0]) && new RegExp(e[0].slice(1, -1)).test(member))
    if (entry) {
      return checkRoles(role, name, entry[0], entry[1])
    }
  } else if (typeof acl === 'object') {
    const aclObj = acl as Record<string, unknown>
    // direct match?
    if (aclObj[member]) {
      return checkRoles(role, name, member, aclObj[member])
    }
    // test regex keys
    const entry = Object.entries(acl).filter(e => regex.test(e[0])).find(e => new RegExp(e[0].slice(1, -1)).test(member))
    if (entry) {
      return checkRoles(role, name, entry[0], entry[1])
    }
    // direct match without arguments?
    if (jolokia.operation && jolokia.arguments && jolokia.arguments.length > 0) {
      member = jolokia.operation
      if (aclObj[member]) {
        return checkRoles(role, name, member, aclObj[member])
      }
    }
    // direct match without signature?
    if (jolokia.operation) {
      member = jolokia.operation.slice(0, jolokia.operation.indexOf('('))
      if (aclObj[member]) {
        return checkRoles(role, name, member, aclObj[member])
      }
    }
  }
  return null
}

function checkRoles(role: string, name: string, key: string, roles: unknown): ACLCheck {
  const allowed = { allowed: true, reason: `Role '${role}' allowed by '${name}[${key}]: ${roles}'` }
  const denied = { allowed: false, reason: `Role '${role}' denied by '${name}[${key}]: ${roles}'` }

  if (typeof roles === 'string') {
    roles = roles.split(',').map(r => r.trim()).filter(r => r)
  }

  if (Array.isArray(roles)) {
    // direct match?
    if (roles.includes(role)) {
      return allowed
    }
    // test regex roles
    const match = roles.filter(r => regex.test(r)).find(r => new RegExp(r.slice(1, -1)).test(role))
    if (match) {
      return allowed
    }
    return denied
  }

  throw Error(`Unsupported roles '${roles}' in '${name}[${key}]'`)
}
