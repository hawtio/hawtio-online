import { hawtio, HawtioPlugin } from '@hawtio/react'
import { log, pluginPath } from './globals'
import { Discover } from './Discover'

export const discover: HawtioPlugin = () => {
  hawtio.addPlugin({
    id: 'online',
    title: 'Online',
    path: pluginPath,
    component: Discover,
    isActive: async () => true
  })

  // helpRegistry.add('camel', 'Camel', help, 13)
  // preferencesRegistry.add('camel', 'Camel', CamelPreferences, 13)

  // log.info('Using Camel versions:', getCamelVersions())
}
