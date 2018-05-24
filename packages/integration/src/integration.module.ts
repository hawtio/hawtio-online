namespace Online {

  const module = angular
    .module('hawtio-online-integration', [])
    .run(addLogoutToUserDropdown);

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

  hawtioPluginLoader.registerPreBootstrapTask({
    name: 'HawtioTabTitle',
    depends: 'ConfigLoader',
    task: (next) => {
      document.title = _.get(window, 'hawtconfig.branding.appName', 'Hawtio Console');      
      next();
    }
  });

  export const log = Logger.get(module.name);
}
