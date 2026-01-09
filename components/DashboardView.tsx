import React from 'react';
import { Backpack, OperationalStatus } from '../types';
import { Wifi, WifiOff, Battery, AlertTriangle, PackagePlus, Truck, ShieldCheck, ChevronRight } from 'lucide-react';

interface DashboardViewProps {
  backpacks: Backpack[];
  isMobile: boolean;
  onSelectBackpack: (id: string) => void;
}

const getStatusInfo = (status: OperationalStatus) => {
  switch (status) {
    case 'NEEDS_ATTENTION':
      return { text: 'Actie Vereist', color: 'bg-Warning-50 text-Warning-600 border-Warning-100', Icon: AlertTriangle };
    case 'IN_PREPARATION':
      return { text: 'In Voorbereiding', color: 'bg-primary-50 text-primary-700 border-primary-100', Icon: PackagePlus };
    case 'IN_USE':
      return { text: 'In Gebruik', color: 'bg-Danger-50 text-Danger-600 border-Danger-100', Icon: Truck };
    case 'OPERATIONAL':
    default:
      return { text: 'Operationeel', color: 'bg-Success-50 text-Success-600 border-Success-100', Icon: ShieldCheck };
  }
};

const formatTimeAgo = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s geleden`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m geleden`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}u geleden`;
    
    return date.toLocaleDateString('nl-BE');
};


const DesktopTable: React.FC<{ backpacks: Backpack[], onSelectBackpack: (id: string) => void }> = ({ backpacks, onSelectBackpack }) => {
  const sortedBackpacks = [...backpacks].sort((a, b) => {
    const statusOrder: Record<OperationalStatus, number> = { 'IN_USE': 1, 'NEEDS_ATTENTION': 2, 'IN_PREPARATION': 3, 'OPERATIONAL': 4 };
    return statusOrder[a.operationalStatus] - statusOrder[b.operationalStatus];
  });
    
  return (
    <div className="bg-white rounded-xl shadow-main border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                    <th className="px-4 py-3 font-semibold text-left">Naam</th>
                    <th className="px-4 py-3 font-semibold text-left">Ziekenhuis</th>
                    <th className="px-4 py-3 font-semibold text-left">Status</th>
                    <th className="px-4 py-3 font-semibold text-center">Batterij</th>
                    <th className="px-4 py-3 font-semibold text-left">Laatste Sync</th>
                    <th className="px-4 py-3"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
            {sortedBackpacks.map(bp => {
                const status = getStatusInfo(bp.operationalStatus);
                const lastSyncDate = new Date(bp.lastSync);
                const isOffline = (Date.now() - lastSyncDate.getTime()) > 300000;
                const isActionable = bp.operationalStatus === 'NEEDS_ATTENTION';

                return (
                    <tr 
                        key={bp.id} 
                        onClick={() => isActionable && onSelectBackpack(bp.id)}
                        className={`group ${isActionable ? 'cursor-pointer hover:bg-primary-50' : 'opacity-70'}`}
                    >
                        <td className="px-4 py-3">
                            <div className="font-bold text-slate-800">{bp.name}</div>
                            <div className="text-xs text-slate-400 font-mono">{bp.id}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{bp.hospital}</td>
                        <td className="px-4 py-3">
                            <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full border ${status.color}`}>
                                <status.Icon className="w-3.5 h-3.5" /> {status.text}
                            </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                            <div className={`font-semibold ${bp.batteryLevel < 20 ? 'text-Danger-600' : 'text-slate-700'}`}>
                                {bp.batteryLevel}%
                            </div>
                        </td>
                        <td className="px-4 py-3">
                             <div className={`flex items-center gap-1.5 ${isOffline ? 'text-Warning-600' : 'text-Success-600'}`}>
                                {isOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />} 
                                <span className="font-medium text-xs">{formatTimeAgo(bp.lastSync)}</span>
                            </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                           {isActionable && <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-700 transition-colors" />}
                        </td>
                    </tr>
                );
            })}
            </tbody>
        </table>
    </div>
  );
};


const MobileCards: React.FC<{ backpacks: Backpack[], onSelectBackpack: (id: string) => void }> = ({ backpacks, onSelectBackpack }) => (
    <div className="space-y-3 pb-20">
        {backpacks.map(bp => {
            const status = getStatusInfo(bp.operationalStatus);
            return (
                <button
                    key={bp.id}
                    onClick={() => onSelectBackpack(bp.id)}
                    className="w-full text-left bg-white p-4 rounded-xl shadow-main border border-slate-200 flex items-center justify-between transition-all active:scale-[0.98] hover:border-primary-400"
                >
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 truncate">{bp.name}</h3>
                        <p className="text-sm text-slate-500 truncate">{bp.hospital}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <div className={`px-2 py-1 text-xs font-bold rounded-full ${status.color}`}>
                            {status.text}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                </button>
            );
        })}
    </div>
);

const DashboardView: React.FC<DashboardViewProps> = ({ backpacks, isMobile, onSelectBackpack }) => {
  return isMobile 
    ? <MobileCards backpacks={backpacks} onSelectBackpack={onSelectBackpack} />
    : <DesktopTable backpacks={backpacks} onSelectBackpack={onSelectBackpack} />;
};

export default DashboardView;