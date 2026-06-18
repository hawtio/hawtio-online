import { useEffect, useState } from 'react'
import { KubePodsByProject, KubePodsOrError, isError } from '@hawtio/online-kubernetes-api'
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
import { KubernetesPaginatedPods } from './KubernetesPaginatedPods'

type KubePodsProps = {
  podsByProject: KubePodsByProject
}

export const KubernetesProjectPods: React.FunctionComponent<KubePodsProps> = (props: KubePodsProps) => {
  const [expanded, setExpanded] = useState('')

  const projectItemId = (project: string): string => {
    if (!project || project.length === 0) {
      return ''
    }

    return `project-${project}-toggle`
  }

  useEffect(() => {
    const projectNames = Object.keys(props.podsByProject)
    if (projectNames.length > 0) {
      setExpanded(prevExpanded => (prevExpanded ? prevExpanded : projectItemId(projectNames[0])))
    }
  }, [props.podsByProject])

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
          <Accordion asDefinitionList togglePosition='start'>
            {Object.entries<KubePodsOrError>(props.podsByProject).map(([project, podsOrError]) => (
              <AccordionItem key={project} isExpanded={expanded === projectItemId(project)}>
                <AccordionToggle
                  onClick={() => {
                    onToggle(`project-${project}-toggle`)
                  }}
                  id={`project-${project}-toggle`}
                >
                  {project}
                </AccordionToggle>
                <AccordionContent id={`project-${project}-expand`}>
                  {isError(podsOrError.error) && (
                    <Label color='red' icon={<InfoCircleIcon />}>
                      {podsOrError.error.message}
                    </Label>
                  )}
                  {!podsOrError.error && (
                    <KubernetesPaginatedPods key={project} project={project} pods={podsOrError.pods} />
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
