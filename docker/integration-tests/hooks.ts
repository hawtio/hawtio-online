import got, { Got } from 'got'
import { startNginx, NginxServer } from 'nginx-testing'

const host = 'localhost'
const nginxConfig = `${__dirname}/nginx.conf`
const nginxVersion = process.env.NGINX_VERSION || '1.24.x'

export interface Context {
  client: Got
  nginxServer: NginxServer
}

export let context: Context

function initClient(port: number): Got {
  const client = got.extend({
    prefixUrl: `http://${host}:${port}`,
    retry: 0,
    throwHttpErrors: false,
  })

  return client
}

async function initServer(): Promise<NginxServer> {
  return await startNginx({ version: nginxVersion, bindAddress: host, configPath: nginxConfig })
}

beforeAll(async () => {
  const nginxServer = await initServer()

  const errors = (await nginxServer.readErrorLog())
    .split('\n')
    .filter(line => line.includes('[error]'))
  if (errors && errors.length > 0) {
    console.error(errors.join('\n'))
  }

  context = {
    client: initClient(nginxServer.port),
    nginxServer: nginxServer
  }
}, 30_000)

afterAll(async () => {
  if (context.nginxServer) {
    await context.nginxServer.stop()
  }
})

beforeEach(async () => {
  // Read the logs to consume (discard) them before running next test suite
  // (describe block).
  await context.nginxServer.readErrorLog()
  await context.nginxServer.readAccessLog()
})

afterEach (async () => {
  const errorLog = await context.nginxServer.readErrorLog()
  const accessLog = await context.nginxServer.readAccessLog()

  if (errorLog.length > 0)
    console.log('----- Error Log -----\n' + errorLog)

  if (accessLog.length > 0)
    console.log(accessLog && '----- Access Log -----\n' + accessLog)
})
