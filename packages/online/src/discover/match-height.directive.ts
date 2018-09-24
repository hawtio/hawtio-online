namespace Online {

  export class MatchHeightDirective implements ng.IDirective {

    restrict = 'A';

    constructor(private $timeout: ng.ITimeoutService) {
      'ngInject';
    }

    link(scope: ng.IScope) {
      $.fn.matchHeight._maintainScroll = true;
      const matchHeight = function () {
        $(".row-cards-pf > [class*='col'] > .card-pf .card-pf-title").matchHeight();
        $(".row-cards-pf > [class*='col'] > .card-pf .card-pf-items").matchHeight();
        $(".row-cards-pf > [class*='col'] > .card-pf .card-pf-info").matchHeight();
        $(".row-cards-pf > [class*='col'] > .card-pf").matchHeight();
      };
      scope.$on('matchHeight', () => matchHeight());
      this.$timeout(() => matchHeight(), 0, false);
    };
  }
}
