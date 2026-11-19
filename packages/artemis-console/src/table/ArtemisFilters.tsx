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
  MenuToggle,
  MenuToggleElement,
  Popover,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  Switch,
  ToolbarItem
} from '@patternfly/react-core'
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/outlined-question-circle-icon'

import { ColumnType, type Filter, RemoveFilterScope, type TableColumn } from './types'
import { operationOptions } from './constants'
import { availableOperations } from './utils'

/**
 * Type for properties of `<ArtemisFilters>` component
 */
export type ArtemisFiltersProps = {
  /** Partial column information to build a filtering UI */
  columns: Pick<TableColumn, 'id'|'name'|'type'|'visible'|'filterable'>[]
  /** Last applied filter for the tab or initial filter */
  filter: Filter
  /** Clicking "filter" propagates the filter information up, so it can be added to globally applicable filters */
  onApplyFilter: (filter: Filter, remove?: RemoveFilterScope) => void
}

/**
 * A component that shows a single `Filter` (column+operation+value) for current table. One filter can be then added
 * to a global set of effective filters for all the tables.
 * When there are filters applied for given tab, this component tries to show the last filter for this tab, so it can
 * be quickly "cleared" - then the next last filter will be presented for better UX.
 *
 * @param columns
 * @param filter
 * @param onApplyFilter
 */
export const ArtemisFilters: React.FC<ArtemisFiltersProps> = ({ columns, filter, onApplyFilter }) => {
  const searchRef = useRef<HTMLInputElement>(null)

    // Filter -> UI state mapping, shared by useState initializers and resetTo()
  const columnFor = (f: Filter) => columns.find(c => c.filterable && c.id === f.column)
  const operationFor = (f: Filter) => {
    const column = columnFor(f)
    if (!column) {
      return undefined
    }
    const op = availableOperations(column.type).find(o => o === f.operation)
    return operationOptions.find(o => o.id === op)
  }
  const booleanFor = (f: Filter) => columnFor(f)?.type === ColumnType.BOOLEAN && f.input === 'true'

  // initial filter column|operation|value always comes from the props.
  const [filterColumn, setFilterColumn] = useState(() => columnFor(filter))
  const [filterOperation, setFilterOperation] = useState(() => operationFor(filter))
  const [booleanOption, setBooleanOption] = useState(() => booleanFor(filter))

  const [columnOpen, setColumnOpen] = useState(false)
  const [operationOpen, setOperationOpen] = useState(false)

  const filterableColumns = columns.filter(c => c.filterable)
  const visibleOperations = filterColumn
      ? availableOperations(filterColumn.type).map(available => operationOptions.find(op => op.id === available)!)
      : undefined

  // applying a filter using "Add Filter" or enter calls up the method passed as onApplyFilter, which updates the global
  // filter which leads to new data being fetched and re-render of ArtemisTable and ArtemisFilters
  const addFilter = () => {
    if (filterColumn?.type === ColumnType.BOOLEAN) {
      if (filterOperation) {
        onApplyFilter({ tab: filter.tab, column: filterColumn.id, operation: filterOperation.id, input: booleanOption ? 'true' : 'false' })
      }
    } else if (searchRef.current) {
      if (filterOperation && filterColumn) {
        onApplyFilter({ tab: filter.tab, column: filterColumn.id, operation: filterOperation.id, input: searchRef.current?.value ?? '' })
      }
    }
  }

  /**
   * Clearing current filter (a tuple of "column", "operation" and "value") removes the filter from global filters for
   * current tab and also picks up the last available filter to be shown. This allows to quickly click "Clear" again.
   */
  const removeFilter = () => {
    if (filterColumn && filterOperation) {
      const input = filterColumn.type === ColumnType.BOOLEAN ? booleanOption ? 'true' : 'false' : searchRef.current?.value
      // pass current column|operation|value for removal from global filters
      onApplyFilter({ tab: filter.tab, column: filterColumn.id, operation: filterOperation.id, input }, RemoveFilterScope.SINGLE)
    }

    // even if the clearing doesn't remove a filter from the global list, we want to bring back the
    // last filter or initial filter, so clicking "clear" again will remove it.
    setFilterColumn(columnFor(filter))
    setFilterOperation(operationFor(filter))
    setBooleanOption(booleanFor(filter))
    if (searchRef.current) {
      searchRef.current.value = filter.input ? `${filter.input}` : ''
    }
  }

  /**
   * Remove all the filters for current tab
   */
  const clearAllFilters = () => {
    onApplyFilter({ tab: filter.tab }, RemoveFilterScope.ALL)
  }

  const adjustOperationList = (column?: ArtemisFiltersProps['columns'][number]) => {
    if (!column) {
      setFilterOperation(undefined)
    } else {
      const ops = availableOperations(column.type).map(available => operationOptions.find(op => op.id === available)!)
      if (!ops.find(op => op === filterOperation)) {
        // select first if current operation is not available for given type of changed column
        setFilterOperation(ops[0])
      }
    }
  }

  const FilterHint = () => (
      <Content component='p'>
        Artemis Broker supports multiple filters since&nbsp;
        <a href='https://artemis.apache.org/components/artemis/download/release-notes-2.53.0' target='_blank'>version 2.53.0</a>.
        For earlier versions only one filter may be added.
      </Content>
  )

  return (
    <>
      <ToolbarItem key='column-id-select'>
        <Select isScrollable
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle isFullWidth isDisabled={filterableColumns.length == 0} role='menu' ref={toggleRef} onClick={() => setColumnOpen(prev => !prev)}>
              {filterColumn?.name || ''}
            </MenuToggle>
          )}
          aria-label='Select Column'
          isOpen={columnOpen}
          onOpenChange={setColumnOpen}
          onSelect={(_e, selection) => {
            const selectedColumn = columns.find(c => c.name === selection)
            setFilterColumn(selectedColumn)
            adjustOperationList(selectedColumn)
            if (searchRef.current) {
              searchRef.current.value = ''
            }
            setBooleanOption(false)
            setColumnOpen(false)
          }}
          selected={filterColumn?.name || ''}
        >
          <SelectList>
            {filterableColumns.map(column => (
              <SelectOption key={column.id} value={column.name}>{column.name}</SelectOption>
            ))}
          </SelectList>
        </Select>
      </ToolbarItem>

      <ToolbarItem key='filter-operation'>
        <Select
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle isFullWidth isDisabled={filterableColumns.length == 0} role='menu' ref={toggleRef} onClick={() => setOperationOpen(prev => !prev)}>
              {filterOperation?.name}
            </MenuToggle>
          )}
          aria-label='Select Operation'
          isOpen={operationOpen}
          onOpenChange={setOperationOpen}
          onSelect={(_e, selection) => {
            const selectedOperation = operationOptions.find(o => o.name === selection)
            setFilterOperation(selectedOperation)
            setOperationOpen(false) }}
          selected={filterOperation?.name}
        >
          <SelectList>
            {visibleOperations?.map(operation => (
              <SelectOption key={operation.id} value={operation.name}>{operation.name}</SelectOption>
            ))}
          </SelectList>
        </Select>
      </ToolbarItem>

      <ToolbarItem key='filter-value'>
        {filterColumn && filterColumn.type !== ColumnType.BOOLEAN && (
            <div>
              <SearchInput
                aria-label='Filter'
                ref={searchRef}
                style={{ contain: 'strict', width: '14rem', height: 'calc(1lh + 2 * var(--pf-t--global--spacer--control--vertical--default))' }}
                value={filterColumn.id === filter.column && filter.input ? `${filter.input}` : ''}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addFilter()
                    }
                    if (e.key === 'Escape') {
                      if (searchRef.current) {
                        searchRef.current.value = ''
                      }
                    }
                  }
                }
                isDisabled={filterableColumns.length == 0}
              />
            </div>
        )}
        {filterColumn && filterColumn.type === ColumnType.BOOLEAN && (
            <Switch aria-label='Filter'
                    isChecked={booleanOption}
                    onChange={(_event, checked) => setBooleanOption(checked)} />
        )}
      </ToolbarItem>

      <Button onClick={addFilter} isDisabled={filterableColumns.length == 0} size='sm'>Add Filter</Button>
      <Button onClick={removeFilter} isDisabled={filterableColumns.length == 0} size='sm'>Remove Filter</Button>
      <Button onClick={clearAllFilters} isDisabled={filterableColumns.length == 0} size='sm' variant='secondary'>Clear All</Button>
      <Popover bodyContent={FilterHint}><OutlinedQuestionCircleIcon /></Popover>
    </>
  )
}
