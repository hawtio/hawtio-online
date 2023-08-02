import Jolokia from 'jolokia.js'

class ManagedPod {
  readonly jolokia: Jolokia.IJolokia

  constructor(public pod: any, private openShiftService: OpenShiftService) {
    const port = this.jolokiaPort(pod)
    const path = getManagementJolokiaPath(pod, port)
    this.jolokia = new Jolokia(new URI().query('').path(path).valueOf())
  }

  private jolokiaPort(pod: any): number {
    const ports = jsonpath.query(pod, this.openShiftService.jolokiaPortQuery)
    return ports[0].containerPort || 8778
  }
}

export class ManagementService extends EventEmitter {

  private pods: { [key: string]: ManagedPod; } = {}

  constructor(
    openShiftService: OpenShiftService,
    podStatusFilter: PodStatusFilter,
    $interval: ng.IIntervalService,
  ) {
    'ngInject'

      super()

    openShiftService.on('changed', _ => {
      const pods = openShiftService.getPods()
      pods.forEach(pod => {
        const mPod = this.pods[pod.metadata.uid]
        if (!mPod) {
          this.pods[pod.metadata.uid] = new ManagedPod(pod, openShiftService)
        } else {
          pod.management = mPod.pod.management
          mPod.pod = pod
        }
        for (const uid in this.pods) {
          if (!pods.some(pod => pod.metadata.uid === uid)) {
            delete this.pods[uid]
          }
        }
      })
      // let's kick a polling cycle
      pollManagementData()
    })

    const pollManagementData = _.debounce(() => {
      let req = 0, res = 0
      for (const uid in this.pods) {
        const mPod: ManagedPod = this.pods[uid]
        if (podStatusFilter(mPod.pod) === 'Running') {
          req++
          mPod.jolokia.search('org.apache.camel:context=*,type=routes,*', {
            method: 'POST',
            success: (routes: []) => {
              res++
                Core.pathSet(mPod.pod, 'management.camel.routes_count', routes.length)
                if (res === req) {
                  this.emit('updated')
                }
              },
              error: error => {
                // TODO
                res++
                if (res === req) {
                  this.emit('updated')
                }
              },
            })
          }
        }
      }, 1000, { leading: false, trailing: true })

      // TODO: Use Jolokia polling preference
      $interval(() => pollManagementData(), 10000)
    }
  }
