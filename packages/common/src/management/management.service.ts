namespace Online {

  class ManagedPod {
    constructor(
      public pod,
      public jolokia: Jolokia.IJolokia,
    ) {
    }
  }

  export class ManagementService {

    private pods: { [key: string]: ManagedPod } = {};

    constructor(
      openShiftService: OpenShiftService,
    ) {
      'ngInject';

      openShiftService.on('changed', _ => {
        const pods = openShiftService.getPods();
        openShiftService.getPods().forEach(pod => {
          if (!this.pods[pod.metadata.uid]) {
            const port = 8778;
            const url = new URI().query('').path(`/master/api/v1/namespaces/${pod.metadata.namespace}/pods/https:${pod.metadata.name}:${port}/proxy/jolokia/`)
            this.pods[pod.metadata.uid] = new ManagedPod(pod, new Jolokia(url.valueOf()));
          } else {
            pod.management = this.pods[pod.metadata.uid].pod.management;
          }
          for (let uid in this.pods) {
            if (!pods.some(pod => pod.metadata.uid === uid)) {
              delete this.pods[uid];
            }
          }
        });
      });
    }
  }
}
