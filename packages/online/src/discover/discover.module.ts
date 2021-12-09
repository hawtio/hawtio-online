/// <reference path="discover.controller.ts"/>
/// <reference path="../labels/labels.module.ts"/>

namespace Online {

  export enum ViewType {
    listView = 'listView',
    cardView = 'cardView',
  }

  export const discoverModule = angular
    .module('hawtio-online-discover', [
      'angularMoment',
      'patternfly',
      KubernetesAPI.pluginName,
      labelsModule,
      statusModule,
    ])
    .controller('DiscoverController', DiscoverController)
    .directive('podListRow', podDirective(ViewType.listView, 'src/discover/podListRow.html'))
    .directive('listRowExpand', expansionDirective)
    .directive('podCard', podDirective(ViewType.cardView, 'src/discover/podCard.html'))
    .directive('matchHeight', matchHeightDirective)
    .directive('httpSrc', httpSrcDirective)
    .filter('jolokiaContainers', jolokiaContainersFilter)
    .filter('jolokiaPort', jolokiaPortFilter)
    .filter('connectUrl', connectUrlFilter)
    .filter('podDetailsUrl', podDetailsUrlFilter)
    .name;


  function podDirective(viewType: ViewType, templateUrl: string) {
    return function podDirective($window: ng.IWindowService, openShiftConsole: ConsoleService) {
      'ngInject';
      return {
        restrict: 'EA',
        templateUrl: templateUrl,
        scope: {
          pod: '=',
        },
        link: function ($scope: ng.IScope | any) {
          if (openShiftConsole.enabled) {
            openShiftConsole.url.then(url => $scope.openshiftConsoleUrl = url);
          }
          $scope.getStatusClasses = (pod, status) => getPodClasses(pod, { status, viewType });
          $scope.open = (url) => {
            $window.open(url);
            return true;
          };
        },
      };
    };
  }

  function expansionDirective() {
    return new ListRowExpandDirective();
  }

  function matchHeightDirective($timeout: ng.ITimeoutService) {
    'ngInject';
    return new MatchHeightDirective($timeout);
  }

  function httpSrcDirective($http: ng.IHttpService) {
    'ngInject';
    return new HttpSrcDirective($http);
  }

  function jolokiaContainersFilter() {
    return containers => (containers || []).filter(container => container.ports.some(port => port.name === 'jolokia'));
  }

  function jolokiaPortFilter() {
    return container => container.ports.find(port => port.name === 'jolokia');
  }

  function connectUrlFilter() {
    return (pod, port = 8778) => {
      const jolokiaPath = getManagementJolokiaPath(pod, port);
      return new URI().path('/integration/')
        .query({
          jolokiaUrl: new URI().query('').path(jolokiaPath),
          title: pod.metadata.name,
          returnTo: new URI().toString(),
        });
    };
  }

  function podDetailsUrlFilter() {
    return (pod, openShiftConsoleUrl: string) => UrlHelpers.join(openShiftConsoleUrl, 'project', pod.metadata.namespace, 'browse/pods', pod.metadata.name);
  }

  hawtioPluginLoader.addModule(discoverModule);
}
