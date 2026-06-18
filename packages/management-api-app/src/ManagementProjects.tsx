import { useEffect, useState } from 'react'
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

  const projectItemId = (project: string): string => {
    if (!project || project.length === 0) {
      return ''
    }

    return `project-${project}-toggle`
  }

  useEffect(() => {
    const projectNames = Object.keys(props.projects)
    if (projectNames.length > 0) {
      setExpanded(prevExpanded => (prevExpanded ? prevExpanded : projectItemId(projectNames[0])))
    }
  }, [props.projects])

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
              <AccordionItem key={name} isExpanded={expanded === projectItemId(name)}>
                <AccordionToggle
                  onClick={() => {
                    onToggle(`project-${name}-toggle`)
                  }}
                  id={`project-${name}-toggle`}
                >
                  {name}
                </AccordionToggle>
                <AccordionContent id={`project-${name}-expand`}>
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
