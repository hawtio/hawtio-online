import { log, UserProfile, getActiveProfile, CLUSTER_CONSOLE_KEY } from '@hawtio/online-oauth'

export class KubernetesAPI {
  private _initialized = false
  private _oAuthProfile: UserProfile | null = null
  private _error: Error | null = null
  private _isOS = false
  private _consoleUri: string | null = null

  async initialize(): Promise<boolean> {
    if (this._initialized) return true

    try {
      this._oAuthProfile = await getActiveProfile()
      if (!this._oAuthProfile) throw new Error('Cannot initialize an active OAuth profile')

      if (this._oAuthProfile.hasError()) throw this._oAuthProfile.getError()

      this._isOS = await this.queryOpenshift(this._oAuthProfile)

      if (this._isOS)
        this._consoleUri = await this.queryConsoleUri(this._oAuthProfile)

    } catch (error) {
      log.error('k8 Api produced an error: ', error)
      if (error instanceof Error) this._error = error
      else this._error = new Error('Unknown error during initialisation')
    }

    this._initialized = true
    return this._initialized
  }

  private async queryConsoleUri(profile: UserProfile): Promise<string|null> {
    if (this.hasError()) {
      return null
    }

    const consoleUri = profile.metadataValue(CLUSTER_CONSOLE_KEY)
    if (consoleUri) {
      log.debug(`Console URI specified: ${consoleUri}`)
      return consoleUri
    }

    log.debug(`Querying for console URI from cluster`)

    // Try to find it from the cluster
    // Will fail if the logged in user lacks the permissions
    try {
      const masterUri = profile.getMasterUri()
      if (!masterUri) throw new Error('No master uri in profile')

      const testUrl = new URL(`${masterUri}/api/v1/namespaces/openshift-config-managed/configmaps/console-public`)

      const response = await fetch(testUrl)
      if (response?.ok) {
        const result = await response.json()
        if (result?.data?.consoleURL) {
          return result.data.consoleURL
        }
      }
    } catch (error) {
      console.warn('Error probing for openshift console. Alternative is to specify the web_console_url property in the config.json.', { cause: error })
    }

    return null
  }

  private async queryOpenshift(profile: UserProfile): Promise<boolean> {
    if (this._isOS) return this._isOS

    if (this.hasError()) {
      return false
    }

    // Conduct the query to determine if openshift
    const masterUri = profile.getMasterUri()

    try {
      if (!masterUri) throw new Error('No master uri in profile')

      const testUrl = new URL(`${masterUri}/apis/apps.openshift.io/v1`)

      const response = await fetch(testUrl)
      if (response?.ok) {
        const result = await response.json()
        if (result) {
          log.debug('Backend is an openshift instance')
          this._isOS = true
        }
      }
    } catch (error) {
      console.warn('Error probing for openshift. Assuming backend is not an openshift instance.', { cause: error })
      this._isOS = false
    }

    return this._isOS
  }

  get initialized(): boolean {
    return this._initialized
  }

  private checkInitOrError() {
    if (!this.initialized) throw new Error('k8 API is not intialized')

    if (this.hasError()) throw this._error

    if (!this._oAuthProfile) throw new Error('Cannot find the oAuth profile')

    if (this._oAuthProfile.hasError()) throw this._oAuthProfile.getError()
  }

  get oAuthProfile(): UserProfile {
    this.checkInitOrError()

    return this._oAuthProfile as UserProfile
  }

  masterUri(): string {
    return this.oAuthProfile.getMasterUri() || ''
  }

  get isOpenshift(): boolean {
    this.checkInitOrError()

    return this._isOS
  }

  get consoleUri(): string {
    this.checkInitOrError()

    return this._consoleUri as string
  }

  hasError() {
    return this._error !== null
  }

  get error(): Error | null {
    return this._error
  }
}
