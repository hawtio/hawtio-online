/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { type HawtioPlugin, hawtio, configManager as hawtioConfigMgr, helpRegistry, treeProcessorRegistry, workspace, preferencesRegistry, type Plugin } from '@hawtio/react'
import { log, artemisPluginName, artemisPluginTitle, artemisPluginPath, artemisJMXPluginName, artemisJMXPluginPath, artemisJMXPluginTitle, artemisHeaderPluginName } from './globals'
import help from './help.md'
import { artemisService } from './artemis-service'
import { configManager } from './config-manager'
import { artemisTreeProcessor } from './artemis-tree-processor'
import { PARAM_KEY_NODE_ID } from './globals'

/**
 * Main entry point to Artemis Console Extension called during application bootstrap (`bootstrap.tsx`) before
 * calling `hawtio.bootstrap()`
 */
export const artemis: HawtioPlugin = () => {

  log.info('Loading', artemisPluginName);

  // explicit initialization of all services that need to fetch() some data.
  // these services are integrated with Hawtio's configManager initialization items
  configManager.initialize()
  artemisService.initialize()

  const isActive = async () => {
    try {
      return workspace.treeContainsDomainAndProperties((await configManager.getArtemisconfig()).jmx.domain)
    } catch {
      return false
    }
  }

  // The plugins are registered in a deferred way after asynchronously importing UI related package
  // which uses Patternfly components
  // single 'artemis-plugins' _plugin_ is actually a "deferred plugin" which returns 3 actual plugins with IDs:
  //  - artemis
  //  - artemisJMX
  //  - artemisHeader
  hawtio.addDeferredPlugin('artemis-plugins', async () => {
    return import('./plugin-ui').then(m => {
      preferencesRegistry.add(artemisPluginName, artemisPluginTitle, m.ArtemisPreferences, 1)

      treeProcessorRegistry.add('artemis', artemisTreeProcessor)

      const plugins: Plugin[] = []
      plugins.push({
        id: artemisPluginName,
        title: artemisPluginTitle,
        path: artemisPluginPath,
        component: m.Artemis,
        order: -2,
        isActive: isActive,
      })

      plugins.push({
        id: artemisJMXPluginName,
        title: artemisJMXPluginTitle,
        path: artemisJMXPluginPath,
        component: m.ArtemisJMX,
        knownQueryParams: [PARAM_KEY_NODE_ID],
        order: -1,
        isActive: isActive,
      })

      plugins.push({
        id: artemisHeaderPluginName,
        title: artemisHeaderPluginName,
        headerItems: [{ component: m.ArtemisHeader, universal: true }],
        order: 200,
        isActive: isActive,
      })

      return plugins
    })
  })

  helpRegistry.add(artemisPluginName, artemisPluginTitle, help, 1)

  // See package.json "replace-version" script for how to replace the version placeholder with a real version
  hawtioConfigMgr.addProductInfo('Artemis Console Plugin', '1.8.0')
}
