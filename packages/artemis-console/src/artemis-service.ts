/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ActiveSort, type Filter, type FilterOperation } from './table/types'
import { eventService, jolokiaService, MBeanNode, parseMBeanName, workspace } from '@hawtio/react'
import { createAddressObjectName, createQueueObjectName } from './util/jmx'
import { log } from './globals'
import { Message } from './messages/MessageView'
import { configManager } from './config-manager'

export type BrokerState = {
    // loading attempted?
    loaded: boolean
    // permission granted?
    accessible: boolean
    // possible error message
    message?: string
    // if everything is configured correctly, this is fully populated broker information
    info?: BrokerInfo
}
// Value returned by Jolokia, when RBAC prevents access
// see: org.jolokia.server.core.service.serializer.ValueFaultHandler.IGNORING_VALUE_FAULT_HANDLER
export type InaccessibleValue = {
    ".error": boolean
    error?: string
    error_type?: string
}
export type BrokerInfo = {
    name: string
    nodeID: string
    objectName: string
    version: string | InaccessibleValue
    started: boolean | InaccessibleValue
    uptime: string | InaccessibleValue
    globalMaxSizeMB: number
    addressMemoryUsage: number
    addressMemoryUsed: number
    diskStoreUsagePercentage: number
    maxDiskUsage: number
    haPolicy: string | InaccessibleValue
    networkTopology: BrokerNetworkTopology
    backup: boolean | InaccessibleValue
    clustered: boolean | InaccessibleValue
    connectionCount: number
    replicaSync: boolean | InaccessibleValue
}

export class BrokerNetworkTopology {
    brokers: BrokerElement[];

    constructor(brokers: BrokerElement[]) {
        this.brokers = brokers;
    }

    getLiveCount(): number {
        return this.brokers.length;
    }

    getBackupCount(): number {
        let backups: number = 0;
        this.brokers.forEach((broker) => {
            if (broker.backup) {
                backups = backups + 1;
            }
        })
        return backups;
    }
}

export type BrokerElement = {
    nodeID: string
    live: string
    backup?: string
}

export type Acceptor = {
    Name: string
    FactoryClassName: string
    Started: boolean
    Parameters: any
}

export type Acceptors = {
    acceptors: Acceptor[]
}

export type LockCoordinator = {
    name: string
    lockId: string
    className: string
    simpleName: string
    locked: boolean
    started: boolean
    status: string
}

export type LockCoordinators = {
    lockCoordinators: LockCoordinator[]
}

export type ClusterConnection = {
    Started: boolean
    Address: string
    MessageLoadBalancingType: string
    MessagesAcknowledged: number
    Topology: string
    MaxHops: number
    Nodes: any
    Name: string
    DuplicateDetection: boolean
    DiscoveryGroupName: string
    Metrics: any
    MessagesPendingAcknowledgement: number
    StaticConnectors: string[]
    NodeID: string
    RetryInterval: number
    StaticConnectorsAsJSON: string
}

export type ClusterConnections = {
    clusterConnections: ClusterConnection[]
}
export type Queue = {
    name: string
    address: string
    routingType: string
}
export type Address = {
    name: string
    queues: Queue[]
}
export type BrokerTopology = {
    broker: BrokerInfo
    addresses: Address[]

}

export type queuePermissions = {
  canSend: boolean;
  canBrowse: boolean;
  canPurge: boolean;
}

export type addressPermissions = {
  canSend: boolean;
}

export enum BrokerStatus {
  UNINITIALIZED,
  AVAILABLE,
  MISSING_IN_JMX
}

/**
 * Filtering information for a single field passed for data loading.
 * See `org.apache.activemq.artemis.core.management.impl.view.ActiveMQAbstractView#createFilterPredicates`
 */
export type SingleFilterOptions = {
  field?: string
  operation?: FilterOperation
  value?: string
}

/**
 * Sorting options passed for data loading.
 */
export type SortingOptions = {
  /** org.apache.activemq.artemis.core.management.impl.view.ActiveMQAbstractView#SORT_FIELD */
  sortField?: string
  /** org.apache.activemq.artemis.core.management.impl.view.ActiveMQAbstractView#SORT_ORDER */
  sortOrder?: string
}

/**
 * Filtering + sorting information passed as `options` to
 * `org.apache.activemq.artemis.core.management.impl.view.ActiveMQAbstractView#setOptions` parsed as JSON. It may
 * contain one filter or an array of simple `<field><operation><value>` elements
 *
 * At the server-side defaults to `{field:'',operation:'',value:''}`
 */
export type FilterOptions = Partial<SingleFilterOptions> & SortingOptions & {
  /** See `org.apache.activemq.artemis.core.management.impl.view.ActiveMQAbstractView#FILTER_ARRAY_FIELD` */
  searchFilters?: SingleFilterOptions[]
}

const LIST_NETWORK_TOPOLOGY_SIG = "listNetworkTopology";
const SEND_MESSAGE_SIG = "sendMessage(java.util.Map,int,java.lang.String,boolean,java.lang.String,java.lang.String,boolean)";
const DELETE_ADDRESS_SIG = "deleteAddress(java.lang.String)";
const DELETE_MESSAGE_SIG = "removeMessage(long)";
const MOVE_MESSAGE_SIG = "moveMessage(long,java.lang.String)";
const COPY_MESSAGE_SIG = "copyMessage(long,java.lang.String)";
const RETRY_MESSAGE_SIG = "retryMessage(long)";
const CREATE_QUEUE_SIG = "createQueue(java.lang.String,boolean)"
const CREATE_ADDRESS_SIG = "createAddress(java.lang.String,java.lang.String)"
const COUNT_MESSAGES_SIG = "countMessages()";
const COUNT_MESSAGES_SIG2 = "countMessages(java.lang.String)";
const BROWSE_SIG = "browse(int,int,java.lang.String)";


/* Signatures of JMX methods on the broker MBean to fill main tabs of <ArtemisTabs> */

const LIST_CONNECTIONS_SIG = "listConnections(java.lang.String,int,int)";
const LIST_SESSIONS_SIG = "listSessions(java.lang.String,int,int)";
const LIST_PRODUCERS_SIG = "listProducers(java.lang.String,int,int)";
const LIST_CONSUMERS_SIG = "listConsumers(java.lang.String,int,int)";
const LIST_ADDRESSES_SIG = "listAddresses(java.lang.String,int,int)";
const LIST_QUEUES_SIG = "listQueues(java.lang.String,int,int)";

const LIST_ALL_ADDRESSES_SIG = "listAddresses(java.lang.String)";
const DESTROY_QUEUE_SIG = "destroyQueue(java.lang.String)";
const REMOVE_ALL_MESSAGES_SIG = "removeAllMessages()";
const CLOSE_CONNECTION_SIG = "closeConnectionWithID(java.lang.String)";
const CLOSE_SESSION_SIG = "closeSessionWithID(java.lang.String,java.lang.String)";
const CLOSE_CONSUMER_SIG = "closeConsumerWithID(java.lang.String,java.lang.String)";
const LIST_LOCK_MANAGER_SIG = "listLockCoordinatorsAsJSON()";
const START_LOCK_COORDINATOR_SIG = "startLockCoordinator(java.lang.String)";
const STOP_LOCK_COORDINATOR_SIG = "stopLockCoordinator(java.lang.String)";

const MS_PER_SEC = 1000;
const MS_PER_MIN = 60 * MS_PER_SEC;
const MS_PER_HOUR = 60 * MS_PER_MIN;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const typeLabels = ["DEFAULT", "1", "object", "text", "bytes", "map", "stream", "embedded"];

const jolokiaAttributes = [
    "Name",
    "NodeID",
    "Version",
    "Started",
    "Uptime",
    "GlobalMaxSize",
    "AddressMemoryUsage",
    "HAPolicy",
    "DiskStoreUsage",
    "MaxDiskUsage",
    "Backup",
    "Clustered",
    "ConnectionCount",
    "ReplicaSync"
];

/**
 * Main Artemis service that manages Broker information and topology. Needs properly configured `jolokiaService`
 * from `@hawtio/react` which may require authenticated user.
 */
class ArtemisService {

    private brokerObjectName: Promise<string>

    private brokerStatus: BrokerStatus
    private statusListeners: ((st: BrokerStatus) => void)[]

    constructor() {
        this.brokerObjectName = Promise.resolve("")
        this.brokerStatus = BrokerStatus.UNINITIALIZED
        this.statusListeners = []
    }

    /**
     * Initialization should be called before registration of Hawtio Artemis plugins in Artemis Extension
     * _entry point_ (which is the exported `artemis()` function of `HawtioPlugin` type)
     */
    initialize() {
        this.brokerObjectName = this.initBrokerObjectName();
    }

    private async initBrokerObjectName(): Promise<string> {
        const config = await configManager.getArtemisconfig();
        const search = await jolokiaService.search(config.jmx.domain + ":broker=*").catch(() => null);
        return search && search[0] ? search[0] : "";
    }

    async getBrokerName(): Promise<string | null> {
        const brokerObjectName = await this.brokerObjectName;
        const response = await jolokiaService.readAttribute(brokerObjectName, "Name");
        if (response) {
            if (typeof response === "object" && ".error" in response) {
                return ""
            }
            this.status = BrokerStatus.AVAILABLE
            return response as string;
        }
        return null;
    }

    async getBrokerInfo(): Promise<BrokerState> {
        return new Promise<BrokerState>(async (resolve, _reject) => {
            const brokerObjectName = await this.brokerObjectName;
            if ("" === brokerObjectName) {
                resolve({ loaded: true, accessible: false, message: "No Broker ObjectName available" })
                return
            }
            const brokerMBean = await findMBeanInfo(brokerObjectName)
            if (!brokerMBean) {
                resolve({ loaded: true, accessible: false, message: `No Broker MBean available for name ${brokerObjectName}` })
                return
            }
            // `canRead` flag is added by jolokia-integration 0.7.1+ and ideally it should be checked _before_
            // getting an attribute (just as `canInvoke` should be checked before executing an operation), but
            // RBAC data may not be complete, so it's still good to be prepared (and add relevant `.catch(error => {...})`
            let permitted = false
            const nameInfo = brokerMBean.mbean?.attr?.["Name"]
            if (nameInfo && "canRead" in nameInfo) {
                permitted = nameInfo["canRead"] as boolean
            } else if ("canInvoke" in brokerMBean.mbean!) {
                permitted = brokerMBean.mbean?.["canInvoke"] as boolean
            }
            if (!permitted) {
                resolve({ loaded: true, accessible: false, message: `Access not granted to broker ${brokerMBean.objectName}` })
                return
            }

            const response = await jolokiaService.readSpecifiedAttributes(brokerObjectName, jolokiaAttributes).catch(e => {
                // this is the best (as of Nov 2025) way to handle problems when fetching attributes with RBAC enabled
                eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(e) })
                return null
            });
            if (response) {
                const name = response.Name as string;
                const nodeID = response.NodeID as string;
                const version = response.Version as string | InaccessibleValue;
                const started = response.Started as boolean | InaccessibleValue;
                const globalMaxSize = response.GlobalMaxSize as number;
                const addressMemoryUsage = response.AddressMemoryUsage as number;
                const uptime = response.Uptime as string | InaccessibleValue;
                const haPolicy = response.HAPolicy as string | InaccessibleValue;
                const diskStoreUsage = response.DiskStoreUsage as number;
                const maxDiskUsage = response.MaxDiskUsage as number;
                const globalMaxSizeMB = globalMaxSize / 1048576;
                let used = 0;
                let addressMemoryUsageMB = 0;
                if (addressMemoryUsage > 0) {
                    addressMemoryUsageMB = addressMemoryUsage / 1048576;
                    used = addressMemoryUsageMB / globalMaxSizeMB * 100
                }
                let diskStoreUsagePercentage = 0;
                if (diskStoreUsage > 0) {
                    diskStoreUsagePercentage = diskStoreUsage * 100;
                }
                const backup = response.Backup as boolean | InaccessibleValue;
                const clustered = response.Clustered as boolean | InaccessibleValue;
                const connectionCount = response.ConnectionCount as number;
                const replicaSync = response.ReplicaSync as boolean | InaccessibleValue;
                const topology = await jolokiaService.execute(brokerObjectName, LIST_NETWORK_TOPOLOGY_SIG).catch(e => {
                    eventService.notify({ type: 'warning', message: jolokiaService.errorMessage(e) })
                    return "{}"
                }) as string;
                const brokerInfo: BrokerInfo = {
                    name: name,
                    objectName: brokerObjectName,
                    nodeID: nodeID,
                    version: version,
                    started: started,
                    uptime: uptime,
                    globalMaxSizeMB: globalMaxSizeMB,
                    addressMemoryUsage: addressMemoryUsageMB,
                    addressMemoryUsed: used,
                    diskStoreUsagePercentage: diskStoreUsagePercentage,
                    maxDiskUsage: maxDiskUsage,
                    haPolicy: haPolicy,
                    backup: backup,
                    clustered: clustered,
                    connectionCount: connectionCount,
                    replicaSync: replicaSync,
                    networkTopology: new BrokerNetworkTopology(JSON.parse(topology))
                };
                resolve({ loaded: true, accessible: true, info: brokerInfo });
                return
            }
            resolve({ loaded: true, accessible: false, message: `No information available for broker ${brokerMBean.objectName}` })
        });
    }

    async createBrokerTopology(maxAddresses: number, addressFilter: string): Promise<BrokerTopology | null> {
        return new Promise<BrokerTopology | null>(async (resolve, reject) => {
            try {
                const state = await this.getBrokerInfo();
                if (!state || !state.info) {
                    resolve(null)
                }
                const brokerInfo = state.info
                const brokerObjectName = await this.brokerObjectName;
                const topology = await jolokiaService.execute(brokerObjectName, LIST_NETWORK_TOPOLOGY_SIG).catch(error => {
                    eventService.notify({ type: "warning", message: jolokiaService.errorMessage(error) })
                    return "[]"
                }) as string;
                brokerInfo!.networkTopology =  new BrokerNetworkTopology(JSON.parse(topology));
                const brokerTopology: BrokerTopology = {
                    broker: brokerInfo!,
                    addresses: []
                }
                let addresses: string[] = (await this.getAllAddresses(addressFilter));
                const max: number = maxAddresses < addresses.length ? maxAddresses: addresses.length;
                addresses = addresses.slice(0, max);
                for (const address of addresses) {
                    const queuesJson: string = await this.getQueuesForAddress(address).catch(error => {
                        eventService.notify({ type: "warning", message: jolokiaService.errorMessage(error) })
                        return JSON.stringify({ data: [], count: 0 })
                    })
                    const queues: Queue[] = JSON.parse(queuesJson).data;
                    brokerTopology.addresses.push({
                        name: address,
                        queues: queues
                    })
                }
                resolve(brokerTopology);
                
            } catch (error) {
                reject("invalid response:");
            }
        
        });
    }

    async createLockCoordinators(): Promise<LockCoordinators> {
        return new Promise<LockCoordinators>(async (resolve, reject) => {
            const lockCoordinators: LockCoordinators = {
                lockCoordinators: []
            };
            const brokerObjectName = await this.getBrokerObjectName();
            const brokerMBean = await findMBeanInfo(brokerObjectName);
            const doesListLockCoordinatorMethodExist = this.doesListLockCoordinatorMethodExist(brokerMBean as MBeanNode)
            if (!doesListLockCoordinatorMethodExist) {
                console.log("Lock Coordinators not available in this broker version");
                resolve(lockCoordinators);
            } else if(this.canListLockCoordinators(brokerMBean as MBeanNode)) {
                const lockCoordinatorString = await jolokiaService.execute(brokerObjectName, LIST_LOCK_MANAGER_SIG).catch(error => {
                    eventService.notify({ type: "warning", message: jolokiaService.errorMessage(error) })
                    return "[]"
                }) as string;
                if (lockCoordinatorString) {
                    lockCoordinators.lockCoordinators = JSON.parse(lockCoordinatorString);
                    console.info("resolved " + lockCoordinators);
                    console.info("from " + lockCoordinatorString);
                    resolve(lockCoordinators);
                }

            } else {
                console.info("oops")
                resolve(lockCoordinators);
            }
            reject("invalid response:")
        });
    }
    async createAcceptors(): Promise<Acceptors> {
        return new Promise<Acceptors>(async (resolve, reject) => {
            const brokerObjectName = await this.brokerObjectName;
            const acceptorSearch = brokerObjectName + ",component=acceptors,name=*";

            const search = await jolokiaService.search(acceptorSearch);
            if (search) {
                const acceptors: Acceptors = {
                    acceptors: []
                };
                for (const key in search) {
                    const acceptor: Acceptor = await jolokiaService.readAttributes(search[key])
                        .catch((e) => {
                            reject(e)
                        }) as Acceptor;
                    const validation = isValid(acceptor)
                    if (validation.valid) {
                        acceptors.acceptors.push(acceptor);
                    } else {
                        eventService.notify({ type: "warning", message: `Access not granted to ${search[key]}` })
                    }
                }
                resolve(acceptors);
            }
            reject("invalid response:");
        });
    }

    async createClusterConnections(): Promise<ClusterConnections> {
        return new Promise<ClusterConnections>(async (resolve, reject) => {
            const brokerObjectName = await this.brokerObjectName;
            const clusterConnectionSearch = brokerObjectName + ",component=cluster-connections,name=*";

            const search = await jolokiaService.search(clusterConnectionSearch);
            if (search) {
                const clusterConnections: ClusterConnections = {
                    clusterConnections: []
                };
                for (const key in search) {
                    const clusterConnection: ClusterConnection = await jolokiaService.readAttributes(search[key])
                        .catch((e) => {
                            reject(e)
                        }) as ClusterConnection;
                    const validation = isValid(clusterConnection)
                    if (validation.valid) {
                        clusterConnections.clusterConnections.push(clusterConnection);
                    } else {
                        eventService.notify({ type: "warning", message: `Access not granted to ${search[key]}` })
                    }
                }
                resolve(clusterConnections);
            }
            reject("invalid response:");
        });
    }

    async doSendMessageToQueue(body: string, theHeaders: { name: string; value: string }[], durable: boolean, createMessageId: boolean, useCurrentlogon: boolean, username: string, password: string, routingType: string, queue: string, address: string) {
        const mbean = createQueueObjectName(await this.getBrokerObjectName(), address, routingType, queue);
        return await this.doSendMessage(mbean, body, theHeaders, durable, createMessageId, useCurrentlogon, username, password);
    }

    async doSendMessageToAddress(body: string, theHeaders: { name: string; value: string }[], durable: boolean, createMessageId: boolean, useCurrentlogon: boolean, username: string, password: string, address: string) {
        const mbean = createAddressObjectName(await this.getBrokerObjectName(), address);
        return await this.doSendMessage(mbean, body, theHeaders, durable, createMessageId, useCurrentlogon, username, password);
    }

    async doSendMessage(mbean: string, body: string, theHeaders: { name: string; value: string }[], durable: boolean, createMessageId: boolean, useCurrentlogon: boolean, username: string, password: string) {
        const type = 3;
        const user = useCurrentlogon ? null : username;
        const pwd = useCurrentlogon ? null : password;
        const headers: { [id: string]: string; } = {};
        theHeaders.forEach(function (object) {
            const key = object.name;
            if (key) {
                headers[key] = object.value;
            }
        });
        log.debug("About to send headers: " + JSON.stringify(headers));
        return await jolokiaService.execute(mbean, SEND_MESSAGE_SIG, [headers, type, body, durable, user, pwd, createMessageId]);
    }


    async deleteAddress(address: string) {
        return await jolokiaService.execute(await this.getBrokerObjectName(), DELETE_ADDRESS_SIG, [address])
    }

    async deleteMessage(id: number, address: string, routingType: string, queue: string) {
        const mbean = createQueueObjectName(await this.getBrokerObjectName(), address, routingType, queue);
        return jolokiaService.execute(mbean, DELETE_MESSAGE_SIG, [id])
    }


    async moveMessage(id: number, targetQueue: string,  address: string, routingType: string, queue: string) {
        const mbean = createQueueObjectName(await this.getBrokerObjectName(), address, routingType, queue);
        return jolokiaService.execute(mbean, MOVE_MESSAGE_SIG, [id, targetQueue])
    }

    async copyMessage(id: number, targetQueue: string,  address: string, routingType: string, queue: string) {
        const mbean = createQueueObjectName(await this.getBrokerObjectName(), address, routingType, queue);
        return jolokiaService.execute(mbean, COPY_MESSAGE_SIG, [id, targetQueue])
    }

     async retryMessage(id: number, address: string, routingType: string, queue: string) {
        const mbean = createQueueObjectName(await this.getBrokerObjectName(), address, routingType, queue);
        return jolokiaService.execute(mbean, RETRY_MESSAGE_SIG, [id])
    }

    async createQueue(queueConfiguration: string) {
        return await jolokiaService.execute(await this.getBrokerObjectName(), CREATE_QUEUE_SIG, [queueConfiguration, false]).then() as string;
    }
    
    async createAddress(address: string, routingType: string) {
        return await jolokiaService.execute(await this.getBrokerObjectName(), CREATE_ADDRESS_SIG, [address, routingType])
    }

    async getMessages(mBean: string, page: number, perPage: number, filter: string) {
        let count: number;
        if (filter && filter.length > 0) {
            count = await jolokiaService.execute(mBean, COUNT_MESSAGES_SIG2, [filter]).catch(error => {
                eventService.notify({ type: "warning", message: jolokiaService.errorMessage(error) })
                return 0
            }) as number;
        } else {
            count = await jolokiaService.execute(mBean, COUNT_MESSAGES_SIG).catch(error => {
                eventService.notify({ type: "warning", message: jolokiaService.errorMessage(error) })
                return 0
            }) as number;
        }
        const messages = await jolokiaService.execute(mBean, BROWSE_SIG, [page, perPage, filter]).catch(error => {
            eventService.notify({ type: "warning", message: jolokiaService.errorMessage(error) })
            return []
        }) as string;
        return {
            data: messages,
            count: count
        };
    }

    // ---- Methods that call Jolokia to get a filtered/sorted/paged data from the Broker using dedicated JMX methods
    //      all the methods use jolokiaService.execute which returns a Promise. The signatures for the MBean operations
    //      at the broker side use String as the return type, so the value is a String representation of JSON object

    private singleFilter(f: Filter) {
        return {
            field: f.column,
            operation: f.operation,
            value: f.input ? `${f.input}` : ''
        }
    }

    private filterParameter(filter: Filter | Filter[], sort?: ActiveSort, defaultFilter?: Filter): string {
        let connectionsFilter: FilterOptions = {}
        if (sort && sort.column && sort.order) {
            // "sortColumn" is deprecated in ARTEMIS-5071, use "sortField"
            connectionsFilter.sortField = sort.column
            connectionsFilter.sortOrder = sort.order
        }
        if (Array.isArray(filter) && filter.length > 1) {
            // actual multi filter
            connectionsFilter.searchFilters = filter.filter(f => f.column).map(f => this.singleFilter(f))
        } else {
            // a single filter
            const f = Array.isArray(filter) ? filter[0] || undefined : filter
            if (f && f.column && f.operation) {
                Object.assign(connectionsFilter, this.singleFilter(f))
            } else {
                // no filters, we could pass empty array instead of "field CONTAINS ''" but better stay compatible
                // with brokers before 2.53.0
                // connectionsFilter.searchFilters = []
                if (defaultFilter) {
                    Object.assign(connectionsFilter, this.singleFilter(defaultFilter))
                } else {
                    connectionsFilter.searchFilters = []
                }
            }
        }
        return JSON.stringify(connectionsFilter)
    }

    async getConnections(page: number, perPage: number, sort: ActiveSort | undefined, filter: Filter | Filter[], emptyFilter?: Filter): Promise<string> {
        const filtering = this.filterParameter(filter, sort, emptyFilter)
        return jolokiaService.execute(await this.getBrokerObjectName(), LIST_CONNECTIONS_SIG, [filtering, page, perPage]) as Promise<string>
    }

    async getSessions(page: number, perPage: number, sort: ActiveSort | undefined, filter: Filter | Filter[], emptyFilter?: Filter): Promise<string> {
        const filtering = this.filterParameter(filter, sort, emptyFilter)
        return await jolokiaService.execute(await this.getBrokerObjectName(), LIST_SESSIONS_SIG, [filtering, page, perPage]) as string;
    }

    async getProducers(page: number, perPage: number, sort: ActiveSort | undefined, filter: Filter | Filter[], emptyFilter?: Filter): Promise<string> {
        const filtering = this.filterParameter(filter, sort, emptyFilter)
        return await jolokiaService.execute(await this.getBrokerObjectName(), LIST_PRODUCERS_SIG, [filtering, page, perPage]) as string;
    }

    async getConsumers(page: number, perPage: number, sort: ActiveSort | undefined, filter: Filter | Filter[], emptyFilter?: Filter): Promise<string> {
        const filtering = this.filterParameter(filter, sort, emptyFilter)
        return await jolokiaService.execute(await this.getBrokerObjectName(), LIST_CONSUMERS_SIG, [filtering, page, perPage]) as string;
    }

    async getAddresses(page: number, perPage: number, sort: ActiveSort | undefined, filter: Filter | Filter[], emptyFilter?: Filter): Promise<string> {
        const filtering = this.filterParameter(filter, sort, emptyFilter)
        return await jolokiaService.execute(await this.getBrokerObjectName(), LIST_ADDRESSES_SIG, [filtering, page, perPage]) as string;
    }

    async getQueues(page: number, perPage: number, sort: ActiveSort | undefined, filter: Filter | Filter[], emptyFilter?: Filter): Promise<string> {
        const filtering = this.filterParameter(filter, sort, emptyFilter)
        return await jolokiaService.execute(await this.getBrokerObjectName(), LIST_QUEUES_SIG, [filtering, page, perPage]) as string;
    }

    async getAllAddresses(addressFilter: string): Promise<string[]> {     
        return new Promise<string[]>(async (resolve, reject) => {
            const addressesString =  await jolokiaService.execute(await this.getBrokerObjectName(), LIST_ALL_ADDRESSES_SIG,  [',']).catch(error => {
                eventService.notify({ type: "warning", message: jolokiaService.errorMessage(error) })
                return ""
            }) as string;
            if (addressesString) {
                const addressArray = addressesString.split(',')
                if (addressFilter && addressFilter.length > 0) {
                    const filtered = addressArray.filter(function (str) { return str.includes(addressFilter); });
                    resolve(filtered);   
                } else {
                    resolve(addressArray);
                }           
            }
            reject("invalid response:" + addressesString);
        });
    }

    async getQueuesForAddress(address: string): Promise<string> {
        const queuesFilter = {
            field: 'address',
            operation: 'EQUALS',
            value: address
        };
        return await jolokiaService.execute(await this.getBrokerObjectName(), LIST_QUEUES_SIG, [JSON.stringify(queuesFilter), 1, 1000]) as string;
    }

    async deleteQueue(name: string) {
        return jolokiaService.execute(await this.getBrokerObjectName(), DESTROY_QUEUE_SIG, [name]);
    }

    async purgeQueue(name: string, address: string, routingType: string) {
        const queueMBean: string = createQueueObjectName(await this.getBrokerObjectName(), address, routingType, name);
        return jolokiaService.execute(queueMBean, REMOVE_ALL_MESSAGES_SIG);
    }

    async closeConnection(name: string) {
        return jolokiaService.execute(await this.getBrokerObjectName(), CLOSE_CONNECTION_SIG, [name]);
    }

    async closeSession(connection: string, name: string) {
        return jolokiaService.execute(await this.getBrokerObjectName(), CLOSE_SESSION_SIG, [connection, name]);
    }

    async closeConsumer(session: string, name: string) {
        return jolokiaService.execute(await this.getBrokerObjectName(), CLOSE_CONSUMER_SIG, [session, name]);
    }

    async startLockCoordinator(name: string) {
        return jolokiaService.execute(await this.getBrokerObjectName(), START_LOCK_COORDINATOR_SIG, [name]);
    }

    async stopLockCoordinator(name: string) {
        return jolokiaService.execute(await this.getBrokerObjectName(), STOP_LOCK_COORDINATOR_SIG, [name]);
    }

    async getBrokerObjectName() {
        return await this.brokerObjectName;
    }


    getKeyByValue = (message: any, columnID: string): string => {
        if (columnID === "type") {
            const idx: number = message[columnID];
            return typeLabels[idx];
        }
        if (columnID === "timestamp") {
            const timestamp: number = message[columnID];
            return this.formatTimestamp(timestamp);
        }
        if (columnID === "expiration") {
            const timestamp: number = message[columnID];
            return this.formatExpires(timestamp, false);
        }
        if (columnID === "persistentSize") {
            const size: number = message[columnID];
            return this.formatPersistentSize(size);
        }
        if (columnID === "originalQueue" && message["StringProperties"]) {
            const originalQueue = message["StringProperties"]._AMQ_ORIG_QUEUE != null ? message["StringProperties"]._AMQ_ORIG_QUEUE : message["StringProperties"]["extraProperties._AMQ_ORIG_QUEUE"]
            return originalQueue ? originalQueue : "";
        }
        return message[columnID] ? "" + message[columnID] : "";
    }

    formatType = (message: Message) => {
        const typeLabels = ["default", "1", "object", "text", "bytes", "map", "stream", "embedded"];
        return message.type + " (" + typeLabels[message.type] + ")";
    }

    formatExpires = (timestamp: number, addTimestamp: boolean): string => {
        if (isNaN(timestamp) || typeof timestamp !== "number") {
            return "" + timestamp;
        }
        if (timestamp === 0) {
            return "never";
        }
        const expiresIn = timestamp - Date.now();
        if (Math.abs(expiresIn) < MS_PER_DAY) {
            const duration = expiresIn < 0 ? -expiresIn : expiresIn;
            const hours = this.pad2(Math.floor((duration / MS_PER_HOUR) % 24));
            const mins = this.pad2(Math.floor((duration / MS_PER_MIN) % 60));
            const secs = this.pad2(Math.floor((duration / MS_PER_SEC) % 60));
            let ret;
            if (expiresIn < 0) {
                // "HH:mm:ss ago"
                ret = hours + ":" + mins + ":" + secs + " ago";
            } else {
                // "in HH:mm:ss"
                ret = "in " + hours + ":" + mins + ":" + secs;
            }
            if (addTimestamp) {
                ret += ", at " + this.formatTimestamp(timestamp);
            }
            return ret;
        }
        return this.formatTimestamp(timestamp);
    }


    formatPersistentSize = (bytes: number) => {
        if (isNaN(bytes) || typeof bytes !== "number" || bytes < 0) return "N/A";
        if (bytes < 10240) return bytes.toLocaleString() + " Bytes";
        if (bytes < 1048576) return (bytes / 1024).toFixed(2) + " KiB";
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + " MiB";
        return (bytes / 1073741824).toFixed(2) + " GiB";
    }


    formatTimestamp = (timestamp: number): string => {
        if (isNaN(timestamp) || typeof timestamp !== "number") {
            return "" + timestamp;
        }
        if (timestamp === 0) {
            return "N/A";
        }
        const d = new Date(timestamp);
        // "yyyy-MM-dd HH:mm:ss"
        //add 1 to month as getmonth returns the position not the actual month
        return d.getFullYear() + "-" + this.pad2(d.getMonth() + 1) + "-" + this.pad2(d.getDate()) + " " + this.pad2(d.getHours()) + ":" + this.pad2(d.getMinutes()) + ":" + this.pad2(d.getSeconds());
    }

    pad2 = (value: number) => {
        return (value < 10 ? '0' : '') + value;
    }

    private DEBUG_PRIVS = true;

    canCreateQueue = (broker: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && broker?.hasInvokeRights(CREATE_QUEUE_SIG)) ?? false
    }

    canCreateAddress = (broker: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && broker?.hasInvokeRights(CREATE_ADDRESS_SIG) )?? false
    }

    canSendMessageToAddress = (broker: MBeanNode | undefined, address: string): boolean => {
        if(broker) {
            const addressMBean = broker.parent?.find(node => { 
                return node.propertyList?.get('component') === 'addresses' && node.propertyList?.get('subcomponent') === undefined && node.name === address 
            })
            return this.checkCanSendMessageToAddress(addressMBean as MBeanNode);
        }
        return false;
    }

    checkCanSendMessageToAddress = (addressMBean: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && addressMBean?.hasInvokeRights(SEND_MESSAGE_SIG)) ?? false;
    }

    canDeleteAddress = (broker: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && broker?.hasInvokeRights(DELETE_ADDRESS_SIG)) ?? false
    }

    canDeleteQueue = (broker: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && broker?.hasInvokeRights(DESTROY_QUEUE_SIG)) ?? false
    }

    canPurgeQueue = (broker: MBeanNode | undefined, queue: string): boolean => {
        if(broker) {
            const queueMBean = broker.parent?.find(node => { 
                return node.propertyList?.get('subcomponent') === 'queues' && node.name === queue 
            })
            return (this.DEBUG_PRIVS && queueMBean?.hasInvokeRights(REMOVE_ALL_MESSAGES_SIG)) ?? false;
        }
        return false;
    }

    canSendMessageToQueue = (broker: MBeanNode | undefined, queue: string): boolean => {
        if(broker) {
            const queueMBean = broker.parent?.find(node => { 
                return node.propertyList?.get('subcomponent') === 'queues' && node.name === queue 
            })
            return this.checkCanSendMessageToQueue(queueMBean as MBeanNode);
        }
        return false;
    }

    checkCanSendMessageToQueue = (queueMBean: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && queueMBean?.hasInvokeRights(SEND_MESSAGE_SIG)) ?? false;
    }

    canListLockCoordinators = (brokerMBean: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && brokerMBean?.hasInvokeRights(LIST_LOCK_MANAGER_SIG)) ?? false;
    }
    canBrowseQueue = (broker: MBeanNode | undefined, queue: string): boolean => {
        if(broker) {
            const queueMBean = broker.parent?.find(node => { 
                return node.propertyList?.get('subcomponent') === 'queues' && node.name === queue 
            })
            return this.checkCanBrowseQueue(queueMBean as MBeanNode);
        }
        return false;
    }

    getQueuePermissions = (broker: MBeanNode | undefined): Record<string, queuePermissions> => {
        const queuePermissionsMap: Record<string, queuePermissions> = {};

        const collectQueues = (node: MBeanNode) => {
            if (node.propertyList?.get("subcomponent") === "queues") {
                queuePermissionsMap[node.name] = {
                    canSend: node.hasInvokeRights(SEND_MESSAGE_SIG) ?? false,
                    canPurge: node.hasInvokeRights(REMOVE_ALL_MESSAGES_SIG) ?? false,
                    canBrowse: node.hasInvokeRights(BROWSE_SIG) ?? false
                };
            }

            node.children?.forEach(child => collectQueues(child));
        };

        const addressesFolder = broker?.get('addresses', true);
        if (addressesFolder) {
            collectQueues(addressesFolder);
        }

        return queuePermissionsMap;
    };

    getAddressPermissions = (broker: MBeanNode | undefined): Record<string, addressPermissions> => {
        const addressPermissionsMap: Record<string, addressPermissions> = {};

        broker?.get('addresses', true)?.children?.forEach(node => {
            // hasInvokeRights() returns true for a folder without an MBean, so such nodes have to be skipped
            if (node.mbean) {
                addressPermissionsMap[node.name] = {
                    canSend: node.hasInvokeRights(SEND_MESSAGE_SIG) ?? false
                };
            }
        });

        return addressPermissionsMap;
    };

    checkCanBrowseQueue =(queueMBean: MBeanNode ): boolean => {
        return (this.DEBUG_PRIVS && queueMBean?.hasInvokeRights(BROWSE_SIG)) ?? false;
    }

    doesCopyMessageMethodExist = (broker: MBeanNode | undefined, queue: string): boolean => {
        return this.doesMethodExist(broker, queue, COPY_MESSAGE_SIG);
    }

    doesMethodExist = (broker: MBeanNode | undefined, queue: string, method: string): boolean => {
        if(broker) {
            const queueMBean = broker.parent?.find(node => { 
                return node.propertyList?.get('subcomponent') === 'queues' && node.name === queue 
            })
            return queueMBean?queueMBean.hasOperations(method): false;
        }
        return false;
    }

    doesListLockCoordinatorMethodExist = (broker: MBeanNode | undefined): boolean => {
        return broker?broker.hasOperations("listLockCoordinatorsAsJSON"): false;
    }

    canListConnections = (broker: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && broker?.hasInvokeRights(LIST_CONNECTIONS_SIG)) ?? false
    }

    canListSessions = (broker: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && broker?.hasInvokeRights(LIST_SESSIONS_SIG)) ?? false
    }

    canListConsumers = (broker: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && broker?.hasInvokeRights(LIST_CONSUMERS_SIG)) ?? false
    }

    canListProducers = (broker: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && broker?.hasInvokeRights(LIST_PRODUCERS_SIG)) ?? false
    }

    canListAddresses = (broker: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && broker?.hasInvokeRights(LIST_ADDRESSES_SIG)) ?? false
    }

    canListQueues = (broker: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && broker?.hasInvokeRights(LIST_QUEUES_SIG)) ?? false
    }

    canListNetworkTopology = (broker: MBeanNode | undefined): boolean => {
        return (this.DEBUG_PRIVS && broker?.hasInvokeRights(LIST_NETWORK_TOPOLOGY_SIG)) ?? false
    }

    addStatusListener = (listener: () => void) => {
        this.statusListeners.push(listener)
    }

    removeStatusListener = (listener: () => void) => {
        this.statusListeners = this.statusListeners.filter(l => l !== listener)
    }

    get status(): BrokerStatus {
        return this.brokerStatus
    }

    set status(st: BrokerStatus) {
        this.brokerStatus = st
        this.statusListeners.forEach(l => { l(st) })
    }
}

export async function findMBeanInfo(brokerObjectName: string): Promise<MBeanNode | null> {
    const tree = await workspace.getTree()
    const parsed = parseMBeanName(brokerObjectName)

    const matching = parsed.domain && tree.findMBeans(parsed.domain, parsed.properties)
    if (!matching) {
        return null
    }
    if (matching.length == 1) {
        return matching[0]
    } else {
        const more = matching.filter(node => node.objectName === brokerObjectName)
        return more.length > 0 ? more[0] : null
    }
}

/**
 * Jolokia's `getAttributes()` may return an object, where each field is an error value (when RBAC is enabled
 * for example). In this case, the value has special `.error` field. This function checks validity of an object
 * or value.
 * @param value
 */
export function isValid(value: any): { valid: boolean, message: string | null } {
    if (typeof value === "object") {
        if (".error" in value) {
            // the value itself is an error value
            return { valid: false, message: jolokiaService.errorMessage(value) }
        }
        for (const k in value) {
            const v = value[k]
            if (v && typeof v === "object" && ".error" in v) {
                // fail fast with an error related to first field of the wrapping object
                return { valid: false, message: jolokiaService.errorMessage(v) }
            }
        }
    }
    return { valid: true, message: null }
}

export const artemisService = new ArtemisService()
