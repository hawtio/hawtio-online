//TODO: find a way to load main file
// https://github.com/nginx/njs/issues/115
import proxyJolokiaAgent from './nginx.js'

function requestWithViewerRoleTest() {
  proxyJolokiaAgent({
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify({
      mbean: 'org.apache.camel:type=context',
      operation: 'dumpRoutesAsXml',
    }),
    headersOut: {},
    subrequest: doWithViewerRole,
    return: (code, message) => {
      console.log('code:', code, 'message:', message);
    },
  });
}

function batchRequestWithViewerRoleTest() {
  proxyJolokiaAgent({
    uri: '/management/namespaces/test/pods/https:pod:443/remaining',
    requestBody: JSON.stringify([
      {
        mbean: 'org.apache.camel:type=context',
        operation: 'dumpRoutesAsXml',
      },
      {
        mbean: 'java.lang.Memory',
        operation: 'gc',
      },
    ]),
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
  if (!res) {
    return Promise.reject(Error(`No stub for ${uri}`));
  }
  Object.assign(res, {
    headersOut: {},
  });
  return Promise.resolve(res);
}

requestWithViewerRoleTest();
batchRequestWithViewerRoleTest();
