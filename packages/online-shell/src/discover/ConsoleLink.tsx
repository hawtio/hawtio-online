import React, { PropsWithChildren } from 'react'
import * as discoverService from './discover-service'
import './Discover.css'
import { Button } from '@patternfly/react-core'

interface ConsoleLinkProps {
  namespace: string,
  resources: string,
  name: string
}

export const ConsoleLink: React.FunctionComponent<PropsWithChildren<ConsoleLinkProps>> = (props: PropsWithChildren<ConsoleLinkProps>) => {

  const url = discoverService.osLink({name: props.name, namespace: props.namespace, resources: props.resources})

  return (
    <React.Fragment>
      { url && (
        <Button component="a" href={url.toString()} target="_blank" variant="link" isInline>
          {props.children}
        </Button>
        )
      }
      {!url && (<span>{props.children}</span>)}
    </React.Fragment>
  )
}
