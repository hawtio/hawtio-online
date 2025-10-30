import { hawtio, HawtioPlugin, preferencesRegistry } from '@hawtio/react'
import { HeaderMenuDropDown } from './HeaderMenuDropDown'
import { DiscoverPreferences } from './DiscoverPreferences'

const pluginId = 'discover-core'
const pluginTitle = 'Discover'

/*
 * Discover core plugin, always enabled, provides:
 * - preferences for managing the polling of pods in master
 * - the universal header menu listing all the pods
 *
 * No plugin-path since it is not required to display a
 * link in the nav-bar to display a main component
 */

export const discoverCore: HawtioPlugin = () => {
  hawtio.addPlugin({
    id: pluginId,
    title: pluginTitle,
    headerItems: [{ component: HeaderMenuDropDown, universal: true }],
    /*
     * order must be bigger (low priority) than discover-core
     * to ensure it is not the default
     */
    order: 200,
    isActive: async () => true,
  })

  preferencesRegistry.add(pluginId, pluginTitle, DiscoverPreferences)
}

export { log } from './globals'
