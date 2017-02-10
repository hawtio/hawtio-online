/// <reference path="../../includes.ts"/>
/// <reference path="openshiftPlugin.ts"/>

module Openshift {

  import K8SClientFactory = KubernetesAPI.K8SClientFactory;

  _module.controller('Openshift.DiscoverController',
    ['$scope', '$location', '$element', 'K8SClientFactory', 'jsonpath', 'userDetails',
      ($scope, $location, $element, client: K8SClientFactory, jsonpath, userDetails) => {

        $scope.pods = [];

        const kubernetes = client.create('pods');
        const handle     = kubernetes.watch(pods => {
          $scope.pods.length = 0;
          $scope.pods.push(..._.filter(pods, pod => jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0));
          // have to kick off a $digest here
          $scope.$apply();
        });

        // client instances to an object collection are shared, important to use
        // the factory to destroy instances and avoid leaking memory
        $element.on('$destroy', _ => $scope.$destroy());
        $scope.$on('$destroy', _ => K8SClientFactory.destroy(kubernetes, handle));

        $scope.config = {
          selectItems       : false,
          multiSelect       : false,
          dblClick          : false,
          dragEnabled       : false,
          selectionMatchProp: 'name',
          selectedItems     : [],
          showSelectBox     : true,
          useExpandingRows  : false
        };

        const connect = (action, pod) => {
          const jolokiaUrl = new URI(KubernetesAPI.masterUrl).segment('api/v1/namespaces')
            .segment(pod.metadata.namespace)
            .segment('pods')
            .segment(`https:${pod.metadata.name}:8778`)
            .segment('proxy/jolokia');
          const connectUrl = new URI().path('/jmx');
          const returnTo   = new URI().toString();
          const title      = pod.metadata.name || 'Untitled Container';
          const token      = userDetails.token || '';
          connectUrl.hash(token).query({
            jolokiaUrl: jolokiaUrl,
            title     : title,
            returnTo  : returnTo
          });
          window.open(connectUrl.toString());
        };

        $scope.actions = [
          {
            name    : 'Connect',
            class   : 'btn-primary',
            title   : 'Open the JVM console',
            actionFn: connect
          },
        ];

        kubernetes.connect();
      }]);
}
