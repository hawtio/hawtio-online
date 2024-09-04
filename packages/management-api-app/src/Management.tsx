import { isMgmtApiRegistered, mgmtService, MgmtActions, ManagedProjects } from '@hawtio/online-management-api'
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
  NumberInput,
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
import { ManagementProjects } from './ManagementProjects'
import { k8Service } from '@hawtio/online-kubernetes-api'

export const Management: React.FunctionComponent = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>()
  const { username, userLoaded } = useUser()

  const [managedProjects, setManagedProjects] = useState<ManagedProjects>({})
  const [changed] = useState<number>(0)

  const [nsValue, setNSValue] = useState<number>(3)
  const [pollingValue, setPollingValue] = useState<number>(15)

  useEffect(() => {
    setIsLoading(true)

    const checkLoading = async () => {
      const mgmtLoaded = await isMgmtApiRegistered()

      if (!mgmtLoaded) return

      if (!userLoaded) return

      setIsLoading(false)

      if (mgmtService.hasError()) {
        setError(mgmtService.error)
        return
      }

      mgmtService.on(MgmtActions.UPDATED, () => {
        // Ensure that update is carried out on nested objects
        // by using assign to create new object
        setManagedProjects(Object.assign({}, mgmtService.projects))
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

  const onChangeNSLimit = (event: React.FormEvent<HTMLInputElement>) => {
    const value = (event.target as HTMLInputElement).value
    const nsLimit: number = value === '' ? 3 : +value
    setNSValue(nsLimit)

    setTimeout(() => {
      k8Service.namespaceLimit = nsLimit
    }, 200)
  }

  const onChangePolling = (event: React.FormEvent<HTMLInputElement>) => {
    const value = (event.target as HTMLInputElement).value
    const polling: number = value === '' ? 15 : +value
    setPollingValue(polling)

    setTimeout(() => {
      mgmtService.jolokiaPollingInterval = polling * 1000
    }, 200)
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

        {Object.keys(managedProjects).length === 0 && (
          <Panel>
            <Divider />

            <Bullseye>
              <div style={{ justifyContent: 'center' }}>
                <Spinner diameter='60px' aria-label='Loading Hawtio' />

                <TextContent>
                  <Text className={'--pf-global--Color--200'} component={TextVariants.h3}>
                    Fetching Pods ...
                  </Text>
                </TextContent>
              </div>
            </Bullseye>
          </Panel>
        )}

        {Object.keys(managedProjects).length > 0 && (
          <Panel>
            <PanelHeader>Pods</PanelHeader>
            <Divider />
            <PanelMain>
              <PanelMainBody>
                <Panel>
                  <PanelHeader>
                    <Title headingLevel='h4'>Pods in Namespace Limit</Title>
                  </PanelHeader>
                  <PanelMain>
                    <PanelMainBody>
                      <NumberInput
                        inputName='Pods in Namespace Limit'
                        unit='Pods'
                        inputAriaLabel='Pods in Namespace Limit NumberInput'
                        minusBtnAriaLabel='NSPodsMinus1'
                        plusBtnAriaLabel='NSPodsPlus1'
                        value={nsValue}
                        onMinus={() => (k8Service.namespaceLimit = k8Service.namespaceLimit - 1)}
                        onPlus={() => (k8Service.namespaceLimit = k8Service.namespaceLimit + 1)}
                        onChange={onChangeNSLimit}
                      />
                    </PanelMainBody>
                  </PanelMain>
                </Panel>

                <Panel>
                  <PanelHeader>
                    <Title headingLevel='h4'>Jolokia Polling Interval</Title>
                  </PanelHeader>
                  <PanelMain>
                    <PanelMainBody>
                      <NumberInput
                        inputName='Jolokia Polling Interval'
                        unit='seconds'
                        inputAriaLabel='Jolokia Polling Interval NumberInput'
                        minusBtnAriaLabel='JPollMinus1'
                        plusBtnAriaLabel='JPollPlus1'
                        value={pollingValue}
                        onMinus={() => (mgmtService.jolokiaPollingInterval = mgmtService.jolokiaPollingInterval - 1000)}
                        onPlus={() => (mgmtService.jolokiaPollingInterval = mgmtService.jolokiaPollingInterval + 1000)}
                        onChange={onChangePolling}
                      />
                    </PanelMainBody>
                  </PanelMain>
                </Panel>

                <Divider />

                <ManagementProjects projects={managedProjects} changed={changed} />
              </PanelMainBody>
            </PanelMain>
          </Panel>
        )}

        <Divider />
      </CardBody>
    </Card>
  )
}
