import React, { ReactNode } from 'react'
import { Label, LabelGroup, ListItem, Title } from '@patternfly/react-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowsRotate, faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import { DatabaseIcon, HomeIcon, OutlinedHddIcon} from '@patternfly/react-icons'
import { ConsoleLink, ConsoleType } from '../console'
import * as discoverService from './discover-service'
import { CamelRouteIcon } from './svg'
import './Discover.css'
import { Labels } from 'src/labels/Labels'

interface DiscoverPodItemProps {
  pod: discoverService.DisplayPod
}

export const DiscoverPodItem: React.FunctionComponent<DiscoverPodItemProps> = (props: DiscoverPodItemProps) => {

  const statusIcon = (): ReactNode => {
    if (!discoverService.isPodReady(props.pod))
      return <FontAwesomeIcon icon={faCircleExclamation} beat style={{color: "#a51d2d",}} />

    return (<FontAwesomeIcon icon={faArrowsRotate} spin style={{color: "#26a269",}} />)
  }

  const nodeLabel = (): ReactNode => {
    if (props.pod.target.spec?.nodeName) {
      return (
        <ConsoleLink type={ConsoleType.node} selector={props.pod.target.spec?.nodeName}>
          {props.pod.target.spec?.nodeName}
        </ConsoleLink>
      )
    }

    return props.pod.target.status?.hostIP
  }

  const containersLabel = (): ReactNode => {
    const total = props.pod.target.spec?.containers.length || 0
    return `${total} container${total !== 1 ? 's' : ''}`
  }

  const routesLabel = (): ReactNode => {
    console.log(props.pod.target)
    return 'number routes'
  }

  return (
    <ListItem icon={statusIcon()}>
      <div className='pod-item-name-with-labels'>
        <Title headingLevel="h3">
          <ConsoleLink type={ConsoleType.resource} selector={props.pod.name} namespace={props.pod.namespace} resource='pods'>
            {props.pod.name}
          </ConsoleLink>
        </Title>

        <Labels labels={props.pod.labels} namespace={props.pod.namespace} limit={3} clickable={true}/>
      </div>

      <LabelGroup>
        <Label color='gold' icon={<HomeIcon />} className='pod-item-home'>
          <ConsoleLink type={ConsoleType.namespace} namespace={props.pod.namespace}>
            {props.pod.namespace}
          </ConsoleLink>
        </Label>

        <Label color='gold' icon={<OutlinedHddIcon />} className='pod-item-node'>
          {nodeLabel()}
        </Label>

        <Label color='gold' icon={<DatabaseIcon />} className='pod-item-containers'>
          {containersLabel()}
        </Label>

        <Label color='gold' icon={<CamelRouteIcon />} className='pod-item-routes'>
          {routesLabel()}
        </Label>
      </LabelGroup>
    </ListItem>
  )
}
