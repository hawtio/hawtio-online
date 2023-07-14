import { HawtioPlugin, hawtio, configManager, jolokiaService } from '@hawtio/react'
import URI from 'urijs'
import { pollingOnly } from './client'
import { kubernetesAPI, log } from './kubernetes-api-globals'
import { KeyCloakAuthConfig, KubernetesConfig, WatchTypes } from './kubernetes-api-model'
import { isBlank, isString } from './utils/strings'

declare global {
  interface Window {
    OPENSHIFT_CONFIG: KubernetesConfig
    KeycloakConfig: KeyCloakAuthConfig
  }
}

export async function processConfig(fetchedCb: (success: boolean) => void) {
  log.debug('Fetched openshift config:', window['OPENSHIFT_CONFIG'])
  log.debug('Fetched keycloak config:', window['KeycloakConfig'])

  kubernetesAPI.setKubeConfig(window.OPENSHIFT_CONFIG)
  const oSOAuthConfig = window.OPENSHIFT_CONFIG.openshift
  if (!oSOAuthConfig) {
    fetchedCb(false)
    return
  }

  if (!oSOAuthConfig.oauth_authorize_uri && oSOAuthConfig.oauth_metadata_uri) {
    log.debug('Fetching OAuth server metadata from:', oSOAuthConfig.oauth_metadata_uri)

    const response = await fetch(oSOAuthConfig.oauth_metadata_uri) as Response
    if (response.ok) {
      const metadata = await response.json()
      if (metadata) {
        oSOAuthConfig.oauth_authorize_uri = metadata.authorization_endpoint
        oSOAuthConfig.issuer = metadata.issuer
      }
    }
  }

  // Update kube config with any changes
  kubernetesAPI.setKubeConfig(window.OPENSHIFT_CONFIG)
  fetchedCb(isString(oSOAuthConfig.oauth_authorize_uri) && ! isBlank(oSOAuthConfig.oauth_authorize_uri))
}

export function fetchConfig(fetchedCb: (success: boolean) => void) {
  $.getScript('osconsole/config.js')
    .always(() => {
      processConfig(fetchedCb)
  })
}

export function extractMaster() {
  const config: KubernetesConfig = kubernetesAPI.getKubeConfig()

  log.debug("Fetched OAuth config:", config)
  let master = config.master_uri
  if (!master && config.api && config.api.k8s) {
    const masterUri = new URI().host(config.api.k8s.hostPort).path("").query("")
    if (config.api.k8s.proto) {
       masterUri.protocol(config.api.k8s.proto)
    }
    master = masterUri.toString()
  }

  const oSOAuthConfig = kubernetesAPI.getOSOAuthConfig()
  if (oSOAuthConfig && !master) {
    const oauth_authorize_uri = oSOAuthConfig.oauth_authorize_uri
    if (oauth_authorize_uri) {
      const text = oauth_authorize_uri
      let idx = text.indexOf("://")
      if (idx > 0) {
        idx += 3
        idx = text.indexOf("/", idx)
        if (idx > 0) {
          master = text.substring(0, ++idx)
        }
      }
    }
  }

  // We'll just grab the URI for the document here in case we need it
  const basePath = hawtio.getBasePath()
  if (basePath) {
    const documentURI = new URI().path(basePath)
    if (!master || master === "/") {
      // lets default the master to the current protocol and host/port
      // in case the master url is "/" and we are
      // serving up static content from inside /api/v1/namespaces/default/services/fabric8 or something like that
      log.info("master_url unset or set to '/', assuming API server is at /")
      master = documentURI.query("").toString()
    }

    if (master === "k8s") {
      // We're using the built-in kuisp proxy to access the API server
      log.info("master_url set to 'k8s', assuming proxy is being used")
      master = documentURI.query("").segment(master).toString()
    }

    log.info("Using kubernetes API URL:", master)
    kubernetesAPI.setMasterUrl(master)
  }
}

export function isTargetOpenshift() {
  let isOpenShift = false

  const testURL = new URI(kubernetesAPI.getMasterUrl()).segment('apis/apps.openshift.io/v1').toString()

  // TODO need to work out exactly what it required to access the cluster in terms of authorization
  // think we need to add a bearer token from the authorization url

    // $.ajax(<any>{
    //   url: testURL,
    //   method: 'GET',
    //   success: (data) => {
    //     log.info("Backend is an openshift instance")
    //     isOpenShift = true
    //   },
    //   error: (jqXHR, textStatus, errorThrown) => {
    //     log.info("Error probing " + testURL + " assuming backend is not an openshift instance.  Error details: status:", textStatus, "errorThrown: ", errorThrown, "jqXHR instance:", jqXHR)
    //   }
    // })

    kubernetesAPI.setOpenshift(true)
}

export function kubernetesAPIInit() {

  const fetchConfigDep = (success: boolean) => {
    if (!success)
      log.warn("Failed to fetch kubernetes config")

    extractMaster()

    isTargetOpenshift()

    // TODO
    // determine if following line is required
    // K8S_PREFIX = Core.trimLeading(Core.pathGet(osConfig, ['api', 'k8s', 'prefix']) || K8S_PREFIX, '/');

    if (!kubernetesAPI.isOpenShift()) {
      pollingOnly.push(WatchTypes.BUILD_CONFIGS)
    }
  }

  fetchConfig(fetchConfigDep)
}
