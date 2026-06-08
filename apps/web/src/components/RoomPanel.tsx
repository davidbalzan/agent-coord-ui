import { useState } from 'react';
import { useBusStore, roomMessages } from '../store/bus.js';

interface Props {
  roomId: string;
}

export function RoomPanel({ roomId }: Props) {
  const [draft, setDraft] = useState('');
  const room = useBusStore((s) => s.rooms[roomId]);
  const agents = useBusStore((s) => s.agents);
  const sendMessage = useBusStore((s) => s.sendMessage);
  const msgs = useBusStore((s) => roomMessages(s, roomId));

  if (!room) return <p className="text-slate-400 p-4">Room not found.</p>;

  const send = () => {
    if (!draft.trim()) return;
    sendMessage(roomId, draft.trim(), false);
    setDraft('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700">
        <p className="font-semibold text-slate-100"># {room.name}</p>
        {room.topic && <p className="text-xs text-slate-400 mt-0.5">{room.topic}</p>}
        <p className="text-xs text-slate-500 mt-1">{room.members.length} members</p>
      </div>

      {/* Member list */}
      <div className="px-4 py-2 border-b border-slate-800 flex flex-wrap gap-1">
        {room.members.map((id) => (
          <span key={id} className="text-xs bg-slate-800 text-slate-300 rounded px-2 py-0.5">
            {agents[id]?.name ?? id}
          </span>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {msgs.length === 0 && <p className="text-slate-500 text-sm">No messages yet.</p>}
        {msgs.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="text-slate-400 text-xs">{agents[m.from]?.name ?? m.from}</span>
            <p className="text-slate-200 mt-0.5">{m.body}</p>
          </div>
        ))}
      </div>

      {/* Compose */}
      <div className="px-4 py-3 border-t border-slate-700 flex gap-2">
        <input
          className="flex-1 bg-slate-800 text-slate-100 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder={`Post to #${room.name}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button
          onClick={send}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-1.5 rounded transition-colors"
        >
          Post
        </button>
      </div>
    </div>
  );
}
