/// <reference path="discover.controller.ts"/>
/// <reference path="httpSrc.directive.ts"/>
/// <reference path="match-height.directive.ts"/>
/// <reference path="../labels/labels.module.ts"/>
/// <reference path="../status/status.module.ts"/>

namespace Online {

  export const discoverModule = angular
    .module('hawtio-online-discover', [
      'angularMoment',
      'KubernetesAPI',
      'patternfly',
      labelsModule.name,
      statusModule.name,
    ])
    .controller('DiscoverController', DiscoverController)
    .directive('matchHeight', matchHeightDirective)
    .directive('httpSrc', httpSrcDirective)
    .filter('jolokiaContainers', jolokiaContainersFilter)
    .filter('jolokiaPort', jolokiaPortFilter)
    .filter('connectUrl', connectUrlFilter)
    .filter('podDetailsUrl', podDetailsUrlFilter);

  function matchHeightDirective($timeout: ng.ITimeoutService) {
    'ngInject';
    return new MatchHeightDirective($timeout);
  }

  function httpSrcDirective($http: ng.IHttpService) {
    'ngInject';
    return new HttpSrcDirective($http);
  }

  function jolokiaContainersFilter() {
    return containers => containers.filter(container => container.ports.some(port => port.name === 'jolokia'));
  }

  function jolokiaPortFilter() {
    return container => container.ports.find(port => port.name === 'jolokia');
  }

  function connectUrlFilter() {
    return (pod, port = 8778) => new URI().path('/integration/')
      .query({
        jolokiaUrl : new URI().query('').path(`/master/api/v1/namespaces/${pod.metadata.namespace}/pods/https:${pod.metadata.name}:${port}/proxy/jolokia/`),
        title      : pod.metadata.name,
        returnTo   : new URI().toString(),
      });
  }

  function podDetailsUrlFilter() {
    return (pod, openShiftConsoleUrl: string) => UrlHelpers.join(openShiftConsoleUrl, 'project', pod.metadata.namespace, 'browse/pods', pod.metadata.name);
  }

  hawtioPluginLoader.addModule(discoverModule.name);
}
