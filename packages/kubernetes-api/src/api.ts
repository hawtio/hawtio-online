import { METADATA_KEY_CLUSTER_CONSOLE, UserProfile, oAuthService } from '@hawtio/online-oauth'
import { log } from './globals'

export class KubernetesAPI {
  private oAuthProfile?: Promise<UserProfile>
  private consoleUri?: Promise<string | null>
  private error?: Error

  async initialize() {
    try {
      this.oAuthProfile = oAuthService.getUserProfile()
      const profile = await this.oAuthProfile
      if (profile.hasError()) throw profile.getError()

      this.consoleUri = this.queryConsoleUri(profile)
    } catch (error) {
      log.error('KubernetesAPI produced an error:', error)
      const e = error instanceof Error ? error : new Error('Unknown error during initialisation')
      this.error = e
    }
  }

  private async queryConsoleUri(profile: UserProfile): Promise<string | null> {
    if (!profile.isOpenShift()) return null

    const consoleUri = profile.metadataValue<string>(METADATA_KEY_CLUSTER_CONSOLE)
    if (consoleUri) {
      log.debug('Console URI specified:', consoleUri)
      return consoleUri
    }

    log.debug('Querying for console URI from cluster')

    // Try to find it from the cluster
    // Will fail if the logged in user lacks the permissions
    try {
      const masterUri = profile.getMasterUri()
      if (!masterUri) throw new Error('No master uri in profile')

      const testUrl = `${masterUri}/api/v1/namespaces/openshift-config-managed/configmaps/console-public`
      const response = await fetch(testUrl)
      if (response.ok) {
        const result = await response.json()
        if (result?.data?.consoleURL) {
          return result.data.consoleURL
        }
      }
    } catch (error) {
      log.warn(
        'Error probing for OpenShift console. Alternative is to specify the web_console_url property in the config.json.',
        error,
      )
    }

    return null
  }

  private async assertNoErrors() {
    if (this.hasError()) throw this.error

    if (!this.oAuthProfile) throw new Error('KubernetesAPI is not initialised yet')

    const profile = await this.oAuthProfile
    if (profile.hasError()) throw profile.getError()
  }

  async getOAuthProfile(): Promise<UserProfile> {
    await this.assertNoErrors()
    if (!this.oAuthProfile) throw new Error('KubernetesAPI is not initialised yet')

    return this.oAuthProfile
  }

  async masterUri(): Promise<string> {
    return (await this.getOAuthProfile()).getMasterUri()
  }

  async isOpenShift(): Promise<boolean> {
    await this.assertNoErrors()
    if (!this.oAuthProfile) throw new Error('KubernetesAPI is not initialised yet')

    return (await this.getOAuthProfile()).isOpenShift()
  }

  async getConsoleUri(): Promise<string> {
    await this.assertNoErrors()
    if (!this.consoleUri) throw new Error('KubernetesAPI is not initialised yet')

    return (await this.consoleUri) ?? ''
  }

  hasError(): boolean {
    return this.error !== undefined
  }

  getError(): Error | undefined {
    return this.error
  }
}

export const kubernetesApi = new KubernetesAPI()
