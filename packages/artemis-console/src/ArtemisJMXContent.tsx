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
import React, { useContext } from 'react'
import {
  PageGroup,
  PageSection,
  PageSectionVariants,
  Title,
  Content,
  EmptyState
} from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon'

import { ArtemisContext } from './context'
import { ArtemisJMXTabs } from './views/ArtemisJMXTabView'

export const ArtemisJmxContent: React.FunctionComponent = () => {

  const { selectedNode } = useContext(ArtemisContext)

  if (!selectedNode) {
    return  (
      <PageSection isFilled hasBodyWrapper={false}>
        <EmptyState headingLevel='h1' icon={CubesIcon} titleText='Select Artemis Node' variant='full' />
      </PageSection>
    )
  }

  return (
    <PageGroup id='artemis-jmx-content'>
      <PageSection id='jmx-content-header' variant={PageSectionVariants.default} hasBodyWrapper={false}>
        <Title headingLevel='h1'>{selectedNode.name}</Title>
        {selectedNode.objectName && <Content component='small'>{selectedNode.objectName}</Content>}
      </PageSection>
      <ArtemisJMXTabs />
    </PageGroup>
  )
}
