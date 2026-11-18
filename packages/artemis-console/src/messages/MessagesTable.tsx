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
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Content,
  SearchInput,
  Button,
  PaginationVariant,
  Pagination,
  DataList,
  DataListCell,
  DataListCheck,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Modal,
  ModalFooter,
  Icon,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ContentVariants,
  Title,
  Flex,
  FlexItem,
  PageSection
} from '@patternfly/react-core'
import { Thead, Tr, Th, Tbody, Td, ActionsColumn, IAction, Table, InnerScrollContainer } from '@patternfly/react-table'
import { HelpIcon } from '@patternfly/react-icons/dist/esm/icons/help-icon'
import { ArrowLeftIcon } from '@patternfly/react-icons/dist/esm/icons/arrow-left-icon'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'

import { eventService, jolokiaService } from '@hawtio/react'

import { ArtemisContext } from '../context'
import { artemisPluginPath, log } from '../globals'
import { artemisService, Queue } from '../artemis-service'
import { artemisPreferencesService, columnStorage } from '../artemis-preferences-service'
import { ColumnType, type TableColumn, TableRow } from '../table/types'
import { closeWithEscape } from '../table/utils'
import { createQueueObjectName } from '../util/jmx'
import { QueueSelectInput } from './QueueSelect'
import { SendMessage } from './SendMessage'
import { Message } from './MessageView'

export type MessageTableProps = {
  queue?: Queue
  selectMessage?: (message: Message) => void
  showTitle?: boolean
  showBackToQueues?: boolean
  noNavigate?: boolean
}

type FilterInformationProps = {
  showHelpModal: boolean
  setShowHelpModal: (show: boolean) => void
}

const initialPerPage = () => {
  if (columnStorage.messages) {
    const savedPerPage = artemisPreferencesService.loadTablePageSize(
      columnStorage.messages
    );
    return savedPerPage ?? 10;
  }
  return 10;
}

const FilterInformation: React.FunctionComponent<FilterInformationProps> = props => (
  <Modal id='filter-information' aria-label='filter-information'
         variant={ModalVariant.medium}
         isOpen={props.showHelpModal}
         onClose={() => props.setShowHelpModal(false)}>
    <ModalHeader title='Using Filter Expressions' />
    <ModalBody>
      <PageSection hasBodyWrapper={false} hasOverflowScroll>
        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsLg' }} justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <FlexItem>
            <Title headingLevel='h2'>Apache Artemis provides a powerful filter language based on a subset of the SQL 92 expression syntax.</Title>
            <Content component={ContentVariants.p}>
              It is similar to the syntax used for JMS Message selectors.
            <Content component={ContentVariants.p}>
            </Content>
              For documentation on JMS selector syntax please the JavaDoc for javax.jms.Message or
              <Link target='_blank' to={'https://jakarta.ee/specifications/messaging/3.1/apidocs/jakarta.messaging/jakarta/jms/message'}>jakarta.jms.Message</Link>
            </Content>
            <Content component={ContentVariants.p}>
              A Filter will search for messages that have a matching property.
            </Content>
          </FlexItem>
          <FlexItem>
            <Title headingLevel='h3'>Filter Examples</Title>
            <Content component={ContentVariants.p}>
              <Content component={ContentVariants.dl}>
                <Content component={ContentVariants.dt}>property = 'value'</Content>
                <Content component={ContentVariants.dd}> This will return any message where the message property <b>property</b> has the string value <b>value</b></Content>
                <Content component={ContentVariants.dt}>property = 1</Content>
                <Content component={ContentVariants.dd}> This will return any message where the message property <b>property</b> has the int, short, long or double value <b>1</b></Content>
                <Content component={ContentVariants.dt}>property {'>'} 1</Content>
                <Content component={ContentVariants.dd}> This will return any message where the message property <b>property</b> has an int, short, long or double value greater than <b>1</b></Content>
                <Content component={ContentVariants.dt}>property {'<>'} 'value'</Content>
                <Content component={ContentVariants.dd}> This will return any message where the message property <b>property</b> exists and does not equal <b>value</b></Content>
                <Content component={ContentVariants.dt}>property IN ('value1', 'value2')</Content>
                <Content component={ContentVariants.dd}> This will return any message where the message property <b>property</b> equals either <b>value1</b> or <b>value2</b></Content>
                <Content component={ContentVariants.dt}>property1 = 'value1' AND property2 = 'value2'</Content>
                <Content component={ContentVariants.dd}> This will return any message where the message property <b>property1</b> has the value <b>value1</b> and the message property <b>property2</b> has the value <b>value2</b></Content>
                <Content component={ContentVariants.dt}>property LIKE 'value%'</Content>
                <Content component={ContentVariants.dd}> This will return any message where the message property <b>property</b> has the pattern matching value <b>value%</b> such as <b>value1</b>, <b>value2345</b> etc</Content>
                <Content component={ContentVariants.dt}>property LIKE 'value_'</Content>
                <Content component={ContentVariants.dd}> This will return any message where the message property <b>property</b> has the pattern matching value <b>value_</b> such as <b>value1</b> but not <b>value2345</b></Content>
                <Content component={ContentVariants.dt}>property IS null</Content>
                <Content component={ContentVariants.dd}> This will return any message where the message property <b>property</b> has a null value or does not exist</Content>
              </Content>
            </Content>
          </FlexItem>
          <FlexItem>
            <Content component={ContentVariants.p}>
              The following predefined identifiers can also be used to filter messages.
            </Content>
            <Content component={ContentVariants.p}>
              <Content component={ContentVariants.dl}>
                <Content component={ContentVariants.dt}>AMQUserID</Content>
                <Content component={ContentVariants.dd}>The ID set by the user when the message is sent. This is analogous to the <b>JMSMessageID</b> for JMS-based clients.</Content>
                <Content component={ContentVariants.dt}>AMQAddress</Content>
                <Content component={ContentVariants.dd}>The address to which the message was sent.</Content>
                <Content component={ContentVariants.dt}>AMQGroupID</Content>
                <Content component={ContentVariants.dd}>The group ID used when sending the message.</Content>
                <Content component={ContentVariants.dt}>AMQPriority</Content>
                <Content component={ContentVariants.dd}>To refer to the priority of a message. Message priorities are integers with valid values from 0 - 9. 0 is the lowest priority and 9 is the highest. e.g. <i>AMQPriority = 3 AND animal = 'aardvark'</i></Content>
                <Content component={ContentVariants.dt}>AMQExpiration</Content>
                <Content component={ContentVariants.dd}>To refer to the expiration time of a message. The value is a long integer.</Content>
                <Content component={ContentVariants.dt}>AMQDurable</Content>
                <Content component={ContentVariants.dd}>To refer to whether a message is durable or not. The value is a string with valid values: <b>DURABLE</b> or <b>NON_DURABLE</b>.</Content>
                <Content component={ContentVariants.dt}>AMQTimestamp</Content>
                <Content component={ContentVariants.dd}>The timestamp of when the message was created. The value is a long integer.</Content>
                <Content component={ContentVariants.dt}>AMQSize</Content>
                <Content component={ContentVariants.dd}>The size of a message in bytes. The value is an integer.</Content>
              </Content>
            </Content>
          </FlexItem>
        </Flex>
      </PageSection>
    </ModalBody>
    <ModalFooter>
      <Button key="cancel" variant="secondary" onClick={() => props.setShowHelpModal(false)}>
        Close
      </Button>
    </ModalFooter>
  </Modal>
)

export const MessagesTable: React.FunctionComponent<MessageTableProps> = props => {

  const navigate = useNavigate()
  const { search } = useLocation()

  // a function that shows message details for one selected message
  const messageView = useCallback((row: TableRow) => {
    // TableRow is generic Record<string, any>, we can cast it to Message here
    if (props.selectMessage) {
      props.selectMessage(row as Message)
      if (!props.noNavigate) {
        navigate({ pathname: `${artemisPluginPath}/queues/message/details`, search })
      }
    }
  }, [props.selectMessage])

  // These columns are not based on any ActiveMQAbstractView. They directly relate to
  // javax.management.openmbean.CompositeData[] returned from org.apache.activemq.artemis.api.core.management.QueueControl#browse()
  // The type may vary depending on the protocol used.
  //  + messageID: string
  //  + type: byte (mapped to string)
  //  + durable: boolean
  //  + priority: byte
  //  + timestamp: long
  //  + expiration: long
  //  ~ address: string (taken from the queue being browsed)
  //  + redelivered: boolean
  //  + largeMessage: boolean
  //  + persistentSize: long
  //  + userID: string
  //  + protocol: string
  //  - PropertiesText: string
  //  - StringProperties: [string]
  //  - BooleanProperties: [boolean]
  //  - ByteProperties: [byte]
  //  - ShortProperties: [short]
  //  - IntProperties: [int]
  //  - LongProperties: [long]
  //  - FloatProperties: [float]
  //  - DoubleProperties: [double]
  //  - text: string (for text messages)
  //  - BodyPreview: [byte] (for non-text messages)
  const allColumns: TableColumn[] = useMemo(() => [
    { id: 'messageID', type: ColumnType.STRING, name: 'Message ID', visible: true, sortable: true, filterable: true, link: messageView },
    { id: 'type', type: ColumnType.STRING, name: 'Type', visible: true, sortable: true, filterable: true },
    { id: 'durable', type: ColumnType.STRING, name: 'Durable', visible: true, sortable: true, filterable: true },
    { id: 'priority', type: ColumnType.NUMBER, name: 'Priority', visible: true, sortable: true, filterable: true },
    { id: 'timestamp', type: ColumnType.NUMBER, name: 'Timestamp', visible: true, sortable: true, filterable: true },
    { id: 'expiration', type: ColumnType.NUMBER, name: 'Expires', visible: true, sortable: true, filterable: true },
    { id: 'redelivered', type: ColumnType.BOOLEAN, name: 'Redelivered', visible: true, sortable: true, filterable: true },
    { id: 'largeMessage', type: ColumnType.BOOLEAN, name: 'Large', visible: true, sortable: true, filterable: true },
    { id: 'persistentSize', type: ColumnType.NUMBER, name: 'Persistent Size', visible: true, sortable: true, filterable: true },
    { id: 'userID', type: ColumnType.STRING, name: 'User ID', visible: false, sortable: true, filterable: false },
    { id: 'protocol', type: ColumnType.STRING, name: 'Protocol', visible: false, sortable: false, filterable: false },
    // these 2 are not available on Artemis 2.57.0
    // { id: 'validatedUser', type: ColumnType.STRING, name: 'Validated User', visible: false, sortable: true, filterable: false },
    // { id: 'originalQueue', type: ColumnType.STRING, name: 'Original Queue', visible: false, sortable: true, filterable: false },
  ], [messageView])

  const [filter, setFilter] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [perPage, setPerPage] = useState(initialPerPage);
  const [columns, setColumns] = useState(allColumns)
  const [columnsLoaded, setColumnsLoaded] = useState(false)
  const [columnsModalOpen, setColumnsModalOpen] = useState(false)
  const [resultsSize, setResultsSize] = useState(0)
  const [selectedMessages, setSelectedMessages] = useState<number[]>([])
  const [selectedTargetQueue, setSelectedTargetQueue] = useState<string>('')
  const [showDeleteMessagesModal, setShowDeleteMessagesModal] = useState(false)
  const [showMoveMessagesModal, setShowMoveMessagesModal] = useState(false)
  const [showCopyMessagesModal, setShowCopyMessagesModal] = useState(false)
  const [showRetryMessagesModal, setShowRetryMessagesModal] = useState(false)
  const [showResendModal, setShowResendModal] = useState(false)
  const [resendMessage, setResendMessage] = useState<Message | undefined>()
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)

  const { brokerNode } = useContext(ArtemisContext)

  useEffect(() => {
    let apply = true
    const listData = async () => {
      listMessages().then((data) => {
        if (apply && data) {
          setRows(data.data)
          setResultsSize(data.count)
        }
      }).catch((error) => {
        eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(error) })
      })
    }
    const listMessages = async (): Promise<any> => {
      if (props.queue) {
        const brokerObjectName = await artemisService.getBrokerObjectName()
        const queueMBean: string = createQueueObjectName(brokerObjectName, props.queue.address, props.queue.routingType, props.queue.name)
        return await artemisService.getMessages(queueMBean, page, perPage, filter)
      }
    }
    setPerPage(artemisPreferencesService.loadTablePageSize(columnStorage.messages))
    if (!columnsLoaded) {
      const updatedColumns: TableColumn[] = artemisPreferencesService.loadColumnPreferences(columnStorage.messages, allColumns)
      setColumns(updatedColumns)
      setColumnsLoaded(true)
    }
    listData()

    return () => {
      apply = false
    }
  }, [props.queue, page, perPage, filter, selectedMessages, refreshCount])

  if (!props.queue) {
    // React-component-style redirect to one level up - no need to handle the case where this message
    // list is embedded under ArtemisJMXTabs because the queue is always passed
    return <Navigate to={{ pathname: `${artemisPluginPath}/queues`, search }} replace />
  }

  const queue = props.queue!

  const handleSetPage = (_event: React.MouseEvent | React.KeyboardEvent | MouseEvent, newPage: number) => {
    setPage(newPage)
  }

  const handlePerPageSelect = (_event: React.MouseEvent | React.KeyboardEvent | MouseEvent, newPerPage: number, _newPage: number) => {
    artemisPreferencesService.saveTablePageSize(columnStorage.messages, newPerPage)
    setPerPage(newPerPage)
    setPage(1)
    selectAllMessages(false)
  }

  const handleColumnsModalToggle = () => {
    setColumnsModalOpen(!columnsModalOpen)
  }

  const onSearchTextChange = (newValue: string) => {
    setInputValue(newValue)
  }

  const applyFilter = () => {
    setPage(1)
    setFilter(inputValue)
  }

  const getRowActions = (row: TableRow): IAction[] => {
    return [
      {
        title: 'Delete',
        id: 'message-dropdown-delete',
        onClick: () => {
          setSelectedMessages([Number(artemisService.getKeyByValue(row, "messageID"))])
          setShowDeleteMessagesModal(true)
        }
      },
      {
        title: 'View',
        id: 'message-dropdown-view',
        onClick: () => {
          messageView(row)
        }
      },
      {
        title: 'Resend',
        id: 'message-dropdown-resend',
        onClick: () => {
          setResendMessage(row as Message)
          setShowResendModal(true)
        }
      }
    ]
  }

  const selectAllColumns = () => {
    const updatedColumns = [...columns]
    updatedColumns.map((column) => {
      column.visible = true
      return true
    })
    setColumns(updatedColumns)
  }

  const unselectAllColumns = () => {
    const updatedColumns = [...columns]
    updatedColumns.map((column) => {
      column.visible = false
      return false
    })
    setColumns(updatedColumns)
  }

  const onSave = () => {
    setColumnsModalOpen(!columnsModalOpen)
    artemisPreferencesService.saveColumnPreferences(columnStorage.messages, columns)
  }

  const updateColumnStatus = (index: number, _column: TableColumn) => {
    const updatedColumns = [...columns]
    updatedColumns[index].visible = !columns[index].visible
    setColumns(updatedColumns)
  }

  const onSelectMessage = (id: number, _index: number, selected: boolean) => {
    let updatedSelectedMessages: number[] = []
    if (selected) {
      selectedMessages.forEach((id) => updatedSelectedMessages.push(id))
      updatedSelectedMessages.push(id)
      setSelectedMessages(updatedSelectedMessages)
    } else {
      updatedSelectedMessages = selectedMessages.splice(selectedMessages.indexOf(id), 1)
      selectedMessages.forEach((id) => updatedSelectedMessages.push(id))
      updatedSelectedMessages.splice(updatedSelectedMessages.indexOf(id), 1)
      setSelectedMessages(updatedSelectedMessages)
    }
  }

  const isMessageSelected = useCallback((id: number) => {
    return selectedMessages.includes(id)
  }, [selectedMessages])

  const doesCopyMessageMethodExist = artemisService.doesMethodExist(brokerNode, props.queue.name, "copyMessage")

  let isDLQ
  let isExpiry
  try {
    isDLQ = props.queue.name.match(artemisPreferencesService.loadArtemisPreferences().artemisDLQ)
  } catch (ignored) {
  }
  try {
    isExpiry = props.queue.name.match(artemisPreferencesService.loadArtemisPreferences().artemisExpiryQueue)
  } catch (ignored) {
  }
  const isRetryQueue = isDLQ || isExpiry

  if (!doesCopyMessageMethodExist) {
    log.warn("Copy button method not available in this version of Artemis")
  }

  const selectAllMessages = (isSelecting: boolean) => {
    if (isSelecting) {
      const updatedSelectedMessages: number[] = rows.map((row: TableRow, _index) => {
        return Number(row.messageID)
      })
      setSelectedMessages(updatedSelectedMessages)
    } else {
      setSelectedMessages([])
    }
  }

  const areAllMessagesSelected = rows.length !== 0 && selectedMessages.length === rows.length

  const handleDeleteMessages = () => {
    const isRejected = <T,>(p: PromiseSettledResult<T>): p is PromiseRejectedResult => p.status === 'rejected'
    const results: Promise<unknown>[] = []
    for (let i = 0; i < selectedMessages.length; i++) {
      const promise: Promise<unknown> = artemisService.deleteMessage(selectedMessages[i], queue.address, queue.routingType, queue.name)
      results.push(promise)
    }
    Promise.allSettled(results)
      .then((results) => {
        const rejectedReasons = results.filter(isRejected).map(p => p.reason)

        if (rejectedReasons.length > 0) {
          eventService.notify({
            type: 'warning',
            message: "Not all messages deleted: errors " + rejectedReasons.toString(),
          })
        } else {
          eventService.notify({
            type: 'success',
            message: "Messages deleted successfully [" + selectedMessages + "]",
          })
        }
      })

    setShowDeleteMessagesModal(false)
    setSelectedMessages([])
  }

  const handleMoveMessages = () => {
    const isRejected = <T,>(p: PromiseSettledResult<T>): p is PromiseRejectedResult => p.status === 'rejected'
    const results: Promise<unknown>[] = []
    for (let i = 0; i < selectedMessages.length; i++) {
      const promise: Promise<unknown> = artemisService.moveMessage(selectedMessages[i], selectedTargetQueue, queue.address, queue.routingType, queue.name)
      results.push(promise)
    }
    Promise.allSettled(results)
      .then((results) => {
        const rejectedReasons = results.filter(isRejected).map(p => p.reason)

        if (rejectedReasons.length > 0) {
          eventService.notify({
            type: 'warning',
            message: "Not all messages moved: errors " + rejectedReasons.toString(),
          })
        } else {
          eventService.notify({
            type: 'success',
            message: "Messages moved successfully [" + selectedMessages + "]",
          })
        }
      })

    setShowMoveMessagesModal(false)
    setSelectedMessages([])
  }

  const handleCopyMessages = () => {
    const isRejected = <T,>(p: PromiseSettledResult<T>): p is PromiseRejectedResult => p.status === 'rejected'
    const results: Promise<unknown>[] = []
    for (let i = 0; i < selectedMessages.length; i++) {
      const promise: Promise<unknown> = artemisService.copyMessage(selectedMessages[i], selectedTargetQueue, queue.address, queue.routingType, queue.name)
      results.push(promise)
    }
    Promise.allSettled(results)
      .then((results) => {
        const rejectedReasons = results.filter(isRejected).map(p => p.reason)

        if (rejectedReasons.length > 0) {
          eventService.notify({
            type: 'warning',
            message: "not all messages copied: errors " + rejectedReasons.toString(),
          })
        } else {
          eventService.notify({
            type: 'success',
            message: "Messages Successfully Copied [" + selectedMessages + "]",
          })
        }
      })

    setShowCopyMessagesModal(false)
    setSelectedMessages([])
  }

  const handleRetryMessages = () => {
    const isRejected = <T,>(p: PromiseSettledResult<T>): p is PromiseRejectedResult => p.status === 'rejected'
    const results: Promise<unknown>[] = []
    for (let i = 0; i < selectedMessages.length; i++) {
      const promise: Promise<unknown> = artemisService.retryMessage(selectedMessages[i], queue.address, queue.routingType, queue.name)
      results.push(promise)
    }
    Promise.allSettled(results)
      .then((results) => {
        const rejectedReasons = results.filter(isRejected).map(p => p.reason)

        if (rejectedReasons.length > 0) {
          eventService.notify({
            type: 'warning',
            message: "not all messages retried: errors " + rejectedReasons.toString(),
          })
        } else {
          eventService.notify({
            type: 'success',
            message: "Messages Successfully Retried [" + selectedMessages + "]",
          })
        }
      })

    setShowRetryMessagesModal(false)
    setSelectedMessages([])
  }

  return (
    <>
      {props.showTitle && <Flex direction={{ default: 'row' }} justifyContent={{ default: 'justifyContentSpaceBetween' }}>
        <FlexItem>
          <Title headingLevel='h2'>Browsing {props.queue.name + ' '} <Icon status="info"><HelpIcon onClick={() => setShowHelpModal(true)}/></Icon></Title>
        </FlexItem>
        {props.showBackToQueues && <FlexItem>
          <Button variant='link' onClick={() => {
            navigate({ pathname: `${artemisPluginPath}/queues`, search })
          }}>
            <Icon><ArrowLeftIcon /></Icon> Back to Queue list
          </Button>
        </FlexItem>}
      </Flex>}
      <Toolbar id='artemis-tabs-toolbar'>
        <ToolbarContent>
          <ToolbarItem>
            <SearchInput
              aria-label="With filters example search input"
              onChange={(_event, value) => onSearchTextChange(value)}
              value={inputValue}
              onClear={() => {
                onSearchTextChange('')
                applyFilter()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyFilter()
                }
              }}
            />
          </ToolbarItem>
          <ToolbarItem>
            <Button onClick={applyFilter} size='sm'>Filter</Button>
          </ToolbarItem>
          <ToolbarItem>
            <Button isDisabled={selectedMessages.length === 0} size='sm' onClick={() => setShowDeleteMessagesModal(true)}>Delete</Button>
          </ToolbarItem>
          <ToolbarItem>
            <Button isDisabled={selectedMessages.length === 0} size='sm' onClick={() => setShowMoveMessagesModal(true)}>Move</Button>
          </ToolbarItem>
          <ToolbarItem>
            <Button onClick={() => setShowCopyMessagesModal(true)} size='sm' isDisabled={!doesCopyMessageMethodExist || selectedMessages.length === 0}>Copy</Button>
          </ToolbarItem>
          {isRetryQueue &&
            <ToolbarItem>
              <Button isDisabled={selectedMessages.length === 0} size='sm' onClick={() => setShowRetryMessagesModal(true)}>Retry</Button>
            </ToolbarItem>
          }
          <ToolbarItem variant="separator" />
          <ToolbarItem>
            <Button variant='link' onClick={handleColumnsModalToggle}>Manage Columns</Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      <InnerScrollContainer>
        <Table id='message-table' isStickyHeader variant='compact' aria-label='Message Table'>
          <Thead>
            <Tr>
              <Th
                select={{
                  onSelect: (_event, isSelecting) => selectAllMessages(isSelecting),
                  isSelected: areAllMessagesSelected
                }}
              />
              {columns.map((column, id) => {
                if (column.visible) {
                  return <Th key={id}>{column.name}</Th>
                } else {
                  return null
                }
              })}
              <Th aria-label='actions' />
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row, rowIndex) => (
              <Tr key={rowIndex}>
                <Td
                  select={{
                    rowIndex,
                    onSelect: (_event, isSelecting) => onSelectMessage(Number(artemisService.getKeyByValue(row, "messageID")), rowIndex, isSelecting),
                    isSelected: isMessageSelected(Number(artemisService.getKeyByValue(row, "messageID")))
                  }}
                />
                {columns.map((column, id) => {
                  if (column.visible) {
                    const text = artemisService.getKeyByValue(row, column.id)
                    if (column.link) {
                      return <Td key={id}><Button variant='link' isInline
                                                  onClick={() => { if (column.link) { column.link(row) } }}>{text}</Button></Td>
                    } else {
                      return <Td key={id}>{text}</Td>
                    }
                  } else {
                    return null
                  }
                }
                )}
                <Td isActionCell>
                  <ActionsColumn items={getRowActions(row)} popperProps={{ position: 'end' }} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </InnerScrollContainer>

      <Pagination
        itemCount={resultsSize}
        page={page}
        perPage={perPage}
        onSetPage={handleSetPage}
        onPerPageSelect={handlePerPageSelect}
        variant={PaginationVariant.bottom}
        titles={{
          paginationAriaLabel: `${PaginationVariant.bottom} pagination`
        }}
      />

      <Modal aria-label='delete-message-modal' variant={ModalVariant.medium} isOpen={showDeleteMessagesModal}
             onClose={() => setShowDeleteMessagesModal(false)}
             onKeyDown={closeWithEscape(setShowDeleteMessagesModal)}>
        <ModalHeader title='Confirm Delete Message(s)' titleIconVariant='warning' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to delete message(s): {selectedMessages.toString()}.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key="delete" variant="danger" onClick={handleDeleteMessages}>
            Confirm
          </Button>
          <Button key="cancel" variant="link" onClick={() => setShowDeleteMessagesModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal aria-label='move-message-modal' variant={ModalVariant.medium} isOpen={showMoveMessagesModal}
             onClose={() => setShowMoveMessagesModal(false)}
             onKeyDown={closeWithEscape(setShowMoveMessagesModal)}>
        <ModalHeader title='Confirm Move Message(s)' titleIconVariant='warning' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to move message(s): {selectedMessages.toString()}.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
          <QueueSelectInput selectQueue={setSelectedTargetQueue}/>
        </ModalBody>
        <ModalFooter>
          <Button key="move" variant="primary" onClick={handleMoveMessages}>
            Confirm
          </Button>
          <Button key="cancel" variant="link" onClick={() => setShowMoveMessagesModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal aria-label='copy-message-modal' variant={ModalVariant.medium} isOpen={showCopyMessagesModal}
             onClose={() => setShowCopyMessagesModal(false)}
             onKeyDown={closeWithEscape(setShowCopyMessagesModal)}>
        <ModalHeader title='Confirm Copy Message(s)' titleIconVariant='info' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to copy message(s): {selectedMessages.toString()}.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
          <QueueSelectInput selectQueue={setSelectedTargetQueue}/>
        </ModalBody>
        <ModalFooter>
          <Button key="copy" variant="primary" onClick={handleCopyMessages}>
            Confirm
          </Button>
          <Button key="cancel" variant="link" onClick={() => setShowCopyMessagesModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal aria-label='retry-messagse-modal' variant={ModalVariant.medium} isOpen={showRetryMessagesModal}
             onClose={() => setShowRetryMessagesModal(false)}
             onKeyDown={closeWithEscape(setShowRetryMessagesModal)}>
        <ModalHeader title='Confirm Retry Message(s)' titleIconVariant='info' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to retry message(s): {selectedMessages.toString()}.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key="confirm" variant="primary" onClick={handleRetryMessages}>
            Confirm
          </Button>
          <Button key="cancel" variant="link" onClick={() => setShowRetryMessagesModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal aria-label='resend-modal' variant={ModalVariant.medium} isOpen={showResendModal}>
        <SendMessage address={queue.address} queue={queue.name} routingType={queue.routingType} isAddress={false} message={resendMessage}
                     title='Resend Message'
                     onClose={() => setShowResendModal(false)}
                     onSend={() => setRefreshCount(c => c + 1)} />
      </Modal>

      <Modal isOpen={columnsModalOpen} variant="small" onClose={handleColumnsModalToggle}>
        <ModalHeader>
          <Title headingLevel='h2' size='lg'>Manage Columns</Title>
          <Content>Selected categories are displayed in the table.</Content>
          <Content>
            <Button isInline onClick={selectAllColumns} variant='link'>
              Select all
            </Button>{ ' | ' }
            <Button isInline onClick={unselectAllColumns} variant='link'>
              Unselect all
            </Button>
          </Content>
        </ModalHeader>
        <ModalBody>
          <DataList aria-label="Table column management" id="table-column-management" isCompact>
            {columns.map((column, id) => (
              <DataListItem key={`table-column-management-${column.id}`} aria-labelledby={`table-column-management-${column.id}`}>
                <DataListItemRow>
                  <DataListCheck
                    aria-labelledby={`table-column-management-item-${column.id}`}
                    isChecked={column.visible}
                    name={`check-${column.id}`}
                    id={`check-${column.id}`}
                    onChange={_checked => updateColumnStatus(id, column)}
                  />
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell id={`table-column-management-item-${column.id}`} key={`table-column-management-item-${column.id}`}>
                        <label htmlFor={`check-${column.id}`}>{column.name}</label>
                      </DataListCell>
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
            ))}
          </DataList>
        </ModalBody>
        <ModalFooter>
          <Button key="save" variant="primary" onClick={onSave}>
            Save
          </Button>
          <Button key="close" variant="link" onClick={handleColumnsModalToggle}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <FilterInformation showHelpModal={showHelpModal} setShowHelpModal={setShowHelpModal} />
    </>
  )
}
