/// <reference path="management.service.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online-management', [
      'hawtio-online-openshift',
    ])
    .service('managementService', ManagementService)
    .filter('management', managementFilter);

  function managementFilter() {
    return (pod, attribute) => Core.pathGet(pod, 'management.' + attribute);
  }
}
