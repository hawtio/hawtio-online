import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionToggle,
  Label,
  Panel,
  PanelMain,
  PanelMainBody,
} from '@patternfly/react-core'
import { InfoCircleIcon } from '@patternfly/react-icons'
import { ManagementPaginatedPods } from './ManagementPaginatedPods'
import { isError } from '@hawtio/online-kubernetes-api'
import { ManagedProjects } from '@hawtio/online-management-api'

type ManagementProjects = {
  projects: ManagedProjects
  changed: number
}

export const ManagementProjects: React.FunctionComponent<ManagementProjects> = (props: ManagementProjects) => {
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
            {Object.entries(props.projects).map(([name, project]) => (
              <AccordionItem key={name}>
                <AccordionToggle
                  onClick={() => {
                    onToggle(`project-${name}-toggle`)
                  }}
                  isExpanded={expanded === `project-${name}-toggle`}
                  id={`project-${name}-toggle`}
                >
                  {name}
                </AccordionToggle>
                <AccordionContent id={`project-${name}-expand`} isHidden={expanded !== `project-${name}-toggle`}>
                  {isError(project.error) && (
                    <Label color='red' icon={<InfoCircleIcon />}>
                      {project.error.message}
                    </Label>
                  )}
                  {!project.error && <ManagementPaginatedPods key={name} project={project} />}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
