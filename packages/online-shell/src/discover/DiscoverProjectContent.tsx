import React, { useContext } from 'react'
import {
  Button,
  List,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core'
import { DiscoverProject } from './discover-project'
import { DiscoverGroupList } from './DiscoverGroupList'
import { DiscoverPodItem } from './DiscoverPodItem'
import { mgmtService } from '@hawtio/online-management-api'
import { DiscoverLoadingPanel } from './DiscoverLoadingPanel'
import { DiscoverContext } from './context'

interface DiscoverProjectCntProps {
  project: DiscoverProject
}

export const DiscoverProjectContent: React.FunctionComponent<DiscoverProjectCntProps> = (
  props: DiscoverProjectCntProps,
) => {
  const { refreshing, setRefreshing } = useContext(DiscoverContext)

  const hasPrevPods = (): boolean => {
    return mgmtService.hasPrevious(props.project.name)
  }

  const prevPods = () => {
    setRefreshing(true)
    mgmtService.previous(props.project.name)
  }

  const hasNextPods = (): boolean => {
    return mgmtService.hasNext(props.project.name)
  }

  const nextPods = () => {
    setRefreshing(true)
    mgmtService.next(props.project.name)
  }

  return (
    <Panel>
      <PanelHeader>
        <Toolbar id='pagination-toolbar-items' className='paginated-pods-toolbar-content' isSticky>
          <ToolbarContent>
            <ToolbarGroup variant='button-group' align={{ default: 'alignLeft' }}>
              <ToolbarItem>
                <Button variant='control' onClick={() => prevPods()} isDisabled={!hasPrevPods()}>
                  &lt;&lt; Previous
                </Button>
              </ToolbarItem>
            </ToolbarGroup>

            {refreshing && (
              <ToolbarGroup isOverflowContainer>
                <ToolbarItem widths={{ default: '100%' }}>
                  <DiscoverLoadingPanel compact={true} />
                </ToolbarItem>
              </ToolbarGroup>
            )}

            <ToolbarGroup variant='button-group' align={{ default: 'alignRight' }}>
              <ToolbarItem>
                <Button variant='control' onClick={() => nextPods()} isDisabled={!hasNextPods()}>
                  Next &gt;&gt;
                </Button>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </PanelHeader>
      <PanelMain>
        <PanelMainBody>
          {props.project.groups.length > 0 && <DiscoverGroupList groups={props.project.groups} />}

          {props.project.pods.length > 0 && (
            <List isBordered={true} iconSize='large'>
              {props.project.pods.map(pod => {
                return <DiscoverPodItem pod={pod} key={pod.uid} />
              })}
            </List>
          )}
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
