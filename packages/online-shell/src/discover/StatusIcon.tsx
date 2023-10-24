import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  IconDefinition,
  faBan,
  faHourglass,
  faHourglassHalf,
  faRefresh,
  faCheck,
  faTimes,
  faQuestion,
} from '@fortawesome/free-solid-svg-icons'
import * as discoverService from './discover-service'
import { DiscoverPod } from './globals'
import './Discover.css'

interface StatusProps {
  pod: DiscoverPod
}

interface StatusIconDefinition {
  iconDef: IconDefinition
  spin?: boolean
  beat?: boolean
  beatFade?: boolean
  className?: string
}

export const StatusIcon: React.FunctionComponent<StatusProps> = (props: StatusProps) => {
  const statusIconDef = (): StatusIconDefinition => {
    switch (discoverService.getStatus(props.pod)) {
      case 'Cancelled':
        return { iconDef: faBan, className: 'text-muted' }
      case 'Complete':
        return { iconDef: faCheck, className: 'text-success' }
      case 'Completed':
        return { iconDef: faCheck, className: 'text-success' }
      case 'Active':
        return { iconDef: faRefresh }
      case 'Error':
        return { iconDef: faTimes, beat: true, className: 'text-danger' }
      case 'Failed':
        return { iconDef: faTimes, beat: true, className: 'text-danger' }
      case 'New':
        return { iconDef: faHourglass }
      case 'Pending':
        return { iconDef: faHourglassHalf, beatFade: true }
      case 'Ready':
        return { iconDef: faCheck, className: 'text-success' }
      case 'Running':
        return { iconDef: faRefresh, spin: true, className: 'running-state' }
      case 'Succeeded':
        return { iconDef: faCheck, className: 'text-success' }
      case 'Bound':
        return { iconDef: faCheck, className: 'text-success' }
      case 'Terminating':
        return { iconDef: faTimes, beatFade: true, className: 'text-danger' }
      case 'Terminated':
        return { iconDef: faTimes, beat: true, className: 'text-danger' }
      case 'Unknown':
        return { iconDef: faQuestion, beatFade: true, className: 'text-danger' }

      // Container Runtime States
      case 'Init Error':
        return { iconDef: faTimes, className: 'text-danger' }
      case 'ContainerCreating':
        return { iconDef: faHourglassHalf, beatFade: true }
      case 'CrashLoopBackOff':
      case 'ImagePullBackOff':
      case 'ImageInspectError':
      case 'ErrImagePull':
      case 'ErrImageNeverPull':
      case 'no matching container':
      case 'RegistryUnavailable':
      case 'RunContainerError':
      case 'KillContainerError':
      case 'VerifyNonRootError':
      case 'SetupNetworkError':
      case 'TeardownNetworkError':
      case 'DeadlineExceeded':
        return { iconDef: faTimes, beat: true, className: 'text-danger' }
      case 'PodInitializing':
        return { iconDef: faHourglassHalf, beatFade: true }
      default:
        return { iconDef: faQuestion }
    }
  }

  const defn = statusIconDef()

  return (
    <FontAwesomeIcon
      className={'state-icon ' + defn.className}
      icon={defn.iconDef}
      beat={defn.beat ? defn.beat : false}
      spin={defn.spin ? defn.spin : false}
      title={discoverService.getStatus(props.pod)}
    />
  )
}
