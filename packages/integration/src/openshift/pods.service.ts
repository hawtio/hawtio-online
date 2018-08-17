namespace Online {

  export class PodsService {

    private _loading = 0;
    private pods = [];

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
      const pods = this.K8SClientFactory.create('pods', this.$window.OPENSHIFT_CONFIG.hawtio.namespace);
      const pods_watch = pods.watch(pods => {
        this._loading--;
        this.pods.length = 0;
        this.pods.push(..._.filter(pods, pod => jsonpath.query(pod, '$.spec.containers[*].ports[?(@.name=="jolokia")]').length > 0));
      });

      // this.$scope.$on('$destroy', _ => this.K8SClientFactory.destroy(pods, pods_watch));

      pods.connect();
    }

    loading() {
      return this._loading > 0;
    }

    items() {
      return this.pods;
    }
  }
}
