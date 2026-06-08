import { useEffect, useRef, useCallback } from 'react';
import ForceGraph3D from '3d-force-graph';
import { useBusStore, agentList, roomList } from '../store/bus.js';
import type { AgentSnapshot, RoomSnapshot } from '@coord-ui/shared';

type NodeType = 'agent' | 'room';

interface GraphNode {
  id: string;
  kind: NodeType;
  label: string;
  data: AgentSnapshot | RoomSnapshot;
}

interface GraphLink {
  source: string;
  target: string;
  kind: 'membership' | 'dm';
}

const STATUS_COLOR: Record<string, string> = {
  active: '#22c55e',
  idle: '#f59e0b',
  stale: '#ef4444',
  unknown: '#6b7280',
};

export function Graph3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);

  const agents = useBusStore(agentList);
  const rooms = useBusStore(roomList);
  const setSelection = useBusStore((s) => s.setSelection);

  const buildGraphData = useCallback(() => {
    const nodes: GraphNode[] = [
      ...agents.map((a) => ({ id: a.id, kind: 'agent' as const, label: a.name, data: a })),
      ...rooms.map((r) => ({ id: r.id, kind: 'room' as const, label: r.name, data: r })),
    ];

    const links: GraphLink[] = [];
    for (const room of rooms) {
      for (const memberId of room.members) {
        links.push({ source: room.id, target: memberId, kind: 'membership' });
      }
    }

    return { nodes, links };
  }, [agents, rooms]);

  // Initialise graph once
  useEffect(() => {
    if (!containerRef.current) return;

    const graph = ForceGraph3D()(containerRef.current)
      .backgroundColor('#0a0a0f')
      .nodeLabel('label')
      .nodeColor((n) => {
        const node = n as GraphNode;
        if (node.kind === 'room') return '#6366f1';
        const agent = node.data as AgentSnapshot;
        return STATUS_COLOR[agent.status] ?? STATUS_COLOR.unknown;
      })
      .nodeOpacity(0.9)
      .linkColor(() => '#334155')
      .linkOpacity(0.5)
      .linkWidth(1)
      .onNodeClick((n) => {
        const node = n as GraphNode;
        setSelection({ kind: node.kind === 'room' ? 'room' : 'agent', id: node.id });
      });

    graphRef.current = graph;

    return () => {
      graph._destructor?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update graph data when store changes
  useEffect(() => {
    graphRef.current?.graphData(buildGraphData());
  }, [buildGraphData]);

  return <div ref={containerRef} className="w-full h-full" />;
}
