import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { configManager, hawtio, Hawtio, HawtioLoadingPage, registerPlugins } from '@hawtio/react'
import { isMgmtApiRegistered } from '@hawtio/online-management-api'
import { reportWebVitals } from './reportWebVitals'
import { discover } from './discover'
import { log } from './discover/globals'
import usePromise from 'react-promise-suspense'

configManager.addProductInfo('Hawtio Online', '__PACKAGE_VERSION_PLACEHOLDER__')

function HawtioOnline() {
  usePromise(async () => {
    // Register kubernetes & management - only then complete hawtio bootstrap
    await isMgmtApiRegistered()

    // Register hawtio plugins
    registerPlugins()

    for (const plugin of hawtio.getPlugins()) {
      if (plugin.id === 'connect') {
        log.debug('Disabling connect plugin')
        plugin.isActive = async () => {
          return false
        }
      }
    }

    // Register discover plugin
    discover()

    // Bootstrap Hawtio
    hawtio.bootstrap()
  }, [])

  return <Hawtio />
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <Suspense fallback={<HawtioLoadingPage />}>
    <React.StrictMode>
      <HawtioOnline />
    </React.StrictMode>
  </Suspense>,
)

reportWebVitals()
