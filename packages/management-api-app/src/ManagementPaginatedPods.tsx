import { ManagedProject, ManagedPod, mgmtService } from '@hawtio/online-management-api'
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
import { Caption, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'

type ManagedPodsProps = {
  project: ManagedProject
}

const podDetailStyle = (pod: ManagedPod) => {
  return {
    color: pod.management.status.error ? 'red' : 'blue',
    fontWeight: 'bold',
  }
}

export const ManagementPaginatedPods: React.FunctionComponent<ManagedPodsProps> = (props: ManagedPodsProps) => {
  const prevPods = () => {
    // Should refresh from 2 components up
    mgmtService.previous(props.project.name)
  }

  const nextPods = () => {
    // Should refresh from 2 components up
    mgmtService.next(props.project.name)
  }

  return (
    <Panel isScrollable>
      <PanelHeader>
        <Toolbar id='pagination-toolbar-items' className='paginated-pods-toolbar-content' isSticky>
          <ToolbarContent>
            <ToolbarItem>
              <Button
                variant='control'
                onClick={() => prevPods()}
                isDisabled={!mgmtService.hasPrevious(props.project.name)}
              >
                &lt;&lt; Previous
              </Button>
            </ToolbarItem>
            <ToolbarItem>
              <Button
                variant='control'
                onClick={() => nextPods()}
                isDisabled={!mgmtService.hasNext(props.project.name)}
              >
                Next &gt;&gt;
              </Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </PanelHeader>
      <PanelMain>
        <PanelMainBody>
          {Object.values(props.project.pods).length === 0 && (
            <EmptyState variant={EmptyStateVariant.xs}>
              <Title headingLevel='h4' size='md'>
                No jolokia pods found
              </Title>
              <EmptyStateBody>Pods were retrieved but none have a jolokia port.</EmptyStateBody>
            </EmptyState>
          )}

          {Object.values(props.project.pods).length > 0 && (
            <Table key={props.project.name} aria-label='Pods table' variant='compact'>
              <Caption>Pods in Project {props.project.name}</Caption>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Namespace</Th>
                  <Th>Labels</Th>
                  <Th>Annotations</Th>
                  <Th>Status</Th>
                  <Th>Management</Th>
                </Tr>
              </Thead>
              <Tbody>
                {Object.values(props.project.pods).map(pod => (
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
                    <Td dataLabel='Status'>{mgmtService.podStatus(pod)}</Td>
                    <Td dataLabel='Management'>
                      <div style={podDetailStyle(pod)}>
                        <pre>{JSON.stringify(pod.management, null, 2)}</pre>
                      </div>
                      {pod.management.status.error && (
                        <div>
                          <p>Jolokia connections are not succeeding. Possible reasons:</p>
                          <ol>
                            <li>404: the address is incorrect or the proxy is not setup correctly</li>
                            <li>
                              401: the connection is not trusted. Disable certifcate validation using the environment
                              variables:
                              <ul>
                                <li>AB_JOLOKIA_AUTH_OPENSHIFT: false</li>
                                <li>AB_JOLOKIA_PASSWORD_RANDOM: false</li>
                                <li>AB_JOLOKIA_OPTS: useSslClientAuthentication=false,protocol=https</li>
                              </ul>
                            </li>
                          </ol>
                        </div>
                      )}
                    </Td>
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
