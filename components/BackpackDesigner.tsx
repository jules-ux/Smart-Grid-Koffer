import React, { useState, useEffect, useMemo } from 'react';
import { Module } from '../types';
import { X, Zap, Lock, Move, AlertTriangle, ChevronDown, Check } from 'lucide-react';

interface BackpackDesignerProps {
  mode: 'DESIGN' | 'VIEW';
  modules: Module[];
  gridCols: number;
  gridRows: number;
  onLayoutChange?: (modules: Module[]) => void;
  onGridResize?: (cols: number, rows: number) => void;
  onModuleClick?: (module: Module) => void;
  replacementTarget?: { targetX: number, targetY: number } | null;
  assignableModules?: { name: string; color: string; }[];
}

type Shape = { w: number; h: number; label: string };
const SHAPES: Shape[] = [
  { w: 1, h: 1, label: 'Klein (1x1)' }, { w: 2, h: 1, label: 'Breed (2x1)' },
  { w: 1, h: 2, label: 'Hoog (1x2)' }, { w: 2, h: 2, label: 'Groot (2x2)' },
];

const ModuleAssignmentModal: React.FC<{
    module: Module;
    assignableModules: { name: string; color: string; }[];
    onAssign: (name: string, color: string) => void;
    onClose: () => void;
    currentLayoutModules: Module[];
}> = ({ module, assignableModules, onAssign, onClose, currentLayoutModules }) => {
    
    const availableModules = useMemo(() => {
        const usedKeys = new Set(
            currentLayoutModules.map(m => m.name && m.color ? `${m.name}|${m.color}` : null)
        );
        return assignableModules.filter(am => 
            !usedKeys.has(`${am.name}|${am.color}`) || (am.name === module.name && am.color === module.color)
        );
    }, [assignableModules, currentLayoutModules, module]);

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Wijs Inhoud Toe</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-slate-600 mb-2">Selecteer een gedefinieerd zakje:</p>
                    <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                        {availableModules.map((item, index) => (
                            <button key={`${item.name}-${index}`} onClick={() => onAssign(item.name, item.color)} className="w-full text-left p-3 hover:bg-primary-50 transition-colors flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full border border-black/10 shadow-sm shrink-0" style={{ backgroundColor: item.color === 'red' ? '#ef4444' : item.color === 'blue' ? '#3b82f6' : item.color === 'yellow' ? '#eab308' : '#22c55e' }}></div>
                                <span className="font-medium text-slate-700">{item.name}</span>
                            </button>
                        ))}
                         {availableModules.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-400">
                                {assignableModules.length > 0 ? "Alle gedefinieerde zakjes zijn al in gebruik in deze layout." : "Geen zakjes gevonden. Maak eerst zakjes aan in 'Zakjes Beheer'."}
                            </div>
                         )}
                    </div>
                </div>
            </div>
        </div>
    )
}

const BackpackDesigner: React.FC<BackpackDesignerProps> = ({
  mode, modules, gridCols, gridRows,
  onLayoutChange, onGridResize, onModuleClick, replacementTarget, assignableModules = []
}) => {
  const [localModules, setLocalModules] = useState<Module[]>(modules);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [editingModule, setEditingModule] = useState<Module | null>(null);

  useEffect(() => {
    setLocalModules(modules);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [modules]);

  const { CELL_SIZE, GAP_SIZE } = useMemo(() => isMobile ? { CELL_SIZE: 50, GAP_SIZE: 4 } : { CELL_SIZE: 80, GAP_SIZE: 8 }, [isMobile]);

  const handleDragStart = (e: React.DragEvent, shape: Shape) => {
    if (mode !== 'DESIGN') return;
    e.dataTransfer.setData('application/json', JSON.stringify(shape));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleGridDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (mode !== 'DESIGN' || !onLayoutChange) return;
    try {
      const shapeData = JSON.parse(e.dataTransfer.getData('application/json')) as Shape;
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const padding = isMobile ? 8 : 16;
      const x = e.clientX - rect.left - padding;
      const y = e.clientY - rect.top - padding;
      const targetCol = Math.floor(x / (CELL_SIZE + GAP_SIZE));
      const targetRow = Math.floor(y / (CELL_SIZE + GAP_SIZE));
      
      if (targetCol < 0 || targetRow < 0 || targetCol + shapeData.w > gridCols || targetRow + shapeData.h > gridRows) return;
      
      const collides = localModules.some(m => targetCol < m.pos_x + m.width && targetCol + shapeData.w > m.pos_x && targetRow < m.pos_y + m.height && targetRow + shapeData.h > m.pos_y);
      if (collides) return;

      const newModule: Module = { id: `NEW-${Date.now()}`, name: shapeData.label, status: 'MISSING', lastUpdate: new Date().toISOString(), pos_x: targetCol, pos_y: targetRow, width: shapeData.w, height: shapeData.h, color: 'grey' };
      const updated = [...localModules, newModule];
      setLocalModules(updated);
      onLayoutChange(updated);
    } catch (err) { console.error("Drop failed", err); }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };

  const handleRemoveModule = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (mode !== 'DESIGN' || !onLayoutChange) return;
    const updated = localModules.filter(m => m.id !== id);
    setLocalModules(updated);
    onLayoutChange(updated);
  };
  
  const handleModuleClick = (mod: Module) => {
    if (mode === 'VIEW' && onModuleClick) {
        onModuleClick(mod);
    } else if (mode === 'DESIGN') {
        setEditingModule(mod);
    }
  };

  const handleAssignContent = (name: string, color: string) => {
    if (!editingModule || !onLayoutChange) return;
    const updated = localModules.map(m => m.id === editingModule.id ? { ...m, name: name, color: color } : m);
    setLocalModules(updated);
    onLayoutChange(updated);
    setEditingModule(null);
  };

  const getStatusBgColor = (mod: Module) => {
    if (replacementTarget) return 'bg-slate-100 text-slate-400 opacity-20';
    switch (mod.status) {
      case 'OK': return 'bg-Success-50 shadow-[0_0_15px_rgba(34,197,94,0.3)]';
      case 'OPENED': return 'bg-Danger-50';
      case 'WRONG_POS': return 'bg-Warning-50';
      case 'MISSING': return 'bg-slate-100 opacity-70';
      default: return 'bg-slate-100';
    }
  };

  const colorToBorderClass = (color?: string) => {
    switch (color) {
      case 'red': return 'border-red-500';
      case 'blue': return 'border-blue-500';
      case 'yellow': return 'border-yellow-500';
      case 'green': return 'border-green-500';
      default: return 'border-slate-300';
    }
  };

  const getStatusIcon = (mod: Module) => {
     switch (mod.status) {
       case 'OK': return <Lock className="w-5 h-5 text-Success-600" />;
       case 'OPENED': return <Zap className="w-5 h-5 text-Danger-600" />;
       case 'WRONG_POS': return <AlertTriangle className="w-5 h-5 text-Warning-600" />;
       default: return <X className="w-5 h-5 text-slate-500" />;
     }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full w-full">
      {editingModule && mode === 'DESIGN' && (
         <ModuleAssignmentModal 
            module={editingModule}
            assignableModules={assignableModules}
            currentLayoutModules={localModules}
            onAssign={handleAssignContent}
            onClose={() => setEditingModule(null)}
         />
      )}
      {mode === 'DESIGN' && (
        <div className="w-full lg:w-64 bg-white p-4 rounded-xl border border-slate-200 shrink-0">
          <h3 className="font-bold text-slate-800 mb-4">Grid Instellingen</h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-600">Kolommen</label>
              <input type="number" min={2} max={10} value={gridCols} onChange={(e) => onGridResize && onGridResize(parseInt(e.target.value) || 4, gridRows)} className="w-full border border-slate-300 rounded p-2 text-sm bg-white text-slate-900"/>
            </div>
            <div>
               <label className="text-[10px] uppercase font-bold text-slate-600">Rijen</label>
               <input type="number" min={2} max={10} value={gridRows} onChange={(e) => onGridResize && onGridResize(gridCols, parseInt(e.target.value) || 4)} className="w-full border border-slate-300 rounded p-2 text-sm bg-white text-slate-900"/>
            </div>
          </div>
          <h3 className="font-bold text-slate-800 mb-2">Zakjes Palette</h3>
          <div className="space-y-3">
            {SHAPES.map(shape => (
              <div key={shape.label} draggable onDragStart={(e) => handleDragStart(e, shape)} className="bg-slate-50 border border-slate-300 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary-500 transition-all flex items-center gap-3">
                <div className="bg-primary-200 border border-primary-400 rounded-sm" style={{ width: shape.w * 20, height: shape.h * 20 }}></div>
                <span className="text-sm font-medium text-slate-700">{shape.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto bg-slate-50/50 rounded-xl border border-slate-200 p-2 sm:p-4 flex items-center justify-center min-h-[400px] sm:min-h-[500px]">
         <div 
           onDrop={handleGridDrop} onDragOver={handleDragOver}
           className="relative bg-white shadow-inner rounded-lg border-2 sm:border-4 border-slate-800"
           style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, ${CELL_SIZE}px)`, gridTemplateRows: `repeat(${gridRows}, ${CELL_SIZE}px)`, gap: `${GAP_SIZE}px`, padding: isMobile ? '8px' : '16px' }}
         >
            {Array.from({ length: gridCols * gridRows }).map((_, i) => (<div key={`cell-${i}`} className="border border-dashed border-slate-200 rounded" />))}

            {replacementTarget && (
                <div 
                    className="absolute bg-primary-500/20 border-4 border-dashed border-primary-500 rounded-lg pointer-events-none animate-pulse"
                    style={{
                        width: localModules.find(m => m.pos_x === replacementTarget.targetX && m.pos_y === replacementTarget.targetY)?.width * CELL_SIZE + (localModules.find(m => m.pos_x === replacementTarget.targetX && m.pos_y === replacementTarget.targetY)?.width - 1) * GAP_SIZE,
                        height: localModules.find(m => m.pos_x === replacementTarget.targetX && m.pos_y === replacementTarget.targetY)?.height * CELL_SIZE + (localModules.find(m => m.pos_x === replacementTarget.targetX && m.pos_y === replacementTarget.targetY)?.height - 1) * GAP_SIZE,
                        top: replacementTarget.targetY * (CELL_SIZE + GAP_SIZE) + (isMobile ? 8 : 16),
                        left: replacementTarget.targetX * (CELL_SIZE + GAP_SIZE) + (isMobile ? 8 : 16),
                        zIndex: 10
                    }}
                />
            )}

            {localModules.map(mod => {
              const isTarget = replacementTarget && mod.pos_x === replacementTarget.targetX && mod.pos_y === replacementTarget.targetY;
              const isDesignPlaceholder = mode === 'DESIGN' && mod.name.includes('(');
              return (
                <button
                  key={mod.id}
                  onClick={() => handleModuleClick(mod)}
                  disabled={mode === 'VIEW' && mod.status==='OK'}
                  className={`absolute rounded-lg border-4 flex flex-col justify-between p-1 sm:p-2 transition-all group ${isTarget ? 'opacity-100 z-20 shadow-2xl scale-105' : ''} ${getStatusBgColor(mod)} ${colorToBorderClass(mod.color)} ${mode === 'DESIGN' ? 'cursor-pointer hover:shadow-lg' : 'cursor-default'}`}
                  style={{
                    width: mod.width * CELL_SIZE + (mod.width - 1) * GAP_SIZE,
                    height: mod.height * CELL_SIZE + (mod.height - 1) * GAP_SIZE,
                    top: mod.pos_y * (CELL_SIZE + GAP_SIZE) + (isMobile ? 8 : 16),
                    left: mod.pos_x * (CELL_SIZE + GAP_SIZE) + (isMobile ? 8 : 16),
                  }}
                >
                  <div className="flex justify-between w-full items-start">
                    <div className="text-[9px] sm:text-[10px] font-mono text-slate-500">{mod.id.startsWith('MISSING') || mod.id.startsWith('NEW') ? 'LEEG' : mod.id.substring(0,4)}</div>
                    {mode === 'DESIGN' ? (<button onClick={(e) => handleRemoveModule(e, mod.id)} className="text-slate-400 hover:text-rose-600 z-30 p-1 -m-1"><X className="w-3 h-3" /></button>) : (<div className="animate-in fade-in zoom-in">{getStatusIcon(mod)}</div>)}
                  </div>
                  <div className="flex-1 flex items-center justify-center text-center">
                    <span className={`text-[10px] sm:text-xs font-bold text-slate-800 leading-tight line-clamp-2 ${isDesignPlaceholder ? 'italic' : ''}`}>{mod.name}</span>
                  </div>
                   <div className="h-2"></div>
                </button>
              );
            })}
         </div>
      </div>
    </div>
  );
};

export default BackpackDesigner;