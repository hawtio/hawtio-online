import { cloneObject } from '../utils'
import { WatchTypes } from '../model'
import { Collection, CompareResult, KOptions, log, NO_KIND, NO_OBJECT, NO_OBJECTS } from './globals'
import { equals, fullName, getApiVersion, getKind, getName, getNamespace, namespaced, toCollectionName, toKindName } from '../helpers'
import { clientFactory } from './client-factory'

export function getKey(kind: string, namespace?: string) {
  return namespace ? namespace + '-' + kind : kind
}

export function compare(old: Array<any>, _new: Array<any>): CompareResult {
  const answer = <CompareResult>{
    added: [],
    modified: [],
    deleted: []
  }
  _new.forEach((newObj) => {
    const oldObj = old.find((o) => equals(o, newObj))
    if (!oldObj) {
      answer.added.push(newObj)
      return
    }
    if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
      answer.modified.push(newObj)
    }
  })
  old.forEach((oldObj) => {
    const newObj = _new.find((o) => equals(o, oldObj))
    if (!newObj) {
      answer.deleted.push(oldObj)
    }
  })
  return answer
}

/*
 * =================================================
 *
 * Static functions for manipulating k8s objects
 *
 * =================================================
 */

/*
 * Get a collection
 */
export function get(options: KOptions): void {
  if (!options.kind) {
    throw NO_KIND
  }
  const client = clientFactory.create(options)
  const success = (data: any[]) => {
    if (options.success) {
      try {
        options.success(data)
      } catch (err) {
        log.debug("Supplied success callback threw error:", err)
      }
    }
    clientFactory.destroy(client)
  }
  client.get(success)
  client.connect()
}

function handleListAction(options: any, action: (object: any, success: (data: any) => void, error: (err: any) => void) => void) {
  if (!options.object.objects) {
    throw NO_OBJECTS
  }
  let answer: Record<string, any>
  const objects = cloneObject(options.object.objects)
  function addResult(id: string, data: any) {
    answer[id] = data
    next()
  }
  function next() {
    if (objects.length === 0) {
      log.debug("processed all objects, returning status")
      try {
        if (options.success) {
          options.success(answer)
        }
      } catch (err) {
        log.debug("Supplied success callback threw error:", err)
      }
      return
    }
    const object = objects.shift()
    log.debug("Processing object:", getName(object))
    const success = (data: any) => {
      addResult(fullName(object), data)
    }
    const error = (data: any) => {
      addResult(fullName(object), data)
    }
    action(object, success, error)
  }
  next()
}

function normalizeOptions(options: any) {
  log.debug("Normalizing supplied options:", options)
  // let's try and support also just supplying k8s objects directly
  if (options.metadata || getKind(options) === toKindName(WatchTypes.LIST)) {
    const object = options
    options = {
      object: object
    }
    if (object.objects) {
      options.kind = toKindName(WatchTypes.LIST)
    }
  }
  if (!options.object) {
    throw NO_OBJECT
  }
  if (!options.object.kind) {
    if (options.kind) {
      options.object.kind = toKindName(options.kind)
    } else {
      throw NO_KIND
    }
  }
  log.debug("Options object normalized:", options)
  return options
}

export function del(options: any): void {
  options = normalizeOptions(options)
  // support deleting a list of objects
  if (options.object.kind === toKindName(WatchTypes.LIST)) {
    handleListAction(options, (object: any, success, error) => {
      del({
        object: object,
        success: success,
        error: error
      })
    })
    return
  }
  options.kind = options.kind || toCollectionName(options.object)
  options.namespace = namespaced(options.kind) ? options.namespace || getNamespace(options.object) : null
  options.apiVersion = options.apiVersion || getApiVersion(options.object)
  const client = clientFactory.create(options)
  const success = (data: any) => {
    if (options.success) {
      try {
        options.success(data)
      } catch (err) {
        log.debug("Supplied success callback threw error:", err)
      }
    }
    clientFactory.destroy(client)
  }
  const error = (err: Error) => {
    if (options.error) {
      try {
        options.error(err)
      } catch (err) {
        log.debug("Supplied error callback threw error:", err)
      }
    }
    clientFactory.destroy(client)
  }
  client.delete(options.object, success, error)
}

/*
 * Add/replace an object, or a list of objects
 */
export function put(options: any): void {
  options = normalizeOptions(options)
  // support putting a list of objects
  if (options.object.kind === toKindName(WatchTypes.LIST)) {
    handleListAction(options, (object: any, success, error) => {
      put({
        object: object,
        success: success,
        error: error
      })
    })
    return
  }
  options.kind = options.kind || toCollectionName(options.object)
  options.namespace = namespaced(options.kind) ? options.namespace || getNamespace(options.object) : null
  options.apiVersion = options.apiVersion || getApiVersion(options.object)
  const client = clientFactory.create(options)
  client.get((objects) => {
    const success = (data: any) => {
      if (options.success) {
        try {
          options.success(data)
        } catch (err) {
          log.debug("Supplied success callback threw error:", err)
        }
      }
      clientFactory.destroy(client)
    }
    const error = (err: Error) => {
      if (options.error) {
        try {
          options.error(err)
        } catch (err) {
          log.debug("Supplied error callback threw error:", err)
        }
      }
      clientFactory.destroy(client)
    }
    client.put(options.object, success, error)
  })
  client.connect()
}

export function watch(options: KOptions) {
  if (!options.kind) {
    throw NO_KIND
  }
  const client = <Collection>clientFactory.create(options)
  if (options.success) {
    const handle = client.watch(options.success)
    const self = {
      client: client,
      handle: handle,
      disconnect: () => {
        clientFactory.destroy(self.client, self.handle)
      }
    }
  }

  client.connect()
  return self
}
