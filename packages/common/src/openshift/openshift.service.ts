namespace Online {

  export enum HawtioMode {
    Cluster = 'cluster',
    Namespace = 'namespace',
  }

  interface Client {
    collection: KubernetesAPI.Collection;
    watch: (data: any[]) => void;
  }

  export class OpenShiftService {

    private _loading = 0;
    private projects = [];
    private pods = [];
    private projects_client: Client;
    private pods_clients: { [key: string]: Client } = {};

    constructor(
      private $window: ng.IWindowService,
      private K8SClientFactory: KubernetesAPI.K8SClientFactory,
    ) {
      'ngInject';

      if (this.is(HawtioMode.Cluster)) {
        const projects_client = this.K8SClientFactory.create('projects');
        this._loading++;
        const projects_watch = projects_client.watch(projects => {
          // subscribe to pods update for new projects
          projects.filter(project => !this.projects.some(p => p.metadata.uid === project.metadata.uid))
            .forEach(project => {
              this._loading++;
              const pods_client = this.K8SClientFactory.create('pods', project.metadata.name);
              const pods_watch = pods_client.watch(pods => {
                this._loading--;
                const others = this.pods.filter(pod => pod.metadata.namespace !== project.metadata.name);
                this.pods.length = 0;
                this.pods.push(...others, ..._.filter(pods, pod => jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0));
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
        const pods_client = this.K8SClientFactory.create('pods', namespace);
        const pods_watch = pods_client.watch(pods => {
          this._loading--;
          this.pods.length = 0;
          this.pods.push(..._.filter(pods, pod => jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0));
        });

        this.pods_clients[namespace] = { collection: pods_client, watch: pods_watch };
        pods_client.connect();
      }
    }

    isLoading() {
      return this._loading > 0;
    }

    getPods() {
      return this.pods;
    }

    getProjects() {
      return this.projects;
    }

    is(mode: HawtioMode): boolean {
      return mode === this.$window.OPENSHIFT_CONFIG.hawtio.mode;
    }

    disconnect() {
      if (this.$window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
        this.K8SClientFactory.destroy(this.projects_client.collection, this.projects_client.watch);
      }
      _.values(this.pods_clients).forEach(({ collection, watch }) => {
        this.K8SClientFactory.destroy(collection, watch);
      })
    }
  }
}
