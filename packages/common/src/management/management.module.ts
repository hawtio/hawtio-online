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
    $interval,
    ) {
    'ngInject';

    new ManagementService($delegate, $interval);
    return $delegate;
  }
}
