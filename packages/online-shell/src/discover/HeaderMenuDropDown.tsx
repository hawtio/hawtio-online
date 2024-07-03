import React, { ReactNode, useEffect, useState } from 'react'
import { ThIcon } from '@patternfly/react-icons'
import { ConsoleLink, ConsoleType } from '../console'
import { ManagedPod, MgmtActions, mgmtService } from '@hawtio/online-management-api'
import {
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core'

export const HeaderMenuDropDown: React.FunctionComponent = () => {
  const [pods, setPods] = useState<ManagedPod[]>(mgmtService.pods)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    mgmtService.on(MgmtActions.UPDATED, () => {
      setPods([...mgmtService.pods])
    })
  }, [])

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
      <DropdownList>
        {pods.map(pod => {
          const connNames = mgmtService.refreshConnections(pod)
          return connNames.map(connName => (
            <DropdownItem
              key={`header-menu-dropdown-pod-${connName}`}
              component='button'
              onClick={() => mgmtService.connect(connName)}
              value={connName}
            >
              {connName}
            </DropdownItem>
          ))
        })}
      </DropdownList>
    </DropdownGroup>
  )

  const dropdownItems = [
    <DropdownList key='header-menu-dropdown-list'>
      <DropdownItem key='header-menu-dropdown-os-action' description='Open the cluster console' component='button'>
        <ConsoleLink type={ConsoleType.console}>Cluster Console</ConsoleLink>
      </DropdownItem>
    </DropdownList>,

    <Divider key='header-menu-dropdown-separator' />,
    podEntries(),
  ]

  return (
    <Dropdown
      className='online-header-toolbar-dropdown'
      onSelect={onSelect}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          id='online-header-toolbar-dropdown-toggle'
          className='online-header-toolbar-dropdown-toggle'
          variant={'plain'}
          ref={toggleRef}
          onClick={() => setIsOpen(!isOpen)}
        >
          <ThIcon />
        </MenuToggle>
      )}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    >
      {dropdownItems}
    </Dropdown>
  )
}
