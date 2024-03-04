import React from 'react'
import {
  Alert,
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  List,
  PageSection,
  PageSectionVariants,
  Title,
  Spinner,
  CardTitle,
  Skeleton,
} from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons'
import * as discoverService from './discover-service'
import { DiscoverToolbar } from './DiscoverToolbar'
import { DiscoverContext, useDisplayItems } from './context'
import { DiscoverGroupList } from './DiscoverGroupList'
import { DiscoverPodItem } from './DiscoverPodItem'

export const Discover: React.FunctionComponent = () => {
  const { error, isLoading, discoverGroups, setDiscoverGroups, discoverPods, setDiscoverPods, filters, setFilters } =
    useDisplayItems()

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

  if (discoverGroups.length + discoverPods.length === 0 && !isLoading) {
    return (
      <PageSection variant={PageSectionVariants.light}>
        <DiscoverToolbar />
        <EmptyState>
          <EmptyStateIcon icon={CubesIcon} />
          <Title headingLevel='h1' size='lg'>
            No Hawtio Containers
          </Title>
          <EmptyStateBody>
            There are no containers running with a port configured whose name is <code>jolokia</code>.
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    )
  }

  return (
    <PageSection variant={PageSectionVariants.light}>
      <Title headingLevel='h1'>Pods</Title>

      <DiscoverContext.Provider
        value={{
          discoverGroups,
          setDiscoverGroups,
          discoverPods,
          setDiscoverPods,
          filters,
          setFilters,
        }}
      >
        <DiscoverToolbar />

        {isLoading && (
          <Card>
            <div style={{ justifyContent: 'center', display: 'flex' }}>
              <CardTitle>
                <Spinner size='sm' /> Loading {(discoverGroups.length > 0 || discoverPods.length > 0) && 'more'} pods...
              </CardTitle>
              <CardBody>
                <Skeleton width='50%' /> <br />
                <Skeleton width='50%' /> <br />
              </CardBody>
            </div>
          </Card>
        )}

        {discoverGroups.length > 0 && <DiscoverGroupList />}

        {discoverPods.length > 0 && (
          <List isBordered={true} iconSize='large'>
            {discoverPods.map(pod => {
              return <DiscoverPodItem pod={pod} key={pod.uid} />
            })}
          </List>
        )}
      </DiscoverContext.Provider>
    </PageSection>
  )
}
