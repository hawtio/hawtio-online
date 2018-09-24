namespace Online {

  export interface LabelsDirectiveScope extends ng.IScope {
    labels             : {[key: string]: string},
    clickable?         : boolean,
    kind?              : string,
    projectName?       : string,
    limit?             : number,
    titleKind?         : string,
    navigateUrl?       : string,
    filterCurrentPage? : boolean,
    filterAndNavigate? : (key: string, value?: string) => void,
  }

  export class LabelsDirective implements ng.IDirective {

    restrict = 'E';

    scope = {
      labels            : '=',
      // if you specify clickable, then everything below is required unless specified as optional
      clickable         : "@?",
      kind              : "@?",
      projectName       : "@?",
      limit             : '=?',
      titleKind         : '@?', // optional, instead of putting kind into that part of the hover
                                // title, it will put this string instead, e.g. if you want 'builds for build config foo'
      navigateUrl       : '@?', // optional to override the default
      filterCurrentPage : '=?', // optional don't navigate, just filter here
    };

    templateUrl = 'src/labels/labels.html';

    constructor(
      $location: ng.ILocationService,
      $timeout: ng.ITimeoutService,
    ) {
      'ngInject';
    }

    link(scope: LabelsDirectiveScope) {
      scope.filterAndNavigate = function (key, value) {
        if (scope.kind && scope.projectName) {
          if (!scope.filterCurrentPage) {
            this.$location.url(scope.navigateUrl || `/project/${scope.projectName}/browse/${scope.kind}`);
          }
          this.$timeout(function () {
            const selector = {};
            selector[key] = value;
            // LabelFilter.setLabelSelector(new LabelSelector(selector, true));
          }, 1);
        }
      };
    }
  }
}
