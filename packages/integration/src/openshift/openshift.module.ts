/// <reference path="pods.service.ts"/>

namespace Online {

  export const openshiftModule = angular
    .module('hawtio-online-integration-openshift', [])
    .service('pods', PodsService);
}
