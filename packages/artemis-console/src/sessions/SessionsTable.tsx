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
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core'
import { type IAction } from '@patternfly/react-table'

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

// returns a filter for connections table to show session's connection
const getConnectionFilter: (row: TableRow) => Filter = row => {
  return {
    tab: 'connections',
    column: 'connectionID',
    operation: 'EQUALS',
    input: row.connectionID
  }
}

// returns a filter for consumers of current session
const getConsumerFilter: (row: TableRow) => Filter = row => {
  return {
    tab: 'consumers',
    column: 'session',
    operation: 'EQUALS',
    input: row.id
  }
}

// returns a filter for producers of current session
const getProducerFilter: (row: TableRow) => Filter = row => {
  return {
    tab: 'producers',
    column: 'session',
    operation: 'EQUALS',
    input: row.id
  }
}

// see org.apache.activemq.artemis.core.management.impl.view.SessionView
const allColumns: TableColumn[] = [
  { id: 'id', type: ColumnType.STRING, name: 'ID', visible: false, sortable: true, filterable: true },
  { id: 'connectionID', type: ColumnType.STRING, name: 'Connection ID', visible: true, sortable: true, filterable: true, filter: getConnectionFilter },
  { id: 'clientID', type: ColumnType.STRING, name: 'Client ID', visible: true, sortable: true, filterable: true },
  { id: 'consumerCount', type: ColumnType.NUMBER, name: 'Consumer Count', visible: true, sortable: true, filterable: true, filter: getConsumerFilter },
  { id: 'producerCount', type: ColumnType.NUMBER, name: 'Producer Count', visible: true, sortable: true, filterable: true, filter: getProducerFilter },
  { id: 'user', type: ColumnType.STRING, name: 'User', visible: true, sortable: true, filterable: true },
  { id: 'validatedUser', type: ColumnType.STRING, name: 'Validated User', visible: false, sortable: true, filterable: true },
  // string, because it's java.util.Date.toString()
  { id: 'creationTime', type: ColumnType.STRING, name: 'Creation Time', visible: true, sortable: true, filterable: false }
]

const initialFilter: Filter = { tab: 'sessions', column: allColumns[1].id, operation: 'CONTAINS', input: '' }
const initialSort: ActiveSort = { column: allColumns[1].id, order: SortDirection.ASCENDING }

export const SessionsTable: React.FunctionComponent<ArtemisTableFilterProps> = props => {

  const [showSessionCloseDialog, setShowSessionCloseDialog] = useState(false)
  const [sessionToClose, setSessionToClose] = useState('')
  const [sessionConnection, setSessionConnection] = useState('')
  const [refreshCount, setRefreshCount] = useState(0)

  const listSessions = useCallback(async (page: number, perPage: number, sort: ActiveSort | undefined, filters: Filter[]): Promise<TableRowsData> => {
    return loadFilteredData('sessions', artemisService.getSessions.bind(artemisService), page, perPage, sort, filters, initialFilter)
  }, [])

  const closeSession = () => {
    artemisService.closeSession(sessionConnection, sessionToClose)
      .then((_value) => {
        setShowSessionCloseDialog(false)
        setRefreshCount(c => c + 1)
        eventService.notify({
          type: 'success',
          message: 'Connection Closed',
          duration: 3000,
        })
      })
      .catch((error) => {
        setShowSessionCloseDialog(false)
        eventService.notify({ type: 'danger', message: 'Session Not Closed: ' + jolokiaService.errorMessage(error) })
      })
  }

  const getRowActions = (row: TableRow): IAction[] => {
    return [
      {
        title: 'Close',
        onClick: () => {
          console.debug(`Clicked on Some action, on row delete ${row.id}`)
          setSessionToClose(row.id)
          setSessionConnection(row.connectionID)
          setShowSessionCloseDialog(true)
        }
      }
    ]
  }

  return (
    <>
      <ArtemisTable allColumns={allColumns}
                    initialFilter={initialFilter}
                    initialSort={initialSort}
                    getData={listSessions}
                    storageColumnLocation={columnStorage.sessions}
                    getRowActions={getRowActions}
                    refreshCount={refreshCount}
                    switchTab={props.switchTab}
                    filters={props.filters}
                    refresh={() => {
                      setRefreshCount(c => c + 1)
                    }}
                    editGlobalFilter={props.editGlobalFilter} />

      <Modal aria-label='session-close-modal' variant={ModalVariant.medium} isOpen={showSessionCloseDialog}
             onClose={() => setShowSessionCloseDialog(false)}
             onKeyDown={(e) => {
               if (e.key === 'Escape') {
                 setShowSessionCloseDialog(false)
               }
             }}>
        <ModalHeader title='Close Session?' titleIconVariant='warning' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to close session with id:  <b>{sessionToClose}</b>.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key='confirm' variant='danger' onClick={closeSession}>
            Confirm
          </Button>
          <Button key='cancel' variant='link' onClick={() => setShowSessionCloseDialog(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
