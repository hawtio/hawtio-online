import { Logger, configManager, hawtio } from '@hawtio/react'
import { isMgmtApiRegistered } from '@hawtio/online-management-api'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { reportWebVitals } from './reportWebVitals'
import { Management } from './management'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthLoginPage } from './login'

// To be removed post-development / pre-production
Logger.setLevel(Logger.DEBUG)
console.log('Logging Level set to ', Logger.getLevel())

// Configure the console
const configure = () => {
  configManager.addProductInfo('Management API Test App', '1.0.0')
}
configure()
isMgmtApiRegistered()
  .then(() => {

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

    // If you want to start measuring performance in your app, pass a function
    // to log results (for example: reportWebVitals(console.log))
    // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
    reportWebVitals()
  })
