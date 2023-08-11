import { K8Actions, KubeObject, KubePod, isK8ApiRegistered, k8Api, k8Service } from "@hawtio/online-kubernetes-api"
import { createContext, useEffect, useRef, useState } from "react"
import { DisplayGroup, DisplayPod, TypeFilter, filterAndGroupPods } from './discover-service'

/**
 * Custom React hook for using filters.
 */
export function useDisplayItems() {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>()

  const [pods, setPods] = useState<KubePod[]>([])
  const [displayGroups, setDisplayGroups] = useState<DisplayGroup[]>([])
  const [displayPods, setDisplayPods] = useState<DisplayPod[]>([])

  // Set of filters created by filter control and displayed as chips
  const [filters, setFilters] = useState<TypeFilter[]>([])

  useEffect(() => {
    setIsLoading(true)

    const checkLoading = async () => {
      const k8Loaded = await isK8ApiRegistered()

      if (!k8Loaded) return

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
        const pods = k8Service.getPods()
        setPods(pods)

        const [newDisplayGroups, newDisplayPods] = filterAndGroupPods(pods, filters, [...displayGroups])
        setDisplayGroups(newDisplayGroups)
        setDisplayPods(newDisplayPods)
      }

      organisePods()

      k8Service.on(K8Actions.CHANGED, () => {
        organisePods()
      })

      // TODO
      // managementService.on ....
    }

    checkLoading()

    timerRef.current = setTimeout(checkLoading, 1000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { error, isLoading, pods, displayGroups, setDisplayGroups, displayPods, setDisplayPods, filters, setFilters }
}

type DiscoverContext = {
  pods: KubePod[],
  displayGroups: DisplayGroup[],
  setDisplayGroups: (items: DisplayGroup[]) => void,
  displayPods: DisplayPod[],
  setDisplayPods: (items: DisplayPod[]) => void,
  filters: TypeFilter[],
  setFilters: (filters: TypeFilter[]) => void
}

export const DiscoverContext = createContext<DiscoverContext>({
  pods: [],
  displayGroups: [],
  setDisplayGroups: (groups: DisplayGroup[]) => {},
  displayPods: [],
  setDisplayPods: (pod: DisplayPod[]) => {},
  filters: [],
  setFilters: (filters: TypeFilter[]) => {}
})
