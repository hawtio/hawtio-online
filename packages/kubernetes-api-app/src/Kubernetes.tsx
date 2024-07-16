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
  Tabs,
  Tab,
  TabTitleText,
} from '@patternfly/react-core'
import { InfoCircleIcon } from '@patternfly/react-icons'
import { useUser, userService } from '@hawtio/react'
import {
  K8Actions, isK8ApiRegistered, k8Api, k8Service,
  KubeProject, KubePodsByProject
} from '@hawtio/online-kubernetes-api'
import { KubernetesProjectPods } from './KubernetesProjectPods'
import { KubernetesProjects } from './KubernetesProjects'

export const Kubernetes: React.FunctionComponent = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>()
  const { username, userLoaded } = useUser()

  const [projects, setProjects] = useState<KubeProject[]>([])
  const [podsByProject, setPodsByProject] = useState<KubePodsByProject>({})
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>(0)

  useEffect(() => {
    setIsLoading(true)

    const checkLoading = async () => {
      const k8Loaded = await isK8ApiRegistered()

      if (!k8Loaded) return

      if (!userLoaded) return

      setIsLoading(false)

      if (k8Api.hasError()) {
        setError(k8Api.error)
        return
      }

      if (k8Service.hasError()) {
        setError(k8Service.error)
        return
      }

      k8Service.on(K8Actions.CHANGED, () => {
        const projects = k8Service.getProjects()
        setProjects([...projects]) // must use spread to ensure update

        // Ensure that update is carried out on nested objects
        // by using assign to create new object
        const podsByProject: KubePodsByProject = k8Service.getPods()
        setPodsByProject(Object.assign({}, podsByProject))
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

  const handleTabClick = (
    event: React.MouseEvent<unknown> | React.KeyboardEvent | MouseEvent,
    tabIndex: string | number,
  ) => {
    setActiveTabKey(tabIndex)
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
          <PanelHeader>
            <Title headingLevel='h1'>Kubernetes Client</Title>
          </PanelHeader>
          <Divider />
          <PanelMain>
            <PanelMainBody>
              <Tabs activeKey={activeTabKey} onSelect={handleTabClick} isBox>
                <Tab eventKey={0} title={<TabTitleText>API Properties</TabTitleText>}>
                  <Panel>
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
                </Tab>
                <Tab eventKey={1} title={<TabTitleText>Pods</TabTitleText>}>
                  <KubernetesProjectPods podsByProject={podsByProject} />
                </Tab>
                {projects.length > 0 && (
                  <Tab eventKey={2} title={<TabTitleText>Projects</TabTitleText>}>
                    <KubernetesProjects projects={projects} />
                  </Tab>
                )}
              </Tabs>
            </PanelMainBody>
          </PanelMain>
        </Panel>
      </CardBody>
    </Card>
  )
}
