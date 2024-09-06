import React, { useRef, useState, ChangeEvent, MouseEvent, useContext, ReactNode } from 'react'
import {
  Button,
  MenuToggle,
  MenuToggleElement,
  SearchInput,
  Toolbar,
  ToolbarContent,
  ToolbarFilter,
  ToolbarGroup,
  ToolbarItem,
  SelectList,
  Select,
  SelectOption,
} from '@patternfly/react-core'

import { LongArrowAltUpIcon, LongArrowAltDownIcon } from '@patternfly/react-icons'
import { TypeFilterType, TypeFilter, typeFilterTypeValueOf } from '@hawtio/online-management-api'
import { DiscoverContext } from './context'
import { DiscoverProject } from './discover-project'

const defaultFilterInputPlaceholder = 'Filter by Name...'

interface SortOrder {
  id: string
  icon: ReactNode
}

const ascending: SortOrder = { id: 'ascending', icon: <LongArrowAltUpIcon /> }
const descending: SortOrder = { id: 'descending', icon: <LongArrowAltDownIcon /> }

interface SortMetaType {
  id: string
  order: SortOrder
}

type FilterMeta = {
  [name: string]: TypeFilterType
}

type SortMeta = {
  [name: string]: SortMetaType
}

const filterMeta: FilterMeta = {
  name: TypeFilterType.NAME,
  namespace: TypeFilterType.NAMESPACE,
}

const sortMeta: SortMeta = {
  name: {
    id: 'Name',
    order: ascending,
  },
  namespace: {
    id: 'Namespace',
    order: ascending,
  },
}

export const DiscoverToolbar: React.FunctionComponent = () => {
  const { discoverProjects, setDiscoverProjects, filters, setFilters } = useContext(DiscoverContext)
  // Ref for toggle of filter type Select control
  const filterTypeToggleRef = useRef<HTMLButtonElement | null>()

  // The type of filter to be created - chosen by the Select control
  const [filterType, setFilterType] = useState<TypeFilterType>(filterMeta.name)
  // Flag to determine whether the Filter Select control is open or closed
  const [isFilterTypeOpen, setIsFilterTypeOpen] = useState(false)
  // The text value of the filter to be created
  const [filterInput, setFilterInput] = useState<string>()
  // The placeholder of the filter input
  const [filterInputPlaceholder, setFilterInputPlaceholder] = useState<string>(defaultFilterInputPlaceholder)

  // Ref for toggle of sort type Select control
  useRef<HTMLButtonElement | null>()
  // The type of sort to be created - chosen by the Select control
  const [sortType, setSortType] = useState(sortMeta.name.id || '')
  // Flag to determine whether the Sort Select control is open or closed
  const [isSortTypeOpen, setIsSortTypeOpen] = useState(false)
  // Icon showing the sort
  const [sortOrder, setSortOrder] = useState<SortOrder>(sortMeta.name.order)

  const clearFilters = () => {
    const emptyFilters: TypeFilter[] = []
    setFilters(emptyFilters)
    setFilterInput('')
  }

  const onSelectFilterType = (_event?: ChangeEvent<Element> | MouseEvent<Element>, value?: string | number) => {
    if (!value) return

    const type = typeFilterTypeValueOf(`${value}`)
    setFilterType(type as TypeFilterType)
    setFilterInputPlaceholder('Filter by ' + value.toString() + ' ...')
    setIsFilterTypeOpen(false)
    filterTypeToggleRef?.current?.focus()
  }

  const filterChips = (): string[] => {
    const chips: string[] = []

    filters.forEach(filter => {
      Array.from(filter.values).map(v => chips.push(filter.type + ':' + v))
    })

    return chips
  }

  const createFilter = (value: string) => {
    setFilterInput(value)

    if (!filterType) return

    const newFilters = [...filters]

    const typeFilter = newFilters.filter(f => f.type === filterType)
    if (typeFilter.length === 0) {
      const filter: TypeFilter = {
        type: filterType,
        values: new Set([value]),
      }
      newFilters.push(filter)
    } else {
      typeFilter[0].values.add(value)
    }

    setFilters(newFilters)
  }

  const deleteFilter = (filterChip: string) => {
    const remaining = filters.filter(filter => {
      const [typeId, value] = filterChip.split(':')
      const type = typeFilterTypeValueOf(typeId)

      if (filter.type !== type) return true

      filter.values.delete(value)
      return filter.values.size > 0
    })

    setFilters(remaining)
  }

  const onSelectSortType = (_event?: MouseEvent<Element>, value?: string | number) => {
    if (!value) return

    // Updates the sort type either Name or Namespace
    setSortType(value as string)

    // Updates the sort order to whichever the sort type is set to
    setSortOrder(value === sortMeta.name.id ? sortMeta.name.order : sortMeta.namespace.order)
    setIsSortTypeOpen(false)
    filterTypeToggleRef?.current?.focus()
  }

  const sortItems = () => {
    const sortedProjects = [...discoverProjects]
    const newSortOrder = sortOrder === ascending ? descending : ascending

    switch (sortType) {
      case sortMeta.name.id:
        // Sorting via name
        sortMeta.name.order = newSortOrder
        sortedProjects.forEach(project => {
          project.sort(newSortOrder === ascending ? 1 : -1)
        })
        break
      case sortMeta.namespace.id:
        // Sorting via namespace
        sortMeta.namespace.order = newSortOrder
        sortedProjects.sort((ns1: DiscoverProject, ns2: DiscoverProject) => {
          let value = ns1.name.localeCompare(ns2.name)
          return newSortOrder === descending ? (value *= -1) : value
        })
    }

    setDiscoverProjects(sortedProjects)
    setSortOrder(newSortOrder)
  }

  return (
    <Toolbar id='discover-toolbar' clearAllFilters={clearFilters}>
      <ToolbarContent>
        <ToolbarGroup variant='filter-group'>
          <ToolbarItem>
            <Select
              id='select-filter-type'
              aria-label='select-filter-type'
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle ref={toggleRef} onClick={() => setIsFilterTypeOpen(!isFilterTypeOpen)}>
                  {filterType}
                </MenuToggle>
              )}
              onSelect={onSelectFilterType}
              selected={filterType}
              isOpen={isFilterTypeOpen}
              onOpenChange={setIsFilterTypeOpen}
            >
              <SelectList>
                <SelectOption key={filterMeta.name + '-0'} value={filterMeta.name}>
                  {filterMeta.name}
                </SelectOption>
                <SelectOption key={filterMeta.namespace + '-0'} value={filterMeta.namespace}>
                  {filterMeta.namespace}
                </SelectOption>
              </SelectList>
            </Select>
          </ToolbarItem>
          <ToolbarFilter
            chips={filterChips()}
            deleteChip={(_e, filter) => deleteFilter(filter as string)}
            deleteChipGroup={clearFilters}
            categoryName='Filters'
          >
            <SearchInput
              type='text'
              id='search-filter-input'
              aria-label='filter input value'
              placeholder={filterInputPlaceholder}
              value={filterInput}
              onChange={(_event, value) => setFilterInput(value)}
              onClear={() => setFilterInput('')}
              onSearch={(_event, value) => createFilter(value)}
            />
          </ToolbarFilter>
        </ToolbarGroup>
        <ToolbarGroup variant='icon-button-group'>
          <ToolbarItem>
            <Select
              // variant={SelectVariant.single}
              id='select-sort-type'
              aria-label='select-sort-type'
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle
                  disabled={Object.values(discoverProjects).length <= 1}
                  ref={toggleRef}
                  onClick={() => setIsSortTypeOpen(!isSortTypeOpen)}
                >
                  {sortType}
                </MenuToggle>
              )}
              selected={sortType}
              isOpen={isSortTypeOpen}
              onOpenChange={setIsSortTypeOpen}
              onSelect={onSelectSortType}
            >
              <SelectList>
                <SelectOption key={sortMeta.name.id + '-0'} value={sortMeta.name.id}>
                  {sortMeta.name.id}
                </SelectOption>
                <SelectOption key={sortMeta.namespace.id + '-0'} value={sortMeta.namespace.id}>
                  {sortMeta.namespace.id}
                </SelectOption>
              </SelectList>
            </Select>
          </ToolbarItem>
          <ToolbarItem>
            <Button
              variant='control'
              aria-label='Sort'
              onClick={sortItems}
              isDisabled={Object.values(discoverProjects).length <= 1}
            >
              {sortOrder.icon}
            </Button>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  )
}
