// http://nginx.org/en/docs/njs
// https://github.com/nginx/njs
// https://github.com/xeioex/njs-examples

import rbac from '/rbac.js';

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
    });
  }

  function selfLocalSubjectAccessReview(verb) {
    return req.subrequest(`/authorization/namespaces/${namespace}/localsubjectaccessreviews`, {
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

  function checkAuthorization(role, request) {
    var mbean = request.mbean;
    var domain, objectName = {};
    if (mbean) {
      var i = mbean.indexOf(':');
      domain = i === -1 ? mbean : mbean.substring(0, i);
      var properties = mbean.substring(i + 1);
      var regexp = /([^,]+)=([^,]+)+/g;
      var match;
      while ((match = regexp.exec(properties)) !== null) {
        objectName[match[1]] = match[2];
      }
    }
    return rbac(role, {
      type: request.type,
      attribute: request.attribute,
      operation: request.operation,
      domain: domain,
      properties: objectName,
    });
  }

  function getPodIP() {
    return req.subrequest(`/podIP/${namespace}/${pod}`, { method: 'GET' })
      .then(function (res) {
        if (res.status !== 200) {
          return Promise.reject(res);
        }
        return JSON.parse(res.responseBody).status.podIP;
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
          return reject(403, sar.reason);
        })
    })
    .then(function (role) {
      // TODO: process 'canInvoke' operations for seamless compatibility with client-side RBAC plugin
      var request = JSON.parse(req.requestBody);
      if (Array.isArray(request)) {
        var rbac = request.map(r => checkAuthorization(role, r));
        return getPodIP().then(function (podIP) {
          return callJolokiaAgent(podIP, JSON.stringify(request.filter((_, i) => rbac[i].allowed)))
            .then(jolokia => {
              var body = JSON.parse(jolokia.responseBody);
              var bulk = rbac.reduce((res, rbac, i) => {
                if (rbac.allowed) {
                  res.push(body.splice(0, 1)[0]);
                } else {
                  res.push({
                    request: request[i],
                    status: 403,
                    reason: rbac.reason,
                  });
                }
                return res;
              }, []);
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
      } else {
        var rbac = checkAuthorization(role, request);
        if (!rbac.allowed) {
          return reject(403, rbac.reason);
        }
        return getPodIP().then(function (podIP) {
          return callJolokiaAgent(podIP, req.requestBody);
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
