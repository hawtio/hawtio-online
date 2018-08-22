namespace Online {

  class navController extends Nav.MainNavController {

    private fuseConsoleUrl: string;
    private openshiftConsoleUrl: string;

    constructor(
      configManager: Core.ConfigManager,
      userDetails: Core.AuthService,
      mainNavService: Nav.MainNavService,
      $rootScope: ng.IRootScopeService,
      $interval: ng.IIntervalService,
      openShiftConsole: ConsoleService,
    ) {
      'ngInject';
      super(configManager, userDetails, mainNavService, $rootScope, $interval);

      this.fuseConsoleUrl = new URI().query('').path('/online/').valueOf();
      openShiftConsole.url.then(url => this.openshiftConsoleUrl = url);
    }
  }

  export const navComponent: angular.IComponentOptions = {
    template: `
      <div id="main">
        <pf-vertical-navigation brand-src="{{$ctrl.brandSrc}}" hidden-icons="true" items="$ctrl.items"
                                item-click-callback="$ctrl.updateTemplateUrl" update-active-items-on-click="true"
                                ignore-mobile="true">

          <pods-selector/>

          <ul class="nav navbar-nav navbar-right navbar-iconic">
            <!-- App launcher -->
            <li class="applauncher-pf applauncher-pf-block-list dropdown">
              <button class="btn btn-link dropdown-toggle nav-item-iconic" data-toggle="dropdown" href="#">
                <span class="fa fa-th applauncher-pf-icon" aria-hidden="true"></span>
                <span class="dropdown-title">
                  <span class="applauncher-pf-title">
                    Application Launcher
                    <span class="caret" aria-hidden="true"></span>
                  </span>
                </span>
              </button>
              <ul class="dropdown-menu" role="menu">
                <li class="applauncher-pf-item" role="presentation">
                  <a class="applauncher-pf-link" ng-href="{{$ctrl.fuseConsoleUrl}}" role="menuitem">
                    <i class="applauncher-pf-link-icon pficon pficon-home" aria-hidden="true"></i>
                    <span class="applauncher-pf-link-title">Home</span>
                  </a>
                </li>
                <li class="applauncher-pf-item" role="presentation">
                  <a class="applauncher-pf-link" ng-href="{{$ctrl.openshiftConsoleUrl}}" role="menuitem">
                    <i class="applauncher-pf-link-icon font-icon icon-openshift" aria-hidden="true"></i>
                    <span class="applauncher-pf-link-title">OpenShift</span>
                  </a>
                </li>
              </ul>
            </li>
            <!-- Help -->
            <li class="dropdown">
              <a class="dropdown-toggle nav-item-iconic" id="helpDropdownMenu" data-toggle="dropdown"
                 aria-haspopup="true" aria-expanded="true">
                <span title="Help" class="fa pficon-help"></span>
                <span class="caret"></span>
              </a>
              <ul class="dropdown-menu" aria-labelledby="helpDropdownMenu">
                <li hawtio-extension name="hawtio-help"></li>
                <li hawtio-extension name="hawtio-about"></li>
              </ul>
            </li>
            <!-- User -->
            <li class="dropdown">
              <a class="dropdown-toggle nav-item-iconic" id="userDropdownMenu" data-toggle="dropdown"
                 aria-haspopup="true" aria-expanded="true">
                <span class="fa pf-icon pficon-user" aria-hidden="true"></span>
                <span class="username truncate">{{$ctrl.username}}</span> <span class="caret" aria-hidden="true"></span>
              </a>
              <ul class="dropdown-menu" aria-labelledby="userDropdownMenu">
                <li hawtio-extension name="hawtio-preferences"></li>
                <li hawtio-extension name="hawtio-logout"></li>
              </ul>
            </li>
          </ul>
        </pf-vertical-navigation>
        <div class="container-fluid container-pf-nav-pf-vertical">
          <ng-include src="$ctrl.templateUrl"></ng-include>
        </div>
      </div>
    `,
    controller: navController,
  };
}
