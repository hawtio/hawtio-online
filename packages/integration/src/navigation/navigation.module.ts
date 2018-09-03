/// <reference path="navigation.component.ts"/>

namespace Online {

  const module = angular
    .module('hawtio-online-integration-navigation', [
      'hawtio-online-status',
      'hawtio-online-openshift',
      'hawtio-online-integration-openshift',
    ])
    .component('hawtioIntegrationNav', navComponent)
    .directive('podsSelector', podsSelectorDirective);

  function podsSelectorDirective(
    openshift: OpenShiftService,
    $window: ng.IWindowService,
    podStatusFilter: PodStatusFilter,
  ) {
    'ngInject';
    return new PodsSelectorDirective(openshift, $window, podStatusFilter);
  }
}