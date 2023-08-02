import { log, UserProfile, getActiveProfile } from '@hawtio/online-oauth'

export class KubernetesAPI {
  private _initialized = false
  private _oAuthProfile: UserProfile | null = null
  private _error: Error|null = null
  private isOS = false

  async initialize(): Promise<boolean> {
    if (this._initialized)
      return true

    try {
      this._oAuthProfile = await getActiveProfile()
      if (! this._oAuthProfile)
        throw new Error('Cannot initialize an active OAuth profile')

      if (this._oAuthProfile.hasError())
        throw this._oAuthProfile.getError()

      this.isOS = await this.queryOpenshift(this._oAuthProfile)

    } catch (error) {
      log.error('k8 Api produced an error: ', error)
      if (error instanceof Error)
        this._error = error
      else
        this._error = new Error("Unknown error during initialisation")
    }

    this._initialized = true
    return this._initialized
  }

  private async queryOpenshift(profile: UserProfile): Promise<boolean> {
    if (this.isOS)
      return this.isOS

    if (this.hasError()) {
      return false
    }

    // Conduct the query to determine if openshift
    const masterUri = profile.getMasterUri()

    try {
      if (! masterUri)
        throw new Error('No master uri in profile')

      const testUrl = new URL(`${masterUri}/apis/apps.openshift.io/v1`)

      const response = await fetch(testUrl)
      if (response?.ok) {
        const result = await response.json()
        if (result) {
          log.debug("Backend is an openshift instance")
          this.isOS = true
        }
      }
    } catch (error) {
      console.warn("Error probing for openshift. Assuming backend is not an openshift instance.", { cause: error })
      this.isOS = false
    }

    return this.isOS
  }

  get initialized(): boolean {
    return this._initialized
  }

  private checkInitOrError() {
    if (! this.initialized)
      throw new Error('k8 API is not intialized')

    if (this.hasError())
      throw this._error

    if (! this._oAuthProfile)
      throw new Error('Cannot find the oAuth profile')

    if (this._oAuthProfile.hasError())
      throw this._oAuthProfile.getError()
  }

  get oAuthProfile(): UserProfile {
    this.checkInitOrError()

    return this._oAuthProfile as UserProfile
  }

  getMasterUri(): string {
    return this.oAuthProfile.getMasterUri() || ''
  }

  get isOpenshift(): boolean {
    this.checkInitOrError()

    return this.isOS
  }

  hasError() {
    return this._error !== null
  }

  get error(): Error|null {
    return this._error
  }
}
