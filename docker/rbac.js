import jsyaml from '/js-yaml.js';

var fs = require('fs');

// TODO: ACL location should be parameterized
var ACL = jsyaml.safeLoad(fs.readFileSync('ACL.yaml'));

var regex = /^\/.*\/$/;

function checkACL(role, jolokia, name) {
  var acl = ACL[name];
  if (!acl) {
    return null;
  }
  var member = jolokia.operation || jolokia.attribute;
  if (Array.isArray(acl)) {
    var entry = acl.map(a => Object.entries(a)[0])
      .find(e => e[0] === member || regex.test(e[0]) && new RegExp(e[0].substring(1, e[0].length - 1)).test(member));
    if (entry) {
      return checkRoles(role, jolokia, name, entry[0], entry[1]);
    }
  } else if (typeof acl === 'object') {
    // direct match?
    if (acl[member]) {
      return checkRoles(role, jolokia, name, member, acl[member]);
    }
    // test regex keys
    var entry = Object.entries(acl).filter(e => regex.test(e[0])).find(e => new RegExp(e[0].substring(1, e[0].length - 1)).test(member));
    if (entry) {
      return checkRoles(role, jolokia, name, entry[0], entry[1]);
    }
  }
  return null;
}

function checkRoles(role, jolokia, name, key, roles) {
  var allowed = { allowed: true, reason: `Role '${role}' allowed by '${name}[${key}]: ${roles}'` };
  var denied = { allowed: false, reason: `Role '${role}' denied by '${name}[${key}]: ${roles}'` };

  if (Array.isArray(roles)) {
    // direct match?
    if (roles.includes(role)) {
      return allowed;
    }
    // test regex roles
    var match = roles.filter(r => regex.test(r)).find(r => new RegExp(r.substring(1, r.length - 1)).test(role));
    if (match) {
      return allowed;
    }
    return denied;

  } else if (typeof roles === 'string') {
    if (roles === role) {
      return allowed;
    }
    if (regex.test(roles) && new RegExp(roles.substring(1, roles.length - 1)).test(role)) {
      return allowed;
    }
    return denied;
  }
  throw Error(`Unsupported roles '${roles}' in '${name}[${key}]'`);
}

export default function check(role, jolokia) {
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
