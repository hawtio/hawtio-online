namespace Online {

  export type Pod = {
    metadata: {
      namespace: string;
      name: string;
      annotations?: {
        [key: string]: string;
      };
    };
  };

  export function getManagementJolokiaPath(pod: Pod, port: number): string {
    const namespace = pod.metadata.namespace
    const name = pod.metadata.name
    const protocol = getAnnotation(pod, 'hawt.io/protocol', 'https')
    const jolokiaPath = getAnnotation(pod, 'hawt.io/jolokiaPath', '/jolokia')
    return `/management/namespaces/${namespace}/pods/${protocol}:${name}:${port}${jolokiaPath}`
  }

  function getAnnotation(pod: Pod, name: string, defaultValue: string): string {
    if (pod.metadata.annotations && pod.metadata.annotations[name]) {
      return pod.metadata.annotations[name]
    }
    return defaultValue
  }

}
