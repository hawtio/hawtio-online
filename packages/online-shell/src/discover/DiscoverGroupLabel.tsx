import React from 'react'
import { Title } from '@patternfly/react-core'
import { DisplayGroup } from './discover-service'
import { ConsoleLink } from './ConsoleLink'
import './Discover.css'

interface DiscoverGroupLabelProps {
  group: DisplayGroup
}

export const DiscoverGroupLabel: React.FunctionComponent<DiscoverGroupLabelProps> = (props: DiscoverGroupLabelProps) => {

  const configContent = (): React.ReactNode => {
    return (
      <React.Fragment>
        <ConsoleLink name={props.group.config as string} namespace={props.group.namespace} resources='dc'>
          {props.group.config}
        </ConsoleLink>

        <span>, </span>

        <ConsoleLink name={props.group.name as string} namespace={props.group.namespace} resources='rc'>
          #{props.group.version}
        </ConsoleLink>
      </React.Fragment>
    )
  }

  const statefulSetContent = () => {
    return (
      <ConsoleLink name={props.group.name as string} namespace={props.group.namespace} resources='sts'>
        {props.group.name}
      </ConsoleLink>
    )
  }

  const deploymentContent = () => {
    return (
      <ConsoleLink name={props.group.name as string} namespace={props.group.namespace} resources='rs'>
        {props.group.name}
      </ConsoleLink>
    )
  }

  let title
  let content: React.ReactNode
  if (props.group.config) {
    title = 'Deployment Config'
    content = configContent()
  } else if (props.group.statefulset) {
    title = 'Stateful Set'
    content = statefulSetContent()
  } else {
    title = 'Deployment' // Neither config nor statefulset
    content = deploymentContent()
  }

  return (
    <React.Fragment>
      <Title className='discover-group-label' headingLevel='h3'>{title}</Title>
      {content}
    </React.Fragment>
  )
}
