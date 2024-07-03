import { Bullseye, Page, Spinner, Text, TextContent, TextVariants } from '@patternfly/react-core'
import React from 'react'

export const AuthLoadingPage: React.FunctionComponent = () => (
  <Page>
    <Bullseye>
      <div style={{ justifyContent: 'center' }}>
        <Spinner diameter='60px' aria-label='Loading Hawtio' />

        <TextContent>
          <Text className={'--pf-v5-global--Color--200'} component={TextVariants.h3}>
            Loading ...
          </Text>
        </TextContent>
      </div>
    </Bullseye>
  </Page>
)
