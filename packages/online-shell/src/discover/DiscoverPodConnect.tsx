import React from 'react'
import { Button, Dropdown, DropdownItem, DropdownToggle } from '@patternfly/react-core'
import { mgmtService } from '@hawtio/online-management-api'
import { DiscoverPod } from './globals'
import './Discover.css'

interface DiscoverPodConnectProps {
  pod: DiscoverPod
}

export const DiscoverPodConnect: React.FunctionComponent<DiscoverPodConnectProps> = (props: DiscoverPodConnectProps) => {

  const connectionNames: string[] = mgmtService.refreshConnections(props.pod.mPod)

  const [isOpen, setIsOpen] = React.useState(false)

  const onToggle = (isOpen: boolean) => {
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
    return mgmtService.podStatus(props.pod.mPod) !== 'Running' || connectionNames.length === 0
  }

  const onConnect = (connectName: string) => {
    mgmtService.connect(connectName)
  }

  return (
    <React.Fragment>
      { connectionNames.length <= 1 && (
        <Button
          variant='primary'
          component='button'
          className='connect-button'
          onClick={() => onConnect(connectionNames[0])}
          isDisabled={disableContainerButton()} >
          Connect
        </Button>
      )}

      { connectionNames.length > 1 && (
        <Dropdown
          className='connect-button-dropdown'
          onSelect={onSelect}
          toggle={
            <DropdownToggle
              id='toggle-initial-selection'
              toggleVariant='primary'
              onToggle={onToggle}
            >
              Connect
            </DropdownToggle>
          }
          isOpen={isOpen}
          dropdownItems={
            connectionNames.map((connectionName, index) => {
              return (
                <DropdownItem
                  key={`${props.pod.uid}-container-${index}`}
                  component='button'
                  onClick={() => onConnect(connectionName)}
                >
                  {connectionName.replace(`${props.pod.name}-`, '')}
                </DropdownItem>
              )
            })
          }
        />
      )}

    </React.Fragment>
  )
}
