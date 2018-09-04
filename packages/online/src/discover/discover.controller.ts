namespace Online {

  export class DiscoverController {

    private pods = [];
    private filteredPods = [];
    private toolbarConfig;
    private viewType;
    private openshiftConsoleUrl: string;

    constructor(
      private $scope: ng.IScope,
      private $window: ng.IWindowService,
      private pfViewUtils,
      private openShiftService: OpenShiftService,
      openShiftConsole: ConsoleService,
    ) {
      'ngInject';
      openShiftConsole.url.then(url => this.openshiftConsoleUrl = url);
      this.pods = this.openShiftService.getPods();
    }

    $onInit() {
      const applyFilters = filters => {
        this.filteredPods.length = 0;
        if (filters && filters.length > 0) {
          this.pods.forEach(pod => {
            if (_.every(filters, filter => matches(pod, filter))) {
              this.filteredPods.push(pod);
            }
          });
        } else {
          this.filteredPods.push(...this.pods);
        }
        this.toolbarConfig.filterConfig.resultsCount = this.filteredPods.length;
        applySort();
      };

      const applySort = () => {
        this.filteredPods.sort((pod1, pod2) => {
          let value = 0;
          value = pod1.metadata.name.localeCompare(pod2.metadata.name);
          if (!this.toolbarConfig.sortConfig.isAscending) {
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
        resultsCount   : this.filteredPods.length,
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
        applyFilters(filterConfig.appliedFilters);
      });

      this.$scope.$on('$destroy', _ => this.openShiftService.disconnect());
    }

    loading() {
      return this.openShiftService.isLoading();
    }

    open(url) {
      this.$window.open(url);
      return true;
    }

    getStatusClasses(pod, status) {
      let styles;
      switch (status) {
        case 'Running':
          if (isPodReady(pod)) {
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
        ? `list-view-pf-icon-md ${styles}`
        : `card-pf-aggregate-status-notification ${styles}`;
    }
  }
}