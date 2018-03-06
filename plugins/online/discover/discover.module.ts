/// <reference path="discover.controller.ts"/>
/// <reference path="match-height.directive.ts"/>
/// <reference path="../labels/labels.module.ts"/>
/// <reference path="../status/status.module.ts"/>

namespace Online {

  declare const jsonpath: any;
  declare const KubernetesAPI: any;

  export const discoverModule = angular
    .module('hawtio-online-discover', [
      'angularMoment',
      'KubernetesAPI',
      'patternfly',
      labelsModule.name,
      statusModule.name,
    ])
    .controller('DiscoverController', DiscoverController)
    .directive('matchHeight', ['$timeout', $timeout => new MatchHeightDirective($timeout)]);

  hawtioPluginLoader.addModule(discoverModule.name);

  // Expose jsonpath as constant for injection
  discoverModule.constant('jsonpath', jsonpath);

  discoverModule.filter('jolokiaContainers',
  () => containers => containers.filter(container => container.ports.some(port => port.name === 'jolokia')))
  .filter('jolokiaPort',
    () => container => container.ports.find(port => port.name === 'jolokia'))
  .filter('connectUrl', ['userDetails', userDetails => (pod, port = 8778) => new URI().path('/integration/')
    .hash(userDetails.token || '')
    .query({
      jolokiaUrl : new URI()
        .path(`/master/api/v1/namespaces/${pod.metadata.namespace}/pods/https:${pod.metadata.name}:${port}/proxy/jolokia/`),
      title     : pod.metadata.name,
      returnTo  : new URI().toString(),
    })])
  .filter('podDetailsUrl', () => pod => UrlHelpers.join(Core.pathGet(window, ['OPENSHIFT_CONFIG', 'openshift', 'master_uri']) || KubernetesAPI.masterUrl, 'console/project', pod.metadata.namespace, 'browse/pods', pod.metadata.name));
}