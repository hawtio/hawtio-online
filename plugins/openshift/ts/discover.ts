/// <reference path="../../includes.ts"/>
/// <reference path="openshiftPlugin.ts"/>

module Openshift {

  import K8SClientFactory = KubernetesAPI.K8SClientFactory;

  _module.controller('Openshift.DiscoverController',
    ['$scope', '$location', '$element', 'K8SClientFactory', 'jsonpath',
      ($scope, $location, $element, client: K8SClientFactory, jsonpath) => {

        $scope.pods = [];

        const kubernetes = client.create('pods');
        const handle     = kubernetes.watch(pods => {
          $scope.pods = _.filter(pods, pod => jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0);
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

        kubernetes.connect();
      }]);
}
