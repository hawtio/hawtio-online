import React from 'react'
import { Button, Dropdown, DropdownItem, DropdownToggle } from '@patternfly/react-core'
import { Connection, Connections, connectService } from '@hawtio/react'
import { Container } from '@hawtio/online-kubernetes-api'
import { mgmtService } from '@hawtio/online-management-api'
import { DiscoverPod } from './globals'
import './Discover.css'

interface DiscoverPodConnectProps {
  pod: DiscoverPod
}

export const DiscoverPodConnect: React.FunctionComponent<DiscoverPodConnectProps> = (props: DiscoverPodConnectProps) => {

  const containers: Array<Container> = mgmtService.jolokiaContainers(props.pod.mPod)
  const connections: Connections = connectService.loadConnections()

  const connectionKeyName = (container: Container) => {
    return `${props.pod.name}-${container.name}`
  }

  for (const container of containers) {
    const url: URL = mgmtService.connectToUrl(props.pod.mPod, container)
    const connection: Connection = {
      name: connectionKeyName(container),
      jolokiaUrl: url.toString(),

      // Not necessary but included to satisfy rules of Connection object
      scheme: url.protocol,
      host: url.hostname,
      port: Number(url.port),
      path: url.pathname
    }
    connections[connectionKeyName(container)] = connection
  }

  connectService.saveConnections(connections)

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

  const onConnect = (container: Container) => {
    connectService.connect(connections[connectionKeyName(container)])
  }

  return (
    <React.Fragment>
      { containers.length <= 1 && (
        <Button
          variant='primary'
          component='button'
          className='connect-button'
          onClick={() => onConnect(containers[0])}
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
                  component='button'
                  onClick={() => onConnect(container)}
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
