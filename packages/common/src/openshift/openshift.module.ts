/// <reference path="console.service.ts"/>
/// <reference path="openshift.service.ts"/>

namespace Online {

  angular
    .module('hawtio-online-openshift', [])
    .service('openShiftConsole', ConsoleService)
    .service('openShiftService', OpenShiftService)
    .directive('openshiftLink', openshiftLinkDirective);

  const OS4 = {
    'dc': 'deploymentconfigs',
    'rc': 'replicationcontrollers',
  };

  function openshiftLinkDirective(
    openShiftConsole: ConsoleService,
    openShiftService: OpenShiftService,
    $q: ng.IQService,
  ) {
    'ngInject';
    return {
      restrict: 'EA',
      templateUrl: 'src/openshift/openshiftLink.html',
      transclude: true,
      scope: {
        namespace: '<',
        resources: '<',
        name: '<',
      },
      link: function ($scope: ng.IScope | any) {
        $q.all([openShiftService.getClusterVersion(), openShiftConsole.url])
          .then(([clusterVersion, consoleUrl]) => {
            const major = parseInt((clusterVersion || '3').split('.')[0], 10);
            if (consoleUrl) {
              if (major >= 4) {
                $scope.url = UrlHelpers.join(consoleUrl, 'k8s', 'ns', $scope.namespace, OS4[$scope.resources] || $scope.resources, $scope.name);
              } else {
                $scope.url = UrlHelpers.join(consoleUrl, 'project', $scope.namespace, 'browse', $scope.resources, $scope.name);
              }
            }
          });
      },
    };
  }
}
