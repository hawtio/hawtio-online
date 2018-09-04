namespace Online {

  export class OpenShiftService {

    private _loading = 0;
    private projects = [];
    private pods = [];
    private projects_client;
    private pods_client;
    private projects_watch;
    private pods_watch;

    constructor(
      private $window: ng.IWindowService,
      private K8SClientFactory: KubernetesAPI.K8SClientFactory,
    ) {
      'ngInject';

      if (this.$window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
        this.projects_client = this.K8SClientFactory.create('projects');
        const pods_watches = {};
        this._loading++;
        this.projects_watch = this.projects_client.watch(projects => {
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

        this.projects_client.connect();
      } else {
        this._loading++;
        this.pods_client = this.K8SClientFactory.create('pods', this.$window.OPENSHIFT_CONFIG.hawtio.namespace);
        this.pods_watch = this.pods_client.watch(pods => {
          this._loading--;
          this.pods.length = 0;
          this.pods.push(..._.filter(pods, pod => jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0));
        });

        this.pods_client.connect();
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

    disconnect() {
      if (this.$window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
        this.K8SClientFactory.destroy(this.projects_client, this.projects_watch);
      } else {
        this.K8SClientFactory.destroy(this.pods_client, this.pods_watch);
      }
    }
  }
}
