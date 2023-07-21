import { initialised, getProfileErrors, getActiveProfile, getOAuthToken } from '@hawtio/online-oauth'
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

export const OAuthStatus: React.FunctionComponent = () => {
  const [isLoading, setIsLoading] = useState(true)
  const timeout = useRef<number>()

  useEffect(() => {
    setIsLoading(true)

    const checkLoading = async () => {
      if (! initialised)
        return

      setIsLoading(false)
    }

    checkLoading()

    timeout.current = window.setTimeout(checkLoading, 1000)

    return () => {
      window.clearTimeout(timeout.current)
    }

  }, [initialised])

  if (isLoading) {
    return (
      <Card>
        <CardTitle>OAuth</CardTitle>
        <CardBody>
          <Skeleton screenreaderText='Loading...' />
        </CardBody>
      </Card>
    )
  }

  const unwrap = (error: Error): string => {
    if (error.cause instanceof Error)
      return unwrap(error.cause)

    return error.message
  }

  if (getProfileErrors().length > 0) {
    return (
      <Card>
        <CardTitle>OAuth</CardTitle>
        <CardBody>
          {getProfileErrors().map((error: Error) => (
            <Alert variant="danger" title={error.message} key={error.message}>
              {unwrap(error)}
            </Alert>
          ))}
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardTitle><Title headingLevel="h1">OAuth</Title></CardTitle>
      <CardBody>
        <Panel>
          <PanelHeader>Properties</PanelHeader>
          <Divider />
          <PanelMain>
            <PanelMainBody>
              <DescriptionList isHorizontal>
                <DescriptionListGroup>
                  <DescriptionListTerm>Mechanism Type</DescriptionListTerm>
                  <DescriptionListDescription>{getActiveProfile()?.getId()}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Token</DescriptionListTerm>
                  <DescriptionListDescription>{getOAuthToken()}</DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </PanelMainBody>
          </PanelMain>
        </Panel>
      </CardBody>
    </Card>
  )
}
