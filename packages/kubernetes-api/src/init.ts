import { hawtio } from '@hawtio/react'
import URI from 'urijs'
import { pollingOnly } from './client'
import { kubernetesAPI, log } from './globals'
import { KubernetesConfig, WatchTypes } from './model'
import { isBlank, isString } from './utils/strings'

async function processConfig(config: KubernetesConfig): Promise<boolean> {
  log.debug('Fetched kubernetes config:', config)

  if (!config || !config.openshift) {
    return false
  }

  if (!config.openshift.oauth_authorize_uri && config.openshift.oauth_metadata_uri) {
    log.debug('Fetching OAuth server metadata from:', config.openshift.oauth_metadata_uri)

    try {
      const response = await fetch(config.openshift.oauth_metadata_uri)
      if (response?.ok) {
        const metadata = await response.json()
        if (metadata) {
          config.openshift.oauth_authorize_uri = metadata.authorization_endpoint
          config.openshift.issuer = metadata.issuer
        }
      }
    } catch (error) {
      const e: Error = new Error("Cannot parse the oauth metadata uri")

      if (error instanceof Error) {
        e.message = e.message + ': ' + error.message
      }

      kubernetesAPI.setError(e)
      console.error(e)
      return false
    }
  }

  // Update kube config with any changes
  kubernetesAPI.setKubeConfig(config)
  return isString(kubernetesAPI.getOSOAuthConfig()?.oauth_authorize_uri) &&
    ! isBlank(kubernetesAPI.getOSOAuthConfig()?.oauth_authorize_uri)
}

export async function fetchConfig(): Promise<boolean> {
  try {
    const configResponse = await fetch('osconsole/config.json')
    if (configResponse?.ok) {
      const config = await configResponse.json()
      return processConfig(config)
    } else {
      const message = "Failed to obtain config.json: " +  configResponse.statusText
      kubernetesAPI.setError(new Error(message))
      log.error(message)
    }
  } catch (error) {
    const e: Error = new Error("Cannot parse the kubernetes config.json")

    if (error instanceof Error) {
      e.message = e.message + ': ' + error.message
    }

    kubernetesAPI.setError(e)
    console.error(e)
  }

  return false
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

async function isTargetOpenshift() {

  const testURL = new URI(kubernetesAPI.getMasterUrl()).segment('apis/apps.openshift.io/v1').toString()
  try {
    const response = await fetch(testURL)
    if (response?.ok) {
      const result = await response.json()
      if (result) {
        console.log(result)
        log.info("Backend is an openshift instance")
        kubernetesAPI.setOpenshift(true)
      }
    }
  } catch (error) {
    const e: Error = new Error("Error probing " + testURL + " assuming backend is not an openshift instance.")

    if (error instanceof Error) {
      e.message = e.message + ': ' + error.message
    }

    log.error(e)
    console.error(e)
  }    
}

export function kubernetesAPIInit() {

  fetchConfig()
    .then((result: boolean) => {
      if (result && kubernetesAPI.getKubeConfig()) {
        extractMaster()

        isTargetOpenshift()

        // TODO
        // determine if following line is required
        // K8S_PREFIX = Core.trimLeading(Core.pathGet(osConfig, ['api', 'k8s', 'prefix']) || K8S_PREFIX, '/');

        if (!kubernetesAPI.isOpenShift()) {
          pollingOnly.push(WatchTypes.BUILD_CONFIGS)
        }
      }
    })
}
