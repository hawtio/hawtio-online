namespace Online {

  export function isPodReady(pod) {
    const conditions = Core.pathGet(pod, 'status.conditions');
    return !!conditions && conditions.some(c => c.type === 'Ready' && c.status === 'True');
  }

  export function getPodClasses(pod, { status, viewType = 'listView' }) {
    let styles;
    switch (status) {
      case 'Running':
        if (isPodReady(pod)) {
          styles = viewType === 'listView'
            ? 'list-view-pf-icon-success'
            : 'text-success';
        }
        break;
      case 'Complete':
      case 'Completed':
      case 'Succeeded':
        styles = 'list-view-pf-icon-success';
        break;
      case 'Error':
      case 'Terminating':
      case 'Terminated':
      case 'Unknown':
        styles = 'list-view-pf-icon-danger';
        break;
      default:
       styles = 'list-view-pf-icon-info';
    }
    return viewType === 'listView'
      ? `list-view-pf-icon-md ${styles}`
      : `card-pf-aggregate-status-notification ${styles}`;
  }
}