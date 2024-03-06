import React from 'react'
import ReactDOM from 'react-dom/client'
import { camel, configManager, hawtio, Hawtio, jmx, logs, quartz, rbac, runtime, springboot } from '@hawtio/react'
import { isMgmtApiRegistered } from '@hawtio/online-management-api'
import { reportWebVitals } from './reportWebVitals'
import { discover } from './discover'

configManager.addProductInfo('Hawtio Online', '__PACKAGE_VERSION_PLACEHOLDER__')

// Register kubernetes & management - only then complete hawtio bootstrap
isMgmtApiRegistered().then(() => {
  // Register hawtio plugins
  jmx()
  rbac()
  camel()
  runtime()
  logs()
  quartz()
  springboot()

  // Register discover plugin
  discover()

  // Bootstrap Hawtio
  hawtio.bootstrap()

  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
  root.render(
    <React.StrictMode>
      <Hawtio />
    </React.StrictMode>,
  )

  // If you want to start measuring performance in your app, pass a function
  // to log results (for example: reportWebVitals(console.log))
  // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
  reportWebVitals()
})
