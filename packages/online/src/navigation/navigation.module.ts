/// <reference path="navigation.config.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online-navigation', [
      'hawtio-online-openshift',
    ])
    .run(addHeaderTools);

}