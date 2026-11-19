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
import React, { useCallback, useEffect, useState } from 'react'
import { PageSection, Nav, NavItem, NavList, Button } from '@patternfly/react-core'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'

import { artemisPluginPath, storageKeyFilters } from '../globals'
import { ArtemisContext, useArtemisTree } from '../context'
import { artemisService } from '../artemis-service'
import { type ArtemisTabId, EMPTY_TABLE_FILTERS, type Filter, RemoveFilterScope, TableFilters } from '../table/types'

import { Status } from '../status/Status'
import { ConnectionsTable } from '../connections/ConnectionsTable'
import { SessionsTable } from '../sessions/SessionsTable'
import { ProducerTable } from '../producers/ProducerTable'
import { ConsumerTable } from '../consumers/ConsumerTable'
import { AddressesTable } from '../addresses/AddressesTable'
import { QueuesView } from '../queues/QueuesView'
import { BrokerDiagram } from '../brokers/BrokerDiagram'

/**
 * Representation of one tab of `<ArtemisTabs>` component
 */
type TabDefinition = {
  /** One of the supported tab identifiers, reflected in browser URL and allowing cross-tab navigation */
  id: ArtemisTabId
  /** Title for the tab */
  title: string
  /** React component to be displayed after navigating (using React Router) to the tab */
  component: React.ReactNode,
  /** Whether the component of a tab uses inner `<Routes>` */
  hasSubTabs?: boolean
}

function persistFilters(filters: TableFilters) {
  localStorage.setItem(storageKeyFilters, JSON.stringify(filters))
}

export const ArtemisTabs: React.FunctionComponent = () => {

  const { tree, loaded, selectedNode, jmxDomain, brokerNode, setSelectedNode, findAndSelectNode } = useArtemisTree()

  // global search filters provided down to individual tabs. Full filter is an array of individual
  // <field><operation><value> tuples, where each tuple is valid only for a single tab.
  const [searchFilters, setSearchFilters] = useState<TableFilters>(() => {
    const data = localStorage.getItem(storageKeyFilters)
    if (data) {
      try {
        const json = JSON.parse(data)
        if ('searchFilters' in json) {
          return json as TableFilters
        }
      } catch (error) {
        console.error('Can\'t parse JSON filter data from local storage', error)
      }
    }
    return EMPTY_TABLE_FILTERS
  })

  const { pathname, search } = useLocation()
  const navigate = useNavigate()

  /**
   * Cross-table navigation between Artemis tabs. Cells in one tab/table (for example sessions) may be links to
   * another tab/table (like connections). This method allows to perform "navigation with immediate" filtering, where
   * the filtering criteria is defined by the link in the cell.
   *
   * @param tab
   * @param filter
   */
  const switchTab = useCallback((tab: ArtemisTabId, filter?: Filter) => {
    if (filter) {
      setSearchFilters(filters => {
        const newFilters: TableFilters = { ...filters }
        if (filter) {
          newFilters.searchFilters = filters.searchFilters.filter(f => f.tab !== tab)
          newFilters.searchFilters.push(filter)
        }
        return newFilters
      })
    }
    navigate({ pathname: `${artemisPluginPath}/${tab}`, search })
  }, [navigate, search])

  /**
   * Function passed to individual tables which display filtering UI. When a filter is added, this function
   * updates global set of filters.
   * @param filter
   * @param remove
   */
  const filterApplied = useCallback((filter: Filter, remove?: RemoveFilterScope) => {
    setSearchFilters(filters => {
      let filterArray: Filter[]
      if (remove) {
        if (remove === RemoveFilterScope.ALL) {
          // remove all for given tab - anything by f.tab is ignored from the Filter object
          filterArray = filters.searchFilters.filter(f => !(f.tab === filter.tab))
        } else /*if (remove === RemoveFilterScope.SINGLE)*/ {
          // leave all that don't match the passed filter tuple
          filterArray = filters.searchFilters.filter(f => !(f.tab === filter.tab && f.column == filter.column && f.operation === filter.operation && f.input === filter.input))
        }
      } else {
        // add, but only if there's no such already
        const found = filters.searchFilters.find(f => (f.tab === filter.tab && f.column == filter.column && f.operation === filter.operation && f.input === filter.input))
        if (found) {
          // no change at all, so don't propagate state change
          return filters
        }
        filterArray = [...filters.searchFilters, filter]
      }
      return { ...filters, searchFilters: filterArray }
    })
  }, [])

  useEffect(() => {
    // synchronize with "external storage"
    persistFilters(searchFilters)
  }, [searchFilters])

  // <Status> is the only component that is not guarded by permissions
  const tabs: TabDefinition[] = [
    { id: 'status', title: 'Status', component: <Status /> },
  ]
  if (artemisService.canListConnections(brokerNode)) {
    tabs.push({ id: 'connections', title: 'Connections', component: <ConnectionsTable switchTab={switchTab} filters={searchFilters} editGlobalFilter={filterApplied} /> })
  }
  if (artemisService.canListSessions(brokerNode)) {
    tabs.push({ id: 'sessions', title: 'Sessions', component: <SessionsTable switchTab={switchTab} filters={searchFilters} editGlobalFilter={filterApplied} /> })
  }
  if (artemisService.canListProducers(brokerNode)) {
    tabs.push({ id: 'producers', title: 'Producers', component: <ProducerTable switchTab={switchTab} filters={searchFilters} editGlobalFilter={filterApplied} /> })
  }
  if (artemisService.canListConsumers(brokerNode)) {
    tabs.push({ id: 'consumers', title: 'Consumers', component: <ConsumerTable switchTab={switchTab} filters={searchFilters} editGlobalFilter={filterApplied} /> })
  }
  if (artemisService.canListAddresses(brokerNode)) {
    tabs.push({ id: 'addresses', title: 'Addresses', component: <AddressesTable switchTab={switchTab} filters={searchFilters} editGlobalFilter={filterApplied} /> })
  }
  if (artemisService.canListQueues(brokerNode)) {
    tabs.push({ id: 'queues', hasSubTabs: true, title: 'Queues', component: <QueuesView switchTab={switchTab} filters={searchFilters} editGlobalFilter={filterApplied} /> })
  }
  if (artemisService.canListNetworkTopology(brokerNode)) {
    tabs.push({ id: 'broker-diagram', title: 'Broker Diagram', component: <BrokerDiagram /> })
  }

  return (
    <ArtemisContext.Provider value={{ tree, loaded, selectedNode, jmxDomain, brokerNode, setSelectedNode, findAndSelectNode }}>
      <PageSection type='tabs' hasBodyWrapper={false}>
        <Nav variant='horizontal-subnav' aria-label='Artemis Nav'>
          <NavList>
            {tabs.map(({ id, title, hasSubTabs }) => {
              let isActive = pathname === `${artemisPluginPath}/${id}`
              if (hasSubTabs) {
                isActive ||= pathname?.startsWith(`${artemisPluginPath}/${id}/`)
              }
              return (<NavItem key={id} onClick={() => { switchTab(id, undefined) }} isActive={isActive}>
                <Button>{title}</Button>
              </NavItem>)
            })}
          </NavList>
        </Nav>
      </PageSection>
      <PageSection hasBodyWrapper={false} isFilled hasOverflowScroll aria-label='Artemis Tabs Content'>
        <Routes>
          {tabs.map(({ id, component, hasSubTabs }) => (
              <Route key={id} path={hasSubTabs ? `${id}/*` : id} element={component} />
          ))}
          <Route path='' element={<Navigate to={{ pathname: tabs[0].id, search }} replace={true} />} />
        </Routes>
      </PageSection>
    </ArtemisContext.Provider>
  )
}
