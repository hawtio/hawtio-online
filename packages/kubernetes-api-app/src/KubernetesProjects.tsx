import { KubeProject } from '@hawtio/online-kubernetes-api'
import React, { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionToggle,
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

  const [expanded, setExpanded] = useState('')

  const onToggle = (id: string) => {
    if (id === expanded) {
      setExpanded('')
    } else {
      setExpanded(id)
    }
  }

  return (
    <Panel isScrollable>
      <PanelMain className='paginated-panel'>
        <PanelMainBody>
          <Accordion asDefinitionList>
            {props.projects.map(project => (
              <AccordionItem key={project.metadata?.name}>
                <AccordionToggle onClick={() => { onToggle(`project-${project.metadata?.name}-toggle`) }}
                  isExpanded={expanded === `project-${project.metadata?.name}-toggle`}
                  id={`project-${project.metadata?.name}-toggle`}
                >
                  {project.metadata?.name}
                </AccordionToggle>
                <AccordionContent id={`project-${project.metadata?.name}-expand`} isHidden={expanded !== `project-${project.metadata?.name}-toggle`}>
                  <Table key='breakpoints' aria-label='Breakpoints table' variant='compact'>
                    <Thead>
                      <Tr>
                        <Th>Labels</Th>
                        <Th>Annotations</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      <Tr key={project.metadata?.uid}>
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
                    </Tbody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
