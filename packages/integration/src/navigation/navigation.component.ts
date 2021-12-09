namespace Online {

  export class NavigationController {
    homeUrl: string;
    openshiftConsoleUrl: string;

    constructor(private $rootScope: ng.IRootScopeService, openShiftConsole: ConsoleService,
      private $window: ng.IWindowService) {
      'ngInject';
      this.homeUrl = new URI().query('').path('/online/').valueOf();
      if (openShiftConsole.enabled) {
        openShiftConsole.url.then(url => this.openshiftConsoleUrl = url);
      }
    }

    $onInit() {
      this.$rootScope.$emit(Page.CLOSE_MAIN_NAV_EVENT);
    }

    goto(url: string) {
      this.$window.location.href = url;
    }
  }

  export const navigationComponent: angular.IComponentOptions = {
    template: `
      <div ng-if="!$ctrl.selectedPod" class="blank-slate-pf">
        <div class="blank-slate-pf-icon">
          <span class="pficon pficon pficon-unplugged"></span>
        </div>
        <h1>
          No Selected Container
        </h1>
        <p>
          Please select a container to connect to in the navigation bar above and access the management console.
        </p>
        <p>
          You can alternatively click the navigation buttons below.
        </p>
        <div class="blank-slate-pf-secondary-action">
          <button class="btn btn-default" ng-click="$ctrl.goto($ctrl.homeUrl);">Go to Home</button>
          <button class="btn btn-default" ng-click="$ctrl.goto($ctrl.openShiftConsoleUrl);">Go to the OpenShift Console</button>
        </div>
      </div>
    `,
    controller: NavigationController,
  };

}
