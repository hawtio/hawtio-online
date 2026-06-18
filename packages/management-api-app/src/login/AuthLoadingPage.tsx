import { Bullseye, Content, Page, Spinner } from '@patternfly/react-core'
import React from 'react'

export const AuthLoadingPage: React.FunctionComponent = () => (
  <Page>
    <Bullseye>
      <div style={{ justifyContent: 'center' }}>
        <Spinner diameter='60px' aria-label='Loading Hawtio' />

        <Content component='h3'>Loading ...</Content>
      </div>
    </Bullseye>
  </Page>
)
