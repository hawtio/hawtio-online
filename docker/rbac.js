var ACL = ''; // Load ACL from nginx.js first
var regex = /^\/.*\/$/;
var rbacSearchKeyword = '*:type=security,area=jmx,*';
var rbacMBean = 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC';

// Expose private functions for testing
var testing = { isSearchRBACMBean, isBulkCanInvokeRequest };

export default { initACL, check, intercept, isCanInvokeRequest, testing };

function initACL(acl) {
  ACL = acl;
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

    var infos = (mbeans[domain] || {})[properties];
    if (!infos) {
      return intercepted(false);
    }

    // Check operations
    var res = Object.entries(infos.op || [])
      // handle overloaded methods
      .map(op => Array.isArray(op[1]) ? op[1].map(o => [op[0], o]) : [op])
      // flatMap shim
      .reduce((a, v) => a.concat(v), [])
      // check operation signature
      .find(op => check({ type: 'exec', mbean: mbean, operation: `${op[0]}(${op[1].args.map(arg => arg.type).toString()})` }, role).allowed);

    if (typeof res !== 'undefined') {
      return intercepted(true);
    }

    // Check attributes
    res = Object.entries(infos.attr || [])
      .find(attr => {
        var name = attr[0];
        var type = attr[1].type;
        // check getter
        if (check({ type: 'exec', mbean: mbean, operation: `${type === 'boolean' ? 'is' : 'get'}${name}()` }, role).allowed) return true;
        // check setter
        return check({ type: 'exec', mbean: mbean, operation: `set${name}(${type})` }, role).allowed;
      });

    return intercepted(typeof res !== 'undefined');
  }

  // Intercept client-side RBAC canInvoke(java.util.Map) request
  if (isBulkCanInvokeRequest(request)) {
    var value = Object.entries(request.arguments[0]).reduce((res, e) => {
      var mbean = e[0];
      var operations = e[1];
      res[mbean] = operations.reduce((r, op) => {
        r[op] = {
          CanInvoke: check({ type: 'exec', mbean: mbean, operation: op }, role).allowed,
          Method: op,
          ObjectName: mbean,
        };
        return r;
      }, {});
      return res;
    }, {});

    return intercepted(value);
  }

  return {
    intercepted: false,
    request: request,
  };
}

function check(request, role) {
  var mbean = request.mbean;
  var domain, objectName = {};
  if (mbean) {
    var i = mbean.indexOf(':');
    domain = i === -1 ? mbean : mbean.substring(0, i);
    var properties = mbean.substring(i + 1);
    var regexp = /([^,]+)=([^,]+)+/g;
    var match;
    while ((match = regexp.exec(properties)) !== null) {
      objectName[match[1]] = match[2];
    }
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
