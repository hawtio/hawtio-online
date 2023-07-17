import { configManager, hawtio, Hawtio } from '@hawtio/react'
import { registerKubernetesAPI } from '@hawtio/online-kubernetes-api'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { reportWebVitals } from './reportWebVitals'
import { Kubernetes } from './kubernetes'

// Configure the console
const configure = () => {
  configManager.addProductInfo('Kubernetes API Test App', '1.0.0')
}
configure()
registerKubernetesAPI()

// Bootstrap Hawtio
hawtio.bootstrap()

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>
    <Kubernetes />
  </React.StrictMode>,
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
