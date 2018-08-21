/// <reference path="console.service.ts"/>
/// <reference path="openshift.service.ts"/>

namespace Online {

  export const openshiftModule = angular
    .module('hawtio-online-integration-openshift', [])
    .service('openShiftConsole', ConsoleService)
    .service('openshift', OpenShiftService);
}
