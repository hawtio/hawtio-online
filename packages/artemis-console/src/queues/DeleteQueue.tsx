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
  Form,
  Modal,
  ModalVariant,
  Content,
  Title,
  ModalFooter,
  ModalHeader,
  ModalBody,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  ContentVariants
} from '@patternfly/react-core'

import { eventService, jolokiaService, workspace } from '@hawtio/react'

import { artemisService } from '../artemis-service'

type DeleteQueueProps = {
  queue: string
  address: string
  routingType: string
}

export const DeleteQueue: React.FunctionComponent<DeleteQueueProps> = props => {

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPurgeModal, setShowPurgeModal] = useState(false)

  const deleteQueue = async (name: string) => {
    await artemisService.deleteQueue(name)
      .then(() => {
        setShowDeleteModal(false)
        workspace.refreshTree()
        eventService.notify({
          type: 'success',
          message: 'Queue Deleted',
          duration: 3000,
        })
      })
      .catch((error) => {
        setShowDeleteModal(false)
        eventService.notify({ type: 'warning', message: 'Queue Not Deleted: ' + jolokiaService.errorMessage(error) })
      })
  }

  const purgeQueue = async () => {
    await artemisService.purgeQueue(props.queue, props.address, props.routingType)
      .then(() => {
        setShowPurgeModal(false)
        eventService.notify({
          type: 'success',
          message: 'Queue Purged',
          duration: 3000,
        })
      })
      .catch((error) => {
        setShowPurgeModal(false)
        eventService.notify({ type: 'warning', message: 'Queue Not Purged: ' + jolokiaService.errorMessage(error) })
      })
  }

  return (
    <>
      <Panel>
        <PanelHeader>
          <Title headingLevel="h2" size='lg'>Delete/Purge Queue {props.queue}</Title>
        </PanelHeader>
        <PanelMain>
          <PanelMainBody>
            <Form>
              <FormGroup label='Delete Queue'>
                <Button variant='danger' onClick={() => setShowDeleteModal(true)}>Delete</Button>
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>Delete the selected broker queue. The queue is deleted only if it has no consumers bound to it.</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <FormGroup label='Purge Queue'>
                <Button variant="primary" onClick={() => setShowPurgeModal(true)}>Purge</Button>
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>Delete all the messages in the selected broker queue.</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
            </Form>
          </PanelMainBody>
        </PanelMain>
      </Panel>

      <Modal aria-label='queue-delete-modal' variant={ModalVariant.medium} isOpen={showDeleteModal}
             onClose={() => setShowDeleteModal(false)}>
        <ModalHeader title='Delete Queue?' titleIconVariant='warning' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to delete queue <b>{props.queue}</b>.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key="delete" variant="danger" onClick={() => deleteQueue(props.queue)}>
            Confirm
          </Button>
          <Button key="cancel" variant="link" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
      <Modal aria-label='queue-purge-modal' variant={ModalVariant.medium} isOpen={showPurgeModal}
             onClose={() => setShowPurgeModal(false)}>
        <ModalHeader title='Purge Queue?' titleIconVariant='warning' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to remove all messages from queue: <b>{props.queue}</b>.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key="confirm" variant="danger" onClick={() => purgeQueue()}>
            Confirm
          </Button>
          <Button key="cancel" variant="link" onClick={() => setShowPurgeModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
