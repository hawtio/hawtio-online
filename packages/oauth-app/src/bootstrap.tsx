import { configManager, hawtio, Logger } from '@hawtio/react'
import { log, onlineOAuth } from '@hawtio/online-oauth'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { OAuth } from './OAuth'

// To be removed post-development / pre-production
Logger.setLevel(Logger.DEBUG)
log.log('Logging Level set to', Logger.getLevel())

// Configure the test app
const configure = () => {
  configManager.addProductInfo('OAuth Test App', '1.0.0')
}
configure()

// Load OpenShift OAuth plugin first
onlineOAuth()

// Bootstrap Hawtio
hawtio.bootstrap()

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>
    <OAuth />
  </React.StrictMode>,
)
