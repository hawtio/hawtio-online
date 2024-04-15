import React from 'react'
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownToggle,
  NotificationBadge,
  NotificationBadgeVariant,
} from '@patternfly/react-core'
import { mgmtService } from '@hawtio/online-management-api'
import { DiscoverPod } from './globals'
import './Discover.css'

interface DiscoverPodConnectProps {
  pod: DiscoverPod
}

export const DiscoverPodConnect: React.FunctionComponent<DiscoverPodConnectProps> = (
  props: DiscoverPodConnectProps,
) => {
  const connectionNames: string[] = mgmtService.refreshConnections(props.pod.mPod)
  const mgmtError = props.pod.mPod?.getManagementError()

  const [isOpen, setIsOpen] = React.useState(false)

  const onConnectToggle = (isOpen: boolean) => {
    setIsOpen(isOpen)
  }

  const onFocus = () => {
    const element = document.getElementById('toggle-initial-selection')
    element?.focus()
  }

  const onSelect = () => {
    setIsOpen(false)
    onFocus()
  }

  const disableContainerButton = (): boolean => {
    return mgmtService.podStatus(props.pod.mPod) !== 'Running' ||
      (! props.pod.mPod.getManagement().status.managed) ||
      connectionNames.length === 0 || mgmtError !== null
  }

  const onConnect = (connectName: string) => {
    mgmtService.connect(connectName)
  }

  return (
    <React.Fragment>
      {mgmtError && (
        <NotificationBadge
          variant={NotificationBadgeVariant.attention}
          onClick={() => props.pod.mPod.errorNotify()}
          aria-label='Display Connect Error'
          className='pod-item-connect-error-badge'
        />
      )}

      {connectionNames.length <= 1 && (
        <Button
          variant='primary'
          component='button'
          className='connect-button'
          onClick={() => onConnect(connectionNames[0])}
          isDisabled={disableContainerButton()}
        >
          Connect
        </Button>
      )}

      {connectionNames.length > 1 && (
        <Dropdown
          className='connect-button-dropdown'
          onSelect={onSelect}
          toggle={
            <DropdownToggle id='toggle-initial-selection' toggleVariant='primary' onToggle={onConnectToggle}>
              Connect
            </DropdownToggle>
          }
          isOpen={isOpen}
          dropdownItems={connectionNames.map((connectionName, index) => {
            return (
              <DropdownItem
                key={`${props.pod.uid}-container-${index}`}
                component='button'
                isDisabled={disableContainerButton()}
                onClick={() => onConnect(connectionName)}
              >
                {connectionName.replace(`${props.pod.name}-`, '')}
              </DropdownItem>
            )
          })}
        />
      )}
    </React.Fragment>
  )
}
