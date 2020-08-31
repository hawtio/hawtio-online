namespace Online {

  export class DiscoverController {

    private pods = [];
    private filteredPods = [];
    private toolbarConfig;
    private viewType: ViewType;

    constructor(
      private $scope: ng.IScope,
      private $window: ng.IWindowService,
      private pfViewUtils,
      private openShiftService: OpenShiftService,
      managementService: ManagementService,
    ) {
      'ngInject';
      this.pods = this.openShiftService.getPods();

      const update = _.debounce(() => {
        Core.$digest(this.$scope);
        this.$scope.$broadcast('matchHeight');
      }, 100, { leading: true, trailing: true });

      openShiftService.on('changed', update);
      managementService.on('updated', update);
    }

    $onInit() {
      this.$scope.$emit(Page.CLOSE_MAIN_NAV_EVENT);

      const filters = (pods: any[]) => {
        const filters = filterConfig.appliedFilters;
        if (!filters || filters.length === 0) {
          return pods;
        }
        const filteredPods = [];
        pods.forEach(pod => {
          if (pod.deployment) {
            const replicas = pod.replicas
              .filter(replica => _.every(filters, filter => matches(replica, filter)));
            if (replicas.length > 0) {
              pod.replicas = replicas;
              filteredPods.push(pod);
            }
          } else {
            if (_.every(filters, filter => matches(pod, filter))) {
              filteredPods.push(pod);
            }
          }
        });
        return filteredPods;
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

      const sortPods = (pods: any[]) => {
        pods.sort((pod1, pod2) => {
          let value = 0;
          value = pod1.metadata.name.localeCompare(pod2.metadata.name);
          if (!this.toolbarConfig.sortConfig.isAscending) {
            value *= -1;
          }
          return value;
        });
      };

      const groupPodsByDeployment = (pods: any[], previousGroupedPods: any[]) => {
        const groupedPods = [];
        for (let i = 0; i < pods.length; i++) {
          const pod = pods[i];
          const owner = _.get(pod, 'metadata.ownerReferences[0].uid', null);
          if (!owner) {
            groupedPods.push(pod);
            continue;
          }
          let j = 0, uid;
          if (i < pods.length - 1) {
            do {
              const p = pods[i + j + 1];
              uid = _.get(p, 'metadata.ownerReferences[0].uid', null);
            } while (uid === owner && i + j++ < pods.length - 1);
          }
          const previous = _.find(previousGroupedPods, {
            owner      : owner,
            namespace  : pod.metadata.namespace,
            deployment : pod.metadata.ownerReferences[0].name,
          });
          groupedPods.push(
            {
              owner      : owner,
              config     : _.get(pod, ['metadata', 'annotations', 'openshift.io/deployment-config.name'], null),
              version    : _.get(pod, ['metadata', 'annotations', 'openshift.io/deployment-config.latest-version'], null),
              deployment : pod.metadata.ownerReferences[0].name,
              namespace  : pod.metadata.namespace,
              replicas   : pods.slice(i, i + j + 1),
              expanded   : previous ? previous.expanded : true,
            });
          i += j;
        }
        return groupedPods;
      };

      let groupedPods = [];

      const applyFilters = () => {
        this.filteredPods.length = 0;
        this.filteredPods.push(...filters(groupedPods));
        this.toolbarConfig.filterConfig.resultsCount = resultCount();
      };

      const updateView = () => {
        const sortedPods = [];
        sortedPods.push(...this.pods);
        sortPods(sortedPods);
        groupedPods = groupPodsByDeployment(sortedPods, groupedPods);
        applyFilters();
      };

      const resultCount = () => this.filteredPods
        .reduce((count, pod) => pod.deployment ? count += pod.replicas.length : count++, 0);

      const filterConfig = {
        fields : [
          {
            id          : 'name',
            title       : 'Name',
            placeholder : 'Filter by Name...',
            filterType  : 'text'
          },
        ],
        resultsCount   : resultCount(),
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
        onSortChange: _ => updateView(),
      };

      const viewsConfig: any = {
        views : [
          this.pfViewUtils.getListView(),
          this.pfViewUtils.getCardView(),
        ],
        onViewSelect : viewId => this.viewType = viewId
      };
      viewsConfig.currentView = viewsConfig.views[0].id;
      this.viewType = viewsConfig.currentView;

      this.toolbarConfig = {
        filterConfig : filterConfig,
        sortConfig   : sortConfig,
        viewsConfig  : viewsConfig,
      };

      if (this.$window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
        filterConfig.fields.push(
          {
            id          : 'namespace',
            title       : 'Namespace',
            placeholder : 'Filter by Namespace...',
            filterType  : 'text',
          },
        );
      }

      this.$scope.$watchCollection(() => this.pods, function () {
        updateView();
      });

      this.$scope.$on('$destroy', _ => this.openShiftService.disconnect());
    }

    flatten(pods: any[]) {
      return pods.reduce((res, pod) => {
        res.push(...pod.deployment ? pod.replicas : pod);
        return res;
      }, []);
    }

    loading() {
      return this.openShiftService.isLoading();
    }
  }
}
