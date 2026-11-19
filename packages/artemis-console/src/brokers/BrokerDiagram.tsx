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
import * as React from 'react';
import { ClusterIcon } from '@patternfly/react-icons/dist/esm/icons/cluster-icon';

import {
  ColaLayout,
  ComponentFactory,
  DefaultEdge,
  DefaultGroup,
  DefaultNode,
  DragObjectWithType,
  Edge,
  EdgeModel,
  EdgeStyle,
  Graph,
  GraphComponent,
  graphDropTargetSpec,
  GRAPH_LAYOUT_END_EVENT,
  groupDropTargetSpec,
  Layout,
  LayoutFactory,
  Model,
  ModelKind,
  Node,
  nodeDragSourceSpec,
  nodeDropTargetSpec,
  NodeModel,
  NodeShape,
  NodeStatus,
  SELECTION_EVENT,
  TopologyView,
  Visualization,
  VisualizationProvider,
  VisualizationSurface,
  withDndDrop,
  WithDndDropProps,
  withDragNode,
  WithDragNodeProps,
  withPanZoom,
  withSelection,
  WithSelectionProps,
  withTargetDrag,
  TopologySideBar,
  defaultElementFactory
} from '@patternfly/react-topology';
import { useEffect, useRef, useState } from 'react';
import { artemisService, BrokerInfo, BrokerTopology } from '../artemis-service';
import { Attributes } from '@hawtio/react';
import { ToolbarItem, Select, SelectOption, Button, MenuToggleElement, MenuToggle, SelectList, SearchInput } from '@patternfly/react-core';
import { createAddressObjectName, createQueueObjectName } from '../util/jmx';
import { ArtemisContext } from '../context';
import { log } from '../globals';
import { artemisPreferencesService } from '../artemis-preferences-service';


const BadgeColors = [
  {
    name: 'A',
    badgeColor: '#ace12e',
    badgeTextColor: '#0f280d',
    badgeBorderColor: '#486b00'
  },
  {
    name: 'B',
    badgeColor: '#F2F0FC',
    badgeTextColor: '#5752d1',
    badgeBorderColor: '#CBC1FF'
  },
  {
    name: 'Broker',
    badgeColor: '#c12766',
    badgeTextColor: 'white',
    badgeBorderColor: '#CBC1FF'
  },
  {
    name: 'Address',
    badgeColor: '#3e489f',
    badgeTextColor: 'white',
    badgeBorderColor: '#CBC1FF'
  },
  {
    name: 'Queue',
    badgeColor: '#50621d',
    badgeTextColor: 'white',
    badgeBorderColor: '#CBC1FF'
  },
  {
    name: 'Internal Address',
    badgeColor: '#cf242a',
    badgeTextColor: 'white',
    badgeBorderColor: '#CBC1FF'
  },
  {
    name: 'Internal Queue',
    badgeColor: '#cf242a',
    badgeTextColor: 'white',
    badgeBorderColor: '#CBC1FF'
  }
];

interface ControllerState {
  selectedIds: string[];
  viewOptions: ViewOptions;
}

type CustomNodeProps = {
  element: Node;
} & WithDragNodeProps;



const BrokerCustomNode: React.FC<CustomNodeProps & WithSelectionProps & WithDragNodeProps & WithDndDropProps> = ({ element, onSelect, selected, ...rest }) => {
  const data = element.getData();
  const selectNode = data.selectNode;
  const Icon = ClusterIcon;
  const { viewOptions } = element.getController().getState<ControllerState>();

  return (
    <DefaultNode 
      element={element}
      showStatusDecorator
      badge={data.badge}
      labelClassName={data.labelClassName}
      showLabel={viewOptions.showLabels}
      className={data.className}
      onSelect={() => selectNode(data)}
      selected={selected}
      {...rest}
    >
      <g transform={`translate(25, 25)`}>
        <Icon style={{ color: '#000000', fill: '#000000' }} width={25} height={25}></Icon>
      </g>
    </DefaultNode>
  );
};

const BrokerBackupCustomNode: React.FC<CustomNodeProps & WithSelectionProps & WithDragNodeProps & WithDndDropProps> = ({ element, onSelect, selected, ...rest }) => {
  const data = element.getData();
  const selectNode = data.selectNode;
  const Icon = ClusterIcon;
  const { viewOptions } = element.getController().getState<ControllerState>();

  return (
    <DefaultNode 
      element={element}
      showStatusDecorator
      badge={data.badge}
      labelClassName={data.labelClassName}
      showLabel={viewOptions.showLabels}
      className={data.className}
      onSelect={() => selectNode(data)}
      selected={selected}
      {...rest}
    >
      <g transform={`translate(25, 25)`}>
        <Icon style={{ color: '#000000', fill: '#000000' }} width={25} height={25}></Icon>
      </g>
    </DefaultNode>
  );
};

const ResourceNode: React.FC<CustomNodeProps & WithSelectionProps & WithDragNodeProps & WithDndDropProps> = ({ element, onSelect, selected, ...rest  }) => {
  const data = element.getData();
  const selectNode = data.selectNode;
  const { viewOptions } = element.getController().getState<ControllerState>();

  return (
    <DefaultNode
      element={element}
      showStatusDecorator
      badge={data.badge}
      labelClassName={data.labelClassName}
      showLabel={viewOptions.showLabels}
      className={data.className}
      onSelect={() => selectNode(data)}
      selected={selected}
      {...rest}
    >
    </DefaultNode>
  );
};
const customComponentFactory: ComponentFactory = (kind: ModelKind, type: string): any => {
  switch (type) {
    case 'group':
      return withDndDrop(groupDropTargetSpec)(withDragNode(nodeDragSourceSpec('group'))(withSelection()(DefaultGroup)));
    default:
      switch (kind) {
        case ModelKind.graph:
          return withDndDrop(graphDropTargetSpec())(withPanZoom()(GraphComponent));
        case ModelKind.node:
          switch(type) {
            case 'broker':
              return withDndDrop(nodeDropTargetSpec([CONNECTOR_TARGET_DROP]))(
                withDragNode(nodeDragSourceSpec('node', true, true))(BrokerCustomNode));
            case 'backupBroker':
              return withDndDrop(nodeDropTargetSpec([CONNECTOR_TARGET_DROP]))(
                withDragNode(nodeDragSourceSpec('node', true, true))(BrokerBackupCustomNode));
            case 'resource':
              return withDndDrop(nodeDropTargetSpec([CONNECTOR_TARGET_DROP]))(
                withDragNode(nodeDragSourceSpec('node', true, true))(ResourceNode));
            default:
              return withDndDrop(nodeDropTargetSpec([CONNECTOR_TARGET_DROP]))(
                withDragNode(nodeDragSourceSpec('node', true, true))(ResourceNode));
          }
        case ModelKind.edge:
          return withTargetDrag<
            DragObjectWithType,
            Node,
            { dragging?: boolean },
            {
              element: Edge;
            }
          >({
            item: { type: CONNECTOR_TARGET_DROP },
            begin: (monitor, props) => {
              props.element.raise();
              return props.element;
            },
            drag: (event, monitor, props) => {
              props.element.setEndPoint(event.x, event.y);
            },
            end: (dropResult, monitor, props) => {
              if (monitor.didDrop() && dropResult && props) {
                props.element.setTarget(dropResult);
              }
              props.element.setEndPoint();
            },
            collect: monitor => ({
              dragging: monitor.isDragging()
            })
            // @ts-ignore
          })(DefaultEdge);
        default:
          return undefined;
      }
  }
};




const customLayoutFactory: LayoutFactory = (type: string, graph: Graph): Layout | undefined => {
  switch (type) {
    case 'Cola':
      return new ColaLayout(graph);
    default:
      return new ColaLayout(graph, { layoutOnDrag: true });
  }
};

const CONNECTOR_TARGET_DROP = 'connector-target-drop';



const BROKER_NODE_DIAMETER = 75;
const ADDRESS_NODE_DIAMETER = 50;
const QUEUE_NODE_DIAMETER = 50;

const NODES: NodeModel[] = [];
const EDGES: EdgeModel[] = [];

interface ViewOptions {
  showLabels: boolean;
  showAddresses: boolean;
  showQueues: boolean;
  showInternalAddresses: boolean;
  showInternalQueues: boolean;
  showConnectors: boolean;
}

export const DefaultViewOptions: ViewOptions = {
  showLabels: true,
  showAddresses: true,
  showQueues: true,
  showInternalAddresses: false,
  showInternalQueues: false,
  showConnectors: true
};

function isInternalName(name: string, start=0) {
  // starts at position 1 when the name is surrounded with quotes
  return name.startsWith("$", start) || name.startsWith("notif", start);
}

export const BrokerDiagram: React.FunctionComponent = () => {
  const [ selectedIds, setSelectedIds ] = React.useState<string[]>([]);
  const [ viewOptionsOpen, setViewOptionsOpen ] = useState<boolean>(false);
  const [ viewOptions, setViewOptions] = React.useState<ViewOptions>(DefaultViewOptions);
  const [ showSidebar, setShowSidebar ] = React.useState(false);
  const [ sidebarTitle, setSidebarTitle ] = React.useState("");
  const [ brokerTopology, setBrokerTopology ] = React.useState<BrokerTopology>();
  const [ topologyLoaded, setTopologyLoaded ] = React.useState(false);
  const [ addressFilter, setAddressFilter ] = React.useState('');

  const latch = useRef<{ p?: Promise<boolean>, r?: (v: boolean) => void, t: number }>()
  
  if (!latch.current) {
    latch.current = {
      t: performance.now()
    }
  }

  const maxAddresses: number = artemisPreferencesService.loadArtemisPreferences().artemisMaxDiagramAddressSize;

  const { findAndSelectNode } = React.useContext(ArtemisContext);

  const onSearchTextChange = (newValue: string) => {
    setAddressFilter(newValue);
  };

  const selectNode = React.useCallback((data: any) => {
    if (data.queue != null) {
      artemisService.getBrokerObjectName().then((brokerObjectName) => {
        const queueObjectName = createQueueObjectName(brokerObjectName, data.address, data.routingType, data.queue);
        setSidebarTitle(queueObjectName);
        findAndSelectNode(queueObjectName, "");
        setShowSidebar(true)
      });
    } else if(data.address != null ) {
        artemisService.getBrokerObjectName().then((brokerObjectName) => {
        const addressObjectName = createAddressObjectName(brokerObjectName, data.address);
        setSidebarTitle(addressObjectName);
        findAndSelectNode(addressObjectName, "");
        setShowSidebar(true)
      });
    } else {
      artemisService.getBrokerObjectName().then((brokerObjectName) => {
        if (data.type === "local") {
          setSidebarTitle(brokerObjectName);
          findAndSelectNode(brokerObjectName, "");
          setShowSidebar(true)
        } else {
          setShowSidebar(false)
        }
      })
    }
  }, [findAndSelectNode])

  const controller = React.useMemo(() => {
    const model: Model = {
      nodes: NODES,
      edges: EDGES,
      graph: {
        id: 'g1',
        type: 'graph',
        layout: 'Cola'
      }
    };

    const newController = new Visualization();
    newController.registerLayoutFactory(customLayoutFactory);
    newController.registerComponentFactory(customComponentFactory);
    newController.registerElementFactory(defaultElementFactory)

    newController.addEventListener(SELECTION_EVENT, setSelectedIds);
    newController.addEventListener(GRAPH_LAYOUT_END_EVENT, () => {
      newController.getGraph().fit(80);
      latch.current?.r?.(true)
    });

    newController.fromModel(model, false);
    return newController;
  }, []);

  useEffect(() => {
    let backupBrokerNode: NodeModel
    let brokerEdge: EdgeModel
    if (!topologyLoaded) {
      artemisService.createBrokerTopology(maxAddresses, addressFilter).then(brokerTopology => {
        setTopologyLoaded(true);
        setBrokerTopology(brokerTopology!);
      });
      return
    }
    if (topologyLoaded && brokerTopology) {
      const brokerNode: NodeModel = {
        id: brokerTopology.broker.nodeID,
        type: 'broker',
        label: brokerTopology.broker.name,
        width: BROKER_NODE_DIAMETER,
        height: BROKER_NODE_DIAMETER,
        shape: NodeShape.ellipse,
        status: NodeStatus.info,
        style: {
          fill: "black"
        },
        data: {
          badge: 'Broker',
          className: 'artemisBroker',
          labelClassName: 'artemisBrokerLabel',
          type: "local",
          selectNode: selectNode
        }
      }
      const newBrokerNodes: NodeModel[] = [];
      const newBrokerEdges: EdgeModel[] = [];
      newBrokerNodes.push(brokerNode);

      const model: Model = {
        nodes: newBrokerNodes,
        edges: newBrokerEdges,
        graph: {
          id: 'g1',
          type: 'graph',
          layout: 'Cola'
        }
      };

      for (const broker of brokerTopology.broker.networkTopology.brokers) {
        if (brokerTopology.broker.nodeID !== broker.nodeID) {
          const remoteBrokerNode: NodeModel = {
            id: broker.nodeID,
            type: 'broker',
            label: broker.live,
            width: BROKER_NODE_DIAMETER,
            height: BROKER_NODE_DIAMETER,
            shape: NodeShape.ellipse,
            status: NodeStatus.info,
            data: {
              badge: 'Broker',
              className: 'artemisBroker',
              labelClassName: 'artemisBrokerLabel',
              type: "remote",
              selectNode: selectNode
            }
          }
          newBrokerNodes.push(remoteBrokerNode);
          if (viewOptions.showConnectors) {
            brokerEdge = {
              id: 'broker-edge-' + brokerTopology.broker.nodeID + '-broker-node-' + broker.nodeID,
              type: 'edge',
              source: brokerTopology.broker.nodeID,
              target: broker.nodeID,
              edgeStyle: EdgeStyle.default
            }
            newBrokerEdges.push(brokerEdge);
          }
          if(broker.backup) {
            log.debug("adding backup to this live")
            backupBrokerNode = {
              id: broker.nodeID + "backup",
              type: 'backupBroker',
              label: broker.backup,
              width: BROKER_NODE_DIAMETER,
              height: BROKER_NODE_DIAMETER,
              shape: NodeShape.ellipse,
              status: NodeStatus.info,
              data: {
                badge: 'Broker',
                className: 'artemisBackupBroker',
                labelClassName: 'artemisBackupBrokerLabel',
                type: "backupBroker",
                selectNode: selectNode
              }
            }
            newBrokerNodes.push(backupBrokerNode);
            if (viewOptions.showConnectors) {
              brokerEdge = {
                id: 'broker-edge-' + brokerTopology.broker.nodeID + "backup" + '-broker-node-' + broker.nodeID,
                type: 'edge',
                source: broker.nodeID,
                target: broker.nodeID + "backup",
                edgeStyle: EdgeStyle.default
              }
              newBrokerEdges.push(brokerEdge);
            }
          }
        } else if (broker.backup) {
          log.debug("adding backup to this live")
          backupBrokerNode = {
            id: broker.nodeID + "backup",
            type: 'backupBroker',
            label: broker.backup,
            width: BROKER_NODE_DIAMETER,
            height: BROKER_NODE_DIAMETER,
            shape: NodeShape.ellipse,
            status: NodeStatus.info,
            data: {
              badge: 'Broker',
              className: 'artemisBackupBroker',
              labelClassName: 'artemisBackupBrokerLabel',
              type: "backupBroker",
              selectNode: selectNode
            }
          }
          newBrokerNodes.push(backupBrokerNode);
          if (viewOptions.showConnectors) {
            brokerEdge = {
              id: 'broker-edge-' + brokerTopology.broker.nodeID + "backup" + '-broker-node-' + broker.nodeID,
              type: 'edge',
              source: brokerTopology.broker.nodeID,
              target: broker.nodeID + "backup",
              edgeStyle: EdgeStyle.default
            }
            newBrokerEdges.push(brokerEdge);
          }
        }
      }

      for (const address of brokerTopology.addresses) {
        const internalAddress: boolean = isInternalName(address.name);
        if(internalAddress && viewOptions.showInternalAddresses) {
          addInternalAddress(address.name, newBrokerNodes, brokerTopology.broker, newBrokerEdges, controller, model, viewOptions.showConnectors, selectNode);
        } else if (!internalAddress && viewOptions.showAddresses) {
          addAddress(address.name, newBrokerNodes, brokerTopology.broker, newBrokerEdges, controller, model, viewOptions.showConnectors, selectNode);
        }
        for (const queue of address.queues) {
          if (internalAddress && viewOptions.showInternalQueues) {
            addInternalQueue(address.name, queue.name, queue.routingType, newBrokerNodes, brokerTopology.broker, newBrokerEdges, controller, model, viewOptions.showInternalAddresses, viewOptions.showConnectors, selectNode);
          } else if (!internalAddress &&viewOptions.showQueues) {
            addQueue(address.name, queue.name, queue.routingType, newBrokerNodes, brokerTopology.broker, newBrokerEdges, controller, model, viewOptions.showAddresses, viewOptions.showConnectors, selectNode);
          }
        }
      }
      // controller.fromModel(model, false);
      if (latch.current?.p) {
        latch.current.p!.then(() => {
          controller.fromModel(model, false)
        })
      } else {
        controller.fromModel(model, false)
      }
      if (model.nodes && model.nodes.length > 0) {
        latch.current!.p = new Promise(resolve => {
          latch.current!.r = resolve
        })
      } else {
        latch.current!.p = latch.current!.r = undefined
      }
    }

  }, [viewOptions, controller, selectNode, topologyLoaded, brokerTopology])

  const contextToolbar = (
    <><ToolbarItem>
      <Select
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle isFullWidth role='menu' ref={toggleRef} onClick={() => setViewOptionsOpen(prev => !prev)}>
                Node options
              </MenuToggle>
          )}
          onSelect={() => {
          }}
          isOpen={viewOptionsOpen}>
        <SelectList>
          <SelectOption
              value="Labels"
              hasCheckbox
              isSelected={viewOptions.showLabels}
              onClick={() => setViewOptions(prev => ({ ...prev, showLabels: !prev.showLabels }))}>Labels</SelectOption>
          <SelectOption
              value="Addresses"
              hasCheckbox
              isSelected={viewOptions.showAddresses}
              onClick={() => setViewOptions(prev => ({ ...prev, showAddresses: !prev.showAddresses }))}>Addresses</SelectOption>
          <SelectOption
              value="Queues"
              hasCheckbox
              isSelected={viewOptions.showQueues}
              onClick={() => setViewOptions(prev => ({ ...prev, showQueues: !prev.showQueues }))}>Queues</SelectOption>
          <SelectOption
              value="Internal Addresses"
              hasCheckbox
              isSelected={viewOptions.showInternalAddresses}
              onClick={() => setViewOptions(prev => ({ ...prev, showInternalAddresses: !prev.showInternalAddresses }))}>Internal Addresses</SelectOption>
          <SelectOption
              value="Internal Queues"
              hasCheckbox
              isSelected={viewOptions.showInternalQueues}
              onClick={() => setViewOptions(prev => ({ ...prev, showInternalQueues: !prev.showInternalQueues }))}>Internal Queues</SelectOption>
          <SelectOption
              value="Connectors"
              hasCheckbox
              isSelected={viewOptions.showConnectors}
              onClick={() => setViewOptions(prev => ({ ...prev, showConnectors: !prev.showConnectors }))}>Connectors</SelectOption>
        </SelectList>
      </Select>
    </ToolbarItem>
    <ToolbarItem>
      <SearchInput
        aria-label="With filters example search input" hint={addressFilter == '' ? 'Address Filter':''}
        onChange={(_event, value) => onSearchTextChange(value)}
        value={addressFilter}
        onClear={() => {
          onSearchTextChange('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setTopologyLoaded(false);
          }
        }}
      />

    </ToolbarItem>
    <ToolbarItem>
        <Button onClick={() => setTopologyLoaded(false)} size='sm'>Refresh</Button>
    </ToolbarItem></>
  );

  const topologySideBar = (
    <TopologySideBar 
      header={sidebarTitle}
      className="topology-sidebar"
      show={showSidebar}
      onClose={() => setShowSidebar(false)}
    >
      <div style={{ marginTop: 100, marginLeft: 20, height: '800px' }}>
        <Attributes />
      </div>
    </TopologySideBar>
  );

  return (
    <><TopologyView className='broker-diagram' contextToolbar={contextToolbar} sideBar={topologySideBar}>
      <VisualizationProvider controller={controller}>
        <VisualizationSurface state={{ selectedIds, viewOptions }} />
      </VisualizationProvider>
    </TopologyView></>
  );
};

function addAddress(address: string, newBrokerNodes: NodeModel[], brokerInfo: BrokerInfo, newBrokerEdges: EdgeModel[], controller: Visualization, model: Model, showConnectors: boolean, selectNode: Function) {
  const addressNode: NodeModel = {
    id: 'address-node-' + address,
    type: 'resource',
    label: address,
    width: ADDRESS_NODE_DIAMETER,
    height: ADDRESS_NODE_DIAMETER,
    shape: NodeShape.ellipse,
    status: NodeStatus.info,
    data: {
      badge: 'Address',
      className: 'artemisAddress',
      labelClassName: 'artemisAddressLabel',
      address: address,
      selectNode: selectNode
    }
  };
  newBrokerNodes.push(addressNode);
  if (showConnectors) {
    const addressEdge: EdgeModel = {
      id: 'address-edge-' + brokerInfo.nodeID + '-address-node-' + address,
      type: 'edge',
      source: brokerInfo.nodeID,
      target: 'address-node-' + address,
      edgeStyle: EdgeStyle.default
    };
    newBrokerEdges.push(addressEdge);
  }
}

function addInternalAddress(address: string, newBrokerNodes: NodeModel[], brokerInfo: BrokerInfo, newBrokerEdges: EdgeModel[], controller: Visualization, model: Model, showConnectors: boolean, selectNode: Function) {
  const addressNode: NodeModel = {
    id: 'address-node-' + address,
    type: 'resource',
    label: address,
    width: ADDRESS_NODE_DIAMETER,
    height: ADDRESS_NODE_DIAMETER,
    shape: NodeShape.ellipse,
    status: NodeStatus.info,
    data: {
      badge: 'Internal Address',
      className: 'artemisInternalAddress',
      labelClassName: 'artemisInternalAddressLabel',
      address: address,
      selectNode: selectNode
    }
  };
  newBrokerNodes.push(addressNode);
  if (showConnectors) {
    const addressEdge: EdgeModel = {
      id: 'address-edge-' + brokerInfo.nodeID + '-address-node-' + address,
      type: 'edge',
      source: brokerInfo.nodeID,
      target: 'address-node-' + address,
      edgeStyle: EdgeStyle.default
    };
    newBrokerEdges.push(addressEdge);
  }
}

function addQueue(address: string, queue: string, routingType: string,  newBrokerNodes: NodeModel[], brokerInfo: BrokerInfo, newBrokerEdges: EdgeModel[], controller: Visualization, model: Model, showAddresses: boolean, showConnectors: boolean, selectNode: Function) {
  const queueNode: NodeModel = {
    id: 'queue-node-' + queue,
    type: 'resource',
    label: queue,
    width: QUEUE_NODE_DIAMETER,
    height: QUEUE_NODE_DIAMETER,
    shape: NodeShape.ellipse,
    status: NodeStatus.info,
    data: {
      badge: 'Queue',
      className: 'artemisQueue',
      labelClassName: 'artemisQueueLabel',
      address: address,
      queue: queue,
      routingType: routingType,
      selectNode: selectNode
    }
  };
  newBrokerNodes.push(queueNode);
  if (showAddresses && showConnectors) {
    const queueEdge: EdgeModel = {
      id: 'queue-edge-address-node' + address + '-queue-node-' + queue,
      type: 'edge',
      source: 'address-node-' + address,
      target: 'queue-node-' + queue,
      edgeStyle: EdgeStyle.default
    };
    newBrokerEdges.push(queueEdge);
  }
}

function addInternalQueue(address: string, queue: string, routingType: string, newBrokerNodes: NodeModel[], brokerInfo: BrokerInfo, newBrokerEdges: EdgeModel[], controller: Visualization, model: Model, showInternalAddresses: boolean, showConnectors: boolean, selectNode: Function) {
  const queueNode: NodeModel = {
    id: 'queue-node-' + queue,
    type: 'resource',
    label: queue,
    width: QUEUE_NODE_DIAMETER,
    height: QUEUE_NODE_DIAMETER,
    shape: NodeShape.ellipse,
    status: NodeStatus.info,
    data: {
      badge: 'Internal Queue',
      className: 'artemisInternalQueue',
      labelClassName: 'artemisInternalQueueLabel',
      address: address,
      queue: queue,
      routingType: routingType,
      selectNode: selectNode
    }
  };
  newBrokerNodes.push(queueNode);
  if (showInternalAddresses && showConnectors) {
    const queueEdge: EdgeModel = {
      id: 'queue-edge-address-node' + address + '-queue-node-' + queue,
      type: 'edge',
      source: 'address-node-' + address,
      target: 'queue-node-' + queue,
      edgeStyle: EdgeStyle.default
    };
    newBrokerEdges.push(queueEdge);
  }
}

