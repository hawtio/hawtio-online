import { kubernetesAPI } from '@hawtio/online-kubernetes-api'
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

export const Kubernetes: React.FunctionComponent = () => {
  const [isLoading, setIsLoading] = useState(true)
  const timeout = useRef<number>()

  useEffect(() => {
    setIsLoading(true)

    const checkLoading = async () => {
      if (! kubernetesAPI.getKubeConfig() && ! kubernetesAPI.hasError())
        return

      setIsLoading(false)
    }

    checkLoading()

    timeout.current = window.setTimeout(checkLoading, 1000)

    return () => {
      window.clearTimeout(timeout.current)
    }

  }, [kubernetesAPI.getError(), kubernetesAPI.getKubeConfig()])

  const kApiError = (): string => {
    if (!kubernetesAPI.hasError())
      return ''

    const error = kubernetesAPI.getError() as Error
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

  if (kubernetesAPI.hasError()) {
    return (
      <Card>
        <CardTitle>Kubernetes API</CardTitle>
        <CardBody>
          <Alert variant="danger" title={kApiError()} />
        </CardBody>
      </Card>
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
                  <DescriptionListDescription>{kubernetesAPI.getMasterUrl()}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Is Openshift?</DescriptionListTerm>
                  <DescriptionListDescription>{kubernetesAPI.isOpenShift() ? 'true' : 'false'}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Kubernetes Config</DescriptionListTerm>
                  <DescriptionListDescription><pre>{JSON.stringify(kubernetesAPI.getKubeConfig(), null, 2)}</pre></DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </PanelMainBody>
          </PanelMain>
        </Panel>
      </CardBody>
    </Card>
  )
}
