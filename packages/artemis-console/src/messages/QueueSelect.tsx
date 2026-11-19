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
import React, { FormEvent, useEffect, useRef, useState } from 'react'
import {
  Button,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  SelectOptionProps,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities
} from '@patternfly/react-core'
import { TimesIcon } from '@patternfly/react-icons/dist/esm/icons/times-icon'

import { eventService, jolokiaService } from '@hawtio/react'

import { artemisService } from '../artemis-service'
import { ActiveSort, Filter, SortDirection } from '../table/types'

export type QueueSelectInputProps = {
  selectQueue: Function
}

const activeSort: ActiveSort  = {
  column: 'name',
  order: SortDirection.ASCENDING
}

type QueueOption = SelectOptionProps & Record<string, any>
const NO_QUEUE_FOUND = 'No results found'

export const QueueSelectInput: React.FunctionComponent<QueueSelectInputProps> = props => {

  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState('')

  const [filterText, setFilterText] = useState<string>('')
  const [filterValue, setFilterValue] = useState<Filter>({
    tab: 'queues',
    column: 'name',
    operation: 'EQUALS',
    input: ''
  })
  const [queues, setQueues] = useState<QueueOption[]>([])
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  const textInputRef = useRef<HTMLInputElement>(undefined)

  useEffect(() => {
    const listData = async () => {
      // remember that the search/filter is case-sensitive
      // see: org.apache.activemq.artemis.core.management.impl.view.predicate.PredicateFilterPart#contains()
      const response = await artemisService.getQueues(1, 10, activeSort, filterValue)
          .catch(error => {
            eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(error) })
            return JSON.stringify({ data: [], count: 0 })
          })
      let found = false
      try {
        const json = JSON.parse(response)
        if ('data' in json) {
          const queues = json.data
          if (Array.isArray(queues) && queues.length > 0) {
            setQueues(queues.map(q => ({ ...q, value: q.name, children: q.name })))
            found = true
          }
        }
      } catch (e) {
        eventService.notify({ type: 'warning', message: e?.toString() ?? 'Error parsing response JSON' })
      }
      if (!found) {
        setQueues([{ name: NO_QUEUE_FOUND, value: NO_QUEUE_FOUND, children: NO_QUEUE_FOUND }])
      } else {
        if (!isOpen) {
          setIsOpen(true)
        }
      }
    }
    listData()
  }, [filterValue])

  const createItemId = (value: any) => `select-typeahead-${value}`

  const closeMenu = () => {
    setIsOpen(false)
    resetActiveAndFocusedItem()
  }

  const resetActiveAndFocusedItem = () => {
    setFocusedItemIndex(null)
    setActiveItemId(null)
  }

  const setActiveAndFocusedItem = (itemIndex: number) => {
    setFocusedItemIndex(itemIndex)
    const focusedItem = queues[itemIndex]
    setActiveItemId(createItemId(focusedItem.value))
  }

  const onToggle = () => {
    setIsOpen(!isOpen)
    if (isOpen) {
      textInputRef?.current?.focus()
    }
  }

  const handleSelectQueueChange = (_event: React.MouseEvent<Element, MouseEvent> | undefined, value: string | number | undefined) => {
    setIsOpen(false)
    const queueName: string = value as string
    setSelected(queueName)
    setFilterText(queueName)
    props.selectQueue(queueName)
  }

  const clearSelection = () => {
    setSelected('')
    setFilterText('')
    setFilterValue({
      tab: 'queues',
      column: 'name',
      operation: 'CONTAINS',
      input: ''
    })
    resetActiveAndFocusedItem()
    textInputRef?.current?.focus()
  }

  const onFilterClick = () => {
    if (!isOpen) {
      setIsOpen(true)
      textInputRef?.current?.focus()
    } else if (!filterText) {
      closeMenu()
    }
  }

  const customFilter = (_event: FormEvent<HTMLInputElement>, value: string) => {
    setFilterText(value)
    setFilterValue({
      tab: 'queues',
      column: 'name',
      operation: 'CONTAINS',
      input: value
    })
    resetActiveAndFocusedItem()
    if (value !== selected) {
      setSelected('')
    }
  }

  const onFilterKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const focusedItem = focusedItemIndex !== null ? queues?.[focusedItemIndex] : null

    switch (event.key) {
      case 'Enter':
        if (isOpen && focusedItem && !focusedItem.isAriaDisabled) {
          handleSelectQueueChange(undefined, focusedItem.name as string)
        }
        if (!isOpen) {
          setIsOpen(true)
        }
        break
      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault()
        handleMenuArrowKeys(event.key)
        break
    }
  }

  const handleMenuArrowKeys = (key: string) => {
    let indexToFocus = 0

    if (!isOpen) {
      setIsOpen(true)
    }

    if (queues.every((option) => option.isDisabled)) {
      return
    }

    if (key === 'ArrowUp') {
      // When no index is set or at the first index, focus to the last, otherwise decrement focus index
      if (focusedItemIndex === null || focusedItemIndex === 0) {
        // last
        indexToFocus = queues.length - 1
      } else {
        // previous
        indexToFocus = focusedItemIndex - 1
      }

      // Skip disabled options
      while (queues[indexToFocus].isDisabled) {
        indexToFocus--
        if (indexToFocus === -1) {
          indexToFocus = queues.length - 1
        }
      }
    }

    if (key === 'ArrowDown') {
      // When no index is set or at the last index, focus to the first, otherwise increment focus index
      if (focusedItemIndex === null || focusedItemIndex === queues.length - 1) {
        indexToFocus = 0
      } else {
        indexToFocus = focusedItemIndex + 1
      }

      // Skip disabled options
      while (queues[indexToFocus].isDisabled) {
        indexToFocus++
        if (indexToFocus === queues.length) {
          indexToFocus = 0
        }
      }
    }

    setActiveAndFocusedItem(indexToFocus)
  }

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
      <MenuToggle ref={toggleRef} variant='typeahead' isFullWidth aria-label='Select a Queue' onClick={onToggle} isExpanded={isOpen}>
        <TextInputGroup isPlain>
          <TextInputGroupMain
              value={filterText}
              onClick={onFilterClick}
              onChange={customFilter}
              onKeyDown={onFilterKeyDown}
              id='typeahead-select-input'
              autoComplete='off'
              innerRef={textInputRef}
              placeholder='Type Queue Name (case sensitive)'
              { ...(activeItemId && { 'aria-activedescendant': activeItemId }) }
              role='combobox'
              isExpanded={isOpen}
              aria-controls='select-queue'
          />
          <TextInputGroupUtilities { ...(!filterText ? { style: { display: 'none' } } : {}) }>
            <Button variant='plain' onClick={clearSelection} aria-label='Clear input value'>
              <TimesIcon aria-hidden/>
            </Button>
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
  )

  return (
    <Select id='create-typeahead-select' isOpen={isOpen} variant='typeahead' toggle={toggle} selected={selected}
            onOpenChange={(isOpen) => {
              !isOpen && closeMenu()
            }}
            onSelect={handleSelectQueueChange}>
      <SelectList id='select-queue'>
        {queues?.map((queue: Record<string, any>, index) => {
          if (queue.name === 'No results found') {
            return (<SelectOption disabled isAriaDisabled key={index} value={queue.name}>{queue.name}</SelectOption>)
          }
          return (
              <SelectOption key={index}
                            value={queue.name}
                            id={createItemId(queue.name)}
                            isFocused={focusedItemIndex === index}>
                {queue.name}
              </SelectOption>
          )
        })}
      </SelectList>
    </Select>
  )
}
