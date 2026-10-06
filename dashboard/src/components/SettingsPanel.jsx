import { useState } from 'react';
import { Settings, List, Plug, Radio } from 'lucide-react';
import ParcelContentTypesPanel from './ParcelContentTypesPanel';
import IntegrationsPanel from './IntegrationsPanel';
import MetaCapiEventsPanel from './MetaCapiEventsPanel';

const SUB_TABS = [
  { id: 'parcel-types', label: 'Parcel Content Types', icon: List },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'meta', label: 'Meta events', icon: Radio, adminOnly: true },
];

export default function SettingsPanel({ authUser }) {
  const [subTab, setSubTab] = useState('parcel-types');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="section-title mr-2">
          <Settings className="w-5 h-5 text-indigo-500" />
          Settings
        </h2>
        <div className="flex flex-wrap gap-2">
          {SUB_TABS.filter((tab) => !tab.adminOnly || authUser?.isAdmin).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap ${
                subTab === id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white/60 bg-white/40 border border-slate-200/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'parcel-types' && <ParcelContentTypesPanel embedded />}
      {subTab === 'integrations' && <IntegrationsPanel authUser={authUser} />}
      {subTab === 'meta' && authUser?.isAdmin && <MetaCapiEventsPanel />}
    </div>
  );
}
