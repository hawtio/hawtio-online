/// <reference path="management.service.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online-management', [
      'hawtio-online-openshift',
    ])
    .service('managementService', ManagementService)
    .decorator('openShiftService', decorateOpenShiftService);

  function decorateOpenShiftService(
    $delegate: OpenShiftService,
    podStatusFilter,
    $interval,
    ) {
    'ngInject';

    new ManagementService($delegate, podStatusFilter, $interval);
    return $delegate;
  }
}
