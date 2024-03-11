import { Card, CardBody, CardTitle, Spinner } from '@patternfly/react-core'
import React from 'react'

export const InitLoading: React.FunctionComponent = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '20%' }}>
    <Card>
      <CardTitle style={{ textAlign: 'center' }}>Initializing Hawtio...</CardTitle>
      <CardBody>
        <Spinner /> Connecting to OpenShift API
      </CardBody>
    </Card>
  </div>
)
