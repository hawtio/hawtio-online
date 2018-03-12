/// <reference path="discover/discover.module.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online', [])
    .config(addRoutes)
    .run(addOnlineTab)
    .run(addLogoutToUserDropdown);

  function addRoutes($routeProvider: angular.route.IRouteProvider) {
    'ngInject';

    $routeProvider
      .when('/online', { redirectTo: '/online/discover' })
      .when('/online/discover', { templateUrl: 'src/discover/discover.html' });
  }

  function addOnlineTab(HawtioNav: Nav.Registry): void {
    'ngInject';

    const builder = HawtioNav.builder();
    const tab = builder.id('online')
      .title(() => 'Online')
      .defaultPage({
        rank : 15,
        isValid : (yes, no) => {
          yes();
        }
      })
      .href(() => '/online/discover')
      .isValid(() => true)
      .build();

    HawtioNav.add(tab);
  }

  function addLogoutToUserDropdown(
    HawtioExtension: Core.HawtioExtension,
    $compile: ng.ICompileService,
    userDetails: Core.AuthService): void {
    'ngInject';

    HawtioExtension.add('hawtio-logout', ($scope) => {
      $scope.userDetails = userDetails;
      const template = '<a href="" ng-click="userDetails.logout()">Logout</a>';
      return $compile(template)($scope);
    });
  }

  hawtioPluginLoader.addModule(module.name);

  export const log = Logger.get(module.name);
}
