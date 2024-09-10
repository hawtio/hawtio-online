import { hawtio, HawtioPlugin } from '@hawtio/react'
import { pluginPath } from './globals'
import { Discover } from './Discover'
import { HeaderMenuDropDown } from './HeaderMenuDropDown'
import { preferencesRegistry } from '@hawtio/react'
import { DiscoverPreferences } from './DiscoverPreferences'

const pluginId = 'discover'
const pluginTitle = 'Discover'

export const discover: HawtioPlugin = () => {
  hawtio.addPlugin({
    id: pluginId,
    title: pluginTitle,
    path: pluginPath,
    component: Discover,
    headerItems: [{ component: HeaderMenuDropDown, universal: true }],
    isActive: async () => true,
  })

  preferencesRegistry.add(pluginId, pluginTitle, DiscoverPreferences)
}
