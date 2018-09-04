/// <reference path="console.service.ts"/>
/// <reference path="openshift.service.ts"/>

namespace Online {

  export const openshiftModule = angular
    .module('hawtio-online-openshift', [])
    .service('openShiftConsole', ConsoleService)
    .service('openShiftService', OpenShiftService);
}
