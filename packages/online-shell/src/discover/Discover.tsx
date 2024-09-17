import React, { useEffect } from 'react'
import {
  Alert,
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  PageSection,
  PageSectionVariants,
  Title,
  EmptyStateHeader,
  Tabs,
  TabTitleText,
  Tab,
} from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons'
import { discoverService } from './discover-service'
import { DiscoverToolbar } from './DiscoverToolbar'
import { DiscoverContext, useDisplayItems } from './context'
import { DiscoverProjectContent } from './DiscoverProjectContent'
import { DiscoverLoadingPanel } from './DiscoverLoadingPanel'

export const Discover: React.FunctionComponent = () => {
  const { error, isLoading, refreshing, setRefreshing, discoverProjects, setDiscoverProjects, filters, setFilters } =
    useDisplayItems()
  const [activeTabKey, setActiveTabKey] = React.useState<string>('')

  const handleTabClick = (
    event: React.MouseEvent<unknown> | React.KeyboardEvent | MouseEvent,
    tabIndex: string | number,
  ) => {
    setActiveTabKey(`${tabIndex}`)
  }

  useEffect(() => {
    if (isLoading || error || discoverProjects.length === 0) return

    setActiveTabKey(activeKey => {
      if (activeKey.length === 0) return discoverProjects[0].name

      const projects = discoverProjects.filter(p => p.name === activeKey)
      if (projects.length === 0) return discoverProjects[0].name // active key no longer in projects

      return activeKey
    })
  }, [isLoading, error, discoverProjects, filters])

  if (isLoading) {
    return (
      <PageSection variant={PageSectionVariants.light}>
        <DiscoverLoadingPanel />
      </PageSection>
    )
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

  return (
    <PageSection variant={PageSectionVariants.light}>
      <Title headingLevel='h1'>Hawtio Containers</Title>

      <DiscoverContext.Provider
        value={{
          refreshing,
          setRefreshing,
          discoverProjects,
          setDiscoverProjects,
          filters,
          setFilters,
        }}
      >
        <DiscoverToolbar />

        {discoverProjects.length === 0 && (
          <EmptyState>
            <EmptyStateHeader
              titleText='No Hawtio Containers'
              icon={<EmptyStateIcon icon={CubesIcon} />}
              headingLevel='h1'
            />
            <EmptyStateBody>
              There are no containers running with a port configured whose name is <code>jolokia</code>.
            </EmptyStateBody>
          </EmptyState>
        )}

        {discoverProjects.length > 0 && (
          <Tabs activeKey={activeTabKey} onSelect={handleTabClick} isBox>
            {discoverProjects.map(discoverProject => (
              <Tab
                eventKey={discoverProject.name}
                title={<TabTitleText>{`${discoverProject.name} (${discoverProject.podsTotal})`}</TabTitleText>}
                key={`discover-project-${discoverProject.name}`}
              >
                <DiscoverProjectContent project={discoverProject} />
              </Tab>
            ))}
          </Tabs>
        )}
      </DiscoverContext.Provider>
    </PageSection>
  )
}
