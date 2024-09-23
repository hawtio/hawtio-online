import React, { useContext } from 'react'
import {
  EmptyState,
  EmptyStateHeader,
  EmptyStateIcon,
  EmptyStateBody,
  Panel,
  PanelMain,
  PanelMainBody,
} from '@patternfly/react-core'
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
    </React.Fragment>
  )
}
