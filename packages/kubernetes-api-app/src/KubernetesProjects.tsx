import { KubeProject } from '@hawtio/online-kubernetes-api'
import React from 'react'
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

type KubeProjectProps = {
  projects: KubeProject[]
}

export const KubernetesProjects: React.FunctionComponent<KubeProjectProps> = (props: KubeProjectProps) => {
  return (
    <Panel isScrollable>
      <PanelMain>
        <PanelMainBody>
          <Table key='breakpoints' aria-label='Breakpoints table' variant='compact'>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Labels</Th>
                <Th>Annotations</Th>
              </Tr>
            </Thead>
            <Tbody>
              {props.projects.map(project => (
                <Tr key={project.metadata?.uid}>
                  <Td dataLabel='Name'>{project.metadata?.name}</Td>
                  <Td dataLabel='Labels'>
                    <DescriptionList>
                      {Object.entries(project.metadata?.labels || {}).map(([key, value]) => {
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
                      {Object.entries(project.metadata?.annotations || {}).map(([key, value]) => {
                        return (
                          <DescriptionListGroup key={key}>
                            <DescriptionListTerm>{key}</DescriptionListTerm>
                            <DescriptionListDescription>{value as string}</DescriptionListDescription>
                          </DescriptionListGroup>
                        )
                      })}
                    </DescriptionList>
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
