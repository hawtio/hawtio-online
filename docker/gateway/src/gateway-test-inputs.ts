import * as fs from 'fs'

export const NAMESPACE = 'hawtio'
export const POD_NAME = 'camelapp-12345abc'
export const JOLOKIA_PORT = 10001
export const JOLOKIA_PATH = '/actuator/jolokia'
export const JOLOKIA_PARAMS = 'maxDepth=7&maxCollectionSize=50000&ignoreErrors=true&canonicalNaming=false'
export const JOLOKIA_URI = `http:${POD_NAME}:${JOLOKIA_PORT}${JOLOKIA_PATH}/?${JOLOKIA_PARAMS}`

const mbeanRegisterListData = fs.readFileSync(`${__dirname}/test.listMBeanRegistry.json`, 'utf8')
const mbeanRegisterList = JSON.parse(mbeanRegisterListData)

export const testData = {
  authorization: {
    forbidden: false,
    adminAllowed: true,
    viewerAllowed: true,
    allowedResponse: {
      kind: 'SubjectAccessReviewResponse',
      apiVersion: 'authorization.openshift.io/v1',
      namespace: NAMESPACE,
      allowed: true,
      reason: 'RBAC: allowed by ClusterRoleBinding "admin" of ClusterRole "cluster-admin" to User "admin"',
    },
    notAllowedResponse: {
      kind: 'SubjectAccessReviewResponse',
      apiVersion: 'authorization.openshift.io/v1',
      namespace: NAMESPACE,
      allowed: false,
    },
  },
  pod: {
    name: POD_NAME,
    resource: {
      kind: 'Pod',
      apiVersion: 'v1',
      metadata: {
        name: POD_NAME,
      },
      status: {
        phase: 'Running',
        hostIP: '192.168.126.11',
        podIP: '10.217.1.209',
      },
    },
  },
  jolokia: {
    search: {
      request: {
        mbean: 'org.apache.camel:context=*,type=routes,*',
        type: 'search',
      },
      response: {
        request: {
          mbean: 'org.apache.camel:context=*,type=routes,*',
          type: 'search',
        },
        value: [
          'org.apache.camel:context=camel-github,type=routes,name="commitToFiles"',
          'org.apache.camel:context=camel-github,type=routes,name="commitFilesToRest"',
          'org.apache.camel:context=camel-github,type=routes,name="restCommits"',
        ],
        status: 200,
        timestamp: 1718188370,
      },
    },
    registerList: mbeanRegisterList,
    // Occurs as a result of listMBeans function
    listMBeans: {
      request: {
        type: 'list',
      },
      response: {
        request: {
          type: 'list',
        },
        value: mbeanRegisterList.response.value.domains,
      },
    },
    canInvokeMap: {
      request: {
        type: 'exec',
        mbean: 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
        operation: 'canInvoke(java.util.Map)',
        arguments: [
          {
            'java.lang:type=Memory': ['gc()'],
            'org.apache.camel:context=io.fabric8.quickstarts.karaf-camel-log-log-example-context,name="log-example-context",type=context':
              [
                'addOrUpdateRoutesFromXml(java.lang.String)',
                'addOrUpdateRoutesFromXml(java.lang.String,boolean)',
                'dumpStatsAsXml(boolean)',
                'getCamelId()',
                'getRedeliveries()',
                'sendStringBody(java.lang.String,java.lang.String)',
              ],
          },
        ],
      },
      response: {
        status: 200,
        request: {
          type: 'exec',
          mbean: 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
          operation: 'canInvoke(java.util.Map)',
          arguments: [
            {
              'java.lang:type=Memory': ['gc()'],
              'org.apache.camel:context=io.fabric8.quickstarts.karaf-camel-log-log-example-context,name="log-example-context",type=context':
                [
                  'addOrUpdateRoutesFromXml(java.lang.String)',
                  'addOrUpdateRoutesFromXml(java.lang.String,boolean)',
                  'dumpStatsAsXml(boolean)',
                  'getCamelId()',
                  'getRedeliveries()',
                  'sendStringBody(java.lang.String,java.lang.String)',
                ],
            },
          ],
        },
        value: {
          'gc()': {
            CanInvoke: true,
            Method: 'gc()',
            ObjectName: 'java.lang:type=Memory',
          },
          'addOrUpdateRoutesFromXml(java.lang.String)': {
            CanInvoke: true,
            Method: 'addOrUpdateRoutesFromXml(java.lang.String)',
            ObjectName:
              'org.apache.camel:context=io.fabric8.quickstarts.karaf-camel-log-log-example-context,name="log-example-context",type=context',
          },
          'addOrUpdateRoutesFromXml(java.lang.String,boolean)': {
            CanInvoke: true,
            Method: 'addOrUpdateRoutesFromXml(java.lang.String,boolean)',
            ObjectName:
              'org.apache.camel:context=io.fabric8.quickstarts.karaf-camel-log-log-example-context,name="log-example-context",type=context',
          },
          'dumpStatsAsXml(boolean)': {
            CanInvoke: true,
            Method: 'dumpStatsAsXml(boolean)',
            ObjectName:
              'org.apache.camel:context=io.fabric8.quickstarts.karaf-camel-log-log-example-context,name="log-example-context",type=context',
          },
          'getCamelId()': {
            CanInvoke: true,
            Method: 'getCamelId()',
            ObjectName:
              'org.apache.camel:context=io.fabric8.quickstarts.karaf-camel-log-log-example-context,name="log-example-context",type=context',
          },
          'getRedeliveries()': {
            CanInvoke: true,
            Method: 'getRedeliveries()',
            ObjectName:
              'org.apache.camel:context=io.fabric8.quickstarts.karaf-camel-log-log-example-context,name="log-example-context",type=context',
          },
          'sendStringBody(java.lang.String,java.lang.String)': {
            CanInvoke: true,
            Method: 'sendStringBody(java.lang.String,java.lang.String)',
            ObjectName:
              'org.apache.camel:context=io.fabric8.quickstarts.karaf-camel-log-log-example-context,name="log-example-context",type=context',
          },
        },
        timestamp: 1718286845551,
      },
    },
    canInvokeSingleAttribute: {
      request: {
        type: 'exec',
        mbean: 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
        operation: 'canInvoke(java.lang.String)',
        arguments: ['java.lang:name=PS Old Gen,type=MemoryPool'],
      },
      response: {
        status: 200,
        request: {
          type: 'exec',
          mbean: 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
          operation: 'canInvoke(java.lang.String)',
          arguments: ['java.lang:name=PS Old Gen,type=MemoryPool'],
        },
        value: false,
        timestamp: 1718290436447,
      },
    },
    canInvokeSingleOperation: {
      request: {
        type: 'exec',
        mbean: 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
        operation: 'canInvoke(java.lang.String)',
        arguments: ['org.apache.camel:context=MyCamel,name="simple-route",type=routes'],
      },
      response: {
        status: 200,
        request: {
          type: 'exec',
          mbean: 'hawtio:type=security,area=jmx,name=HawtioOnlineRBAC',
          operation: 'canInvoke(java.lang.String)',
          arguments: ['org.apache.camel:context=MyCamel,name="simple-route",type=routes'],
        },
        value: false,
        timestamp: 171829033696,
      },
    },
    bulkRequestWithInterception: {
      request: [
        {
          type: 'search',
          mbean: '*:type=security,area=jmx,*',
        },
        {
          type: 'exec',
          mbean: 'java.lang:type=Memory',
          operation: 'gc()',
        },
        {
          type: 'search',
          mbean: 'org.apache.camel:context=*,type=routes,*',
        },
      ],
      intercepted: {
        request: [
          {
            type: 'exec',
            mbean: 'java.lang:type=Memory',
            operation: 'gc()',
          },
          {
            type: 'search',
            mbean: 'org.apache.camel:context=*,type=routes,*',
          },
        ],
        response: [
          {
            request: {
              mbean: 'java.lang:type=Memory","type":"exec","operation":"gc()',
            },
            value: null,
            status: 200,
            timestamp: 1718300948,
          },
          {
            request: {
              mbean: 'org.apache.camel:context=*,type=routes,*","type":"search',
            },
            value: [
              'org.apache.camel:context=SampleCamel,type=routes,name="cron"","org.apache.camel:context=SampleCamel,type=routes,name="simple"',
            ],
            status: 200,
            timestamp: 1718300948,
          },
        ],
      },
      response: [
        {
          request: {
            mbean: '*:type=security,area=jmx,*',
            type: 'search',
          },
          value: ['hawtio:type=security,area=jmx,name=HawtioOnlineRBAC'],
          status: 200,
          timestamp: 1718300948,
        },
        {
          request: {
            mbean: 'java.lang:type=Memory","type":"exec","operation":"gc()',
          },
          value: null,
          status: 200,
          timestamp: 1718300948,
        },
        {
          request: {
            mbean: 'org.apache.camel:context=*,type=routes,*","type":"search',
          },
          value: [
            'org.apache.camel:context=SampleCamel,type=routes,name="cron"","org.apache.camel:context=SampleCamel,type=routes,name="simple"',
          ],
          status: 200,
          timestamp: 1718300948,
        },
      ],
    },
    operationWithArgumentsAndViewerRole: {
      request: {
        type: 'exec',
        mbean: 'org.apache.karaf:type=bundle',
        operation: 'update(java.lang.String,java.lang.String)',
        arguments: ['50', 'value'],
      },
      response: {
        reason: "Role 'viewer' denied by 'org.apache.karaf.bundle[update]: admin'",
      },
    },
    bulkRequestWithViewerRole: {
      request: [
        {
          type: 'exec',
          mbean: 'org.apache.camel:type=context',
          operation: 'dumpRoutesAsXml()',
        },
        {
          type: 'exec',
          mbean: 'java.lang:type=Memory',
          operation: 'gc()',
        },
      ],
      intercepted: {
        request: [
          {
            type: 'exec',
            mbean: 'org.apache.camel:type=context',
            operation: 'dumpRoutesAsXml()',
          },
        ],
        response: [
          {
            request: {
              type: 'exec',
              mbean: 'org.apache.camel:type=context',
              operation: 'dumpRoutesAsXml()',
            },
            value:
              '<routes xmlns="http://camel.apache.org/schema/spring">\n <route id="cron">\n <from id="from1" uri="quartz:cron?cron={{quartz.cron}}"/>\n <setBody id="setBody1">\n <constant>Hello Camel! - cron</constant>\n </setBody>\n <to id="to1" uri="stream:out"/>\n <to id="to2" uri="mock:result"/>\n </route>\n <route id="simple">\n <from id="from2" uri="quartz:simple?trigger.repeatInterval={{quartz.repeatInterval}}"/>\n <setBody id="setBody2">\n <constant>Hello Camel! - simple</constant>\n </setBody>\n <to id="to3" uri="stream:out"/>\n <to id="to4" uri="mock:result"/>\n </route>\n</routes>',
            status: 200,
            timestamp: 1718383041,
          },
        ],
      },
      response: [
        {
          request: {
            type: 'exec',
            mbean: 'org.apache.camel:type=context',
            operation: 'dumpRoutesAsXml()',
          },
          value:
            '<routes xmlns="http://camel.apache.org/schema/spring">\n <route id="cron">\n <from id="from1" uri="quartz:cron?cron={{quartz.cron}}"/>\n <setBody id="setBody1">\n <constant>Hello Camel! - cron</constant>\n </setBody>\n <to id="to1" uri="stream:out"/>\n <to id="to2" uri="mock:result"/>\n </route>\n <route id="simple">\n <from id="from2" uri="quartz:simple?trigger.repeatInterval={{quartz.repeatInterval}}"/>\n <setBody id="setBody2">\n <constant>Hello Camel! - simple</constant>\n </setBody>\n <to id="to3" uri="stream:out"/>\n <to id="to4" uri="mock:result"/>\n </route>\n</routes>',
          status: 200,
          timestamp: 1718383041,
        },
        {
          request: {
            type: 'exec',
            mbean: 'java.lang:type=Memory',
            operation: 'gc()',
          },
          status: 403,
          reason: "Role 'viewer' denied by 'java.lang.Memory[gc]: admin'",
        },
      ],
    },
    requestOperationWithArgumentsAndNoRole: {
      request: {
        type: 'exec',
        mbean: 'org.apache.karaf:type=bundle',
        operation: 'uninstall(java.lang.String)',
        arguments: ['0'],
      },
      response: {
        reason: "Role 'viewer' denied by 'org.apache.karaf.bundle[update]: admin'",
      },
    },
  },
}
