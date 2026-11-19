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
import React, { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Content,
  DataList,
  DataListCell,
  DataListCheck,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  Label,
  LabelColor,
  LabelGroup,
  MenuToggle,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Pagination,
  PaginationVariant,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem
} from '@patternfly/react-core'
import {
  ActionsColumn,
  type IAction,
  InnerScrollContainer,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr
} from '@patternfly/react-table'
import { SortAmountDownIcon } from '@patternfly/react-icons/dist/esm/icons/sort-amount-down-icon'
import { RhUiRefreshIcon } from '@patternfly/react-icons/dist/esm/icons/rh-ui-refresh-icon'

import { eventService, jolokiaService } from '@hawtio/react'

import {
  type ActiveSort,
  type ArtemisTabId,
  ColumnType,
  type Filter,
  RemoveFilterScope,
  SortDirection,
  type TableColumn,
  TableColumnState,
  TableFilters,
  type TableRow,
  type TableRowsData
} from './types'
import { defaultRowsPerPage, pageSizeOptions } from './constants'
import { artemisPreferencesService } from '../artemis-preferences-service'
import { ArtemisFilters } from './ArtemisFilters'
import { operationSymbol } from './utils'

/**
 * Definition of additional action (not specific to any particular row) to be added next to filter toolbar
 */
export type ToolbarAction = {

  /** Name to be shown as link/button of the action */
  name: string

  /** Actual action, which usually sets a React state that opens a modal dialog (or similar) */
  action: () => void
}

/**
 * A type for properties passed to one of the ArtemisTabs components like `<ConnectionsTable>` or `<SessionsTable>`
 * used for encapsulating global filter functionality and cross-navigation+filtering.
 */
export type ArtemisTableFilterProps = {

  /**
   * A function that can be used from one tab to navigate to another tab with specific filter (like navigating from
   * sessions tab to see a connection tab showing only the connection of given session).
   */
  switchTab: (tab: ArtemisTabId, filter?: Filter) => void

  /**
   * Read-only value of the current filter (which may not be relevant for a given table, because
   * it's for an unavailable column)
   */
  filters: TableFilters

  /**
   * When user clicks "filter" for any given table a (field, operation, value) tuple is passed to ArtemisTabView,
   * so global filter configuration can be changed (new filter added, filter removed)
   */
  editGlobalFilter: (filter: Filter, remove?: RemoveFilterScope) => void
}

/**
 * All properties (attributes) passed to `<ArtemisTable>`. These properties are configured by individual tables
 * like `<ConnectionsTable>`.
 *
 * By convention:
 *  - the type for `<Component>` properties is named `ComponentProps`
 *  - the name for the property collection object passed to a component (if not using JS destructuring) is `props`
 */
export type ArtemisTableProps = ArtemisTableFilterProps & {

  /** An array of column definition for the table */
  allColumns: TableColumn[],

  /** Initial `Filter` to pass to a particular table component */
  initialFilter: Filter,

  /** Initial sorting for the table */
  initialSort: ActiveSort,

  /** An asynchronous function used to grab JSON data for all the rows of the table */
  getData: (page: number, perPage: number, sort: ActiveSort | undefined, filters: Filter[]) => Promise<TableRowsData>,

  /** A function returning row actions for a given row */
  getRowActions?: (row: TableRow) => IAction[],

  /** Additional actions to use at the top of the table (next to the filter and column management) */
  toolbarActions?: ToolbarAction[],

  /** Function for refreshing the table content without changing any filtering/sorting */
  refresh?: () => void,

  /** A counter for reloading the data due to out-of-bound change (like adding an address or closing a connection) */
  refreshCount?: number,

  /** An optional key for session storage property prefix to keep tab-specific filter configuration */
  storageColumnLocation?: string
}

/**
 * Returns a dedicated container for the "Manage Columns" modal. When opening and closing, PatternFly's `Modal` sets
 * `overflow: hidden` on its target and toggles `aria-hidden` on all the target's children. With the default target
 * (`document.body`) that invalidates the entire page, which is noticeably slow when the table has many rows.
 */
const getColumnsModalTarget = (): HTMLElement => {
  const id = 'artemis-columns-modal-root'
  let target = document.getElementById(id)
  if (!target) {
    target = document.createElement('div')
    target.id = id
    document.body.appendChild(target)
  }
  return target
}

type ArtemisTableToolbarProps = {
  allColumns: TableColumn[],
  setAllColumns: React.Dispatch<React.SetStateAction<TableColumn[]>>,
  toolbarActions?: ToolbarAction[]
  refresh?: () => void,
  isSortDropdownOpen: boolean,
  setIsSortDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>,
  activeSort: ActiveSort,
  storageColumnLocation?: string,
  displayFilter: Filter,
  tabFilters: Filter[],
  updateActiveSort: (id: string, order: SortDirection) => void,
  applyFilter: (filter: Filter, remove?: RemoveFilterScope) => void
}

const ArtemisTableToolbar: React.FunctionComponent<ArtemisTableToolbarProps> = (
    {
      allColumns, setAllColumns,
      toolbarActions, refresh,
      isSortDropdownOpen, setIsSortDropdownOpen,
      activeSort,
      storageColumnLocation,
      displayFilter,
      tabFilters,
      updateActiveSort,
      applyFilter
    }
) => {

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [columnsVisibility, setColumnsVisibility] = useState<TableColumnState[]>(() => {
    const visibility: TableColumnState[] = []
    allColumns.forEach(c => {
      visibility.push({ id: c.id, name: c.name, visible: c.visible })
    })
    return visibility
  })

  const visibleColumns = allColumns.filter((column) => column.visible)

  const handleModalToggle = () => {
    setIsModalOpen(!isModalOpen)
  }

  const updateColumnStatus = (index: number, _column: TableColumnState) => {
    const updatedColumns = [...columnsVisibility]
    updatedColumns[index].visible = !columnsVisibility[index].visible
    setColumnsVisibility(updatedColumns)
  }

  const onSave = () => {
    setIsModalOpen(false)

    if (storageColumnLocation) {
      artemisPreferencesService.saveColumnPreferences(storageColumnLocation, columnsVisibility)
    }

    setAllColumns(allColumns => {
      const changed = [...allColumns]
      changed.forEach(c => {
        c.visible = columnsVisibility.find(_c => _c.id === c.id)?.visible ?? false
      })
      return changed
    })
  }

  const cancel = () => {
    setIsModalOpen(false)

    setColumnsVisibility(columnsVisibility => {
      const changed = [...columnsVisibility]
      changed.forEach(c => {
        c.visible = allColumns.find(_c => _c.id === c.id)?.visible ?? false
      })
      return changed
    })
  }

  const selectAllColumns = () => {
    const updatedColumns = [...columnsVisibility]
    updatedColumns.map((column) => {
      column.visible = true
      return true
    })
    setColumnsVisibility(updatedColumns)
  }

  const unselectAllColumns = () => {
    const updatedColumns = [...columnsVisibility]
    updatedColumns.map((column) => {
      column.visible = false
      return false
    })
    setColumnsVisibility(updatedColumns)
  }

  return (
      <>
        <Toolbar id='artemis-tabs-toolbar'>
          <ToolbarContent>
            {/* Sorting */}
            <ToolbarItem key='table-sort'>
              <Dropdown
                  isOpen={isSortDropdownOpen}
                  toggle={(toggleRef) => (
                      <MenuToggle variant='plain' ref={toggleRef} onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}>
                        <SortAmountDownIcon />
                      </MenuToggle>
                  )}>
                <DropdownGroup key='sort-columns' aria-label='Sort column'>
                  <DropdownList>
                    {Object.values(allColumns).filter((element) => element.visible).map((column, _columnIndex) => (
                        <DropdownItem key={column.id} isSelected={activeSort.column === column.id} value={column.name}
                                      onClick={() => updateActiveSort(column.id, activeSort.order)}>
                          {column.name}
                        </DropdownItem>
                    ))}
                  </DropdownList>
                </DropdownGroup>
                <Divider key='separator' />
                <DropdownGroup key='sort-direction' aria-label='Sort direction'>
                  <DropdownList>
                    <DropdownItem key='ascending' isSelected={activeSort.order === SortDirection.ASCENDING}
                                  onClick={() => updateActiveSort(activeSort.column!, SortDirection.ASCENDING)}>
                      Ascending
                    </DropdownItem>
                    <DropdownItem key='descending' isSelected={activeSort.order === SortDirection.DESCENDING}
                                  onClick={() => updateActiveSort(activeSort.column!, SortDirection.DESCENDING)}>
                      Descending
                    </DropdownItem>
                  </DropdownList>
                </DropdownGroup>
              </Dropdown>
            </ToolbarItem>
            {/* Refreshing */}
            <ToolbarItem key='table-refresh'>
              <Button variant="link" isCircle aria-label="Refresh" icon={<RhUiRefreshIcon />} onClick={() => {
                refresh?.()
              }} />
            </ToolbarItem>
            <ToolbarItem variant='separator' />

            {/* field|operation|value|[filter]|[clear] */}
            <ArtemisFilters key={`${displayFilter.column}:${displayFilter.operation}:${displayFilter.input}`}
                            columns={allColumns} filter={displayFilter} onApplyFilter={applyFilter} />
            <ToolbarItem variant='separator' />

            {/* Single button for column management of the current table */}
            <ToolbarItem key='column-select'>
              <Button variant='link' onClick={handleModalToggle}>Manage Columns ({visibleColumns.length}/{allColumns.length})</Button>
            </ToolbarItem>

            {/* Additional actions configured by the components using ArtemisTable */}
            {(toolbarActions?.length ?? 0) > 0 && (<ToolbarItem variant='separator'></ToolbarItem>)}
            {
              toolbarActions?.map(action => (
                  <ToolbarItem key={'toolbar-action-' + action.name}>
                    <Button size='sm' variant='secondary' onClick={() => action.action()}>{action.name}</Button>
                  </ToolbarItem>))
            }
          </ToolbarContent>
        </Toolbar>

        {/* Optional toolbar if there are any applicable filters */}
        {tabFilters.length > 0 && (<Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <LabelGroup categoryName='Filters' isClosable onClick={() => applyFilter(tabFilters[0], RemoveFilterScope.ALL)}>
                {tabFilters.map((f, idx) => {
                  if (!(f.column && f.operation)) {
                    return null
                  }
                  const column = allColumns.find(c => c.id === f.column)
                  if (column) {
                    const columnName = column.name
                    let prefix = ''
                    if (column.type === ColumnType.BOOLEAN) {
                      if (f.operation === 'EQUALS') {
                        prefix = 'true' === f.input ? 'IS ' : 'IS NOT '
                      } else if (f.operation === 'NOT_EQUALS') {
                        prefix = 'false' === f.input ? 'IS ' : 'IS NOT '
                      }
                    }
                    const suffix = column.type !== ColumnType.BOOLEAN ? ` ${operationSymbol(f.operation)} ${f.input}` : ''
                    // const prefix =
                    return (
                        <Label key={`f-${idx}`} color={LabelColor.purple} onClose={() => applyFilter(f, RemoveFilterScope.SINGLE)}>
                          {prefix}{columnName ?? f.column}{suffix}
                        </Label>
                    )
                  }
                })}
              </LabelGroup>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>)}
        {/*{tabFilters.length == 0 && (<Alert isInline isPlain title='Click "Filter" to add first filter condition' variant='info' />)}*/}

        <Modal
            isOpen={isModalOpen}
            variant='small'
            onClose={cancel}
            appendTo={getColumnsModalTarget}
        >
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
            <DataList aria-label='Table column management' id='table-column-management' isCompact>
              {columnsVisibility.map((column, id) => (
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
            <Button id='columns-save-button' key='save' variant='primary' onClick={onSave}>
              Save
            </Button>
            <Button key='close' variant='link' onClick={cancel}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      </>
  )
}

/**
 * Common component for displaying tables of Artemis objects. It provides an interface (set of accepted properties)
 * for unified experience with filtering and cross-table navigation (like navigating to session table from connection
 * table by applying a filter to show only this connection's sessions).
 *
 * @param props
 * @constructor
 */
export const ArtemisTable: React.FunctionComponent<ArtemisTableProps> = props => {

  const initialColumns: () => TableColumn[] = () => {
    if (props.storageColumnLocation) {
      const savedColumns = artemisPreferencesService.loadColumnPreferences(props.storageColumnLocation, props.allColumns)
      return savedColumns ?? props.allColumns
    }
    return props.allColumns
  }

  const initialActiveSort: () => ActiveSort = () => {
    if (props.storageColumnLocation && sessionStorage.getItem(props.storageColumnLocation + '.activesort')) {
      return JSON.parse(sessionStorage.getItem(props.storageColumnLocation + '.activesort') as string)
    }
    return props.initialSort
  }

  const initialPerPage: () => number = () => {
    if (props.storageColumnLocation) {
      const savedPerPage = artemisPreferencesService.loadTablePageSize(props.storageColumnLocation)
      return savedPerPage ?? defaultRowsPerPage
    }
    return defaultRowsPerPage
  }

  const initialIsCompact: () => boolean = () => {
    return initialPerPage() == -1
  }

  // -- two states to keep the server paged/sorted/filtered response
  const [rows, setRows] = useState<TableRowsData['data']>([])
  const [resultsSize, setResultsSize] = useState<TableRowsData['count']>(0)

  const [loading, setLoading] = useState<boolean>(true)
  const [updateKey, setUpdateKey] = useState<string | null>(null)

  // -- state initialized by component props
  //    mind that the value (or init-function) is used in React state only on initial mount or re-mount (when key changes),
  //    but NOT when the component is updated (re-rendered)
  const [columns, setColumns] = useState(initialColumns)
  const [activeSort, setActiveSort] = useState<ActiveSort>(initialActiveSort)

  // -- state initialized with defaults
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(initialPerPage)
  const [isCompact, setIsCompact] = useState(initialIsCompact)

  // -- state for modals
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)

  const visibleColumns = columns.filter((column) => column.visible)

  // Filters applicable to current tab
  const tabFilters = useMemo(() => {
    return props.filters.searchFilters.filter(f => f.tab === props.initialFilter.tab)
  }, [props.filters.searchFilters, props.initialFilter.tab])

  const displayFilter = tabFilters.length > 0 ? tabFilters[tabFilters.length - 1] : props.initialFilter

  const currentUpdateKey = JSON.stringify({
    page, perPage, activeSort, tabFilters, count: props.refreshCount
  })
  const isLoading = loading || currentUpdateKey !== updateKey

  // main data loading effect for lazy population of the table
  useEffect(() => {
    let apply = true
    setLoading(true)

    props.getData(page, perPage, activeSort, tabFilters)
        .then(rowsData => {
          if (apply) {
            setLoading(false)
            setRows(rowsData.data)
            setResultsSize(rowsData.count)
            setUpdateKey(currentUpdateKey)
          }
        })
        .catch(error => {
          if (apply) {
            setLoading(false)
            setRows([])
            setResultsSize(0)
            setUpdateKey(currentUpdateKey)
            eventService.notify({ type: 'danger', message: 'Problem populating data: ' + jolokiaService.errorMessage(error) })
          }
        })
    return () => {
      apply = false
    }
  }, [page, perPage, activeSort, tabFilters, props.getData, props.refreshCount])

  const updateActiveSort = (id: string, order: SortDirection) => {
    const updatedActiveSort: ActiveSort = {
      column: id,
      order: order
    }
    setActiveSort(updatedActiveSort)
    sessionStorage.setItem(props.storageColumnLocation + '.activesort',JSON.stringify(updatedActiveSort))
  }

  const getRowActions = (row: TableRowsData['data'][number]): IAction[] => {
    if (props.getRowActions) {
      return props.getRowActions(row)
    }
    return []
  }

  const handleSetPage = (_event: React.MouseEvent | React.KeyboardEvent | MouseEvent, newPage: number) => {
    setPage(newPage)
  }

  const handlePerPageSelect = (_event: React.MouseEvent | React.KeyboardEvent | MouseEvent, newPerPage: number) => {
    if (newPerPage === -1) {
      setIsCompact(true)
      setPerPage(-1)
    } else {
      setIsCompact(false)
      setPerPage(newPerPage)
    }
    setPage(1)
    if(props.storageColumnLocation) {
      artemisPreferencesService.saveTablePageSize(props.storageColumnLocation, newPerPage)
    }
  }

  /**
   * Returns a value or any react component to be put into a cell
   * @param producer
   * @param column
   */
  const getCellValue = (producer: TableRowsData['data'][number], column: TableColumn) => {
    const v = producer[column.id]
    if (column.component) {
      return column.component(v)
    }
    return v
  }

  const handleClick = (column: TableColumn, row: TableRow) => () => {
    if (column.filter) {
      const filter = column.filter(row)
      if (props.switchTab) {
        props.switchTab(filter.tab, filter)
      }
    } else if (column.link) {
      column.link(row)
    }
  }

  // function used both by <ArtemisFilters> (to add and clear filters) and by the label group (to clear one or all
  // the filters from a given path)
  const applyFilter = (filter: Filter, remove?: RemoveFilterScope) => {
    setPage(1)
    props.editGlobalFilter(filter, remove)
  }

  const renderPagination = (variant: PaginationVariant | undefined) => (
    <Pagination
      itemCount={resultsSize}
      page={page}
      perPage={perPage}
      onSetPage={handleSetPage}
      onPerPageSelect={handlePerPageSelect}
      isCompact={isCompact}
      perPageOptions={pageSizeOptions}
      variant={variant}
      titles={{
        paginationAriaLabel: `${variant} pagination`,
        perPageSuffix: ''
      }}
    />
  )

  return (
    <>
      <ArtemisTableToolbar allColumns={columns} setAllColumns={setColumns}
                           toolbarActions={props.toolbarActions} refresh={props.refresh}
                           isSortDropdownOpen={isSortDropdownOpen} setIsSortDropdownOpen={setIsSortDropdownOpen}
                           activeSort={activeSort}
                           storageColumnLocation={props.storageColumnLocation} displayFilter={displayFilter}
                           updateActiveSort={updateActiveSort}
                           tabFilters={tabFilters}
                           applyFilter={applyFilter} />

      <Divider />

      <InnerScrollContainer style={{ opacity: isLoading ? 0.4 : 1, transition: 'opacity 0.25s' }}>
        <Table id='data-table' isStickyHeader variant='compact' aria-label='Data Table'>
          <Thead>
            <Tr>
              {visibleColumns.map((column, id) => {
                const isSorted = column.id === activeSort.column
                const direction = isSorted ? activeSort.order : undefined
                const nextDirection =
                  isSorted && activeSort.order === SortDirection.ASCENDING
                    ? SortDirection.DESCENDING
                    : SortDirection.ASCENDING
                return (
                  <Th
                    key={id}
                    sort={{
                      sortBy: {
                        index: id,
                        direction: direction === SortDirection.ASCENDING ? 'asc' : 'desc'
                      },
                      onSort: () => updateActiveSort(column.id, nextDirection),
                      columnIndex: id
                    }}
                  >{column.name}</Th>
                )
              })}
              <Th aria-label='actions' />
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row, rowIndex) => {
              const rowActions = getRowActions(row)
              return (
                  <Tr key={rowIndex}>
                    {visibleColumns.map((column, id) => {
                      const key = getCellValue(row, column)
                      if (column.filter || column.link) {
                        return <Td key={id}><Button variant='link' isInline
                                                    onClick={handleClick(column, row)}>{key}</Button></Td>
                      } else {
                        return <Td key={id}>{key}</Td>
                      }
                    })}
                    <Td isActionCell>
                      <ActionsColumn items={rowActions} popperProps={{ position: 'end' }} isDisabled={rowActions.length === 0} />
                    </Td>
                  </Tr>
              )
            })}
          </Tbody>
        </Table>
      </InnerScrollContainer>

      {renderPagination(PaginationVariant.bottom)}
    </>
  )
}
