/// <reference path="console.service.ts"/>
/// <reference path="openshift.service.ts"/>

namespace Online {

  angular
    .module('hawtio-online-openshift', [])
    .service('openShiftConsole', ConsoleService)
    .service('openShiftService', OpenShiftService)
    .directive('openshiftLink', openshiftLinkDirective);

  function openshiftLinkDirective(openShiftConsole: ConsoleService) {
    'ngInject';
    return {
      restrict    : 'EA',
      templateUrl : 'src/openshift/openshiftLink.html',
      transclude  : true,
      scope       : {
        path : '<',
      },
      link: function ($scope: ng.IScope | any) {
        openShiftConsole.url.then(openShiftConsoleUrl => {
          if (openShiftConsoleUrl) {
            $scope.url = UrlHelpers.join(openShiftConsoleUrl, $scope.path);
          }
        });
      },
    };
  }
}
