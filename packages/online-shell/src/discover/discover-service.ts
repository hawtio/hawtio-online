import { mgmtService, MPodsByUid, TypeFilterType, TypeFilter } from '@hawtio/online-management-api'
import { DiscoverPod } from './globals'
import { DiscoverProject, DiscoverProjects } from './discover-project'
import { ManagedProject } from '@hawtio/online-management-api'

export enum ViewType {
  listView = 'listView',
  cardView = 'cardView',
}

class DiscoverService {
  private discoverProjects: DiscoverProjects = {}

  filterAndGroupPods(filters: TypeFilter[]): DiscoverProject[] {
    /*
     * Find all the namespace filters and reduce them together
     */
    const nsFilters = filters.filter(f => f.type === TypeFilterType.NAMESPACE)
    let nsFilter: TypeFilter | undefined
    if (nsFilters.length === 0) nsFilter = undefined
    else {
      nsFilter = nsFilters.reduceRight((accumulator, currentValue, currentIndex, array) => {
        currentValue.values.forEach(v => accumulator.values.add(v))
        return accumulator
      })
    }

    const podFilters = filters.filter(f => f.type === TypeFilterType.NAME)

    const filteredProjects: ManagedProject[] = []

    Object.values(mgmtService.projects).forEach(mgmtProject => {
      if (!nsFilter) {
        filteredProjects.push(mgmtProject)
        return
      }

      /*
       * Namespace filter values will be tested as an OR filter
       * This corresponds to Patternfly design guidelines that
       * "[...] there is an "AND" relationship between facets,
       *  and an "OR" relationship between values."
       * (https://www.patternfly.org/patterns/filters/design-guidelines/#filter-group)
       */
      let exclude = true
      nsFilter.values.forEach(v => {
        if (mgmtProject.name.includes(v)) {
          filteredProjects.push(mgmtProject)
          exclude = false
        }
      })

      if (exclude) {
        /*
         * By removing any projects that do not correspond to the namespace
         * filter we are effectively doing an AND test with the name filter below
         *
         * ie. if the project fails the namespace filter then it should not
         *     even be tested against the name filter
         */
        delete this.discoverProjects[mgmtProject.name]
      }
    })

    filteredProjects.forEach(mgmtProject => {
      const podsByUid: MPodsByUid = mgmtProject.pods

      const filtered = Object.values(podsByUid).filter(pod => {
        if (podFilters.length === 0) return true

        for (const f of podFilters) {
          if (pod.filter(f)) {
            return true // Include as it conforms to at least one filter
          }
        }

        return false
      })

      if (filtered.length === 0) {
        // Remove the project as no longer contains any pods
        if (this.discoverProjects[mgmtProject.name]) {
          delete this.discoverProjects[mgmtProject.name]
        }
        return
      }

      if (!this.discoverProjects[mgmtProject.name]) {
        const discoverProject = new DiscoverProject(mgmtProject.name, mgmtProject.podTotal, filtered)
        this.discoverProjects[mgmtProject.name] = discoverProject
      } else {
        this.discoverProjects[mgmtProject.name].refresh(filtered)
      }
    })

    return Object.values(this.discoverProjects)
  }

  getStatus(pod: DiscoverPod): string {
    return mgmtService.podStatus(pod.mPod)
  }

  unwrap(error: Error): string {
    if (!error) return 'unknown error'
    if (error.cause instanceof Error) return this.unwrap(error.cause)
    return error.message
  }
}

export const discoverService = new DiscoverService()
