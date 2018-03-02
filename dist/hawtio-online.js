var Online;
(function (Online) {
    Online.pluginName = 'online';
    Online.templatePath = 'plugins/' + Online.pluginName + '/html/';
    angular.module(Online.pluginName, ['patternfly', 'KubernetesAPI'])
        .config(['$routeProvider', function ($routeProvider) {
            $routeProvider
                .when('/online', { redirectTo: '/online/discover' })
                .when('/online/discover', { templateUrl: UrlHelpers.join(Online.templatePath, 'discover.html') });
        }])
        .constant('jsonpath', jsonpath)
        .run(['HawtioNav', function (nav) {
            nav.on(Nav.Actions.CHANGED, Online.pluginName, function (items) {
                items.forEach(function (item) {
                    switch (item.id) {
                        case 'jvm':
                            item.isValid = function (_) { return false; };
                    }
                });
            });
            var builder = nav.builder();
            var tab = builder.id('online')
                .title(function () { return 'Online'; })
                .defaultPage({
                rank: 15,
                isValid: function (yes, no) {
                    yes();
                }
            })
                .href(function () { return '/online/discover'; })
                .isValid(function () { return true; })
                .build();
            nav.add(tab);
        }])
        .directive('labels', ['$location', '$timeout', function ($location, $timeout) { return ({
            restrict: 'E',
            scope: {
                labels: '=',
                // if you specify clickable, then everything below is required unless specified as optional
                clickable: "@?",
                kind: "@?",
                projectName: "@?",
                limit: '=?',
                titleKind: '@?',
                // title, it will put this string instead, e.g. if you want 'builds for build config foo'
                navigateUrl: '@?',
                filterCurrentPage: '=?' // optional don't navigate, just filter here
            },
            templateUrl: UrlHelpers.join(Online.templatePath, 'labels.html'),
            link: function (scope) {
                scope.filterAndNavigate = function (key, value) {
                    if (scope.kind && scope.projectName) {
                        if (!scope.filterCurrentPage) {
                            $location.url(scope.navigateUrl || ("/project/" + scope.projectName + "/browse/" + scope.kind));
                        }
                        $timeout(function () {
                            var selector = {};
                            selector[key] = value;
                            // LabelFilter.setLabelSelector(new LabelSelector(selector, true));
                        }, 1);
                    }
                };
            }
        }); }])
        .filter('hashSize', function () { return function (hash) { return !hash ? 0 : Object.keys(hash).length; }; })
        .directive('statusIcon', function () {
        return {
            restrict: 'E',
            templateUrl: 'plugins/online/html/statusIcon.html',
            scope: {
                status: '=',
                disableAnimation: "@",
                class: '=',
            },
            link: function ($scope, $elem, $attrs) {
                $scope.spinning = !angular.isDefined($attrs.disableAnimation);
            }
        };
    })
        .filter('podStatus', function () {
        // Return results that match
        // https://github.com/openshift/origin/blob/master/vendor/k8s.io/kubernetes/pkg/printers/internalversion/printers.go#L523-L615
        return function (pod) {
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
            _.each(pod.status.initContainerStatuses, function (initContainerStatus) {
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
                        }
                        else {
                            reason = "Init Exit Code: " + initContainerState.terminated.exitCode;
                        }
                    }
                    else {
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
                _.each(pod.status.containerStatuses, function (containerStatus) {
                    var containerReason = _.get(containerStatus, 'state.waiting.reason') || _.get(containerStatus, 'state.terminated.reason'), signal, exitCode;
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
        .filter('humanizeReason', function () {
        return function (reason) {
            var humanizedReason = _.startCase(reason);
            // Special case some values like "BackOff" -> "Back-off"
            return humanizedReason.replace("Back Off", "Back-off").replace("O Auth", "OAuth");
        };
    })
        .filter('humanizePodStatus', ["humanizeReasonFilter", function (humanizeReasonFilter) {
        return humanizeReasonFilter;
    }]);
    hawtioPluginLoader.addModule(Online.pluginName);
})(Online || (Online = {}));
/// <reference path="onlinePlugin.ts"/>
var Online;
(function (Online) {
    angular.module(Online.pluginName)
        .controller('Online.DiscoverController', ['$scope', '$location', '$window', '$element', 'K8SClientFactory', 'jsonpath',
        function ($scope, $location, $window, $element, client /*: K8SClientFactory*/, jsonpath) {
            var loading = 0;
            $scope.pods = [];
            $scope.filteredPods = [];
            $scope.projects = [];
            $scope.loading = function () { return loading > 0; };
            $scope.getStatusClasses = function (pod, status) {
                var styles;
                switch (status) {
                    case 'Running':
                        if (Online.isPodReady(pod)) {
                            styles = 'list-view-pf-icon-success';
                        }
                        break;
                    case 'Complete':
                    case 'Completed':
                    case 'Succeeded':
                        styles = 'list-view-pf-icon-success';
                        break;
                    case 'Error':
                    case 'Terminating':
                    case 'Terminated':
                    case 'Unknown':
                        styles = 'list-view-pf-icon-danger';
                        break;
                    default:
                        styles = 'list-view-pf-icon-info';
                }
                return "list-view-pf-icon-md " + styles;
            };
            $element.on('$destroy', function (_) { return $scope.$destroy(); });
            var applyFilters = function (filters) {
                $scope.filteredPods.length = 0;
                if (filters && filters.length > 0) {
                    $scope.pods.forEach(function (pod) {
                        if (_.every(filters, function (filter) { return matches(pod, filter); })) {
                            $scope.filteredPods.push(pod);
                        }
                    });
                }
                else {
                    (_a = $scope.filteredPods).push.apply(_a, $scope.pods);
                }
                $scope.toolbarConfig.filterConfig.resultsCount = $scope.filteredPods.length;
                applySort();
                var _a;
            };
            var applySort = function () {
                $scope.filteredPods.sort(function (pod1, pod2) {
                    var value = 0;
                    value = pod1.metadata.name.localeCompare(pod2.metadata.name);
                    if (!$scope.toolbarConfig.sortConfig.isAscending) {
                        value *= -1;
                    }
                    return value;
                });
            };
            var matches = function (item, filter) {
                var match = true;
                if (filter.id === 'name') {
                    match = item.metadata.name.match(filter.value) !== null;
                }
                else if (filter.id === 'namespace') {
                    match = item.metadata.namespace.match(filter.value) !== null;
                }
                return match;
            };
            var filterConfig = {
                fields: [
                    {
                        id: 'name',
                        title: 'Name',
                        placeholder: 'Filter by Name...',
                        filterType: 'text'
                    },
                ],
                resultsCount: $scope.filteredPods.length,
                appliedFilters: [],
                onFilterChange: applyFilters,
            };
            var sortConfig = {
                fields: [
                    {
                        id: 'name',
                        title: 'Name',
                        sortType: 'alpha',
                    },
                ],
                onSortChange: applySort,
            };
            $scope.toolbarConfig = {
                filterConfig: filterConfig,
                sortConfig: sortConfig,
            };
            if ($window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
                filterConfig.fields.push({
                    id: 'namespace',
                    title: 'Namespace',
                    placeholder: 'Filter by Namespace...',
                    filterType: 'text',
                });
            }
            $scope.open = function (url) {
                $window.open(url);
                return true;
            };
            if ($window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
                var projects_1 = client.create('projects');
                var pods_watches_1 = {};
                loading++;
                var projects_watch_1 = projects_1.watch(function (projects) {
                    // subscribe to pods update for new projects
                    projects.filter(function (project) { return !$scope.projects.find(function (p) { return p.metadata.uid === project.metadata.uid; }); })
                        .forEach(function (project) {
                        loading++;
                        var pods = client.create('pods', project.metadata.name);
                        var pods_watch = pods.watch(function (pods) {
                            loading--;
                            var others = $scope.pods.filter(function (pod) { return pod.metadata.namespace !== project.metadata.name; });
                            $scope.pods.length = 0;
                            (_a = $scope.pods).push.apply(_a, others.concat(_.filter(pods, function (pod) { return jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0; })));
                            applyFilters(filterConfig.appliedFilters);
                            // have to kick off a $digest here
                            $scope.$apply();
                            var _a;
                        });
                        pods_watches_1[project.metadata.name] = {
                            request: pods,
                            watch: pods_watch,
                        };
                        pods.connect();
                    });
                    // handle delete projects
                    $scope.projects.filter(function (project) { return !projects.find(function (p) { return p.metadata.uid === project.metadata.uid; }); })
                        .forEach(function (project) {
                        var handle = pods_watches_1[project.metadata.name];
                        client.destroy(handle.request, handle.watch);
                        delete pods_watches_1[project.metadata.name];
                    });
                    $scope.projects.length = 0;
                    (_a = $scope.projects).push.apply(_a, projects);
                    loading--;
                    var _a;
                });
                $scope.$on('$destroy', function (_) { return client.destroy(projects_1, projects_watch_1); });
                projects_1.connect();
            }
            else {
                loading++;
                var pods_1 = client.create('pods', $window.OPENSHIFT_CONFIG.hawtio.namespace);
                var pods_watch_1 = pods_1.watch(function (pods) {
                    loading--;
                    $scope.pods.length = 0;
                    (_a = $scope.pods).push.apply(_a, _.filter(pods, function (pod) { return jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0; }));
                    applyFilters(filterConfig.appliedFilters);
                    // have to kick off a $digest here
                    $scope.$apply();
                    var _a;
                });
                $scope.$on('$destroy', function (_) { return client.destroy(pods_1, pods_watch_1); });
                pods_1.connect();
            }
        }
    ])
        .filter('jolokiaContainers', function () { return function (containers) { return containers.filter(function (container) { return container.ports.some(function (port) { return port.name === 'jolokia'; }); }); }; })
        .filter('jolokiaPort', function () { return function (container) { return container.ports.find(function (port) { return port.name === 'jolokia'; }); }; })
        .filter('connectUrl', ['userDetails', function (userDetails) { return function (pod, port) {
            if (port === void 0) { port = 8778; }
            return new URI().path('/integration/')
                .hash(userDetails.token || '')
                .query({
                jolokiaUrl: new URI()
                    .path("/master/api/v1/namespaces/" + pod.metadata.namespace + "/pods/https:" + pod.metadata.name + ":" + port + "/proxy/jolokia/"),
                title: pod.metadata.name,
                returnTo: new URI().toString(),
            });
        }; }])
        .filter('podDetailsUrl', function () { return function (pod) { return UrlHelpers.join(Core.pathGet(window, ['OPENSHIFT_CONFIG', 'openshift', 'master_uri']) || KubernetesAPI.masterUrl, 'console/project', pod.metadata.namespace, 'browse/pods', pod.metadata.name); }; });
})(Online || (Online = {}));
var Online;
(function (Online) {
    function isPodReady(pod) {
        var conditions = Core.pathGet(pod, 'status.conditions');
        return !!conditions && conditions.some(function (c) { return c.type === 'Ready' && c.status === 'True'; });
    }
    Online.isPodReady = isPodReady;
})(Online || (Online = {}));

angular.module('hawtio-online-templates', []).run(['$templateCache', function($templateCache) {$templateCache.put('plugins/online/html/discover.html','<div ng-controller="Online.DiscoverController">\n\n  <div class="title">\n    <h1>Pods</h1>\n  </div>\n\n  <pf-toolbar config="toolbarConfig"></pf-toolbar>\n\n  <div class="spinner spinner-lg loading-page" ng-if="loading()"></div>\n\n  <div class="blank-slate-pf no-border" ng-if="loading() === false && pods.length === 0">\n    <div class="blank-slate-pf-icon">\n      <span class="pficon pficon pficon-add-circle-o"></span>\n    </div>\n    <h1>\n      No Hawtio Containers\n    </h1>\n    <p>\n      There are no containers running with a port configured whose name is <code>jolokia</code>.\n    </p>\n  </div>\n\n  <div class="list-group list-view-pf list-view-pf-view">\n    <div ng-repeat="pod in filteredPods" class="list-group-item list-view-pf-stacked">\n      <div class="list-view-pf-actions">\n        <button ng-if="(containers = (pod.spec.containers | jolokiaContainers)).length === 1"\n                class="btn btn-primary" ng-click="open(pod | connectUrl: (containers[0] | jolokiaPort).containerPort)">\n          Connect\n        </button>\n        <div ng-if="containers.length > 1" class="dropdown">\n          <button class="btn btn-primary dropdown-toggle" type="button" data-toggle="dropdown">\n            Connect\n            <span class="caret"></span>\n          </button>\n          <ul class="dropdown-menu dropdown-menu-right" role="menu">\n            <li class="dropdown-header">Containers</li>\n            <li ng-repeat="container in containers" role="presentation">\n              <a role="menuitem" tabindex="-1" href="#" ng-click="open(pod | connectUrl: (container | jolokiaPort).containerPort)">\n                {{container.name}}\n              </a>\n            </li>\n          </ul>\n        </div>\n        <div class="dropdown pull-right dropdown-kebab-pf">\n          <button class="btn btn-link dropdown-toggle" type="button" data-toggle="dropdown">\n            <span class="fa fa-ellipsis-v"></span>\n          </button>\n          <ul class="dropdown-menu dropdown-menu-right">\n            <li class="dropdown-header">OpenShift Console</li>\n            <li><a href="#" ng-click="open(pod | podDetailsUrl)">Open pod details</a></li>\n          </ul>\n        </div>\n      </div>\n      <div class="list-view-pf-main-info">\n        <div class="list-view-pf-left">\n          <status-icon status="status = (pod | podStatus)"\n            class="getStatusClasses(pod, status)"\n            uib-tooltip="{{status | humanizePodStatus}}" tooltip-placement="bottom">\n          </status-icon>\n        </div>\n        <div class="list-view-pf-body">\n          <div class="list-view-pf-description">\n            <div class="list-group-item-heading">\n              {{pod.metadata.name}}\n            </div>\n            <div class="list-group-item-text">\n              <labels labels="pod.metadata.labels"\n                      project-name="{{pod.metadata.namespace}}" limit="3">\n              </labels>\n            </div>\n          </div>\n          <div class="list-view-pf-additional-info">\n            <div class="list-view-pf-additional-info-item">\n              <span class="pficon pficon-home"></span>\n              {{pod.metadata.namespace}}\n            </div>\n            <div class="list-view-pf-additional-info-item">\n              <span class="pficon pficon-container-node"></span>\n              {{pod.spec.nodeName || pod.status.hostIP}}\n            </div>\n            <div class="list-view-pf-additional-info-item">\n              <span class="pficon pficon-image"></span>\n              <strong>{{pod.spec.containers.length}}</strong>\n              <ng-pluralize count="containers.length" when="{\n                     \'one\': \'container\',\n                     \'other\': \'containers\'}">\n              </ng-pluralize>\n            </div>\n          </div>\n        </div>\n      </div>\n    </div>\n  </div>\n\n</div>');
$templateCache.put('plugins/online/html/labels.html','<div row wrap ng-if="(labels | hashSize) > 0">\n  <span row nowrap ng-repeat="(labelKey, labelValue) in labels"\n        class="k8s-label" ng-if="!limit || $index < limit">\n    <span row class="label-pair" ng-if="clickable">\n      <a href="" class="label-key label truncate"\n         ng-click="filterAndNavigate(labelKey)"\n         ng-attr-title="All {{titleKind || kind}} with the label \'{{labelKey}}\' (any value)">{{labelKey}}</a><a\n        href="" class="label-value label truncate"\n        ng-click="filterAndNavigate(labelKey, labelValue)"\n        ng-attr-title="All {{titleKind || kind}} with the label \'{{labelKey}}={{labelValue}}\'">{{labelValue}}<span\n        ng-if="labelValue === \'\'"><em>&lt;empty&gt;</em></span></a>\n    </span>\n    <span row class="label-pair" ng-if="!clickable">\n      <span class="label-key label truncate">{{labelKey}}</span><span\n        class="label-value label truncate">{{labelValue}}</span>\n    </span>\n  </span>\n  <a href="" class="small" ng-click="limit = null"\n     ng-show="limit && limit < (labels | hashSize)"\n     style="padding-left: 5px; vertical-align: middle;">More labels...</a>\n</div>');
$templateCache.put('plugins/online/html/statusIcon.html','<span ng-switch="status" class="hide-ng-leave status-icon">\n  <span ng-switch-when="Cancelled" class="fa fa-ban text-muted" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Complete" class="fa fa-check text-success" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Completed" class="fa fa-check text-success" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Active" class="fa fa-refresh" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Error" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Failed" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="New" class="fa fa-hourglass-o" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Pending" class="fa fa-hourglass-half" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Ready" class="fa fa-check text-success" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Running" class="fa fa-refresh" aria-hidden="true" ng-class="[class, {\'fa-spin\' : spinning}]"></span>\n  <span ng-switch-when="Succeeded" class="fa fa-check text-success" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Bound" class="fa fa-check text-success" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Terminating" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Terminated" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Unknown" class="fa fa-question text-danger" aria-hidden="true" ng-class="class"></span>\n\n  <!-- Container Runtime States -->\n  <span ng-switch-when="Init Error" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="ContainerCreating" class="fa fa-hourglass-half" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="CrashLoopBackOff" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="ImagePullBackOff" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="ImageInspectError" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="ErrImagePull" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="ErrImageNeverPull" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="no matching container" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="RegistryUnavailable" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="RunContainerError" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="KillContainerError" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="VerifyNonRootError" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="SetupNetworkError" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="TeardownNetworkError" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="DeadlineExceeded" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="PodInitializing" class="fa fa-hourglass-half" aria-hidden="true" ng-class="class"></span>\n</span>');}]); hawtioPluginLoader.addModule("hawtio-online-templates");