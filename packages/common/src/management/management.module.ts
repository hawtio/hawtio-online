/// <reference path="management.service.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online-management', [
      'hawtio-online-openshift',
    ])
    .service('managementService', ManagementService)
    .decorator('openShiftService', decorateOpenShiftService)
    .filter('management', managementFilter);

  function decorateOpenShiftService(
    $delegate: OpenShiftService,
    podStatusFilter,
    $interval,
    ) {
    'ngInject';

    new ManagementService($delegate, podStatusFilter, $interval);
    return $delegate;
  }

  function managementFilter() {
    return (pod, attribute) => Core.pathGet(pod, 'management.' + attribute);
  }
}
