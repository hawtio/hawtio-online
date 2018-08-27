/// <reference path="app.component.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online-integration', [
      'hawtio-online-integration-navigation',
    ])
    .decorator('mainNavService', disableConnectPlugin)
    .component('hawtioIntegrationApp', appComponent)
    .run(addLogoutToUserDropdown)
    .run(destroyBeforeUnload);

  function disableConnectPlugin($delegate: Nav.MainNavService) {
    'ngInject';
    const addItem = $delegate.addItem;
    $delegate.addItem = (item: Nav.MainNavItemProps): void => {
      if (item.title === 'Connect') {
        item.isValid = () => false;
      }
      addItem.call($delegate, item);
    }
    return $delegate;
  }

  function addLogoutToUserDropdown(
    HawtioExtension: Core.HawtioExtension,
    $compile: ng.ICompileService,
    userDetails: Core.AuthService): void {
    'ngInject';

    HawtioExtension.add('hawtio-logout', ($scope) => {
      $scope.userDetails = userDetails;
      const template = '<a href="" ng-click="userDetails.logout()">Logout ({{userDetails.username}})</a>';
      return $compile(template)($scope);
    });
  }

  function destroyBeforeUnload($rootScope: ng.IRootScopeService, $window: ng.IWindowService) {
    'ngInject';
    $window.onbeforeunload = () => $rootScope.$destroy();
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
