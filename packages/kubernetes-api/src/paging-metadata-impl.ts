import { PagingMetadata } from './globals'
import { isObject, isString } from './utils'

export interface PagingRef {
  count: number
  continue?: string
}

export class PagingMetadataImpl implements PagingMetadata {
  private _current = 0
  private pagingRefs: PagingRef[] = []

  private numPages(): number {
    return this.pagingRefs.length
  }

  private isContinueRef(continueRef?: string): boolean {
    return isString(continueRef) && continueRef.length > 0
  }

  pageSelected(): boolean {
    // current page not yet defined if current same/bigger than number of pages
    return this.numPages() > 0 && this._current < this.numPages()
  }

  hasContinue(): boolean {
    if (this.numPages() <= this._current) return false

    const pagingRef = this.pagingRefs[this._current]
    return this.isContinueRef(pagingRef.continue)
  }

  continue(): string | undefined {
    if (this.numPages() <= this._current) return undefined

    const pagingRef = this.pagingRefs[this._current]
    return pagingRef.continue
  }

  setContinue(continueRef?: string) {
    if (this.numPages() <= this._current) return

    const pagingRef = this.pagingRefs[this._current]
    pagingRef.continue = continueRef
  }

  refresh() {
    if (this.numPages() <= this._current) return

    const pagingRef = this.pagingRefs[this._current]
    pagingRef.count = -1

    // Retain the continueRef since that was set by previous to current

    if (this._current + 1 < this.numPages()) {
      // Remove all next paging refs as they are potentially out-of-date
      this.pagingRefs = this.pagingRefs.slice(0, this._current + 1)
    }
  }

  resolveContinue(count: number, required: number, continueRef: string | undefined): string | undefined {
    if (!this.isContinueRef(continueRef)) return undefined

    const enoughPods = required - count === 0
    if (!enoughPods) {
      // Not enough pods were found to satisfy the required number
      // so need to return the continueRef to find some more
      return continueRef
    }

    // The correct number of pods has been found.
    // Add the continue reference to the 'next' page as there are possibly more
    // jolokia pods to be requested when the next() page is required

    const next = this._current + 1
    if (this.numPages() > next) {
      // Replace an existing next page with a new continue ref

      // Remove all paging refs after current since a new query has been
      // made and a new continue ref is being added
      this.pagingRefs = this.pagingRefs.slice(0, next)
    }

    // Adds a new 'next' paging reference
    this.pagingRefs.push({ count: -1, continue: continueRef })

    // Enough pods found, don't return the continueRef as saved for next page
    return undefined
  }

  addPage(count: number, required: number, continueRef: string | undefined): string | undefined {
    const pagingRefLen = this.pagingRefs.push({ count: count })
    this._current = pagingRefLen - 1

    return this.resolveContinue(count, required, continueRef)
  }

  count(index?: number): number {
    if (!index) index = this._current

    if (this.numPages() <= index) return -1

    const pagingRef = this.pagingRefs[index]
    return pagingRef.count
  }

  setCount(count: number) {
    if (this.numPages() <= this._current) return

    const pagingRef = this.pagingRefs[this._current]
    pagingRef.count = count
  }

  continueRef(index?: number): string | undefined {
    if (!index) index = this._current

    if (this.numPages() <= index) return undefined

    const pagingRef = this.pagingRefs[index]
    return pagingRef.continue
  }

  hasPrevious(): boolean {
    if (this._current === 0) return false

    const pagingRef = this.pagingRefs[this._current - 1]
    return isObject(pagingRef)
  }

  /**
   * Moves current back 1 to get the previous paging metadata
   */
  previous() {
    if (this._current === 0) return

    if (!this.hasPrevious()) return

    --this._current
  }

  hasNext(): boolean {
    if (this.numPages() <= this._current + 1) return false

    const nextRef = this.pagingRefs[this._current + 1]
    return isObject(nextRef) && this.isContinueRef(nextRef.continue)
  }

  /**
   * Moves current forward 1 to get the next paging metadata
   */
  next() {
    if (this._current === this.numPages() - 1) return

    if (!this.hasNext()) return

    ++this._current
  }
}
