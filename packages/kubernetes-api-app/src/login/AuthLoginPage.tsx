import React, { useEffect } from 'react'
import { usePlugins, DEFAULT_APP_NAME, useHawtconfig } from '@hawtio/react'
import { backgroundImages, hawtioLogo } from './img'
import { ListItem, ListVariant, LoginFooterItem, LoginPage } from '@patternfly/react-core'
import { log } from '@hawtio/online-oauth'
import { AuthLoadingPage } from './AuthLoadingPage'
import { useNavigate } from 'react-router-dom'
import { useUser } from './hooks'

export const AuthLoginPage: React.FunctionComponent = () => {
  const navigate = useNavigate()

  const { isLogin, userLoaded } = useUser()
  const { hawtconfig, hawtconfigLoaded } = useHawtconfig()
  const { plugins, pluginsLoaded } = usePlugins()

  useEffect(() => {
    if (isLogin) {
      navigate('/')
    }
  }, [isLogin, navigate])

  if (!userLoaded || (!hawtconfigLoaded && !pluginsLoaded)) {
    log.debug('Loading:, hawtconfig =', hawtconfigLoaded, ', plugins =', pluginsLoaded)
    return <AuthLoadingPage />
  }

  let loginForm = null
  const loginPlugins = plugins.filter(plugin => plugin.isLogin)
  log.debug('Discovered Login Plugins:', loginPlugins.length)

  if (loginPlugins.length > 0) {
    log.debug('Found Login Plugins ... Customising the Login Page')

    const loginPlugin = loginPlugins[0]
    const component = loginPlugin?.component
    if (component) {
      log.debug('Building with customised login form component')
      loginForm = React.createElement(component)
    }
  }

  if (!loginForm) {
    log.error('Cannot find login form component')
    return <AuthLoadingPage />
  }

  const appLogo = hawtconfig.branding?.appLogoUrl || hawtioLogo
  const appName = hawtconfig.branding?.appName || DEFAULT_APP_NAME
  const description = hawtconfig.login?.description || ''
  const links = hawtconfig.login?.links || []
  const title = hawtconfig.login?.title || 'Log in to your account'

  const footerLinks = (
    <React.Fragment>
      {links.map((link, index) => (
        <ListItem key={`footer-link-${index}`}>
          <LoginFooterItem href={link.url}>{link.text}</LoginFooterItem>
        </ListItem>
      ))}
    </React.Fragment>
  )

  return (
    <LoginPage
      backgroundImgSrc={backgroundImages}
      brandImgSrc={appLogo}
      brandImgAlt={appName}
      loginTitle={title}
      textContent={description}
      footerListItems={footerLinks}
      footerListVariants={ListVariant.inline}
    >
      {loginForm}
    </LoginPage>
  )
}
