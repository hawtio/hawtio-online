/// <reference path="navigation.service.ts"/>

namespace Online {

  export function configureRoutes($routeProvider: ng.route.IRouteProvider) {
    'ngInject';
    $routeProvider.when('/', { template: '<navigation></navigation>' });
  }

  export function addContextSelector($compile: ng.ICompileService, $window: ng.IWindowService,
    HawtioExtension: Core.HawtioExtension, navigationService: NavigationService) {
    'ngInject';

    HawtioExtension.add('context-selector', $scope => {
      $scope.contextSelectorLabel = '';
      $scope.contextSelectorItems = [];

      $scope.$watch(() => navigationService.isLoadingPods(), (isLoading: boolean) => {
        if (isLoading) {
          $scope.contextSelectorLabel = 'Loading...';
        } else {
          $scope.contextSelectorLabel = 'Select a container...';
          $scope.contextSelectorItems = navigationService.getPods();
        }
      });

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