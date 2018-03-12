namespace Online {

  export function isPodReady(pod) {
    const conditions = Core.pathGet(pod, 'status.conditions');
    return !!conditions && conditions.some(c => c.type === 'Ready' && c.status === 'True');
  }
}