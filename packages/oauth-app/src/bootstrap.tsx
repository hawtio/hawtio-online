import { configManager, hawtio, Logger } from '@hawtio/react'
import { log, oAuthInit } from '@hawtio/online-oauth'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { reportWebVitals } from './reportWebVitals'
import { OAuth } from './OAuth'

// To be removed post-development / pre-production
Logger.setLevel(Logger.DEBUG)
log.log('Logging Level set to', Logger.getLevel())

// Configure the test app
const configure = () => {
  configManager.addProductInfo('OAuth Test App', '1.0.0')
}
configure()

oAuthInit()

// Bootstrap Hawtio
hawtio.bootstrap()

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>
    <OAuth />
  </React.StrictMode>,
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
