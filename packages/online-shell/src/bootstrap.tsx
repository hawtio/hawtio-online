import React from 'react'
import ReactDOM from 'react-dom/client'
import { HAWTIO_ONLINE_VERSION } from './constants'
import { configManager, HawtioInitialization, TaskState } from '@hawtio/react/init'
import { bootstrapModules } from './bootstrap-modules'

// Hawtio itself creates and tracks initialization tasks, but we can add our own.
configManager.initItem('Loading UI', TaskState.started, 'config')

// Create root for rendering React components. More React components can be rendered in single root.
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

// Basic UI that shows initialization progress without depending on PatternFly.
// It is imported and rendered in fully synchronous way.
root.render(<HawtioInitialization verbose={true} />)

// Configure the console\
configManager.addProductInfo('Hawtio Online', HAWTIO_ONLINE_VERSION)

/*
 * Bootstrap all required modules first, essentially enforces download
 * of all chunks required for proceeding with this bootstrap process.
 */
bootstrapModules().then(mods => {
  const bootstrapInit = async () => {
    configManager.initItem('OAuth2 Authentication', TaskState.started, 'plugins')
    mods.oAuth.log.setLevel(mods.hawtioreact.Logger.getLevel())
    mods.oAuth.log.log('OAuth Logging Level set to', mods.oAuth.log.getLevel())
    // Load OpenShift OAuth plugin first
    await mods.oAuth.oAuthInit()
    mods.oAuth.onlineOAuth()
    configManager.initItem('OAuth2 Authentication', TaskState.finished, 'plugins')

    // Import and resolve kubernetes api
    configManager.initItem('Kubernetes API', TaskState.started, 'plugins')
    mods.kube.log.setLevel(mods.hawtioreact.Logger.getLevel())
    mods.kube.log.log('Kubernetes Logging Level set to', mods.kube.log.getLevel())
    await mods.kube.isK8ApiRegistered()
    configManager.initItem('Kubernetes API', TaskState.finished, 'plugins')

    // Import and resolve management api
    configManager.initItem('Jolokia Management API', TaskState.started, 'plugins')
    mods.mgmt.log.setLevel(mods.hawtioreact.Logger.getLevel())
    mods.mgmt.log.log('Management API Logging Level set to', mods.mgmt.log.getLevel())
    await mods.mgmt.isMgmtApiRegistered()
    configManager.initItem('Jolokia Management API', TaskState.finished, 'plugins')

    // Register Hawtio builtin plugins
    configManager.initItem('Hawtio Plugins', TaskState.started, 'plugins')
    mods.hawtioreact.jmx()
    mods.hawtioreact.rbac()
    mods.hawtioreact.camel()
    mods.hawtioreact.runtime()
    mods.hawtioreact.logs()
    mods.hawtioreact.quartz()
    mods.hawtioreact.springboot()
    configManager.initItem('Hawtio Plugins', TaskState.finished, 'plugins')

    configManager.initItem('Hawtio UI', TaskState.started, 'plugins')
    const hawtioUiMod = await import('@hawtio/react/ui')
    configManager.initItem('Hawtio UI', TaskState.finished, 'plugins')

    // Register discover-core plugin
    configManager.initItem('Discover Core Plugin', TaskState.started, 'plugins')
    const discoverCoreMod = await import('./discover-core')
    discoverCoreMod.log.setLevel(mods.hawtioreact.Logger.getLevel())
    discoverCoreMod.log.log('Discover Core Logging Level set to', discoverCoreMod.log.getLevel())
    discoverCoreMod.discoverCore()
    configManager.initItem('Discover Core Plugin', TaskState.finished, 'plugins')

    // Register discover UI plugin
    configManager.initItem('Discover UI Plugin', TaskState.started, 'plugins')
    const discoverMod = await import('./discover')
    discoverMod.log.setLevel(mods.hawtioreact.Logger.getLevel())
    discoverMod.log.log('Discover Logging Level set to', discoverMod.log.getLevel())
    discoverMod.discover()
    configManager.initItem('Discover UI Plugin', TaskState.finished, 'plugins')

    // hawtio.bootstrap() will wait for all init items to be ready, so we have to finish 'loading'
    // stage of UI. UI will be rendered after bootstrap() returned promise is resolved
    configManager.initItem('Loading UI', TaskState.finished, 'config')

    // finally, after we've registered all custom and built-in plugins, we can proceed to the final stage:
    //  - bootstrap(), which finishes internal configuration, applies branding and loads all registered plugins
    //  - rendering of <Hawtio> React component after bootstrap() finishes
    await mods.hawtioreact.hawtio.bootstrap()

    root.render(
      <React.StrictMode>
        <hawtioUiMod.Hawtio />
      </React.StrictMode>,
    )
  }

  // Execute the bootstrap function asynchronously and catch any errors.
  bootstrapInit().catch(error => {
    /* eslint-disable no-console */
    console.error('An Error occurred while bootstrapping the application', error)
  })
})
