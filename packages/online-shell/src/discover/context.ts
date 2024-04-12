import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import { MgmtActions, isMgmtApiRegistered, mgmtService } from '@hawtio/online-management-api'
import { discoverService } from './discover-service'
import { DiscoverGroup, DiscoverPod, TypeFilter } from './globals'

type UpdateListener = () => void

/**
 * Custom React hook for using filters.
 */
export function useDisplayItems() {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const updateListenerRef = useRef<UpdateListener>()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>()
  const [discoverGroups, setDiscoverGroups] = useState<DiscoverGroup[]>([])
  const [discoverPods, setDiscoverPods] = useState<DiscoverPod[]>([])

  // Set of filters created by filter control and displayed as chips
  const [filters, setFilters] = useState<TypeFilter[]>([])

  const organisePods = useCallback(() => {
    const [discoverGroups, discoverPods] = discoverService.filterAndGroupPods(filters)
    setDiscoverGroups([...discoverGroups])
    setDiscoverPods([...discoverPods])

    setIsLoading(false)
  }, [filters])

  useEffect(() => {
    const waitLoading = async () => {
      await isMgmtApiRegistered()
      if (mgmtService.hasError()) {
        setError(mgmtService.error)
        setIsLoading(false)
        return
      }

      /*
       * First pass:
       *  - mgmtService already has fully initialized pods
       *  - pods partially updated and waiting to complete data from an update
       */
      organisePods()

      const updateListener = () => {
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

  return { error, isLoading, discoverGroups, setDiscoverGroups, discoverPods, setDiscoverPods, filters, setFilters }
}

type DiscoverContext = {
  discoverGroups: DiscoverGroup[]
  setDiscoverGroups: (items: DiscoverGroup[]) => void
  discoverPods: DiscoverPod[]
  setDiscoverPods: (items: DiscoverPod[]) => void
  filters: TypeFilter[]
  setFilters: (filters: TypeFilter[]) => void
}

export const DiscoverContext = createContext<DiscoverContext>({
  discoverGroups: [],
  setDiscoverGroups: () => {
    // no-op
  },
  discoverPods: [],
  setDiscoverPods: () => {
    // no-op
  },
  filters: [],
  setFilters: () => {
    // no-op
  },
})
