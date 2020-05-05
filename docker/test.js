import gateway from 'nginx.js';

var fs = require('fs');

var listMBeans = fs.readFileSync('test.listMBeans.json');

function requestWithViewerRoleTest() {
  return gateway.proxyJolokiaAgent({
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      type: 'exec',
      mbean: 'org.apache.camel:type=context',
      operation: 'dumpRoutesAsXml()',
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    return: (code, message) => {
      console.log('code:', code, 'message:', message);
    },
  });
}

function bulkRequestWithViewerRoleTest() {
  return gateway.proxyJolokiaAgent({
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify([
      {
        type: 'exec',
        mbean: 'org.apache.camel:type=context',
        operation: 'dumpRoutesAsXml()',
      },
      {
        type: 'exec',
        mbean: 'java.lang.Memory',
        operation: 'gc()',
      },
    ]),
    headersOut: {},
    subrequest: doWithViewerRole,
    return: (code, message) => {
      console.log('code:', code, 'message:', message);
    },
  });
}

function requestOperationWithArgumentsAndNoRoleTest() {
  return gateway.proxyJolokiaAgent({
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
    return: (code, message) => {
      console.log('code:', code, 'message:', message);
    },
  });
}

function requestOperationWithArgumentsAndViewerRoleTest() {
  return gateway.proxyJolokiaAgent({
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
    return: (code, message) => {
      console.log('code:', code, 'message:', message);
    },
  });
}

function searchCamelRoutesTest() {
  return gateway.proxyJolokiaAgent({
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      type: 'search',
      mbean: 'org.apache.camel:context=*,type=routes,*',
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    return: (code, message) => {
      console.log('code:', code, 'message:', message);
    },
  });
}

function searchRbacMBeanTest() {
  return gateway.proxyJolokiaAgent({
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      type: 'search',
      mbean: '*:type=security,area=jmx,*',
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    return: (code, message) => {
      console.log('code:', code, 'message:', message);
    },
  });
}

function bulkRequestWithInterceptionTest() {
  return gateway.proxyJolokiaAgent({
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify([
      {
        type: 'search',
        mbean: '*:type=security,area=jmx,*',
      },
      {
        type: 'exec',
        mbean: 'java.lang.Memory',
        operation: 'gc()',
      },
      {
        type: 'search',
        mbean: 'org.apache.camel:context=*,type=routes,*',
      },
    ]),
    headersOut: {},
    subrequest: doWithViewerRole,
    return: (code, message) => {
      console.log('code:', code, 'message:', message);
    },
  });
}

function canInvokeSingleOperationTest() {
  return gateway.proxyJolokiaAgent({
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      'type': 'exec',
      'mbean': 'hawtio:area=jmx,type=security',
      'operation': 'canInvoke(java.lang.String)',
      'arguments': [
        // 'java.lang:name=Compressed Class Space,type=MemoryPool',
        'org.apache.camel:context=MyCamel,name="simple-route",type=routes',
      ]
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    return: (code, message) => {
      console.log('code:', code, 'message:', message);
    },
  });
}

function canInvokeSingleAttributeTest() {
  return gateway.proxyJolokiaAgent({
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      'type': 'exec',
      'mbean': 'hawtio:area=jmx,type=security',
      'operation': 'canInvoke(java.lang.String)',
      'arguments': [
        // 'java.lang:name=PS Scavenge,type=GarbageCollector',
        'java.lang:name=PS Old Gen,type=MemoryPool',
      ]
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    return: (code, message) => {
      console.log('code:', code, 'message:', message);
    },
  });
}

function canInvokeMapTest() {
  return gateway.proxyJolokiaAgent({
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      'type': 'exec',
      'mbean': 'hawtio:area=jmx,type=security',
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
    return: (code, message) => {
      console.log('code:', code, 'message:', message);
    },
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
