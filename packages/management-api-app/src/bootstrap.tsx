import { Logger, configManager, hawtio } from '@hawtio/react'
import { isMgmtApiRegistered, log } from '@hawtio/online-management-api'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Management } from './Management'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthLoginPage } from './login'
import { onlineOAuth } from '@hawtio/online-oauth'

// To be removed post-development / pre-production
Logger.setLevel(Logger.DEBUG)
log.log('Logging Level set to', Logger.getLevel())

// Configure the console
const configure = () => {
  configManager.addProductInfo('Management API Test App', '1.0.0')
}
configure()

// Load OpenShift OAuth plugin first
onlineOAuth()

isMgmtApiRegistered().then(() => {
  // Bootstrap Hawtio
  hawtio.bootstrap()

  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path='/login' element={<AuthLoginPage />} />
          <Route path='/*' element={<Management />} />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>,
  )
})
