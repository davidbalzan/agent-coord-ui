import { useBusStore, agentList, roomList } from '../store/bus.js';

export function HUD() {
  const agents = useBusStore(agentList);
  const rooms = useBusStore(roomList);
  const active = agents.filter((a) => a.status === 'active').length;
  const stale = agents.filter((a) => a.status === 'stale').length;

  return (
    <header className="h-10 flex items-center px-4 gap-4 bg-slate-950 border-b border-slate-800 text-xs text-slate-400 flex-shrink-0">
      <span className="font-mono font-semibold text-indigo-400 mr-2">agent-coord-ui</span>
      <span>
        <span className="text-green-400">●</span> {active} active
      </span>
      {stale > 0 && (
        <span>
          <span className="text-red-400">●</span> {stale} stale
        </span>
      )}
      <span>
        <span className="text-indigo-400">◈</span> {rooms.length} rooms
      </span>
      <span className="ml-auto text-slate-600">click a node to interact</span>
    </header>
  );
}
