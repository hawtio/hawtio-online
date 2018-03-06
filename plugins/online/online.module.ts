/// <reference path="discover/discover.module.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online', [
      discoverModule.name,
    ]);

  module.config(['$routeProvider', ($routeProvider: angular.route.IRouteProvider) => {
    $routeProvider
      .when('/online', { redirectTo: '/online/discover' })
      .when('/online/discover', { templateUrl: 'plugins/online/discover/discover.html' });
  }]);

  module.run(['HawtioNav', (nav: Nav.Registry) => {
    nav.on(Nav.Actions.CHANGED, module.name, items => {
      items.forEach(item => {
        switch (item.id) {
          case 'jvm':
            item.isValid = _ => false;
        }
      });
    });

    const builder = nav.builder();
    const tab = builder.id('online')
      .title(() => 'Online')
      .defaultPage({
        rank : 15,
        isValid : (yes, no) => {
          yes();
        }
      })
      .href(() => '/online/discover')
      .isValid(() => true)
      .build();

    nav.add(tab);
  }]);

  hawtioPluginLoader.addModule(module.name);

  export const log = Logger.get(module.name);
}
