namespace Online {

  export class DiscoverController {

    private _loading = 0;
    private pods = [];
    private filteredPods = [];
    private projects = [];
    private toolbarConfig;
    private viewType;
    private openshiftConsoleUrl: string;

    constructor(
      private $scope: ng.IScope,
      private $window: ng.IWindowService,
      private pfViewUtils,
      private K8SClientFactory: KubernetesAPI.K8SClientFactory,
      openShiftConsole: ConsoleService,
    ) {
      'ngInject';
      openShiftConsole.url.then(url => this.openshiftConsoleUrl = url);
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

      if (this.$window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
        const projects = this.K8SClientFactory.create('projects');
        const pods_watches = {};
        this._loading++;
        const projects_watch = projects.watch(projects => {
          // subscribe to pods update for new projects
          projects.filter(project => !this.projects.some(p => p.metadata.uid === project.metadata.uid))
            .forEach(project => {
              this._loading++;
              const pods = this.K8SClientFactory.create('pods', project.metadata.name);
              const pods_watch = pods.watch(pods => {
                this._loading--;
                const others = this.pods.filter(pod => pod.metadata.namespace !== project.metadata.name);
                this.pods.length = 0;
                this.pods.push(...others, ..._.filter(pods, pod => jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0));
                applyFilters(filterConfig.appliedFilters);
                // have to kick off a $digest here
                this.$scope.$apply();
              });
              pods_watches[project.metadata.name] = {
                request : pods,
                watch   : pods_watch,
              };
              pods.connect();
            });

          // handle delete projects
          this.projects.filter(project => !projects.some(p => p.metadata.uid === project.metadata.uid))
            .forEach(project => {
              const handle = pods_watches[project.metadata.name];
              this.K8SClientFactory.destroy(handle.request, handle.watch);
              delete pods_watches[project.metadata.name];
            });

          this.projects.length = 0;
          this.projects.push(...projects);
          this._loading--;
        });
        this.$scope.$on('$destroy', _ => this.K8SClientFactory.destroy(projects, projects_watch));

        projects.connect();
      } else {
        this._loading++;
        const pods = this.K8SClientFactory.create('pods', this.$window.OPENSHIFT_CONFIG.hawtio.namespace);
        const pods_watch = pods.watch(pods => {
          this._loading--;
          this.pods.length = 0;
          this.pods.push(..._.filter(pods, pod => jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0));
          applyFilters(filterConfig.appliedFilters);
          // have to kick off a $digest here
          this.$scope.$apply();
        });
        this.$scope.$on('$destroy', _ => this.K8SClientFactory.destroy(pods, pods_watch));

        pods.connect();
      }
    }

    loading() {
      return this._loading > 0;
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