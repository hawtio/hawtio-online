import React from 'react'
import {
  Alert,
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  PageSection,
  PageSectionVariants,
  Title
} from '@patternfly/react-core'
import { CubesIcon} from '@patternfly/react-icons'
import { HawtioLoadingCard } from '@hawtio/react'
import * as discoverService from './discover-service'
import { DiscoverToolbar } from './DiscoverToolbar'
import { DiscoverContext, useDisplayItems } from './context'
import { DiscoverGroupList } from './DiscoverGroupList'

export const Discover: React.FunctionComponent = () => {

  const {
    error, isLoading, pods,
    displayGroups, setDisplayGroups,
    displayPods, setDisplayPods,
    filters, setFilters
  } = useDisplayItems()

  if (isLoading) {
    return <HawtioLoadingCard />
  }

  if (error) {
    return (
      <PageSection variant={PageSectionVariants.light}>
        <Card>
          <CardBody>
            <Alert variant='danger' title='Error occurred while loading'>
              {discoverService.unwrap(error)}
            </Alert>
          </CardBody>
        </Card>
      </PageSection>
    )
  }

  if (pods.length === 0) {
    return (
      <EmptyState>
        <EmptyStateIcon icon={CubesIcon} />
        <Title headingLevel="h1" size="lg">
          No Hawtio Containers
        </Title>
        <EmptyStateBody>
          There are no containers running with a port configured whose name is <code>jolokia</code>.
        </EmptyStateBody>
      </EmptyState>
    )
  }

  return (
    <PageSection variant={PageSectionVariants.light}>
      <Title headingLevel="h1">Pods</Title>

      <DiscoverContext.Provider
        value={
          {
            pods, displayGroups, setDisplayGroups,
            displayPods, setDisplayPods, filters, setFilters
          }
        }>

        <DiscoverToolbar />

        { displayGroups.length > 0 && ( <DiscoverGroupList groups={displayGroups} updateGroups={setDisplayGroups}/>)}

      </DiscoverContext.Provider>
    </PageSection>
  )
}
// { displayPods.length > 0 && ( <DiscoverPods groups={displayPods}/>)}
