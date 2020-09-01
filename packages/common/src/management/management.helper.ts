namespace Online {

  export function getManagementJolokiaPath(pod: any, port: number): string {
    const namespace = pod.metadata.namespace;
    const name = pod.metadata.name;
    const jolokiaPath = pod.metadata.annotations['hawt.io/jolokiaPath'] || '/jolokia';
    return `/management/namespaces/${namespace}/pods/https:${name}:${port}${jolokiaPath}`;
  }

}
