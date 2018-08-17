namespace Online {

  export const navComponent: angular.IComponentOptions = {
    template: `
      <div id="main">
        <pf-vertical-navigation brand-src="{{$ctrl.brandSrc}}" hidden-icons="true" items="$ctrl.items"
                                item-click-callback="$ctrl.updateTemplateUrl" update-active-items-on-click="true"
                                ignore-mobile="true">

          <pods-selector/>

          <ul class="nav navbar-nav navbar-right navbar-iconic">
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
    controller: Nav.MainNavController,
  };
}
