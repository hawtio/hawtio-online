import React, { ReactNode, RefObject, useRef } from 'react'
import { Label, LabelGroup, ListItem, Title, Tooltip } from '@patternfly/react-core'
import { CubeIcon, UsersIcon, OutlinedHddIcon } from '@patternfly/react-icons'
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
  const nsLabelRef = useRef<HTMLDivElement>(null)
  const nodeLabelRef = useRef<HTMLDivElement>(null)
  const containerLabelRef = useRef<HTMLDivElement>(null)
  const routesLabelRef = useRef<HTMLDivElement>(null)

  const labelTooltip = (id: string, ref: RefObject<HTMLDivElement>, text: string): ReactNode => {
    return <Tooltip id={`${id}-tooltip`} content={<div>{text}</div>} triggerRef={ref} />
  }

  const nodeLabelText = (): ReactNode => {
    if (props.pod.mPod.spec?.nodeName) {
      return (
        <ConsoleLink type={ConsoleType.node} selector={props.pod.mPod.spec?.nodeName}>
          {props.pod.mPod.spec?.nodeName}
        </ConsoleLink>
      )
    }

    return props.pod.mPod.status?.hostIP
  }

  const containersLabelText = (): ReactNode => {
    const total = props.pod.mPod.spec?.containers.length || 0
    let ready = 0
    if (props.pod.mPod.status && props.pod.mPod.status.containerStatuses) {
      for (const status of props.pod.mPod.status.containerStatuses) {
        if (status.ready) ++ready
      }
    }

    return `${ready}/${total} ready`
  }

  const routesLabel = (): ReactNode => {
    if (!props.pod.mPod.management.status.managed) {
      return (
        <div id='routes-label' ref={routesLabelRef}>
          <Label color='grey' icon={<FontAwesomeIcon icon={faSpinner} spin />} className='pod-item-routes'>
            {`querying routes ...`}
          </Label>
          {labelTooltip(
            'routes-label',
            routesLabelRef,
            'Getting the number of camel routes registered in the pod application.',
          )}
        </div>
      )
    }

    const error = props.pod.mPod.management.status.error
    if (error) {
      return (
        <div id='routes-label' ref={nsLabelRef}>
          <Label color='red' icon={<CamelRouteIcon />} className='pod-item-routes'>
            {`?? routes`}
          </Label>
          {labelTooltip('routes-label', routesLabelRef, 'Cannot determine the number of camel routes due to an error.')}
        </div>
      )
    }

    const total = props.pod.mPod.management.camel.routes_count
    return (
      <div id='routes-label' ref={nsLabelRef}>
        <Label color='yellow' icon={<CamelRouteIcon />} className='pod-item-routes'>
          {`${total} route${total !== 1 ? 's' : ''}`}
        </Label>
        {labelTooltip('routes-label', routesLabelRef, 'The number of camel routes registered in the pod application.')}
      </div>
    )
  }

  return (
    <ListItem className='pod-item-list-item' icon={<StatusIcon pod={props.pod} />} key={'item-' + props.pod.uid}>
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
        <div id='namespace-label' ref={nsLabelRef}>
          <Label color='yellow' icon={<UsersIcon />} className='pod-item-home'>
            <ConsoleLink type={ConsoleType.namespace} namespace={props.pod.namespace}>
              {props.pod.namespace}
            </ConsoleLink>
          </Label>
          {labelTooltip('namespace-label', nsLabelRef, 'The namespace where the pod is deployed.')}
        </div>

        <div id='node-label' ref={nodeLabelRef}>
          <Label color='yellow' icon={<OutlinedHddIcon />} className='pod-item-node'>
            {nodeLabelText()}
          </Label>
          {labelTooltip('node-label', nodeLabelRef, 'The node, the pod is running on.')}
        </div>

        <div id='container-label' ref={containerLabelRef}>
          <Label color='yellow' icon={<CubeIcon />} className='pod-item-containers'>
            {containersLabelText()}
          </Label>
          {labelTooltip(
            'container-label',
            containerLabelRef,
            "The number of containers in the pod that have a status of 'ready'",
          )}
        </div>

        {routesLabel()}
      </LabelGroup>

      <div className='pod-item-connect-button'>
        <DiscoverPodConnect key={props.pod.uid} pod={props.pod} />
      </div>
    </ListItem>
  )
}
