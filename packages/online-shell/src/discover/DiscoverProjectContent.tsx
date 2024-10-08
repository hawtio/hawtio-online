import React, { useContext, useEffect } from 'react'
import {
  List,
  Pagination,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core'
import { k8Service } from '@hawtio/online-kubernetes-api'
import { mgmtService } from '@hawtio/online-management-api'
import { DiscoverGroupList } from './DiscoverGroupList'
import { DiscoverPodItem } from './DiscoverPodItem'
import { DiscoverLoadingPanel } from './DiscoverLoadingPanel'
import { DiscoverContext } from './context'
import { DiscoverProject } from './discover-project'

interface DiscoverProjectCntProps {
  project: DiscoverProject
}

export const DiscoverProjectContent: React.FunctionComponent<DiscoverProjectCntProps> = (
  props: DiscoverProjectCntProps,
) => {
  const { refreshing, setRefreshing } = useContext(DiscoverContext)
  const [page, setPage] = React.useState(1)

  useEffect(() => {
    if (refreshing) return

    setPage(prev => {
      const pagedPods = prev * k8Service.namespaceLimit
      const nextPagePods = props.project.fullPodCount + k8Service.namespaceLimit

      /*
       * If filtering has caused the fullPodCount to decrease
       * below the (page * limit) total then reset back to 1
       */
      return pagedPods > nextPagePods ? 1 : prev
    })
  }, [refreshing, props.project.fullPodCount])

  const firstPods = (page: number) => {
    setPage(page)
    setRefreshing(true)
    mgmtService.first(props.project.name)
  }

  const prevPods = (page: number) => {
    setPage(page)
    setRefreshing(true)
    mgmtService.previous(props.project.name)
  }

  const nextPods = (page: number) => {
    setPage(page)
    setRefreshing(true)
    mgmtService.next(props.project.name)
  }

  const lastPods = (page: number) => {
    setPage(page)
    setRefreshing(true)
    mgmtService.last(props.project.name)
  }

  const pagePods = (page: number) => {
    setPage(page)
    setRefreshing(true)
    mgmtService.page(page, props.project.name)
  }

  return (
    <Panel>
      <PanelHeader>
        <Toolbar id='pagination-toolbar-items' className='paginated-pods-toolbar-content' isSticky>
          <ToolbarContent>
            <ToolbarGroup variant='button-group' align={{ default: 'alignLeft' }}>
              <ToolbarItem>
                <Pagination
                  widgetId='pagination-toolbar'
                  isLastFullPageShown
                  itemCount={props.project.fullPodCount}
                  perPageOptions={[{ title: `${k8Service.namespaceLimit}`, value: k8Service.namespaceLimit }]}
                  perPage={k8Service.namespaceLimit}
                  page={page}
                  onSetPage={(_, page) => pagePods(page)}
                  onFirstClick={(_, page) => firstPods(page)}
                  onPreviousClick={(_, page) => prevPods(page)}
                  onNextClick={(_, page) => nextPods(page)}
                  onLastClick={(_, page) => lastPods(page)}
                />
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </PanelHeader>
      <PanelMain>
        <PanelMainBody>
          {refreshing && (
            <ToolbarGroup isOverflowContainer>
              <ToolbarItem widths={{ default: '100%' }}>
                <DiscoverLoadingPanel compact={true} />
              </ToolbarItem>
            </ToolbarGroup>
          )}

          {!refreshing && (
            <React.Fragment>
              {props.project.groups.length > 0 && <DiscoverGroupList groups={props.project.groups} />}

              {props.project.pods.length > 0 && (
                <List isBordered={true} iconSize='large'>
                  {props.project.pods.map(pod => {
                    return <DiscoverPodItem pod={pod} key={pod.uid} />
                  })}
                </List>
              )}
            </React.Fragment>
          )}
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
