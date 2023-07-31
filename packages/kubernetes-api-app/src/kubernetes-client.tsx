import { k8Loaded, k8Api, k8Service } from '@hawtio/online-kubernetes-api'
import React, { useRef, useEffect, useState } from 'react'
import {
  Alert,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Divider,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  Skeleton,
  Title } from '@patternfly/react-core'

export const KubernetesClient: React.FunctionComponent = () => {
  const [isLoading, setIsLoading] = useState(true)
  const timeout = useRef<number>()
  const [error, setError] = useState<Error|null>()

  useEffect(() => {
    setIsLoading(true)

    const checkLoading = async () => {
      if (! k8Loaded)
        return

      setIsLoading(false)

      if (k8Api.hasError()) {
        setError(k8Api.error)
        return
      }

      if (k8Service.hasError()) {
        setError(k8Service.error)
      }
    }

    checkLoading()

    timeout.current = window.setTimeout(checkLoading, 1000)

    return () => {
      window.clearTimeout(timeout.current)
    }

  }, [k8Loaded])

  if (isLoading) {
    return (
      <Panel>
        <PanelMain>
          <PanelMainBody>
            <Skeleton screenreaderText='Loading...' />
          </PanelMainBody>
        </PanelMain>
      </Panel>
    )
  }

  const unwrap = (error: Error): string => {
    if (!error)
      return 'unknown error'

    if (error.cause instanceof Error)
      return unwrap(error.cause)

    return error.message
  }

  if (error) {
    return (
      <Panel>
        <PanelMain>
          <Alert variant="danger" title={error?.message}>
            {unwrap(error)}
          </Alert>
        </PanelMain>
      </Panel>
    )
  }

  return (
    <Panel>
      <PanelHeader><Title headingLevel="h1">Kubernetes Client</Title></PanelHeader>
      <PanelMain>
        <PanelMainBody>
          {k8Service.getPods()}
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
