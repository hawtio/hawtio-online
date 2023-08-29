import React, { PropsWithChildren } from 'react'
import { Button } from '@patternfly/react-core'
import { ConsoleType } from './globals'
import * as consoleService from './console-service'
import './Console.css'

interface ConsoleLinkProps {
  type: ConsoleType,
  namespace?: string,
  selector?: string,
  resource?: string,
  kind?: string
  inline?: boolean
}

export const ConsoleLink: React.FunctionComponent<PropsWithChildren<ConsoleLinkProps>> = (props: PropsWithChildren<ConsoleLinkProps>) => {

  const url = consoleService.osLink(props)

  return (
    <React.Fragment>
      { url && (
        <Button component="a" href={url.toString()} target="_blank"
                variant="link" isInline className='console-link'>
          {props.children}
        </Button>
        )
      }
      {!url && (<span>{props.children}</span>)}
    </React.Fragment>
  )
}
