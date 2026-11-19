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
  Title,
} from '@patternfly/react-core'
import { type IAction } from '@patternfly/react-table'
import { PlusIcon } from '@patternfly/react-icons/dist/esm/icons/plus-icon'
import { Remove2Icon } from '@patternfly/react-icons/dist/esm/icons/remove2-icon'
import { useNavigate } from 'react-router'

import { Attributes, eventService, jolokiaService, Operations, workspace } from '@hawtio/react'

import { artemisService } from '../artemis-service'
import { columnStorage } from '../artemis-preferences-service'
import { artemisJMXPluginPath } from '../globals'
import { ArtemisContext } from '../context'
import { createAddressObjectName } from '../util/jmx'
import {
  type ActiveSort,
  ColumnType,
  type Filter,
  SortDirection,
  type TableColumn,
  type TableRow,
  type TableRowsData
} from '../table/types'
import { closeWithEscape, loadFilteredData } from '../table/utils'
import { ArtemisTable, type ArtemisTableFilterProps, ToolbarAction } from '../table/ArtemisTable'
import { CreateAddress } from './CreateAddress'
import { CreateQueue } from '../queues/CreateQueue'
import { SendMessage } from '../messages/SendMessage'

// a filter for navigation to address' queue(s)
const getQueueFilter: (row: TableRow) => Filter = row => {
  return {
    tab: 'queues',
    column: 'address',
    operation: 'EQUALS',
    input: row.name
  }
}

// see org.apache.activemq.artemis.core.management.impl.view.AddressView
const allColumns: TableColumn[] = [
  { id: 'id', type: ColumnType.NUMBER, name: 'ID', visible: false, sortable: true, filterable: true },
  { id: 'name', type: ColumnType.STRING, name: 'Name', visible: true, sortable: true, filterable: true },
  // actually it's JSON - array of strings
  { id: 'routingTypes', type: ColumnType.STRING, name: 'Routing Types', visible: true, sortable: true, filterable: true },
  // Integer.toString()
  { id: 'queueCount', type: ColumnType.NUMBER, name: 'Queue Count', visible: true, sortable: true, filterable: true, filter: getQueueFilter },
  // 4x Boolean.toString()
  { id: 'internal', type: ColumnType.BOOLEAN, name: 'Internal', visible: false, sortable: true, filterable: true },
  { id: 'temporary', type: ColumnType.BOOLEAN, name: 'Temporary', visible: false, sortable: true, filterable: true },
  { id: 'autoCreated', type: ColumnType.BOOLEAN, name: 'Auto Created', visible: false, sortable: true, filterable: true },
  { id: 'paused', type: ColumnType.BOOLEAN, name: 'Paused', visible: false, sortable: true, filterable: true },
  // Long.toString()
  { id: 'currentDuplicateIdCacheSize', type: ColumnType.NUMBER, name: 'Current Duplicate ID Cache Size', visible: false, sortable: true, filterable: true },
  // Boolean.toString()
  { id: 'retroactiveResource', type: ColumnType.BOOLEAN, name: 'Retroactive Resource', visible: false, sortable: true, filterable: true },
  // Long.toString()
  { id: 'unroutedMessageCount', type: ColumnType.NUMBER, name: 'Unrouted Message Count', visible: false, sortable: true, filterable: true },
  // Long.toString()
  { id: 'routedMessageCount', type: ColumnType.NUMBER, name: 'Routed Message Count', visible: false, sortable: true, filterable: true },
  // Long.toString()
  { id: 'messageCount', type: ColumnType.NUMBER, name: 'Message Count', visible: true, sortable: true, filterable: true },
  // Long.toString()
  { id: 'numberOfBytesPerPage', type: ColumnType.NUMBER, name: 'Number of Bytes per Page', visible: false, sortable: true, filterable: true },
  // Integer.toString()
  { id: 'addressLimitPercent', type: ColumnType.NUMBER, name: 'Address Limit Percent', visible: true, sortable: true, filterable: true },
  // Boolean or "n/a" symbol
  { id: 'paging', type: ColumnType.STRING, name: 'Paging', visible: true, sortable: true, filterable: true },
  // Long.toString()
  { id: 'numberOfPages', type: ColumnType.NUMBER, name: 'Number Of Pages', visible: false, sortable: true, filterable: true },
  // Long.toString()
  { id: 'addressSize', type: ColumnType.NUMBER, name: 'Address Size', visible: true, sortable: true, filterable: true },
  // 4x Integer.toString()
  { id: 'maxPageReadBytes', type: ColumnType.NUMBER, name: 'Max Page Read Bytes', visible: false, sortable: true, filterable: true },
  { id: 'maxPageReadMessages', type: ColumnType.NUMBER, name: 'Max Page Read Messages', visible: false, sortable: true, filterable: true },
  { id: 'prefetchPageBytes', type: ColumnType.NUMBER, name: 'Prefetch Page Bytes', visible: false, sortable: true, filterable: true },
  { id: 'prefetchPageMessages', type: ColumnType.NUMBER, name: 'Prefetch Page Messages', visible: false, sortable: true, filterable: true }
]

const initialFilter: Filter = { tab: 'addresses', column: allColumns[1].id, operation: 'CONTAINS', input: '' }
const initialSort: ActiveSort = { column: allColumns[1].id, order: SortDirection.ASCENDING }

const MemoizedArtemisTable = memo(ArtemisTable)

export const AddressesTable: React.FunctionComponent<ArtemisTableFilterProps> = props => {

  const { brokerNode, selectedNode, findAndSelectNode } = useContext(ArtemisContext)
  const routeNavigate = useNavigate()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showAttributesDialog, setShowAttributesDialog] = useState(false)
  const [showOperationsDialog, setShowOperationsDialog] = useState(false)
  const [showCreateAddressDialog, setShowCreateAddressDialog] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [address, setAddress] = useState('')
  const [refreshCount, setRefreshCount] = useState(0)

  const canCreateQueue = artemisService.canCreateQueue(brokerNode)
  const canDeleteAddress = artemisService.canDeleteAddress(brokerNode)
  const canCreateAddress = artemisService.canCreateAddress(brokerNode)

  const listAddresses = useCallback(async (page: number, perPage: number, sort: ActiveSort | undefined, filters: Filter[]): Promise<TableRowsData> => {
    return loadFilteredData('addresses', artemisService.getAddresses.bind(artemisService), page, perPage, sort, filters, initialFilter)
  }, [])

  // Action to be added next to address table filter
  const createActions: ToolbarAction[] = useMemo(() => {
    return canCreateAddress ? [{
      name: 'Create Address',
      action: () => {
        setShowCreateAddressDialog(true)
      }
    }] : []
  }, [canCreateAddress])

  const permissions = useMemo(() => artemisService.getAddressPermissions(brokerNode), [brokerNode])

  const getRowActions = useCallback((row: TableRow): IAction[] => {
    let rowPerms = permissions[row.name]
    if (rowPerms == undefined) {
      // the name may contain characters which are delimited in the mbean name
      rowPerms = permissions[row.name.replaceAll('\\', '\\\\')]
    }
    const actions: IAction[] = [
      {
        title: 'Show in Artemis JMX',
        onClick: async () => {
          setAddress(row.name)
          const brokerObjectName = await artemisService.getBrokerObjectName()
          const addressObjectName = createAddressObjectName(brokerObjectName, row.name)
          findAndSelectNode(addressObjectName, row.name)
          routeNavigate(artemisJMXPluginPath)
        }
      },
      {
        title: 'Attributes',
        onClick: async () => {
          setAddress(row.name)
          const brokerObjectName = await artemisService.getBrokerObjectName()
          const addressObjectName = createAddressObjectName(brokerObjectName, row.name)
          findAndSelectNode(addressObjectName, row.name)
          setShowAttributesDialog(true)
        }
      },
      {
        title: 'Operations',
        onClick: async () => {
          setAddress(row.name)
          const brokerObjectName = await artemisService.getBrokerObjectName()
          const addressObjectName = createAddressObjectName(brokerObjectName, row.name)
          findAndSelectNode(addressObjectName, row.name)
          setShowOperationsDialog(true)
        }
      }
    ]

    if (canDeleteAddress || canCreateQueue) {
      actions.push({ isSeparator: true })
    }
    if (canDeleteAddress) {
      actions.push({
        title: (<><Remove2Icon /> Delete Address</>),
        onClick: () => {
          setAddress(row.name)
          setShowDeleteDialog(true)
        }
      })
    }
    if (canCreateQueue) {
      actions.push({
        title: (<><PlusIcon /> Create Queue</>),
        onClick: () => {
          setAddress(row.name)
          setShowCreateDialog(true)
        }
      })
    }

    if (rowPerms?.canSend) {
      actions.push({ isSeparator: true })
      actions.push({
        title: 'Send Message',
        onClick: () => {
          setAddress(row.name)
          setShowSendDialog(true)
        }
      })
    }

    return actions
  }, [permissions, canCreateQueue, canDeleteAddress, routeNavigate])

  const reload = useCallback(() => {
    setRefreshCount(c => c + 1)
  }, [])

  const handleDeleteAddress = () => {
    artemisService.deleteAddress(address)
      .then(() => {
        setShowDeleteDialog(false)
        workspace.refreshTree()
        reload()
        eventService.notify({
          type: 'success',
          message: 'Address Successfully Deleted',
        })
      })
      .catch((error) => {
        setShowDeleteDialog(false)
        eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(error) })
      })
  }

  return (
    <>
      <MemoizedArtemisTable allColumns={allColumns}
                            initialFilter={initialFilter}
                            initialSort={initialSort}
                            getData={listAddresses}
                            storageColumnLocation={columnStorage.addresses}
                            getRowActions={getRowActions}
                            toolbarActions={createActions}
                            refreshCount={refreshCount}
                            switchTab={props.switchTab}
                            filters={props.filters}
                            refresh={reload}
                            editGlobalFilter={props.editGlobalFilter} />

      <Modal aria-label='create-queue-modal' variant={ModalVariant.medium} isOpen={showCreateDialog}
             onClose={() => setShowCreateDialog(false)}
             onKeyDown={closeWithEscape(setShowCreateDialog)}>
        <CreateQueue address={address} onClose={() => setShowCreateDialog(false)} />
      </Modal>

      {canDeleteAddress && <Modal aria-label='delete-address-modal' variant={ModalVariant.small} isOpen={showDeleteDialog}
                                  onClose={() => setShowDeleteDialog(false)}
                                  onKeyDown={closeWithEscape(setShowDeleteDialog)}>
        <ModalHeader title='Delete Address?' titleIconVariant='warning' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to delete address: <b>{address}</b>.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key='delete' variant='danger' onClick={handleDeleteAddress}>
            Confirm
          </Button>
          <Button key='cancel' variant='link' onClick={() => setShowDeleteDialog(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>}

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

      <Modal aria-label='create-address-modal' variant={ModalVariant.medium} isOpen={showCreateAddressDialog}
             onClose={() => setShowCreateAddressDialog(false)}
             onKeyDown={closeWithEscape(setShowCreateAddressDialog)}>
        <CreateAddress reload={reload} onClose={() => setShowCreateAddressDialog(false)} />
      </Modal>

      {/* Explicitly without onClose and onKeyDown, so user doesn't close the dialog by accident with Escape */}
      <Modal aria-label='send-modal' variant={ModalVariant.medium} isOpen={showSendDialog}>
        <SendMessage address={address} queue={''} routingType={''} isAddress={true}
                     onClose={() => setShowSendDialog(false)} onSend={reload} />
      </Modal>
    </>
  )
}
