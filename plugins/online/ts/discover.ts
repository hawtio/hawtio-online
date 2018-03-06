/// <reference path="onlinePlugin.ts"/>

module Online {

  declare var KubernetesAPI: any;

  angular.module(pluginName)
    .controller('Online.DiscoverController',
      ['$scope', '$location', '$window', '$element', 'K8SClientFactory', 'jsonpath', 'pfViewUtils', '$timeout',
        ($scope, $location, $window, $element, client/*: K8SClientFactory*/, jsonpath, pfViewUtils, $timeout) => {

          let loading = 0;

          $scope.pods = [];
          $scope.filteredPods = [];
          $scope.projects = [];
          $scope.loading = () => loading > 0;

          $scope.getStatusClasses = (pod, status) => {
            let styles;
            switch (status) {
              case 'Running':
                if (isPodReady(pod)) {
                  styles = $scope.viewType === 'listView'
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
            return $scope.viewType === 'listView'
              ? `list-view-pf-icon-md ${styles}`
              : `card-pf-aggregate-status-notification ${styles}`;
          }

          $element.on('$destroy', _ => $scope.$destroy());

          const applyFilters = filters => {
            $scope.filteredPods.length = 0;
            if (filters && filters.length > 0) {
              $scope.pods.forEach(pod => {
                if (_.every(filters, filter => matches(pod, filter))) {
                  $scope.filteredPods.push(pod);
                }
              });
            } else {
              $scope.filteredPods.push(...$scope.pods);
            }
            $scope.toolbarConfig.filterConfig.resultsCount = $scope.filteredPods.length;
            applySort();
          };

          const applySort = () => {
            $scope.filteredPods.sort((pod1, pod2) => {
              let value = 0;
              value = pod1.metadata.name.localeCompare(pod2.metadata.name);
              if (!$scope.toolbarConfig.sortConfig.isAscending) {
                value *= -1;
              }
              return value;
            })
          };

          const matches = (item, filter) => {
            let match = true;
            if (filter.id === 'name') {
              match = item.metadata.name.match(filter.value) !== null;
            } else if (filter.id === 'namespace') {
              match = item.metadata.namespace.match(filter.value) !== null;
            }
            return match;
          };

          const filterConfig = {
            fields : [
              {
                id          : 'name',
                title       : 'Name',
                placeholder : 'Filter by Name...',
                filterType  : 'text'
              },
            ],
            resultsCount   : $scope.filteredPods.length,
            appliedFilters : [],
            onFilterChange : applyFilters,
          };

          const sortConfig = {
            fields: [
              {
                id       : 'name',
                title    : 'Name',
                sortType : 'alpha',
              },
            ],
            onSortChange: applySort,
          };

          const viewsConfig: any = {
            views : [
              pfViewUtils.getListView(),
              pfViewUtils.getCardView(),
            ],
            onViewSelect : viewId => {
              $scope.viewType = viewId;
              if (viewId === 'cardView') {
                $timeout(function () {
                  $(".row-cards-pf > [class*='col'] > .card-pf .card-pf-title").matchHeight();
                  $(".row-cards-pf > [class*='col'] > .card-pf .card-pf-items").matchHeight();
                  $(".row-cards-pf > [class*='col'] > .card-pf .card-pf-info").matchHeight();
                  $(".row-cards-pf > [class*='col'] > .card-pf").matchHeight();
                }, 15, false);
              }
            }
          };
          viewsConfig.currentView = viewsConfig.views[0].id;
          $scope.viewType = viewsConfig.currentView;

          $scope.toolbarConfig = {
            filterConfig : filterConfig,
            sortConfig   : sortConfig,
            viewsConfig  : viewsConfig,
          };

          if ($window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
            filterConfig.fields.push(
              {
                id          : 'namespace',
                title       : 'Namespace',
                placeholder : 'Filter by Namespace...',
                filterType  : 'text',
              },
            );
          }

          $scope.open = url => {
            $window.open(url);
            return true;
          }

          if ($window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
            const projects = client.create('projects');
            const pods_watches = {};
            loading++;
            const projects_watch = projects.watch(projects => {
              // subscribe to pods update for new projects
              projects.filter(project => !$scope.projects.find(p => p.metadata.uid === project.metadata.uid))
                .forEach(project => {
                  loading++;
                  const pods = client.create('pods', project.metadata.name);
                  const pods_watch = pods.watch(pods => {
                    loading--;
                    const others = $scope.pods.filter(pod => pod.metadata.namespace !== project.metadata.name);
                    $scope.pods.length = 0;
                    $scope.pods.push(...others, ..._.filter(pods, pod => jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0));
                    applyFilters(filterConfig.appliedFilters);
                    // have to kick off a $digest here
                    $scope.$apply();
                  });
                  pods_watches[project.metadata.name] = {
                    request : pods,
                    watch   : pods_watch,
                  };
                  pods.connect();
                });

              // handle delete projects
              $scope.projects.filter(project => !projects.find(p => p.metadata.uid === project.metadata.uid))
                .forEach(project => {
                  const handle = pods_watches[project.metadata.name];
                  client.destroy(handle.request, handle.watch);
                  delete pods_watches[project.metadata.name];
                });

              $scope.projects.length = 0;
              $scope.projects.push(...projects);
              loading--;
            });
            $scope.$on('$destroy', _ => client.destroy(projects, projects_watch));

            projects.connect();
          } else {
            loading++;
            const pods = client.create('pods', $window.OPENSHIFT_CONFIG.hawtio.namespace);
            const pods_watch = pods.watch(pods => {
              loading--;
              $scope.pods.length = 0;
              $scope.pods.push(..._.filter(pods, pod => jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0));
              applyFilters(filterConfig.appliedFilters);
              // have to kick off a $digest here
              $scope.$apply();
            });
            $scope.$on('$destroy', _ => client.destroy(pods, pods_watch));

            pods.connect();
          }
        }
      ]
    )
    .filter('jolokiaContainers',
      () => containers => containers.filter(container => container.ports.some(port => port.name === 'jolokia')))
    .filter('jolokiaPort',
      () => container => container.ports.find(port => port.name === 'jolokia'))
    .filter('connectUrl', ['userDetails', userDetails => (pod, port = 8778) => new URI().path('/integration/')
      .hash(userDetails.token || '')
      .query({
        jolokiaUrl : new URI()
          .path(`/master/api/v1/namespaces/${pod.metadata.namespace}/pods/https:${pod.metadata.name}:${port}/proxy/jolokia/`),
        title     : pod.metadata.name,
        returnTo  : new URI().toString(),
      })])
    .filter('podDetailsUrl', () => pod => UrlHelpers.join(Core.pathGet(window, ['OPENSHIFT_CONFIG', 'openshift', 'master_uri']) || KubernetesAPI.masterUrl, 'console/project', pod.metadata.namespace, 'browse/pods', pod.metadata.name));
}
