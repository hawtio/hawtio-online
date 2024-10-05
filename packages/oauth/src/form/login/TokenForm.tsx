import * as React from 'react'
import {
  Form,
  FormGroup,
  ActionGroup,
  FormHelperText,
  TextInput,
  Button,
  ValidatedOptions,
  InputGroup,
  InputGroupItem,
} from '@patternfly/react-core'
import { EyeSlashIcon, EyeIcon } from '@patternfly/react-icons'

export interface TokenFormProps extends Omit<React.HTMLProps<HTMLFormElement>, 'ref'> {
  /** Flag to indicate if the first dropdown item should not gain initial focus */
  noAutoFocus?: boolean
  /** Additional classes added to the login main body's form */
  className?: string
  /** Flag indicating the helper text is visible * */
  showHelperText?: boolean
  /** Content displayed in the helper text component * */
  helperText?: React.ReactNode
  /** Icon displayed to the left in the helper text */
  helperTextIcon?: React.ReactNode
  /** Label for the password input field */
  tokenLabel?: string
  /** Value for the token */
  tokenValue?: string
  /** Function that handles the onChange event for the token */
  onChangeToken?: (event: React.FormEvent<HTMLInputElement>, value: string) => void
  /** Flag indicating if the token is valid */
  isValidToken?: boolean
  /** Flag indicating if the user can toggle hiding the token */
  isShowTokenEnabled?: boolean
  /** Accessible label for the show token button */
  showTokenAriaLabel?: string
  /** Accessible label for the hide token button */
  hideTokenAriaLabel?: string
  /** Label for the log in button input */
  loginButtonLabel?: string
  /** Flag indicating if the login button is disabled */
  isLoginButtonDisabled?: boolean
  /** Function that is called when the login button is clicked */
  onLoginButtonClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
}

export const TokenForm: React.FunctionComponent<TokenFormProps> = ({
  className = '',
  helperText = null,
  tokenLabel = 'Token',
  tokenValue = '',
  onChangeToken = () => {
    /* no-op */
  },
  isShowTokenEnabled = false,
  hideTokenAriaLabel = 'Hide token',
  showTokenAriaLabel = 'Show token',
  isValidToken = true,
  loginButtonLabel = 'Log In',
  isLoginButtonDisabled = false,
  onLoginButtonClick = () => {
    /* no-op */
  },
  ...props
}: TokenFormProps) => {
  const [tokenHidden, setTokenHidden] = React.useState(true)

  const tokenInput = (
    <TextInput
      isRequired
      type={tokenHidden ? 'password' : 'text'}
      id='pf-login-token-id'
      name='pf-login-token-id'
      validated={isValidToken ? ValidatedOptions.default : ValidatedOptions.error}
      value={tokenValue}
      onChange={onChangeToken}
    />
  )

  return (
    <Form className={className} {...props}>
      <FormHelperText>{helperText}</FormHelperText>
      <FormGroup label={tokenLabel} isRequired fieldId='pf-login-token-id'>
        {isShowTokenEnabled && (
          <InputGroup>
            {tokenInput}
            <InputGroupItem>
              <Button
                variant='control'
                onClick={() => setTokenHidden(!tokenHidden)}
                aria-label={tokenHidden ? showTokenAriaLabel : hideTokenAriaLabel}
              >
                {tokenHidden ? <EyeIcon /> : <EyeSlashIcon />}
              </Button>
            </InputGroupItem>
          </InputGroup>
        )}
        {!isShowTokenEnabled && tokenInput}
      </FormGroup>
      <ActionGroup>
        <Button variant='primary' type='submit' onClick={onLoginButtonClick} isBlock isDisabled={isLoginButtonDisabled}>
          {loginButtonLabel}
        </Button>
      </ActionGroup>
    </Form>
  )
}
TokenForm.displayName = 'TokenForm'
