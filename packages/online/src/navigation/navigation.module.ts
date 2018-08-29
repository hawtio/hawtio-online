/// <reference path="navigation.component.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online-navigation', [
      'hawtio-online-openshift',
    ])
    .component('hawtioOnlineNav', navComponent);

}