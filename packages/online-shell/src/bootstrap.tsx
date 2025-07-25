import { isMgmtApiRegistered } from '@hawtio/online-management-api'
import { onlineOAuth } from '@hawtio/online-oauth'
import {
  camel,
  configManager,
  hawtio,
  Hawtio,
  HawtioLoadingPage,
  jmx,
  logs,
  quartz,
  rbac,
  runtime,
  springboot,
} from '@hawtio/react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { discover } from './discover'
import { HAWTIO_ONLINE_VERSION } from './constants'
import { discoverCore } from './discover-core'

configManager.addProductInfo('Hawtio Online', HAWTIO_ONLINE_VERSION)

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(<HawtioLoadingPage />)

// Load OpenShift OAuth plugin first
onlineOAuth()

// Register Hawtio builtin plugins
jmx()
rbac()
camel()
runtime()
logs()
quartz()
springboot()

// Register kubernetes & management - only then complete hawtio bootstrap
isMgmtApiRegistered().then(() => {
  // Register discover-core plugin
  discoverCore()

  // Register discover UI plugin
  discover()

  // Bootstrap Hawtio
  hawtio.bootstrap()

  root.render(
    <React.StrictMode>
      <Hawtio />
    </React.StrictMode>,
  )
})
