import React from 'react'
import {
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import { KubePod, k8Service } from '@hawtio/online-kubernetes-api'

type KubePagePodsProps = {
  project: string
  pods: KubePod[]
}

export const KubernetesPaginatedPods: React.FunctionComponent<KubePagePodsProps> = (props: KubePagePodsProps) => {
  const prevPods = () => {
    // Should refresh from 2 components up
    k8Service.previous(props.project)
  }

  const nextPods = () => {
    // Should refresh from 2 components up
    k8Service.next(props.project)
  }

  return (
    <Panel isScrollable>
      <PanelHeader>
        <Toolbar id='pagination-toolbar-items' className='paginated-pods-toolbar-content' isSticky>
          <ToolbarContent>
            <ToolbarItem>
              <Button variant='control' onClick={() => prevPods()} isDisabled={!k8Service.hasPrevious(props.project)}>
                &lt;&lt; Previous
              </Button>
            </ToolbarItem>
            <ToolbarItem>
              <Button variant='control' onClick={() => nextPods()} isDisabled={!k8Service.hasNext(props.project)}>
                Next &gt;&gt;
              </Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </PanelHeader>
      <PanelMain>
        <PanelMainBody>
          {props.pods.length === 0 && (
            <EmptyState variant={EmptyStateVariant.xs}>
              <Title headingLevel='h4' size='md'>
                No jolokia pods found
              </Title>
              <EmptyStateBody>Pods were retrieved but none have a jolokia port.</EmptyStateBody>
            </EmptyState>
          )}

          {props.pods.length > 0 && (
            <Table key={props.project} aria-label='Pods table' variant='compact'>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Namespace</Th>
                  <Th>Labels</Th>
                  <Th>Annotations</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {props.pods.map(pod => (
                  <Tr key={pod.metadata?.uid}>
                    <Td dataLabel='Name'>{pod.metadata?.name}</Td>
                    <Td dataLabel='Namespace'>{pod.metadata?.namespace}</Td>
                    <Td dataLabel='Labels'>
                      <DescriptionList>
                        {Object.entries(pod.metadata?.labels || {}).map(([key, value]) => {
                          return (
                            <DescriptionListGroup key={key}>
                              <DescriptionListTerm>{key}</DescriptionListTerm>
                              <DescriptionListDescription>{value as string}</DescriptionListDescription>
                            </DescriptionListGroup>
                          )
                        })}
                      </DescriptionList>
                    </Td>
                    <Td dataLabel='Annotations'>
                      <DescriptionList>
                        {Object.entries(pod.metadata?.annotations || {}).map(([key, value]) => {
                          return (
                            <DescriptionListGroup key={key}>
                              <DescriptionListTerm>{key}</DescriptionListTerm>
                              <DescriptionListDescription>{value as string}</DescriptionListDescription>
                            </DescriptionListGroup>
                          )
                        })}
                      </DescriptionList>
                    </Td>
                    <Td dataLabel='Status'>{k8Service.podStatus(pod)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
