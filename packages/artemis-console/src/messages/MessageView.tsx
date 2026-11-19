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
import React, { useEffect, useState } from 'react'
import {
  Title,
  Divider,
  CodeBlock,
  CodeBlockCode,
  CodeBlockAction,
  ClipboardCopyButton,
  PanelMainBody,
  PanelMain,
  Panel,
  Grid,
  GridItem,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Alert,
  Flex,
  FlexItem,
  Icon,
  Button,
  ModalHeader,
  ModalBody
} from '@patternfly/react-core'
import { Thead, Tr, Th, Tbody, Td, Table, InnerScrollContainer } from '@patternfly/react-table'
import { ArrowLeftIcon } from '@patternfly/react-icons/dist/esm/icons/arrow-left-icon'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { artemisPluginPath, log } from '../globals'
import { artemisService, Queue } from '../artemis-service'

export type MessageProps = {
  message?: Message,
  queue?: Queue
  shownInModal?: boolean
  onClose?: () => void
}

export type Message = {
  messageID: string
  text?: string
  BodyPreview?: number[]
  address: string
  durable: boolean
  expiration: number
  largeMessage: boolean
  persistentSize: number
  priority: number
  protocol: string
  redelivered: boolean
  timestamp: number
  type: number
  userID: string
  StringProperties?: Record<string, any>
  BooleanProperties?: Record<string, any>
  ByteProperties?: Record<string, any>
  DoubleProperties?: Record<string, any>
  FloatProperties?: Record<string, any>
  LongProperties?: Record<string, any>
  IntProperties?: Record<string, any>
  ShortProperties?: Record<string, any>
}

export const MessageView: React.FunctionComponent<MessageProps> = props => {

  const [messageBody, setMessageBody] = useState('')
  const [messageTextMode, setMessageTextMode] = useState('')

  const { search } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (props.message) {
      updateBodyText(props.message)
    }
  }, [props.message])

  if (!props.message) {
    return <Navigate to={{ pathname: `${artemisPluginPath}/queues/messages`, search }} replace />
  }

  const currentMessage = props.message
  // queue can't be undefined when there's a message available
  const queue = props.queue!

  const updateBodyText = (currentMessage: Message): void => {
    log.debug('loading message:', currentMessage)
    let body: string = ""
    let lenTxt: string = ""
    if ('text' in currentMessage) {
      body = `${currentMessage.text}`
      lenTxt = "" + body.length
      setMessageTextMode('text (' + lenTxt + ' chars)')
      setMessageBody(body || '<empty message>')
    } else if (currentMessage.BodyPreview) {
      const code = Number(localStorage['ArtemisBrowseBytesMessages'] || '1')
      setMessageTextMode('bytes (turned off)')
      let len = 0
      if (code !== 99) {
        const bytesArr: string[] = []
        const textArr: string[] = []
        currentMessage.BodyPreview.forEach(function (b: number) {
          if (code === 1 || code === 2 || code === 16) {
            // text
            textArr.push(String.fromCharCode(b))
          }
          if (code === 1 || code === 4) {
            const unsignedByte = b & 0xff

            if (unsignedByte < 16) {
              // hex and must be 2 digit so they space out evenly
              bytesArr.push('0' + unsignedByte.toString(16))
            } else {
              bytesArr.push(unsignedByte.toString(16))
            }
          } else {
            // just show as is without spacing out, as that is usually more used for hex than decimal
            const s = b.toString(10)
            bytesArr.push(s)
          }
        })
        const bytesData = bytesArr.join(" ")
        const textData = textArr.join("")
        if (code === 1 || code === 2) {
          // bytes and text
          len = currentMessage.BodyPreview.length
          lenTxt = "" + textArr.length
          body = "bytes:\n" + bytesData + "\n\ntext:\n" + textData
          setMessageTextMode("bytes (" + len + " bytes) and text (" + lenTxt + " chars)")
        } else if (code === 16) {
          // text only
          lenTxt = "" + textArr.length
          body = "text:\n" + textData
          setMessageTextMode("text (" + lenTxt + " chars)")
        } else {
          // bytes only
          len = currentMessage.BodyPreview.length
          body = bytesData
          setMessageTextMode("bytes (" + len + " bytes)")
        }
      }
      setMessageBody(body)
    } else {
      setMessageTextMode("unsupported")
      setMessageBody("Unsupported message body type which cannot be displayed by hawtio")
    }
  }

  const onClick = (_event: React.MouseEvent, text: string) => {
    navigator.clipboard.writeText(text.toString())
  }

  const actions = (
    <>
      <CodeBlockAction>
        <ClipboardCopyButton id='clipboard-copy-button' aria-label='Copy to clipboard'
                             onClick={(e) => onClick(e, messageBody)} variant='plain'>()
        </ClipboardCopyButton>
      </CodeBlockAction>
    </>
  )

  let propertiesCount = 0
  propertiesCount += currentMessage.StringProperties ? Object.keys(currentMessage.StringProperties).length : 0
  propertiesCount += currentMessage.BooleanProperties ? Object.keys(currentMessage.BooleanProperties).length : 0
  propertiesCount += currentMessage.ByteProperties ? Object.keys(currentMessage.ByteProperties).length : 0
  propertiesCount += currentMessage.DoubleProperties ? Object.keys(currentMessage.DoubleProperties).length : 0
  propertiesCount += currentMessage.FloatProperties ? Object.keys(currentMessage.FloatProperties).length : 0
  propertiesCount += currentMessage.IntProperties ? Object.keys(currentMessage.IntProperties).length : 0
  propertiesCount += currentMessage.LongProperties ? Object.keys(currentMessage.LongProperties).length : 0
  propertiesCount += currentMessage.ShortProperties ? Object.keys(currentMessage.ShortProperties).length : 0

  const useModalWrapper = props.shownInModal

  const details = (
      <Grid hasGutter>
        <GridItem key='headers' span={5}>
          <Card isFullHeight={true}>
            <CardHeader>
              <CardTitle>Headers</CardTitle>
            </CardHeader>
            <Divider />
            <CardBody>
              <InnerScrollContainer>
                <Table variant="compact" isStriped aria-label="Headers Table">
                  <Thead>
                    <Tr id="heading">
                      <Th>key</Th>
                      <Th>value</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    <Tr id="address">
                      <Td id="address.key">address</Td>
                      <Td id="address.val">{currentMessage.address}</Td>
                    </Tr>
                    <Tr id="durable">
                      <Td>durable</Td>
                      <Td>{"" + currentMessage.durable}</Td>
                    </Tr>
                    <Tr id="exp">
                      <Td>expiration</Td>
                      <Td>{artemisService.formatExpires(currentMessage.expiration, true)}</Td>
                    </Tr>
                    <Tr id="large">
                      <Td>largeMessage</Td>
                      <Td>{"" + currentMessage.largeMessage}</Td>
                    </Tr>
                    <Tr id="messageID">
                      <Td>messageID</Td>
                      <Td>{currentMessage.messageID}</Td>
                    </Tr>
                    <Tr id="persistentSize">
                      <Td>persistentSize</Td>
                      <Td>{artemisService.formatPersistentSize(currentMessage.persistentSize)}</Td>
                    </Tr>
                    <Tr id="priority">
                      <Td>priority</Td>
                      <Td>{currentMessage.priority}</Td>
                    </Tr>
                    <Tr id="protocol">
                      <Td>protocol</Td>
                      <Td>{currentMessage.protocol}</Td>
                    </Tr>
                    <Tr id="redelivered">
                      <Td>redelivered</Td>
                      <Td>{"" + currentMessage.redelivered}</Td>
                    </Tr>
                    <Tr id="timestamp">
                      <Td>timestamp</Td>
                      <Td>{artemisService.formatTimestamp(currentMessage.timestamp)}</Td>
                    </Tr>
                    <Tr id="type">
                      <Td>type</Td>
                      <Td>{artemisService.formatType(currentMessage)}</Td>
                    </Tr>
                    <Tr id="user">
                      <Td>userID</Td>
                      <Td>{currentMessage.userID}</Td>
                    </Tr>
                  </Tbody>
                </Table>
              </InnerScrollContainer>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem key='properties' span={7}>
          <Card isFullHeight={true}>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
            </CardHeader>
            <Divider />
            <CardBody>
              {propertiesCount > 0 && <InnerScrollContainer>
                <Table variant="compact" isStriped aria-label="Properties Table">
                  <Thead>
                    <Tr id="propsHeaders">
                      <Th>key</Th>
                      <Th>value</Th>
                      <Th>type</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {getProps(currentMessage.StringProperties, "String")}
                    {getProps(currentMessage.BooleanProperties, "Boolean")}
                    {getProps(currentMessage.ByteProperties, "Byte")}
                    {getProps(currentMessage.DoubleProperties, "Double")}
                    {getProps(currentMessage.FloatProperties, "Float")}
                    {getProps(currentMessage.IntProperties, "Integer")}
                    {getProps(currentMessage.LongProperties, "Long")}
                    {getProps(currentMessage.ShortProperties, "Short")}
                  </Tbody>
                </Table>
              </InnerScrollContainer>}
              {propertiesCount == 0 && <Alert isPlain isInline variant='info' title='Message doesn&apos;t contain any properties' />}
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
  )

  if (!useModalWrapper) {
    return (
      <>
        <Flex direction={{ default: 'row' }}>
          <Flex>
            <FlexItem>
              <Title headingLevel='h2'>Viewing Message on {queue.name}</Title>
              <Title headingLevel="h4">Message ID: {currentMessage.messageID}</Title>
            </FlexItem>
          </Flex>
          <Flex align={{ default: 'alignRight' }}>
            <FlexItem>
              <Button variant='link' onClick={() => {
                navigate({ pathname: `${artemisPluginPath}/queues/messages`, search })
              }}>
                <Icon><ArrowLeftIcon /></Icon> Back to Message list
              </Button>
            </FlexItem>
            <FlexItem>
              <Button variant='link' onClick={() => {
                navigate({ pathname: `${artemisPluginPath}/queues`, search })
              }}>
                <Icon><ArrowLeftIcon /></Icon> Back to Queue list
              </Button>
            </FlexItem>
          </Flex>
        </Flex>
        <Divider />
        <Title headingLevel="h4">Displaying Body as: {messageTextMode}</Title>
        <Panel>
          <PanelMain>
            <PanelMainBody>
              <CodeBlock actions={actions}>
                <CodeBlockCode id="code-content">{messageBody}</CodeBlockCode>
              </CodeBlock>
            </PanelMainBody>
          </PanelMain>
        </Panel>
        <Panel>
          <PanelMain>
            <PanelMainBody>{details}</PanelMainBody>
          </PanelMain>
        </Panel>
      </>
    )
  } else {
    return (
        <>
          <ModalHeader>
            <Title headingLevel='h2'>Viewing Message on {queue.name}</Title>
            <Title headingLevel="h4">Message ID: {currentMessage.messageID}, displaying Body as: {messageTextMode}</Title>
          </ModalHeader>
          <ModalBody>
            <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
              <FlexItem>
                <CodeBlock actions={actions}>
                  <CodeBlockCode id="code-content">{messageBody}</CodeBlockCode>
                </CodeBlock>
              </FlexItem>
              <FlexItem id='modal-message-details'>
                {details}
              </FlexItem>
            </Flex>
          </ModalBody>
        </>
    )
  }
}

function getProps(properties: any, type: string): React.ReactNode {
  if (properties) {
    return Object.keys(properties).map((key, _index) => {
      return (
          <Tr key={key}>
            <Td id={key + "key"}>{key}</Td>
            <Td id={key + "val"}>{"" + properties[key]}</Td>
            <Td id={key + "type"}>{type}</Td>
          </Tr>
      )
    })
  } else {
    return ''
  }
}
