/// <reference path="navigation.component.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online-integration-navigation', [
      'hawtio-online-integration-openshift',
    ])
    .component('hawtioIntegrationNav', navComponent)
    .directive('podsSelector', podsSelectorDirective);

  function podsSelectorDirective(pods: PodsService, $window: ng.IWindowService) {
    'ngInject';
    return new PodsSelectorDirective(pods, $window);
  }
}