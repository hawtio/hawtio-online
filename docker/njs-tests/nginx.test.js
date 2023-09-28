// This test file can be run using the NJS CLI.
// The test result depends on the HAWTIO_ONLINE_RBAC_ACL environment variable.
// To test with RBAC enabled:
//   yarn njs:test

import gateway from '../dist/nginx.js';

var fs = require('fs');

var listMBeans = fs.readFileSync('./test-resources/test.listMBeans.json');

function report(code, message) {
  console.log('code:', code);
  console.log('message:', message, "\n");
}

function callGateway(input) {
  var options = {
    return: (code, message) => {
      report(code, message);
    },
    log: (message) => {
      console.log(message);
    }
  }

  var payload = Object.assign(input, options);
  return gateway.proxyJolokiaAgent(payload);
}

function requestWithViewerRoleTest() {
  console.log("== requestWithViewerRoleTest ==");
  return callGateway({
    uri: '/management/namespaces/test/pods/https:pod:443/jolokia',
    requestText: JSON.stringify({
      type: 'exec',
      mbean: 'org.apache.camel:type=context',
      operation: 'dumpRoutesAsXml()',
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
  });
}

function bulkRequestWithViewerRoleTest() {
  console.log("== bulkRequestWithViewerRoleTest ==");
  return callGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/jolokia',
    requestText: JSON.stringify([
      {
        type: 'exec',
        mbean: 'org.apache.camel:type=context',
        operation: 'dumpRoutesAsXml()',
      },
      {
        type: 'exec',
        mbean: 'java.lang:type=Memory',
        operation: 'gc()',
      },
    ]),
    headersOut: {},
    subrequest: doWithViewerRole
  });
}

function requestOperationWithArgumentsAndNoRoleTest() {
  console.log("== requestOperationWithArgumentsAndNoRoleTest ==");
  return callGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/jolokia',
    requestText: JSON.stringify({
      type: 'exec',
      mbean: 'org.apache.karaf:type=bundle',
      operation: 'uninstall(java.lang.String)',
      arguments: [
        '0',
      ],
    }),
    headersOut: {},
    subrequest: doWithViewerRole
  });
}

function requestOperationWithArgumentsAndViewerRoleTest() {
  console.log("== requestOperationWithArgumentsAndViewerRoleTest ==");
  return callGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/jolokia',
    requestText: JSON.stringify({
      type: 'exec',
      mbean: 'org.apache.karaf:type=bundle',
      operation: 'update(java.lang.String,java.lang.String)',
      arguments: [
        '50',
        'value',
      ],
    }),
    headersOut: {},
    subrequest: doWithViewerRole
  });
}

function searchCamelRoutesTest() {
  console.log("== searchCamelRoutesTest ==");
  return callGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/jolokia',
    requestText: JSON.stringify({
      type: 'search',
      mbean: 'org.apache.camel:context=*,type=routes,*',
    }),
    headersOut: {},
    subrequest: doWithViewerRole
  });
}

function searchRbacMBeanTest() {
  console.log("== searchRbacMBeanTest ==");
  return callGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/jolokia',
    requestText: JSON.stringify({
      type: 'search',
      mbean: '*:type=security,area=jmx,*',
    }),
    headersOut: {},
    subrequest: doWithViewerRole
  });
}

function bulkRequestWithInterceptionTest() {
  console.log("== bulkRequestWithInterceptionTest ==");
  return callGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/jolokia',
    requestText: JSON.stringify([
      {
        type: 'search',
        mbean: '*:type=security,area=jmx,*',
      },
      {
        type: 'exec',
        mbean: 'java.lang:type=Memory',
        operation: 'gc()',
      },
      {
        type: 'search',
        mbean: 'org.apache.camel:context=*,type=routes,*',
      },
    ]),
    headersOut: {},
    subrequest: doWithViewerRole
  });
}

function canInvokeSingleOperationTest() {
  console.log("== canInvokeSingleOperationTest ==");
  return callGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/jolokia',
    requestText: JSON.stringify({
      'type': 'exec',
      'mbean': 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
      'operation': 'canInvoke(java.lang.String)',
      'arguments': [
        // 'java.lang:name=Compressed Class Space,type=MemoryPool',
        'org.apache.camel:context=MyCamel,name="simple-route",type=routes',
      ]
    }),
    headersOut: {},
    subrequest: doWithViewerRole
  });
}

function canInvokeSingleAttributeTest() {
  console.log("== canInvokeSingleAttributeTest ==");
  return callGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/jolokia',
    requestText: JSON.stringify({
      'type': 'exec',
      'mbean': 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
      'operation': 'canInvoke(java.lang.String)',
      'arguments': [
        // 'java.lang:name=PS Scavenge,type=GarbageCollector',
        'java.lang:name=PS Old Gen,type=MemoryPool',
      ]
    }),
    headersOut: {},
    subrequest: doWithViewerRole
  });
}

function canInvokeMapTest() {
  console.log("== canInvokeMapTest ==");
  return callGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/jolokia',
    requestText: JSON.stringify({
      'type': 'exec',
      'mbean': 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
      'operation': 'canInvoke(java.util.Map)',
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
      ]
    }),
    headersOut: {},
    subrequest: doWithViewerRole
  });
}

function doWithViewerRole(uri, options) {
  console.log("== doWithViewerRole ==");
  var body = JSON.parse(options.body || '{}');
  var res;
  if (uri.startsWith('/authorization') && body.verb === 'update') {
    res = {
      status: 201,
      responseText: JSON.stringify({
        allowed: false,
      }),
    };
  }
  if (uri.startsWith('/authorization') && body.verb === 'get') {
    res = {
      status: 201,
      responseText: JSON.stringify({
        allowed: true,
      }),
    };
  }
  if (uri.startsWith('/podIP')) {
    res = {
      status: 200,
      responseText: JSON.stringify({
        status: {
          podIP: '0.0.0.0',
        },
      }),
    };
  }
  if (uri.startsWith('/proxy')) {
    if (body.type === 'list') {
      res = {
        status: 200,
        responseText: listMBeans,
      };
    } else {
      res = {
        status: 200,
        responseText: JSON.stringify(Array.isArray(body)
          ? body.map(b => ({ request: b, status: 200, value: 'VALUE' }))
          : { request: body, status: 200, value: 'VALUE' },
        ),
      }
    };
  }
  if (!res) {
    return Promise.reject(Error(`No stub for ${uri}`));
  }
  Object.assign(res, {
    headersOut: {},
  });
  return Promise.resolve(res);
}

Promise.resolve()
  .then(requestWithViewerRoleTest)
  .then(bulkRequestWithViewerRoleTest)
  .then(requestOperationWithArgumentsAndNoRoleTest)
  .then(requestOperationWithArgumentsAndViewerRoleTest)
  .then(searchCamelRoutesTest)
  .then(searchRbacMBeanTest)
  .then(bulkRequestWithInterceptionTest)
  .then(canInvokeSingleOperationTest)
  .then(canInvokeSingleAttributeTest)
  .then(canInvokeMapTest)
  ;
