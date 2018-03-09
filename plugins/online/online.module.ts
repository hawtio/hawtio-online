/// <reference path="discover/discover.module.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online', [
      discoverModule.name,
    ])
    .run(addLogoutToUserDropdown);

  module.config(['$routeProvider', ($routeProvider: angular.route.IRouteProvider) => {
    $routeProvider
      .when('/online', { redirectTo: '/online/discover' })
      .when('/online/discover', { templateUrl: 'plugins/online/discover/discover.html' });
  }]);

  module.run(['HawtioNav', (nav: Nav.Registry) => {
    const builder = nav.builder();
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

    nav.add(tab);
  }]);

  function addLogoutToUserDropdown(
    HawtioExtension : Core.HawtioExtension,
    $compile        : ng.ICompileService,
    userDetails     : Core.AuthService): void {
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
