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

import { MBeanNode, type MBeanTree, TreeProcessor } from '@hawtio/react'
import { configManager } from './config-manager'
import { FolderIcon } from '@patternfly/react-icons/dist/esm/icons/folder-icon'
import { FolderOpenIcon } from '@patternfly/react-icons/dist/esm/icons/folder-open-icon'
import { NetworkWiredIcon } from '@patternfly/react-icons/dist/esm/icons/network-wired-icon'
import { ServerIcon } from '@patternfly/react-icons/dist/esm/icons/server-icon'
import { StreamIcon } from '@patternfly/react-icons/dist/esm/icons/stream-icon'
import React from 'react'

const icons = {
  address: React.createElement(FolderIcon),
  acceptor: React.createElement(NetworkWiredIcon),
  addressOpened: React.createElement(FolderOpenIcon),
  queue: React.createElement(StreamIcon),
  server: React.createElement(ServerIcon)
}

const artemisTreeProcessor: TreeProcessor = async (tree: MBeanTree) => {
  const config = await configManager.getArtemisconfig()
  const artemisDomain = tree.get(config.jmx.domain)

  if (!artemisDomain) {
    return
  }

  const brokerNodes = artemisDomain.removeChildren()

  const brokers = findBrokers(brokerNodes)
  for (const broker of brokers) {
    artemisDomain.adopt(broker)
    broker.icon = icons.server
    broker.expandedIcon = icons.server

    const acceptors = broker.get('acceptors', true)
    acceptors?.children?.forEach(acceptor => {
      acceptor.icon = icons.acceptor
      acceptor.expandedIcon = icons.acceptor
    })

    const addressesFolder = broker.get('addresses', true)
    if (!addressesFolder) {
      continue
    }
    // removed childrens are removed from the folder, returned and their parent is set to null
    // but don't remove all children, as there may be "diverts" too
    // const addressNodes = addressesFolder.removeChildren()
    const addresses = findAddresses(addressesFolder.children)
    for (const address of addresses) {
      addressesFolder.findChildren(address.name).forEach(c => {
        addressesFolder.removeChild(c)
      })
      addressesFolder.adopt(restructureAddress(address))
    }
  }

  artemisDomain.initId(true)
}

/**
 * Translate an array of JMX tree nodes for brokers, where each broker has a folder and leaf node
 * into an array of just folder nodes, but having a leaf functionality (operations, attributes, ...)
 * @param children
 */
function findBrokers(children: MBeanNode[] | undefined): MBeanNode[] {
  if (!children) {
    return []
  }
  const oldBrokers = new Map<string, MBeanNode>()
  for (const c of children) {
    if (!c.id.endsWith('-folder')) {
      if (c.mbean?.class === 'org.apache.activemq.artemis.core.management.impl.ActiveMQServerControlImpl') {
        oldBrokers.set(c.name, c)
      } else if (typeof c.mbean === 'object' && 'attr' in c.mbean && typeof c.mbean.attr === 'object' && 'AddressMemoryUsage' in c.mbean.attr) {
        // When running old jolokia and old brokers, we may not get c.mbean.class
        oldBrokers.set(c.name, c)
      }
    }
  }
  const brokers: MBeanNode[] = []
  for (const c of children) {
    if (oldBrokers.has(c.name) && c.id.endsWith('-folder')) {
      const oldBrokerNode = oldBrokers.get(c.name)!
      const newBrokerNode = new MBeanNode(null, `Broker ${c.name}`, true)
      newBrokerNode.icon = c.icon
      newBrokerNode.expandedIcon = c.expandedIcon
      newBrokerNode.children = []
      // newBrokerNode.metadata = oldBrokerNode.metadata
      newBrokerNode.objectName = oldBrokerNode.objectName
      newBrokerNode.mbean = oldBrokerNode.mbean
      newBrokerNode.propertyList = oldBrokerNode.propertyList

      const children = [...c.children!]
      children.forEach(c => {
        newBrokerNode.adopt(c)
      })
      brokers.push(newBrokerNode)
    }
  }
  // iterate again to catch the brokers which didn't have any children (were not a '-folder')
  for (const c of children) {
    if (oldBrokers.has(c.name)) {
      const oldBrokerNode = oldBrokers.get(c.name)!
      if (!c.id.endsWith('-folder') && !brokers.find(b => b.name === `Broker ${c.name}`)) {
        // the broker doesn't have children at all, but we still need the node
        const newBrokerNode = new MBeanNode(null, `Broker ${c.name}`, false)
        newBrokerNode.icon = c.icon
        newBrokerNode.objectName = oldBrokerNode.objectName
        newBrokerNode.mbean = oldBrokerNode.mbean
        newBrokerNode.propertyList = oldBrokerNode.propertyList
        brokers.push(newBrokerNode)
      }
    }
  }

  return brokers
}

/**
 * Translate an array of JMX tree nodes for addresses, where each addresses has a folder and leaf node
 * into an array of just folder nodes, but having a leaf functionality (operations, attributes, ...)
 * @param children
 */
function findAddresses(children: MBeanNode[] | undefined): MBeanNode[] {
  if (!children) {
    return []
  }
  const oldAddresses = new Map<string, MBeanNode>()
  const hadFolders = new Map<string, boolean>()
  for (const c of children) {
    if (!c.id.endsWith('-folder')) {
      if (c.mbean?.class === 'org.apache.activemq.artemis.core.management.impl.AddressControlImpl') {
        // non folder child with this class is an address
        oldAddresses.set(c.name, c)
      } else if (typeof c.mbean === 'object' && 'attr' in c.mbean && typeof c.mbean.attr === 'object' && 'MessageCount' in c.mbean.attr) {
        // When running old jolokia and old brokers, we may not get c.mbean.class
        oldAddresses.set(c.name, c)
      }
    } else {
      hadFolders.set(c.name, true)
    }
  }
  const addresses: MBeanNode[] = []
  for (const c of children) {
    if (oldAddresses.has(c.name)) {
      const newAddressNode = oldAddresses.get(c.name)!
      newAddressNode.children = c.children
      addresses.push(newAddressNode)
    }
  }

  return addresses
}

function restructureAddress(address: MBeanNode): MBeanNode {
  address.icon = icons.address
  address.expandedIcon = icons.addressOpened
  const queuesFolder = address.get("queues", true)

  if (!queuesFolder) {
    return address
  }

  const anycastQueuesFolder = queuesFolder.get("anycast", true)
  const multicastQueuesFolder = queuesFolder.get("multicast", true)

  if (anycastQueuesFolder) {
    queuesFolder?.removeChild(anycastQueuesFolder)
  }
  if (multicastQueuesFolder) {
    queuesFolder?.removeChild(multicastQueuesFolder)
  }
  address.removeChild(queuesFolder)

  if (anycastQueuesFolder && anycastQueuesFolder.children && anycastQueuesFolder.children.length > 0) {
    let folder = address.create("Anycast Queues", true)
    folder.children = anycastQueuesFolder.children
    anycastQueuesFolder.children.forEach(q => {
      // q.icon = icons.queue
      q.parent = folder
    })
  }
  if (multicastQueuesFolder && multicastQueuesFolder.children && multicastQueuesFolder.children.length > 0) {
    let folder = address.create("Multicast Queues", true)
    folder.children = multicastQueuesFolder.children
    multicastQueuesFolder.children.forEach(q => {
      // q.icon = icons.queue
      q.parent = folder
    })
  }

  return address
}

export { artemisTreeProcessor }
