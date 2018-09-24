namespace Online {

  class navController extends Nav.MainNavController {

    private consoleUrl: string;
    private openshiftConsoleUrl: string;
    private loading = true;

    constructor(
      configManager: Core.ConfigManager,
      private initService: Init.InitService,
      mainNavService: Nav.MainNavService,
      openShiftConsole: ConsoleService,
      userDetails: Core.AuthService,
      $interval: ng.IIntervalService,
      $rootScope: ng.IRootScopeService,
    ) {
      'ngInject';
      super(configManager, userDetails, mainNavService, $rootScope, $interval);

      this.consoleUrl = new URI().query('').path('/integration/').valueOf();
      openShiftConsole.url.then(url => this.openshiftConsoleUrl = url);
    }

    $onInit() {
      this.initService.init()
        .then(() => this.loading = false)
        .then(() => super.$onInit());
    }
  }

  export const navComponent: angular.IComponentOptions = {
    templateUrl: 'src/navigation/navigation.html',
    controller: navController,
  };
}
