import { log, openShiftAuth, OpenShiftConfig, userProfile } from './globals'
import { isBlank, isString } from '../utils/strings'
import { checkToken, clearTokenStorage, currentTimeSeconds, doLogin, doLogout } from './support'
import { userService } from '@hawtio/react'
import { oAuthFetch } from 'src/api'

  let keepaliveUri: string = ''
  let keepaliveInterval: number = 10

  //
  // _module.config(['KeepaliveProvider', (KeepaliveProvider) => {
  //   log.debug("keepalive URI:", keepaliveUri)
  //   log.debug("keepalive interval:", keepaliveInterval)
  //   if (keepaliveUri && keepaliveInterval) {
  //     KeepaliveProvider.http(keepaliveUri)
  //     KeepaliveProvider.interval(keepaliveInterval)
  //   }
  // }])
  // _module.run(['userDetails', 'Keepalive', '$rootScope', (userDetails: Core.AuthService, Keepalive, $rootScope) => {
  //   if (userProfile && userProfile.token) {
  //     const username = userProfile.metadata ? userProfile.metadata.name : 'token'
  //     userDetails.login(username, null, userProfile.token)
  //     log.debug("Starting keepalive")
  //     $rootScope.$on('KeepaliveResponse', ($event, data, status) => {
  //       log.debug("keepaliveStatus:", status)
  //       log.debug("keepalive response:", data)
  //       if (status === 401) {
  //         userDetails.logout()
  //       }
  //     })
  //     Keepalive.start()
  //   }
  //
  // }])

async function processOSConfig(config: OpenShiftConfig): Promise<boolean> {
  log.debug('Fetched openshift config:', config)

  if (!config || !config.openshift) {
    userProfile.setError(new Error("Cannot find the openshift auth configuration"))
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
      const e: Error = new Error("Cannot parse the oauth metadata uri", {cause: error})
      userProfile.setError(e)
      return false
    }
  }

  // Update oauth config with any changes
  openShiftAuth.master_uri = config.master_uri
  openShiftAuth.setOpenShiftAuthConfig(config.openshift)
  return isString(openShiftAuth.getOpenShiftAuthConfig()?.oauth_authorize_uri) &&
    ! isBlank(openShiftAuth.getOpenShiftAuthConfig()?.oauth_authorize_uri)
}

export async function fetchConfig(): Promise<boolean> {
  try {
    const configResponse = await fetch('osconsole/config.json')
    if (configResponse?.ok) {
      log.info("Fetched osconsole/config.json ... now processing")
      const config = await configResponse.json()
      return await processOSConfig(config)
    } else {
      const message = "Failed to obtain config.json: " +  configResponse.statusText
      userProfile.setError(new Error(message))
    }
  } catch (error) {
    const e: Error = new Error("Cannot parse the openshift config.json", {cause: error})
    userProfile.setError(e)
  }

  return false
}

function validateConfig(): boolean {
  if (! openShiftAuth.getOpenShiftAuthConfig()) {
    userProfile.setError(new Error('Oauth auth config not found'))
    return false
  }

  if (!openShiftAuth.getOpenShiftAuthConfig().oauth_client_id || ! openShiftAuth.getOpenShiftAuthConfig().oauth_authorize_uri) {
    userProfile.setError(new Error('Invalid oauth config, disabled oauth'))
    log.debug("Invalid oauth config, disabled oauth", openShiftAuth)
    return false
  }

  return true
}

function addLogoutHook() {
  if (userProfile.isActive()) {
    userService.addLogoutHook('os-oauth-logout', (): Promise<boolean> => {
      doLogout()
      return Promise.resolve(true)
    })
  }
}

function buildKeepaliveUri(): string {
  let uri: URL
  if (openShiftAuth.master_uri) {
    uri = new URL(`${openShiftAuth.master_uri}/apis/user.openshift.io/v1/users/~`)
  } else {
    uri = new URL(`${openShiftAuth.getOpenShiftAuthConfig().oauth_authorize_uri}/apis/user.openshift.io/v1/users/~`)
  }
  return uri.toString()
}

export async function oAuthOSInit() {
  console.debug("Starting initialising of openshift oauth")
  if (openShiftAuth.token) {
    userProfile.setToken(openShiftAuth.token)
    addLogoutHook()
    return
  }

  if (userProfile.hasError()) {
    // Stop the authentication procedure to display the error
    return
  }

  let result = await fetchConfig()
  if (!result) {
    log.warn("Error: failed to fetch the osconsole/config")
    return
  }

  if (!validateConfig()) {
    return
  }

  log.debug("config:", openShiftAuth.getOpenShiftAuthConfig())
  const currentURI = new URL(window.location.href)
  const tokenParams = checkToken(currentURI)
  if (!tokenParams) {
    log.debug("No Token so initiating new login")
    clearTokenStorage()
    doLogin({ uri: currentURI.toString()})
    return
  }

  /* Populate the profile with the new token */
  userProfile.expires_in = tokenParams.expires_in
  userProfile.token_type = tokenParams.token_type
  userProfile.obtainedAt = tokenParams.obtainedAt || 0
  userProfile.setToken(tokenParams.access_token || '')

  const keepaliveUri = buildKeepaliveUri()

  const response = await oAuthFetch(keepaliveUri, {method: 'GET'}, userProfile)
  if (response.ok) {
    const keepaliveJson = await response.json()
    if (!keepaliveJson) {
      userProfile.setError(new Error("Cannot parse the keepalive json response"))
      return
    }

    const obtainedAt = userProfile.obtainedAt || 0
    const expiry = parseInt(userProfile.expires_in || '0')
    if (obtainedAt) {
      const remainingTime = obtainedAt + expiry - currentTimeSeconds()
      if (remainingTime > 0) {
        keepaliveInterval = Math.min(Math.round(remainingTime / 4), 24 * 60 * 60)
      }
    }
    if (!keepaliveInterval) {
      keepaliveInterval = 10
    }
    log.debug("userProfile:", userProfile)
    addLogoutHook()
  } else {
    // The request may have been cancelled as the browser refresh request in
    // extractToken may be triggered before getting the AJAX response.
    // In that case, let's just skip the error and go through another refresh cycle.
    // See http://stackoverflow.com/questions/2000609/jquery-ajax-status-code-0 for more details.
    log.error('Failed to fetch user info, status: ', response.statusText)
    clearTokenStorage()
    doLogin({ uri: currentURI.toString() })
  }

}
