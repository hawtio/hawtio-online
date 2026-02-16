import React, { ReactNode, useEffect, useState } from 'react'
import { CubesIcon, ThIcon, UsersIcon } from '@patternfly/react-icons'
import {
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  Menu,
  MenuContent, // Important: Needed for Flyouts
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
            onClick={() => mgmtService.connect(connName)}
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
              flyoutMenu={
                <Menu id={`project-${project.name}-pod-menu`} isScrollable>
                  <MenuContent>
                    <MenuGroup label='Containers' key='header-menu-dropdown-pod-group'>
                      {podEntries(project)}
                    </MenuGroup>
                  </MenuContent>
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

  const clusterItems = (
    <DropdownList>
      <DropdownItem itemId='open-cluster-console-item' description='Open the cluster console'>
        {/* Note: Ensure ConsoleLink doesn't render an <a> tag if DropdownItem renders a <button>,
            nested interactive controls are invalid HTML. PatternFly DropdownItem handles this well usually. */}
        <ConsoleLink type={ConsoleType.console}>Cluster Console</ConsoleLink>
      </DropdownItem>
      <Divider key='header-menu-dropdown-separator' component='li' />
    </DropdownList>
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
      popperProps={{ direction: 'down' }}
    >
      {/* Cluster Links */}
      {clusterItems}
      {/* Dynamic Project Items */}
      {projectItems}
    </Dropdown>
  )
}
