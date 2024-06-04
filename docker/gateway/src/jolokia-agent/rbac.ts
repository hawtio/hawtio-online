import {
  Request as MBeanRequest,
  JmxDomains,
  MBeanInfo,
  MBeanInfoError,
  MBeanOperation,
  MBeanOperationArgument
} from 'jolokia.js'
import 'jolokia.js/simple'
import {
  BulkValue, Intercepted, MBeanInfoCache, MBeanOperationEntry, OptimisedCachedDomains, OptimisedJmxDomains,
  OptimisedMBeanInfo, OptimisedMBeanOperation, hasMBeanAttribute,
  hasMBeanOperation, isArgumentExecRequest, isMBeanDefinedRequest,
  isMBeanInfoError, isOptimisedMBeanInfo, isRecord,
  toStringArray
} from "./globals"

interface JmxUnionRequest {
  type: string,
  domain?: string,
  properties?: Record<string, string>,
  attribute?: string | string[],
  operation?: string,
  arguments?: unknown[]
}

interface MBeanNamedOperation {
  name: string,
  operation: MBeanOperation
}

const RBAC_SEARCH_MBEAN = 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC'
const RBAC_REGISTRY_MBEAN = 'hawtio:type=security,name=RBACRegistry'
const REGISTRY_MBEAN_URI_PATH = 'hawtio/type=security,name=RBACRegistry'

let ACL: Record<string, unknown>
const regex = /^\/.*\/$/
const rbacSearchKeyword = '*:type=security,area=jmx,*'

const rbacRegistryEnabled = process.env['HAWTIO_ONLINE_DISABLE_RBAC_REGISTRY'] !== 'true'

// Expose private functions for testing
const testing = { optimisedMBeans, identifySpecialMBean, parseProperties, decorateRBAC }

export default { initACL, check, intercept, isMBeanListRequired, testing }

function initACL(acl: Record<string, unknown>) {
  ACL = acl
}

function isMBeanListRequired(request: MBeanRequest) {
  return isCanInvokeRequest(request) || isExecRBACRegistryList(request)
}

function isSearchRBACMBean(request: MBeanRequest) {
  return request.type === 'search' && request.mbean === rbacSearchKeyword
}

function isCanInvokeRequest(request: MBeanRequest) {
  return request.type === 'exec' && request.mbean === RBAC_SEARCH_MBEAN && request.operation === 'canInvoke(java.lang.String)'
}

function isBulkCanInvokeRequest(request: MBeanRequest) {
  return request.type === 'exec' && request.mbean === RBAC_SEARCH_MBEAN && request.operation === 'canInvoke(java.util.Map)'
}

function isListRBACRegistry(request: MBeanRequest) {
  return request.type === 'list' && request.path === REGISTRY_MBEAN_URI_PATH
}

function isExecRBACRegistryList(request: MBeanRequest) {
  return request.type === 'exec' && request.mbean === RBAC_REGISTRY_MBEAN && request.operation === 'list()'
}

// ===== intercept =========================================
function intercept(request: MBeanRequest, role: string, mbeans: JmxDomains): Intercepted {
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
    /*
     * Returns the approved RBAC Search MBean
     */
    const i = intercepted([RBAC_SEARCH_MBEAN])
    return i
  }

  // Intercept client-side RBAC canInvoke(java.lang.String) request
  if (isCanInvokeRequest(request) && isArgumentExecRequest(request)) {
    const args: unknown[] = request.arguments || []
    if (args.length > 0) {

      const mbean = args[0] as string
      const i = mbean.indexOf(':')
      const domain = i === -1 ? mbean : mbean.substring(0, i)
      const properties = mbean.substring(i + 1)

      // MBeanInfo
      // https://docs.oracle.com/en/java/javase/11/docs/api/java.management/javax/management/MBeanInfo.html
      if (!mbeans || ! Object.hasOwn(mbeans, domain)) {
        return intercepted(false)
      }

      const info = (mbeans[domain] || {})[properties]
      if (!info) {
        return intercepted(false)
      }

      // Check operations
      if (hasMBeanOperation(info)) {
        const op = info.op
        const entries: MBeanOperationEntry[] = Object.entries(op)
        const namedOps: MBeanNamedOperation[] = []
        entries.forEach(entry => {
          const name = entry[0]
          const opOrOps = entry[1]
          if (Array.isArray(opOrOps)) {
            opOrOps.forEach(op => { namedOps.push({name, operation: op}) })
          } else {
            namedOps.push({name, operation: opOrOps})
          }
        })

        const res = namedOps.find(namedOp => canInvoke(mbean, operationSignature(namedOp.name, namedOp.operation.args), role))
        if (res)
          return intercepted(true)
      }

      if (hasMBeanAttribute(info)) {
        // Check attributes
        const res = Object.entries(info.attr || [])
          .find(attr => canInvokeGetter(mbean, attr[0], attr[1].type, role) || canInvokeSetter(mbean, attr[0], attr[1].type, role))

        return intercepted(typeof res !== 'undefined')
      }
    }
  }

  // Intercept client-side RBAC canInvoke(java.util.Map) request
  if (isBulkCanInvokeRequest(request) && isArgumentExecRequest(request)) {
    const args: unknown[] = request.arguments || []
    if (args.length > 0 && isRecord(args[0])) {
      const argEntries = Object.entries(args[0])

      const value: Record<string, unknown> = {}
      argEntries.forEach(argEntry => {
        const mbean = argEntry[0]
        const operations = toStringArray(argEntry[1])

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

  const i =  {
    intercepted: false,
    request: request
  }

  return i
}

function operationSignature(name: string, args: MBeanOperationArgument[]) {
  return `${name}(${args.map(arg => arg.type).toString()})`
}

function canInvoke(mbean: string, operation: string, role: string) {
  return check({ type: 'exec', mbean: mbean, operation: operation }, role).allowed
}

function canInvokeGetter(mbean: string, name: string, type: string, role: string) {
  return canInvoke(mbean, `${type === 'boolean' ? 'is' : 'get'}${name}()`, role)
}

function canInvokeSetter(mbean: string, name: string, type: string, role: string) {
  return canInvoke(mbean, `set${name}(${type})`, role)
}

function optimisedMBeans(mbeans: JmxDomains, role: string): OptimisedCachedDomains {
  // domain -> [mbean, mbean, ...], where mbean is either inline jsonified MBeanInfo
  // or a key to shared jsonified MBeanInfo
  const domains: OptimisedJmxDomains = {}
  // if MBean is found to be "special", we can cache JSONified MBeanInfo
  // (an object with "op", "attr" and "desc" properties)
  // key -> [mbeaninfo, mbeaninfo, ...]
  const cache = {}

  const visited = {}

  // we don't use functional map & reduce to save memory
  Object.entries(mbeans).forEach(infos => {
    const domain = infos[0]
    Object.entries(infos[1]).forEach(i => {
      const props = reorderProperties(domain, i[0])
      const info = i[1]
      if (! (isMBeanInfoError(info)))
        addMBeanInfo(cache, domains, visited, domain, props, info as OptimisedMBeanInfo)
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

function addMBeanInfo(cache: MBeanInfoCache, domains: JmxDomains, visited: Record<string, boolean>, domain: string, props: string, mbeanInfo: OptimisedMBeanInfo) {
  const objectName = `${domain}:${props}`
  if (visited[objectName]) {
    return
  }

  const cacheKey = identifySpecialMBean(domain, props, mbeanInfo)
  if (cacheKey && !cache[cacheKey]) {
    cache[cacheKey] = mbeanInfo as OptimisedMBeanInfo
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
function identifySpecialMBean(domain: string, props: string, mbeanInfo: MBeanInfo | MBeanInfoError) {
  if (isMBeanInfoError(mbeanInfo)) {
    return null // mbeanInfo is an error
  }

  switch (domain) {
    case 'org.apache.activemq':
    {
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
      return `camel::${mbeanInfo.class}`
  }

  return null
}

function parseProperties(properties: string) {
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
function decorateRBAC(domains: OptimisedJmxDomains, cache: MBeanInfoCache, role: string): OptimisedCachedDomains {
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
      if (isOptimisedMBeanInfo(info)) {
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

function decorateMBeanInfo(mbean: string, info: OptimisedMBeanInfo, role: string) {
  let rootCanInvoke = true
  if (info.op) {
    rootCanInvoke = decorateOperations(mbean, info, role)
  }
  info.canInvoke = rootCanInvoke
}

function decorateOperations(mbean: string, info: OptimisedMBeanInfo, role: string) {
  // MBeanInfo root canInvoke is true if at least one op's canInvoke is true
  let rootCanInvoke = false
  if (!info.op) return rootCanInvoke

  const opByString: Record<string, OptimisedMBeanOperation> = {}
  Object.entries(info.op).forEach(op => {
    const name = op[0]
    // handle overloaded methods
    const sigs = Array.isArray(op[1]) ? op[1] : [op[1]]
    sigs.forEach(sig => {
      const operation = operationSignature(name, sig.args)
      const ci = canInvoke(mbean, operation, role)
      sig.canInvoke = ci
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
  info.opByString = opByString
  return rootCanInvoke
}

// ===== check =============================================

function check(request: MBeanRequest, role: string) {
  let domain
  let objectName
  if (isMBeanDefinedRequest(request)) {
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

function checkACLs(role: string, jolokia: JmxUnionRequest) {
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

function checkACL(role: string, jolokia: JmxUnionRequest, name: string) {
  const acl = ACL[name]
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
      return checkRoles(role, jolokia, name, entry[0], entry[1])
    }
  } else if (isRecord(acl)) {
    // direct match?
    if (acl[member]) {
      return checkRoles(role, jolokia, name, member, acl[member])
    }
    // test regex keys
    const entry = Object.entries(acl).filter(e => regex.test(e[0])).find(e => new RegExp(e[0].slice(1, -1)).test(member))
    if (entry) {
      return checkRoles(role, jolokia, name, entry[0], entry[1])
    }
    // direct match without arguments?
    if (jolokia.operation && jolokia.arguments && jolokia.arguments.length > 0) {
      member = jolokia.operation
      if (acl[member]) {
        return checkRoles(role, jolokia, name, member, acl[member])
      }
    }
    // direct match without signature?
    if (jolokia.operation) {
      member = jolokia.operation.slice(0, jolokia.operation.indexOf('('))
      if (acl[member]) {
        return checkRoles(role, jolokia, name, member, acl[member])
      }
    }
  }
  return null
}

function checkRoles(role: string, jolokia: JmxUnionRequest, name: string, key: string, roles: unknown) {
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
