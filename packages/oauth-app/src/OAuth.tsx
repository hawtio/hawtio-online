import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthLoginPage } from './login'
import { OAuthStatus } from './OAuthStatus'

export const OAuth: React.FunctionComponent = () => {

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/login' element={<AuthLoginPage />} />
        <Route path='/*' element={<OAuthStatus />} />
      </Routes>
    </BrowserRouter>
  )
}
