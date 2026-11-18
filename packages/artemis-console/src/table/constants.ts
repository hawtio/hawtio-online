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

// This module declares some constant values and arrays used in relation to
// ArtemisTable and related components

import { FilterOperation } from './types'

export const operationOptions: { id: FilterOperation, name: string, symbol: string }[] = [
  { id: 'CONTAINS', name: 'Contains', symbol: '~' },
  { id: 'NOT_CONTAINS', name: 'Does not Contain', symbol: '!~' },
  { id: 'EQUALS', name: 'Equals', symbol: '=' },
  { id: 'NOT_EQUALS', name: 'Not Equals', symbol: '!=' },
  { id: 'GREATER_THAN', name: 'Greater Than', symbol: '>' },
  { id: 'LESS_THAN', name: 'Less Than', symbol: '<' }
]

export const pageSizeOptions: { title: string, value: number }[] = [
  { title: '10 per page', value: 10 },
  { title: '20 per page', value: 20 },
  { title: '50 per page', value: 50 },
  { title: '100 per page', value: 100 },
  { title: 'All items', value: -1 },
]

export const defaultRowsPerPage = 10
