namespace Online {

  export interface SelectorDirectiveScope extends ng.IScope {
    selected: string;
  }

  export class PodsSelectorDirective implements ng.IDirective {

    restrict = 'E';
    scope = {
      selected: '=',
    };
    template: string;

    constructor(
      private openshift: OpenShiftService,
      private $window: ng.IWindowService,
      private podStatusFilter: PodStatusFilter,
    ) {
      'ngInject';
      this.template = `
        <div class="nav contextselector-pf">
          <select class="selectpicker"
            dropupAuto="false"
            data-live-search="true">
          </select>
        </div>
      `;
    }

    link(scope: SelectorDirectiveScope, elem: JQuery) {
      const pods = this.openshift.getPods();
      const projects = this.openshift.getProjects();
      scope.selected = new URI().query(true)['con'];

      scope.$on('$destroy', _ => this.openshift.disconnect());

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

      const podOption = pod => $('<option>')
        .attr('value', pod.metadata.name)
        .attr('disabled', this.podStatusFilter(pod) !== 'Running' ? '' : null)
        .attr('selected', pod.metadata.name === scope.selected ? '' : null)
        .text(pod.metadata.name);

      const updateNamespaceMode = () => {
        selector.empty();
        pods.forEach(pod => selector.append(podOption(pod)));
        selector.selectpicker('refresh');
      };

      const updateClusterMode = () => {
        selector.empty();
        projects.forEach(project => {
          const group = $('<optgroup>').attr('label', project.metadata.name);
          pods
            .filter(pod => pod.metadata.namespace === project.metadata.name)
            .forEach(pod => group.append(podOption(pod)));
          selector.append(group);
        });
        selector.selectpicker('refresh');
      };

      const updateSelectPicker = this.openshift.is(HawtioMode.Cluster)
        ? updateClusterMode
        : updateNamespaceMode;

      scope.$watch(() => this.openshift.isLoading(), loading => {
        selector.selectpicker({ 'title': loading ? 'Loading...' : 'Select a container...' });
        updateSelectPicker();
      });

      scope.$watchCollection(() => pods, function () {
        // wait for templates to render
        scope.$evalAsync(function () {
          updateSelectPicker();
        });
      });

      updateSelectPicker();
    }
  }
}
