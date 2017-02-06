/// <reference path="../../includes.ts"/>
module Openshift {

  export const pluginName = 'openshift';
  export const _module    = angular.module(pluginName, []);

  _module.run(['HawtioNav', (nav: HawtioMainNav.Registry) => {
    nav.on(HawtioMainNav.Actions.CHANGED, pluginName, items => {
      items.forEach(item => {
        switch (item.id) {
          case 'jvm':
            item.isValid = _ => false;
        }
      });
    });
  }]);

  hawtioPluginLoader.addModule(pluginName);
}
