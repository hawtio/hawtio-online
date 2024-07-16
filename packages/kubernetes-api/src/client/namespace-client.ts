import jsonpath from 'jsonpath'
import { JOLOKIA_PORT_QUERY, KubeObject, KubePod, PagingMetadata } from "../globals"
import { WatchTypes } from "../model"
import { SimpleResponse, isObject, isString } from "../utils"
import { PagingMetadataImpl } from '../paging-metadata-impl'
import { Collection, KOptions, ProcessDataCallback } from './globals'
import { clientFactory } from './client-factory'

export type NamespaceClientCallback = (jolokiaPods: KubePod[], pagingMetadata: PagingMetadata, error?: Error) => void

export interface Client<T extends KubeObject> {
  collection: Collection<T>
  watch: ProcessDataCallback<T>
}

interface PodsResult {
  id: number
  podsClient: Client<KubePod>
  jolokiaPods: KubePod[]
}

interface PodsResults {
  [key: string]: PodsResult
}

export class NamespaceClient {
  private _namespace
  private _limit
  private _pagingMetadata: PagingMetadataImpl
  private _podsResults: PodsResults = {}
  private _callback: NamespaceClientCallback

  constructor(namespace: string, limit: number, callback: NamespaceClientCallback, pagingMetadata?: PagingMetadata) {
    this._namespace = namespace
    this._limit = limit
    this._callback = callback
    if (isObject(pagingMetadata)) {
      this._pagingMetadata = pagingMetadata as PagingMetadataImpl
      /*
       * 2 use-cases:
       * - 1. First Execution of pods in namespace so current is uninitialized
       * - 2. PagingRef returned to by using Prev/Next so need to refresh except
       *      for continueRef
       */
       this._pagingMetadata.refresh()

    } else {
      // pagingMetadata never been defined for the namespace
      this._pagingMetadata = new PagingMetadataImpl()
    }
  }

  /*
   * Updates the paging metadata with the results of the pod search
   */
  private updatePaging(iteration: number, jolokiaPods: KubePod[], limit: number, continueRef?: string): string|undefined {
    if (! this._pagingMetadata.pageSelected()) {
      // current page not yet defined in pagingMetadata (1st execution)
      // Add paging reference for the current query of pods
      return this._pagingMetadata.addPage(jolokiaPods.length, limit, continueRef)
    }

    // current page already defined so update with latest information

    if (iteration === 0) {
      // As the 1st iteration, store the count of the number of pods
      this._pagingMetadata.setCount(jolokiaPods.length)
    }

    return this._pagingMetadata.resolveContinue(jolokiaPods.length, limit, continueRef)
  }

  private handleError(iteration: number, error: Error, response: SimpleResponse|undefined) {
    console.log('Error: pods_watch error', error)

    if (isObject(response) && response.status === 410) {
      console.log('Renewing gone connection 410: ', iteration)
      // Need to renew the continueRef property given the continue in the response

      if (iteration === 0 && this._pagingMetadata.hasContinue()) {
        console.log('Refreshing iteration 0')
        // The first execution used a continue ref that is now invalid
        let continueRef
        if (response.data) {
          const dataObj = JSON.parse(response.data)
          continueRef = dataObj?.metadata?.continue
        }

        console.log('Old continueRef: ', this._pagingMetadata.continue())
        console.log('New continueRef: ', continueRef)
        this._pagingMetadata.setContinue(continueRef)
      }

      // Destroy the pod results
      this.destroy()
      // Refresh the metadata
      this._pagingMetadata.refresh()
      // Restart the execution
      this.execute()
    } else {
      // Some other error has occurred
      this._callback([], this._pagingMetadata, error)

      // Destroy the polling connections
      this.destroy()
    }
  }

  initPodOptions(iteration: number, limit: number, continueRef: string|undefined): KOptions {
    const podOptions: KOptions = {
      kind: WatchTypes.PODS,
      namespace: this._namespace,
      nsLimit: limit,
      error: (err: Error, response?: SimpleResponse) => { this.handleError(iteration, err, response)}
    }

    /*
     * See if a continue reference is needed and add to podOptions
     * The query requires a continue reference in order to start the search
     * at the correct index of the pod list
     */
    if (isString(continueRef) && continueRef.length > 0)
      podOptions.continueRef = continueRef

    return podOptions
  }

  private executeInternal(iteration: number, limit: number, podOptions: KOptions) {

    // Query the namespace for pods
    const pods_client = clientFactory.create<KubePod>(podOptions)
    const pods_watch = pods_client.watch((pods, resultMetadata) => {
      const jolokiaPods = pods.filter(pod => jsonpath.query(pod, JOLOKIA_PORT_QUERY).length > 0)

      // Add the found jolokia pods
      const podResult = this._podsResults[iteration.toString()]
      if (isObject(podResult))
        podResult.jolokiaPods = [...jolokiaPods]

      /*
       * If a continueRef is returned then it means that
       * not enough jolokia pods were found to match the limit but
       * that there are more pods available to be fetched and tested.
       * So prepare another execution to fetch another set of pods
       */
      const continueRef = this.updatePaging(iteration, jolokiaPods, limit, resultMetadata?.continue)
      if (isString(continueRef)) {
        const newLimit = limit - jolokiaPods.length
        const newOptions = this.initPodOptions((iteration + 1), newLimit, continueRef)
        this.executeInternal((iteration + 1), newLimit, newOptions)
      } else {
        /*
         * Execution is completed so return the callback.
         * Should be called just once from the main execute call and not
         * any subsequent chained executions
         */
        this._callback(this.getJolokiaPods(), this._pagingMetadata)
      }
    })

    pods_client.connect()

    this._podsResults[iteration.toString()] = {
      id: iteration,
      podsClient: {
        collection: pods_client,
        watch: pods_watch,
      },
      jolokiaPods: []
    }
  }

  execute() {
    const podOptions = this.initPodOptions(0, this._limit, this._pagingMetadata.continueRef())
    this.executeInternal(0, this._limit, podOptions)
  }

  getJolokiaPods() {
    const pods: KubePod[] = []
    for (const pr of Object.values(this._podsResults)) {
      pods.push(...pr.jolokiaPods)
    }

    return pods
  }

  destroy() {
    if (Object.values(this._podsResults).length === 0)
      return

    for (const pr of Object.values(this._podsResults)) {
      const pods_client = pr.podsClient
      clientFactory.destroy(pods_client.collection, pods_client.watch)
      pr.jolokiaPods = []
    }

    this._podsResults = {}
  }
}
