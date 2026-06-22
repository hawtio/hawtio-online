const DEFAULT_KUBE_CLUSTER_ADDRESS = 'https://kubernetes.default'

export interface SSLOptions {
  certCA: Buffer
  proxyKey: Buffer
  proxyCert: Buffer
}

export class GatewayConfig {
  private external = false
  private isOpenShift = false
  private kubeClusterAddr = DEFAULT_KUBE_CLUSTER_ADDRESS
  private proxySSLOptions?: SSLOptions
  private formAuth = true
  private rbacAcl?: string
  private rbacRegEnabled = true
  private maskIpAddr = false

  constructor() {}

  /*
   * Is the gateway external or internal to a kubernetes cluster
   */
  isExternal() {
    return this.external
  }

  setExternal(external: boolean) {
    this.external = external
  }

  /*
   * Is the cluster used openshift
   */
  isOpenShiftCluster(): boolean {
    return this.isOpenShift
  }

  setIsOpenShiftCluster(os: boolean) {
    this.isOpenShift = os
  }

  /*
   * Get the address of the kubernetes cluster
   */
  getClusterAddr(): string {
    return this.kubeClusterAddr
  }

  /*
   * Probably only required for testing purposes
   */
  setClusterAddr(address: string) {
    this.kubeClusterAddr = address
  }

  /*
   * Allows the proxy ssl options to be dynamically
   * reset within tests
   */
  getProxySSLOptions(): SSLOptions | undefined {
    return this.proxySSLOptions
  }

  setProxySSLOptions(options?: SSLOptions) {
    this.proxySSLOptions = options
  }

  /*
   * Is form authentication being used
   */
  isFormAuthentication(): boolean {
    return this.formAuth
  }

  setFormAuthentication(formAuth: boolean) {
    this.formAuth = formAuth
  }

  /*
   * Get the value of the rbac acl environment variable
   */
  getRbacAcl(): string | undefined {
    return this.rbacAcl
  }

  setRbacAcl(rbacAcl?: string) {
    this.rbacAcl = rbacAcl
  }

  /*
   * Is the RBAC registry enabled
   */
  isRbacRegistryEnabled(): boolean {
    return this.rbacRegEnabled
  }

  setRbacRegistryEnabled(rbacRegistryEnabled: boolean) {
    this.rbacRegEnabled = rbacRegistryEnabled
  }

  /*
   * Is mask ip addresses enabled
   */
  isMaskIpAddrEnabled(): boolean {
    return this.maskIpAddr
  }

  setMaskIpAddrEnabled(maskIpAddr: boolean) {
    this.maskIpAddr = maskIpAddr
  }
}

export const gatewayConfig = new GatewayConfig()
