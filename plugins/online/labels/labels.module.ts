namespace Online {

  export const labelsModule = angular
    .module('hawtio-online-labels', [])
    .filter('hashSize', () => hash => !hash ? 0 : Object.keys(hash).length)
    .directive('labels', ['$location', '$timeout', ($location, $timeout) => (
      {
        restrict   : 'E',
        scope      : {
          labels           : '=',
          // if you specify clickable, then everything below is required unless specified as optional
          clickable        : "@?",
          kind             : "@?",
          projectName      : "@?",
          limit            : '=?',
          titleKind        : '@?', // optional, instead of putting kind into that part of the hover
                                   // title, it will put this string instead, e.g. if you want 'builds for build config foo'
          navigateUrl      : '@?', // optional to override the default
          filterCurrentPage: '=?'  // optional don't navigate, just filter here
        },
        templateUrl: 'plugins/online/labels/labels.html',
        link       : function (scope: any) {
          scope.filterAndNavigate = function (key, value) {
            if (scope.kind && scope.projectName) {
              if (!scope.filterCurrentPage) {
                $location.url(scope.navigateUrl || ("/project/" + scope.projectName + "/browse/" + scope.kind));
              }
              $timeout(function () {
                const selector = {};
                selector[key]  = value;
                // LabelFilter.setLabelSelector(new LabelSelector(selector, true));
              }, 1);
            }
          };
        }
      }
    )]
  );
}
