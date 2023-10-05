import $ from 'jquery'
import { getCookie } from '../utils'
import { log, OAuthProtoService, UserProfile } from "../globals"
import { FormConfig, FORM_TOKEN_STORAGE_KEY, FORM_AUTH_PROTOCOL_MODULE, ResolveUser } from "./globals"
import { relToAbsUrl } from 'src/utils/utils'
import { jwtDecode } from './jwt-decode'
import { PUBLIC_USER, userService } from '@hawtio/react'

type LoginOptions = {
  uri: URL;
}

export class FormService implements OAuthProtoService {
  private userProfile: UserProfile
  private formConfig: FormConfig | null
  private loggedIn: boolean

  constructor(formConfig: FormConfig|null, userProfile: UserProfile) {
    log.debug('Initialising Form Auth Service')
    this.userProfile = userProfile
    this.userProfile.setOAuthType(FORM_AUTH_PROTOCOL_MODULE)
    this.formConfig = formConfig
    this.loggedIn = this.initLogin()
  }

  private initLogin(): boolean {
    if (!this.formConfig) {
      log.debug("Form auth disabled")
      return false
    }

    if (!this.formConfig.uri) {
      log.debug("Invalid config, disabled form auth:", this.formConfig)
      return false
    }

    if (this.userProfile.hasError()) {
      log.debug('Cannot login as user profile has an error: ', this.userProfile.getError())
      return false
    }

    if (! this.userProfile.getMasterUri()) {
      log.debug('Cannot initialise form authentication as master uri not specified')
      return false
    }

    return this.login()
  }

  login(): boolean {
    if (this.userProfile.hasToken()) {
      return true // already logged in
    }

    const currentUri = new URL(window.location.href)
    const token = this.checkToken()
    if (!token) {
      this.clearTokenStorage()
      this.tryLogin({uri: currentUri})
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

  private checkToken(): string | null {
    let token: string | null = null

    // Token has to be provided in local storage
    if (FORM_TOKEN_STORAGE_KEY in localStorage)
      token = localStorage.getItem(FORM_TOKEN_STORAGE_KEY) ?? null

    return token
  }

  private clearTokenStorage(): void {
    localStorage.removeItem(FORM_TOKEN_STORAGE_KEY)
  }

  private tryLogin(options: LoginOptions) {
    if (! this.formConfig)
      throw new Error('Cannot initiate login as form configuration cannot be derived')

    const target = relToAbsUrl(this.formConfig.uri)
    const targetUri = new URL(target)

    log.debug('Login - form URI:    ', target)
    log.debug('Login - redirect URI:', options.uri)
    if (targetUri.pathname === options.uri.pathname) {
      // We are already in the login form
      log.debug("Login - Already in", this.formConfig.uri)
      return
    }

    const searchParams = new URLSearchParams()
    searchParams.set('redirectUri', options.uri.toString())
    targetUri.search = searchParams.toString()

    log.debug("Redirecting to URI:", targetUri.toString())
    window.location.href = targetUri.toString()
  }

  private setupFetch() {
    if (this.userProfile.hasError()) {
      return
    }

    log.debug('Intercept Fetch API to attach auth token to authorization header')
    const { fetch: originalFetch } = window
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      log.debug('Fetch intercepted for oAuth authentication')

      init = { ...init }
      init.headers = {
        ...init.headers,
        Authorization: `Bearer ${this.userProfile.getToken()}`,
      }

      // For CSRF protection with Spring Security
      const token = getCookie('XSRF-TOKEN')
      if (token) {
        log.debug('Set XSRF token header from cookies')
        init.headers = {
          ...init.headers,
          'X-XSRF-TOKEN': token,
        }
      }

      return originalFetch(input, init)
    }
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

  forceRelogin(url: URL) {
    this.clearTokenStorage()
    this.tryLogin({ uri: url })
  }

  doLogout(): void {
    const currentURI = new URL(window.location.href)
    this.forceRelogin(currentURI)
  }

  async isLoggedIn(): Promise<boolean> {
    this.loggedIn = this.login()
    return this.loggedIn
  }

  private getSubjectFromToken(token: string): string {
    const payload = jwtDecode(token)
    return payload.sub.replace('system:serviceaccount:', '')
  }

  registerUserHooks(): void {
    log.debug('Registering oAuth user hooks')
    const fetchUser = async (resolve: ResolveUser) => {
      this.login()
      if (! this.userProfile.hasToken() || this.userProfile.hasError()) {
        resolve({ username: PUBLIC_USER, isLogin: false })
        return false
      }

      let subject = this.userProfile.getToken()
      try {
        subject = this.getSubjectFromToken(this.userProfile.getToken())
      } catch (err) {
        if (err instanceof Error)
          console.warn(err.message)
        else
          console.error(err)
      }

      resolve({ username: subject, isLogin: true })
      userService.setToken(this.userProfile.getToken())

      return true
    }
    userService.addFetchUserHook(FORM_AUTH_PROTOCOL_MODULE, fetchUser)

    const logout = async () => {
      log.debug('Running oAuth logout hook')
      this.login()
      if (! this.userProfile.hasToken() || this.userProfile.hasError())
        return false

      log.info('Log out')
      try {
        this.doLogout()
      } catch (error) {
        log.error('Error logging out:', error)
      }
      return true
    }
    userService.addLogoutHook(FORM_AUTH_PROTOCOL_MODULE, logout)
  }
}
