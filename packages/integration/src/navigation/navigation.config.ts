/// <reference path="navigation.service.ts"/>

namespace Online {

  export function configureRoutes($routeProvider: ng.route.IRouteProvider) {
    'ngInject';
    $routeProvider.when('/', { template: '<navigation></navigation>' });
  }

  export function addContextSelector($compile: ng.ICompileService, $window: ng.IWindowService,
    $timeout: ng.ITimeoutService, $interval: ng.IIntervalService, HawtioExtension: Core.HawtioExtension,
    navigationService: NavigationService) {
    'ngInject';

    HawtioExtension.add('context-selector', $scope => {
      $scope.contextSelectorLabel = 'Loading...';

      $timeout(() => {
        $scope.contextSelectorLabel = 'Select a container...';
        updateContextSelectorItems($scope, navigationService);
      }, 2000);
      $interval(() => updateContextSelectorItems($scope, navigationService), 20000);

      $scope.onContextSelectorChange = (pod: any) => {
        $window.location.href = navigationService.getConnectUrl(pod);
      };

      $scope.$on('$destroy', _ => navigationService.disconnect());

      const template = `
        <context-selector label="{{contextSelectorLabel}}" items="contextSelectorItems"
          on-change="onContextSelectorChange(item)"></context-selector>
      `;
      return $compile(template)($scope);
    });
  }

  function updateContextSelectorItems($scope: any, navigationService: NavigationService) {
    const pods = navigationService.getPods();
    if (!_.isEqual(pods, $scope.contextSelectorItems)) {
      log.debug('updating context selector items', pods);
      $scope.contextSelectorItems = pods;
    }
  }

  export function addHeaderTools($compile: ng.ICompileService, $window: ng.IWindowService,
    HawtioExtension: Core.HawtioExtension, navigationService: NavigationService) {
    'ngInject';

    HawtioExtension.add('header-tools', $scope => {
      $scope.appLauncherItems = navigationService.getAppLauncherItems();
      $scope.onAppLauncherChange = (item: Nav.AppLauncherItem) => $window.location.href = item.url;

      const template = '<app-launcher items="appLauncherItems" on-change="onAppLauncherChange(item)"></app-launcher>';
      return $compile(template)($scope);
    });
  }
}
