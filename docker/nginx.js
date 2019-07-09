function proxyJolokiaAgent(req) {
  var parts = req.uri.match(/\/management\/namespaces\/(.+)\/pods\/(http|https):(.+):(\d+)\/(.*)/);
  var namespace = parts[1];
  var protocol = parts[2];
  var pod = parts[3];
  var port = parts[4];
  var path = parts[5];

  function response(res) {
    req.return(res.status, res.responseBody);
  }

  function selfLocalSubjectAccessReview() {
    req.subrequest(`/master/apis/authorization.openshift.io/v1/namespaces/${namespace}/localsubjectaccessreviews`,
      {
        method: 'POST',
        body: JSON.stringify({
          kind: 'LocalSubjectAccessReview',
          apiVersion: 'authorization.openshift.io/v1',
          namespace: namespace,
          verb: 'update',
          resource: 'pods',
          name: pod,
        }),
      },
      function (res) {
        res.status === 201
          ? checkAuthorization(JSON.parse(res.responseBody))
          : response(res);
      });
  }

  function checkAuthorization(sar) {
    if (sar.allowed) {
      getPodIP();
    } else {
      req.return(403, sar.reason);
    }
  }

  function getPodIP() {
    req.subrequest(`/master/api/v1/namespaces/${namespace}/pods/${pod}`, { method: 'GET' },
      function (res) {
        res.status === 200
          ? callJolokiaAgent(JSON.parse(res.responseBody).status.podIP)
          : response(res);
      });
  }

  function callJolokiaAgent(podIP) {
    req.subrequest(`/proxy/${protocol}:${podIP}:${port}/${path}`, { method: req.method, body: req.requestBody }, response);
  }

  selfLocalSubjectAccessReview();
}
