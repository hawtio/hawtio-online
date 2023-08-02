import { KubeObject } from '../globals'
import { CompareResult, } from './globals'
import { equals } from '../helpers'

export function getKey(kind: string, namespace?: string) {
  return namespace ? namespace + '-' + kind : kind
}

export function compare(old: KubeObject[], _new: KubeObject[]): CompareResult<KubeObject> {
  const answer = {
    added: [],
    modified: [],
    deleted: []
  } as CompareResult<KubeObject>

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
//
// TODO
// Issues with typescript migration and testing. If these are used
// then uncomment and fix. Otherwise, delete at later date.
//
// /*
//  * Get a collection
//  */
// export function get(options: KOptions): void {
//   if (!options.kind) {
//     throw NO_KIND
//   }
//   const client = clientFactory.create(options)
//   const success = (data: KubeObject[]) => {
//     if (options.success) {
//       try {
//         options.success(data)
//       } catch (err) {
//         log.debug("Supplied success callback threw error:", err)
//       }
//     }
//     clientFactory.destroy(client)
//   }
//   client.get(success)
//   client.connect()
// }
//
// function handleListAction(options: KOptions, action: (object: KubeObject, success: ProcessDataCallback, error: ErrorDataCallback) => void) {
//   if (!options.object?.objects) {
//     throw NO_OBJECTS
//   }
//   let answer: Record<string, any>
//   const objects = cloneObject(options.object.objects)
//   function addResult(id: string, data: any) {
//     answer[id] = data
//     next()
//   }
//   function next() {
//     if (objects.length === 0) {
//       log.debug("processed all objects, returning status")
//       try {
//         if (options.success) {
//           options.success([answer])
//         }
//       } catch (err) {
//         log.debug("Supplied success callback threw error:", err)
//       }
//       return
//     }
//     const object: KubeObject = objects.shift()
//     log.debug("Processing object:", getName(object))
//     const success = (data: any) => {
//       addResult(fullName(object), data)
//     }
//     const error = (data: any) => {
//       addResult(fullName(object), data)
//     }
//     action(object, success, error)
//   }
//   next()
// }
//
// function normalizeOptions(options: KOptions) {
//   // TODO
//   // not convinced the migration from javascript has worked this correctly
//
//   log.debug("Normalizing supplied options:", options)
//   // let's try and support also just supplying k8s objects directly
//   if (options.metadata && getKind(options) === toKindName(WatchTypes.LIST)) {
//     const kind = options.objects ? toKindName(WatchTypes.LIST) || NO_KIND : NO_KIND
//     options = {
//       kind: kind,
//       object: options
//     }
//   }
//
//   if (!options.object) {
//     throw NO_OBJECT
//   }
//
//   if (!options.object.kind) {
//     if (options.kind) {
//       options.object.kind = toKindName(options.kind) || NO_KIND
//     } else {
//       throw NO_KIND
//     }
//   }
//   log.debug("Options object normalized:", options)
//   return options
// }
//
// export function del(options: KOptions): void {
//   options = normalizeOptions(options)
//   if (! options.object) {
//     log.warn('Cannot delete as options.object is null')
//     return
//   }
//
//   // support deleting a list of objects
//   if (options.object.kind === toKindName(WatchTypes.LIST)) {
//     handleListAction(options, (object: KubeObject, success, error) => {
//       del({
//         kind: object.kind || NO_KIND,
//         object: object,
//         success: success,
//         error: error
//       })
//     })
//     return
//   }
//
//   options.kind = options.kind || toCollectionName(options.object) || NO_KIND
//   options.namespace = namespaced(options.kind) ? options.namespace || getNamespace(options.object) || undefined : undefined
//   options.apiVersion = options.apiVersion || getApiVersion(options.object) || undefined
//   const client = clientFactory.create(options)
//   const success = (data: any) => {
//     if (options.success) {
//       try {
//         options.success(data)
//       } catch (err) {
//         log.debug("Supplied success callback threw error:", err)
//       }
//     }
//     clientFactory.destroy(client)
//   }
//   const error = (err: Error) => {
//     if (options.error) {
//       try {
//         options.error(err)
//       } catch (err) {
//         log.debug("Supplied error callback threw error:", err)
//       }
//     }
//     clientFactory.destroy(client)
//   }
//   client.delete(options.object, success, error)
// }
//
// /*
//  * Add/replace an object, or a list of objects
//  */
// export function put(options: KOptions): void {
//   options = normalizeOptions(options)
//   if (! options.object) {
//     log.warn('Cannot put as options.object is null')
//     return
//   }
//
//   // support putting a list of objects
//   if (options.object.kind === toKindName(WatchTypes.LIST)) {
//     handleListAction(options, (object: any, success, error) => {
//       put({
//         kind: object.kind,
//         object: object,
//         success: success,
//         error: error
//       })
//     })
//     return
//   }
//
//   options.kind = options.kind || toCollectionName(options.object) || NO_KIND
//   options.namespace = namespaced(options.kind) ? options.namespace || getNamespace(options.object) || undefined : undefined
//   options.apiVersion = options.apiVersion || getApiVersion(options.object) || undefined
//   const client = clientFactory.create(options)
//   client.get((objects) => {
//     const success = (data: any) => {
//       if (options.success) {
//         try {
//           options.success(data)
//         } catch (err) {
//           log.debug("Supplied success callback threw error:", err)
//         }
//       }
//       clientFactory.destroy(client)
//     }
//     const error = (err: Error) => {
//       if (options.error) {
//         try {
//           options.error(err)
//         } catch (err) {
//           log.debug("Supplied error callback threw error:", err)
//         }
//       }
//       clientFactory.destroy(client)
//     }
//     if (options.object) client.put(options.object, success, error)
//   })
//   client.connect()
// }
//
// export function watch(options: KOptions) {
//   if (!options.kind) {
//     throw NO_KIND
//   }
//   const client = clientFactory.create(options)
//   if (options.success) {
//     const handle = client.watch(options.success)
//     const self = {
//       client: client,
//       handle: handle,
//       disconnect: () => {
//         clientFactory.destroy(self.client, self.handle)
//       }
//     }
//   }
//
//   client.connect()
//   return self
// }
