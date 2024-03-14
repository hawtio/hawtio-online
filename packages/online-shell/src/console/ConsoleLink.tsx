import { Button } from '@patternfly/react-core'
import React, { PropsWithChildren, useEffect, useState } from 'react'
import './Console.css'
import * as consoleService from './console-service'
import { ConsoleType } from './globals'

export const ConsoleLink: React.FunctionComponent<
  PropsWithChildren<{
    type: ConsoleType
    namespace?: string
    selector?: string
    resource?: string
    kind?: string
    inline?: boolean
  }>
> = props => {
  const [url, setUrl] = useState<URL | null>(null)

  useEffect(() => {
    const fetchUrl = async () => {
      const url = await consoleService.osLink(props)
      setUrl(url)
    }
    fetchUrl()
  }, [props])

  return (
    <React.Fragment>
      {url && (
        <Button component='a' href={url.toString()} target='_blank' variant='link' isInline className='console-link'>
          {props.children}
        </Button>
      )}
      {!url && <span>{props.children}</span>}
    </React.Fragment>
  )
}
