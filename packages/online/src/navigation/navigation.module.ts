/// <reference path="navigation.config.ts"/>

namespace Online {

  export const navigationModule = angular
    .module('hawtio-online-navigation', [
      openshiftModule
    ])
    .run(addHeaderTools)
    .name;

}
