// http://nginx.org/en/docs/njs
// https://github.com/nginx/njs
// https://github.com/xeioex/njs-examples

import RBAC from 'rbac.js';
import jsyaml from 'js-yaml.js';
import jwt_decode from 'jwt-decode.js';

var fs = require('fs');

RBAC.initACL(jsyaml.safeLoad(fs.readFileSync(process.env['HAWTIO_ONLINE_RBAC_ACL'] || 'ACL.yaml')));

var isRbacEnabled = typeof process.env['HAWTIO_ONLINE_RBAC_ACL'] !== 'undefined';
var useForm = process.env['HAWTIO_ONLINE_AUTH'] === 'form';

export default { proxyJolokiaAgent };

// Only Jolokia requests using the POST method are currently supported,
// as this is more comprehensive and it's what the front-end uses.
// Still, we may want to support GET requests as well, by adapting the inputs.
function proxyJolokiaAgent(req) {
  var parts = req.uri.match(/\/management\/namespaces\/(.+)\/pods\/(http|https):(.+):(\d+)\/(.*)/);
  if (!parts) {
    req.return(404);
    return;
  }
  var namespace = parts[1];
  var protocol = parts[2];
  var pod = parts[3];
  var port = parts[4];
  var path = parts[5];

  function response(res) {
    req.log(`response: status=${res.status}`);

    for (var header in res.headersOut) {
      req.headersOut[header] = res.headersOut[header];
    }
    req.return(res.status, res.responseBody);
  }

  function reject(status, message) {
    return Promise.reject({
      status: status,
      responseBody: message,
      headersOut: {
        'Content-Type': 'application/json',
      }
    });
  }

  function getSubjectFromJwt() {
    var authz = req.headersIn['Authorization'];
    if (!authz) {
      req.error('Authorization header not found in request');
      return '';
    }
    var token = authz.split(' ')[1];
    var payload = jwt_decode(token);
    return payload.sub;
  }

  function selfLocalSubjectAccessReview(verb) {
    var api;
    var body;
    // When form is used, don't rely on OpenShift-specific LocalSubjectAccessReview
    if (useForm) {
      api = "authorization.k8s.io";
      body = {
        kind: 'LocalSubjectAccessReview',
        apiVersion: 'authorization.k8s.io/v1',
        metadata: {
          namespace: namespace,
        },
        spec: {
          user: getSubjectFromJwt(),
          resourceAttributes: {
            verb: verb,
            resource: 'pods',
            name: pod,
            namespace: namespace,
          }
        }
      };
    } else {
      api = "authorization.openshift.io";
      body = {
        kind: 'LocalSubjectAccessReview',
        apiVersion: 'authorization.openshift.io/v1',
        namespace: namespace,
        verb: verb,
        resource: 'pods',
        name: pod,
      };
    }
    var json = JSON.stringify(body);
    req.log(`selfLocalSubjectAccessReview(${verb}): ${api} - ${json}`);

    // Work-around same-location sub-requests caching issue
    var suffix = verb === 'get' ? '2' : '';
    return req.subrequest(`/authorization${suffix}/${api}/namespaces/${namespace}/localsubjectaccessreviews`, {
      method: 'POST',
      body: json,
    });
  }

  function getPodIP() {
    return req.subrequest(`/podIP/${namespace}/${pod}`, { method: 'GET' }).then(res => {
      req.log(`getPodIP(${namespace}/${pod}): status=${res.status}`);

      if (res.status !== 200) {
        return Promise.reject(res);
      }
      return JSON.parse(res.responseBody).status.podIP;
    });
  }

  // This is usually called once upon the front-end loads, still we may want to cache it
  function listMBeans(podIP) {
    return req.subrequest(`/proxy/${protocol}:${podIP}:${port}/${path}`, { method: 'POST', body: JSON.stringify({ type: 'list' }) }).then(res => {
      if (res.status !== 200) {
        return Promise.reject(res);
      }
      return JSON.parse(res.responseBody).value;
    });
  }

  function callJolokiaAgent(podIP, request) {
    return req.subrequest(`/proxy/${protocol}:${podIP}:${port}/${path}`, { method: req.method, body: request });
  }

  function proxyJolokiaAgentWithoutRbac() {
    // Only requests impersonating a user granted the `update` verb on for the pod
    // hosting the Jolokia endpoint is authorized
    return selfLocalSubjectAccessReview('update')
      .then(res => {
        req.log(`proxyJolokiaAgentWithoutRbac(update): status=${res.status}`);

        if (res.status !== 201) {
          return Promise.reject(res);
        }
        var sar = JSON.parse(res.responseBody);
        var allowed = useForm ? sar.status.allowed : sar.allowed;
        if (!allowed) {
          return reject(403, JSON.stringify(sar));
        }
        return getPodIP().then(podIP => {
          req.log(`proxyJolokiaAgentWithoutRbac(podIP): podIP=${podIP}`);
          return callJolokiaAgent(podIP, req.requestBody);
        });
      });
  }

  function proxyJolokiaAgentWithRbac() {
    return selfLocalSubjectAccessReview('update')
      .then(res => {
        req.log(`proxyJolokiaAgentWithRbac(update): status=${res.status}`);

        if (res.status !== 201) {
          return Promise.reject(res);
        }
        var sar = JSON.parse(res.responseBody);
        var allowed = useForm ? sar.status.allowed : sar.allowed;
        if (allowed) {
          // map the `update` verb to the `admin` role
          return 'admin';
        }
        return selfLocalSubjectAccessReview('get')
          .then(res => {
            req.log(`proxyJolokiaAgentWithRbac(get): status=${res.status}`);

            if (res.status !== 201) {
              return Promise.reject(res);
            }
            sar = JSON.parse(res.responseBody);
            allowed = useForm ? sar.status.allowed : sar.allowed;
            if (allowed) {
              // map the `get` verb to the `viewer` role
              return 'viewer';
            }
            return reject(403, JSON.stringify(sar));
          });
      })
      .then(role => {
        var request = JSON.parse(req.requestBody);
        var mbeanListRequired;
        if (Array.isArray(request)) {
          mbeanListRequired = request.find(r => RBAC.isMBeanListRequired(r));
          return getPodIP().then(podIP => {
            return (mbeanListRequired ? listMBeans(podIP) : Promise.resolve()).then(mbeans => {
              var rbac = request.map(r => RBAC.check(r, role));
              var intercept = request.filter((_, i) => rbac[i].allowed).map(r => RBAC.intercept(r, role, mbeans));
              return callJolokiaAgent(podIP, JSON.stringify(intercept.filter(i => !i.intercepted).map(i => i.request))).then(jolokia => {
                var body = JSON.parse(jolokia.responseBody);
                // Unroll intercepted requests
                var bulk = intercept.reduce((res, rbac, i) => {
                  if (rbac.intercepted) {
                    res.push(rbac.response);
                  } else {
                    res.push(body.splice(0, 1)[0]);
                  }
                  return res;
                }, []);
                // Unroll denied requests
                bulk = rbac.reduce((res, rbac, i) => {
                  if (rbac.allowed) {
                    res.push(bulk.splice(0, 1)[0]);
                  } else {
                    res.push({
                      request: request[i],
                      status: 403,
                      reason: rbac.reason,
                    });
                  }
                  return res;
                }, []);
                // Re-assembled bulk response
                var response = {
                  status: jolokia.status,
                  responseBody: JSON.stringify(bulk),
                  headersOut: jolokia.headersOut,
                };
                // Override the content length that changed while re-assembling the bulk response
                response.headersOut['Content-Length'] = response.responseBody.length;
                return response;
              });
            });
          });
        } else {
          mbeanListRequired = RBAC.isMBeanListRequired(request);
          return getPodIP().then(podIP => {
            return (mbeanListRequired ? listMBeans(podIP) : Promise.resolve()).then(mbeans => {
              var rbac = RBAC.check(request, role);
              if (!rbac.allowed) {
                return reject(403, rbac.reason);
              }
              rbac = RBAC.intercept(request, role, mbeans);
              if (rbac.intercepted) {
                return Promise.resolve({ status: rbac.response.status, responseBody: JSON.stringify(rbac.response) });
              }
              return callJolokiaAgent(podIP, req.requestBody);
            });
          });
        }
      });
  }

  return (isRbacEnabled ? proxyJolokiaAgentWithRbac() : proxyJolokiaAgentWithoutRbac())
    .then(response)
    .catch(error => {
      if (error.status) {
        response(error);
      } else {
        req.return(502, error);
      }
    });
}
