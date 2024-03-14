import { managementService, ManagedPod, ManagementActions } from '@hawtio/online-management-api'
import React, { useRef, useEffect, useState } from 'react'
import {
  Alert,
  Bullseye,
  Button,
  Card,
  CardBody,
  CardTitle,
  Divider,
  Label,
  Masthead,
  MastheadContent,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  Skeleton,
  Spinner,
  Text,
  TextContent,
  TextVariants,
  Title,
} from '@patternfly/react-core'
import { InfoCircleIcon } from '@patternfly/react-icons'
import { useUser, userService } from '@hawtio/react'
import { ManagementPods } from './ManagementPods'
import { kubernetesApi, kubernetesService } from '@hawtio/online-kubernetes-api'

export const Management: React.FunctionComponent = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>()
  const { username, userLoaded } = useUser()

  const [pods, setPods] = useState<ManagedPod[]>([])

  useEffect(() => {
    setIsLoading(true)

    const checkLoading = async () => {
      // Block until initialisation is done
      await kubernetesApi.getOAuthProfile()
      await kubernetesService.getPods()

      if (!userLoaded) return

      setIsLoading(false)

      if (managementService.hasError()) {
        setError(managementService.error)
        return
      }

      managementService.on(ManagementActions.UPDATED, () => {
        setPods([...managementService.pods]) // Use spread to ensure react updates the state
      })
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
        <CardTitle>Management API</CardTitle>
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
        <Title headingLevel='h1'>Management API</Title>
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

        {pods.length === 0 && (
          <Panel>
            <Divider />

            <Bullseye>
              <div style={{ justifyContent: 'center' }}>
                <Spinner diameter='60px' isSVG aria-label='Loading Hawtio' />

                <TextContent>
                  <Text className={'--pf-global--Color--200'} component={TextVariants.h3}>
                    Fetching Pods ...
                  </Text>
                </TextContent>
              </div>
            </Bullseye>
          </Panel>
        )}

        {pods.length > 0 && (
          <Panel>
            <PanelHeader>API Properties</PanelHeader>
            <Divider />
            <PanelMain>
              <PanelMainBody>
                <ManagementPods pods={pods} />
              </PanelMainBody>
            </PanelMain>
          </Panel>
        )}

        <Divider />
      </CardBody>
    </Card>
  )
}
