import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import { TypeFilter } from '@hawtio/online-kubernetes-api'
import { MgmtActions, isMgmtApiRegistered, mgmtService } from '@hawtio/online-management-api'
import { discoverService } from './discover-service'
import { DiscoverProject } from './discover-project'

type UpdateListener = () => void

/**
 * Custom React hook for using filters.
 */
export function useDisplayItems() {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const updateListenerRef = useRef<UpdateListener>()

  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(true)
  const [error, setError] = useState<Error | null>()
  const [discoverProjects, setDiscoverProjects] = useState<DiscoverProject[]>([])

  // type filter created by filter control and displayed as chips
  const [filter, setFilter] = useState<TypeFilter>(new TypeFilter())

  const organisePods = useCallback(() => {
    const discoverProjects = discoverService.groupPods()
    setDiscoverProjects([...discoverProjects])

    setIsLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    const waitLoading = async () => {
      await isMgmtApiRegistered()
      if (mgmtService.hasError()) {
        setError(mgmtService.error)
        setIsLoading(false)
        setRefreshing(false)
        return
      }

      /*
       * First pass:
       *  - mgmtService already has fully initialized pods
       *  - pods partially updated and waiting to complete data from an update
       */
      organisePods()

      const updateListener = () => {
        setRefreshing(true)
        organisePods()
      }

      mgmtService.on(MgmtActions.UPDATED, updateListener)
      updateListenerRef.current = updateListener
    }

    timerRef.current = setTimeout(waitLoading, 1000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)

      if (updateListenerRef.current) mgmtService.off(MgmtActions.UPDATED, updateListenerRef.current)
    }
  }, [organisePods])

  return { error, isLoading, refreshing, setRefreshing, discoverProjects, setDiscoverProjects, filter, setFilter }
}

type DiscoverContext = {
  refreshing: boolean
  setRefreshing: (refresh: boolean) => void
  discoverProjects: DiscoverProject[]
  setDiscoverProjects: (projects: DiscoverProject[]) => void
  filter: TypeFilter
  setFilter: (filter: TypeFilter) => void
}

export const DiscoverContext = createContext<DiscoverContext>({
  refreshing: false,
  setRefreshing: (refresh: boolean) => {
    // no-op
  },
  discoverProjects: [],
  setDiscoverProjects: () => {
    // no-op
  },
  filter: new TypeFilter(),
  setFilter: () => {
    // no-op
  },
})
