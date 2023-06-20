/// <reference path="navigation/navigation.module.ts"/>
/// <reference path="discover/discover.module.ts"/>

namespace Online {

  export const onlineModule = angular
    .module('hawtio-online', [
      navigationModule,
      managementModule,
      About.aboutModule,
    ])
    .config(addRoutes)
    .run(addOnlineTab)
    .run(addLogoutToUserDropdown)
    .run(addProductInfo)
    .run(destroyBeforeUnload)
    .name;

  function addRoutes($routeProvider: angular.route.IRouteProvider) {
    'ngInject';

    $routeProvider
      .when('/online', { redirectTo: '/online/discover' })
      .when('/online/discover', { templateUrl: 'src/discover/discover.html' });
  }

  function addOnlineTab(mainNavService: Nav.MainNavService): void {
    'ngInject';

    mainNavService.addItem({
      title: 'Online',
      href: '/online/discover'
    });
  }

  function addLogoutToUserDropdown(
    HawtioExtension: Core.HawtioExtension,
    $compile: ng.ICompileService,
    authService: Core.AuthService): void {
    'ngInject';

    HawtioExtension.add('hawtio-logout', ($scope) => {
      $scope.authService = authService;
      const template = '<li><a class="pf-c-dropdown__menu-item" href="#" ng-focus="authService.logout()">Logout ({{authService.username}})</a></li>';
      return $compile(template)($scope);
    });
  }

  function addProductInfo(aboutService: About.AboutService) {
    'ngInject';
    aboutService.addProductInfo('Hawtio Online', 'PACKAGE_VERSION_PLACEHOLDER');
  }

  function destroyBeforeUnload($rootScope: ng.IRootScopeService, $window: ng.IWindowService) {
    'ngInject';
    $window.onbeforeunload = () => $rootScope.$destroy();
  }

  hawtioPluginLoader.addModule(onlineModule);

  export const log = Logger.get(onlineModule);
}
