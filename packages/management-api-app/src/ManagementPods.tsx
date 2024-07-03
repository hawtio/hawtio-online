import { k8Service } from '@hawtio/online-kubernetes-api'
import { ManagedPod } from '@hawtio/online-management-api'
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Panel,
  PanelMain,
  PanelMainBody,
} from '@patternfly/react-core'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'

type ManagedPodsProps = {
  pods: ManagedPod[]
}

const podDetailStyle = (pod: ManagedPod) => {
  return {
    color: pod.getManagement().status.error ? 'red' : 'blue',
    fontWeight: 'bold',
  }
}

export const ManagementPods: React.FunctionComponent<ManagedPodsProps> = (props: ManagedPodsProps) => {
  return (
    <Panel isScrollable>
      <PanelMain>
        <PanelMainBody>
          <Table key='breakpoints' aria-label='Breakpoints table' variant='compact'>
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
              {props.pods.map(pod => (
                <Tr key={pod.getMetadata()?.uid}>
                  <Td dataLabel='Name'>{pod.getMetadata()?.name}</Td>
                  <Td dataLabel='Namespace'>{pod.getMetadata()?.namespace}</Td>
                  <Td dataLabel='Labels'>
                    <DescriptionList>
                      {Object.entries(pod.getMetadata()?.labels || {}).map(([key, value]) => {
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
                      {Object.entries(pod.getMetadata()?.annotations || {}).map(([key, value]) => {
                        return (
                          <DescriptionListGroup key={key}>
                            <DescriptionListTerm>{key}</DescriptionListTerm>
                            <DescriptionListDescription>{value as string}</DescriptionListDescription>
                          </DescriptionListGroup>
                        )
                      })}
                    </DescriptionList>
                  </Td>
                  <Td dataLabel='Status'>{k8Service.podStatus(pod.pod)}</Td>
                  <Td dataLabel='Management'>
                    <div style={podDetailStyle(pod)}>
                      <pre>{JSON.stringify(pod.getManagement(), null, 2)}</pre>
                    </div>
                    {pod.getManagement().status.error && (
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
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
