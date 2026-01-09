import React from 'react';
import { AlertTriangle, ArrowRight, ShieldAlert, X } from 'lucide-react';
import { UrgentAlert } from '../types';

interface AlertOverlayProps {
  alert: UrgentAlert | null;
  onNavigate: (backpackId: string) => void;
  onDismiss: () => void;
}

const AlertOverlay: React.FC<AlertOverlayProps> = ({ alert, onNavigate, onDismiss }) => {
  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden border-2 border-Danger-500 animate-in zoom-in-95 duration-300">
        
        <div className="bg-Danger p-6 flex justify-between items-start text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl animate-pulse">
               <ShieldAlert className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider">Aandacht Nodig</h2>
              <p className="text-Danger-100 font-medium">Automatische Interventie Detectie</p>
            </div>
          </div>
          <button 
            onClick={onDismiss}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          
          <div className="flex flex-col md:flex-row gap-6">
             <div className="flex-1 bg-slate-50 p-6 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Betreft Koffer</span>
                <div className="text-3xl font-bold text-slate-800 mt-1">{alert.backpackName}</div>
                <div className="text-sm text-slate-500 mt-2 font-mono">ID: {alert.backpackId}</div>
             </div>

             <div className="flex-1 bg-Danger-50 p-6 rounded-xl border border-Danger-100">
                <span className="text-xs font-bold text-Danger-400 uppercase tracking-wide">Status Melding</span>
                <div className="text-2xl font-bold text-Danger-600 mt-1 flex items-center gap-2">
                   {alert.status === 'MISSING' ? 'Inhoud Ontbreekt' : 'Verzegeling Verbroken'}
                </div>
                <div className="text-sm text-Danger-800 mt-2">
                   Module: <span className="font-semibold">{alert.moduleName}</span>
                </div>
             </div>
          </div>

          <div className="bg-slate-800 text-slate-300 p-4 rounded-xl text-center font-mono text-sm">
             Tijdstip detectie: {new Date(alert.timestamp).toLocaleTimeString()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <button 
                onClick={onDismiss}
                className="py-4 px-6 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
             >
                Negeer Melding
             </button>
             <button 
                onClick={() => onNavigate(alert.backpackId)}
                className="py-4 px-6 rounded-xl font-bold text-white bg-Danger hover:bg-Danger-600 transition-colors shadow-lg shadow-Danger-100 flex items-center justify-center gap-2 group"
             >
                Start Herbevoorrading <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
             </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AlertOverlay;