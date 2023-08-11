import React, { ReactNode } from 'react'
import { DisplayPod } from './discover-service'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowsRotate, faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import './Discover.css'
import { ListItem } from '@patternfly/react-core'
import * as discoverService from './discover-service'

interface DiscoverPodItemProps {
  pod: DisplayPod
}

export const DiscoverPodItem: React.FunctionComponent<DiscoverPodItemProps> = (props: DiscoverPodItemProps) => {

  const statusIcon = (): ReactNode => {
    if (!discoverService.isPodReady(props.pod))
      return <FontAwesomeIcon icon={faCircleExclamation} beat style={{color: "#a51d2d",}} />

    return (<FontAwesomeIcon icon={faArrowsRotate} spin style={{color: "#26a269",}} />)
  }

  return (
    <ListItem icon={statusIcon()}>
      {props.pod.name}
    </ListItem>
  )
}
