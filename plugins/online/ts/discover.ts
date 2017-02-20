/// <reference path="../../includes.ts"/>
/// <reference path="onlinePlugin.ts"/>

module Online {

  import K8SClientFactory = KubernetesAPI.K8SClientFactory;

  angular.module(pluginName)
    .controller('Online.DiscoverController',
      ['$scope', '$location', '$element', 'K8SClientFactory', 'jsonpath', 'userDetails',
        ($scope, $location, $element, client: K8SClientFactory, jsonpath, userDetails) => {

          $scope.pods         = [];
          $scope.filteredPods = [];
          $scope.loading      = true;

          const kubernetes = client.create('pods');
          const handle     = kubernetes.watch(pods => {
            $scope.loading     = false;
            $scope.pods.length = 0;
            $scope.pods.push(..._.filter(pods, pod => jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0));
            applyFilters($scope.filterConfig.appliedFilters);
            // have to kick off a $digest here
            $scope.$apply();
          });

          // client instances to an object collection are shared, important to use
          // the factory to destroy instances and avoid leaking memory
          $element.on('$destroy', _ => $scope.$destroy());
          $scope.$on('$destroy', _ => K8SClientFactory.destroy(kubernetes, handle));

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
              {
                id         : 'namespace',
                title      : 'Namespace',
                placeholder: 'Filter by Namespace...',
                filterType : 'text'
              }
            ],
            resultsCount  : $scope.filteredPods.length,
            appliedFilters: [],
            onFilterChange: applyFilters
          };

          $scope.toolbarConfig = {
            filterConfig: $scope.filterConfig,
          };

          $scope.connect = (pod, port = 8778) => {
            const jolokiaUrl = new URI(KubernetesAPI.masterUrl).segment('api/v1/namespaces')
              .segment(pod.metadata.namespace)
              .segment('pods')
              .segment(`https:${pod.metadata.name}:${port}`)
              .segment('proxy/jolokia');
            const connectUrl = new URI().path('/jmx');
            const returnTo   = new URI().toString();
            const title      = pod.metadata.name || 'Untitled Container';
            const token      = userDetails.token || '';
            connectUrl.hash(token).query({
              jolokiaUrl: jolokiaUrl,
              title     : title,
              returnTo  : returnTo
            });
            window.open(connectUrl.toString());
          };

          kubernetes.connect();
        }
      ]
    )
    .filter('jolokiaContainers',
      () => containers => containers.filter(container => container.ports.some(port => port.name === 'jolokia')))
    .filter('jolokiaPort',
      () => container => container.ports.find(port => port.name === 'jolokia'));
}
