module Online {

  export const pluginName   = 'online';
  export const templatePath = 'plugins/' + pluginName + '/html/';

  declare const jsonpath: any;
  declare const LabelSelector: any;

  angular.module(pluginName, ['patternfly', 'KubernetesAPI'])

    .config(['$routeProvider', ($routeProvider: angular.route.IRouteProvider) => {
      $routeProvider
        .when('/online', {redirectTo: '/online/discover'})
        .when('/online/discover', {templateUrl: UrlHelpers.join(templatePath, 'discover.html')});
    }])

    // Expose jsonpath as constant for injection
    .constant('jsonpath', jsonpath)

    .run(['HawtioNav', (nav: HawtioMainNav.Registry) => {
      nav.on(HawtioMainNav.Actions.CHANGED, pluginName, items => {
        items.forEach(item => {
          switch (item.id) {
            case 'jvm':
              item.isValid = _ => false;
          }
        });
      });

      const builder = nav.builder();
      const tab     = builder.id('online')
        .title(() => 'Online')
        .defaultPage({
          rank   : 15,
          isValid: (yes, no) => {
            yes();
          }
        })
        .href(() => '/online/discover')
        .isValid(() => true)
        .build();

      nav.add(tab);
    }])

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
        templateUrl: UrlHelpers.join(templatePath, 'labels.html'),
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
    )])

    .filter('hashSize', () => hash => !hash ? 0 : Object.keys(hash).length);

  hawtioPluginLoader.addModule(pluginName);
}
