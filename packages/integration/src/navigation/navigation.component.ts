namespace Online {

  class navController extends Nav.MainNavController {

    private navService: Nav.MainNavService;
    private fuseConsoleUrl: string;
    private openshiftConsoleUrl: string;
    private navCollapsed = false;
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
      this.fuseConsoleUrl = new URI().query('').path('/online/').valueOf();
      openShiftConsole.url.then(url => this.openshiftConsoleUrl = url);
    }

    $onInit() {
      this.initService.init()
        .then(() => this.loading = false)
        .then(() => super.$onInit());
    }

    hasVerticalNav() {
      return !this.loading && this.navService.getValidItems().length;
    }

    handleNavBarToggleClick() {
      if (!this.hasVerticalNav()) return;

      if (this.navCollapsed) {
        this.expandMenu();
      } else {
        this.collapseMenu();
      }
    }

    private getBodyContentElement() {
      return angular.element(document.querySelector('.container-pf-nav-pf-vertical'));
    }

    private collapseMenu() {
      const bodyContentElement = this.getBodyContentElement();
      this.navCollapsed = true;
      bodyContentElement.addClass('collapsed-nav');
    }

    private expandMenu() {
      const bodyContentElement = this.getBodyContentElement();
      this.navCollapsed = false;
      bodyContentElement.removeClass('collapsed-nav');
      // Dispatch a resize event when showing the expanding then menu to
      // allow content to adjust to the menu sizing
      angular.element(this.$window).triggerHandler('resize');
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
    template: `
      <div id="main">

        <!-- Vertical navigation -->
        <nav class="navbar navbar-pf-vertical">

          <!-- Navigation bar header -->
          <div class="navbar-header" class="ignore-mobile">
            <button type="button" class="navbar-toggle" ng-click="$ctrl.handleNavBarToggleClick()">
              <span class="sr-only">Toggle navigation</span>
              <span class="icon-bar"></span>
              <span class="icon-bar"></span>
              <span class="icon-bar"></span>
            </button>
            <span class="navbar-brand">
              <img class="navbar-brand-icon" ng-if="$ctrl.brandSrc" ng-src="{{$ctrl.brandSrc}}" alt="{{$ctrl.brandAlt}}"/>
              <span class="navbar-brand-txt" ng-if="!$ctrl.brandSrc">{{$ctrl.brandAlt}}</span>
            </span>

            <pods-selector/>
          </div>

          <!-- Navigation bar menu -->
          <nav class="collapse navbar-collapse" class="ignore-mobile">
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
          </nav>

          <!-- Vertical menu -->
          <div ng-show="$ctrl.hasVerticalNav()" class="nav-pf-vertical"
              ng-class="{
                'nav-pf-persistent-secondary': $ctrl.persistentSecondary,
                'hidden-icons-pf': true,
                'collapsed': $ctrl.navCollapsed,
              }">
            <ul class="list-group">
              <li ng-repeat="item in $ctrl.items" class="list-group-item"
                  ng-class="{
                    'active': item.isActive,
                    'is-hover': item.isHover,
                  }">
                <a ng-click="$ctrl.navigateToItem(item)">
                  <span class="list-group-item-value">{{item.title}}</span>
                </a>
              </li>
            </ul>
          </div>
        </nav>

        <!-- App container -->
        <div ng-if="$ctrl.loading">
          <div class="loading-centered">
            <div class="spinner spinner-lg"></div>
            <div class="loading-label">Loading...</div>
          </div>
        </div>
        <div ng-if="!$ctrl.loading" class="container-fluid container-pf-nav-pf-vertical hidden-icons-pf">
          <ng-include src="$ctrl.templateUrl"></ng-include>
        </div>
      </div>
    `,
    controller: navController,
  };
}
