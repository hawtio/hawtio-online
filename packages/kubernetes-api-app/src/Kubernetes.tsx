import { isK8ApiRegistered, k8Api, k8Service } from '@hawtio/online-kubernetes-api'
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
  Title,
  Masthead,
  MastheadContent,
  Label,
  Button,
} from '@patternfly/react-core'
import { InfoCircleIcon } from '@patternfly/react-icons'
import { KubernetesClient } from './KubernetesClient'
import { userService } from '@hawtio/react'

export const Kubernetes: React.FunctionComponent = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>()
  const [username, setUsername] = useState('')

  useEffect(() => {
    setIsLoading(true)

    const checkLoading = async () => {
      const k8Loaded = await isK8ApiRegistered()

      if (!k8Loaded) return

      setIsLoading(false)

      if (k8Api.hasError()) {
        setError(k8Api.error)
        return
      }

      if (k8Service.hasError()) {
        setError(k8Service.error)
      }

      await userService.fetchUser()
      const username = await userService.getUsername()
      setUsername(username)
    }

    checkLoading()

    timerRef.current = setTimeout(checkLoading, 1000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

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
                  <DescriptionListDescription>{k8Api.masterUri()}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Is Openshift?</DescriptionListTerm>
                  <DescriptionListDescription>{k8Api.isOpenshift ? 'true' : 'false'}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Cluster Console</DescriptionListTerm>
                  <DescriptionListDescription>
                    {k8Api.consoleUri ? <a href={k8Api.consoleUri}>{k8Api.consoleUri}</a> : '<not found>'}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Kubernetes Config</DescriptionListTerm>
                  <DescriptionListDescription>
                    <pre>{JSON.stringify(k8Api.oAuthProfile, null, 2)}</pre>
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
