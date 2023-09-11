import React from 'react'
import { ThIcon } from '@patternfly/react-icons'
import { Dropdown, DropdownItem, DropdownToggle } from '@patternfly/react-core'
import { ConsoleLink, ConsoleType } from '../console'

export const HeaderMenuDropDown: React.FunctionComponent = () => {
  const [isOpen, setIsOpen] = React.useState(false)

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

  const dropdownItems = [
    <DropdownItem
      key='header-menu-dropdown-console-action' component='a'
      description='Display the Integration Console'
      href='/integration/'>
      Console
    </DropdownItem>,
    <DropdownItem
      key='header-menu-dropdown-os-action'
      description='Open the OpenShift console'>
      <ConsoleLink type={ConsoleType.console}>
        OpenShift
      </ConsoleLink>
    </DropdownItem>,
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

//
// $scope.appLauncherItems = <Nav.AppLauncherItem[]>[
//   { label: 'Console', url: new URI().query('').path('/integration/').valueOf() }
// ];
//
// if (openShiftConsole.enabled) {
//   openShiftConsole.url.then(url => $scope.appLauncherItems.push(
//     { label: 'OpenShift', url: url }
//   ));
// }
