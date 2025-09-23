import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { configManager, HawtioInitialization, TaskState } from '@hawtio/react/init'
import { bootstrapModules } from './bootstrap-modules'

// Hawtio itself creates and tracks initialization tasks, but we can add our own.
configManager.initItem('Loading UI', TaskState.started, 'config')

// Create root for rendering React components. More React components can be rendered in single root.
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

// Basic UI that shows initialization progress without depending on PatternFly.
// It is imported and rendered in fully synchronous way.
root.render(<HawtioInitialization verbose={true} />)

// Configure the console
configManager.addProductInfo('Kubernetes API Test App', '1.0.0')

/*
 * Bootstrap all required modules first, essentially enforces download
 * of all chunks required for proceeding with this bootstrap process.
 */
bootstrapModules().then(mods => {
  const bootstrapInit = async () => {
    mods.hawtioreact.Logger.setLevel(mods.hawtioreact.Logger.DEBUG)

    configManager.initItem('OAuth2 Authentication', TaskState.started, 'plugins')
    mods.oAuth.log.log('Logging Level set to', mods.hawtioreact.Logger.getLevel())
    // Load OpenShift OAuth plugin first
    await mods.oAuth.oAuthInit()
    mods.oAuth.onlineOAuth()
    configManager.initItem('OAuth2 Authentication', TaskState.finished, 'plugins')

    // Import and resolve kubernetes api
    configManager.initItem('Kubernetes API', TaskState.started, 'plugins')
    mods.kube.log.log('Logging Level set to', mods.hawtioreact.Logger.getLevel())
    await mods.kube.isK8ApiRegistered()
    configManager.initItem('Kubernetes API', TaskState.finished, 'plugins')

    configManager.initItem('Hawtio UI', TaskState.started, 'plugins')
    await import('@hawtio/react/ui')
    configManager.initItem('Hawtio UI', TaskState.finished, 'plugins')

    // hawtio.bootstrap() will wait for all init items to be ready, so we have to finish 'loading'
    // stage of UI. UI will be rendered after bootstrap() returned promise is resolved
    configManager.initItem('Loading UI', TaskState.finished, 'config')

    // finally, after we've registered all custom and built-in plugins, we can proceed to the final stage:
    //  - bootstrap(), which finishes internal configuration, applies branding and loads all registered plugins
    //  - rendering of <Hawtio> React component after bootstrap() finishes
    await mods.hawtioreact.hawtio.bootstrap()

    const authComp = await import('./login')
    import('./Kubernetes').then(kComp => {
      root.render(
        <React.StrictMode>
          <BrowserRouter>
            <Routes>
              <Route path='/login' element={<authComp.AuthLoginPage />} />
              <Route path='/*' element={<kComp.Kubernetes />} />
            </Routes>
          </BrowserRouter>
        </React.StrictMode>,
      )
    })
  }

  // Execute the bootstrap function asynchronously and catch any errors.
  bootstrapInit().catch(error => {
    /* eslint-disable no-console */
    console.error('An Error occurred while bootstrapping the application', error)
  })
})
