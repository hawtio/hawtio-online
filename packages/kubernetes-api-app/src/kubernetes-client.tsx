import * as K8API from '@hawtio/online-kubernetes-api'
import React, { useEffect, useState } from 'react'
import { Panel, PanelHeader, PanelMain, PanelMainBody, Tab, Tabs, TabTitleText, Title } from '@patternfly/react-core'
import { KubernetesProjects } from './kubernetes-projects'
import { KubernetesPods } from './kubernetes-pods'

export const KubernetesClient: React.FunctionComponent = () => {
  const [projects, setProjects] = useState<K8API.KubeObject[]>([])
  const [pods, setPods] = useState<K8API.KubeObject[]>([])
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>(0)

  useEffect(() => {
    K8API.k8Service.on(K8API.K8Actions.CHANGED, () => {
      setProjects(K8API.k8Service.getProjects())
      setPods(K8API.k8Service.getPods())
    })
  }, [])

  const handleTabClick = (
    event: React.MouseEvent<unknown> | React.KeyboardEvent | MouseEvent,
    tabIndex: string | number,
  ) => {
    setActiveTabKey(tabIndex)
  }

  return (
    <Panel>
      <PanelHeader>
        <Title headingLevel='h1'>Kubernetes Client</Title>
      </PanelHeader>
      <PanelMain>
        <PanelMainBody>
          <Tabs activeKey={activeTabKey} onSelect={handleTabClick} isBox>
            <Tab eventKey={0} title={<TabTitleText>Projects</TabTitleText>}>
              <KubernetesProjects projects={projects} />
            </Tab>
            <Tab eventKey={1} title={<TabTitleText>Pods</TabTitleText>}>
              <KubernetesPods pods={pods} />
            </Tab>
          </Tabs>
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
