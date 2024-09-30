import { mgmtService, ManagedPod } from '@hawtio/online-management-api'
import { DiscoverPod } from './globals'
import { DiscoverProject, DiscoverProjects } from './discover-project'
import { SortOrder } from '@hawtio/online-kubernetes-api'

export enum ViewType {
  listView = 'listView',
  cardView = 'cardView',
}

class DiscoverService {
  private discoverProjects: DiscoverProjects = {}

  groupPods(podOrder?: SortOrder): DiscoverProject[] {
    const projectNames: string[] = []

    Object.values(mgmtService.projects).forEach(mgmtProject => {
      const pods: ManagedPod[] = Object.values(mgmtProject.pods)

      projectNames.push(mgmtProject.name)

      if (!this.discoverProjects[mgmtProject.name]) {
        const discoverProject = new DiscoverProject(mgmtProject.name, mgmtProject.fullPodCount, pods, podOrder)
        this.discoverProjects[mgmtProject.name] = discoverProject
      } else {
        this.discoverProjects[mgmtProject.name].refresh(mgmtProject.fullPodCount, pods, podOrder)
      }
    })

    Object.keys(this.discoverProjects)
      .filter(ns => !projectNames.includes(ns))
      .forEach(ns => {
        delete this.discoverProjects[ns]
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
