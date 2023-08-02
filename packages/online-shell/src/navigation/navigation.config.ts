namespace Online {

  export function addHeaderTools($compile: ng.ICompileService, $window: ng.IWindowService,
    HawtioExtension: Core.HawtioExtension, openShiftConsole: ConsoleService) {
    'ngInject'

    HawtioExtension.add('header-tools', $scope => {
      $scope.appLauncherItems = [
        { label: 'Console', url: new URI().query('').path('/integration/').valueOf() }
      ] as Nav.AppLauncherItem[]

      if (openShiftConsole.enabled) {
        openShiftConsole.url.then(url => $scope.appLauncherItems.push(
          { label: 'OpenShift', url: url }
        ))
      }

      $scope.onAppLauncherChange = (item: Nav.AppLauncherItem) => $window.location.href = item.url

      const template = '<app-launcher items="appLauncherItems" on-change="onAppLauncherChange(item)"></app-launcher>'
      return $compile(template)($scope)
    })
  }

}
