/// <reference path="console.service.ts"/>

namespace Online {

  export const openshiftModule = angular
    .module('hawtio-online-openshift', [])
    .service('openShiftConsole', ConsoleService);
}
