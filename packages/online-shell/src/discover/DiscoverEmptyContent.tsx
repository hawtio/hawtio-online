import React, { useContext } from 'react'
import { EmptyState, EmptyStateBody, Panel, PanelMain, PanelMainBody } from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons'
import { DiscoverContext } from './context'
import { DiscoverLoadingPanel } from './DiscoverLoadingPanel'

export const DiscoverEmptyContent: React.FunctionComponent = () => {
  const { refreshing } = useContext(DiscoverContext)

  return (
    <React.Fragment>
      {refreshing && (
        <Panel>
          <PanelMain>
            <PanelMainBody>
              <DiscoverLoadingPanel compact={true} />
            </PanelMainBody>
          </PanelMain>
        </Panel>
      )}

      {!refreshing && (
        <EmptyState headingLevel='h1' icon={CubesIcon} titleText='No Hawtio Containers'>
          <EmptyStateBody>
            There are no containers running with a port configured whose name is <code>jolokia</code>.
          </EmptyStateBody>
        </EmptyState>
      )}
    </React.Fragment>
  )
}
