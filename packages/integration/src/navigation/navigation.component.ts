namespace Online {

  class navController extends Nav.MainNavController {

    private navService: Nav.MainNavService;
    private homeUrl: string;
    private openshiftConsoleUrl: string;
    private navCollapsed = true;
    private loading = true;

    constructor(
      configManager: Core.ConfigManager,
      private initService: Init.InitService,
      mainNavService: Nav.MainNavService,
      openShiftConsole: ConsoleService,
      userDetails: Core.AuthService,
      $interval: ng.IIntervalService,
      $rootScope: ng.IRootScopeService,
      private $window: ng.IWindowService,
    ) {
      'ngInject';
      super(configManager, userDetails, mainNavService, $rootScope, $interval);

      // mainNavService from parent class could be made protected
      this.navService = mainNavService;
      this.homeUrl = new URI().query('').path('/online/').valueOf();
      openShiftConsole.url.then(url => this.openshiftConsoleUrl = url);
    }

    $onInit() {
      this.initService.init()
        .then(() => this.loading = false)
        .then(() => super.$onInit())
        .then(() => this.toggleVerticalMenu());
    }

    goto(url:string) {
      this.$window.location.assign(url);
      return true;
    }

    hasVerticalNav() {
      return !this.loading && this.navService.getValidItems().length;
    }

    toggleVerticalMenu() {
      if (!this.hasVerticalNav()) return;
      this.navCollapsed = !this.navCollapsed;
    }

    navigateToItem(item) {
      this.updateTemplateUrl(item);
      this.clearActiveItems();
      item['isActive'] = true;
    }

    private clearActiveItems() {
      this.items.forEach(function (item) {
        item['isActive'] = false;
      });
    }
  }

  export const navComponent: angular.IComponentOptions = {
    templateUrl: 'src/navigation/navigation.html',
    controller: navController,
  };
}
