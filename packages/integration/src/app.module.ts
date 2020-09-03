namespace Online {

  const module = angular
    .module('hawtio-online-integration', [
      'hawtio-online-integration-navigation',
    ])
    .decorator('mainNavService', disableConnectPlugin)
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
      const template = '<li><a class="pf-c-dropdown__menu-item" href="#" ng-focus="userDetails.logout()">Logout ({{userDetails.username}})</a></li>';
      return $compile(template)($scope);
    });
  }

  function destroyBeforeUnload($rootScope: ng.IRootScopeService, $window: ng.IWindowService) {
    'ngInject';
    $window.onbeforeunload = () => $rootScope.$destroy();
  }

  hawtioPluginLoader.addModule(module.name);

  export const log = Logger.get(module.name);
}
