namespace Online {

  export interface ListRowExpandDirectiveScope extends ng.IScope {
    onClick: () => {},
  }

  export class ListRowExpandDirective implements ng.IDirective {

    restrict = 'A';

    scope = {
      onClick: '&?',
    };

    constructor() {
      'ngInject';
    }

    link(scope: ListRowExpandDirectiveScope, elem: JQuery) {
      elem.click(function (event) {
        if(!$(event.target).is('button, a, input, .fa-ellipsis-v')) {
          elem.toggleClass('list-view-pf-expand-active');
          elem.find('.fa-angle-right').toggleClass('fa-angle-down');
          const container = elem.siblings('.list-group-item-container');
          if (container.children().length) {
            container.toggleClass('hidden');
            if (scope.onClick) {
              scope.onClick();
            }
          }
        }
      });
    };
  }
}
