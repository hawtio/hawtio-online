import { k8Loaded, k8Api, k8Service } from '@hawtio/online-kubernetes-api'
import React, { useRef, useEffect, useState } from 'react'
import {
  Alert,
  Card,
  CardTitle,
  CardBody,
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
import { KubernetesClient } from './kubernetes-client'

export const Kubernetes: React.FunctionComponent = () => {
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

  const kApiError = (): string => {
    if (!k8Api.hasError())
      return ''

    const error = k8Api.error as Error
    return error.message
  }

  if (isLoading) {
    return (
      <Card>
        <CardTitle>Kubernetes API</CardTitle>
        <CardBody>
          <Skeleton screenreaderText='Loading...' />
        </CardBody>
      </Card>
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
    <Card>
      <CardTitle><Title headingLevel="h1">Kubernetes API</Title></CardTitle>
      <CardBody>
        <Panel>
          <PanelHeader>API Properties</PanelHeader>
          <Divider />
          <PanelMain>
            <PanelMainBody>
              <DescriptionList isHorizontal>
                <DescriptionListGroup>
                  <DescriptionListTerm>Kubernetes Master</DescriptionListTerm>
                  <DescriptionListDescription>{k8Api.getMasterUri()}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Is Openshift?</DescriptionListTerm>
                  <DescriptionListDescription>{k8Api.isOpenshift ? 'true' : 'false'}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Kubernetes Config</DescriptionListTerm>
                  <DescriptionListDescription><pre>{JSON.stringify(k8Api.oAuthProfile, null, 2)}</pre></DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </PanelMainBody>
          </PanelMain>
        </Panel>

        <Divider/>

        <KubernetesClient />
      </CardBody>
    </Card>
  )
}
