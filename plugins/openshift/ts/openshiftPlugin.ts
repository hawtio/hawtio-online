/// <reference path="../../includes.ts"/>
module Openshift {

  export const pluginName   = 'openshift';
  export const _module      = angular.module(pluginName, ['patternfly']);
  export const templatePath = 'plugins/' + pluginName + '/html/';

  _module.config(['$routeProvider', ($routeProvider: ng.route.IRouteProvider) => {

    $routeProvider
      .when('/openshift', {redirectTo: '/openshift/discover'})
      .when('/openshift/discover', {templateUrl: UrlHelpers.join(templatePath, 'discover.html')});
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
    const tab     = builder.id('openshift')
      .title(() => 'OpenShift')
      .defaultPage({
        rank   : 15,
        isValid: (yes, no) => {
          yes();
        }
      })
      .href(() => '/openshift/discover')
      .isValid(() => true)
      .build();

    nav.add(tab);
  }]);

  hawtioPluginLoader.addModule(pluginName);
}
