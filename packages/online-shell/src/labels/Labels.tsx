import React, { ReactNode, useState } from 'react'
import { Label, LabelGroup } from '@patternfly/react-core'
import { InfoCircleIcon } from '@patternfly/react-icons'
import { ConsoleLink, ConsoleType } from '../console'
import './Labels.css'

interface LabelsProps {
  namespace: string
  labels: Record<string, string>
  limit: number
  clickable?: boolean
}

export const Labels: React.FunctionComponent<LabelsProps> = (props: LabelsProps) => {
  const [limit] = useState(props.limit)

  if (!props.labels || Object.getOwnPropertyNames(props.labels).length === 0) {
    return null
  }

  const clickableLabel = (key: string, value: string): ReactNode => {
    return (
      <Label color='blue' className='k8s-clickable-label' key={key + '-' + value}>
        <ConsoleLink
          type={ConsoleType.search}
          namespace={props.namespace}
          kind='core~v1~Pod'
          selector={`${key}=${value}`}
        >
          <span className='k8s-label-key'>{key}</span>
          <span>=</span>
          <span className='k8s-label-value'>{value}</span>
        </ConsoleLink>
      </Label>
    )
  }

  const textLabel = (key: string, value: string): ReactNode => {
    return (
      <Label color='blue' icon={<InfoCircleIcon />} className='k8s-clickable-label' key={key + '-' + value}>
        <span className='k8s-label-key'>{key}</span>
        <span>=</span>
        <span className='k8s-label-value'>{value}</span>
      </Label>
    )
  }

  return (
    <LabelGroup numLabels={limit}>
      {Object.entries(props.labels).map(([key, value]) => {
        if (props.clickable) return clickableLabel(key, value)

        return textLabel(key, value)
      })}
    </LabelGroup>
  )
}
