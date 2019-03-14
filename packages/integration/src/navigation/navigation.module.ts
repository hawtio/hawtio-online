/// <reference path="navigation.component.ts"/>
/// <reference path="navigation.config.ts"/>
/// <reference path="navigation.service.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online-integration-navigation', [
      'hawtio-online-status',
      'hawtio-online-openshift',
    ])
    .config(configureRoutes)
    .run(addContextSelector)
    .run(addHeaderTools)
    .service('navigationService', NavigationService)
    .component('navigation', navigationComponent);

}