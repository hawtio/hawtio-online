import { spawn, ChildProcess, execFileSync } from 'child_process'
import { LRUCache } from 'lru-cache'
import * as net from 'net'
import { AgentInfo } from './globals'
import { gatewayConfig } from '../gateway-config'
import { logger } from '../logger'

interface PodTunnel {
  localPort: number
  process: ChildProcess
}

const activeTunnels = new Set<ChildProcess>()

const podTunnelCache = new LRUCache<string, Promise<PodTunnel>>({
  max: 50,
  ttl: 1000 * 60 * 5, // 5 minutes
  ttlAutopurge: true,
  dispose: async tunnelPromise => {
    const tunnel = await tunnelPromise.catch(() => undefined)
    if (tunnel) {
      activeTunnels.delete(tunnel.process)
      tunnel.process.kill()
    }
  },
})

function cleanupAllTunnels() {
  for (const child of activeTunnels) {
    child.kill()
  }
  activeTunnels.clear()
}

process.once('exit', cleanupAllTunnels)
process.once('SIGINT', () => {
  cleanupAllTunnels()
  process.exit(130)
})
process.once('SIGTERM', () => {
  cleanupAllTunnels()
  process.exit(143)
})

function allocateFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as net.AddressInfo
      server.close(err => {
        if (err) {
          reject(err)
        } else {
          resolve(address.port)
        }
      })
    })
  })
}

function resolveKubeCli(): string {
  for (const bin of ['oc', 'kubectl']) {
    try {
      execFileSync(bin, ['version', '--client'], { stdio: 'ignore' })
      return bin
    } catch {
      // Try next binary
    }
  }

  throw new Error('Neither "oc" nor "kubectl" was found in PATH for dev port-forwarding')
}

async function startPortForward(agentInfo: AgentInfo, cacheKey: string): Promise<PodTunnel> {
  const localPort = await allocateFreePort()
  let binary = resolveKubeCli()

  const child = spawn(binary, [
    'port-forward',
    `pod/${agentInfo.pod}`,
    `${localPort}:${agentInfo.port}`,
    '-n',
    agentInfo.namespace,
    '--address',
    '127.0.0.1',
  ])

  activeTunnels.add(child)

  await new Promise<void>((resolve, reject) => {
    let settled = false

    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (err) {
        activeTunnels.delete(child)
        child.kill()
        reject(err)
      } else {
        resolve()
      }
    }

    const timer = setTimeout(() => {
      finish(new Error(`Timed out waiting for oc port-forward on ${agentInfo.namespace}/${agentInfo.pod}:${agentInfo.port}`))
    }, 10000)

    child.stdout.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Forwarding from')) {
        finish()
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      logger.trace(`(jolokia-agent) port-forward stderr: ${chunk.toString().trim()}`)
    })

    child.once('error', err => {
      finish(err)
    })

    child.once('exit', code => {
      activeTunnels.delete(child)
      podTunnelCache.delete(cacheKey)
      finish(new Error(`oc port-forward exited prematurely with code ${code}`))
    })
  })

  return { localPort, process: child }
}

export async function ensureDevPodTunnel(agentInfo: AgentInfo): Promise<number> {
  const cacheKey = `${agentInfo.namespace}/${agentInfo.pod}:${agentInfo.port}`
  const cached = podTunnelCache.get(cacheKey)
  if (cached) {
    const existing = await cached
    return existing.localPort
  }

  // Insert the in-flight Promise synchronously before any await to prevent stampedes
  const tunnelPromise = startPortForward(agentInfo, cacheKey)
  tunnelPromise.catch(() => podTunnelCache.delete(cacheKey))
  podTunnelCache.set(cacheKey, tunnelPromise)

  const tunnel = await tunnelPromise
  return tunnel.localPort
}
