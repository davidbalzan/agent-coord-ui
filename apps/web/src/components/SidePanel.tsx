import { useBusStore } from '../store/bus.js';
import { DMPanel } from './DMPanel.js';
import { RoomPanel } from './RoomPanel.js';
import { X } from 'lucide-react';

export function SidePanel() {
  const selection = useBusStore((s) => s.selection);
  const setSelection = useBusStore((s) => s.setSelection);

  if (!selection) return null;

  return (
    <aside className="w-80 flex-shrink-0 bg-slate-900 border-l border-slate-700 flex flex-col h-full">
      <div className="flex justify-end px-3 pt-2">
        <button onClick={() => setSelection(null)} className="text-slate-400 hover:text-slate-200 p-1">
          <X size={16} />
        </button>
      </div>
      {selection.kind === 'agent' && <DMPanel agentId={selection.id} />}
      {selection.kind === 'room' && <RoomPanel roomId={selection.id} />}
    </aside>
  );
}
