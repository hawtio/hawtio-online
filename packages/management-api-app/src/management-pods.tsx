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
import { TableComposable, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'

type ManagedPodsProps = {
  pods: ManagedPod[]
}

export const ManagementPods: React.FunctionComponent<ManagedPodsProps> = (props: ManagedPodsProps) => {
  return (
    <Panel isScrollable>
      <PanelMain>
        <PanelMainBody>
          <TableComposable key='breakpoints' aria-label='Breakpoints table' variant='compact'>
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
                  <Td dataLabel='Status'>{k8Service.podStatus(pod.pod)}</Td>
                  <Td dataLabel='Management'>
                    <div>
                      <pre>{JSON.stringify(pod.management, null, 2)}</pre>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </TableComposable>
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
