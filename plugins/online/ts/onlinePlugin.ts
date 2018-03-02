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

    .run(['HawtioNav', (nav: Nav.Registry) => {
      nav.on(Nav.Actions.CHANGED, pluginName, items => {
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

    .filter('hashSize', () => hash => !hash ? 0 : Object.keys(hash).length)

    .directive('statusIcon',
    function() {
      return {
        restrict: 'E',
        templateUrl: 'plugins/online/html/statusIcon.html',
        scope: {
          status: '=',
          disableAnimation: "@",
          class: '=',
        },
        link: function($scope: any, $elem, $attrs) {
          $scope.spinning = !angular.isDefined($attrs.disableAnimation);
        }
      };
    })

    .filter('podStatus', function() {
      // Return results that match
      // https://github.com/openshift/origin/blob/master/vendor/k8s.io/kubernetes/pkg/printers/internalversion/printers.go#L523-L615
      return function(pod) {
        if (!pod || (!pod.metadata.deletionTimestamp && !pod.status)) {
          return '';
        }

        if (pod.metadata.deletionTimestamp) {
          return 'Terminating';
        }

        var initializing = false;
        var reason;

        // Print detailed container reasons if available. Only the first will be
        // displayed if multiple containers have this detail.

        _.each(pod.status.initContainerStatuses, function(initContainerStatus) {
          var initContainerState = _.get(initContainerStatus, 'state');

          if (initContainerState.terminated && initContainerState.terminated.exitCode === 0) {
            // initialization is complete
            return;
          }

          if (initContainerState.terminated) {
            // initialization is failed
            if (!initContainerState.terminated.reason) {
              if (initContainerState.terminated.signal) {
                reason = "Init Signal: " + initContainerState.terminated.signal;
              } else {
                reason = "Init Exit Code: " + initContainerState.terminated.exitCode;
              }
            } else {
              reason = "Init " + initContainerState.terminated.reason;
            }
            initializing = true;
            return true;
          }

          if (initContainerState.waiting && initContainerState.waiting.reason && initContainerState.waiting.reason !== 'PodInitializing') {
            reason = "Init " + initContainerState.waiting.reason;
            initializing = true;
          }
        });

        if (!initializing) {
          reason = pod.status.reason || pod.status.phase;

          _.each(pod.status.containerStatuses, function(containerStatus) {
            var containerReason = _.get(containerStatus, 'state.waiting.reason') || _.get(containerStatus, 'state.terminated.reason'),
                signal,
                exitCode;

            if (containerReason) {
              reason = containerReason;
              return true;
            }

            signal = _.get(containerStatus, 'state.terminated.signal');
            if (signal) {
              reason = "Signal: " + signal;
              return true;
            }

            exitCode = _.get(containerStatus, 'state.terminated.exitCode');
            if (exitCode) {
              reason = "Exit Code: " + exitCode;
              return true;
            }
          });
        }

        return reason;
      };
    })

    .filter('humanizeReason', function() {
      return function(reason) {
        var humanizedReason = _.startCase(reason);
        // Special case some values like "BackOff" -> "Back-off"
        return humanizedReason.replace("Back Off", "Back-off").replace("O Auth", "OAuth");
      };
    })
    .filter('humanizePodStatus', function(humanizeReasonFilter) {
      return humanizeReasonFilter;
    });

  hawtioPluginLoader.addModule(pluginName);
}
