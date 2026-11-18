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
  Button, Content, ContentVariants,
  Label,
  LabelStatus,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant
} from '@patternfly/react-core'
import { type IAction } from '@patternfly/react-table'
import { RhUiInfrastructureIcon } from '@patternfly/react-icons/dist/esm/icons/rh-ui-infrastructure-icon'

import { eventService, jolokiaService } from '@hawtio/react'

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

// a filter function used to navigate to a filtered table of sessions for particular connection
// the returned filter is for columns of the sessions tab
const getSessionFilter: (row: TableRow) => Filter = row => {
  return {
    tab: 'sessions',
    column: 'connectionID',
    operation: 'EQUALS',
    input: row.connectionID
  }
}

// see org.apache.activemq.artemis.core.management.impl.view.ConnectionView
const allColumns: TableColumn[] = [
  { id: 'connectionID', type: ColumnType.STRING, name: 'ID', visible: false, sortable: true, filterable: true },
  { id: 'clientID', type: ColumnType.STRING, name: 'Client ID', visible: true, sortable: true, filterable: true },
  { id: 'users', type: ColumnType.STRING, name: 'Users', visible: true, sortable: true, filterable: true },
  { id: 'protocol', type: ColumnType.STRING, name: 'Protocol', visible: true, sortable: true, filterable: true, component: (v) => (<Label icon={<RhUiInfrastructureIcon />} status={LabelStatus.info}>{v}</Label>) },
  { id: 'sessionCount', type: ColumnType.NUMBER, name: 'Session Count', visible: true, sortable: true, filterable: true, filter: getSessionFilter },
  { id: 'remoteAddress', type: ColumnType.STRING, name: 'Remote Address', visible: true, sortable: true, filterable: true },
  { id: 'localAddress', type: ColumnType.STRING, name: 'Local Address', visible: true, sortable: true, filterable: true },
  // there's no 'session' field...
  // { id: 'session', type: ColumnType.STRING, name: 'Session ID', visible: true, sortable: true, filterable: false },
  // string, because it's java.util.Date.toString()
  { id: 'creationTime', type: ColumnType.STRING, name: 'Creation Time', visible: true, sortable: true, filterable: false }
  // could also add (2.57.0): implementation, proxyAddress, proxyProtocolVersion
]

// pick only a column which is filterable
const initialFilter: Filter = { tab: 'connections', column: allColumns[1].id, operation: 'CONTAINS', input: '' }
// pick only a column which is sortable
const initialSort: ActiveSort = { column: allColumns[1].id, order: SortDirection.ASCENDING }

export const ConnectionsTable: React.FunctionComponent<ArtemisTableFilterProps> = props => {

  const [showConnectionCloseDialog, setShowConnectionCloseDialog] = useState(false)
  const [connectionToClose, setConnectionToClose] = useState('')
  const [refreshCount, setRefreshCount] = useState(0)

  const listConnections = useCallback(async (page: number, perPage: number, sort: ActiveSort | undefined, filters: Filter[]): Promise<TableRowsData> => {
    return loadFilteredData('connections', artemisService.getConnections.bind(artemisService), page, perPage, sort, filters, initialFilter)
  }, [])

  const closeConnection = () => {
    artemisService.closeConnection(connectionToClose)
      .then((_value) => {
        setShowConnectionCloseDialog(false)
        setRefreshCount(c => c + 1)
        eventService.notify({
          type: 'success',
          message: 'Connection Closed',
          duration: 3000,
        })
      })
      .catch((error) => {
        setShowConnectionCloseDialog(false)
        eventService.notify({ type: 'danger', message: 'Connection Not Closed: ' + jolokiaService.errorMessage(error) })
      })
  }

  const getRowActions = (row: TableRow): IAction[] => {
    return [
      {
        title: 'Close',
        onClick: () => {
          console.debug(`clicked on Some action, on row delete ${row.connectionID}`)
          setConnectionToClose(row.connectionID)
          setShowConnectionCloseDialog(true)
        }
      }
    ]
  }

  return (
    <>
      <ArtemisTable allColumns={allColumns}
                    initialFilter={initialFilter}
                    initialSort={initialSort}
                    getData={listConnections}
                    storageColumnLocation={columnStorage.connections}
                    getRowActions={getRowActions}
                    refreshCount={refreshCount}
                    switchTab={props.switchTab}
                    filters={props.filters}
                    refresh={() => {
                      setRefreshCount(c => c + 1)
                    }}
                    editGlobalFilter={props.editGlobalFilter} />

      <Modal aria-label='connection-close-modal' variant={ModalVariant.medium} isOpen={showConnectionCloseDialog}
             onClose={() => setShowConnectionCloseDialog(false)}
             onKeyDown={(e) => {
               if (e.key === 'Escape') {
                 setShowConnectionCloseDialog(false)
               }
             }}>
        <ModalHeader title='Close Connection?' titleIconVariant='warning' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to close connection with id: <b>{connectionToClose}</b>.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key='confirm' variant='danger'  onClick={closeConnection}>
            Confirm
          </Button>
          {/* According to https://www.patternfly.org/components/modal/design-guidelines, this should be a link */}
          <Button key='cancel' variant='link' onClick={() => setShowConnectionCloseDialog(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
