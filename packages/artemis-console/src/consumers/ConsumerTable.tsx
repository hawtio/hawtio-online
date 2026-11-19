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

// a filter for navigation to consumer's session
const getSessionFilter: (row: TableRow) => Filter = row => {
  return {
    tab: 'sessions',
    column: 'id',
    operation: 'EQUALS',
    input: row.session
  }
}

// a filter for navigation to consumer's address
const getAddressFilter: (row: TableRow) => Filter = row => {
  return {
    tab: 'addresses',
    column: 'name',
    operation: 'EQUALS',
    input: row.address
  }
}

// a filter for navigation to consumer's queue
const getQueueFilter: (row: TableRow) => Filter = row => {
  return {
    tab: 'queues',
    column: 'name',
    operation: 'EQUALS',
    input: row.queue
  }
}

// see org.apache.activemq.artemis.core.management.impl.view.ConsumerView
const allColumns: TableColumn[] = [
  // Long.toString()
  { id: 'id', type: ColumnType.NUMBER, name: 'ID', visible: false, sortable: true, filterable: true },
  { id: 'session', type: ColumnType.STRING, name: 'Session', visible: true, sortable: true, filterable: true, filter: getSessionFilter },
  { id: 'clientID', type: ColumnType.STRING, name: 'Client ID', visible: true, sortable: true, filterable: true },
  { id: 'user', type: ColumnType.STRING, name: 'User', visible: true, sortable: true, filterable: true },
  { id: 'validatedUser', type: ColumnType.STRING, name: 'Validated User', visible: true, sortable: true, filterable: true },
  { id: 'protocol', type: ColumnType.STRING, name: 'Protocol', visible: true, sortable: true, filterable: false, component: (v) => (<Label icon={<RhUiInfrastructureIcon />} status={LabelStatus.info}>{v}</Label>) },
  { id: 'queue', type: ColumnType.STRING, name: 'Queue', visible: true, sortable: true, filterable: true, filter: getQueueFilter },
  { id: 'queueType', type: ColumnType.STRING, name: 'Queue Type', visible: true, sortable: true, filterable: false },
  { id: 'filter', type: ColumnType.STRING, name: 'Filter', visible: true, sortable: true, filterable: false },
  { id: 'address', type: ColumnType.STRING, name: 'Address', visible: true, sortable: true, filterable: true, filter: getAddressFilter },
  { id: 'remoteAddress', type: ColumnType.STRING, name: 'Remote Address', visible: true, sortable: true, filterable: true },
  { id: 'localAddress', type: ColumnType.STRING, name: 'Local Address', visible: true, sortable: true, filterable: true },
  // string, because it's java.util.Date.toString()
  { id: 'creationTime', type: ColumnType.STRING, name: 'Creation Time', visible: true, sortable: true, filterable: false },
  // Integer.toString()
  { id: 'messagesInTransit', type: ColumnType.NUMBER, name: 'Messages in Transit', visible: false, sortable: true, filterable: true },
  // Long.toString()
  { id: 'messagesInTransitSize', type: ColumnType.NUMBER, name: 'Messages in Transit Size', visible: false, sortable: true, filterable: true },
  // Long.toString()
  { id: 'messagesDelivered', type: ColumnType.NUMBER, name: 'Messages Delivered', visible: false, sortable: true, filterable: true },
  // Long.toString()
  { id: 'messagesDeliveredSize', type: ColumnType.NUMBER, name: 'Messages Delivered Size', visible: false, sortable: true, filterable: true },
  // Long.toString()
  { id: 'messagesAcknowledged', type: ColumnType.NUMBER, name: 'Messages Acknowledged', visible: false, sortable: true, filterable: true },
  // Integer.toString()
  { id: 'messagesAcknowledgedAwaitingCommit', type: ColumnType.NUMBER, name: 'Messages Acknowledged awaiting Commit', visible: false, sortable: true, filterable: true },
  { id: 'lastDeliveredTime', type: ColumnType.NUMBER, name: 'Last Delivered Time', visible: false, sortable: true, filterable: false },
  { id: 'lastAcknowledgedTime', type: ColumnType.NUMBER, name: 'Last Acknowledged Time', visible: false, sortable: true, filterable: false },
  // OK or Orphaned
  { id: 'status', type: ColumnType.STRING, name: 'Status', visible: false, sortable: true, filterable: false }
]

const initialFilter: Filter = { tab: 'consumers', column: allColumns[1].id, operation: 'CONTAINS', input: '' }
const initialSort: ActiveSort = { column: allColumns[1].id, order: SortDirection.ASCENDING }

export const ConsumerTable: React.FunctionComponent<ArtemisTableFilterProps> = props => {

  const [showConsumerCloseDialog, setShowConsumerCloseDialog] = useState(false)
  const [consumerToClose, setConsumerToClose] = useState('')
  const [consumerSession, setConsumerSession] = useState('')
  const [refreshCount, setRefreshCount] = useState(0)

  const listConsumers = useCallback(async (page: number, perPage: number, sort: ActiveSort | undefined, filters: Filter[]): Promise<TableRowsData> => {
    return loadFilteredData('consumers', artemisService.getConsumers.bind(artemisService), page, perPage, sort, filters, initialFilter)
  }, [])

  const closeConsumer = () => {
    artemisService.closeConsumer(consumerSession, consumerToClose)
      .then((_value) => {
        setShowConsumerCloseDialog(false)
        setRefreshCount(c => c + 1)
        eventService.notify({
          type: 'success',
          message: 'Consumer Closed',
          duration: 3000,
        })
      })
      .catch((error) => {
        setShowConsumerCloseDialog(false)
        eventService.notify({ type: 'danger', message: 'Consumer Not Closed: ' + jolokiaService.errorMessage(error) })
      })
  }

  const getRowActions = (row: TableRow): IAction[] => {
    return [
      {
        title: 'Close',
        onClick: () => {
          console.log(`Clicked on Some action, on row delete ${row.id}`)
          setConsumerToClose(row.id)
          setConsumerSession(row.session)
          setShowConsumerCloseDialog(true)
        }
      }
    ]
  }

  return (
    <>
      <ArtemisTable allColumns={allColumns}
                    initialFilter={initialFilter}
                    initialSort={initialSort}
                    getData={listConsumers}
                    storageColumnLocation={columnStorage.consumers}
                    getRowActions={getRowActions}
                    refreshCount={refreshCount}
                    switchTab={props.switchTab}
                    filters={props.filters}
                    refresh={() => {
                      setRefreshCount(c => c + 1)
                    }}
                    editGlobalFilter={props.editGlobalFilter} />

      <Modal aria-label='consumer-close-modal' variant={ModalVariant.medium} isOpen={showConsumerCloseDialog}
             onClose={() => setShowConsumerCloseDialog(false)}
             onKeyDown={(e) => {
               if (e.key === 'Escape') {
                 setShowConsumerCloseDialog(false)
               }
             }}>
        <ModalHeader title='Close Consumer?' titleIconVariant='warning' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to close consumer with id: <b>{consumerToClose}</b>.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key='confirm' variant='danger' onClick={closeConsumer}>
            Confirm
          </Button>
          <Button key='cancel' variant='link' onClick={() => setShowConsumerCloseDialog(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
