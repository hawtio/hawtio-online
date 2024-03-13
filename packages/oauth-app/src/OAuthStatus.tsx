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
  Button,
  Masthead,
  MastheadContent,
  Label,
} from '@patternfly/react-core'
import { InfoCircleIcon } from '@patternfly/react-icons'
import { UserProfile, oAuthInit, getActiveProfile } from '@hawtio/online-oauth'
import { userService } from '@hawtio/react'

class DefaultProfile extends UserProfile {
  constructor() {
    super()
    this.setAuthType('default-profile')
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
  const [error, setError] = useState<Error | null>()
  const [profile, setProfile] = useState<UserProfile>(defaultProfile)
  const timeout = useRef<number>()

  const [username, setUsername] = useState('')

  const unwrap = (error: Error): string => {
    if (!error) return 'unknown error'

    if (error.cause instanceof Error) return unwrap(error.cause)

    return error.message
  }

  useEffect(() => {
    setIsLoading(true)

    const checkLoading = async () => {
      try {
        await oAuthInit()
        const userProfile = await getActiveProfile()

        if (userProfile.hasError()) setError(userProfile.getError())
        else setProfile(userProfile)

        await userService.fetchUser()
        const username = await userService.getUsername()
        setUsername(username)
      } catch (error) {
        if (error instanceof Error) setError(error)
        else setError(new Error(error as string))
      }

      setIsLoading(false)
    }

    checkLoading()

    timeout.current = window.setTimeout(checkLoading, 1000)

    return () => {
      window.clearTimeout(timeout.current)
    }
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardTitle>OAuth Loading ...</CardTitle>
        <CardBody>
          <Skeleton screenreaderText='Loading...' />
        </CardBody>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardTitle>OAuth</CardTitle>
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
        <Title headingLevel='h1'>OAuth</Title>
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
                {Object.entries(profile.getMetadata()).map(([key, value]) => {
                  return (
                    <DescriptionListGroup key={key}>
                      <DescriptionListTerm>{key}</DescriptionListTerm>
                      <DescriptionListDescription>{value as string}</DescriptionListDescription>
                    </DescriptionListGroup>
                  )
                })}
              </DescriptionList>
            </PanelMainBody>
          </PanelMain>
        </Panel>
      </CardBody>
    </Card>
  )
}
