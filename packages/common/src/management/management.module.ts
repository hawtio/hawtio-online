/// <reference path="management.service.ts"/>
/// <reference path="../openshift/openshift.module.ts"/>

namespace Online {

  export const managementModule = angular
    .module('hawtio-online-management', [
      openshiftModule,
    ])
    .service('managementService', ManagementService)
    .filter('management', managementFilter)
    .name;

  function managementFilter() {
    return (pod, attribute) => Core.pathGet(pod, 'management.' + attribute);
  }
}
