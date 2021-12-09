/// <reference path="navigation.component.ts"/>
/// <reference path="navigation.config.ts"/>
/// <reference path="navigation.service.ts"/>

namespace Online {

  export const integrationNavigationModule = angular
    .module('hawtio-online-integration-navigation', [
      statusModule,
      openshiftModule
    ])
    .config(configureRoutes)
    .run(addContextSelector)
    .run(addHeaderTools)
    .service('navigationService', NavigationService)
    .component('navigation', navigationComponent)
    .name;

}
