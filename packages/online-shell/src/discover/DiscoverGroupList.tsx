import React from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionToggle,
  List,
} from '@patternfly/react-core'
import { DiscoverGroup } from './globals'
import { DiscoverGroupLabel } from './DiscoverGroupLabel'
import { DiscoverPodItem } from './DiscoverPodItem'
import './Discover.css'

interface DiscoverGroupListProps {
  groups: DiscoverGroup[],
  updateGroups: (groups: DiscoverGroup[]) => void
}

export const DiscoverGroupList: React.FunctionComponent<DiscoverGroupListProps> = (props: DiscoverGroupListProps) => {

  const onToggle = (group: DiscoverGroup) => {

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
                <List isBordered={true} iconSize='large'>
                {
                  group.replicas.map(replica => ( <DiscoverPodItem key={replica.uid} pod={replica}/> ))
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
