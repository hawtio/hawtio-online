/// <reference path="openshift.service.ts"/>

namespace Online {

  const openshiftModule = angular
    .module('hawtio-online-integration-openshift', [])
    .service('openshift', OpenShiftService);
}
