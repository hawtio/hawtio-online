import React from 'react'
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
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
  const mgmtError = props.pod.mPod?.mgmtError

  const [isOpen, setIsOpen] = React.useState(false)

  const onFocus = () => {
    const element = document.getElementById('toggle-initial-selection')
    element?.focus()
  }

  const onSelect = () => {
    setIsOpen(false)
    onFocus()
  }

  const disableContainerButton = (): boolean => {
    return (
      mgmtService.podStatus(props.pod.mPod) !== 'Running' ||
      !props.pod.mPod.management.status.managed ||
      connectionNames.length === 0 ||
      mgmtError !== null
    )
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
          onOpenChange={setIsOpen}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle id='toggle-initial-selection' ref={toggleRef} onClick={() => setIsOpen(!isOpen)}>
              Connect
            </MenuToggle>
          )}
          isOpen={isOpen}
        >
          <DropdownList>
            {connectionNames.map((connectionName, index) => {
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
            })}{' '}
          </DropdownList>
        </Dropdown>
      )}
    </React.Fragment>
  )
}
