// This test file can be run using the NJS CLI.
// The test result depends on the HAWTIO_ONLINE_RBAC_ACL environment variable.
// To test with RBAC enabled:
// HAWTIO_ONLINE_RBAC_ACL= njs test.js

import gateway from 'nginx.js';

var fs = require('fs');

var listMBeans = fs.readFileSync('test.listMBeans.json');

function report(code, expectedCode, message) {
  console.log('code:', code);
  console.log('expected-code:', expectedCode);
  console.log('message:', message, "\n");

  if (code !== expectedCode) {
    throw new Error(`Failure: Return status code ${code} does not match expected ${expectedCode}`);
  }
}

/* === Jolokia Gateway === */

function callJolokiaGateway(input) {
  var options = {
    return: (code, message) => {
      report(code, input.expectedCode, message);
    },
    log: (message) => {
      console.log(message);
    }
  }

  var payload = Object.assign(input, options);
  return gateway.proxyJolokiaAgent(payload);
}

function requestWithViewerRoleTest() {
  console.log('=== requestWithViewerRoleTest');
  return callJolokiaGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      type: 'exec',
      mbean: 'org.apache.camel:type=context',
      operation: 'dumpRoutesAsXml()',
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    expectedCode: 200
  });
}

function bulkRequestWithViewerRoleTest() {
  console.log('=== bulkRequestWithViewerRoleTest');
  return callJolokiaGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify([
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
    subrequest: doWithViewerRole,
    expectedCode: 200
  });
}

function requestOperationWithArgumentsAndNoRoleTest() {
  console.log('=== requestOperationWithArgumentsAndNoRoleTest');
  return callJolokiaGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      type: 'exec',
      mbean: 'org.apache.karaf:type=bundle',
      operation: 'uninstall(java.lang.String)',
      arguments: [
        '0',
      ],
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    expectedCode: 403 // viewer not allowed to uninstall
  });
}

function requestOperationWithArgumentsAndViewerRoleTest() {
  console.log('=== requestOperationWithArgumentsAndViewerRoleTest');
  return callJolokiaGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      type: 'exec',
      mbean: 'org.apache.karaf:type=bundle',
      operation: 'update(java.lang.String,java.lang.String)',
      arguments: [
        '50',
        'value',
      ],
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    expectedCode: 403 // viewer not allowed to exec an operation
  });
}

function searchCamelRoutesTest() {
  console.log('=== searchCamelRoutesTest');
  return callJolokiaGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      type: 'search',
      mbean: 'org.apache.camel:context=*,type=routes,*',
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    expectedCode: 200
  });
}

function searchRbacMBeanTest() {
  console.log('=== searchRbacMBeanTest');
  return callJolokiaGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      type: 'search',
      mbean: '*:type=security,area=jmx,*',
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    expectedCode: 200
  });
}

function bulkRequestWithInterceptionTest() {
  console.log('=== bulkRequestWithInterceptionTest');
  return callJolokiaGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify([
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
    subrequest: doWithViewerRole,
    expectedCode: 200
  });
}

function canInvokeSingleOperationTest() {
  console.log('=== canInvokeSingleOperationTest');
  return callJolokiaGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      'type': 'exec',
      'mbean': 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
      'operation': 'canInvoke(java.lang.String)',
      'arguments': [
        // 'java.lang:name=Compressed Class Space,type=MemoryPool',
        'org.apache.camel:context=MyCamel,name="simple-route",type=routes',
      ]
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    expectedCode: 200
  });
}

function canInvokeSingleAttributeTest() {
  console.log('=== canInvokeSingleAttributeTest');
  return callJolokiaGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      'type': 'exec',
      'mbean': 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
      'operation': 'canInvoke(java.lang.String)',
      'arguments': [
        // 'java.lang:name=PS Scavenge,type=GarbageCollector',
        'java.lang:name=PS Old Gen,type=MemoryPool',
      ]
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    expectedCode: 200
  });
}

function canInvokeMapTest() {
  console.log('=== canInvokeMapTest');
  return callJolokiaGateway({
    method: 'POST',
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
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
    subrequest: doWithViewerRole,
    expectedCode: 200
  });
}

function doWithViewerRole(uri, options) {
  var body = JSON.parse(options.body || '{}');
  var res;
  if (uri.startsWith('/authorization') && body.verb === 'update') {
    res = {
      status: 201,
      responseBody: JSON.stringify({
        allowed: false,
      }),
    };
  }
  if (uri.startsWith('/authorization') && body.verb === 'get') {
    res = {
      status: 201,
      responseBody: JSON.stringify({
        allowed: true,
      }),
    };
  }
  if (uri.startsWith('/podIP')) {
    res = {
      status: 200,
      responseBody: JSON.stringify({
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
        responseBody: listMBeans,
      };
    } else {
      res = {
        status: 200,
        responseBody: JSON.stringify(Array.isArray(body)
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

/* === Master Gateway === */

function callMasterGateway(input) {
  /*
   * Separate out the args from the uri as per real Request specification
   */
  var is_args = input.uri.includes('?');
  var args = is_args ? input.uri.substring(input.uri.indexOf('?') + 1, input.uri.length) : '';
  input.uri = is_args ? input.uri.substring(0, input.uri.indexOf('?')) : input.uri;

  var options = {
    return: (code, message) => {
      report(code, input.expectedCode, message);
    },
    log: (message) => {
      console.log(message);
    },
    headersOut: {},
    variables: {
      is_args: is_args,
      args: args
    },
    internalRedirect: (uri) => {
      console.log(`redirected-uri: ${uri}`, "\n");

      if (input.expectedURI !== uri)
        throw new Error(`Failure: Redirect uri ${uri} does not match expected uri ${input.expectedURI}`);
    }
  }

  var payload = Object.assign(input, options);
  gateway.proxyMasterGuard(payload);
}

function canMasterAuthServerMetadataTest() {
  console.log('=== canMasterAuthServerMetadataTest');

  return callMasterGateway({
    method: 'GET',
    uri: '/master/.well-known/oauth-authorization-server',
    expectedURI: '/masterinternal/.well-known/oauth-authorization-server',
    expectedCode: 200
  });
}

function canMasterApiPodsTest() {
  console.log('=== canMasterApiPodsTest');

  callMasterGateway({
    method: 'GET',
    uri: '/master/api/v1/namespaces/hawtio/pods?watch=true',
    expectedURI: '/masterinternal/api/v1/namespaces/hawtio/pods?watch=true',
    expectedCode: 200
  });
}

/* Should be illegal - guard should stop it and return a 502 */
function canMasterApiSecretsTest() {
  console.log('=== canMasterApiSecretsTest');

  return callMasterGateway({
    method: 'GET',
    uri: '/master/api/v1/namespaces/hawtio/secrets',
    expectedCode: 502
  });
}

/* Execute non-promise tests first */
canMasterAuthServerMetadataTest()
canMasterApiPodsTest()
canMasterApiSecretsTest()

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
