import { hawtio, HawtioPlugin } from '@hawtio/react'
import { pluginPath } from './globals'
import { Discover } from './Discover'
import { HeaderMenuDropDown } from './HeaderMenuDropDown'

export const discover: HawtioPlugin = () => {
  hawtio.addPlugin({
    id: 'discover',
    title: 'Discover',
    path: pluginPath,
    component: Discover,
    headerItems: [ HeaderMenuDropDown ],
    isActive: async () => true
  })
}
