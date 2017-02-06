/// <reference path="../../includes.ts"/>
/// <reference path="openshiftPlugin.ts"/>

module Openshift {

  import KubernetesModelService = Kubernetes.KubernetesModelService;

  _module.controller('Openshift.DiscoverController',
    ['$scope', '$location', 'KubernetesModel',
      ($scope, $location, kubernetes: KubernetesModelService) => {

        console.log(kubernetes.pods);

        $scope.$on('kubernetesModelUpdated', () => {
          console.log('kubernetesModelUpdated');
        });

      }]);
}
