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

// This module declares all the types related to `<ArtemisTable>` used across the components referred to
// from `<ArtemisTabs>` component.

// ---- types related to tabs and tables (rows, columns)

import React from 'react'

/**
 * Identifiers of the main tabs which are reflected in URL and used when cross-navigating between tabs
 */
export type ArtemisTabId =
    | 'status'
    | 'connections'
    | 'sessions'
    | 'producers'
    | 'consumers'
    | 'addresses'
    | 'queues'
    | 'broker-diagram'

/**
 * Type of the column for better filters and providing applicable operations
 */
export enum ColumnType {
  /** String can use equals|not_equals|contains|not_contains */
  STRING,
  /** Number can use equals|not_equals|less_than|greater_than */
  NUMBER,
  /** Boolean can use equals|not_equals */
  BOOLEAN,
  /** Date can use equals|not_equals|less_than|greater_than */
  DATE
}

/**
 * Type representing a single column to be displayed in `<ArtemisTable>`
 */
export type TableColumn = {
  /** Unique Identifier. Also used for sorting */
  id: string
  /** Type of the column to narrow applicable operations */
  type: ColumnType
  /** Name of the column to be shown in the header (`<Th>`) */
  name: string
  /** Whether the column is visible */
  visible: boolean
  /** Whether the column is sortable */
  sortable: boolean
  /** Whether the column can be filtered using the toolbar above the table */
  filterable: boolean
  /**
   * Each column may define a filter function. This function accepts current row and returns a `Filter` object
   * to be used at different ArtemisTabView tab. This definition is part of cross-tab navigation in Artemis plugin
   */
  filter?: (row: TableRow) => Filter,
  /**
   * A column may have a `link` function defined which may be used for example to display a dialog with row/cell
   * details. It's a more generic extension than what the table is doing with `filter` definition of the column.
   */
  link?: (row: TableRow) => void
  /** Column definition may provide a function which returns a custom React component for the value */
  component?: (value: any) => React.ReactNode
}

export type TableColumnState = Pick<TableColumn, 'id' | 'name' | 'visible'>

/**
 * A type of a single row to be displayed in `<ArtemisTable>`
 */
export type TableRow = Record<string, any>

/**
 * Type of the data returned for all the rows in the table from underlying service
 */
export type TableRowsData = {
  /** A list of rows */
  data: TableRow[]
  /** Number of rows in the data - after pagination */
  count: number
}

// ---- types related to filters and sorting

/**
 * Enumeration of possible sort directions
 */
export enum SortDirection {
  ASCENDING = 'asc',
  DESCENDING = 'desc'
}

/**
 * Filter instance for a single column
 */
export type Filter = {
  /** An Artemis tab identifier for which the column (ID) makes sense and the filter applies */
  tab: ArtemisTabId
  /** Column identifier (not name) */
  column?: string
  /** One of the available filtering operations */
  operation?: FilterOperation
  /** The argument of the filtering operation */
  input?: string | number | boolean
}

/**
 * Type for global configuration of filters and sorting. Each table (connections, sessions, ...) have own columns,
 * thus also a set of applicable filters. Keeping them in a single object makes it easy to export/import a set or
 * keep them in `localStorage`.
 */
export type TableFilters = {
  /** An array of filters to apply when doing server-side search using JMX for particular tab (like connections). */
  searchFilters: Filter[]
  /** Sorting configuration per tab */
  sorting: Partial<Record<ArtemisTabId, ActiveSort>>
}

export const EMPTY_TABLE_FILTERS: TableFilters = {
  searchFilters: [],
  sorting: {}
}

/**
 * Information about which column is sorted and in which direction at current table
 */
export type ActiveSort = {
  /** Sorting column (ID) - used at given tab only if it's available */
  column?: string
  /** Sorting order */
  order: SortDirection
}

/**
 * Possible filtering operations.
 * See `org.apache.activemq.artemis.core.management.impl.view.predicate.ActiveMQFilterPredicate.Operation`.
 * Not all the operations are valid for given data type
 */
export type FilterOperation =
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'LESS_THAN'
  | 'GREATER_THAN'

/**
 * Scope of filter removal - singe filter or all filters for a given tab
 */
export enum RemoveFilterScope {
  SINGLE = 1,
  ALL = 2
}
