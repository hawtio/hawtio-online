import path from 'path'
import fs from 'fs'
import { compare, getKey, isKubeObject } from './support'
import { KubeObject, ObjectMeta } from '../globals'

describe('support', () => {
  test('getKey', () => {
    const kind = 'pod'
    const namespace = 'hawtio'
    const name = 'camel-helloworld'

    expect(getKey(kind)).toEqual(`${kind}`)
    expect(getKey(kind, namespace)).toEqual(`${namespace}-${kind}`)
    expect(getKey(kind, namespace, name)).toEqual(`${name}-${namespace}-${kind}`)
  })

  test('isKubeObject', () => {
    const podJsonPath = path.resolve(__dirname, '..', 'testdata', 'quarkus-example-pod1.json')
    const podResourceJson = fs.readFileSync(podJsonPath, { encoding: 'utf8', flag: 'r' })
    const podResource = JSON.parse(podResourceJson)
    expect(isKubeObject(podResource)).toBeTruthy()

    const nsJsonPath = path.resolve(__dirname, '..', 'testdata', 'quarkus-namespace.json')
    const nsResourceJson = fs.readFileSync(nsJsonPath, { encoding: 'utf8', flag: 'r' })
    const nsResource = JSON.parse(nsResourceJson)
    expect(isKubeObject(nsResource)).toBeTruthy()

    const genericObject = { name: 'test', age: 12 }
    expect(isKubeObject(genericObject)).toBeFalsy()

    const emptyObject = {}
    expect(isKubeObject(emptyObject)).toBeFalsy()
  })

  test('compare', () => {
    const podJsonPath = path.resolve(__dirname, '..', 'testdata', 'quarkus-example-pod1.json')
    const podResourceJson = fs.readFileSync(podJsonPath, { encoding: 'utf8', flag: 'r' })
    const pod = JSON.parse(podResourceJson) as KubeObject
    expect(compare([pod], [pod])).toEqual({ added: [], modified: [], deleted: [] })

    const podCopy = JSON.parse(podResourceJson) as KubeObject
    const metadata = podCopy.metadata as ObjectMeta
    metadata.name = 'change-it'
    // pod and podCopy share the same uid
    expect(compare([pod], [podCopy])).toEqual({ added: [], modified: [podCopy], deleted: [] })

    const pod2JsonPath = path.resolve(__dirname, '..', 'testdata', 'quarkus-example-pod2.json')
    const pod2ResourceJson = fs.readFileSync(pod2JsonPath, { encoding: 'utf8', flag: 'r' })
    const pod2 = JSON.parse(pod2ResourceJson) as KubeObject

    expect(compare([pod, pod], [pod, pod2])).toEqual({ added: [pod2], modified: [], deleted: [] })
    expect(compare([pod], [pod, pod2])).toEqual({ added: [pod2], modified: [], deleted: [] })
    expect(compare([pod], [pod2])).toEqual({ added: [pod2], modified: [], deleted: [pod] })
  })
})
