import { Graph3D } from './components/Graph3D.js';
import { SidePanel } from './components/SidePanel.js';
import { HUD } from './components/HUD.js';

export function App() {
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <HUD />
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 relative">
          <Graph3D />
        </main>
        <SidePanel />
      </div>
    </div>
  );
}
