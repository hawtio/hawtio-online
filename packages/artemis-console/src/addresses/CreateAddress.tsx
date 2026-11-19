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
import React, { useState } from 'react'
import {
  Button,
  Content,
  Form,
  FormGroup,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Popover,
  Radio,
  TextInput,
  Title
} from '@patternfly/react-core'
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/outlined-question-circle-icon'

import { eventService, jolokiaService } from '@hawtio/react'

import { artemisService } from '../artemis-service'

interface CreateAddressProps {
  // function to call after creating the address, so the table (where the "Create Address" button is used)
  // can be reloaded
  reload: () => void
  // a function that should be used for close handlers of the dialog
  onClose: () => void
}

export const CreateAddress: React.FunctionComponent<CreateAddressProps> = props => {

  const [addressName, setAddressName] = useState('')
  const [routingType, setRoutingType] = useState('')

  const handleQueueNameChange = (_event: React.FormEvent<HTMLInputElement>, name: string) => {
    setAddressName(name)
  }

  const handleQueueRoutingTypeChange = (name: string) => {
    setRoutingType(name)
  }

  const handleCreateAddress = () => {
    artemisService.createAddress(addressName, routingType)
      .then(() => {
        if (props) {
          props.reload()
          props.onClose()
        }
        eventService.notify({
          type: 'success',
          message: 'Address Successfully Created',
        })
      })
      .catch((error) => {
        eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(error) })
      })
  }

  const Hint = () => (
    <Content>
      <Content component='p'>
        Use this page to create a new address on the broker. If you want the address to support JMS-like queues,
        that is point-to-point messaging, choose Anycast. If you want the address to support JMS-like topic
        subscriptions, that is publish-subscribe messaging, choose Multicast.
      </Content>
    </Content>
  )

  return (
    <>
      <ModalHeader>
        <Title headingLevel='h1' size='lg'>
          Create Address{' '}
          <Popover bodyContent={Hint}><OutlinedQuestionCircleIcon /></Popover>
        </Title>
      </ModalHeader>
      <ModalBody>
        <Form>
          <FormGroup label='Address Name'>
            <TextInput
                isRequired
                type='text'
                id='address-name'
                name='address-name'
                value={addressName}
                onChange={handleQueueNameChange} />
          </FormGroup>
          <FormGroup role='radiogroup' isInline fieldId='routing-type' label='Routing Type'>
            <Radio name='basic-inline-radio' label='Anycast' id='ANYCAST'
                   onChange={() => handleQueueRoutingTypeChange('ANYCAST')} />
            <Radio name='basic-inline-radio' label='Multicast' id='MULTICAST'
                   onChange={() => handleQueueRoutingTypeChange('MULTICAST')} />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant='primary' onClick={() => handleCreateAddress()}
                isDisabled={addressName.length === 0 || routingType.length === 0}>Create Address</Button>
        <Button key='close' variant='link' onClick={() => props.onClose()}>Close</Button>
      </ModalFooter>
    </>
  )
}
