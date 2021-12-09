namespace Online {

  const log = Logger.get('hawtio-online-openshift');

  export enum HawtioMode {
    Cluster = 'cluster',
    Namespace = 'namespace',
  }

  interface Client {
    collection: KubernetesAPI.Collection;
    watch: (data: any[]) => void;
  }

  export class OpenShiftService extends EventEmitter {

    readonly jolokiaPortQuery = '$.spec.containers[*].ports[?(@.name=="jolokia")]';

    private _loading = 0;
    private projects: any[] = [];
    private pods: any[] = [];
    private projects_client: Client;
    private pods_clients: { [key: string]: Client; } = {};

    constructor(
      private $window: ng.IWindowService,
      private K8SClientFactory: KubernetesAPI.K8SClientFactory,
      private $q: ng.IQService,
      private configManager: Core.ConfigManager,
    ) {
      'ngInject';

      super();

      if (this.is(HawtioMode.Cluster)) {
        const projects_client = this.K8SClientFactory.create(
          {
            kind: KubernetesAPI.WatchTypes.PROJECTS,
            labelSelector: _.get(configManager.config, "online.projectSelector", null),
          }
        );
        this._loading++;
        const projects_watch = projects_client.watch(projects => {
          // subscribe to pods update for new projects
          projects.filter(project => !this.projects.some(p => p.metadata.uid === project.metadata.uid))
            .forEach(project => {
              this._loading++;
              const pods_client = this.K8SClientFactory.create(KubernetesAPI.WatchTypes.PODS, project.metadata.name);
              const pods_watch = pods_client.watch(pods => {
                this._loading--;
                const others = this.pods.filter(pod => pod.metadata.namespace !== project.metadata.name);
                this.pods.length = 0;
                const jolokiaPods = _.filter(pods, pod => jsonpath.query(pod, this.jolokiaPortQuery).length > 0);
                this.pods.push(...others, ...jolokiaPods);
                this.emit('changed');
              });
              this.pods_clients[project.metadata.name] = {
                collection: pods_client,
                watch: pods_watch,
              };
              pods_client.connect();
            });

          // handle delete projects
          this.projects.filter(project => !projects.some(p => p.metadata.uid === project.metadata.uid))
            .forEach(project => {
              const handle = this.pods_clients[project.metadata.name];
              this.K8SClientFactory.destroy(handle.collection, handle.watch);
              delete this.pods_clients[project.metadata.name];
            });

          this.projects.length = 0;
          this.projects.push(...projects);
          this._loading--;
        });

        this.projects_client = { collection: projects_client, watch: projects_watch };
        projects_client.connect();
      } else {
        this._loading++;
        const namespace = this.$window.OPENSHIFT_CONFIG.hawtio.namespace;
        const pods_client = this.K8SClientFactory.create(KubernetesAPI.WatchTypes.PODS, namespace);
        const pods_watch = pods_client.watch(pods => {
          this._loading--;
          this.pods.length = 0;
          const jolokiaPods = _.filter(pods, pod => jsonpath.query(pod, this.jolokiaPortQuery).length > 0);
          this.pods.push(...jolokiaPods);
          this.emit('changed');
        });

        this.pods_clients[namespace] = { collection: pods_client, watch: pods_watch };
        pods_client.connect();
      }
    }

    isLoading(): boolean {
      return this._loading > 0;
    }

    getPods(): any[] {
      return this.pods;
    }

    getProjects(): any[] {
      return this.projects;
    }

    getClusterVersion(): ng.IPromise<string | undefined> {
      if (!this.$window.OPENSHIFT_CONFIG || !this.$window.OPENSHIFT_CONFIG.openshift) {
        return this.$q.resolve(undefined);
      }
      const cluster_version = this.$window.OPENSHIFT_CONFIG.openshift.cluster_version;
      // We may want to get the ClusterVersion resource using the Config API available in OpenShift 4
      return this.$q.resolve(cluster_version);
    }

    is(mode: HawtioMode): boolean {
      return mode === this.$window.OPENSHIFT_CONFIG.hawtio.mode;
    }

    disconnect(): void {
      if (this.$window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
        this.K8SClientFactory.destroy(this.projects_client.collection, this.projects_client.watch);
      }
      _.values(this.pods_clients).forEach(({ collection, watch }) => {
        this.K8SClientFactory.destroy(collection, watch);
      });
    }
  }
}
