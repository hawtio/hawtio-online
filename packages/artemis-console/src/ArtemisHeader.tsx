/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React, { useEffect, useCallback, useState } from 'react'
import { Label, LabelStatus, Tooltip } from '@patternfly/react-core'
import { DisconnectedIcon } from '@patternfly/react-icons/dist/esm/icons/disconnected-icon'
import { InProgressIcon } from '@patternfly/react-icons/dist/esm/icons/in-progress-icon'
import { RhUiCheckCircleFillIcon } from '@patternfly/react-icons/dist/esm/icons/rh-ui-check-circle-fill-icon'

import { eventService, jolokiaService } from '@hawtio/react'

import { artemisService, BrokerStatus } from './artemis-service'

export const ArtemisHeader: React.FunctionComponent = () => {

  const [brokerHeader, setBrokerHeader] = useState('')
  const [brokerStatus, setBrokerStatus] = useState<BrokerStatus>(BrokerStatus.UNINITIALIZED)

  const listener = useCallback(() => {
    setBrokerStatus(artemisService.status)
  }, [])

  useEffect(() => {
    artemisService.getBrokerName()
      .then((brokerName) => {
        setBrokerHeader(brokerName ? brokerName : '')
        setBrokerStatus(artemisService.status)
      })
      .catch((error) => {
        eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(error) })
      })

    artemisService.addStatusListener(listener)
    return () => {
      artemisService.removeStatusListener(listener)
    }
  }, [])

  let statusHeader = null
  if (brokerStatus === BrokerStatus.UNINITIALIZED) {
    statusHeader = (
        <Label status={LabelStatus.info} icon={<InProgressIcon />}>Checking...</Label>
    )
  } else if (brokerStatus === BrokerStatus.AVAILABLE) {
    statusHeader = (
        <Label status={LabelStatus.info} icon={<RhUiCheckCircleFillIcon />}>Broker ({brokerHeader})</Label>
    )
  } else {
    statusHeader = (
        <Tooltip content={`No Artemis domain found in JMX.`} position='bottom'>
          <Label status={LabelStatus.warning} icon={<DisconnectedIcon />}>Broker Not Available</Label>
        </Tooltip>
    )
  }

  return statusHeader
}
