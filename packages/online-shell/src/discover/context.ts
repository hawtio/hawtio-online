import { createContext, useEffect, useRef, useState } from "react"
import { k8Api, k8Service } from "@hawtio/online-kubernetes-api"
import { MgmtActions, isMgmtApiRegistered, mgmtService } from "@hawtio/online-management-api"
import { filterAndGroupPods } from './discover-service'
import { DiscoverGroup, DiscoverPod, TypeFilter } from './globals'

/**
 * Custom React hook for using filters.
 */
export function useDisplayItems() {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>()
  const [discoverGroups, setDiscoverGroups] = useState<DiscoverGroup[]>([])
  const [discoverPods, setDiscoverPods] = useState<DiscoverPod[]>([])

  // Set of filters created by filter control and displayed as chips
  const [filters, setFilters] = useState<TypeFilter[]>([])

  useEffect(() => {
    setIsLoading(true)

    const checkLoading = async () => {
      const mgmtLoaded = await isMgmtApiRegistered()

      if (!mgmtLoaded) return

      setIsLoading(false)

      if (k8Api.hasError()) {
        setError(k8Api.error)
        return
      }

      if (k8Service.hasError()) {
        setError(k8Service.error)
        return
      }

      const organisePods = () => {
        const [newDiscoverGroups, newDiscoverPods] = filterAndGroupPods(filters, [...discoverGroups])
        setDiscoverGroups([...newDiscoverGroups])
        setDiscoverPods([...newDiscoverPods])
      }

      organisePods()

      mgmtService.on(MgmtActions.UPDATED, () => {
        organisePods()
      })
    }

    checkLoading()

    timerRef.current = setTimeout(checkLoading, 1000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { error, isLoading, discoverGroups, setDiscoverGroups, discoverPods, setDiscoverPods, filters, setFilters }
}

type DiscoverContext = {
  discoverGroups: DiscoverGroup[],
  setDiscoverGroups: (items: DiscoverGroup[]) => void,
  discoverPods: DiscoverPod[],
  setDiscoverPods: (items: DiscoverPod[]) => void,
  filters: TypeFilter[],
  setFilters: (filters: TypeFilter[]) => void
}

export const DiscoverContext = createContext<DiscoverContext>({
  discoverGroups: [],
  setDiscoverGroups: (groups: DiscoverGroup[]) => {},
  discoverPods: [],
  setDiscoverPods: (pod: DiscoverPod[]) => {},
  filters: [],
  setFilters: (filters: TypeFilter[]) => {}
})
