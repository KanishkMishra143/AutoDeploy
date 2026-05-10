"use client";
import React, { useMemo, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Handle, 
  Position,
  NodeProps,
  Edge,
  Node,
  Panel,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Globe, Server, Activity, Database } from 'lucide-react';
import { Application, Job } from '../useJobs';

// --- Custom Node Components ---

const GatewayNode = () => (
  <div className="px-6 py-4 shadow-2xl rounded-2xl bg-accent border-2 border-white/20 text-white min-w-[200px]">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-white/20 rounded-lg">
        <Globe className="w-6 h-6" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase opacity-70">Infrastructure</p>
        <p className="text-lg font-bold">Traefik Gateway</p>
      </div>
    </div>
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-white border-2 border-accent" />
  </div>
);

const AppNode = ({ data }: NodeProps<{ app: Application; latestJob?: Job }>) => {
  const { app, latestJob } = data;
  const isOnline = latestJob?.status === 'success';

  return (
    <div className={`px-5 py-4 shadow-xl rounded-2xl bg-card border-2 transition-all min-w-[220px] ${isOnline ? 'border-green-500/50 shadow-green-500/5' : 'border-card-border'}`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-gray-500 border-none" />
      
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isOnline ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
          <Box className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{app.name}</p>
          <p className="text-[9px] text-gray-500 font-mono truncate">{app.repo_url.split('/').pop()}</p>
        </div>
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
      </div>
      
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-accent border-none" />
    </div>
  );
};

const DatabaseNode = ({ data }: NodeProps<{ name: string }>) => (
    <div className="px-4 py-3 shadow-xl rounded-xl bg-[#1a1a1a] border border-card-border text-gray-300 min-w-[150px]">
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-accent border-none" />
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-accent/50" />
        <span className="text-xs font-bold uppercase tracking-wider">{data.name}</span>
      </div>
    </div>
);

const nodeTypes = {
  gateway: GatewayNode,
  app: AppNode,
  database: DatabaseNode
};

// --- Internal Map Content (To use useReactFlow) ---

function TopologyMapContent({ nodes, edges, compact, onAppClick, focusedAppId }: any) {
    const { fitView } = useReactFlow();

    // Force fit view whenever the node structure changes
    useEffect(() => {
        // Small timeout to ensure the container has calculated its dimensions
        const timer = setTimeout(() => {
            fitView({ padding: 0.1, duration: 400 });
        }, 50);
        return () => clearTimeout(timer);
    }, [nodes.length, focusedAppId, fitView]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            colorMode="dark"
            onNodeClick={(_, node) => {
                if (onAppClick && node.type === 'app') {
                    onAppClick(node.data.app as Application);
                }
            }}
            className="bg-[#0a0a0a]"
            minZoom={0.2}
            maxZoom={1.5}
        >
            <Background color="#333" gap={25} variant="dots" />
            <Controls 
                showInteractive={false} 
                position="bottom-left" 
                className="bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl" 
            />
            {!compact && (
                <Panel position="top-right" className="bg-background/80 backdrop-blur px-3 py-1.5 rounded-lg border border-card-border text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Infrastructure Overview
                </Panel>
            )}
        </ReactFlow>
    );
}

// --- Main Map Component ---

interface TopologyMapProps {
  apps: Application[];
  jobs: Job[];
  compact?: boolean;
  onAppClick?: (app: Application) => void;
  focusedAppId?: string;
}

export default function TopologyMap({ apps, jobs, compact = false, onAppClick, focusedAppId }: TopologyMapProps) {
  
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // 1. Add Gateway Node
    nodes.push({
      id: 'gateway',
      type: 'gateway',
      position: { x: 0, y: focusedAppId ? 50 : 100 },
      data: {},
      draggable: !compact,
    });

    const displayApps = focusedAppId ? apps.filter(a => a.id === focusedAppId) : apps;

    displayApps.forEach((app, index) => {
      const latestJob = jobs.find(j => j.app_id === app.id);
      const nodeId = `app-${app.id}`;

      nodes.push({
        id: nodeId,
        type: 'app',
        position: { x: 400, y: focusedAppId ? 50 : index * 140 },
        data: { app, latestJob },
        draggable: !compact,
      });

      edges.push({
        id: `edge-${app.id}`,
        source: 'gateway',
        target: nodeId,
        animated: latestJob?.status === 'running',
        style: { 
            stroke: latestJob?.status === 'success' ? '#22c55e' : '#3b82f6', 
            strokeWidth: 2,
            opacity: latestJob?.status === 'success' ? 0.7 : 0.4
        },
      });

      if (!compact) {
          const dbNodeId = `db-${app.id}`;
          nodes.push({
            id: dbNodeId,
            type: 'database',
            position: { x: 750, y: (focusedAppId ? 50 : index * 140) + 15 },
            data: { name: 'Postgres DB' },
            draggable: true,
          });
          edges.push({
            id: `edge-db-${app.id}`,
            source: nodeId,
            target: dbNodeId,
            style: { stroke: '#444', strokeDasharray: '5,5' },
          });
      }
    });

    return { nodes, edges };
  }, [apps, jobs, compact, focusedAppId]);

  return (
    <div className={`${compact ? 'h-[300px]' : 'h-[500px]'} w-full bg-card/20 rounded-3xl border border-card-border overflow-hidden relative shadow-inner group/flow`}>
      <style jsx global>{`
        .react-flow__attribution { display: none !important; }
        .react-flow__controls { 
          background: #111 !important; 
          border: 1px solid rgba(255,255,255,0.1) !important; 
          border-radius: 12px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5) !important;
        }
        .react-flow__controls-button {
          background: transparent !important;
          border-bottom: 1px solid rgba(255,255,255,0.05) !important;
          fill: #aaa !important;
          transition: all 0.2s !important;
        }
        .react-flow__controls-button:hover {
          background: #222 !important;
          fill: #fff !important;
        }
        .react-flow__controls-button svg {
            fill: currentColor !important;
        }
      `}</style>

      <ReactFlowProvider>
          <TopologyMapContent 
            nodes={nodes} 
            edges={edges} 
            compact={compact} 
            onAppClick={onAppClick} 
            focusedAppId={focusedAppId} 
          />
      </ReactFlowProvider>
    </div>
  );
}
