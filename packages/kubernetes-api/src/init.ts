import { UserProfile } from '@hawtio/online-oauth'
import { log, k8Api } from './globals'
import { pollingOnly } from './client'
import { WatchTypes } from './model'

async function queryIsOpenshift() {
  const testUrl = new URL(`${k8Api.getMasterUri()}/apis/apps.openshift.io/v1`)

  try {
    const response = await fetch(testUrl)
    if (response?.ok) {
      const result = await response.json()
      if (result) {
        console.log(result)
        log.debug("Backend is an openshift instance")
        k8Api.setIsOpenshift(true)
      }
    }
  } catch (error) {
    const err: Error = new Error("Error probing " + testUrl + " assuming backend is not an openshift instance.", { cause: error })
    k8Api.setError(err)
  }
}

export function k8Init(oAuthProfile: UserProfile) {
  log.info("Initialising kubernetes api")
  k8Api.setOAuthProfile(oAuthProfile)

  queryIsOpenshift()
    .then(() => {
      if (k8Api.isOpenshift())
        pollingOnly.push(WatchTypes.BUILD_CONFIGS)
    })
}
