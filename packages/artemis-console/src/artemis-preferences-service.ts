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
import { TableColumn, TableColumnState } from "./table/types"

const PAGE_SIZE = ".pageSize";

/** Keys for `<ArtemisTabs>` screens to store configuration for filters (in order of appearance) */
export const columnStorage: Record<string, string> = {
  connections: "connectionsColumnDefs",
  sessions: "sessionsColumnDefs",
  producers: "producerColumnDefs",
  consumers: "consumerColumnDefs",
  addresses: "addressesColumnDefs",
  queues: "queuesColumnDefs",
  messages: "messagesColumnDefs"
}

export interface IArtemisPreferencesService {
  loadArtemisPreferences(): ArtemisOptions
  saveArtemisPreferences(newValues: Partial<ArtemisOptions>): void
  loadColumnPreferences(storageLocation: string, columns: TableColumn[]): TableColumn[]
  saveColumnPreferences(storageLocation: string, columns: TableColumnState[]): void
}

export type ArtemisOptions = {
  artemisDLQ: string
  artemisExpiryQueue: string
  artemisBrowseBytesMessages: number
  artemisDefaultPageSize: number
  artemisMaxDiagramAddressSize: number
}

export const ARTEMIS_PREFERENCES_DEFAULT_VALUES: ArtemisOptions = {
  artemisDLQ: "^DLQ$",
  artemisExpiryQueue: "^ExpiryQueue$",
  artemisBrowseBytesMessages: 99,
  artemisDefaultPageSize: 10,
  artemisMaxDiagramAddressSize: 20
} as const

export const STORAGE_KEY_ARTEMIS_PREFERENCES = 'artemis.preferences'

/**
 * Class that handles preferences kept in `localStorage`. No asynchronous processing.
 */
class ArtemisPreferencesService implements IArtemisPreferencesService {
  loadArtemisPreferences(): ArtemisOptions {
    return { ...ARTEMIS_PREFERENCES_DEFAULT_VALUES, ...this.loadFromStorage() }
  }

  saveArtemisPreferences(newValues: Partial<ArtemisOptions>): void {
    const preferencesToSave = { ...this.loadFromStorage(), ...newValues }

    localStorage.setItem(STORAGE_KEY_ARTEMIS_PREFERENCES, JSON.stringify(preferencesToSave))
  }

  loadColumnPreferences(storageLocation: string, columns: TableColumn[]): TableColumn[] {
    const localStorageData = localStorage.getItem(storageLocation);
    if (localStorageData) {
      const data = JSON.parse(localStorageData);
      data.forEach((def: { name: string; visible: boolean | undefined }) => {
        const column = columns.find(column => column.id === def.name);
        if (column) {
          column.visible = def.visible as boolean;
        }
      })
    }
    return columns;
  }

  saveColumnPreferences(storageLocation: string, columns: TableColumnState[]) {
    const data: { name: string; visible: boolean }[] = [];
    columns.forEach(column => { data.push({ name: column.id, visible: column.visible }) });
    localStorage.setItem(storageLocation, JSON.stringify(data));
  }

  loadTablePageSize(storageLocation: string|undefined): number {
    const localStorageData = localStorage.getItem(storageLocation + PAGE_SIZE);
    if (localStorageData) {
        return Number(localStorageData);
    }
    return this.loadArtemisPreferences().artemisDefaultPageSize;
  }

  saveTablePageSize(storageLocation: string, size: number) {
    localStorage.setItem(storageLocation + PAGE_SIZE, size.toString());
  }

  resetPageSizes() {
    localStorage.removeItem(columnStorage.queues + PAGE_SIZE);
    localStorage.removeItem(columnStorage.addresses + PAGE_SIZE);
    localStorage.removeItem(columnStorage.connections + PAGE_SIZE);
    localStorage.removeItem(columnStorage.consumers + PAGE_SIZE);
    localStorage.removeItem(columnStorage.producers + PAGE_SIZE);
    localStorage.removeItem(columnStorage.sessions + PAGE_SIZE);
    localStorage.removeItem(columnStorage.messages + PAGE_SIZE);
  }

  private loadFromStorage(): Partial<ArtemisOptions> {
    const localStorageData = localStorage.getItem(STORAGE_KEY_ARTEMIS_PREFERENCES)

    const preferences =  localStorageData ? JSON.parse(localStorageData) : {}

    // just a sanity/compatibility check
    let changed = false
    if (preferences && 'artemisDLQ' in preferences) {
      const re = preferences['artemisDLQ']
      try {
        RegExp(re)
      } catch (error) {
        preferences['artemisDLQ'] = ARTEMIS_PREFERENCES_DEFAULT_VALUES.artemisDLQ
        changed = true
      }
    }
    if (preferences && 'artemisExpiryQueue' in preferences) {
      const re = preferences['artemisExpiryQueue']
      try {
        RegExp(re)
      } catch (error) {
        preferences['artemisExpiryQueue'] = ARTEMIS_PREFERENCES_DEFAULT_VALUES.artemisExpiryQueue
        changed = true
      }
    }

    if (changed) {
      localStorage.setItem(STORAGE_KEY_ARTEMIS_PREFERENCES, JSON.stringify(preferences))
    }

    return preferences
  }
}

export const artemisPreferencesService = new ArtemisPreferencesService()
