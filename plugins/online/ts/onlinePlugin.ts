/// <reference path="../../includes.ts"/>
module Online {

  export const pluginName   = 'online';
  export const _module      = angular.module(pluginName, ['patternfly', 'KubernetesAPI']);
  export const templatePath = 'plugins/' + pluginName + '/html/';

  declare const jsonpath: any;
  // Expose jsonpath as constant for injection
  _module.constant('jsonpath', jsonpath);

  _module.config(['$routeProvider', ($routeProvider: ng.route.IRouteProvider) => {

    $routeProvider
      .when('/online', {redirectTo: '/online/discover'})
      .when('/online/discover', {templateUrl: UrlHelpers.join(templatePath, 'discover.html')});
  }]);

  _module.run(['HawtioNav', (nav: HawtioMainNav.Registry) => {
    nav.on(HawtioMainNav.Actions.CHANGED, pluginName, items => {
      items.forEach(item => {
        switch (item.id) {
          case 'jvm':
            item.isValid = _ => false;
        }
      });
    });

    const builder = nav.builder();
    const tab     = builder.id('online')
      .title(() => 'Online')
      .defaultPage({
        rank   : 15,
        isValid: (yes, no) => {
          yes();
        }
      })
      .href(() => '/online/discover')
      .isValid(() => true)
      .build();

    nav.add(tab);
  }]);

  hawtioPluginLoader.addModule(pluginName);
}
