//TODO: find a way to load main file
// https://github.com/nginx/njs/issues/115
import proxyJolokiaAgent from './nginx.js'

proxyJolokiaAgent({
  uri: '/management/namespaces/test/pods/https:pod:443/remaining',
  requestBody: JSON.stringify({
    mbean: 'org.apache.camel:type=context',
    operation: 'dumpRoutesAsXml',
  }),
  headersOut: {},
  subrequest: (uri, options, callback) => {
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
      res = {
        status: 404,
        responseBody: `No stub for ${uri}`,
      }
    }
    callback(Object.assign({ headersOut: {} }, res));
  },
  return: (code, message) => {
    console.log('code:', code, 'message:', message);
  },
});
