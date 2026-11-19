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
import { log } from "./globals"
import { configManager as hawtioConfigManager, TaskState } from '@hawtio/react/init'

/**
 * Artemis specific configuration object
 */
export type Artemisconfig = {
    /**
     * Configuration for Artemis JMX
     */
    jmx: JMXConfig
}

/**
 * Artemis JMX configuration type.
 */
export type JMXConfig = {
    /**
     * JMX domain to use for Jolokia/JMX access
     */
    domain: string
}

/**
 * Default configuration if server configuration can't be found
 */
const DEFAULT_CONFIG = {
    jmx: {
        domain: 'org.apache.activemq.artemis'
    }
}

export const ARTEMISCONFIG_JSON = 'artemisconfig.json'

/**
 * Class that handles loading of `artemisconfig.json` configuration file
 */
class ConfigManager {
    private config?: Promise<Artemisconfig>

    /**
     * Initialization should be called before registration of Hawtio Artemis plugins in Artemis Extension
     * _entry point_ (which is the exported `artemis()` function of `HawtioPlugin` type)
     */
    initialize() {
        // will schedule asynchronous fetch operation
        this.getArtemisconfig()
    }

    async getArtemisconfig(): Promise<Artemisconfig> {
        if (this.config) {
            return this.config
        }

        this.config = this.loadConfig()
        return this.config
    }

    private async loadConfig(): Promise<Artemisconfig> {
        try {
            hawtioConfigManager.initItem(`Loading ${ARTEMISCONFIG_JSON}`, TaskState.started, 'config')
            const res = await fetch(ARTEMISCONFIG_JSON)
            if (!res.ok) {
                hawtioConfigManager.initItem(`Loading ${ARTEMISCONFIG_JSON}`, TaskState.skipped, 'config')
                log.info("Unable to load Artemis Config, using Default");
                return DEFAULT_CONFIG
            }

            const config = await res.json()
            hawtioConfigManager.initItem(`Loading ${ARTEMISCONFIG_JSON}`, TaskState.finished, 'config')
            log.info("Loaded Artemis Config:", config);
            return config
        } catch (err) {
            hawtioConfigManager.initItem(`Loading ${ARTEMISCONFIG_JSON}`, TaskState.skipped, 'config')
            log.info("Unable to load Artemis Config, using Default");
            return DEFAULT_CONFIG
        }
    }
}

export const configManager = new ConfigManager()
