/// <reference path="management.service.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online-management', [
      'hawtio-online-openshift',
    ])
    .service('managementService', ManagementService)
    .decorator('openShiftService', decorateOpenShiftService);

  function decorateOpenShiftService($delegate: OpenShiftService) {
    'ngInject';

    new ManagementService($delegate);
    return $delegate;
  }
}
