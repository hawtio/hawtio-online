// http://nginx.org/en/docs/njs
// https://github.com/nginx/njs
// https://github.com/xeioex/njs-examples

import RBAC from '/rbac.js';

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
    // Iterate over headersOut properties when it becomes enumerable
    if (res.headersOut) {
      req.headersOut['Content-Type'] = res.headersOut['Content-Type'];
      req.headersOut['Content-Length'] = res.headersOut['Content-Length'];
      req.headersOut['Cache-Control'] = res.headersOut['Cache-Control'];
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

  function selfLocalSubjectAccessReview(verb) {
    // Work-around same-location sub-requests caching issue
    return req.subrequest(`/authorization${verb === 'get' ? '2' : ''}/namespaces/${namespace}/localsubjectaccessreviews`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'LocalSubjectAccessReview',
        apiVersion: 'authorization.openshift.io/v1',
        namespace: namespace,
        verb: verb,
        resource: 'pods',
        name: pod,
      }),
    });
  }

  function getPodIP() {
    return req.subrequest(`/podIP/${namespace}/${pod}`, { method: 'GET' }).then(res => {
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

  return selfLocalSubjectAccessReview('update')
    .then(function (res) {
      if (res.status !== 201) {
        return Promise.reject(res);
      }
      var sar = JSON.parse(res.responseBody);
      if (sar.allowed) {
        // map the 'update' verb to the 'admin' role
        return 'admin';
      }
      return selfLocalSubjectAccessReview('get')
        .then(function (res) {
          if (res.status !== 201) {
            return Promise.reject(res);
          }
          sar = JSON.parse(res.responseBody);
          if (sar.allowed) {
            // map the 'get' verb to the 'viewer' role
            return 'viewer';
          }
          return reject(403, JSON.stringify(sar));
        })
    })
    .then(function (role) {
      var request = JSON.parse(req.requestBody);
      var requireMBeanDefinition;
      if (Array.isArray(request)) {
        requireMBeanDefinition = request.find(r => RBAC.isCanInvokeRequest(r));
        return getPodIP().then(function (podIP) {
          return (requireMBeanDefinition ? listMBeans(podIP) : Promise.resolve()).then(beans => {
            var rbac = request.map(r => RBAC.check(r, role));
            var intercept = request.filter((_, i) => rbac[i].allowed).map(r => RBAC.intercept(r, role, beans));
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
          })
        });
      } else {
        requireMBeanDefinition = RBAC.isCanInvokeRequest(request);
        return getPodIP().then(podIP => {
          return (requireMBeanDefinition ? listMBeans(podIP) : Promise.resolve()).then(beans => {
            var rbac = RBAC.check(request, role);
            if (!rbac.allowed) {
              return reject(403, rbac.reason);
            }
            rbac = RBAC.intercept(request, role, beans);
            if (rbac.intercepted) {
              return Promise.resolve({ status: rbac.response.status, responseBody: JSON.stringify(rbac.response) });
            }
            return callJolokiaAgent(podIP, req.requestBody);
          })
        });
      }
    })
    .then(response)
    .catch(function (error) {
      if (error.status) {
        response(error);
      } else {
        req.return(502, error);
      }
    });
}
