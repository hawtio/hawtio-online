namespace Online {

  export function addHeaderTools($compile: ng.ICompileService, $window: ng.IWindowService,
     HawtioExtension: Core.HawtioExtension, openShiftConsole: ConsoleService) {
    'ngInject';
    
    HawtioExtension.add('header-tools', $scope => {
      $scope.appLauncherItems = <Nav.AppLauncherItem[]>[
        { label: 'Console', url: new URI().query('').path('/integration/').valueOf() },
        { label: 'OpenShift' }
      ];
      openShiftConsole.url.then(url => $scope.appLauncherItems[1].url = url);
      
      $scope.onAppLauncherChange = (item: Nav.AppLauncherItem) => $window.location.href = item.url;
      
      const template = '<app-launcher items="appLauncherItems" on-change="onAppLauncherChange(item)"></app-launcher>';
      return $compile(template)($scope);
    });
  }

}