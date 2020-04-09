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
    req.headersOut['Content-Type'] = res.headersOut['Content-Type'];
    req.headersOut['Content-Length'] = res.headersOut['Content-Length'];
    req.headersOut['Cache-Control'] = res.headersOut['Cache-Control'];
    req.return(res.status, res.responseBody);
  }

  function selfLocalSubjectAccessReview(verb, then) {
    req.subrequest(`/authorization/namespaces/${namespace}/localsubjectaccessreviews`,
      {
        method: 'POST',
        body: JSON.stringify({
          kind: 'LocalSubjectAccessReview',
          apiVersion: 'authorization.openshift.io/v1',
          namespace: namespace,
          verb: verb,
          resource: 'pods',
          name: pod,
        }),
      },
      then);
  }

  function checkAuthorization(role, then) {
    var body = JSON.parse(req.requestBody);
    if (Array.isArray(body)) {
      // TODO: support batch request
    } else {
      var mbean = body.mbean;
      var i = mbean.indexOf(':');
      var domain = mbean.substring(0, i);
      var properties = mbean.substring(i + 1);
      var regexp = /([^,]+)=([^,]+)+/g;
      var objectName = {};
      var match;
      while ((match = regexp.exec(properties)) !== null) {
        objectName[match[1]] = match[2];
      }

      var jolokia = {
        type: body.type,
        attribute: body.attribute,
        operation: body.operation,
        domain: domain,
        properties: objectName,
      };

      var res = rbac(role, jolokia);
      // console.log(JSON.stringify(res));
      // TODO: should canInvoke operation be handled for seemless compatibility with client-side RBAC plugin?
      if (res.allowed) {
        then();
        return;
      }
      req.return(403, res.reason /* JSON.stringify(rbac) */);
    }
  }

  function getPodIP() {
    req.subrequest(`/podIP/${namespace}/${pod}`, { method: 'GET' },
      function (res) {
        res.status === 200
          ? callJolokiaAgent(JSON.parse(res.responseBody).status.podIP)
          : response(res);
      });
  }

  function callJolokiaAgent(podIP) {
    req.subrequest(`/proxy/${protocol}:${podIP}:${port}/${path}`, { method: req.method, body: req.requestBody }, response);
  }

  selfLocalSubjectAccessReview('update', function (res) {
    if (res.status !== 201) {
      response(res);
      return;
    }

    var sar = JSON.parse(res.responseBody);
    if (sar.allowed) {
      // admin role
      checkAuthorization('admin', getPodIP);
      return;
    }

    selfLocalSubjectAccessReview('get', function (res) {
      if (res.status !== 201) {
        response(res);
        return;
      }

      sar = JSON.parse(res.responseBody);
      if (sar.allowed) {
        // viewer role
        checkAuthorization('viewer', getPodIP);
        return;
      }

      req.return(403, sar.reason);
    });
  });
}
