import React, { ReactNode, useEffect, useState } from 'react'
import { CubesIcon, ThIcon, UsersIcon } from '@patternfly/react-icons'
import {
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuList,
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core'
import { ManagedProject, MgmtActions, mgmtService } from '@hawtio/online-management-api'
import { ConsoleLink, ConsoleType } from '../console'

export const HeaderMenuDropDown: React.FunctionComponent = () => {
  const [projects, setProjects] = useState<ManagedProject[]>(Object.values(mgmtService.projects))
  const [isOpen, setIsOpen] = React.useState<boolean>(false)

  useEffect(() => {
    mgmtService.on(MgmtActions.UPDATED, () => {
      setProjects([...Object.values(mgmtService.projects)])
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

  const podEntries = (project: ManagedProject): ReactNode => {
    return Object.values(project.pods).map(pod => {
      const connNames = mgmtService.refreshConnections(pod)
      return connNames.map(connName => (
        <MenuList key={`header-menu-dropdown-pod-${connName}-menu-list`}>
          <MenuItem
            key={`header-menu-dropdown-pod-${connName}-menu-list-item`}
            itemId={`header-menu-dropdown-pod-${connName}`}
            component='button'
            onClick={() => mgmtService.connect(connName)}
            value={connName}
            icon={<CubesIcon aria-hidden />}
          >
            {connName}
          </MenuItem>
        </MenuList>
      ))
    })
  }

  const projectItems = (
    <DropdownGroup label='Projects' key='header-menu-dropdown-pod-group'>
      <DropdownList>
        {projects.map(project => {
          return (
            <DropdownItem
              key={`project-${project.name}`}
              itemId={`project-${project.name}`}
              icon={<UsersIcon aria-hidden />}
              direction='down'
              flyoutMenu={
                <Menu id={`project-${project.name}-pod-menu`} isScrollable>
                  <MenuGroup label='Containers' key='header-menu-dropdown-pod-group'>
                    {podEntries(project)}
                  </MenuGroup>
                </Menu>
              }
            >
              {project.name}
            </DropdownItem>
          )
        })}
      </DropdownList>
    </DropdownGroup>
  )

  const menu = (
    <Menu id='header-menu-dropdown-root-menu' containsFlyout>
      <MenuContent>
        <MenuList>
          <MenuItem itemId='open-cluster-console-item' description='Open the cluster console' component='button'>
            <ConsoleLink type={ConsoleType.console}>Cluster Console</ConsoleLink>
          </MenuItem>
          <Divider key='header-menu-dropdown-separator' />
          {projectItems}
        </MenuList>
      </MenuContent>
    </Menu>
  )

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
          isExpanded={isOpen}
        >
          <ThIcon />
        </MenuToggle>
      )}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    >
      {menu}
    </Dropdown>
  )
}
