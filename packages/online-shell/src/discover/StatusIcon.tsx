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
import { discoverService } from './discover-service'
import { DiscoverPod } from './globals'
import './Discover.css'

interface StatusProps {
  pod: DiscoverPod
}

interface StatusIconDefinition {
  text: string
  iconDef: IconDefinition
  spin?: boolean
  beat?: boolean
  beatFade?: boolean
  className?: string
}

export const StatusIcon: React.FunctionComponent<StatusProps> = (props: StatusProps) => {
  const statusIconDef = (): StatusIconDefinition => {
    const status = discoverService.getStatus(props.pod)
    const statusDef: StatusIconDefinition = {
      text: status,
      iconDef: faQuestion,
    }

    switch (status) {
      case 'Cancelled':
        return { ...statusDef, iconDef: faBan, className: 'text-muted' }
      case 'Complete':
        return { ...statusDef, iconDef: faCheck, className: 'text-success' }
      case 'Completed':
        return { ...statusDef, iconDef: faCheck, className: 'text-success' }
      case 'Active':
        return { ...statusDef, iconDef: faRefresh }
      case 'Error':
        return { ...statusDef, iconDef: faTimes, beat: true, className: 'text-danger' }
      case 'Failed':
        return { ...statusDef, iconDef: faTimes, beat: true, className: 'text-danger' }
      case 'New':
        return { ...statusDef, iconDef: faHourglass }
      case 'Pending':
        return { ...statusDef, iconDef: faHourglassHalf, beatFade: true }
      case 'Ready':
        return { ...statusDef, iconDef: faCheck, className: 'text-success' }
      case 'Running':
        return { ...statusDef, iconDef: faRefresh, spin: true, className: 'running-state' }
      case 'Succeeded':
        return { ...statusDef, iconDef: faCheck, className: 'text-success' }
      case 'Bound':
        return { ...statusDef, iconDef: faCheck, className: 'text-success' }
      case 'Terminating':
        return { ...statusDef, iconDef: faTimes, beatFade: true, className: 'text-danger' }
      case 'Terminated':
        return { ...statusDef, iconDef: faTimes, beat: true, className: 'text-danger' }
      case 'Unknown':
        return { ...statusDef, iconDef: faQuestion, beatFade: true, className: 'text-danger' }

      // Container Runtime States
      case 'Init Error':
        return { ...statusDef, iconDef: faTimes, className: 'text-danger' }
      case 'ContainerCreating':
        return { ...statusDef, iconDef: faHourglassHalf, beatFade: true }
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
        return { ...statusDef, iconDef: faTimes, beat: true, className: 'text-danger' }
      case 'PodInitializing':
        return { ...statusDef, iconDef: faHourglassHalf, beatFade: true }
      default:
        return { ...statusDef, iconDef: faQuestion }
    }
  }

  const defn = statusIconDef()

  return (
    <span className='state-icon-wrapper'>
      <FontAwesomeIcon
        className={'state-icon ' + defn.className}
        icon={defn.iconDef}
        beat={defn.beat ? defn.beat : false}
        spin={defn.spin ? defn.spin : false}
        title={defn.text}
      />
      <span className='state-text'>{defn.text}</span>
    </span>
  )
}
