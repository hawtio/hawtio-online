namespace Online {

  export class NavigationService {

    constructor(private openShiftService: OpenShiftService, private podStatusFilter: PodStatusFilter,
      private openShiftConsole: ConsoleService) {
      'ngInject'
    }

    isLoadingPods(): boolean {
      return this.openShiftService.isLoading()
    }

    getPods(): any[] {
      const isCluster = this.openShiftService.is(HawtioMode.Cluster)
      const pods = this.openShiftService.getPods()
        .filter(pod => this.podStatusFilter(pod) === 'Running')
      pods.forEach(pod => pod.label = (isCluster ? `${pod.metadata.namespace} - ` : '') + pod.metadata.name)
      pods.sort((podA, podB) => {
        const labelA = podA.label.toUpperCase()
        const labelB = podB.label.toUpperCase()
        if (labelA < labelB) {
          return -1
        } else if (labelA > labelB) {
          return 1
        } else {
          return 0
        }
      })
      return pods
    }

    getConnectUrl(pod: any) {
      const container = _.find(pod.spec.containers,
        container => container.ports.some(port => port.name === 'jolokia'))
      const port = _.find(container.ports, port => port.name === 'jolokia').containerPort
      const jolokiaPath = getManagementJolokiaPath(pod, port)
      return new URI()
        .path('/integration/')
        .query({
          jolokiaUrl: new URI().query('').path(jolokiaPath),
          title: pod.metadata.name,
          // returnTo   : new URI().toString(),
        })
        .valueOf()
    }

    disconnect() {
      this.openShiftService.disconnect()
    }

    getAppLauncherItems(): Nav.AppLauncherItem[] {
      const appLauncherItems = [
        { label: 'Home', url: new URI().query('').path('/online/').valueOf() }
      ] as Nav.AppLauncherItem[]
      if (this.openShiftConsole.enabled) {
        this.openShiftConsole.url.then(url => appLauncherItems.push(
          { label: 'OpenShift', url: url }
        ))
      }
      return appLauncherItems
    }
  }
}
