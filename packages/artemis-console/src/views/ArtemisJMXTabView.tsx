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
import React, { useContext, useState } from 'react'
import {
  Button,
  Modal,
  ModalVariant,
  PageSection,
  ModalFooter,
  ModalBody,
  Nav,
  NavList,
  NavItem
} from '@patternfly/react-core'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router'

import { Attributes, Chart, MBeanNode, Operations } from '@hawtio/react'

import { artemisJMXPluginPath } from '../globals'
import { ArtemisContext, pluginPathWithNodeId } from '../context'
import { isAddress as isAnAddress, isQueue as isAQueue, mbeanUnescape } from '../util/jmx'
import { artemisService } from '../artemis-service'
import { CreateQueue } from '../queues/CreateQueue'
import { DeleteAddress } from '../addresses/DeleteAddress'
import { MessagesTable } from '../messages/MessagesTable'
import { SendMessage } from '../messages/SendMessage'
import { type Message, MessageView } from '../messages/MessageView'
import { DeleteQueue } from '../queues/DeleteQueue'

type NavItemDefinition = {
  id: string,
  title: string,
  component?: React.FunctionComponent,
  element?: React.ReactNode,
}

const initialMessage: Message = {
  messageID: '',
  address: '',
  durable: false,
  expiration: 0,
  largeMessage: false,
  persistentSize: 0,
  priority: 0,
  protocol: '',
  redelivered: false,
  timestamp: 0,
  type: 0,
  userID: ''
}

const tabPrefix = `${artemisJMXPluginPath}/`

export const ArtemisJMXTabs: React.FunctionComponent = () => {

  const { selectedNode, brokerNode } = useContext(ArtemisContext)
  const [currentMessage, setCurrentMessage] = useState<Message>(initialMessage)

  const [showMessageDialog, setShowMessageDialog] = useState(false)

  const { pathname, search } = useLocation()

  const currentTab = pathname.startsWith(tabPrefix) ? pathname.slice(tabPrefix.length).split('/', 1)[0] : ''
  const [lastTab, setLastTab] = useState(currentTab)
  if (currentTab && currentTab !== lastTab) {
    // one of the special cases where the state is changed during render
    // be careful with these.
    // here we want to remember current tab, so switching between tree nodes (which won't fully remount
    // <ArtemisJMXTabs>) will keep the previously selected tab
    setLastTab(currentTab)
  }

  if (!selectedNode) {
    return null
  }

  const isAddress = isAnAddress(selectedNode)
  const isQueue = isAQueue(selectedNode)

  let prop = selectedNode.getProperty("routing-type")
  const routingType: string  = mbeanUnescape(prop === undefined ? '' : prop)
  prop = selectedNode.getProperty("address")
  const address: string | undefined = mbeanUnescape(prop === undefined ? '' : prop)
  prop = selectedNode.getProperty("queue")
  const queue: string | undefined = mbeanUnescape(prop === undefined ? '' : prop)

  const selectMessage = (message: Message) => {
    setCurrentMessage(message)
    setShowMessageDialog(true)
  }

  const navItems: NavItemDefinition[] = [
    { id: 'attributes', title: 'Attributes', component: Attributes },
    { id: 'operations', title: 'Operations', component: Operations },
    { id: 'chart', title: 'Chart', component: Chart },
  ]

  if (isAddress && artemisService.canCreateQueue(brokerNode)) {
    navItems.push({ id: 'create-queue', title: 'Create Queue', element: (
        <CreateQueue address={selectedNode.name} shownInModal={false} />
    ) })
  }

  if (isAddress && artemisService.canDeleteAddress(brokerNode)) {
    navItems.push({ id: 'delete-address', title: 'Delete Address', element: (
        <DeleteAddress address={selectedNode.name} />
    ) })
  }

  if (isAddress && artemisService.checkCanSendMessageToAddress(selectedNode as MBeanNode)) {
    navItems.push({ id: 'send-address-message', title: 'Send Message', element: (
        <SendMessage queue={queue} routingType={routingType} address={address} isAddress={true} shownInModal={false} />
    ) })
  }

  if (isQueue && artemisService.checkCanBrowseQueue(selectedNode as MBeanNode)) {
    navItems.push({ id: 'messages', title: 'Browse Messages', element: (
        <>
          <PageSection>
            <MessagesTable queue={{ name: queue, address: address, routingType: routingType }} noNavigate selectMessage={selectMessage} />
          </PageSection>
          <Modal
              aria-label='message-view-modal'
              variant={ModalVariant.large}
              isOpen={showMessageDialog}
              onClose={() => setShowMessageDialog(false)}>
            <MessageView queue={{ name: queue, address: address, routingType: routingType }} message={currentMessage} shownInModal
                         onClose={() => setShowMessageDialog(false)} />
            <ModalBody>
            </ModalBody>
            <ModalFooter>
              <Button key="close" variant="secondary" onClick={() => setShowMessageDialog(false)}>
                Close
              </Button>
            </ModalFooter>
          </Modal>
        </>
    ) })
  }

  if (isQueue && artemisService.canDeleteQueue(brokerNode)) {
    navItems.push({ id: 'delete-queue', title: 'Delete/Purge Queue', element: (
        <DeleteQueue queue={selectedNode.name} address={address} routingType={routingType} />
    ) })
  }

  if (isQueue && artemisService.checkCanSendMessageToQueue(selectedNode as MBeanNode)) {
    navItems.push({ id: 'send-queue-message', title: 'Send Message', element: (
        <SendMessage queue={selectedNode.name} routingType={routingType} address={address} isAddress={false} shownInModal={false} />
    ) })
  }

  // previous tab is valid only if it's available when showing different (type of) MBean
  const canStayAtLastTab = navItems.find(ni => ni.id === lastTab)

  const searchWithNid = pluginPathWithNodeId(selectedNode, artemisJMXPluginPath, new URLSearchParams(search)).search as string

  return (
      <>
        <PageSection type='tabs' hasBodyWrapper={false}>
          <Nav aria-label='MBean Nav' variant='horizontal-subnav'>
            <NavList>
              {navItems.map(nav => (
                  <NavItem key={nav.id} isActive={pathname === `${artemisJMXPluginPath}/${nav.id}`}>
                    <NavLink to={{ pathname: `${artemisJMXPluginPath}/${nav.id}`, search: searchWithNid }}>{nav.title}</NavLink>
                  </NavItem>
              ))}
            </NavList>
          </Nav>
        </PageSection>
        <PageSection
            id='artemis-jmx-content-main'
            padding={{ default: 'noPadding' }}
            aria-label='artemis-jmx-content-main'
            hasOverflowScroll
            hasBodyWrapper={false}>
          <Routes>
            {navItems.map(nav => {
              if (nav.element) {
                return <Route key={nav.id} path={nav.id} element={nav.element} />
              } else if (nav.component) {
                return <Route key={nav.id} path={nav.id} Component={nav.component} />
              }
            })}
            <Route key='root' path='' element={<Navigate to={{ pathname: canStayAtLastTab && lastTab ? lastTab : navItems[0].id, search: searchWithNid }} replace={true} />} />
          </Routes>
        </PageSection>
      </>
  )
}
