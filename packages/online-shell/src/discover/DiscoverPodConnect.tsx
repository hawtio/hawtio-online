import React from 'react'
import { Button, Dropdown, DropdownItem, DropdownToggle } from '@patternfly/react-core'
import { DiscoverPod } from './globals'
import { Container } from '@hawtio/online-kubernetes-api'
import { mgmtService } from '@hawtio/online-management-api'
import * as discoverService from './discover-service'
import './Discover.css'

interface DiscoverPodConnectProps {
  pod: DiscoverPod
}

export const DiscoverPodConnect: React.FunctionComponent<DiscoverPodConnectProps> = (props: DiscoverPodConnectProps) => {

  const containers: Array<Container> = mgmtService.jolokiaContainers(props.pod.mPod)

  const [isOpen, setIsOpen] = React.useState(false)

  const onToggle = (isOpen: boolean) => {
    setIsOpen(isOpen)
  };

  const onFocus = () => {
    const element = document.getElementById('toggle-initial-selection')
    element?.focus()
  };

  const onSelect = () => {
    setIsOpen(false)
    onFocus()
  }

  const disableContainerButton = (): boolean => {
    return mgmtService.podStatus(props.pod.mPod) !== 'Running' || containers.length === 0
  }

  return (
    <React.Fragment>
      { containers.length <= 1 && (
        <Button
          variant='primary'
          component='a'
          className='connect-button'
          href={mgmtService.connectUrl(props.pod.mPod, containers[0])}
          target='_blank'
          isDisabled={disableContainerButton()} >
          Connect
        </Button>
      )}

      { containers.length > 1 && (
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
            containers.map((container, index) => {
              return (
                <DropdownItem
                  key={`${props.pod.uid}-container-${index}`}
                  component='a'
                  href={mgmtService.connectUrl(props.pod.mPod, container)}
                  target='_blank'
                >
                  {container.name}
                </DropdownItem>
              )
            })
          }
        />
      )}

    </React.Fragment>
  )
}
