export enum TypeFilterType {
  NAME = 'Name',
  NAMESPACE = 'Namespace',
}

export function typeFilterTypeValueOf(str: string): TypeFilterType | undefined {
  switch (str) {
    case TypeFilterType.NAME:
      return TypeFilterType.NAME
    case TypeFilterType.NAMESPACE:
      return TypeFilterType.NAMESPACE
    default:
      return undefined
  }
}

export class TypeFilter {
  private _nsValues: Set<string>
  private _nameValues: Set<string>

  constructor(nsValues?: string[], nameValues?: string[]) {
    this._nsValues = new Set(nsValues ?? [])
    this._nameValues = new Set(nameValues ?? [])
  }

  get nsValues(): string[] {
    return Array.from(this._nsValues)
  }

  addNSValue(ns: string) {
    this._nsValues.add(ns)
  }

  deleteNSValue(ns: string) {
    this._nsValues.delete(ns)
  }

  get nameValues(): string[] {
    return Array.from(this._nameValues)
  }

  addNameValue(name: string) {
    this._nameValues.add(name)
  }

  deleteNameValue(name: string) {
    this._nameValues.delete(name)
  }

  filterNS(ns: string): boolean {
    if (this._nsValues.size === 0) return true

    let resolved = false
    this._nsValues.forEach(v => {
      if (ns.includes(v)) resolved = true
    })

    return resolved
  }

  filterPod(podName: string): boolean {
    if (this._nameValues.size === 0) return true

    let resolved = false
    this._nameValues.forEach(v => {
      if (podName.includes(v)) resolved = true
    })

    return resolved
  }
}
