import { useEffect, useState } from 'react'
import { userService } from '@hawtio/react'

/**
 * Custom React hook for using Hawtio plugins.
 */
export function useUser() {
  const [username, setUsername] = useState('')
  const [isLogin, setIsLogin] = useState(false)
  const [userLoaded, setUserLoaded] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      // Try syncing the login status with the server here
      await userService.fetchUser()

      const username = await userService.getUsername()
      const isLogin = await userService.isLogin()
      setUsername(username)
      setIsLogin(isLogin)
      setUserLoaded(true)
    }
    fetchUser()
  }, [])

  return { username, isLogin, userLoaded }
}
