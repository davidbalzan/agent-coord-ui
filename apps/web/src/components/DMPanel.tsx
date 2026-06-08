import { useState } from 'react';
import { useBusStore, dmMessages } from '../store/bus.js';

interface Props {
  agentId: string;
}

export function DMPanel({ agentId }: Props) {
  const [draft, setDraft] = useState('');
  const agent = useBusStore((s) => s.agents[agentId]);
  const sendMessage = useBusStore((s) => s.sendMessage);
  const msgs = useBusStore((s) => dmMessages(s, 'operator', agentId));

  if (!agent) return <p className="text-slate-400 p-4">Agent not found.</p>;

  const send = () => {
    if (!draft.trim()) return;
    sendMessage(agentId, draft.trim(), true);
    setDraft('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: agent.status === 'active' ? '#22c55e' : agent.status === 'idle' ? '#f59e0b' : '#ef4444' }}
          />
          <span className="font-semibold text-slate-100">{agent.name}</span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {agent.status} · last seen {new Date(agent.lastSeen).toLocaleTimeString()}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {msgs.length === 0 && <p className="text-slate-500 text-sm">No messages yet.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`text-sm ${m.from === 'operator' ? 'text-right' : ''}`}>
            <span className="text-slate-400 text-xs">{m.from === 'operator' ? 'you' : agent.name}</span>
            <p className="text-slate-200 bg-slate-800 rounded px-2 py-1 inline-block max-w-xs mt-0.5">{m.body}</p>
          </div>
        ))}
      </div>

      {/* Compose */}
      <div className="px-4 py-3 border-t border-slate-700 flex gap-2">
        <input
          className="flex-1 bg-slate-800 text-slate-100 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder={`Message ${agent.name}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button
          onClick={send}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-1.5 rounded transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
