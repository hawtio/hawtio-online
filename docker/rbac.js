import jsyaml from '/js-yaml.js';

var fs = require('fs');

// TODO: ACL location should be parameterized
var ACL = jsyaml.safeLoad(fs.readFileSync('ACL.yaml'));

var regex = /^\/.*\/$/;

export default {
  check: check,
  intercept: intercept,
};

function intercept(request) {
  if (request.type === 'search' && request.mbean === '*:type=security,area=jmx,*') {
    return {
      intercepted: true,
      request: request,
      response: {
        status: 200,
        request: request,
        value: [
          'io.hawt:area=jmx,type=security',
        ],
        timestamp: new Date().getTime(),
      }
    };
  }
  return {
    intercepted: false,
    request: request,
  };
}

function check(role, request) {
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
    member = jolokia.type;
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
