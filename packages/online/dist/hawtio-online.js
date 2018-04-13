var Online;
(function (Online) {
    var DiscoverController = /** @class */ (function () {
        DiscoverController.$inject = ["$scope", "$window", "pfViewUtils", "K8SClientFactory"];
        function DiscoverController($scope, $window, pfViewUtils, K8SClientFactory) {
            'ngInject';
            this.$scope = $scope;
            this.$window = $window;
            this.pfViewUtils = pfViewUtils;
            this.K8SClientFactory = K8SClientFactory;
            this._loading = 0;
            this.pods = [];
            this.filteredPods = [];
            this.projects = [];
        }
        DiscoverController.prototype.$onInit = function () {
            var _this = this;
            var applyFilters = function (filters) {
                _this.filteredPods.length = 0;
                if (filters && filters.length > 0) {
                    _this.pods.forEach(function (pod) {
                        if (_.every(filters, function (filter) { return matches(pod, filter); })) {
                            _this.filteredPods.push(pod);
                        }
                    });
                }
                else {
                    (_a = _this.filteredPods).push.apply(_a, _this.pods);
                }
                _this.toolbarConfig.filterConfig.resultsCount = _this.filteredPods.length;
                applySort();
                var _a;
            };
            var applySort = function () {
                _this.filteredPods.sort(function (pod1, pod2) {
                    var value = 0;
                    value = pod1.metadata.name.localeCompare(pod2.metadata.name);
                    if (!_this.toolbarConfig.sortConfig.isAscending) {
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
                resultsCount: this.filteredPods.length,
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
            var viewsConfig = {
                views: [
                    this.pfViewUtils.getListView(),
                    this.pfViewUtils.getCardView(),
                ],
                onViewSelect: function (viewId) { return _this.viewType = viewId; }
            };
            viewsConfig.currentView = viewsConfig.views[0].id;
            this.viewType = viewsConfig.currentView;
            this.toolbarConfig = {
                filterConfig: filterConfig,
                sortConfig: sortConfig,
                viewsConfig: viewsConfig,
            };
            if (this.$window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
                filterConfig.fields.push({
                    id: 'namespace',
                    title: 'Namespace',
                    placeholder: 'Filter by Namespace...',
                    filterType: 'text',
                });
            }
            if (this.$window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
                var projects_1 = this.K8SClientFactory.create('projects');
                var pods_watches_1 = {};
                this._loading++;
                var projects_watch_1 = projects_1.watch(function (projects) {
                    // subscribe to pods update for new projects
                    projects.filter(function (project) { return !_this.projects.some(function (p) { return p.metadata.uid === project.metadata.uid; }); })
                        .forEach(function (project) {
                        _this._loading++;
                        var pods = _this.K8SClientFactory.create('pods', project.metadata.name);
                        var pods_watch = pods.watch(function (pods) {
                            _this._loading--;
                            var others = _this.pods.filter(function (pod) { return pod.metadata.namespace !== project.metadata.name; });
                            _this.pods.length = 0;
                            (_a = _this.pods).push.apply(_a, others.concat(_.filter(pods, function (pod) { return jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0; })));
                            applyFilters(filterConfig.appliedFilters);
                            // have to kick off a $digest here
                            _this.$scope.$apply();
                            var _a;
                        });
                        pods_watches_1[project.metadata.name] = {
                            request: pods,
                            watch: pods_watch,
                        };
                        pods.connect();
                    });
                    // handle delete projects
                    _this.projects.filter(function (project) { return !projects.some(function (p) { return p.metadata.uid === project.metadata.uid; }); })
                        .forEach(function (project) {
                        var handle = pods_watches_1[project.metadata.name];
                        _this.K8SClientFactory.destroy(handle.request, handle.watch);
                        delete pods_watches_1[project.metadata.name];
                    });
                    _this.projects.length = 0;
                    (_a = _this.projects).push.apply(_a, projects);
                    _this._loading--;
                    var _a;
                });
                this.$scope.$on('$destroy', function (_) { return _this.K8SClientFactory.destroy(projects_1, projects_watch_1); });
                projects_1.connect();
            }
            else {
                this._loading++;
                var pods_1 = this.K8SClientFactory.create('pods', this.$window.OPENSHIFT_CONFIG.hawtio.namespace);
                var pods_watch_1 = pods_1.watch(function (pods) {
                    _this._loading--;
                    _this.pods.length = 0;
                    (_a = _this.pods).push.apply(_a, _.filter(pods, function (pod) { return jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0; }));
                    applyFilters(filterConfig.appliedFilters);
                    // have to kick off a $digest here
                    _this.$scope.$apply();
                    var _a;
                });
                this.$scope.$on('$destroy', function (_) { return _this.K8SClientFactory.destroy(pods_1, pods_watch_1); });
                pods_1.connect();
            }
        };
        DiscoverController.prototype.loading = function () {
            return this._loading > 0;
        };
        DiscoverController.prototype.open = function (url) {
            this.$window.open(url);
            return true;
        };
        DiscoverController.prototype.getStatusClasses = function (pod, status) {
            var styles;
            switch (status) {
                case 'Running':
                    if (Online.isPodReady(pod)) {
                        styles = this.viewType === 'listView'
                            ? 'list-view-pf-icon-success'
                            : 'text-success';
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
            return this.viewType === 'listView'
                ? "list-view-pf-icon-md " + styles
                : "card-pf-aggregate-status-notification " + styles;
        };
        return DiscoverController;
    }());
    Online.DiscoverController = DiscoverController;
})(Online || (Online = {}));
var Online;
(function (Online) {
    var HttpSrcDirective = /** @class */ (function () {
        HttpSrcDirective.$inject = ["$http"];
        function HttpSrcDirective($http) {
            'ngInject';
            this.$http = $http;
        }
        HttpSrcDirective.prototype.link = function (scope, elem, attrs) {
            var _this = this;
            function revokeObjectURL() {
                if (scope.objectURL) {
                    URL.revokeObjectURL(scope.objectURL);
                }
            }
            scope.$watch('objectURL', function (objectURL) {
                elem.attr('src', objectURL);
            });
            scope.$on('$destroy', function () {
                revokeObjectURL();
            });
            attrs.$observe('httpSrc', function (url) {
                revokeObjectURL();
                if (url && url.indexOf('data:') === 0) {
                    scope.objectURL = url;
                }
                else if (url) {
                    _this.$http
                        .get(url, {
                        responseType: 'arraybuffer',
                        cache: true,
                        headers: {
                            accept: 'image/webp,image/*,*/*;q=0.8',
                        }
                    })
                        .then(function (response) {
                        var contentType = response.headers('Content-Type');
                        if (!contentType || !_.startsWith(contentType, 'image/')) {
                            throw Error("Invalid content type '" + contentType + "' for URL '" + url + "'");
                        }
                        var blob = new Blob([response.data], {
                            type: response.headers('Content-Type'),
                        });
                        scope.objectURL = URL.createObjectURL(blob);
                    })
                        .catch(function (error) {
                        scope.objectURL = 'img/java.svg';
                    });
                }
            });
        };
        return HttpSrcDirective;
    }());
    Online.HttpSrcDirective = HttpSrcDirective;
})(Online || (Online = {}));
var Online;
(function (Online) {
    var MatchHeightDirective = /** @class */ (function () {
        MatchHeightDirective.$inject = ["$timeout"];
        function MatchHeightDirective($timeout) {
            'ngInject';
            this.$timeout = $timeout;
        }
        MatchHeightDirective.prototype.link = function (scope) {
            this.$timeout(function () {
                $(".row-cards-pf > [class*='col'] > .card-pf .card-pf-title").matchHeight();
                $(".row-cards-pf > [class*='col'] > .card-pf .card-pf-items").matchHeight();
                $(".row-cards-pf > [class*='col'] > .card-pf .card-pf-info").matchHeight();
                $(".row-cards-pf > [class*='col'] > .card-pf").matchHeight();
            }, 0, false);
        };
        ;
        return MatchHeightDirective;
    }());
    Online.MatchHeightDirective = MatchHeightDirective;
})(Online || (Online = {}));
var Online;
(function (Online) {
    labelsDirective.$inject = ["$location", "$timeout"];
    Online.labelsModule = angular
        .module('hawtio-online-labels', [])
        .directive('labels', labelsDirective)
        .filter('hashSize', hashSizeFilter);
    function labelsDirective($location, $timeout) {
        'ngInject';
        return new Online.LabelsDirective($location, $timeout);
    }
    function hashSizeFilter() {
        return function (hash) { return !hash ? 0 : Object.keys(hash).length; };
    }
})(Online || (Online = {}));
var Online;
(function (Online) {
    var ConsoleService = /** @class */ (function () {
        ConsoleService.$inject = ["$http"];
        function ConsoleService($http) {
            'ngInject';
            var _this = this;
            this.$http = $http;
            $http({
                method: 'GET',
                url: new URI().query('').path('/console').toString(),
            }).then(function (response) {
                _this._url = response.headers('location');
                Online.log.debug('Using OpenShift Web console URL:', _this._url);
            }, function (error) {
                Online.log.debug('Unable to retrieve OpenShift Web console URL');
            });
        }
        Object.defineProperty(ConsoleService.prototype, "url", {
            get: function () {
                return this._url;
            },
            enumerable: true,
            configurable: true
        });
        return ConsoleService;
    }());
    Online.ConsoleService = ConsoleService;
})(Online || (Online = {}));
/// <reference path="console.service.ts"/>
var Online;
(function (Online) {
    Online.openshiftModule = angular
        .module('hawtio-online-openshift', [])
        .service('openShiftConsole', Online.ConsoleService);
})(Online || (Online = {}));
var Online;
(function (Online) {
    Online.statusModule = angular
        .module('hawtio-online-status', [])
        .directive('statusIcon', statusIconDirective)
        .filter('podStatus', podStatusFilter)
        .filter('humanizeReason', humanizeReasonFilter)
        .filter('humanizePodStatus', ["humanizeReasonFilter", function (humanizeReasonFilter) { return humanizeReasonFilter; }]);
    function statusIconDirective() {
        return {
            restrict: 'E',
            templateUrl: 'src/status/statusIcon.html',
            scope: {
                status: '=',
                disableAnimation: "@",
                class: '=',
            },
            link: function ($scope, $elem, $attrs) {
                $scope.spinning = !angular.isDefined($attrs.disableAnimation);
            }
        };
    }
    function humanizeReasonFilter() {
        return function (reason) { return _.startCase(reason).replace("Back Off", "Back-off").replace("O Auth", "OAuth"); };
    }
    function podStatusFilter() {
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
    }
})(Online || (Online = {}));
/// <reference path="discover.controller.ts"/>
/// <reference path="httpSrc.directive.ts"/>
/// <reference path="match-height.directive.ts"/>
/// <reference path="../labels/labels.module.ts"/>
/// <reference path="../openshift/openshift.module.ts"/>
/// <reference path="../status/status.module.ts"/>
var Online;
(function (Online) {
    matchHeightDirective.$inject = ["$timeout"];
    httpSrcDirective.$inject = ["$http"];
    connectUrlFilter.$inject = ["userDetails"];
    podDetailsUrlFilter.$inject = ["openShiftConsole"];
    Online.discoverModule = angular
        .module('hawtio-online-discover', [
        'angularMoment',
        'KubernetesAPI',
        'patternfly',
        Online.labelsModule.name,
        Online.openshiftModule.name,
        Online.statusModule.name,
    ])
        .controller('DiscoverController', Online.DiscoverController)
        .directive('matchHeight', matchHeightDirective)
        .directive('httpSrc', httpSrcDirective)
        .filter('jolokiaContainers', jolokiaContainersFilter)
        .filter('jolokiaPort', jolokiaPortFilter)
        .filter('connectUrl', connectUrlFilter)
        .filter('podDetailsUrl', podDetailsUrlFilter);
    function matchHeightDirective($timeout) {
        'ngInject';
        return new Online.MatchHeightDirective($timeout);
    }
    function httpSrcDirective($http) {
        'ngInject';
        return new Online.HttpSrcDirective($http);
    }
    function jolokiaContainersFilter() {
        return function (containers) { return containers.filter(function (container) { return container.ports.some(function (port) { return port.name === 'jolokia'; }); }); };
    }
    function jolokiaPortFilter() {
        return function (container) { return container.ports.find(function (port) { return port.name === 'jolokia'; }); };
    }
    function connectUrlFilter(userDetails) {
        'ngInject';
        return function (pod, port) {
            if (port === void 0) { port = 8778; }
            return new URI().path('/integration/')
                .query({
                jolokiaUrl: new URI().query('').path("/master/api/v1/namespaces/" + pod.metadata.namespace + "/pods/https:" + pod.metadata.name + ":" + port + "/proxy/jolokia/"),
                title: pod.metadata.name,
                returnTo: new URI().toString(),
            });
        };
    }
    function podDetailsUrlFilter(openShiftConsole) {
        'ngInject';
        return function (pod) { return UrlHelpers.join(openShiftConsole.url
            || UrlHelpers.join(Core.pathGet(window, ['OPENSHIFT_CONFIG', 'openshift', 'master_uri']), 'console'), 'project', pod.metadata.namespace, 'browse/pods', pod.metadata.name); };
    }
    hawtioPluginLoader.addModule(Online.discoverModule.name);
})(Online || (Online = {}));
/// <reference path="discover/discover.module.ts"/>
var Online;
(function (Online) {
    addRoutes.$inject = ["$routeProvider"];
    addOnlineTab.$inject = ["HawtioNav"];
    addLogoutToUserDropdown.$inject = ["HawtioExtension", "$compile", "userDetails"];
    addProductInfo.$inject = ["aboutService"];
    var module = angular
        .module('hawtio-online', ['hawtio-about'])
        .config(addRoutes)
        .run(addOnlineTab)
        .run(addLogoutToUserDropdown)
        .run(addProductInfo);
    function addRoutes($routeProvider) {
        'ngInject';
        $routeProvider
            .when('/online', { redirectTo: '/online/discover' })
            .when('/online/discover', { templateUrl: 'src/discover/discover.html' });
    }
    function addOnlineTab(HawtioNav) {
        'ngInject';
        var builder = HawtioNav.builder();
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
        HawtioNav.add(tab);
    }
    function addLogoutToUserDropdown(HawtioExtension, $compile, userDetails) {
        'ngInject';
        HawtioExtension.add('hawtio-logout', function ($scope) {
            $scope.userDetails = userDetails;
            var template = '<a href="" ng-click="userDetails.logout()">Logout</a>';
            return $compile(template)($scope);
        });
    }
    function addProductInfo(aboutService) {
        'ngInject';
        aboutService.addProductInfo('Hawtio Online', '1.3.0');
    }
    hawtioPluginLoader.addModule(module.name);
    Online.log = Logger.get(module.name);
})(Online || (Online = {}));
var Online;
(function (Online) {
    function isPodReady(pod) {
        var conditions = Core.pathGet(pod, 'status.conditions');
        return !!conditions && conditions.some(function (c) { return c.type === 'Ready' && c.status === 'True'; });
    }
    Online.isPodReady = isPodReady;
})(Online || (Online = {}));
var Online;
(function (Online) {
    var LabelsDirective = /** @class */ (function () {
        LabelsDirective.$inject = ["$location", "$timeout"];
        function LabelsDirective($location, $timeout) {
            'ngInject';
            this.restrict = 'E';
            this.scope = {
                labels: '=',
                // if you specify clickable, then everything below is required unless specified as optional
                clickable: "@?",
                kind: "@?",
                projectName: "@?",
                limit: '=?',
                titleKind: '@?',
                // title, it will put this string instead, e.g. if you want 'builds for build config foo'
                navigateUrl: '@?',
                filterCurrentPage: '=?',
            };
            this.templateUrl = 'plugins/online/labels/labels.html';
        }
        LabelsDirective.prototype.link = function (scope) {
            scope.filterAndNavigate = function (key, value) {
                if (scope.kind && scope.projectName) {
                    if (!scope.filterCurrentPage) {
                        this.$location.url(scope.navigateUrl || "/project/" + scope.projectName + "/browse/" + scope.kind);
                    }
                    this.$timeout(function () {
                        var selector = {};
                        selector[key] = value;
                        // LabelFilter.setLabelSelector(new LabelSelector(selector, true));
                    }, 1);
                }
            };
        };
        return LabelsDirective;
    }());
    Online.LabelsDirective = LabelsDirective;
})(Online || (Online = {}));

angular.module('hawtio-online-templates', []).run(['$templateCache', function($templateCache) {$templateCache.put('src/labels/labels.html','<div row wrap ng-if="(labels | hashSize) > 0">\n  <span row nowrap ng-repeat="(labelKey, labelValue) in labels"\n        class="k8s-label" ng-if="!limit || $index < limit">\n    <span row class="label-pair" ng-if="clickable">\n      <a href="" class="label-key label truncate"\n         ng-click="filterAndNavigate(labelKey)"\n         ng-attr-title="All {{titleKind || kind}} with the label \'{{labelKey}}\' (any value)">{{labelKey}}</a><a\n        href="" class="label-value label truncate"\n        ng-click="filterAndNavigate(labelKey, labelValue)"\n        ng-attr-title="All {{titleKind || kind}} with the label \'{{labelKey}}={{labelValue}}\'">{{labelValue}}<span\n        ng-if="labelValue === \'\'"><em>&lt;empty&gt;</em></span></a>\n    </span>\n    <span row class="label-pair" ng-if="!clickable">\n      <span class="label-key label truncate">{{labelKey}}</span><span\n        class="label-value label truncate">{{labelValue}}</span>\n    </span>\n  </span>\n  <a href="" class="small" ng-click="limit = null"\n     ng-show="limit && limit < (labels | hashSize)"\n     style="padding-left: 5px; vertical-align: middle;">More labels...</a>\n</div>');
$templateCache.put('src/discover/discover.html','<div ng-controller="DiscoverController as $ctrl">\n\n  <div class="title">\n    <h1>Pods</h1>\n  </div>\n\n  <pf-toolbar config="$ctrl.toolbarConfig"></pf-toolbar>\n\n  <div class="spinner spinner-lg loading-page" ng-if="$ctrl.loading()"></div>\n\n  <div class="blank-slate-pf no-border" ng-if="$ctrl.loading() === false && $ctrl.pods.length === 0">\n    <div class="blank-slate-pf-icon">\n      <span class="pficon pficon pficon-add-circle-o"></span>\n    </div>\n    <h1>\n      No Hawtio Containers\n    </h1>\n    <p>\n      There are no containers running with a port configured whose name is <code>jolokia</code>.\n    </p>\n  </div>\n\n  <div class="list-group list-view-pf list-view-pf-view"\n       ng-if="$ctrl.viewType == \'listView\'">\n    <div ng-repeat="pod in $ctrl.filteredPods" class="list-group-item list-view-pf-stacked">\n      <div class="list-view-pf-main-info">\n        <div class="list-view-pf-left">\n          <status-icon status="status = (pod | podStatus)"\n            class="$ctrl.getStatusClasses(pod, status)"\n            uib-tooltip="{{status | humanizePodStatus}}" tooltip-placement="bottom">\n          </status-icon>\n        </div>\n        <div class="list-view-pf-body">\n          <div class="list-view-pf-description">\n            <div class="list-group-item-heading">\n              {{pod.metadata.name}}\n            </div>\n            <div class="list-group-item-text">\n              <labels labels="pod.metadata.labels"\n                      project-name="{{pod.metadata.namespace}}"\n                      limit="3">\n              </labels>\n            </div>\n          </div>\n          <div class="list-view-pf-additional-info">\n            <div class="list-view-pf-additional-info-item">\n              <span class="pficon pficon-home"></span>\n              {{pod.metadata.namespace}}\n            </div>\n            <div class="list-view-pf-additional-info-item">\n              <span class="pficon pficon-container-node"></span>\n              {{pod.spec.nodeName || pod.status.hostIP}}\n            </div>\n            <div class="list-view-pf-additional-info-item">\n              <span class="pficon pficon-image"></span>\n              <strong>{{pod.spec.containers.length}}</strong>\n              <ng-pluralize count="containers.length" when="{\n                \'one\': \'container\',\n                \'other\': \'containers\'}">\n              </ng-pluralize>\n            </div>\n          </div>\n        </div>\n      </div>\n      <div class="list-view-pf-actions">\n        <button ng-if="(containers = (pod.spec.containers | jolokiaContainers)).length === 1"\n                class="btn btn-primary"\n                ng-click="$ctrl.open(pod | connectUrl: (containers[0] | jolokiaPort).containerPort)"\n                ng-disabled="status !== \'Running\'">\n          Connect\n        </button>\n        <div ng-if="containers.length > 1" class="dropdown">\n          <button class="btn btn-primary dropdown-toggle" type="button" data-toggle="dropdown"\n            ng-disabled="status !== \'Running\'">\n            Connect\n            <span class="caret"></span>\n          </button>\n          <ul class="dropdown-menu dropdown-menu-right" role="menu">\n            <li class="dropdown-header">Containers</li>\n            <li ng-repeat="container in containers" role="presentation">\n              <a role="menuitem" tabindex="-1" href="#"\n                ng-click="$ctrl.open(pod | connectUrl: (container | jolokiaPort).containerPort)">\n                {{container.name}}\n              </a>\n            </li>\n          </ul>\n        </div>\n        <div class="dropdown pull-right dropdown-kebab-pf">\n          <button class="btn btn-link dropdown-toggle" type="button" data-toggle="dropdown">\n            <span class="fa fa-ellipsis-v"></span>\n          </button>\n          <ul class="dropdown-menu dropdown-menu-right">\n            <li class="dropdown-header">OpenShift Console</li>\n            <li><a href="#" ng-click="$ctrl.open(pod | podDetailsUrl)">Open pod details</a></li>\n          </ul>\n        </div>\n      </div>\n    </div>\n  </div>\n\n  <div class="container-fluid container-cards-pf" ng-if="$ctrl.viewType == \'cardView\'">\n    <div class="row row-cards-pf">\n      <div ng-repeat="pod in $ctrl.filteredPods" match-height class="col-xs-12 col-sm-6 col-md-4 col-lg-3">\n        <div class="card-pf card-pf-view card-pf-view-select card-pf-view-single-select card-pf-aggregate-status">\n          <div class="card-pf-body">\n            <div class="card-pf-top-element">\n              <img ng-if="pod.metadata.annotations[\'fabric8.io/iconUrl\']"\n                class="card-pf-icon-circle"\n                http-src="/integration/{{pod.metadata.annotations[\'fabric8.io/iconUrl\']}}"\n                src="img/loader.svg"/>\n              <img ng-if="!pod.metadata.annotations[\'fabric8.io/iconUrl\']"\n                class="card-pf-icon-circle"\n                src="img/java.svg"/>\n            </div>\n            <h2 class="card-pf-title text-center">\n              {{pod.metadata.name}}\n            </h2>\n            <div class="card-pf-items text-center">\n              <div class="card-pf-item">\n                <span class="pficon pficon-home"></span>\n                <span class="card-pf-item-text">{{pod.metadata.namespace}}</span>\n              </div>\n              <div class="card-pf-item">\n                <span class="pficon pficon-image"></span>\n                <span class="card-pf-item-text">\n                  {{pod.spec.containers.length}}\n                </span>\n              </div>\n            </div>\n            <div class="card-pf-info text-center">\n              Created <span am-time-ago="pod.status.startTime" am-without-suffix="true"></span> ago\n              <!-- TODO: add aggregate status notifications -->\n              <p>\n                <status-icon status="status = (pod | podStatus)"\n                             class="$ctrl.getStatusClasses(pod, status)"></status-icon>\n                {{status | humanizePodStatus}}\n              </p>\n              <button ng-if="(containers = (pod.spec.containers | jolokiaContainers)).length === 1"\n                      class="btn btn-primary"\n                      ng-click="$ctrl.open(pod | connectUrl: (containers[0] | jolokiaPort).containerPort)"\n                      ng-disabled="status !== \'Running\'">\n                Connect\n              </button>\n              <div ng-if="containers.length > 1" class="dropdown">\n                <button class="btn btn-primary dropdown-toggle" type="button" data-toggle="dropdown"\n                  ng-disabled="status !== \'Running\'">\n                  Connect\n                  <span class="caret"></span>\n                </button>\n                <ul class="dropdown-menu dropdown-menu-right" role="menu">\n                  <li class="dropdown-header">Containers</li>\n                  <li ng-repeat="container in containers" role="presentation">\n                    <a role="menuitem" tabindex="-1" href="#"\n                      ng-click="$ctrl.open(pod | connectUrl: (container | jolokiaPort).containerPort)">\n                      {{container.name}}\n                    </a>\n                  </li>\n                </ul>\n              </div>\n            </div>\n          </div>\n        </div>\n      </div>\n    </div>\n  </div>\n</div>\n');
$templateCache.put('src/status/statusIcon.html','<span ng-switch="status" class="hide-ng-leave status-icon">\n  <span ng-switch-when="Cancelled" class="fa fa-ban text-muted" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Complete" class="fa fa-check text-success" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Completed" class="fa fa-check text-success" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Active" class="fa fa-refresh" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Error" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Failed" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="New" class="fa fa-hourglass-o" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Pending" class="fa fa-hourglass-half" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Ready" class="fa fa-check text-success" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Running" class="fa fa-refresh" aria-hidden="true" ng-class="[class, {\'fa-spin\' : spinning}]"></span>\n  <span ng-switch-when="Succeeded" class="fa fa-check text-success" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Bound" class="fa fa-check text-success" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Terminating" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Terminated" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="Unknown" class="fa fa-question text-danger" aria-hidden="true" ng-class="class"></span>\n\n  <!-- Container Runtime States -->\n  <span ng-switch-when="Init Error" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="ContainerCreating" class="fa fa-hourglass-half" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="CrashLoopBackOff" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="ImagePullBackOff" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="ImageInspectError" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="ErrImagePull" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="ErrImageNeverPull" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="no matching container" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="RegistryUnavailable" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="RunContainerError" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="KillContainerError" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="VerifyNonRootError" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="SetupNetworkError" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="TeardownNetworkError" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="DeadlineExceeded" class="fa fa-times text-danger" aria-hidden="true" ng-class="class"></span>\n  <span ng-switch-when="PodInitializing" class="fa fa-hourglass-half" aria-hidden="true" ng-class="class"></span>\n</span>');}]); hawtioPluginLoader.addModule("hawtio-online-templates");