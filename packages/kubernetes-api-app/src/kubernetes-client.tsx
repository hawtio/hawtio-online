import { k8Service, K8Actions } from '@hawtio/online-kubernetes-api'
import React, { useEffect, useState } from 'react'
import { Panel, PanelHeader, PanelMain, PanelMainBody, Tab, Tabs, TabTitleText, Title } from '@patternfly/react-core'
import { KubernetesProjects } from './kubernetes-projects'
import { KubeObject } from '@hawtio/online-kubernetes-api'
import { KubernetesPods } from './kubernetes-pods'

export const KubernetesClient: React.FunctionComponent = () => {
  const [projects, setProjects] = useState<KubeObject[]>([])
  const [pods, setPods] = useState<KubeObject[]>([])
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>(0)

  useEffect(() => {
    k8Service.on(K8Actions.CHANGED, () => {
      setProjects(k8Service.getProjects())
      setPods(k8Service.getPods())
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
