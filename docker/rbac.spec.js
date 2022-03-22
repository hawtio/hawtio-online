import rbac from './rbac.js';
import yaml from './js-yaml.js';
import * as fs from 'fs';

rbac.initACL(yaml.safeLoad(fs.readFileSync('./docker/ACL.yaml')));
const listMBeans = JSON.parse(fs.readFileSync('./docker/test.listMBeans.json')).value;

describe('intercept', function () {
  it('should intercept RBAC MBean search requests', function () {
    const result = rbac.intercept(
      {
        type: 'search',
        mbean: '*:type=security,area=jmx,*'
      },
      'admin', listMBeans);
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
      'admin', listMBeans);
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
      'admin', listMBeans);
    expect(result.intercepted).toBe(true);
    expect(result.response.value).toBeDefined();
    // canInvoke should be ???
  });

  it('should not intercept other requests', function () {
    const result = rbac.intercept(
      {
        type: 'exec',
        mbean: 'java.lang.Memory',
        operation: 'gc()',
      },
      'admin', listMBeans);
    expect(result.intercepted).toBe(false);
    expect(result.response).toBeUndefined();
  });
});
