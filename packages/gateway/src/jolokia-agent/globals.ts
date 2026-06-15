import { Request as ExpressRequest, Response as ExpressResponse } from 'express-serve-static-core'
import { MBeanInfo, MBeanInfoError, MBeanAttribute, MBeanOperation, JolokiaRequest as MBeanRequest } from 'jolokia.js'
import { GatewayOptions } from 'src/globals'

export interface BulkValue {
  CanInvoke: boolean
  Method: string
  ObjectName: string
}

export interface InterceptedResponse {
  status: number
  request: MBeanRequest
  value?: unknown
  timestamp?: number
  reason?: string
}

export interface Intercepted {
  intercepted: boolean
  request: MBeanRequest
  response?: InterceptedResponse
}

export type OptimisedJmxDomain = Record<string, OptimisedMBeanInfo>
export type OptimisedJmxDomains = Record<string, OptimisedJmxDomain>
export type MBeanOperationEntry = [string, MBeanOperation | MBeanOperation[]]
export type MBeanInfoCache = Record<string, OptimisedMBeanInfo>

export type OptimisedCachedDomains = {
  cache: MBeanInfoCache
  domains: OptimisedJmxDomains
}

export interface OptimisedMBeanAttribute extends MBeanAttribute {
  canInvoke?: boolean
}

export interface OptimisedMBeanOperation extends MBeanOperation {
  canInvoke?: boolean
}

export type OptimisedMBeanOperations = Record<string, OptimisedMBeanOperation | OptimisedMBeanOperation[]>

export interface OptimisedMBeanInfo extends Omit<MBeanInfo, 'attr' | 'op'> {
  attr?: Record<string, OptimisedMBeanAttribute>
  op?: OptimisedMBeanOperations
  opByString?: Record<string, OptimisedMBeanOperation>
  canInvoke?: boolean
}

interface OperationDefined {
  op: Record<string, MBeanOperation | MBeanOperation[]>
}

interface AttributeDefined {
  attr: MBeanAttribute
}

interface MBeanDefinedRequest extends Pick<MBeanRequest, 'type'> {
  type: 'read' | 'write' | 'exec' | 'search'
  mbean: string
}

interface ExecMBeanRequest extends Pick<MBeanRequest, 'type'> {
  type: 'exec'
  arguments?: unknown[]
}

interface ArgumentRequest extends ExecMBeanRequest {
  type: 'exec'
  arguments: unknown[]
}

export interface AgentInfo {
  request: ExpressRequest
  requestHeaders: Headers
  response: ExpressResponse
  options: GatewayOptions
  namespace: string
  protocol: string
  pod: string
  port: string
  path: string
}

export interface SimpleResponse {
  status: number
  body: string
  headers: Headers
}

export function isSimpleResponse(obj: unknown): obj is SimpleResponse {
  if (!obj) return false

  return (
    (obj as SimpleResponse).status !== undefined &&
    (obj as SimpleResponse).body !== undefined &&
    (obj as SimpleResponse).headers !== undefined
  )
}

export function isResponse(obj: unknown): obj is Response {
  if (!obj) return false

  return (
    (obj as Response).status !== undefined &&
    (obj as Response).statusText !== undefined &&
    (obj as Response).body !== undefined &&
    (obj as Response).headers !== undefined
  )
}

export function isMBeanRequest(obj: unknown): obj is MBeanRequest {
  if (!obj) return false

  const notificationCmdTypes = ['register', 'unregister', 'add', 'remove', 'ping', 'open', 'list']
  const r = obj as MBeanRequest
  switch (r.type) {
    case 'read':
    case 'write':
    case 'exec':
    case 'search':
      return r.mbean !== undefined
    case 'list':
    case 'version':
      return true
    case 'notification':
      return r.command !== undefined && notificationCmdTypes.includes(r.command)
    default:
      return false
  }
}

export function isMBeanRequestArray(obj: unknown): obj is MBeanRequest[] {
  if (!obj) return false

  if (!Array.isArray(obj)) return false

  for (const element of obj) {
    if (!isMBeanRequest(element)) return false
  }

  return true
}

export function isMBeanDefinedRequest(obj: unknown): obj is MBeanDefinedRequest {
  if (!obj) return false

  return (obj as MBeanDefinedRequest).mbean !== undefined
}

export function isMBeanOperation(obj: unknown): obj is MBeanOperation {
  if (!obj) return false

  return (obj as MBeanOperation).desc !== undefined && (obj as MBeanOperation).ret !== undefined
}

export function hasMBeanOperation(obj: unknown): obj is OperationDefined {
  if (!obj) return false

  return (obj as OperationDefined).op !== undefined
}

export function hasMBeanAttribute(obj: unknown): obj is AttributeDefined {
  if (!obj) return false

  return (obj as AttributeDefined)?.attr !== undefined
}

export function isMBeanAttribute(obj: unknown): obj is MBeanAttribute {
  if (!obj) return false

  return (
    (obj as MBeanAttribute).desc !== undefined &&
    (obj as MBeanAttribute).type !== undefined &&
    (obj as MBeanAttribute).rw !== undefined
  )
}

export function isArgumentExecRequest(obj: unknown): obj is ExecMBeanRequest {
  if (!obj) return false

  return (obj as ExecMBeanRequest).type === 'exec' && 'arguments' in (obj as ExecMBeanRequest)
}

export function hasArguments(obj: unknown): obj is ArgumentRequest {
  if (!obj) return false

  return isArgumentExecRequest(obj) && (obj as ArgumentRequest).arguments !== undefined
}

export function isMBeanInfo(obj: string | MBeanInfo | MBeanInfoError): obj is MBeanInfo {
  if (!obj || typeof obj === 'string') return false

  return (obj as MBeanInfo).desc !== undefined
}

export function isMBeanInfoError(obj: string | MBeanInfo | MBeanInfoError): obj is MBeanInfoError {
  if (!obj || typeof obj === 'string') return false

  return (obj as MBeanInfoError).error !== undefined
}

export function isOptimisedMBeanInfo(obj: MBeanInfo): obj is OptimisedMBeanInfo {
  if (!obj) return false

  return 'opByString' in (obj as OptimisedMBeanInfo) && 'canInvoke' in (obj as OptimisedMBeanInfo)
}

export function isOptimisedCachedDomains(obj: unknown): obj is OptimisedCachedDomains {
  if (!obj) return false

  return (obj as OptimisedCachedDomains).cache !== undefined && (obj as OptimisedCachedDomains).domains !== undefined
}

export function extractHeaders(req: ExpressRequest, excludedHeaders: string[]) {
  const headers = new Headers()
  for (const prop in req.headers) {
    if (excludedHeaders.includes(prop)) continue

    const value = req.header(prop)
    if (!value || value.length === 0) continue

    headers.append(prop, value)
  }

  return headers
}

export function getFetchHeaders(srcHeaders: Headers): Headers {
  const headers = new Headers(srcHeaders)

  // Ensure the body can be parsed by Express
  headers.append('Content-Type', 'application/json')
  return headers
}
