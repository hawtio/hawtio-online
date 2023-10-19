import React, { useContext } from 'react'
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
import { DiscoverContext } from './context'

export const DiscoverGroupList: React.FunctionComponent = () => {
  const { discoverGroups, setDiscoverGroups } = useContext(DiscoverContext)

  const onToggle = (group: DiscoverGroup) => {
    const groups = [...discoverGroups]

    groups.forEach(g => {
      if (g.uid === group.uid)
        g.expanded = !g.expanded
    })

    setDiscoverGroups(groups)
  }

  if (discoverGroups.length === 0)
    return (<></>)

  return (
    <Accordion asDefinitionList>
    {
      discoverGroups.map(group => {
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
