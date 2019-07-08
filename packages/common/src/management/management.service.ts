namespace Online {

  class ManagedPod {
    constructor(
      public pod,
      public jolokia: Jolokia.IJolokia,
    ) {
    }
  }

  export class ManagementService extends EventEmitter {

    private pods: { [key: string]: ManagedPod } = {};

    constructor(
      openShiftService: OpenShiftService,
      podStatusFilter: PodStatusFilter,
      $interval: ng.IIntervalService,
    ) {
      'ngInject';

      super();

      openShiftService.on('changed', _ => {
        const pods = openShiftService.getPods();
        openShiftService.getPods().forEach(pod => {
          const mPod = this.pods[pod.metadata.uid];
          if (!mPod) {
            // FIXME: read Jolokia port from container spec
            const port = 8778;
            const url = new URI().query('').path(`/management/namespaces/${pod.metadata.namespace}/pods/https:${pod.metadata.name}:${port}/jolokia`)
            this.pods[pod.metadata.uid] = new ManagedPod(pod, new Jolokia(url.valueOf()));
          } else {
            pod.management = mPod.pod.management;
            mPod.pod = pod;
          }
          for (let uid in this.pods) {
            if (!pods.some(pod => pod.metadata.uid === uid)) {
              delete this.pods[uid];
            }
          }
        });
        // let's kick a polling cycle
        pollManagementData();
      });

      const pollManagementData = _.debounce(() => {
        let req = 0, res = 0;
        for (let uid in this.pods) {
          const mPod: ManagedPod = this.pods[uid];
          if (podStatusFilter(mPod.pod) === 'Running') {
            req++;
            mPod.jolokia.search('org.apache.camel:context=*,type=routes,*', {
              success: (routes:[]) => {
                res++;
                Core.pathSet(mPod.pod, 'management.camel.routes_count', routes.length);
                if (res === req) {
                  this.emit('updated');
                }
              },
              error: error => {
                // TODO
                res++;
                if (res === req) {
                  this.emit('updated');
                }
              },
           });
          }
        }
      }, 1000, { leading: false, trailing: true });

      // TODO: Use Jolokia polling preference
      $interval(() => pollManagementData(), 10000);
    }
  }
}
