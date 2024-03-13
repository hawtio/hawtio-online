import { kubernetesService, KubePod } from '@hawtio/online-kubernetes-api'
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

type KubePodsProps = {
  pods: KubePod[]
}

export const KubernetesPods: React.FunctionComponent<KubePodsProps> = (props: KubePodsProps) => {
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
                  <Td dataLabel='Status'>{kubernetesService.podStatus(pod)}</Td>
                </Tr>
              ))}
            </Tbody>
          </TableComposable>
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
