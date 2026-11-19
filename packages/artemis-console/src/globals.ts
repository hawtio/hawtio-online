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
import { Logger } from '@hawtio/react'

export const artemisPluginName = 'artemis'
export const artemisPluginTitle = 'Artemis'
export const artemisPluginPath = '/artemis'
export const artemisNetworkPluginName = 'artemis-network'
export const artemisNetworkPluginTitle = 'Artemis Network'
export const artemisNetworkPluginPath = '/artemis-network'
export const artemisJMXPluginName = 'artemisJMX'
export const artemisJMXPluginTitle = 'Artemis JMX'
export const artemisJMXPluginPath = '/artemis-jmx'
export const artemisHeaderPluginName = 'artemisHeader'

export const domainNodeType = 'Camel Domain'
export const contextsType = 'contexts'
export const contextNodeType = 'context'

export const endpointNodeType = 'endpointNode'

export const storageKeyFilters = 'artemis.globalFilters'

export const PARAM_KEY_NODE_ID = 'nid'

if (localStorage) {
  if (!localStorage.getItem('core.logging.logLevel')) {
    // set only if not configured by user in Hawtio
    const isProd = process.env.NODE_ENV === 'production'
    Logger.setLevel(isProd ? 'ERROR' : 'INFO')
  }
}
export const log = Logger.get(artemisPluginName)
