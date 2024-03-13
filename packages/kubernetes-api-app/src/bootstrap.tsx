import { log, onlineKubernetesApi } from '@hawtio/online-kubernetes-api'
import { Logger, configManager, hawtio } from '@hawtio/react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Kubernetes } from './Kubernetes'
import { AuthLoginPage } from './login'
import { reportWebVitals } from './reportWebVitals'

// To be removed post-development / pre-production
Logger.setLevel(Logger.DEBUG)
log.log('Logging Level set to', Logger.getLevel())

// Configure the console
const configure = () => {
  configManager.addProductInfo('Kubernetes API Test App', '1.0.0')
}
configure()

onlineKubernetesApi()

// Bootstrap Hawtio
hawtio.bootstrap()

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path='/login' element={<AuthLoginPage />} />
        <Route path='/*' element={<Kubernetes />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
