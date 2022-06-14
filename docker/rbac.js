var ACL = ''; // Load ACL from nginx.js first
var regex = /^\/.*\/$/;
var rbacSearchKeyword = '*:type=security,area=jmx,*';
var rbacMBean = 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC';
var rbacRegistryPath = 'hawtio/type=security,name=RBACRegistry';
var rbacRegistryMBean = 'hawtio:type=security,name=RBACRegistry';

var rbacRegistryEnabled = process.env['HAWTIO_ONLINE_DISABLE_RBAC_REGISTRY'] !== 'true';

// Expose private functions for testing
var testing = { optimisedMBeans, identifySpecialMBean, parseProperties, decorateRBAC };

export default { initACL, check, intercept, isMBeanListRequired, testing };

function initACL(acl) {
  ACL = acl;
}

function isMBeanListRequired(request) {
  return isCanInvokeRequest(request) || isExecRBACRegistryList(request);
}

function isSearchRBACMBean(request) {
  return request.type === 'search' && request.mbean === rbacSearchKeyword;
}

function isCanInvokeRequest(request) {
  return request.type === 'exec' && request.mbean === rbacMBean && request.operation === 'canInvoke(java.lang.String)';
}

function isBulkCanInvokeRequest(request) {
  return request.type === 'exec' && request.mbean === rbacMBean && request.operation === 'canInvoke(java.util.Map)';
}

function isListRBACRegistry(request) {
  return request.type === 'list' && request.path === rbacRegistryPath;
}

function isExecRBACRegistryList(request) {
  return request.type === 'exec' && request.mbean === rbacRegistryMBean && request.operation === 'list()';
}

// ===== intercept =========================================

function intercept(request, role, mbeans) {
  var intercepted = value => ({
    intercepted: true,
    request: request,
    response: {
      status: 200,
      request: request,
      value: value,
      timestamp: new Date().getTime(),
    },
  });

  // Intercept client-side RBAC discovery request
  if (isSearchRBACMBean(request)) {
    return intercepted([rbacMBean]);
  }

  // Intercept client-side RBAC canInvoke(java.lang.String) request
  if (isCanInvokeRequest(request)) {
    var mbean = request.arguments[0];
    var i = mbean.indexOf(':');
    var domain = i === -1 ? mbean : mbean.substring(0, i);
    var properties = mbean.substring(i + 1);

    // MBeanInfo
    // https://docs.oracle.com/en/java/javase/11/docs/api/java.management/javax/management/MBeanInfo.html
    var info = (mbeans[domain] || {})[properties];
    if (!info) {
      return intercepted(false);
    }

    // Check operations
    var res = Object.entries(info.op || [])
      // handle overloaded methods
      .map(op => Array.isArray(op[1]) ? op[1].map(o => [op[0], o]) : [op])
      // flatMap shim
      .reduce((a, v) => a.concat(v), [])
      // check operation signature
      .find(op => canInvoke(mbean, operationSignature(op[0], op[1].args), role));

    if (typeof res !== 'undefined') {
      return intercepted(true);
    }

    // Check attributes
    res = Object.entries(info.attr || [])
      .find(attr => canInvokeGetter(mbean, attr[0], attr[1].type, role) || canInvokeSetter(mbean, attr[0], attr[1].type, role));

    return intercepted(typeof res !== 'undefined');
  }

  // Intercept client-side RBAC canInvoke(java.util.Map) request
  if (isBulkCanInvokeRequest(request)) {
    var value = Object.entries(request.arguments[0]).reduce((res, e) => {
      var mbean = e[0];
      var operations = e[1];
      res[mbean] = operations.reduce((r, op) => {
        r[op] = {
          CanInvoke: canInvoke(mbean, op, role),
          Method: op,
          ObjectName: mbean,
        };
        return r;
      }, {});
      return res;
    }, {});

    return intercepted(value);
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
      });
    }

    // Intercept client-side optimised list MBeans request
    if (isExecRBACRegistryList(request)) {
      return intercepted(optimisedMBeans(mbeans, role));
    }
  }

  return {
    intercepted: false,
    request: request,
  };
}

function operationSignature(name, args) {
  return `${name}(${args.map(arg => arg.type).toString()})`;
}

function canInvoke(mbean, operation, role) {
  return check({ type: 'exec', mbean: mbean, operation: operation }, role).allowed;
}

function canInvokeGetter(mbean, name, type, role) {
  return canInvoke(mbean, `${type === 'boolean' ? 'is' : 'get'}${name}()`, role);
}

function canInvokeSetter(mbean, name, type, role) {
  return canInvoke(mbean, `set${name}(${type})`, role);
}

function optimisedMBeans(mbeans, role) {
  // domain -> [mbean, mbean, ...], where mbean is either inline jsonified MBeanInfo
  // or a key to shared jsonified MBeanInfo
  var domains = {};
  // if MBean is found to be "special", we can cache JSONified MBeanInfo
  // (an object with "op", "attr" and "desc" properties)
  // key -> [mbeaninfo, mbeaninfo, ...]
  var cache = {};

  var visited = {};

  // we don't use functional map & reduce to save memory
  Object.entries(mbeans).forEach(infos => {
    var domain = infos[0];
    Object.entries(infos[1]).forEach(i => {
      var props = reorderProperties(domain, i[0]);
      var info = i[1];
      addMBeanInfo(cache, domains, visited, domain, props, info);
    });
  });

  // add RBAC info in advance so that client doesn't need to send another bulky request
  return decorateRBAC(domains, cache, role);
}

function reorderProperties(domain, props) {
  if (domain !== 'org.apache.activemq.artemis') {
    return props;
  }

  // Artemis plugin requires a specific order of property keys:
  //   broker > component > name | address > subcomponent > routing-type > queue
  var properties = parseProperties(props);

  var newProps = '';

  // recurring reorder process
  var reorder = (key) => {
    var delimiter = newProps === '' ? '' : ',';
    if (!properties[key]) {
      // unknown properties - done
      newProps += delimiter + toString(properties);
      return true;
    }
    newProps += `${delimiter}${key}=${properties[key]}`;
    delete properties[key];
    if (Object.keys(properties).length === 0) {
      // done
      return true;
    }
    // not yet done
    return false;
  };

  // broker > component
  if (reorder('broker') || reorder('component')) {
    return newProps;
  }

  // name
  if (properties['name']) {
    if (reorder('name')) {
      return newProps;
    } else {
      // properties with name stop here
      return newProps + ',' + toString(properties);
    }
  }

  // address > subcomponent > routing-type > queue
  if (reorder('address') || reorder('subcomponent') || reorder('routing-type') || reorder('queue')) {
    return newProps;
  }

  return newProps + ',' + toString(properties);
}

function toString(properties) {
  return Object.entries(properties)
    .reduce((str, prop) => str + `${prop[0]}=${prop[1]},`, '')
    .slice(0, -1);
}

function addMBeanInfo(cache, domains, visited, domain, props, mbeanInfo) {
  var objectName = `${domain}:${props}`;
  if (visited[objectName]) {
    return;
  }

  var cacheKey = identifySpecialMBean(domain, props, mbeanInfo);
  if (cacheKey && !cache[cacheKey]) {
    cache[cacheKey] = mbeanInfo;
  }

  if (!domains[domain]) {
    domains[domain] = {};
  }
  if (cacheKey) {
    domains[domain][props] = cacheKey;
  } else {
    domains[domain][props] = mbeanInfo;
  }

  visited[objectName] = true;
}

/*
 * If the ObjectName is detected as special (when we may have thousands of such MBeans),
 * we return a key to lookup already processed MBeanInfo.
 * 
 * If some combination of ObjectName and MBean's class name is detected as special,
 * we may cache the MBeanInfo as well.
 */
function identifySpecialMBean(domain, props, mbeanInfo) {
  switch (domain) {
    case 'org.apache.activemq':
      var properties = parseProperties(props);
      var destType = properties['destinationType'];
      // see: org.apache.activemq.command.ActiveMQDestination.getDestinationTypeAsString()
      switch (destType) {
        case 'Queue':
          return 'activemq:queue';
        case 'TempQueue':
          return 'activemq:tempqueue';
        case 'Topic':
          return 'activemq:topic';
        case 'TempTopic':
          return 'activemq:temptopic';
      }
      break;
    case 'org.apache.activemq.artemis':
      var properties = parseProperties(props);
      var comp = properties['component'];
      if (comp === 'addresses') {
        var subcomp = properties['subcomponent'];
        if (!subcomp) {
          return 'activemq.artemis:address';
        } else if (subcomp === 'queues') {
          return 'activemq.artemis:queue';
        }
      }
      break;
    case 'org.apache.camel':
      // "type" attribute is not enough - we have to know real class of MBean
      return `camel::${mbeanInfo.class}`;
  }

  return null;
}

function parseProperties(properties) {
  var result = {};
  var regexp = /([^,]+)=([^,]+)+/g;
  var match;
  while ((match = regexp.exec(properties)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}

/*
 * 1. each pair of MBean/operation has to be marked with RBAC flag (can/can't invoke)
 * 2. the information is provided by JMXSecurityMBean#canInvoke(java.util.Map)
 * 3. we'll peek into the ACL, to see which MBeans/operations have to be examined and
 *    which will produce same results
 * 4. only then we'll prepare Map as parameter for canInvoke()
 */
function decorateRBAC(domains, cache, role) {
  // the fact that some MBeans share JSON MBeanInfo doesn't mean that they can share RBAC info
  // - each MBean's name may have RBAC information configured in different ACLs.

  // when iterating through all repeating MBeans that share MBeanInfo (that doesn't have RBAC info
  // yet), we have to decide if it'll use shared info after RBAC check or will switch to dedicated
  // info. we have to be careful not to end with most MBeans *not* sharing MBeanInfo (in case if
  // somehow the shared info will be "special case" from RBAC point of view)

  // we don't use functional map & reduce to save memory
  Object.entries(domains).forEach(d => {
    var domain = d[0];
    var infos = d[1];
    Object.entries(infos).forEach(i => {
      var props = i[0];
      var mbean = `${domain}:${props}`;
      var info = i[1];
      if (typeof info === 'string') {
        info = cache[info];
      }
      // skip already resolved ones
      if (typeof info.canInvoke !== 'undefined') {
        return;
      }

      decorateMBeanInfo(mbean, info, role);
    });
  });

  return {
    cache: cache,
    domains: domains,
  };
}

function decorateMBeanInfo(mbean, info, role) {
  var rootCanInvoke = true;
  if (info.op) {
    rootCanInvoke = decorateOperations(mbean, info, role);
  }
  info['canInvoke'] = rootCanInvoke;
}

function decorateOperations(mbean, info, role) {
  // MBeanInfo root canInvoke is true if at least one op's canInvoke is true
  var rootCanInvoke = false;
  var opByString = {};
  Object.entries(info.op).forEach(op => {
    var name = op[0];
    // handle overloaded methods
    var sigs = Array.isArray(op[1]) ? op[1] : [op[1]];
    sigs.forEach(sig => {
      var operation = operationSignature(name, sig.args);
      var ci = canInvoke(mbean, operation, role);
      sig['canInvoke'] = ci;
      if (ci) {
        rootCanInvoke = true;
      }
      opByString[operation] = { canInvoke: ci };
    });
  });
  info['opByString'] = opByString;
  return rootCanInvoke;
}

// ===== check =============================================

function check(request, role) {
  var domain;
  var objectName;
  var mbean = request.mbean;
  if (mbean) {
    var i = mbean.indexOf(':');
    domain = i === -1 ? mbean : mbean.substring(0, i);
    var properties = mbean.substring(i + 1);
    objectName = parseProperties(properties);
  }
  return checkACLs(role, {
    type: request.type,
    domain: domain,
    properties: objectName,
    attribute: request.attribute,
    operation: request.operation,
    arguments: request.arguments,
  });
}

function checkACLs(role, jolokia) {
  var rbac;
  // lookup ACL by domain and type
  if (jolokia.properties && jolokia.properties.type) {
    rbac = checkACL(role, jolokia, `${jolokia.domain}.${jolokia.properties.type}`);
    if (rbac) {
      return rbac;
    }
  }
  // lookup ACL by domain
  if (jolokia.domain) {
    rbac = checkACL(role, jolokia, jolokia.domain);
    if (rbac) {
      return rbac;
    }
  }
  // fallback to default ACL if any
  rbac = checkACL(role, jolokia, 'default');
  if (rbac) {
    return rbac;
  }
  // unauthorize by default
  return { allowed: false, reason: `No ACL matching request ${JSON.stringify(jolokia)}` };
}

function checkACL(role, jolokia, name) {
  var acl = ACL[name];
  if (!acl) {
    return null;
  }
  var member;
  if (jolokia.operation) {
    if (jolokia.arguments && jolokia.arguments.length > 0) {
      member = jolokia.operation + '[' + jolokia.arguments.toString() + ']';
    } else {
      member = jolokia.operation.slice(0, -2);
    }
  } else if (jolokia.attribute) {
    member = jolokia.attribute;
  } else {
    member = jolokia.type.toLowerCase();
  }

  if (Array.isArray(acl)) {
    var entry = acl.map(a => Object.entries(a)[0])
      .find(e => e[0] === member || regex.test(e[0]) && new RegExp(e[0].slice(1, -1)).test(member));
    if (entry) {
      return checkRoles(role, jolokia, name, entry[0], entry[1]);
    }
  } else if (typeof acl === 'object') {
    // direct match?
    if (acl[member]) {
      return checkRoles(role, jolokia, name, member, acl[member]);
    }
    // test regex keys
    var entry = Object.entries(acl).filter(e => regex.test(e[0])).find(e => new RegExp(e[0].slice(1, -1)).test(member));
    if (entry) {
      return checkRoles(role, jolokia, name, entry[0], entry[1]);
    }
    // direct match without arguments?
    if (jolokia.operation && jolokia.arguments && jolokia.arguments.length > 0) {
      member = jolokia.operation;
      if (acl[member]) {
        return checkRoles(role, jolokia, name, member, acl[member]);
      }
    }
    // direct match without signature?
    if (jolokia.operation) {
      member = jolokia.operation.slice(0, jolokia.operation.indexOf('('));
      if (acl[member]) {
        return checkRoles(role, jolokia, name, member, acl[member]);
      }
    }
  }
  return null;
}

function checkRoles(role, jolokia, name, key, roles) {
  var allowed = { allowed: true, reason: `Role '${role}' allowed by '${name}[${key}]: ${roles}'` };
  var denied = { allowed: false, reason: `Role '${role}' denied by '${name}[${key}]: ${roles}'` };

  if (typeof roles === 'string') {
    roles = roles.split(',').map(r => r.trim()).filter(r => r);
  }

  if (Array.isArray(roles)) {
    // direct match?
    if (roles.includes(role)) {
      return allowed;
    }
    // test regex roles
    var match = roles.filter(r => regex.test(r)).find(r => new RegExp(r.slice(1, -1)).test(role));
    if (match) {
      return allowed;
    }
    return denied;
  }

  throw Error(`Unsupported roles '${roles}' in '${name}[${key}]'`);
}
