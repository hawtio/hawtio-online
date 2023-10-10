import React from 'react'
import { usePlugins, DEFAULT_APP_NAME, useHawtconfig } from '@hawtio/react'
import { backgroundImages, hawtioLogo } from './img'
import { ListItem, ListVariant, LoginFooterItem, LoginPage } from '@patternfly/react-core'
import { log } from '@hawtio/online-oauth'
import { AuthLoadingPage } from './AuthLoadingPage'

export const AuthLoginPage: React.FunctionComponent = () => {
  const { hawtconfig, hawtconfigLoaded } = useHawtconfig()
  const { plugins, pluginsLoaded } = usePlugins()

  if (!hawtconfigLoaded && !pluginsLoaded) {
    log.debug('Loading:, hawtconfig =', hawtconfigLoaded, ', plugins =', pluginsLoaded)
    return <AuthLoadingPage />
  }

  let loginForm = null
  const loginPlugins = plugins.filter(plugin => plugin.isLogin)
  if (loginPlugins.length > 0) {
    const loginPlugin = loginPlugins[0]
    const component = loginPlugin?.component
    if (! component) {
      log.info('Custom login component not defined: ', loginPlugin?.id)
    } else {
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
