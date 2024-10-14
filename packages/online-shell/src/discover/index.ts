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
    isActive: async () => {
      // Only active is there is NO current connection
      const connection = await connectService.getCurrentConnection()
      return !connection
    },
  })
}
