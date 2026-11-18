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
  Content,
  Button,
  Modal,
  ModalVariant,
  Title,
  Popover,
  ModalFooter,
  ModalBody,
  ModalHeader,
  ContentVariants,
  Panel,
  PanelHeader,
  PanelFooter
} from '@patternfly/react-core'
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/outlined-question-circle-icon'

import { eventService, jolokiaService, workspace } from '@hawtio/react'

import { artemisService } from '../artemis-service'
import { closeWithEscape } from '../table/utils'

type DeleteAddressProps = {
  address: string
}

export const DeleteAddress: React.FunctionComponent<DeleteAddressProps> = props => {

  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const handleDeleteAddress = () => {
    artemisService.deleteAddress(props.address)
      .then(() => {
        setShowDeleteModal(false)
        workspace.refreshTree()
        eventService.notify({
          type: 'success',
          message: 'Address Successfully Deleted',
        })
      })
      .catch((error) => {
        setShowDeleteModal(false)
        eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(error) })
      })
  }

  const Hint = () => (
    <Content>
      <Content component='p'>
        Use this page to delete the selected address on the broker. The address is deleted only if it has no queues bound to it.
      </Content>
    </Content>
  )

  return (
    <>
      <Panel>
        <PanelHeader>
          <Title headingLevel='h2' size='lg'>
            Delete Address {props.address}{' '}
            <Popover bodyContent={Hint}><OutlinedQuestionCircleIcon /></Popover>
          </Title>
        </PanelHeader>
        <PanelFooter>
          <Button variant='primary' onClick={() => setShowDeleteModal(true)} >Delete</Button>
        </PanelFooter>
      </Panel>

      <Modal aria-label='delete-address-modal' variant={ModalVariant.small} isOpen={showDeleteModal}
             onClose={() => setShowDeleteModal(false)}
             onKeyDown={closeWithEscape(setShowDeleteModal)}>
        <ModalHeader title='Delete Address?' titleIconVariant='warning' />
        <ModalBody>
          <Content component={ContentVariants.p}>
            You are about to delete address: <b>{props.address}</b>.
          </Content>
          <Content component={ContentVariants.p}>
            This operation cannot be undone.
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key='delete' variant='danger' onClick={handleDeleteAddress}>
            Confirm
          </Button>
          <Button key='cancel' variant='link' onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
