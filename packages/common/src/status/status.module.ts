namespace Online {

  export const statusModule = angular
    .module('hawtio-online-status', [])
    .directive('statusIcon', statusIconDirective)
    .filter('podStatus', podStatusFilter)
    .filter('humanizeReason', humanizeReasonFilter)
    .filter('humanizePodStatus', humanizeReasonFilter => humanizeReasonFilter)
    .name

  export interface PodStatusFilter {
    (pod: object): string;
  }

  function statusIconDirective() {
    return {
      restrict: 'E',
      templateUrl: 'src/status/statusIcon.html',
      scope: {
        status: '=',
        disableAnimation: "@",
        class: '=',
      },
      link: function ($scope: any, $elem, $attrs) {
        $scope.spinning = !angular.isDefined($attrs.disableAnimation)
      }
    }
  }

  function humanizeReasonFilter() {
    return reason => _.startCase(reason).replace('Back Off', 'Back-off').replace('O Auth', 'OAuth')
  }

  function podStatusFilter() {
    // Return results that match
    // https://github.com/openshift/origin/blob/master/vendor/k8s.io/kubernetes/pkg/printers/internalversion/printers.go#L523-L615
    return function (pod) {
      if (!pod || (!pod.metadata.deletionTimestamp && !pod.status)) {
        return ''
      }

      if (pod.metadata.deletionTimestamp) {
        return 'Terminating'
      }

      let initializing = false
      let reason

      // Print detailed container reasons if available. Only the first will be
      // displayed if multiple containers have this detail.

      _.each(pod.status.initContainerStatuses, function (initContainerStatus) {
        const initContainerState = _.get(initContainerStatus, 'state')

        if (initContainerState.terminated && initContainerState.terminated.exitCode === 0) {
          // initialization is complete
          return
        }

        if (initContainerState.terminated) {
          // initialization is failed
          if (!initContainerState.terminated.reason) {
            if (initContainerState.terminated.signal) {
              reason = 'Init Signal: ' + initContainerState.terminated.signal
            } else {
              reason = 'Init Exit Code: ' + initContainerState.terminated.exitCode
            }
          } else {
            reason = 'Init ' + initContainerState.terminated.reason
          }
          initializing = true
          return true
        }

        if (initContainerState.waiting && initContainerState.waiting.reason && initContainerState.waiting.reason !== 'PodInitializing') {
          reason = 'Init ' + initContainerState.waiting.reason
          initializing = true
        }
      })

      if (!initializing) {
        reason = pod.status.reason || pod.status.phase

        _.each(pod.status.containerStatuses, function (containerStatus) {
          let containerReason = _.get(containerStatus, 'state.waiting.reason') || _.get(containerStatus, 'state.terminated.reason'),
            signal,
            exitCode

          if (containerReason) {
            reason = containerReason
            return true
          }

          signal = _.get(containerStatus, 'state.terminated.signal')
          if (signal) {
            reason = 'Signal: ' + signal
            return true
          }

          exitCode = _.get(containerStatus, 'state.terminated.exitCode')
          if (exitCode) {
            reason = 'Exit Code: ' + exitCode
            return true
          }
        })
      }

      return reason
    }
  }
}
