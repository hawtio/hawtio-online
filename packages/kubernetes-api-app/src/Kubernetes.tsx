import { kubernetesApi, kubernetesService } from '@hawtio/online-kubernetes-api'
import { useUser, userService } from '@hawtio/react'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Divider,
  Label,
  Masthead,
  MastheadContent,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  Skeleton,
  Title,
} from '@patternfly/react-core'
import { InfoCircleIcon } from '@patternfly/react-icons'
import React, { useEffect, useRef, useState } from 'react'
import { KubernetesClient } from './KubernetesClient'

export const Kubernetes: React.FunctionComponent = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>()
  const { username, userLoaded } = useUser()

  useEffect(() => {
    setIsLoading(true)

    const checkLoading = async () => {
      if (!userLoaded) return

      setIsLoading(false)

      if (kubernetesApi.hasError()) {
        setError(kubernetesApi.error)
        return
      }

      if (kubernetesService.hasError()) {
        setError(kubernetesService.error)
      }
    }

    checkLoading()

    timerRef.current = setTimeout(checkLoading, 1000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [userLoaded])

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
    if (!error) return 'unknown error'

    if (error.cause instanceof Error) return unwrap(error.cause)

    return error.message
  }

  if (error) {
    return (
      <Card>
        <CardBody>
          <Alert variant='danger' title={error?.message}>
            {unwrap(error)}
          </Alert>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardTitle>
        <Title headingLevel='h1'>Kubernetes API</Title>
      </CardTitle>
      <CardBody>
        <Masthead id='login-credentials'>
          <MastheadContent>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignContent: 'stretch', width: '100%' }}>
              <Label color='green' icon={<InfoCircleIcon />}>
                {username}
              </Label>
              <Button
                variant='danger'
                ouiaId='Logout'
                onClick={() => {
                  userService.logout()
                }}
              >
                Logout
              </Button>
            </div>
          </MastheadContent>
        </Masthead>

        <Panel>
          <PanelHeader>API Properties</PanelHeader>
          <Divider />
          <PanelMain>
            <PanelMainBody>
              <DescriptionList isHorizontal>
                <DescriptionListGroup>
                  <DescriptionListTerm>Kubernetes Master</DescriptionListTerm>
                  <DescriptionListDescription>{kubernetesApi.masterUri()}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Is Openshift?</DescriptionListTerm>
                  <DescriptionListDescription>
                    {kubernetesApi.isOpenshift ? 'true' : 'false'}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Cluster Console</DescriptionListTerm>
                  <DescriptionListDescription>
                    {kubernetesApi.consoleUri ? (
                      <a href={kubernetesApi.consoleUri}>{kubernetesApi.consoleUri}</a>
                    ) : (
                      '<not found>'
                    )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Kubernetes Config</DescriptionListTerm>
                  <DescriptionListDescription>
                    <pre>{JSON.stringify(kubernetesApi.oAuthProfile, null, 2)}</pre>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </PanelMainBody>
          </PanelMain>
        </Panel>

        <Divider />

        <KubernetesClient />
      </CardBody>
    </Card>
  )
}
