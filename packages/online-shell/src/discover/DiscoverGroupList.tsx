import React from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionToggle,
  List,
  Title,
} from '@patternfly/react-core'
import { DisplayGroup } from './discover-service'
import './Discover.css'
import { ConsoleLink } from './ConsoleLink'
import { DiscoverGroupLabel } from './DiscoverGroupLabel'
import { DiscoverPodItem } from './DiscoverPodItem'

interface DiscoverGroupListProps {
  groups: DisplayGroup[],
  updateGroups: (groups: DisplayGroup[]) => void
}

export const DiscoverGroupList: React.FunctionComponent<DiscoverGroupListProps> = (props: DiscoverGroupListProps) => {

  const onToggle = (group: DisplayGroup) => {

    const groups = [...props.groups]

    groups.forEach(g => {
      if (g.uid === group.uid)
        g.expanded = !g.expanded
    })

    props.updateGroups(groups)
  }

  return (
    <Accordion asDefinitionList>
    {
      props.groups.map(group => {
          return (
            <AccordionItem key={'item-' + group.name}>
              <AccordionToggle
                onClick={() => {onToggle(group) }}
                isExpanded={group.expanded}
                id={'item-' + group.name}
              >
                <DiscoverGroupLabel group={group} />
              </AccordionToggle>
              <AccordionContent id={'item-' + group.name + 'expand'} isHidden={!group.expanded}>
                <List isPlain isBordered iconSize="large">
                {
                  group.replicas.map(replica => {
                    return ( <DiscoverPodItem pod={replica}/> )
                  })
                }
                </List>
              </AccordionContent>
            </AccordionItem>
          )
        })
      }
      </Accordion>
    )
}

//
//               <!-- Replicas pods -->
//               <div ng-if="pod.deployment"
//                    class="list-group-item-container container-fluid"
//                    ng-class="{'hidden': !pod.expanded}">
//                 <div ng-repeat="replica in pod.replicas"
//                      class="list-group-item list-view-pf-stacked"
//                      pod-list-row pod="replica">
//                 </div>
//               </div>
//
//
//
//
//     <!-- Pod item -->
//     <pod-list-row ng-if="!pod.deployment" pod="pod" />
//   </div>
// </div>
