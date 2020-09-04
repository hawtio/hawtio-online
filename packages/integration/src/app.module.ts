namespace Online {

  const module = angular
    .module('hawtio-online-integration', [
      'hawtio-online-integration-navigation',
    ])
    .decorator('mainNavService', disableConnectPlugin)
    .run(addLogoutToUserDropdown)
    .run(overrideCreateJolokia)
    .run(destroyBeforeUnload);

  function overrideCreateJolokia(connectService: JVM.ConnectService) {
    'ngInject';
    const original = connectService.createJolokia;
    connectService.createJolokia = (options: JVM.ConnectOptions, checkCredentials = false) => {
      if (checkCredentials) {
        return new Jolokia({
          url: createServerConnectionUrl(options),
          method: 'post',
          mimeType: 'application/json'
        });
      } else {
        return original(options);
      }
    };
  }

  function createServerConnectionUrl(options: JVM.ConnectOptions): string {
    log.debug("Connect to server, options:", StringHelpers.toString(options));
    const match = options.jolokiaUrl.match(/\/management\/namespaces\/(.+)\/pods\/(http|https):([^/]+)\/(.+)/);
    const namespace = match[1];
    const protocol = match[2];
    const pod = match[3];
    const path = match[4];
    const auth = window.btoa(options.userName + ':' + options.password);
    const answer = `/management/namespaces/${namespace}/pods/${protocol}:${auth}@${pod}/${path}`;
    log.debug("Using URL:", answer);
    return answer;
  }

  function disableConnectPlugin($delegate: Nav.MainNavService) {
    'ngInject';
    const addItem = $delegate.addItem;
    $delegate.addItem = (item: Nav.MainNavItemProps): void => {
      if (item.title === 'Connect') {
        item.isValid = () => false;
      }
      addItem.call($delegate, item);
    }
    return $delegate;
  }

  function addLogoutToUserDropdown(
    HawtioExtension: Core.HawtioExtension,
    $compile: ng.ICompileService,
    userDetails: Core.AuthService): void {
    'ngInject';

    HawtioExtension.add('hawtio-logout', ($scope) => {
      $scope.userDetails = userDetails;
      const template = '<li><a class="pf-c-dropdown__menu-item" href="#" ng-focus="userDetails.logout()">Logout ({{userDetails.username}})</a></li>';
      return $compile(template)($scope);
    });
  }

  function destroyBeforeUnload($rootScope: ng.IRootScopeService, $window: ng.IWindowService) {
    'ngInject';
    $window.onbeforeunload = () => $rootScope.$destroy();
  }

  hawtioPluginLoader.addModule(module.name);

  export const log = Logger.get(module.name);
}
