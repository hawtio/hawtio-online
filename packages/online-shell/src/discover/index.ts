import { hawtio, HawtioPlugin, connectService } from '@hawtio/react'
import { pluginPath } from './globals'
import { Discover } from './Discover'

const pluginId = 'discover'
const pluginTitle = 'Discover'

export const discover: HawtioPlugin = () => {
  hawtio.addPlugin({
    id: pluginId,
    title: pluginTitle,
    path: pluginPath,
    component: Discover,
    /*
     * order must be smaller (higher priority) than discover-core
     * to ensure it is the default
     */
    order: 31,
    isActive: async () => {
      // Only active is there is NO current connection
      const connection = await connectService.getCurrentConnection()
      return !connection
    },
  })
}

export { log } from './globals'
