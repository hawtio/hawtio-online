import { PUBLIC_USER, ResolveUser, userService } from '@hawtio/react'
import * as fetchIntercept from 'fetch-intercept'
import $ from 'jquery'
import { jwtDecode } from 'jwt-decode'
import { ProtocolService } from '../api'
import { UserProfile, log } from '../globals'
import {
  FetchOptions,
  fetchPath,
  getCookie,
  joinPaths,
  logoutRedirect,
  redirect,
  relToAbsUrl,
  secureDispose,
  secureRetrieve,
} from '../utils'
import { FORM_TOKEN_STORAGE_KEY, FormConfig } from './globals'

type LoginOptions = {
  uri: URL
}

interface Headers {
  Authorization: string
  'X-XSRF-TOKEN'?: string
}

export class FormService implements ProtocolService {
  private readonly login: Promise<boolean>
  private formConfig: FormConfig | null
  private fetchUnregister?: () => void

  constructor(
    formConfig: FormConfig | null,
    private readonly userProfile: UserProfile,
  ) {
    log.debug('Initialising Form Auth Service')
    this.userProfile.setAuthType('form')
    this.formConfig = formConfig
    this.login = this.createLogin()
  }

  private async createLogin(): Promise<boolean> {
    if (!this.formConfig) {
      log.debug('Form auth disabled')
      return false
    }

    if (!this.formConfig.uri) {
      log.debug('Invalid config, disabled form auth:', this.formConfig)
      return false
    }

    if (this.userProfile.hasError()) {
      log.debug('Cannot login as user profile has an error: ', this.userProfile.getError())
      return false
    }

    if (!this.userProfile.getMasterUri()) {
      log.debug('Cannot initialise form authentication as master uri not specified')
      return false
    }

    if (this.userProfile.hasToken()) {
      return true // already logged in
    }

    const token = await this.checkToken()
    if (!token) {
      this.tryLogin({ uri: new URL(window.location.href) })
      return false
    }

    /* Populate the profile with the new token */
    log.debug('Populating user profile with token')
    this.userProfile.setToken(token)

    // Need fetch for keepalive
    this.setupFetch()
    this.setupJQueryAjax()
    return true
  }

  private async checkToken(): Promise<string | null> {
    // Token has to be provided in local storage
    return await secureRetrieve(FORM_TOKEN_STORAGE_KEY)
  }

  private buildLoginUrl(options: LoginOptions): URL {
    if (!this.formConfig) throw new Error('Cannot initiate login as form configuration cannot be derived')

    const target = relToAbsUrl(this.formConfig.uri)
    const targetUri = new URL(target)

    log.debug('Login - form URI:    ', target)
    log.debug('Login - redirect URI:', options.uri)

    const searchParams = new URLSearchParams()
    searchParams.set('redirectUri', options.uri.toString())
    targetUri.search = searchParams.toString()

    return targetUri
  }

  private tryLogin(options: LoginOptions) {
    const targetUri = this.buildLoginUrl(options)

    if (targetUri.pathname === options.uri.pathname) {
      // We are already in the login form
      log.debug('Login - Already in', targetUri)
      return
    }

    redirect(targetUri)
  }

  private setupFetch() {
    if (this.userProfile.hasError()) {
      return
    }

    log.debug('Intercept Fetch API to attach auth token to authorization header')
    this.fetchUnregister = fetchIntercept.register({
      request: (url, config) => {
        log.debug('Form - Fetch intercepted for OAuth authentication')

        let headers: Headers = {
          Authorization: `Bearer ${this.userProfile.getToken()}`,
        }

        // For CSRF protection with Spring Security
        const token = getCookie('XSRF-TOKEN')
        if (token) {
          log.debug('Set XSRF token header from cookies')
          headers = {
            ...headers,
            'X-XSRF-TOKEN': token,
          }
        }

        return [url, { headers, ...config }]
      },
    })
  }

  private setupJQueryAjax() {
    if (this.userProfile.hasError()) {
      return
    }

    log.debug('Set authorization header to Openshift auth token for AJAX requests')
    const beforeSend = (xhr: JQueryXHR, settings: JQueryAjaxSettings) => {
      // Set bearer token is used
      xhr.setRequestHeader('Authorization', `Bearer ${this.userProfile.getToken()}`)

      // For CSRF protection with Spring Security
      const token = getCookie('XSRF-TOKEN')
      if (token) {
        log.debug('Set XSRF token header from cookies')
        xhr.setRequestHeader('X-XSRF-TOKEN', token)
      }
      return // To suppress ts(7030)
    }

    $.ajaxSetup({ beforeSend })
  }

  private clearTokenStorage(): void {
    secureDispose(FORM_TOKEN_STORAGE_KEY)
  }

  private doLogout(): void {
    this.fetchUnregister?.()

    const currentURI = new URL(window.location.href)
    this.clearTokenStorage()

    // Redirect to /auth/logout endpoint if possible
    const targetUri = this.buildLoginUrl({ uri: currentURI })
    logoutRedirect(targetUri)
  }

  async isLoggedIn(): Promise<boolean> {
    // Use Promise to conform with interface
    return await this.login
  }

  private getSubjectFromToken(token: string): string {
    const payload = jwtDecode(token)
    return payload.sub?.replace('system:serviceaccount:', '') ?? ''
  }

  async fetchUser(resolve: ResolveUser): Promise<boolean> {
    if (!this.login || !this.userProfile.hasToken() || this.userProfile.hasError()) {
      resolve({ username: PUBLIC_USER, isLogin: false })
      return true
    }

    const masterUri = this.userProfile.getMasterUri()
    const isOpenShift = this.userProfile.getMasterKind() === 'openshift'
    const token = this.userProfile.getToken()

    let subject = ''
    try {
      // Try and extract the subject from the token, if applicable
      subject = this.getSubjectFromToken(token)
    } catch (err) {
      if (err instanceof Error) log.warn(err.message)
      else log.error(err)
    }

    /*
     * If subject not assigned and the cluster is OpenShift
     * then ask cluster API for user.
     *
     * NOTE: This is an edge-case that really only affects development
     * since form-login is prioritized for authentication of non-OpenShift clusters.
     */
    if (subject === '' && isOpenShift) {
      // Default to 'user' if there is a failure
      subject = (await this.openShiftUser(masterUri, token)) ?? ''
    }

    // Default to user if subject cannot be established
    resolve({ username: subject !== '' ? subject : 'user', isLogin: true })
    userService.setToken(token)

    return true
  }

  async logout(): Promise<boolean> {
    log.debug('Form - Running logout hook')
    const login = await this.login

    if (!login || !this.userProfile.hasToken() || this.userProfile.hasError()) return false

    log.info('Log out')
    try {
      this.doLogout()
    } catch (error) {
      log.error('Error logging out:', error)
    }
    return true
  }

  /**
   * Fetches the username connected to the token using the Openshift API.
   * Only applicable if the cluster is Openshift.
   *
   * return null
   */
  private async openShiftUser(masterUri: string, token: string): Promise<string | null> {
    const fetchOptions: FetchOptions = {
      headers: { Authorization: `Bearer ${token}` },
    }

    let userName = null
    await fetchPath<void>(
      joinPaths(masterUri, 'apis/user.openshift.io/v1/users/~'),
      {
        success: (data: string) => {
          log.debug('Connected to master uri api')
          const response = JSON.parse(data)
          userName = response?.metadata?.name
          return
        },
        error: err => {
          log.debug('Cannot get username from Openshift token', { cause: err })
          return
        },
      },
      fetchOptions,
    )

    return userName
  }
}
