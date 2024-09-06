import React, { useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionToggle, List } from '@patternfly/react-core'
import { DiscoverGroup } from './globals'
import { DiscoverGroupLabel } from './DiscoverGroupLabel'
import { DiscoverPodItem } from './DiscoverPodItem'
import './Discover.css'

interface DiscoverGroupListProps {
  groups: DiscoverGroup[]
}

export const DiscoverGroupList: React.FunctionComponent<DiscoverGroupListProps> = (props: DiscoverGroupListProps) => {
  const [hidden, setHidden] = useState<string[]>([])

  const onToggle = (group: DiscoverGroup) => {
    const newHidden = [...hidden]

    const index = newHidden.indexOf(group.uid)
    if (index === -1) {
      // Since no uid in hidden then expanded by default
      // then add to hidden to hide
      newHidden.push(group.uid)
    } else {
      newHidden.splice(index, 1)
    }

    setHidden(newHidden)
  }

  const isHidden = (group: DiscoverGroup): boolean => {
    return hidden.indexOf(group.uid) > -1
  }

  if (props.groups.length === 0) return <></>

  return (
    <Accordion asDefinitionList>
      {props.groups.map(group => {
        const key = `${group.name}-${group.namespace}`
        return (
          <AccordionItem key={'item-' + key}>
            <AccordionToggle
              onClick={() => {
                onToggle(group)
              }}
              isExpanded={!isHidden(group)}
              id={'item-' + group.name}
            >
              <DiscoverGroupLabel group={group} />
            </AccordionToggle>
            <AccordionContent id={'item-' + key + 'expand'} isHidden={isHidden(group)}>
              <List isBordered={true} iconSize='large'>
                {group.replicas.map(replica => (
                  <DiscoverPodItem key={replica.uid} pod={replica} />
                ))}
              </List>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
