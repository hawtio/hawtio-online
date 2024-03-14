import { onlineKubernetesApi } from '@hawtio/online-kubernetes-api'
import { onlineManagementApi } from '@hawtio/online-management-api'
import { camel, configManager, hawtio, Hawtio, jmx, logs, quartz, rbac, runtime, springboot } from '@hawtio/react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { onlineOAuth } from '../../oauth/dist'
import { discover } from './discover'
import { reportWebVitals } from './reportWebVitals'

configManager.addProductInfo('Hawtio Online', '__PACKAGE_VERSION_PLACEHOLDER__')

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

// Register Hawtio Online plugins
onlineKubernetesApi()
onlineManagementApi()
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
