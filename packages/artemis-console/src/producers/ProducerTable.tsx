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
import React, { useCallback, useState } from 'react'
import {
  Label,
  LabelStatus
} from '@patternfly/react-core'
import { RhUiInfrastructureIcon } from '@patternfly/react-icons/dist/esm/icons/rh-ui-infrastructure-icon'

import { artemisService } from '../artemis-service'
import { columnStorage } from '../artemis-preferences-service'
import {
  type ActiveSort,
  ColumnType,
  type Filter,
  SortDirection,
  type TableColumn,
  type TableRow,
  type TableRowsData
} from '../table/types'
import { loadFilteredData } from '../table/utils'
import { ArtemisTable, type ArtemisTableFilterProps } from '../table/ArtemisTable'

// a filter for navigation to producer's session
const getSessionFilter: (row: TableRow) => Filter = row => {
  return {
    tab: 'sessions',
    column: 'id',
    operation: 'EQUALS',
    input: row.session
  }
}

// a filter for navigation to producer's address
const getAddressFilter: (row: TableRow) => Filter = row => {
  return {
    tab: 'addresses',
    column: 'name',
    operation: 'EQUALS',
    input: row.address
  }
}

// see org.apache.activemq.artemis.core.management.impl.view.ProducerView
const allColumns: TableColumn[] = [
  // Long.toString()
  { id: 'id', type: ColumnType.NUMBER, name: 'ID', visible: false, sortable: true, filterable: true },
  { id: 'name', type: ColumnType.STRING, name: 'Name', visible: true, sortable: true, filterable: true },
  { id: 'session', type: ColumnType.STRING, name: 'Session', visible: true, sortable: true, filterable: true, filter: getSessionFilter },
  { id: 'clientID', type: ColumnType.STRING, name: 'Client ID', visible: true, sortable: true, filterable: true },
  { id: 'user', type: ColumnType.STRING, name: 'User', visible: true, sortable: true, filterable: true },
  { id: 'address', type: ColumnType.STRING, name: 'Address', visible: true, sortable: true, filterable: true, filter: getAddressFilter },
  { id: 'validatedUser', type: ColumnType.STRING, name: 'Validated User', visible: true, sortable: true, filterable: true },
  { id: 'protocol', type: ColumnType.STRING, name: 'Protocol', visible: true, sortable: true, filterable: true, component: (v) => (<Label icon={<RhUiInfrastructureIcon />} status={LabelStatus.info}>{v}</Label>) },
  { id: 'localAddress', type: ColumnType.STRING, name: 'Local Address', visible: true, sortable: true, filterable: true },
  { id: 'remoteAddress', type: ColumnType.STRING, name: 'Remote Address', visible: true, sortable: true, filterable: true },
  { id: 'msgSent', type: ColumnType.NUMBER, name: 'Messages Sent', visible: false, sortable: true, filterable: false },
  { id: 'msgSizeSent', type: ColumnType.NUMBER, name: 'Messages Sent Size', visible: false, sortable: true, filterable: false },
  { id: 'lastProducedMessageID', type: ColumnType.STRING, name: 'Last Produced Message ID', visible: false, sortable: true, filterable: false },
  // actually a string value of the timestamp
  { id: 'creationTime', type: ColumnType.NUMBER, name: 'Creation Time', visible: true, sortable: true, filterable: false }
]

const initialFilter: Filter = { tab: 'producers', column: allColumns[1].id, operation: 'CONTAINS', input: '' }
const initialSort: ActiveSort = { column: allColumns[1].id, order: SortDirection.ASCENDING }

export const ProducerTable: React.FunctionComponent<ArtemisTableFilterProps> = props => {

  const [refreshCount, setRefreshCount] = useState(0)

  const listProducers = useCallback(async (page: number, perPage: number, sort: ActiveSort | undefined, filters: Filter[]): Promise<TableRowsData> => {
    return loadFilteredData('producers', artemisService.getProducers.bind(artemisService), page, perPage, sort, filters, initialFilter)
  }, [])

  return (
    <ArtemisTable allColumns={allColumns}
                  initialFilter={initialFilter}
                  initialSort={initialSort}
                  getData={listProducers}
                  storageColumnLocation={columnStorage.producers}
                  refreshCount={refreshCount}
                  switchTab={props.switchTab}
                  filters={props.filters}
                  refresh={() => {
                    setRefreshCount(c => c + 1)
                  }}
                  editGlobalFilter={props.editGlobalFilter} />
  )
}
