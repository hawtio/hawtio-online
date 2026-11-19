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
import React, { KeyboardEventHandler } from 'react'

import { eventService, jolokiaService } from '@hawtio/react'

import { ActiveSort, ArtemisTabId, ColumnType, Filter, FilterOperation, TableRowsData } from './types'
import { operationOptions } from './constants'

/**
 * Type of the loader function used by functions from artemisService
 */
type LoaderFunction = (page: number, perPage: number, sort: ActiveSort | undefined, filter: Filter | Filter[], defaultFilter?: Filter)
    => Promise<string>

/**
 * Generic loader method for all the tabs (connections, sessions, ...)
 *
 * @param tab
 * @param loaderFunction
 * @param page
 * @param perPage
 * @param sort
 * @param filters
 * @param defaultFilter
 */
export async function loadFilteredData(tab: ArtemisTabId, loaderFunction: LoaderFunction, page: number, perPage: number, sort: ActiveSort | undefined,
                                       filters: Filter[], defaultFilter?: Filter): Promise<TableRowsData> {
  let tabFilters: Filter | Filter[] = filters.filter(f => f.tab === tab)
  if (tabFilters.length == 1) {
    tabFilters = tabFilters[0]
  }
  const response = await loaderFunction(page, perPage, sort, tabFilters, defaultFilter).catch(error => {
    eventService.notify({ type: "warning", message: jolokiaService.errorMessage(error) })
    return JSON.stringify({ data: [], count: 0 })
  })
  try {
    return JSON.parse(response)
  } catch (e) {
    eventService.notify({ type: "warning", message: e?.toString() ?? 'Error parsing response JSON' })
    return { data: [], count: 0 }
  }
}

export function operationSymbol(operation: FilterOperation): string {
  return operationOptions.find(op => op.id === operation)?.symbol ?? '?'
}

export function availableOperations(type: ColumnType): FilterOperation[] {
  switch (type) {
    case ColumnType.NUMBER:
    case ColumnType.DATE:
      return ['EQUALS', 'NOT_EQUALS', 'LESS_THAN', 'GREATER_THAN']
    case ColumnType.BOOLEAN:
      return ['EQUALS', 'NOT_EQUALS']
    case ColumnType.STRING:
      return ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS']
    default:
      return []
  }
}

/**
 * A function that can be passed to Modal's onKeyDown to handle escape key closing the modal
 * @param fn a function to call with `false` parameter which should be a state for the dialog being opened
 */
export function closeWithEscape(fn: ((flag: boolean) => void)): KeyboardEventHandler<HTMLDivElement> {
  return (ev: React.KeyboardEvent) => {
    if (ev.key === 'Escape') {
      fn(false)
    }
  }
}
