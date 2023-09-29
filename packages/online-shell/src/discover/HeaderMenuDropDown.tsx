import React, { ReactNode, useEffect, useState } from 'react'
import { ThIcon } from '@patternfly/react-icons'
import { Dropdown, DropdownGroup, DropdownItem, DropdownSeparator, DropdownToggle } from '@patternfly/react-core'
import { ConsoleLink, ConsoleType } from '../console'
import { ManagedPod, MgmtActions, mgmtService } from '@hawtio/online-management-api'

export const HeaderMenuDropDown: React.FunctionComponent = () => {

  const [pods, setPods] = useState<ManagedPod[]>(mgmtService.pods)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    mgmtService.on(MgmtActions.UPDATED, () => {
      setPods([...mgmtService.pods])
    })
  }, [])

  const onToggle = (isOpen: boolean) => {
    setIsOpen(isOpen)
  }

  const onFocus = () => {
    const element = document.getElementById('toggle-basic')
    element?.focus()
  }

  const onSelect = () => {
    setIsOpen(false)
    onFocus()
  }

  const podEntries = (): ReactNode => (
    <DropdownGroup label='Containers' key='header-menu-dropdown-pod-group'>
    {
      pods.map(pod => {
        const connNames = mgmtService.refreshConnections(pod)
        return connNames.map(connName =>
          (
            <DropdownItem
              key={`header-menu-dropdown-pod-${connName}`}
              component='button'
              onClick={() => mgmtService.connect(connName)}
            >
              {connName}
            </DropdownItem>
          )
        )
      })
    }
    </DropdownGroup>
  )

  const dropdownItems = [
    <DropdownItem
      key='header-menu-dropdown-os-action'
      description='Open the cluster console'
      component='button'>
      <ConsoleLink type={ConsoleType.console}>
        Cluster Console
      </ConsoleLink>
    </DropdownItem>,
    <DropdownSeparator key='header-menu-dropdown-separator'/>,
    podEntries()
  ]

  return (
    <Dropdown
      className='online-header-toolbar-dropdown'
      onSelect={onSelect}
      toggle={
        <DropdownToggle
          id='online-header-toolbar-dropdown-toggle'
          className='online-header-toolbar-dropdown-toggle'
          onToggle={onToggle} isPlain>
          <ThIcon/>
        </DropdownToggle>
      }
      isOpen={isOpen}
      dropdownItems={dropdownItems}
    />
  )
}
