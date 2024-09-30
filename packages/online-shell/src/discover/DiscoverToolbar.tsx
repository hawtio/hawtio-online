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
import { TypeFilterType, TypeFilter, typeFilterTypeValueOf, SortOrder } from '@hawtio/online-kubernetes-api'
import { mgmtService } from '@hawtio/online-management-api'
import { DiscoverContext } from './context'
import { DiscoverProject } from './discover-project'

const defaultFilterInputPlaceholder = 'Filter by Name...'

enum SortType {
  NAME = 'Name',
  NAMESPACE = 'Namespace',
}

function sortTypeValueOf(str: string): SortType | undefined {
  switch (str) {
    case SortType.NAME:
      return SortType.NAME
    case SortType.NAMESPACE:
      return SortType.NAMESPACE
    default:
      return undefined
  }
}

interface SortOrderIcon {
  type: SortOrder
  icon: ReactNode
}

const ascending: SortOrderIcon = { type: SortOrder.ASC, icon: <LongArrowAltUpIcon /> }
const descending: SortOrderIcon = { type: SortOrder.DESC, icon: <LongArrowAltDownIcon /> }

const filterMeta = {
  name: TypeFilterType.NAME,
  namespace: TypeFilterType.NAMESPACE,
}

const sortMeta = {
  name: {
    id: SortType.NAME,
    orderIcon: ascending,
  },
  namespace: {
    id: SortType.NAMESPACE,
    orderIcon: ascending,
  },
}

export const DiscoverToolbar: React.FunctionComponent = () => {
  const { discoverProjects, setDiscoverProjects, filter, setFilter, setRefreshing, setPodOrder } =
    useContext(DiscoverContext)
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
  const sortTypeToggleRef = useRef<HTMLButtonElement | null>()
  // The type of sort to be created - chosen by the Select control
  const [sortType, setSortType] = useState<SortType>(sortMeta.name.id || '')
  // Flag to determine whether the Sort Select control is open or closed
  const [isSortTypeOpen, setIsSortTypeOpen] = useState(false)
  // Icon showing the sort
  const [sortOrderIcon, setSortOrderIcon] = useState<SortOrderIcon>(sortMeta.name.orderIcon)

  const callMgmtFilter = (filter: TypeFilter) => {
    setRefreshing(true)
    setFilter(filter)
    mgmtService.filter(filter)
  }

  const clearFilters = () => {
    setFilterInput('')
    callMgmtFilter(new TypeFilter())
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

    filter.nsValues.map(v => chips.push(TypeFilterType.NAMESPACE + ':' + v))

    filter.nameValues.map(v => chips.push(TypeFilterType.NAME + ':' + v))

    return chips
  }

  const createFilter = (value: string) => {
    setFilterInput(value)

    if (!filterType) return

    const newTypeFilter = new TypeFilter(filter.nsValues, filter.nameValues)

    switch (filterType) {
      case TypeFilterType.NAME:
        newTypeFilter.addNameValue(value)
        break
      case TypeFilterType.NAMESPACE:
        newTypeFilter.addNSValue(value)
    }

    callMgmtFilter(newTypeFilter)
  }

  const deleteFilter = (filterChip: string) => {
    const [typeId, value] = filterChip.split(':')
    const filterType = typeFilterTypeValueOf(typeId)
    const newTypeFilter = new TypeFilter(filter.nsValues, filter.nameValues)

    switch (filterType) {
      case TypeFilterType.NAME:
        newTypeFilter.deleteNameValue(value)
        break
      case TypeFilterType.NAMESPACE:
        newTypeFilter.deleteNSValue(value)
    }

    callMgmtFilter(newTypeFilter)
  }

  const onSelectSortType = (_event?: MouseEvent<Element>, value?: string | number) => {
    if (!value) return

    // Updates the sort type either Name or Namespace
    const type = sortTypeValueOf(`${value}`)
    setSortType(type as SortType)

    // Updates the sort order to whichever the sort type is set to
    setSortOrderIcon(value === sortMeta.name.id ? sortMeta.name.orderIcon : sortMeta.namespace.orderIcon)
    setIsSortTypeOpen(false)
    sortTypeToggleRef?.current?.focus()
  }

  const isSortButtonEnabled = () => {
    switch (sortType) {
      case SortType.NAMESPACE:
        return Object.values(discoverProjects).length > 1
      case SortType.NAME:
        return discoverProjects.filter(discoverProject => discoverProject.fullPodCount > 1).length > 0
      default:
        return true // enable by default
    }
  }

  const sortItems = () => {
    const newSortOrderIcon = sortOrderIcon === ascending ? descending : ascending
    setSortOrderIcon(newSortOrderIcon)

    switch (sortType) {
      case SortType.NAMESPACE: {
        const sortedProjects = [...discoverProjects]
        /*
         * Sorting via namespace requires simply moving around the
         * tabs in the UI
         */
        sortMeta.namespace.orderIcon = newSortOrderIcon.type === SortOrder.ASC ? ascending : descending

        sortedProjects.sort((ns1: DiscoverProject, ns2: DiscoverProject) => {
          let value = ns1.name.localeCompare(ns2.name)
          return newSortOrderIcon === descending ? (value *= -1) : value
        })

        setDiscoverProjects(sortedProjects)
        break
      }
      case SortType.NAME:
        /*
         * Resorting the pod names required going back to k8 level
         * in order to correctly sort all pods and get back the right
         * set according to the paging limit
         */
        setPodOrder(newSortOrderIcon.type)
        setRefreshing(true)
        mgmtService.sort(newSortOrderIcon.type)
    }
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
        <ToolbarItem variant='separator' />
        <ToolbarGroup variant='icon-button-group'>
          <ToolbarItem>
            <Select
              id='select-sort-type'
              aria-label='select-sort-type'
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle ref={toggleRef} onClick={() => setIsSortTypeOpen(!isSortTypeOpen)}>
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
            <Button variant='control' aria-label='Sort' onClick={sortItems} isDisabled={!isSortButtonEnabled()}>
              {sortOrderIcon.icon}
            </Button>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  )
}
