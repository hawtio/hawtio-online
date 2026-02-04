import { CardBody, Form, FormGroup, Icon, NumberInput, Tooltip } from '@patternfly/react-core'
import React, { useEffect, useState } from 'react'
import { k8Service } from '@hawtio/online-kubernetes-api'
import { mgmtService } from '@hawtio/online-management-api'
import { HelpIcon } from '@patternfly/react-icons'

export const DiscoverPreferences: React.FunctionComponent = () => {
  const [namespaceLimit, setNamespaceLimit] = useState<number>(k8Service.namespaceLimit)
  const [jolokiaPolling, setJolokiaPolling] = useState<number>(mgmtService.jolokiaPollingInterval / 1000)

  useEffect(() => {
    if (k8Service.namespaceLimit === namespaceLimit) return

    // Delay slightly to allow the updates to complete
    setTimeout(() => (k8Service.namespaceLimit = namespaceLimit), 25)
  }, [namespaceLimit])

  useEffect(() => {
    const pollingMS = jolokiaPolling * 1000
    if (mgmtService.jolokiaPollingInterval === pollingMS) return

    // Delay slightly to allow the updates to complete
    setTimeout(() => (mgmtService.jolokiaPollingInterval = pollingMS), 25)
  }, [jolokiaPolling])

  const onNamespaceChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = (event.target as HTMLInputElement).value
    if (!value || value === '') return

    setNamespaceLimit(+value)
  }

  const onNamespaceIncrement = (value: 1 | -1) => {
    setNamespaceLimit(prev => {
      return prev + value
    })
  }

  const onJolokiaChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = (event.target as HTMLInputElement).value
    if (!value || value === '') return

    setJolokiaPolling(+value)
  }

  const onJolokiaIncrement = (value: 1 | -1) => {
    setJolokiaPolling(prev => {
      return prev + value
    })
  }

  const tooltip = (text: string) => (
    <Icon size='md'>
      <Tooltip content={text}>
        <HelpIcon />
      </Tooltip>
    </Icon>
  )

  return (
    <CardBody>
      <Form isHorizontal>
        <FormGroup
          label='Namespace Container Limit  '
          fieldId='namespace-limit-input'
          labelHelp={tooltip('Set how many containers are displayed in each namespace')}
        >
          <NumberInput
            id='namespace-limit-input'
            value={namespaceLimit}
            onMinus={() => onNamespaceIncrement(-1)}
            onPlus={() => onNamespaceIncrement(1)}
            onChange={onNamespaceChange}
            inputName='Namespace Limit'
            inputAriaLabel='namespace limit'
            unit='containers'
          />
        </FormGroup>

        <FormGroup
          label='Jolokia Polling Interval  '
          fieldId='jolokia-polling-input'
          labelHelp={tooltip('How frequently containers are polled for their jolokia status')}
        >
          <NumberInput
            value={jolokiaPolling}
            onMinus={() => onJolokiaIncrement(-1)}
            onPlus={() => onJolokiaIncrement(1)}
            onChange={onJolokiaChange}
            inputName='Jolokia Polling Interval'
            inputAriaLabel='jolokia polling interval'
            unit='seconds'
          />
        </FormGroup>
      </Form>
    </CardBody>
  )
}
