import { ExclamationCircleIcon } from '@patternfly/react-icons'
import React, { useState } from 'react'
import { log } from '../../globals'
import { TokenForm } from './TokenForm'
import { formAuthLoginService } from './form-auth-login-service'

/**
 * Designed to be added as a child of HawtioLogin (hawtio/react)
 * by providing its config in hawtconfig.json
 */
export const FormAuthLoginForm: React.FunctionComponent = () => {
  const [loginFailed, setLoginFailed] = useState(false)
  const [token, setToken] = React.useState('')
  const [isValidToken, setIsValidToken] = React.useState(true)

  const loginFailedMessage = 'Invalid login credentials'

  const reset = () => {
    setIsValidToken(true)
    setLoginFailed(false)
  }

  const onLoginButtonClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault()
    reset()

    let invalid = false
    if (token === '') {
      setIsValidToken(false)
      setLoginFailed(true)
      invalid = true
    }

    if (invalid) return

    formAuthLoginService.login(token, {
      success: function (): void {
        log.info('Login succeeded')
      },
      error: function (err: Error): void {
        log.error(err)
        setIsValidToken(false)
        setLoginFailed(true)
      },
    })
  }

  return (
    <TokenForm
      showHelperText={loginFailed}
      helperText={loginFailedMessage}
      helperTextIcon={<ExclamationCircleIcon />}
      tokenValue={token}
      onChangeToken={(_event, value) => setToken(value)}
      isValidToken={isValidToken}
      onLoginButtonClick={onLoginButtonClick}
      loginButtonLabel='Log in'
    />
  )
}
