import { isNumber, isObject, pathGet } from './objects'
import { isString } from './strings'
import fs from 'fs'
import path from 'path'

describe('objects', () => {
  test('isObject', () => {
    expect(isObject(null)).toBe(false)
    expect(isObject(1)).toBe(false)
    expect(isObject(true)).toBe(false)
    expect(isObject(false)).toBe(false)
    const obj = { a: 'x', b: 'y', c: 'z' }
    expect(isObject(obj)).toBe(true)
    const fn = () => {
      /* no-op */
    }
    expect(isObject(fn)).toBe(true)
  })

  test('isString', () => {
    expect(isString(null)).toBe(false)
    expect(isString(1)).toBe(false)
    expect(isString(true)).toBe(false)
    expect(isString(false)).toBe(false)
    const obj = { a: 'x', b: 'y', c: 'z' }
    expect(isString(obj)).toBe(false)
    const fn = () => {
      /* no-op */
    }
    expect(isString(fn)).toBe(false)
    expect(isString('hello')).toBe(true)
  })

  test('isNumber', () => {
    expect(isNumber(0)).toBe(true)
    expect(isNumber(-1232)).toBe(true)
    expect(isNumber(324)).toBe(true)
    expect(isNumber(32.3)).toBe(true)
    expect(isNumber(-21312.4)).toBe(true)

    expect(isNumber('0')).toBe(false)
    expect(isNumber('3')).toBe(false)
    expect(isNumber('434')).toBe(false)
    expect(isNumber('-1')).toBe(false)
    expect(isNumber([])).toBe(false)
    expect(isNumber([1])).toBe(false)
    expect(isNumber({})).toBe(false)
    expect(isNumber(true)).toBe(false)
    expect(isNumber(false)).toBe(false)
    expect(isNumber(NaN)).toBe(false)
  })

  test('pathGet', () => {
    const routeResourceJsonPath = path.resolve(__dirname, '..', 'testdata', 'route-example.json')
    const routeResourceJson = fs.readFileSync(routeResourceJsonPath, { encoding: 'utf8', flag: 'r' })
    const routeResource = JSON.parse(routeResourceJson)
    expect(isObject(routeResource)).toBeTruthy()

    expect(pathGet(routeResource, 'kind')).toEqual('Route')
    const labels = '{"app":"hawtio"}'
    expect(JSON.stringify(pathGet(routeResource, 'metadata.labels'))).toEqual(labels)
  })
})
