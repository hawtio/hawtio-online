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
import React, { useRef, useState } from 'react'
import {
  Button,
  Content,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  TextInput,
  Title,
  Checkbox,
  Tooltip,
  Popover,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  PanelFooter,
  TextArea,
} from '@patternfly/react-core'
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/outlined-question-circle-icon'
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon'
import { TrashIcon } from '@patternfly/react-icons/dist/esm/icons/trash-icon'

import { Language } from '@patternfly/react-code-editor'

import xmlFormat from 'xml-formatter'

import { eventService, jolokiaService } from '@hawtio/react'

import { artemisService } from '../artemis-service'
import { Message } from './MessageView'

type SendMessageProps = {
  queue: string
  routingType: string
  address: string
  isAddress: boolean
  message?: Message
  // a function that should be used for close handlers of the dialog
  onClose?: () => void
  // a function that can be called when the message is sent (so the parent component can refresh the table for example)
  onSend?: () => void
  // Title may be passed to be used in ModalHeader
  title?: string
  // whether this component is shown in a Modal component (defaults to true)
  shownInModal?: boolean
}

type NameValue = { name: string, value: string }
type NameValueArray = NameValue[]

type MessageBodyProps = {
  onBodyChange: (body: string) => void
  body?: string
}

const MessageBody: React.FunctionComponent<MessageBodyProps> = props => {

  const [messageBody, setMessageBody] = useState<string>(props.body ? props.body : '')
  const [selectedFormat, setSelectedFormat] = useState<Language>(Language.xml)
  const [isDropdownOpen, setDropdownOpen] = useState(false)

  const handleAutoFormat = () => {
    try {
      if (selectedFormat === Language.xml) {
        updateMessageBody(xmlFormat(messageBody))
      } else if (selectedFormat === Language.json) {
        updateMessageBody(JSON.stringify(JSON.parse(messageBody), null, 2))
      }
    } catch {
      // ignore formatting errors
    }
  }

  const updateMessageBody = (body: string) => {
    setMessageBody(body)
    props.onBodyChange(body)
  }
  const handleToggle = () => {
    setDropdownOpen(!isDropdownOpen)
  }
  const handleFormatChange = (_event?: (React.MouseEvent<Element, MouseEvent> | undefined), value?: (string | number | undefined)) => {
    setSelectedFormat(value as Language)
    setDropdownOpen(false)
  }

  return (
    <>
      <FormGroup label='Message'>
        <TextArea
          id='message-body'
          aria-label='Message body'
          value={messageBody}
          onChange={(_event, value) => updateMessageBody(value)}
          rows={8}
          resizeOrientation='vertical'
        />
      </FormGroup>
      <FormGroup>
        <Flex>
          <FlexItem flex={{ default: 'flexNone', md: 'flex_2' }}>
            {' '}
            <Select
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle isFullWidth role='menu' ref={toggleRef} onClick={handleToggle}>
                    {selectedFormat}
                  </MenuToggle>
              )}
              aria-label='Select Format'
              onSelect={handleFormatChange}
              selected={selectedFormat}
              isOpen={isDropdownOpen}
            >
              <SelectList>
                <SelectOption label='plaintext' value={Language.plaintext}>{Language.plaintext}</SelectOption>
                <SelectOption label='xml' value={Language.xml}>{Language.xml}</SelectOption>
                <SelectOption label='json' value={Language.json}>{Language.json}</SelectOption>
              </SelectList>
            </Select>
          </FlexItem>{' '}
          <FlexItem flex={{ default: 'flexNone', md: 'flex_1' }}>
            <Button onClick={handleAutoFormat}>Format</Button>
          </FlexItem>
        </Flex>
      </FormGroup>
    </>
  )
}

type MessageHeadersProps = {
  onHeadersChange: (headers: NameValueArray) => void
  headers?: Record<string, string>
}

const MessageHeaders: React.FunctionComponent<MessageHeadersProps> = props => {
  const initialHeaders: NameValueArray = []
  if (props.headers) {
    Object.keys(props.headers).forEach((key, _index) => {
      initialHeaders.push({
        name: key,
        value: props.headers ? props.headers[key] : ''
      })
    })
  }

  const [headers, setHeaders] = useState<NameValueArray>(initialHeaders)

  const handleInputChange = (index: number, newValue: string, event: React.FormEvent<HTMLInputElement>) => {
    const updatedHeaders = [...headers]
    updatedHeaders[index] = { ...updatedHeaders[index], [event.currentTarget.name]: newValue }
    setHeaders(updatedHeaders)
    props.onHeadersChange(updatedHeaders)
  }

  const handleAddHeader = () => {
    const updatedHeaders = [...headers, { name: '', value: '' }]
    setHeaders(updatedHeaders)
    props.onHeadersChange(updatedHeaders)
  }

  const handleRemoveHeader = (index: number) => {
    const updatedHeaders = [...headers]
    updatedHeaders.splice(index, 1)
    setHeaders(updatedHeaders)
    props.onHeadersChange(updatedHeaders)
  }

  return (
    <>
      <FormGroup>
        <Button variant='link' onClick={handleAddHeader}>
          Add Headers
        </Button>
      </FormGroup>
      <FormGroup>
        {headers.length > 0 && (
          <Flex>
            <FlexItem flex={{ default: 'flexNone', md: 'flex_2' }}>Name</FlexItem>
            <FlexItem flex={{ default: 'flexNone', md: 'flex_2' }}>Value</FlexItem>
            <FlexItem flex={{ default: 'flexNone', md: 'flex_1' }}></FlexItem>
          </Flex>
        )}

        {headers.length > 0 &&
          headers.map((header, index) => (
            <Flex key={index}>
              <FlexItem flex={{ default: 'flexNone', md: 'flex_2' }}>
                <TextInput
                  type='text'
                  aria-label={'name-input-' + index}
                  name='name'
                  value={header.name}
                  onChange={(event, newValue) => handleInputChange(index, newValue, event)}
                />
              </FlexItem>
              <FlexItem flex={{ default: 'flexNone', md: 'flex_2' }}>
                <TextInput
                  type='text'
                  name='value'
                  aria-label={'value-input-' + index}
                  value={header.value}
                  onChange={(event, newValue) => handleInputChange(index, newValue, event)}
                />
              </FlexItem>
              <FlexItem flex={{ default: 'flexNone', md: 'flex_1' }} span={4}>
                <Button variant='link' onClick={() => handleRemoveHeader(index)} aria-label='Remove Header'>
                  <TrashIcon />
                </Button>
              </FlexItem>
            </Flex>
          ))}
      </FormGroup>
    </>
  )
}

export const SendMessage: React.FunctionComponent<SendMessageProps> = props => {
  
  const [isDurableChecked, setIsDurableChecked] = useState(props.message? props.message.durable:true)
  const [isCreateIDChecked, setIsCreateIDChecked] = useState(false)
  const [isUseLogonChecked, setIsUseLogonChecked] = useState(true)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('password')
  
  const messageHeaders = useRef<NameValueArray>([])
  const messageBody = useRef<string>('')

  const updateHeaders = (headers: NameValueArray) => {
    messageHeaders.current = [...headers]
  }
  const updateTheMessageBody = (body: string) => {
    messageBody.current = body
  }

  const handleUsernameChange = (_event: React.FormEvent<HTMLInputElement>, name: string) => {
    setUsername(name)
  }

  const handlePasswordChange = (_event: React.FormEvent<HTMLInputElement>, password: string) => {
    setPassword(password)
  }

  const handleSubmit = () => {
    if (props.isAddress) {
      artemisService.doSendMessageToAddress(messageBody.current, messageHeaders.current, isDurableChecked, isCreateIDChecked, isUseLogonChecked, username, password, props.address)
        .then(() => {
          props?.onSend?.()
          eventService.notify({
            type: 'success',
            message: 'Message Successfully Sent',
          })
        })
        .catch((error) => {
          eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(error) })
        })
    } else {
      artemisService.doSendMessageToQueue(messageBody.current, messageHeaders.current, isDurableChecked, isCreateIDChecked, isUseLogonChecked, username, password, props.routingType.toLowerCase(), props.queue, props.address)
        .then(() => {
          props?.onSend?.()
          eventService.notify({
            type: 'success',
            message: 'Message Successfully Sent',
          })
        })
        .catch((error) => {
          eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(error) })
        })
    }
  }

  const Hint = () => (
    <Content>
      <Content component='p'>
        Use this page to send a message of type <code>TextMessage</code> to an address or queue. 
      </Content>
    </Content>
  )

  let title = null
  if (!props.title) {
    title = (<Title headingLevel='h1' size='lg'>
      Send Message to {props.isAddress ? 'Address' : 'Queue'} {props.address}{' '}
      <Popover bodyContent={Hint}><OutlinedQuestionCircleIcon /></Popover>
    </Title>)
  } else {
    title = (<Title headingLevel='h1' size='lg'>{props.title}</Title>)
  }

  const form = (
      <Form>
        <Flex
            direction={{ default: 'column', md: 'row' }}
            gap={{ default: 'gapMd' }}
            alignItems={{ default: 'alignItemsFlexEnd' }}>
          <FlexItem>
            <FormGroup label='Durable'
                       labelHelp={<Tooltip content='Mark the message as persistent and write it to the broker journal if the destination queue is durable.'><InfoCircleIcon /></Tooltip>}>
              <Checkbox
                  isChecked={isDurableChecked}
                  onChange={() => setIsDurableChecked(!isDurableChecked)}
                  id='durable' />
            </FormGroup>
          </FlexItem>
          <FlexItem>
            <FormGroup label='Create Message ID'
                       labelHelp={<Tooltip content='Select to request that the broker generates a universally unique identifier (UUID) on the message before it is routed. For a JMS client, the UUID is the JMS Message ID of the message. Normally, not required if you are using a non-JMS client.'><InfoCircleIcon /></Tooltip>}>
              <Checkbox
                  isChecked={isCreateIDChecked}
                  onChange={() => setIsCreateIDChecked(!isCreateIDChecked)}
                  id='createid' />
            </FormGroup>
          </FlexItem>
          <FlexItem>
            <FormGroup label='Use Current Logged in User'
                       labelHelp={<Tooltip content='Use the credentials of the user that is currently logged in to the console to send a message. If you want to use a different user, clear the checkbox and specify a username and password.'><InfoCircleIcon /></Tooltip>}>
              <Checkbox
                  isChecked={isUseLogonChecked}
                  onChange={() => setIsUseLogonChecked(!isUseLogonChecked)}
                  id='uselogon' />
            </FormGroup>
          </FlexItem>
        </Flex>
        {!isUseLogonChecked && <>
          <FormGroup label='Username'>
            <TextInput
                value={username}
                type='text'
                onChange={handleUsernameChange}
                id='username'
                name='username' />
          </FormGroup>
          <FormGroup label='Password'>
            <TextInput
                value={password}
                type='password'
                onChange={handlePasswordChange}
                id='password'
                name='password' />
          </FormGroup>
        </>}
        <MessageHeaders onHeadersChange={updateHeaders} headers={props.message?.StringProperties} />
        <MessageBody onBodyChange={updateTheMessageBody} body={props.message?.text} />
      </Form>
  )

  const useModalWrapper = props.shownInModal === undefined || props.shownInModal

  if (useModalWrapper) {
    return (
        <>
          <ModalHeader>{title}</ModalHeader>
          <ModalBody>{form}</ModalBody>
          <ModalFooter>
            <Button variant='primary' onClick={() => handleSubmit()}>Send</Button>
            <Button key='close' variant='link' onClick={() => props.onClose?.()}>Close</Button>
          </ModalFooter>
        </>
    )
  } else {
    return (
        <>
          <Panel>
            <PanelHeader>{title}</PanelHeader>
            <PanelMain>
              <PanelMainBody>{form}</PanelMainBody>
            </PanelMain>
            <PanelFooter>
              <Button variant='primary' onClick={() => handleSubmit()}>Send</Button>
            </PanelFooter>
          </Panel>
        </>
    )
  }
}
