namespace Online {

  export class OpenShiftService {

    private _loading = 0;
    private pods = [];
    private pods_client;
    private pods_watch;

    constructor(
      private $window: ng.IWindowService,
      private K8SClientFactory: KubernetesAPI.K8SClientFactory,
    ) {
      'ngInject';

      if (this.$window.OPENSHIFT_CONFIG.hawtio.mode === 'cluster') {
        // TODO
        return;
      }

      this._loading++;
      this.pods_client = this.K8SClientFactory.create('pods', this.$window.OPENSHIFT_CONFIG.hawtio.namespace);
      this.pods_watch = this.pods_client.watch(pods => {
        this._loading--;
        this.pods.length = 0;
        this.pods.push(..._.filter(pods, pod => jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0));
      });

      this.pods_client.connect();
    }

    isLoading() {
      return this._loading > 0;
    }

    getPods() {
      return this.pods;
    }

    disconnect() {
      this.K8SClientFactory.destroy(this.pods_client, this.pods_watch);
    }
  }
}
