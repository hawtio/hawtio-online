/* eslint-disable import/first */
/*
 * Need to disable rule due to using mock class that needs to be undefined
 * before import command
 */
import fs from 'fs'
import path from 'path'

import { KubePod, ObjectMeta, SortOrder } from '@hawtio/online-kubernetes-api'

/**
 * Mock out any references to the oauth module
 */
jest.mock('@hawtio/online-oauth', () => {
  /* no-op */
})

class MockManagementService {}

class MockManagedPod {
  constructor(private kubePod: KubePod) {}

  get metadata(): ObjectMeta | undefined {
    return this.kubePod.metadata
  }

  errorNotify() {
    /* no-op */
  }
}

jest.mock('@hawtio/online-management-api', () => {
  return {
    mgmtService: new MockManagementService(),
    ManagedPod: MockManagedPod,
  }
})

import { ManagedPod } from '@hawtio/online-management-api'
import { DiscoverProject } from './discover-project'

function readPod(fileName: string): ManagedPod {
  const podJsonPath = path.resolve(__dirname, '..', 'testdata', fileName)
  const podResourceJson = fs.readFileSync(podJsonPath, { encoding: 'utf8', flag: 'r' })
  const podResource = JSON.parse(podResourceJson)
  return new ManagedPod(podResource as KubePod)
}

function readPods(limit: number): ManagedPod[] {
  const pods: ManagedPod[] = []
  for (let i = 0; i < limit; ++i) {
    const podTestFile = `quarkus-example-pod${i + 1}.json`
    pods.push(readPod(podTestFile))
  }
  return pods
}

function owner(pod: ManagedPod): string {
  const owner1Refs = pod.metadata?.ownerReferences || []
  expect(owner1Refs.length).toBe(1)
  return owner1Refs[0].name
}

const NAMESPACE = 'hawtio'

describe('discover-project', () => {
  test('name', () => {
    const dp: DiscoverProject = new DiscoverProject(NAMESPACE, 0, [])
    expect(dp.name).toBe(NAMESPACE)
  })

  test('fullPodCount', () => {
    const dp: DiscoverProject = new DiscoverProject(NAMESPACE, 4, [])
    expect(dp.fullPodCount).toBe(4)
  })

  test('pods-no-owner', () => {
    const podTestFile = `quarkus-example-pod5.json`
    const mPod = readPod(podTestFile)
    const dp: DiscoverProject = new DiscoverProject(NAMESPACE, 1, [mPod])
    expect(dp.groups.length).toBe(0)
    expect(dp.pods.length).toBe(1)
  })

  test('groups', () => {
    const mPods = readPods(4)
    const dp: DiscoverProject = new DiscoverProject(NAMESPACE, mPods.length, mPods)
    expect(dp.groups.length).toBe(3)
    dp.groups.forEach((group, idx) => {
      if (idx === 0) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(group.replicas.length).toBe(2)
        // eslint-disable-next-line jest/no-conditional-expect
        expect(group.replicas.filter(pod => pod.name === mPods[0].metadata?.name).length).toBe(1)
        // eslint-disable-next-line jest/no-conditional-expect
        expect(group.replicas.filter(pod => pod.name === mPods[3].metadata?.name).length).toBe(1)
      } else if (idx === 1) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(group.replicas.length).toBe(1)
        // eslint-disable-next-line jest/no-conditional-expect
        expect(group.replicas.filter(pod => pod.name === mPods[1].metadata?.name).length).toBe(1)
      } else if (idx === 2) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(group.replicas.length).toBe(1)
        // eslint-disable-next-line jest/no-conditional-expect
        expect(group.replicas.filter(pod => pod.name === mPods[2].metadata?.name).length).toBe(1)
      }
    })
  })

  test('sort-order', () => {
    const mPods = readPods(4)

    const owner1Name = owner(mPods[0])
    const owner2Name = owner(mPods[1])
    const owner3Name = owner(mPods[2])

    const sortOrder = SortOrder.DESC
    const dp: DiscoverProject = new DiscoverProject(NAMESPACE, mPods.length, mPods, sortOrder)
    expect(dp.groups.length).toBe(3)

    const posOfGrp1 = dp.groups.findIndex(group => group.name === owner1Name)
    const posOfGrp2 = dp.groups.findIndex(group => group.name === owner2Name)
    const posOfGrp3 = dp.groups.findIndex(group => group.name === owner3Name)

    // Sort order is descending by name so order should be
    // [ group2, group3, group1 ]
    expect(posOfGrp2 < posOfGrp3).toBeTruthy()
    expect(posOfGrp2 < posOfGrp1).toBeTruthy()
    expect(posOfGrp3 < posOfGrp1).toBeTruthy()

    // Check the order of pods is descending too
    dp.groups.forEach(group => {
      expect(group.name === owner1Name || group.name === owner2Name || group.name === owner3Name).toBeTruthy()

      switch (group.name) {
        case owner1Name: {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(group.replicas.length).toBe(2)
          const posOfPod1 = group.replicas.findIndex(pod => pod.name === mPods[0].metadata?.name)
          const posOfPod4 = group.replicas.findIndex(pod => pod.name === mPods[3].metadata?.name)

          // Sort order is descending by name so pod1 should be latter in array than pod4
          // eslint-disable-next-line jest/no-conditional-expect
          expect(posOfPod1 > posOfPod4).toBeTruthy()
          break
        }
        case owner2Name:
        case owner3Name:
          // Nothing to do given only 1 pod in these deployments
          break
        default:
          throw new Error('fail(Deployment does not have expected name)')
      }
    })
  })
})
