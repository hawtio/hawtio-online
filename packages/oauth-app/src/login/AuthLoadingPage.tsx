import { Bullseye, Page, Spinner, Content, ContentVariants } from '@patternfly/react-core'
import React from 'react'

export const AuthLoadingPage: React.FunctionComponent = () => (
  <Page>
    <Bullseye>
      <div style={{ justifyContent: 'center' }}>
        <Spinner diameter='60px' aria-label='Loading Hawtio' />

        <Content className={'--pf-v5-global--Color--200'} component={ContentVariants.h3}>
          Loading ...
        </Content>
      </div>
    </Bullseye>
  </Page>
)
