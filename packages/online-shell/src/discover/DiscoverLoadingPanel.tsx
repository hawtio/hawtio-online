import React from 'react'
import { Panel, PanelHeader, PanelMain, PanelMainBody } from '@patternfly/react-core'
import { HawtioLoadingCard } from '@hawtio/react'

interface DiscoverLoadingPanelProps {
  compact?: boolean
}

export const DiscoverLoadingPanel: React.FunctionComponent<DiscoverLoadingPanelProps> = (
  props: DiscoverLoadingPanelProps,
) => {
  let classNames = 'discover-loading'
  if (props.compact) classNames = classNames + ' discover-loading-compact'

  return (
    <Panel className={classNames}>
      <PanelHeader>Waiting for Hawtio Containers ...</PanelHeader>
      <PanelMain>
        <PanelMainBody>
          <HawtioLoadingCard />
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
