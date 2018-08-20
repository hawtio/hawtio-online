namespace Online {

  export interface SelectorDirectiveScope extends ng.IScope {
    pods: any[];
    selectedPod: string;
  }

  export class PodsSelectorDirective implements ng.IDirective {

    template: string;
    openshift: OpenShiftService;

    constructor(
      openshift: OpenShiftService,
      private $window: ng.IWindowService,
    ) {
      'ngInject';
      this.openshift = openshift;
      this.template = `
        <div class="nav contextselector-pf">
          <select class="selectpicker" data-live-search="true" title="Loading..." required>
            <option ng-repeat="pod in pods" ng-selected="pod.metadata.name === selectedPod">{{pod.metadata.name}}</option>
          </select>
        </div>
      `;
    }

    link(scope: SelectorDirectiveScope, elem: JQuery) {
      scope.selectedPod = new URI().query(true)['con'];
      scope.pods = this.openshift.getPods();

      const getConnectUrl = function (pod) {
        const container = _.find(pod.spec.containers,
          container => container.ports.some(port => port.name === 'jolokia'));
        const port = _.find(container.ports, port => port.name === 'jolokia').containerPort;
        return new URI()
          .path('/integration/')
          .query({
            jolokiaUrl : new URI().query('').path(`/master/api/v1/namespaces/${pod.metadata.namespace}/pods/https:${pod.metadata.name}:${port}/proxy/jolokia/`),
            title      : pod.metadata.name,
            // returnTo   : new URI().toString(),
          })
          .valueOf();
      };

      const selector = elem.find('.selectpicker');

      selector.change(() => {
        const selected = selector.val();
        const pod = _.find(this.openshift.getPods(), pod => pod.metadata.name === selected);
        this.$window.location.href = getConnectUrl(pod);
      });

      const updatePodsPicker = () => selector.selectpicker('refresh');

      scope.$watchCollection('pods', function () {
        // wait for templates to render
        scope.$evalAsync(function () {
          updatePodsPicker();
        });
      });

      updatePodsPicker();
    }
  }
}
