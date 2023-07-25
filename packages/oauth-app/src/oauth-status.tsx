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
import { oAuthInitialised, getActiveProfile, UserProfile } from '@hawtio/online-oauth'

class DefaultProfile extends UserProfile {

  constructor() {
    super('default-profile')
  }

  hasError() {
    return true
  }

  getError() {
    return new Error('No profile has been found')
  }
}

const defaultProfile = new DefaultProfile()

export const OAuthStatus: React.FunctionComponent = () => {


  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile>(defaultProfile)
  const timeout = useRef<number>()

  const unwrap = (error: Error): string => {
    if (!error)
      return 'unknown error'

    if (error.cause instanceof Error)
      return unwrap(error.cause)

    return error.message
  }

  useEffect(() => {
    setIsLoading(true)

    const checkLoading = async () => {
      const userProfile = await getActiveProfile() as UserProfile
      if (userProfile) {
        setProfile(userProfile)
      }

      setIsLoading(false)
    }

    checkLoading()

    timeout.current = window.setTimeout(checkLoading, 1000)

    return () => {
      window.clearTimeout(timeout.current)
    }

  }, [oAuthInitialised])

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

  if (profile.hasError()) {
    return (
      <Card>
        <CardTitle>OAuth</CardTitle>
        <CardBody>
          <Alert variant="danger" title={profile.getError()?.message} key={profile.getOAuthType()}>
            {unwrap(profile.getError() as Error)}
          </Alert>
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
                  <DescriptionListTerm>OAuth Type</DescriptionListTerm>
                  <DescriptionListDescription>{profile?.getOAuthType()}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Token</DescriptionListTerm>
                  <DescriptionListDescription>{profile.getToken()}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Master URI</DescriptionListTerm>
                  <DescriptionListDescription>{profile.getMasterUri()}</DescriptionListDescription>
                </DescriptionListGroup>
                {
                  Object.entries(profile.getMetadata())
                      .map(([key, value]) => {
                        return (
                          <DescriptionListGroup key={key}>
                            <DescriptionListTerm>{key}</DescriptionListTerm>
                            <DescriptionListDescription>{value}</DescriptionListDescription>
                          </DescriptionListGroup>
                        )
                      })
                }
              </DescriptionList>
            </PanelMainBody>
          </PanelMain>
        </Panel>
      </CardBody>
    </Card>
  )
}
