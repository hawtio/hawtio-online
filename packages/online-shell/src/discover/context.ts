import { createContext, useEffect, useRef, useState } from 'react'
import { k8Api, k8Service } from '@hawtio/online-kubernetes-api'
import { MgmtActions, isMgmtApiRegistered, mgmtService } from '@hawtio/online-management-api'
import { filterAndGroupPods } from './discover-service'
import { DiscoverGroup, DiscoverPod, TypeFilter } from './globals'

type UpdateListener = () => void

/**
 * Custom React hook for using filters.
 */
export function useDisplayItems() {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [isMounting, setIsMounting] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>()
  const [discoverGroups, setDiscoverGroups] = useState<DiscoverGroup[]>([])
  const [discoverPods, setDiscoverPods] = useState<DiscoverPod[]>([])

  // Set of filters created by filter control and displayed as chips
  const [filters, setFilters] = useState<TypeFilter[]>([])
  const updateListener = useRef<UpdateListener>()

  const organisePods = (discoverGroups: DiscoverGroup[], filters: TypeFilter[]) => {
    const [newDiscoverGroups, newDiscoverPods] = filterAndGroupPods(filters, [...discoverGroups])
    setDiscoverGroups([...newDiscoverGroups])
    setDiscoverPods([...newDiscoverPods])
  }

  useEffect(() => {
    setIsMounting(true)

    const checkLoading = async () => {
      const mgmtLoaded = await isMgmtApiRegistered()

      if (!mgmtLoaded) return

      if (k8Api.hasError()) {
        setError(k8Api.error)
        setIsMounting(false)
        return
      }

      if (k8Service.hasError()) {
        setError(k8Service.error)
        setIsMounting(false)
        return
      }

      //
      // First-time update pod organisation
      //
      organisePods([], [])
      setIsMounting(false)
    }

    checkLoading()

    timerRef.current = setTimeout(checkLoading, 1000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, []) // One time set-up on mounting

  /*
   * Hook-up the pod organisation to the UPDATED listener
   * event of the ManagementService
   *
   * Ensures that the number of registered listeners is
   * managed properly and stale listeners are not left registered
   */
  useEffect(() => {
    const mgmtListener = () => {
      organisePods(discoverGroups, filters)
      // Listener inited so loading now complete
      setIsLoading(false)
    }

    mgmtService.on(MgmtActions.UPDATED, mgmtListener)
    updateListener.current = mgmtListener

    return () => {
      if (updateListener.current) mgmtService.off(MgmtActions.UPDATED, updateListener.current)
    }
  }, [isMounting, filters, discoverGroups])

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
