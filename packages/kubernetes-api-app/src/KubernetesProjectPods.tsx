import { useState } from 'react'
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
            {
              Object.entries<KubePodsOrError>(props.podsByProject).map(([project, podsOrError]) => (
                <AccordionItem key={project}>
                  <AccordionToggle onClick={() => { onToggle(`project-${project}-toggle`) }}
                    isExpanded={expanded === `project-${project}-toggle`}
                    id={`project-${project}-toggle`}
                  >
                    {project}
                  </AccordionToggle>
                  <AccordionContent id={`project-${project}-expand`} isHidden={expanded !== `project-${project}-toggle`}>
                    {isError(podsOrError.error) && (
                      <Label color="red" icon={<InfoCircleIcon/>}>
                        {podsOrError.error.message}
                      </Label>
                    )}
                    {!podsOrError.error && (
                      <KubernetesPaginatedPods
                        key={project} project={project}
                        pods={podsOrError.pods} />
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))
            }
          </Accordion>
        </PanelMainBody>
      </PanelMain>
    </Panel>
  )
}
