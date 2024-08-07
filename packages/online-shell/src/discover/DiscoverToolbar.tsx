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
import { DiscoverContext } from './context'
import { DiscoverItem, TypeFilter } from './globals'

const defaultFilterInputPlaceholder = 'Filter by Name...'
const headers = ['Name', 'Namespace']

interface SortOrder {
  id: string
  icon: ReactNode
}

const ascending: SortOrder = { id: 'ascending', icon: <LongArrowAltUpIcon /> }
const descending: SortOrder = { id: 'descending', icon: <LongArrowAltDownIcon /> }

export const DiscoverToolbar: React.FunctionComponent = () => {
  const { discoverGroups, setDiscoverGroups, discoverPods, setDiscoverPods, filters, setFilters } =
    useContext(DiscoverContext)
  // Ref for toggle of filter type Select control
  const filterTypeToggleRef = useRef<HTMLButtonElement | null>()

  // The type of filter to be created - chosen by the Select control
  const [filterType, setFilterType] = useState(headers[0] ?? '')
  // Flag to determine whether the Filter Select control is open or closed
  const [isFilterTypeOpen, setIsFilterTypeOpen] = useState(false)
  // The text value of the filter to be created
  const [filterInput, setFilterInput] = useState<string>()
  // The placeholder of the filter input
  const [filterInputPlaceholder, setFilterInputPlaceholder] = useState<string>(defaultFilterInputPlaceholder)

  // Ref for toggle of sort type Select control
  useRef<HTMLButtonElement | null>()
  // The type of sort to be created - chosen by the Select control
  const [sortType, setSortType] = useState(headers[0] ?? '')
  // Flag to determine whether the Sort Select control is open or closed
  const [isSortTypeOpen, setIsSortTypeOpen] = useState(false)
  // Icon showing the sort
  const [sortOrder, setSortOrder] = useState<SortOrder>(ascending)

  const clearFilters = () => {
    const emptyFilters: TypeFilter[] = []
    setFilters(emptyFilters)
    setFilterInput('')
  }

  const onSelectFilterType = (_event?: ChangeEvent<Element> | MouseEvent<Element>, value?: string | number) => {
    if (!value) return

    setFilterType(value as string)
    setFilterInputPlaceholder('Filter by ' + value + ' ...')
    setIsFilterTypeOpen(false)
    filterTypeToggleRef?.current?.focus()
  }

  const filterChips = (): string[] => {
    const chips: string[] = []
    filters.forEach(filter => {
      chips.push(filter.type + ':' + filter.value)
    })

    return chips
  }

  const createFilter = (value: string) => {
    setFilterInput(value)

    if (!filterType) return

    const filter = {
      type: filterType.toLowerCase(),
      value: value,
    }

    if (filters.includes(filter)) return

    const newFilters = filters.concat(filter)
    setFilters(newFilters)
  }

  const deleteFilter = (filterChip: string) => {
    const remaining = filters.filter(filter => {
      return filterChip !== filter.type + ':' + filter.value
    })

    setFilters(remaining)
  }

  const onSelectSortType = (_event?: MouseEvent<Element>, value?: string | number) => {
    if (!value) return

    setSortType(value as string)
    setIsSortTypeOpen(false)
    filterTypeToggleRef?.current?.focus()
  }

  const compareDiscoverItems = (item1: DiscoverItem, item2: DiscoverItem) => {
    let value = 0

    type FilterKey = keyof typeof item1 // name or namespace

    const item1Prop = item1[sortType.toLowerCase() as FilterKey] as string
    const item2Prop = item2[sortType.toLowerCase() as FilterKey] as string

    value = item1Prop.localeCompare(item2Prop)
    if (sortOrder === ascending) value *= -1

    return value
  }

  const sortItems = () => {
    const sortedGroups = [...discoverGroups]
    const sortedPods = [...discoverPods]

    sortedGroups.sort(compareDiscoverItems)
    sortedPods.sort(compareDiscoverItems)

    setDiscoverGroups(sortedGroups)
    setDiscoverPods(sortedPods)

    if (sortOrder === ascending) setSortOrder(descending)
    else setSortOrder(ascending)
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
                {headers.map((name, index) => (
                  <SelectOption key={name + '-' + index} value={name}>
                    {name}
                  </SelectOption>
                ))}
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
                  disabled={discoverGroups.length + discoverPods.length <= 1}
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
              // direction={SelectDirection.down}
            >
              <SelectList>
                {headers.map((name, index) => (
                  <SelectOption key={name + '-' + index} value={name}>
                    {name}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </ToolbarItem>
          <ToolbarItem>
            <Button
              variant='control'
              aria-label='Sort'
              onClick={sortItems}
              isDisabled={discoverGroups.length + discoverPods.length <= 1}
            >
              {sortOrder.icon}
            </Button>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  )
}
