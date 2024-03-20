import { createContext, useEffect, useRef, useState } from 'react'
import { MgmtActions, isMgmtApiRegistered, mgmtService } from '@hawtio/online-management-api'
import { filterAndGroupPods } from './discover-service'
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

  const organisePods = (discoverGroups: DiscoverGroup[], filters: TypeFilter[]) => {
    const [newDiscoverGroups, newDiscoverPods] = filterAndGroupPods(filters, [...discoverGroups])
    setDiscoverGroups([...newDiscoverGroups])
    setDiscoverPods([...newDiscoverPods])

    newDiscoverGroups.flatMap(discoverGroup =>
      discoverGroup.replicas.map(discoverPod => discoverPod.mPod.errorNotify()),
    )

    newDiscoverPods.map(discoverPod => discoverPod.mPod.errorNotify())
    setIsLoading(false)
  }

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
      organisePods(discoverGroups, filters)

      const updateListener = () => {
        organisePods(discoverGroups, filters)
      }

      mgmtService.on(MgmtActions.UPDATED, updateListener)
      updateListenerRef.current = updateListener
    }

    timerRef.current = setTimeout(waitLoading, 1000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)

      if (updateListenerRef.current) mgmtService.off(MgmtActions.UPDATED, updateListenerRef.current)
    }
  }, []) // One time set-up on mounting

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
