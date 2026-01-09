import React from 'react';
import { Module } from '../types';
import { ClipboardList, Replace, ArrowRight, PackagePlus, AlertCircle, Shuffle } from 'lucide-react';
import { formatRFID } from '../services/inventoryService';

interface PickListProps {
  modules: Module[];
  onStartReplacement: (module: Module) => void;
  isConfiguring?: boolean;
}

const PickList: React.FC<PickListProps> = ({ modules, onStartReplacement, isConfiguring }) => {
  const modulesNeedingAction = modules.filter(m => m.status !== 'OK');
  const firstMissingIndex = isConfiguring ? modulesNeedingAction.findIndex(m => m.status === 'MISSING') : -1;

  if (modulesNeedingAction.length === 0) {
    return (
      <div className="bg-Success-50 text-Success-600 p-4 rounded-xl border border-Success-100 text-center">
        <h3 className="font-bold text-sm">Alles in Orde</h3>
        <p className="text-xs mt-1">Deze koffer is volledig operationeel.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-main border border-slate-200 overflow-hidden h-full flex flex-col">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary-700" />
          <h3 className="font-bold text-primary-900">Actielijst</h3>
        </div>
        <span className="bg-primary-100 text-primary-800 text-xs font-bold px-2 py-1 rounded-full">
          {modulesNeedingAction.length} ITEMS
        </span>
      </div>
      
      <div className="divide-y divide-slate-100 flex-1 overflow-y-auto no-scrollbar">
        {modulesNeedingAction.map((mod, index) => {
           let statusText = "Controleer";
           let Icon = AlertCircle;
           let colors = "bg-slate-100 text-slate-600";
           
           switch(mod.status){
              case 'OPENED': statusText = 'Vervang'; Icon = Replace; colors = "bg-Danger-50 text-Danger-600"; break;
              case 'MISSING': statusText = 'Plaats'; Icon = PackagePlus; colors = "bg-primary-50 text-primary-700"; break;
              case 'WRONG_POS': statusText = 'Verplaats'; Icon = Shuffle; colors = "bg-Warning-50 text-Warning-600"; break;
           }

           const isClickable = !isConfiguring || (mod.status === 'MISSING' && index === firstMissingIndex) || mod.status !== 'MISSING';
           const isActiveConfigurationStep = isConfiguring && mod.status === 'MISSING' && index === firstMissingIndex;

           const itemClasses = `w-full text-left p-3 flex items-center gap-3 transition-all group ${
             isClickable 
               ? 'cursor-pointer hover:bg-primary-50' 
               : 'opacity-60 bg-slate-50 cursor-not-allowed'
           } ${isActiveConfigurationStep ? 'bg-primary-100 ring-2 ring-primary-500' : ''}`;

           const colorMap: { [key: string]: string } = {
              red: 'bg-red-500', blue: 'bg-blue-500', yellow: 'bg-yellow-400', green: 'bg-green-500', grey: 'bg-slate-400'
           };
           
           return (
             <button 
                key={mod.id + index}
                onClick={() => isClickable && onStartReplacement(mod)}
                disabled={!isClickable}
                className={itemClasses}
              >
                <div className={`w-1.5 h-10 rounded-full ${colorMap[mod.color || 'grey']}`}></div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{mod.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{`Pos: [${mod.pos_y+1}, ${mod.pos_x+1}]`}</p>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full ${colors}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span>{statusText}</span>
                </div>
                {isActiveConfigurationStep && (
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-5 h-5 bg-primary-500 rounded-full animate-ping opacity-50"></div>
                        <ArrowRight className="w-4 h-4 text-primary-700 relative" />
                    </div>
                )}
             </button>
           );
        })}
      </div>
    </div>
  );
};

export default PickList;