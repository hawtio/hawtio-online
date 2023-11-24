import React, { ReactNode } from 'react'
import { Label, LabelGroup, ListItem, Title } from '@patternfly/react-core'
import { DatabaseIcon, HomeIcon, OutlinedHddIcon } from '@patternfly/react-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { ConsoleLink, ConsoleType } from '../console'
import { Labels } from '../labels'
import { DiscoverPod } from './globals'
import { CamelRouteIcon } from './svg'
import { StatusIcon } from './StatusIcon'
import { DiscoverPodConnect } from './DiscoverPodConnect'
import './Discover.css'

interface DiscoverPodItemProps {
  pod: DiscoverPod
}

export const DiscoverPodItem: React.FunctionComponent<DiscoverPodItemProps> = (props: DiscoverPodItemProps) => {
  const nodeLabel = (): ReactNode => {
    if (props.pod.mPod.spec?.nodeName) {
      return (
        <ConsoleLink type={ConsoleType.node} selector={props.pod.mPod.spec?.nodeName}>
          {props.pod.mPod.spec?.nodeName}
        </ConsoleLink>
      )
    }

    return props.pod.mPod.status?.hostIP
  }

  const containersLabel = (): ReactNode => {
    const total = props.pod.mPod.spec?.containers.length || 0
    return `${total} container${total !== 1 ? 's' : ''}`
  }

  const routesLabel = (): ReactNode => {
    if (!props.pod.mPod.management.status.managed) {
      return (
        <Label color='grey' icon={<FontAwesomeIcon icon={faSpinner} spin />} className='pod-item-routes'>
          {`querying routes ...`}
        </Label>
      )
    }

    const total = props.pod.mPod.management.camel.routes_count
    return (
      <Label color='gold' icon={<CamelRouteIcon />} className='pod-item-routes'>
        {`${total} route${total !== 1 ? 's' : ''}`}
      </Label>
    )
  }

  return (
    <ListItem icon={<StatusIcon pod={props.pod} />} key={'item-' + props.pod.uid}>
      <div className='pod-item-name-with-labels'>
        <Title headingLevel='h3'>
          <ConsoleLink
            type={ConsoleType.resource}
            selector={props.pod.name}
            namespace={props.pod.namespace}
            resource='pods'
          >
            {props.pod.name}
          </ConsoleLink>
        </Title>

        <Labels labels={props.pod.labels} namespace={props.pod.namespace} limit={3} clickable={true} />
      </div>

      <LabelGroup numLabels={4} className='pod-item-label-group'>
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

        {routesLabel()}
      </LabelGroup>

      <div className='pod-item-connect-button'>
        <DiscoverPodConnect key={props.pod.uid} pod={props.pod} />
      </div>
    </ListItem>
  )
}
