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
import React, { memo, useCallback, useContext, useMemo, useState } from 'react'
import {
  Button, Content, ContentVariants,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  PageSection,
  Title
} from '@patternfly/react-core'
import { type IAction } from '@patternfly/react-table'
import { Remove2Icon } from '@patternfly/react-icons/dist/esm/icons/remove2-icon'
import { RhUiCleanUpIcon } from '@patternfly/react-icons/dist/esm/icons/rh-ui-clean-up-icon'
import { useLocation, useNavigate } from 'react-router'

import { Attributes, eventService, jolokiaService, Operations } from '@hawtio/react'

import { artemisService, Queue } from '../artemis-service'
import { columnStorage } from '../artemis-preferences-service'
import { artemisJMXPluginPath, artemisPluginPath } from '../globals'
import { ArtemisContext } from '../context'
import { createQueueObjectName } from '../util/jmx'
import {
  type ActiveSort,
  ColumnType,
  type Filter,
  SortDirection,
  type TableColumn,
  type TableRow
} from '../table/types'
import { closeWithEscape, loadFilteredData } from '../table/utils'
import { ArtemisTable, type ArtemisTableFilterProps } from '../table/ArtemisTable'
import { SendMessage } from '../messages/SendMessage'

/**
 * Extension of the `ArtemisTableFilterProps` properties for Artemis tabs with `selectQueue`
 * function dedicated for `<QueuesTable>`
 */
export type QueuesTableFilterProps = ArtemisTableFilterProps & {
  /** A function to navigate from a row of queues table to a list of messages of the selected queue */
  selectQueue: (queue: Queue) => void
}

// a filter for navigation to queue's address
const getAddressFilter: (row: TableRow) => Filter = row => {
  return {
    tab: 'addresses',
    column: 'name',
    operation: 'EQUALS',
    input: row.address
  }
}

// a filter to navigate to queue's consumers
const getConsumersFilter: (row: TableRow) => Filter = row => {
  return {
    tab: 'consumers',
    column: 'queue',
    operation: 'EQUALS',
    input: row.name
  }
}

// A little difference from other tabs - not referring to `allColumns`, which here is memoized inside the component
// so we have to use explicit column names
const initialFilter: Filter = { tab: 'queues', column: 'name', operation: 'CONTAINS', input: '' }
const initialSort: ActiveSort = { column: 'name', order: SortDirection.ASCENDING }

const MemoizedArtemisTable = memo(ArtemisTable)

export const QueuesTable: React.FunctionComponent<QueuesTableFilterProps> = props => {

  const navigate = useNavigate()
  const { search } = useLocation()

  // a function to show a list messages of a queue. Actual navigation function
  // is provided by the component that displays this QueuesTable (which is QueuesView)
  const messageView: (row: TableRow) => void = useCallback(row => {
    props.selectQueue({ name: row.name, address: row.address, routingType: row.routingType })
    navigate({ pathname: `${artemisPluginPath}/queues/messages`, search })
  }, [props.selectQueue, navigate, search])

  // for queues, all the values come (from the broker in JSON) as Strings, but lots of these are numbers and booleans
  // Note: for <QueuesTable> allColumns can't be defined at module level, because of the link property which uses
  // `props.selectQueue`
  const allColumns: TableColumn[] = useMemo(() => [
    { id: 'id', type: ColumnType.NUMBER, name: 'ID', visible: false, sortable: true, filterable: true },
    { id: 'name', type: ColumnType.STRING, name: 'Name', visible: true, sortable: true, filterable: true, link: messageView },
    { id: 'address', type: ColumnType.STRING, name: 'Address', visible: true, sortable: true, filterable: true, filter: getAddressFilter },
    { id: 'routingType', type: ColumnType.STRING, name: 'Routing Type', visible: true, sortable: true, filterable: true },
    { id: 'filter', type: ColumnType.STRING, name: 'Filter', visible: true, sortable: true, filterable: true },
    { id: 'durable', type: ColumnType.BOOLEAN, name: 'Durable', visible: true, sortable: true, filterable: true },
    { id: 'maxConsumers', type: ColumnType.NUMBER, name: 'Max Consumers', visible: true, sortable: true, filterable: true },
    { id: 'purgeOnNoConsumers', type: ColumnType.BOOLEAN, name: 'Purge On No Consumers', visible: true, sortable: true, filterable: true },
    { id: 'consumerCount', type: ColumnType.NUMBER, name: 'Consumer Count', visible: true, sortable: true, filterable: true, filter: getConsumersFilter },
    { id: 'messageCount', type: ColumnType.NUMBER, name: 'Message Count', visible: true, sortable: true, filterable: true, link: messageView },
    { id: 'paused', type: ColumnType.BOOLEAN, name: 'Paused', visible: false, sortable: true, filterable: true },
    { id: 'persistedPause', type: ColumnType.BOOLEAN, name: 'Persisted Pause', visible: false, sortable: true, filterable: true },
    { id: 'temporary', type: ColumnType.BOOLEAN, name: 'Temporary', visible: false, sortable: true, filterable: true },
    { id: 'autoCreated', type: ColumnType.BOOLEAN, name: 'Auto Created', visible: false, sortable: true, filterable: true },
    { id: 'user', type: ColumnType.STRING, name: 'User', visible: false, sortable: true, filterable: true },
    { id: 'messagesAdded', type: ColumnType.NUMBER, name: 'Total Messages Added', visible: false, sortable: true, filterable: true },
    { id: 'messagesAcked', type: ColumnType.NUMBER, name: 'Total Messages Acknowledged', visible: false, sortable: true, filterable: true },
    { id: 'messagesExpired', type: ColumnType.NUMBER, name: 'Total Messages Expired', visible: false, sortable: true, filterable: true },
    { id: 'deliveringCount', type: ColumnType.NUMBER, name: 'Delivering Count', visible: false, sortable: true, filterable: true },
    { id: 'messagesKilled', type: ColumnType.NUMBER, name: 'Messages Killed', visible: false, sortable: true, filterable: true },
    { id: 'directDeliver', type: ColumnType.BOOLEAN, name: 'Direct Deliver', visible: false, sortable: true, filterable: true },
    { id: 'exclusive', type: ColumnType.BOOLEAN, name: 'Exclusive', visible: false, sortable: true, filterable: true },
    { id: 'lastValue', type: ColumnType.BOOLEAN, name: 'Last Value', visible: false, sortable: true, filterable: true },
    { id: 'lastValueKey', type: ColumnType.STRING, name: 'Last Value Key', visible: false, sortable: true, filterable: true },
    { id: 'scheduledCount', type: ColumnType.NUMBER, name: 'Scheduled Count', visible: false, sortable: true, filterable: true },
    { id: 'groupRebalance', type: ColumnType.BOOLEAN, name: 'Group Rebalance', visible: false, sortable: true, filterable: true },
    { id: 'groupRebalancePauseDispatch', type: ColumnType.BOOLEAN, name: 'Group Rebalance Pause Dispatch', visible: false, sortable: true, filterable: true },
    { id: 'groupBuckets', type: ColumnType.NUMBER, name: 'Group Buckets', visible: false, sortable: true, filterable: true },
    { id: 'groupFirstKey', type: ColumnType.STRING, name: 'Group First Key', visible: false, sortable: true, filterable: true },
    { id: 'enabled', type: ColumnType.BOOLEAN, name: 'Queue Enabled', visible: false, sortable: true, filterable: true },
    { id: 'ringSize', type: ColumnType.NUMBER, name: 'Ring Size', visible: false, sortable: true, filterable: true },
    { id: 'consumersBeforeDispatch', type: ColumnType.NUMBER, name: 'Consumers Before Dispatch', visible: false, sortable: true, filterable: true },
    { id: 'delayBeforeDispatch', type: ColumnType.NUMBER, name: 'Delay Before Dispatch', visible: false, sortable: true, filterable: true },
    { id: 'autoDelete', type: ColumnType.BOOLEAN, name: 'Auto Delete', visible: false, sortable: true, filterable: true },
    { id: 'internalQueue', type: ColumnType.BOOLEAN, name: 'Internal', visible: false, sortable: true, filterable: true }
  ], [messageView])

  const listQueues = useCallback(async (page: number, perPage: number, sort: ActiveSort | undefined, filters: Filter[]): Promise<any> => {
    return loadFilteredData('queues', artemisService.getQueues.bind(artemisService), page, perPage, sort, filters, initialFilter)
  }, [])

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showPurgeDialog, setShowPurgeDialog] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [queue, setQueue] = useState('')
  const [address, setAddress] = useState("")
  const [routingType, setRoutingType] = useState("")
  const [queueToPurgeAddress, setQueueToPurgeAddress] = useState("")
  const [queueToPurgeRoutingType, setQueueToPurgeRoutingType] = useState("")
  const [showAttributesDialog, setShowAttributesDialog] = useState(false)
  const [showOperationsDialog, setShowOperationsDialog] = useState(false)
  const routeNavigate = useNavigate()
  const { brokerNode, selectedNode, findAndSelectNode } = useContext(ArtemisContext)
  const [refreshCount, setRefreshCount] = useState(0)

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
  }

  const closePurgeDialog = () => {
    setShowPurgeDialog(false)
  }

  const closeSendDialog = () => {
    setShowSendDialog(false)
  }

  const deleteQueue = useCallback(async (name: string) => {
    await artemisService.deleteQueue(name)
      .then((_value: unknown) => {
        setShowDeleteDialog(false)
        setRefreshCount(c => c + 1)
        eventService.notify({
          type: 'success',
          message: 'Queue Deleted',
          duration: 3000,
        })
      })
      .catch((error) => {
        setShowDeleteDialog(false)
        eventService.notify({ type: 'danger', message: 'Queue Not Deleted: ' + jolokiaService.errorMessage(error) })
      })
  }, [])

  const purgeQueue = useCallback((name: string, address: string, routingType: string) => {
    artemisService.purgeQueue(name, address, routingType)
      .then(() => {
        setShowPurgeDialog(false)
        setRefreshCount(c => c + 1)
        eventService.notify({
          type: 'success',
          message: 'Queue Purged',
          duration: 3000,
        })
      })
      .catch((error) => {
        setShowPurgeDialog(false)
        eventService.notify({ type: 'danger', message: 'Queue Not Purged: ' + jolokiaService.errorMessage(error) })
      })
  }, [])

  const canDeleteQueue = artemisService.canDeleteQueue(brokerNode)
  const permissions = useMemo(() => artemisService.getQueuePermissions(brokerNode), [brokerNode])

  const getRowActions = useCallback((row: TableRow): IAction[] => {
    const rowName = row.name
    const rowAddress = row.address
    const rowRoutingType = row.routingType
    let rowPerms = permissions[rowName]
    if (rowPerms == undefined) {
      // it may have a client id with /. in the name which is delimited in the mbean name
      rowPerms = permissions[row.name.replaceAll('\\', '\\\\')]
    }
    const actions: IAction[] = [
      {
        title: "Show in Artemis JMX",
        onClick: async () => {
          setAddress(rowName)
          const brokerObjectName = await artemisService.getBrokerObjectName()
          const queueObjectName = createQueueObjectName(brokerObjectName, rowAddress, rowRoutingType, rowName)
          findAndSelectNode(queueObjectName, rowName)
          routeNavigate(artemisJMXPluginPath)
        }
      },
      {
        title: "Attributes",
        onClick: async () => {
          setAddress(rowName)
          const brokerObjectName = await artemisService.getBrokerObjectName()
          const queueObjectName = createQueueObjectName(
              brokerObjectName,
              rowAddress,
              rowRoutingType,
              rowName
          )
          findAndSelectNode(queueObjectName, rowName)
          setShowAttributesDialog(true)
        }
      },
      {
        title: "Operations",
        onClick: async () => {
          setAddress(rowName)
          const brokerObjectName = await artemisService.getBrokerObjectName()
          const queueObjectName = createQueueObjectName(
              brokerObjectName,
              rowAddress,
              rowRoutingType,
              rowName
          )
          findAndSelectNode(queueObjectName, rowName)
          setShowOperationsDialog(true)
        }
      }
    ]

    if (rowPerms?.canSend || rowPerms?.canBrowse || rowPerms?.canPurge || canDeleteQueue) {
      actions.push({ isSeparator: true })
    }

    if (rowPerms?.canSend) {
      actions.push({
        title: "Send Message",
        onClick: () => {
          setQueue(rowName)
          setAddress(rowAddress)
          setRoutingType(rowRoutingType)
          setShowSendDialog(true)
        }
      })
    }
    if (rowPerms?.canBrowse) {
      actions.push({
        title: "Browse Messages",
        onClick: () => {
          messageView(row)
        }
      })
    }
    if (rowPerms?.canPurge) {
      actions.push({
        title: (<><RhUiCleanUpIcon /> Purge</>),
        onClick: () => {
          setQueue(rowName)
          setQueueToPurgeAddress(rowAddress)
          setQueueToPurgeRoutingType(rowRoutingType)
          setShowPurgeDialog(true)
        }
      })
    }
    if (canDeleteQueue) {
      actions.push({
        title: (<><Remove2Icon /> Delete</>),
        onClick: () => {
          setQueue(rowName)
          setShowDeleteDialog(true)
        }
      })
    }

    return actions
  }, [routeNavigate, permissions, canDeleteQueue])

  const reload = useCallback(() => {
    setRefreshCount(c => c + 1)
  }, [])

  return (
    <>
      <MemoizedArtemisTable allColumns={allColumns}
                            initialFilter={initialFilter}
                            initialSort={initialSort}
                            getData={listQueues}
                            storageColumnLocation={columnStorage.queues}
                            getRowActions={getRowActions}
                            refreshCount={refreshCount}
                            switchTab={props.switchTab}
                            filters={props.filters}
                            refresh={reload}
                            editGlobalFilter={props.editGlobalFilter} />

      <Modal aria-label='queue-delete-modal' variant={ModalVariant.medium} isOpen={showDeleteDialog}
             onClose={() => closeDeleteDialog()}
             onKeyDown={closeWithEscape(closeDeleteDialog)}>
        <ModalHeader title='Delete Queue?' titleIconVariant='warning' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to delete queue <b>{queue}</b>.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key="delete" variant="danger" onClick={() => deleteQueue(queue)}>
            Confirm
          </Button>
          <Button key="cancel" variant="link" onClick={closeDeleteDialog}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal id='attributes-modal' aria-label='attributes-modal' variant={ModalVariant.large} isOpen={showAttributesDialog}
             onClose={() => setShowAttributesDialog(false)}
             onKeyDown={closeWithEscape(setShowAttributesDialog)}>
        <ModalHeader>
          <Title headingLevel='h1' size='lg'>JMX Attributes</Title>
          <Title headingLevel='h2' size='md'>{selectedNode?.objectName}</Title>
        </ModalHeader>
        <ModalBody>
          <PageSection hasBodyWrapper={false} hasOverflowScroll>
            <Attributes />
          </PageSection>
        </ModalBody>
        <ModalFooter>
          <Button key='close' variant='primary' onClick={() => setShowAttributesDialog(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <Modal id='operations-modal' aria-label='operations-modal' variant={ModalVariant.large} isOpen={showOperationsDialog}
             onClose={() => setShowOperationsDialog(false)}
             onKeyDown={closeWithEscape(setShowOperationsDialog)}>
        <ModalHeader>
          <Title headingLevel='h1' size='lg'>JMX Operations</Title>
          <Title headingLevel='h2' size='md'>{selectedNode?.objectName}</Title>
        </ModalHeader>
        <ModalBody>
          <PageSection hasBodyWrapper={false} hasOverflowScroll>
            <Operations />
          </PageSection>
        </ModalBody>
        <ModalFooter>
          <Button key='close' variant='primary' onClick={() => setShowOperationsDialog(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <Modal aria-label='queue-purge-modal' variant={ModalVariant.medium} isOpen={showPurgeDialog}
             onClose={closePurgeDialog}
             onKeyDown={closeWithEscape(setShowPurgeDialog)}>
        <ModalHeader title='Purge Queue?' titleIconVariant='warning' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to remove all messages from queue: <b>{queue}</b>.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key="confirm" variant="danger" onClick={() => purgeQueue(queue, queueToPurgeAddress, queueToPurgeRoutingType)}>
            Confirm
          </Button>
          <Button key="cancel" variant="link" onClick={closePurgeDialog}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Explicitly without onClose and onKeyDown, so user doesn't close the dialog by accident with Escape */}
      <Modal aria-label='send-modal' variant={ModalVariant.medium} isOpen={showSendDialog}>
        <SendMessage address={address} queue={queue} routingType={routingType} isAddress={false}
                     onClose={closeSendDialog} onSend={() => setRefreshCount(c => c + 1)} />
      </Modal>
    </>
  )
}
