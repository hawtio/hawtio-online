import React, { useEffect } from 'react'
import {
  Alert,
  Card,
  CardBody,
  PageSection,
  PageSectionVariants,
  Title,
  Tabs,
  TabTitleText,
  Tab,
} from '@patternfly/react-core'
import { discoverService } from './discover-service'
import { DiscoverToolbar } from './DiscoverToolbar'
import { DiscoverContext, useDisplayItems } from './context'
import { DiscoverProjectContent } from './DiscoverProjectContent'
import { DiscoverLoadingPanel } from './DiscoverLoadingPanel'
import { DiscoverEmptyContent } from './DiscoverEmptyContent'

export const Discover: React.FunctionComponent = () => {
  const {
    error,
    isLoading,
    refreshing,
    setRefreshing,
    discoverProjects,
    setDiscoverProjects,
    filter,
    setFilter,
    podOrder,
    setPodOrder,
  } = useDisplayItems()
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
  }, [isLoading, error, discoverProjects, filter])

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
          filter,
          setFilter,
          podOrder,
          setPodOrder,
        }}
      >
        <DiscoverToolbar />

        {discoverProjects.length === 0 && <DiscoverEmptyContent />}

        {discoverProjects.length > 0 && (
          <Tabs activeKey={activeTabKey} onSelect={handleTabClick} isBox>
            {discoverProjects.map(discoverProject => (
              <Tab
                eventKey={discoverProject.name}
                title={<TabTitleText>{`${discoverProject.name} (${discoverProject.fullPodCount})`}</TabTitleText>}
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
