/* eslint-disable import/first */
/*
 * Need to disable rule due to using mock class that needs to be undefined
 * before import command
 */

import path from 'path'
import fs from 'fs'
import { KubeObject, KubePod } from '../globals'
import { TypeFilter } from '../filter'
import { SortOrder } from '../sort'
import { KOptions, ProcessDataCallback } from './globals'
import { getKey } from './support'

// To be populated each test
let namespacedPods: KubePod[] = []

// To mock CollectionImpl and avoid any network connecting
class MockCollectionImpl {
  constructor(private _options: KOptions) {}

  get connected(): boolean {
    return true
  }

  getKey() {
    return getKey(this._options.kind, this._options.namespace, this._options.name)
  }

  connect() {
    // no-op
  }

  watch(watchCb: ProcessDataCallback<KubeObject>): ProcessDataCallback<KubeObject> {
    if (!this._options.name) {
      // No name so this is a namespace client
      setTimeout(() => {
        watchCb(namespacedPods)
      }, 100)
    } else {
      // Name defined so this is a named pod client
      setTimeout(() => {
        const namedPods = namespacedPods.filter(pod => pod.metadata?.name === this._options.name)
        watchCb(namedPods)
      }, 100)
    }

    return watchCb
  }

  unwatch(cb: ProcessDataCallback<KubeObject>) {
    // no-op
  }

  destroy() {
    // no-op
  }
}

jest.mock('./collection', () => {
  return {
    CollectionImpl: MockCollectionImpl,
  }
})

// Import after the MockCollectionImpl class has been defined
import { NamespaceClient } from './namespace-client'

function readPods(limit: number): KubePod[] {
  const pods: KubePod[] = []
  for (let i = 0; i < limit; ++i) {
    const podTestFile = `quarkus-example-pod${i + 1}.json`
    const podJsonPath = path.resolve(__dirname, '..', 'testdata', podTestFile)
    const podResourceJson = fs.readFileSync(podJsonPath, { encoding: 'utf8', flag: 'r' })
    const podResource = JSON.parse(podResourceJson)
    pods.push(podResource as KubePod)
  }
  return pods
}

const NAMESPACE = 'hawtio'

let nc: NamespaceClient

describe('namespace-client', () => {
  afterEach(() => {
    if (nc) nc.destroy()
  })

  test('getNamespace', () => {
    const cb = (_: KubePod[], __: number) => {
      // Nothing to do
    }

    nc = new NamespaceClient(NAMESPACE, cb)
    expect(nc.namespace).toBe(NAMESPACE)
  })

  test('not-connected-emptyJolokiaPods', () => {
    const cb = (_: KubePod[], __: number) => {
      // Nothing to do
    }

    nc = new NamespaceClient(NAMESPACE, cb)
    expect(nc.isConnected()).toEqual(false)
    expect(nc.getJolokiaPods()).toEqual([])
  })

  test('connect-default', done => {
    const nsLimit = 3

    // Read in the test pods
    namespacedPods = readPods(2)

    // Callback used for the namespace client - use done() to restrict the test
    const cb = (jolokiaPods: KubePod[], fullPodCount: number) => {
      expect(fullPodCount).toBe(namespacedPods.length)

      // Expect jolokiaPods to be limited by the page limit
      expect(jolokiaPods.length).toBe(namespacedPods.length > nsLimit ? nsLimit : namespacedPods.length)

      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[0].metadata?.uid)).not.toBe(-1)
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[1].metadata?.uid)).not.toBe(-1)
      done()
    }

    nc = new NamespaceClient(NAMESPACE, cb)
    nc.connect(nsLimit)
    expect(nc.isConnected()).toEqual(true)
  })

  test('connect-page-limited', done => {
    const nsLimit = 3

    // Read in the test pods
    namespacedPods = readPods(4)

    // Callback used for the namespace client - use done() to restrict the test
    const cb = (jolokiaPods: KubePod[], fullPodCount: number) => {
      expect(fullPodCount).toBe(namespacedPods.length)

      // Expect jolokiaPods to be limited by the page limit
      expect(jolokiaPods.length).toBe(namespacedPods.length > nsLimit ? nsLimit : namespacedPods.length)

      // Expect the first 3 pods to be present
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[0].metadata?.uid)).not.toBe(-1)
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[1].metadata?.uid)).not.toBe(-1)
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[2].metadata?.uid)).not.toBe(-1)

      // Expect the 4th pod to not be present since it is on the 2nd page
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[3].metadata?.uid)).toBe(-1)

      done()
    }

    nc = new NamespaceClient(NAMESPACE, cb)
    nc.connect(nsLimit)
    expect(nc.isConnected()).toEqual(true)
  })

  test('connect-raise-the-page-limit', done => {
    const nsLimit = 4

    // Read in the test pods
    namespacedPods = readPods(4)

    // Callback used for the namespace client - use done() to restrict the test
    const cb = (jolokiaPods: KubePod[], fullPodCount: number) => {
      expect(fullPodCount).toBe(namespacedPods.length)

      // Expect jolokiaPods to be limited by the page limit
      expect(jolokiaPods.length).toBe(namespacedPods.length > nsLimit ? nsLimit : namespacedPods.length)

      // Expect the first 4 pods to all be present
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[0].metadata?.uid)).not.toBe(-1)
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[1].metadata?.uid)).not.toBe(-1)
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[2].metadata?.uid)).not.toBe(-1)
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[3].metadata?.uid)).not.toBe(-1)

      done()
    }

    nc = new NamespaceClient(NAMESPACE, cb)
    nc.connect(nsLimit)
    expect(nc.isConnected()).toEqual(true)
  })

  test('connect-then-filter-4-3', done => {
    const nsLimit = 3

    // Read in the test pods
    namespacedPods = readPods(4)

    // Callback used for the namespace client - use done() to restrict the test
    const cb = (jolokiaPods: KubePod[], fullPodCount: number) => {
      if (fullPodCount === 4) {
        /*
         * On return of connect() through the callback initiate the filter call
         */
        nc.filter(new TypeFilter([], ['zzzzz']))
        return
      }

      /*
       * Since this was a filter we get a callback from notifyChange
       * which is necessary if the case where the filter returns the
       * same number of pods as the previous collection. However, we
       * still need to wait for the 4th previously unwatched pod to
       * be added to the collection and so call this callback again.
       */
      if (jolokiaPods.length < 3) {
        return
      }

      // filter should only return 3 pods
      expect(fullPodCount).toBe(3)
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[1].metadata?.uid)).not.toBe(-1)
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[2].metadata?.uid)).not.toBe(-1)
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[3].metadata?.uid)).not.toBe(-1)

      // Expect the first pod to not be present since it does not conform to the filter
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[0].metadata?.uid)).toBe(-1)

      done()
    }

    nc = new NamespaceClient(NAMESPACE, cb)
    nc.connect(nsLimit)
    expect(nc.isConnected()).toEqual(true)
  })

  test('connect-then-filter-4-1', done => {
    const nsLimit = 3

    // Read in the test pods
    namespacedPods = readPods(4)

    // Callback used for the namespace client - use done() to restrict the test
    const cb = (jolokiaPods: KubePod[], fullPodCount: number) => {
      if (fullPodCount === 4) {
        /*
         * On return of connect() through the callback initiate the filter call
         */
        nc.filter(new TypeFilter([], ['4wdlk']))
        return
      }

      /*
       * Since this was a filter we get a callback from notifyChange
       * which is necessary if the case where the filter returns the
       * same number of pods as the previous collection. However, we
       * still need to wait for the 4th previously unwatched pod to
       * be added to the collection and so call this callback again.
       */
      if (jolokiaPods.length !== 1) {
        return
      }

      // filter should only return 3 pods
      expect(fullPodCount).toBe(1)

      // Expect the first pod to be present since it only conforms to the filter
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[0].metadata?.uid)).not.toBe(-1)

      done()
    }

    nc = new NamespaceClient(NAMESPACE, cb)
    nc.connect(nsLimit)
    expect(nc.isConnected()).toEqual(true)
  })

  test('connect-then-sort-4', done => {
    const nsLimit = 3

    // Read in the test pods
    namespacedPods = readPods(4)

    let firstCallbackComplete = false

    // Callback used for the namespace client - use done() to restrict the test

    const cb = (jolokiaPods: KubePod[], fullPodCount: number) => {
      if (!firstCallbackComplete) {
        /*
         * On return of connect() through the callback initiate the sort call
         */
        firstCallbackComplete = true
        nc.sort(SortOrder.DESC)
        return
      }

      /*
       * Since this was a sort we get a callback from notifyChange
       * which is necessary if the case where the sort returns the
       * same number of pods as the previous collection. However, we
       * still need to wait for the last previously unwatched pod to
       * be added to the collection and so call this callback again.
       */
      if (jolokiaPods.length < 3) {
        return
      }

      // paging should only return 3 pods in the right order
      expect(jolokiaPods.length).toBe(3)

      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[1].metadata?.uid)).toBe(2)
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[2].metadata?.uid)).toBe(1)
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[3].metadata?.uid)).toBe(0)

      /*
       * Expect the first pod to not be present since it is now last
       * due to the sort and not included in the first page
       */
      expect(jolokiaPods.findIndex(pod => pod.metadata?.uid === namespacedPods[0].metadata?.uid)).toBe(-1)

      done()
    }

    nc = new NamespaceClient(NAMESPACE, cb)
    nc.connect(nsLimit)
    expect(nc.isConnected()).toEqual(true)
  })
})
