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
import React, { FormEvent, useState } from 'react'
import {
  CardBody,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Icon,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  TextInput,
  Tooltip,
  ValidatedOptions
} from '@patternfly/react-core'
import { HelpIcon } from '@patternfly/react-icons/dist/esm/icons/help-icon'
import { RhUiErrorFillIcon } from '@patternfly/react-icons'

import { HawtioFormSection } from '@hawtio/react'

import { artemisPreferencesService, ArtemisOptions } from './artemis-preferences-service'

export const TooltipHelpIcon = ({ tooltip }: { tooltip: string }) => (
  <Icon size='md'>
    <Tooltip content={tooltip}>
      <HelpIcon />
    </Tooltip>
  </Icon>
)

type FormatType = {
  id: string
  description: string
  index: number
}

export const ArtemisPreferences: React.FunctionComponent = () => {
  const off: FormatType = { id: 'off', description: 'Off', index: 99 }
  const text: FormatType = { id: 'text', description: 'Text', index: 16 }
  const decimal: FormatType = { id: 'decimal', description: 'Decimal', index: 8 }
  const hex: FormatType = { id: 'hex', description: 'Hex', index: 4 }
  const decimaltext: FormatType = { id: 'decimaltext', description: 'Decimal and Text', index: 2 }
  const hexttext: FormatType = { id: 'hexttext', description: 'Hex and Text', index: 1 }

  const formats = [off, text, decimal, hex, decimaltext, hexttext]

  const [artemisPreferences, setArtemisPreferences] = useState(artemisPreferencesService.loadArtemisPreferences())
  const [currentArtemisPreferences, setCurrentArtemisPreferences] = useState(artemisPreferencesService.loadArtemisPreferences())
  const [isDropdownOpen, setDropdownOpen] = useState(false)
  const format = formats.find(format => format.index === artemisPreferences.artemisBrowseBytesMessages)
  const [selectedFormat, setSelectedFormat] = useState(format ? format.description : off.description)

  const [selectedPageSize, setSelectedPageSize] = useState(artemisPreferencesService.loadArtemisPreferences().artemisDefaultPageSize)
  const [artemisMaxDiagramAddressSize, setArtemisMaxDiagramAddressSize] = useState(artemisPreferencesService.loadArtemisPreferences().artemisMaxDiagramAddressSize)

  const [isPageSizeDropdownOpen, setPageSizeDropdownOpen] = React.useState(false)

  const [validRE1, setValidRE1] = useState(true)
  const [validRE2, setValidRE2] = useState(true)

  const updatePreferences = (value: string | number | boolean, key: keyof ArtemisOptions): void => {
    const updatedPreferences = { ...artemisPreferences, ...{ [key]: value } }

    artemisPreferencesService.saveArtemisPreferences(updatedPreferences)
    setArtemisPreferences(updatedPreferences)
    setCurrentArtemisPreferences(updatedPreferences)
  }

  const updateStringValueFor = (key: keyof ArtemisOptions): ((event: React.FormEvent<HTMLInputElement>, value: string) => void) => {
    return (_event: React.FormEvent<HTMLInputElement>, value: string) => {
      if (value === null || value === undefined) {
        return
      }

      updatePreferences(value, key)
    }
  }

  const updateRegExpValueFor = (key: keyof ArtemisOptions, validState: React.Dispatch<React.SetStateAction<boolean>>): ((event: React.FormEvent<HTMLInputElement>, value: string) => void) => {
    return (_event: React.FormEvent<HTMLInputElement>, value: string) => {
      try {
        RegExp(value)
        validState(true)
        updatePreferences(value, key)
      } catch (error) {
        validState(false)
        setCurrentArtemisPreferences(p => {
          return { ...p, ...{ [key]: value } }
        })
      }
    }
  }

  const handleToggle = () => {
    setDropdownOpen(!isDropdownOpen)
  }

  const handlePageSizeToggle = () => {
    setPageSizeDropdownOpen(!isPageSizeDropdownOpen)
  }

  const handleFormatChange = (_event?: React.MouseEvent<Element, MouseEvent>, value?: string | number) => {
    setSelectedFormat(value as string)
    setDropdownOpen(false)
    const format = formats.find(format => format.description === value)
    if (format) {
      updatePreferences(format?.index, 'artemisBrowseBytesMessages')
    }
  }

  const handlePageSizeChange = (_event?: React.MouseEvent<Element, MouseEvent>, value?: string | number) => {
    setSelectedPageSize(value as number)
    setPageSizeDropdownOpen(false)
    updatePreferences(value as number, 'artemisDefaultPageSize')
    artemisPreferencesService.resetPageSizes()
  }

  const handleMaxDiagramAddressSize = (_event: FormEvent<HTMLInputElement>, value: string) => {
    setArtemisMaxDiagramAddressSize(Number(value))
    updatePreferences(Number(value), 'artemisMaxDiagramAddressSize')
  }

  return (
      <CardBody>
        <Form isHorizontal>
          <HawtioFormSection title='Artemis'>
            <FormGroup
              label='Dead-letter address regex'
              fieldId='artemis-form-artemisDLQ'
              labelHelp={<TooltipHelpIcon tooltip='A regular expression to match one or more dead-letter addresses' />}
            >
              <TextInput
                id='artemis-input-artemisDLQ'
                type='text'
                value={currentArtemisPreferences.artemisDLQ}
                onChange={updateRegExpValueFor('artemisDLQ', setValidRE1)}
                validated={validRE1 ? ValidatedOptions.success : ValidatedOptions.error}
              />
              {!validRE1 && (
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem icon={<RhUiErrorFillIcon />} variant={ValidatedOptions.error}>
                        Invalid regular expression.
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
              )}
            </FormGroup>
            <FormGroup
              label='Expiry address regex'
              fieldId='artemis-form-expiry'
              labelHelp={<TooltipHelpIcon tooltip='A regular expression to match one or more expiry addresses' />}
            >
              <TextInput
                id='artemis-input-expiry'
                type='text'
                value={currentArtemisPreferences.artemisExpiryQueue}
                onChange={updateRegExpValueFor('artemisExpiryQueue', setValidRE2)}
                validated={validRE2 ? ValidatedOptions.success : ValidatedOptions.error}
              />
              {!validRE2 && (
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem icon={<RhUiErrorFillIcon />} variant={ValidatedOptions.error}>
                        Invalid regular expression.
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
              )}
            </FormGroup>
            <FormGroup
              label='Browse Bytes Messages'
              fieldId='artemis-form-showJMXView'
              labelHelp={<TooltipHelpIcon tooltip='Format in which a BytesMessage body is shown' />}
            >
              <Select
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <MenuToggle isFullWidth role='menu' ref={toggleRef} onClick={handleToggle}>
                      {selectedFormat}
                    </MenuToggle>
                  )}
                aria-label='Select Format'
                onSelect={handleFormatChange}
                selected={selectedFormat}
                isOpen={isDropdownOpen}
              >
                <SelectList>
                  <SelectOption label={off.id} value={off.description}>{off.description}</SelectOption>
                  <SelectOption label={text.id} value={text.description}>{text.description}</SelectOption>
                  <SelectOption label={decimal.id} value={decimal.description}>{decimal.description}</SelectOption>
                  <SelectOption label={hex.id} value={hex.description}>{hex.description}</SelectOption>
                  <SelectOption label={decimaltext.id} value={decimaltext.description}>{decimaltext.description}</SelectOption>
                  <SelectOption label={hexttext.id} value={hexttext.description}>{hexttext.description}</SelectOption>
                </SelectList>
              </Select>
            </FormGroup>
            <FormGroup
              label='Default Page Size'
              fieldId='artemis-form-default-pagesize'
              labelHelp={<TooltipHelpIcon tooltip='he default page size to use for Artemis table views. This will replace all page sizes to the default' />}
            >
              <Select
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <MenuToggle isFullWidth role='menu' ref={toggleRef} onClick={handlePageSizeToggle}>
                      {selectedPageSize}
                    </MenuToggle>
                  )}
                aria-label='Select Format'
                onSelect={handlePageSizeChange}
                selected={selectedPageSize}
                isOpen={isPageSizeDropdownOpen}
              >
                <SelectList>
                  <SelectOption label={'10'} value={'10'}>{'10'}</SelectOption>
                  <SelectOption label={'20'} value={'20'}>{'20'}</SelectOption>
                  <SelectOption label={'50'} value={'50'}>{'50'}</SelectOption>
                  <SelectOption label={'100'} value={'100'}>{'100'}</SelectOption>
                  <SelectOption label={'All'} value={'-1'}>{'-1'}</SelectOption>
                </SelectList>
              </Select>
            </FormGroup>
            <FormGroup
              label='Max Diagram Address Size'
              fieldId='artemis-form-diagram'
              labelHelp={<TooltipHelpIcon tooltip='How many addresses will be loaded in the broker diagram tab' />}
            >
              <TextInput
                id='artemis-input-diagram'
                type='number'
                value={artemisMaxDiagramAddressSize}
                onChange={handleMaxDiagramAddressSize}
              />
            </FormGroup>
          </HawtioFormSection>
        </Form>
      </CardBody>
  )
}
