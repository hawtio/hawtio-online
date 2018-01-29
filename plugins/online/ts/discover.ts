/// <reference path="onlinePlugin.ts"/>

module Online {

  declare var KubernetesAPI: any;

  angular.module(pluginName)
    .controller('Online.DiscoverController',
      ['$scope', '$location', '$window', '$element', 'K8SClientFactory', 'jsonpath',
        ($scope, $location, $window, $element, client/*: K8SClientFactory*/, jsonpath) => {

          let loading = 0;

          $scope.pods = [];
          $scope.filteredPods = [];
          $scope.projects = [];
          $scope.loading = () => loading > 0;

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

          $scope.filterConfig = {
            fields        : [
              {
                id         : 'name',
                title      : 'Name',
                placeholder: 'Filter by Name...',
                filterType : 'text'
              },
            ],
            resultsCount  : $scope.filteredPods.length,
            appliedFilters: [],
            onFilterChange: applyFilters
          };

          if ($window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
            $scope.filterConfig.fields.push(
              {
                id         : 'namespace',
                title      : 'Namespace',
                placeholder: 'Filter by Namespace...',
                filterType : 'text'
              },
            );
          }

          $scope.toolbarConfig = {
            filterConfig: $scope.filterConfig,
          };

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
                    applyFilters($scope.filterConfig.appliedFilters);
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
              applyFilters($scope.filterConfig.appliedFilters);
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
    .filter('connectUrl', ['userDetails', userDetails => (pod, port = 8778) => new URI().path('/integration')
      .hash(userDetails.token || '')
      .query({
        jolokiaUrl: new URI(KubernetesAPI.masterUrl)
          .segment('api/v1/namespaces')
          .segment(pod.metadata.namespace)
          .segment('pods')
          .segment(`https:${pod.metadata.name}:${port}`)
          .segment('proxy/jolokia'),
        title     : pod.metadata.name || 'Untitled Container',
        returnTo  : new URI().toString(),
      })])
    .filter('podDetailsUrl', () => pod => UrlHelpers.join(KubernetesAPI.masterUrl, 'console/project', pod.metadata.namespace, 'browse/pods', pod.metadata.name));
}
