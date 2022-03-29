import rbac from './rbac.js';
import yaml from './js-yaml.js';
import * as fs from 'fs';

rbac.initACL(yaml.safeLoad(fs.readFileSync('./docker/ACL.yaml')));
const listMBeans = JSON.parse(fs.readFileSync('./docker/test.listMBeans.json')).value;

// Roles
const admin = 'admin';
const viewer = 'viewer';

describe('check', function () {
  it('should handle a request with viewer role', function () {
    const result = rbac.check({
      type: 'exec',
      mbean: 'org.apache.camel:type=context',
      operation: 'dumpRoutesAsXml()',
    }, viewer);
    expect(result.allowed).toBe(true);
  });

  it('should handle a request with arguments and no roles allowed', function () {
    const result1 = rbac.check({
      type: 'exec',
      mbean: 'org.apache.karaf:type=bundle',
      operation: 'uninstall(java.lang.String)',
      arguments: [
        '0',
      ],
    }, admin);
    expect(result1.allowed).toBe(false);
    const result2 = rbac.check({
      type: 'exec',
      mbean: 'org.apache.karaf:type=bundle',
      operation: 'uninstall(java.lang.String)',
      arguments: [
        '0',
      ],
    }, viewer);
    expect(result2.allowed).toBe(false);
  });

  it('should handle a request with arguments and only admin allowed', function () {
    const result1 = rbac.check({
      type: 'exec',
      mbean: 'org.apache.karaf:type=bundle',
      operation: 'update(java.lang.String,java.lang.String)',
      arguments: [
        '50',
        'value',
      ],
    }, admin);
    expect(result1.allowed).toBe(true);
    const result2 = rbac.check({
      type: 'exec',
      mbean: 'org.apache.karaf:type=bundle',
      operation: 'update(java.lang.String,java.lang.String)',
      arguments: [
        '50',
        'value',
      ],
    }, viewer);
    expect(result2.allowed).toBe(false);
  });
});

describe('intercept', function () {
  it('should intercept RBAC MBean search requests', function () {
    const result = rbac.intercept(
      {
        type: 'search',
        mbean: '*:type=security,area=jmx,*'
      },
      admin, listMBeans);
    expect(result.intercepted).toBe(true);
    expect(result.response.value).toEqual(['hawtio:type=security,area=jmx,name=HawtioOnlineRBAC']);
  });

  it('should intercept single canInvoke requests on RBAC MBean', function () {
    const result = rbac.intercept(
      {
        type: 'exec',
        mbean: 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
        operation: 'canInvoke(java.lang.String)',
        arguments: ['java.lang:type=Memory']
      },
      admin, listMBeans);
    expect(result.intercepted).toBe(true);
    // canInvoke should be true
    expect(result.response.value).toBe(true);
  });

  it('should intercept bulk canInvoke requests on RBAC MBean', function () {
    const result = rbac.intercept(
      {
        type: 'exec',
        mbean: 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
        operation: 'canInvoke(java.util.Map)',
        'arguments': [
          {
            'java.lang:type=Memory': [
              'gc()',
            ],
            'org.apache.camel:context=io.fabric8.quickstarts.karaf-camel-log-log-example-context,name="log-example-context",type=context': [
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
      admin, listMBeans);
    expect(result.intercepted).toBe(true);
    expect(result.response.value).toBeDefined();
    // canInvoke should be ???
  });

  it('should intercept RBACRegistry list requests', function () {
    const result = rbac.intercept(
      {
        type: 'list',
        path: 'hawtio/type=security,name=RBACRegistry',
      },
      admin, listMBeans);
    expect(result.intercepted).toBe(true);
    expect(result.response.value.op).toBeDefined();
  });

  it('should intercept optimised list MBeans requests', function () {
    const result = rbac.intercept(
      {
        type: 'exec',
        mbean: 'hawtio:type=security,name=RBACRegistry',
        operation: 'list()',
      },
      admin, listMBeans);
    expect(result.intercepted).toBe(true);
    expect(result.response.value).toBeDefined();
  });

  it('should not intercept other requests', function () {
    const result = rbac.intercept(
      {
        type: 'exec',
        mbean: 'java.lang.Memory',
        operation: 'gc()',
      },
      admin, listMBeans);
    expect(result.intercepted).toBe(false);
    expect(result.response).toBeUndefined();
  });
});

describe('optimisedMBeans', function () {
  it('should optimise MBean list', function () {
    const result = rbac.testing.optimisedMBeans(listMBeans, admin);

    // cache
    expect(result.cache).toBeDefined();
    expect(result.cache).not.toEqual({});
    Object.entries(result.cache).forEach(info => {
      expect(info[1].canInvoke).toBe(true);
      if (info[1].op) {
        Object.entries(info[1].op).forEach(op => {
          var sigs = Array.isArray(op[1]) ? op[1] : [op[1]];
          sigs.forEach(sig => {
            expect(sig.canInvoke).toBe(true);
          });
        });
        expect(info[1].opByString).toBeDefined();
        expect(info[1].opByString).not.toEqual({});
      }
    });

    // domains
    expect(result.domains).toBeDefined();
    expect(result.domains).not.toEqual({});
    Object.entries(result.domains).forEach(domain => {
      Object.entries(domain[1]).forEach(info => {
        if (typeof info[1] === 'string') {
          expect(result.cache[info[1]]).toBeDefined();
        } else {
          expect(info[1].canInvoke).toBe(true);
        }
        if (info[1].op) {
          Object.entries(info[1].op).forEach(op => {
            var sigs = Array.isArray(op[1]) ? op[1] : [op[1]];
            sigs.forEach(sig => {
              expect(sig.canInvoke).toBe(true);
            });
          });
          expect(info[1].opByString).toBeDefined();
          expect(info[1].opByString).not.toEqual({});
        }
      });
    });

  });
});

describe('parseProperties', function () {
  it('should parse properties as object', function () {
    expect(rbac.testing.parseProperties('context=MyCamel,name=\"simple-route\",type=routes')).toEqual({
      context: 'MyCamel',
      name: '\"simple-route\"',
      type: 'routes',
    });
    expect(rbac.testing.parseProperties('name=PS Old Gen,type=MemoryPool')).toEqual({
      name: 'PS Old Gen',
      type: 'MemoryPool',
    });
    expect(rbac.testing.parseProperties('type=Memory')).toEqual({
      type: 'Memory'
    });
  });
});
