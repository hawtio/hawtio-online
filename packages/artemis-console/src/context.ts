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
import { eventService, EVENT_REFRESH,MBeanNode, MBeanTree, PluginNodeSelectionContext, workspace } from "@hawtio/react";
import { createContext, startTransition, useCallback, useContext, useEffect, useRef, useState } from "react";
import { type To, useLocation, useNavigate, useSearchParams } from 'react-router'
import { artemisJMXPluginPath, artemisPluginName, PARAM_KEY_NODE_ID } from "./globals";
import { configManager } from "./config-manager";
import { artemisService, BrokerStatus } from './artemis-service'

/**
 * Custom React hook for using the Artemis MBean tree.
 */
export function useArtemisTree() {
    // the top-level state declared at HawtioPage level which contains global "selected node" state
    // this is shared with other plugins using the tree
    const { selectedNode, setSelectedNode } = useContext(PluginNodeSelectionContext)

    // Camel plugin specific state containing the partial Jmx tree available outside the React state
    const [tree, setTree] = useState(MBeanTree.createEmpty(artemisPluginName))
    // tree loading may happen in the background and "loaded" reflects the state of (re)load
    const [loaded, setLoaded] = useState(false)

    const navigate = useNavigate()

    const [brokerNode, setBrokerNode] = useState<MBeanNode>();
    const [jmxDomain, setJmxDomain] = useState<string>();

    const artemisDomain = useRef<MBeanNode | null>(null)

    // Normally (as with global Jmx tree) we just need to call `await workspace.getTree()`, but
    // with Artemis JMX, we need a subtree from the Artemis JMX domain
    const populateTree = useCallback(async (): Promise<MBeanTree | null> => {
        const wkspTree: MBeanTree = await workspace.getTree()
        const config = await configManager.getArtemisconfig();
        const artemisJmxDomainNode = wkspTree.find(node => node.name === config.jmx.domain)
        if (!(artemisJmxDomainNode && artemisJmxDomainNode.children && artemisJmxDomainNode.children.length > 0)) {
            // change the status (it'll notify the listeners - one of them is the header status)
            artemisService.status = BrokerStatus.MISSING_IN_JMX
            return null
        }

        if (artemisJmxDomainNode.children[0].objectName) {
            artemisJmxDomainNode.children[0].addMetadata("type", "brokerType");
            setBrokerNode(artemisJmxDomainNode.children[0]);
        }

        // remember the reference for the Artemis domain node
        artemisDomain.current = artemisJmxDomainNode
        setJmxDomain(config.jmx.domain)

        // Using the camel domain nodes from the original tree means it is the same
        // node as that that appears in the workspace tree
        // There should be only one actual Camel context - contextsNode.getChildren() should be of length=1
        return MBeanTree.createFromNodes(artemisPluginName, [artemisJmxDomainNode])
    }, [navigate])

    // this effect loads the tree - both at initial render and when the tree is refreshed (by TreeWatcher)
    // outside of React
    useEffect(() => {
        let apply = true
        const loadTree = async () => {
            // Jmx plugin just calls "await workspace.getTree()", but we need only part of it
            const tree = await populateTree()
            if (apply) {
                if (tree) {
                    setTree(tree)
                    artemisService.status = BrokerStatus.AVAILABLE
                }
                setLoaded(true)
            }
        }

        const listener = () => {
            setLoaded(false)
            apply = true
            loadTree()
        }
        eventService.onRefresh(listener)

        loadTree()

        return () => {
            apply = false
            eventService.removeListener(EVENT_REFRESH, listener)
            if (jmxDomain) {
                workspace.clearExpandAll(jmxDomain)
            }
        }
    }, [populateTree])

    const findAndSelectNode = useCallback((objectName: string, name: string) => {
        let node: MBeanNode | null = tree.find(node => { 
            return node.objectName === objectName 
        });
        if (!node) {
            //need some special sauce here if we are lazy loading to populate the mbean
            const parentNode = tree.find(node => node.name === "addresses");
            node = new MBeanNode(parentNode, name, false);
            node.objectName = objectName;
            parentNode?.children?.push(node);
        }
        setSelectedNode(node);
    }, [tree, setSelectedNode])

    return { tree, loaded, brokerNode, jmxDomain, selectedNode, setSelectedNode, findAndSelectNode }
}

/**
 * Custom React hook that uses `useArtemisTree()` and synchronizes the tree selection and `nid` parameter
 */
export function useTreeSynchronization() {
    const { tree, loaded, brokerNode, selectedNode, jmxDomain, setSelectedNode, findAndSelectNode } = useArtemisTree()

    // "initial" flag though is cleared only once. When displayed for the first time
    // when navigating to Artemis JMX plugin we expand default folders, but we should not do it on background reload
    const [initial, setInitial] = useState(true)

    const { pathname, search } = useLocation()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    // synchronize the `nid` query parameter and the global state for "selected node"
    useEffect(() => {
        const nid = searchParams.get('nid') ?? new URLSearchParams(window.location.search).get('nid')
        if (selectedNode && (!nid || nid !== selectedNode.id)) {
            // because we may retrieve "nid" being out of sync with React Router state, we have to
            // navigate fully (not just setSearchParams())
            navigate(pluginPathWithNodeId(selectedNode, artemisJMXPluginPath, searchParams), { replace: true })
            return
        }
        if (loaded) {
            // first, as with Jmx plugin, we'll try to get the selected node from `nid` query parameter
            // but we won't immediately set the found node as selected, because it may not be from Camel domain
            let selectedFromQuery: MBeanNode | null = null
            if (!selectedNode && nid) {
                const found = tree.find(node => node.id === nid)
                if (found) {
                    const path = found.path()
                    selectedFromQuery = tree.navigate(...path)
                }
            }

            let selectedArtemisNode = null
            let s = selectedFromQuery ?? selectedNode
            while (s) {
                if (s.name === jmxDomain) {
                    selectedArtemisNode = selectedFromQuery ?? selectedNode
                    break
                }
                s = s.parent
            }

            const artemisDomainNode = tree.find(n => n.name === jmxDomain)

            if (!selectedArtemisNode && artemisDomainNode) {
                // nid didn't point to anything we can select for Artemis JMX tab, so lets do the default selection
                // when the Artemis is displayed for the first time - let's use first available broker node
                if (initial) {
                    if (jmxDomain) {
                        workspace.expandAll(false, jmxDomain)
                        workspace.clearExpandAll(jmxDomain)
                    }
                    // always expand the context tree
                    workspace.expand(true, artemisDomainNode)

                    // try to select first broker
                    const toSelect = artemisDomainNode.children?.[0] ?? artemisDomainNode
                    const path = [...toSelect.path()]
                    const selected = tree.navigate(...path)
                    if (selected) {
                        tree.forEach(path, n => {
                            workspace.expand(true, n)
                        })
                        startTransition(() => {
                            setSelectedNode(selected)
                        })
                        searchParams.delete('nid')
                    }
                }
            } else if (selectedArtemisNode) {
                // nid points to some existing node in the Artemis tree
                tree.forEach(selectedArtemisNode.path(), n => {
                    workspace.expand(true, n)
                })
                startTransition(() => {
                    setSelectedNode(selectedArtemisNode)
                })
            } else {
                // there may be a selected node, but not from Artemis domain
                startTransition(() => {
                    setSelectedNode(null)
                })
                searchParams.delete('nid')
                navigate({ pathname: artemisJMXPluginPath, search: searchParams.toString() }, { replace: true })
            }
            startTransition(() => {
                setInitial(false)
            })
        }
    }, [pathname, search, loaded, tree, selectedNode, setSelectedNode, navigate, searchParams, initial])

    // this effect navigates the tree and expands relevant nodes if the selected node changes
    useEffect(() => {
        if (selectedNode) {
            const path = [...selectedNode.path()]
            // Ensure the new version of the selected node is selected in the reloaded tree
            const newSelected = tree.navigate(...path)
            if (newSelected) {
                tree.forEach(path, n => {
                    workspace.expand(true, n)
                })
                // important to reselect the node upon refresh to point to a new instance
                // with the same ID and path
                if (!Object.is(newSelected, selectedNode)) {
                    setSelectedNode(newSelected)
                }
            }
        }
    }, [tree, selectedNode, setSelectedNode])

    return { tree, loaded, brokerNode, jmxDomain, selectedNode, setSelectedNode, findAndSelectNode }
}

/**
 * Build URL query string with `nid` parameter, preserving other existing params
 * @param node The node to encode
 * @param pathname the path to use for the prepared URL
 * @param searchParams The current URL search params to preserve, defaults to the ones from the window location
 */
export function pluginPathWithNodeId(
    node: MBeanNode,
    pathname: string,
    searchParams: URLSearchParams = new URLSearchParams(window.location.search),
): Partial<To> {
    searchParams.set(PARAM_KEY_NODE_ID, node.id)
    return { pathname, search: searchParams.toString() }
}

export type ArtemisTreeContext = {
    tree: MBeanTree
    loaded: boolean
    selectedNode: MBeanNode | null
    jmxDomain: string | undefined
    brokerNode: MBeanNode | undefined
    setSelectedNode: (selected: MBeanNode | null) => void
    findAndSelectNode: (objectName: string, name: string) => void
}

export const ArtemisContext = createContext<ArtemisTreeContext>({
    tree: MBeanTree.createEmpty(artemisPluginName),
    loaded: false,
    selectedNode: null,
    brokerNode: undefined,
    jmxDomain: undefined,
    setSelectedNode: () => {
        /* no-op */
    },
    findAndSelectNode: (_objectName: string, _name: string) => {
        /* no-op */
    }
})
