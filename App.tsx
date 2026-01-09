import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Package, QrCode, AlertTriangle, PackagePlus, Truck, ShieldCheck, Settings } from 'lucide-react';
import { Backpack, Module, AppNotification, UrgentAlert, ContentDefinition, OperationalStatus, MasterLayout, ModuleStatus } from './types';
import { calculateOperationalStatus, validateReplacement, parseRFID } from './services/inventoryService';
import { db } from './services/database';
import { supabase, isConfigured } from './services/supabaseClient';
import { MOCK_BACKPACKS } from './constants';
import PickList from './components/PickList';
import ScannerModal, { ScanMode, ReplacementStep } from './components/ScannerModal';
import AdminPanel from './components/AdminPanel';
import AlertOverlay from './components/AlertOverlay';
import BackpackDesigner from './components/BackpackDesigner';
import SideNav from './components/SideNav';
import BottomNav from './components/BottomNav';
import TopHeader from './components/TopHeader';
import DashboardView from './components/DashboardView';


type ViewState = 'HOME' | 'DASHBOARD' | 'DASHBOARD_MOBILE' | 'DETAIL' | 'ADMIN';

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [currentView, setCurrentView] = useState<ViewState>(isMobile ? 'HOME' : 'DASHBOARD');
  const [backpacks, setBackpacks] = useState<Backpack[]>([]);
  const [catalog, setCatalog] = useState<ContentDefinition[]>([]);
  const [selectedBackpackId, setSelectedBackpackId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [masterLayout, setMasterLayout] = useState<MasterLayout | null>(null);
  
  const [showQrPrompt, setShowQrPrompt] = useState<boolean>(false);
  const [replacementMode, setReplacementMode] = useState<{ targetX: number, targetY: number } | null>(null);
  const [replacementStep, setReplacementStep] = useState<ReplacementStep | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('QR_BACKPACK');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeAlert, setActiveAlert] = useState<UrgentAlert | null>(null);
  
  const backpacksRef = useRef<Backpack[]>([]);
  useEffect(() => { backpacksRef.current = backpacks; }, [backpacks]);

  useEffect(() => {
    initApp();
    const handleResize = () => {
        const mobile = window.innerWidth < 768;
        if (mobile !== isMobile) {
            setIsMobile(mobile);
            setCurrentView(mobile ? 'HOME' : 'DASHBOARD');
            setSelectedBackpackId(null);
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

  useEffect(() => {
    if (replacementMode) {
      setScanMode('RFID_MODULE');
      setScannerOpen(true);
    }
  }, [replacementMode]);

  const initApp = async () => {
    setConnectionError(null);
    if (!isConfigured) {
        setConnectionError("Niet geconfigureerd. Laden van demo data.");
        setBackpacks(MOCK_BACKPACKS);
        setMasterLayout({ grid_cols: 4, grid_rows: 4, modules: MOCK_BACKPACKS[0].modules.map(m => ({...m, status: 'OK'})) });
        return;
    }
    try {
        const test = await db.testConnection();
        if (!test.success) {
            setConnectionError(test.message || "Onbekende fout. Laden van demo data.");
            setBackpacks(MOCK_BACKPACKS); return;
        }
        await fetchData();
        const channel = supabase.channel('realtime-monitoring').on('postgres_changes',{ event: '*', schema: 'public' },fetchData).subscribe();
        return () => { supabase.removeChannel(channel); };
    } catch (e: any) {
        // FIX: Verbeterde error logging om "[object Object]" te voorkomen en specifiekere feedback te geven.
        let detailedMessage = 'Onbekende fout bij initialisatie. Laden van demo data.';
        
        if (e instanceof Error) {
            detailedMessage = e.message;
        } else if (typeof e === 'object' && e !== null && e.message) {
            detailedMessage = String(e.message);
        } else if (typeof e === 'string') {
            detailedMessage = e;
        }
        
        // Maak de boodschap gebruiksvriendelijker voor veelvoorkomende problemen
        if (detailedMessage.toLowerCase().includes('failed to fetch')) {
            detailedMessage = 'Netwerkfout: Kon de server niet bereiken. Controleer uw internetverbinding. Demo data wordt geladen.';
        } else if (detailedMessage.toLowerCase().includes("could not find the column") && detailedMessage.toLowerCase().includes("'catalog'")) {
            detailedMessage = "Database schema is verouderd. De 'catalog' tabel mist een kolom. Voer het nieuwste SQL script uit vanuit de 'Database Setup' tab in de Beheerconsole.";
        }
        
        console.error('Fout bij initialisatie:', detailedMessage, { originalError: e });
        setConnectionError(`Fout: ${detailedMessage}`);
        setBackpacks(MOCK_BACKPACKS);
        setMasterLayout({ grid_cols: 4, grid_rows: 4, modules: MOCK_BACKPACKS[0].modules.map(m => ({...m, status: 'OK'})) });
    }
  };

  const fetchData = async () => {
    const layout = await db.getMasterLayout();
    setMasterLayout(layout);
    const catalogData = await db.getCatalog();
    setCatalog(catalogData);

    const backpackData = await db.getBackpacks();
    const correctedBackpacks = backpackData.map(bp => {
        const correctStatus = calculateOperationalStatus(bp, layout);
        if (bp.operationalStatus !== correctStatus && bp.operationalStatus !== 'IN_PREPARATION') {
            db.updateBackpackStatus(bp.id, correctStatus);
            return { ...bp, operationalStatus: correctStatus };
        }
        return bp;
    });
    setBackpacks(correctedBackpacks);
  };

  const selectedBackpack = useMemo(() => backpacks.find(b => b.id === selectedBackpackId), [backpacks, selectedBackpackId]);
  
  const displayedModulesForDetail = useMemo((): Module[] => {
    if (!selectedBackpack || !masterLayout || !catalog.length) {
        return selectedBackpack?.modules || [];
    }

    if (selectedBackpack.operationalStatus !== 'NEEDS_ATTENTION' && selectedBackpack.operationalStatus !== 'IN_PREPARATION') {
        return selectedBackpack.modules;
    }
    
    const colorTypeMap: { [key: string]: string } = { 'red': '01', 'blue': '02', 'yellow': '03', 'green': '04', 'grey': '00' };

    return masterLayout.modules.map(templateMod => {
        const actualMod = selectedBackpack.modules.find(m => m.pos_x === templateMod.pos_x && m.pos_y === templateMod.pos_y);
        if (actualMod) {
            return actualMod;
        }

        const catalogEntry = catalog.find(c => c.name === templateMod.name);
        const colorType = colorTypeMap[templateMod.color || 'grey'] || '00';
        const contentCode = catalogEntry ? catalogEntry.code.padStart(4, '0') : '0000';
        
        return {
            ...templateMod,
            id: `${colorType}XX${contentCode}`,
            status: 'MISSING',
            backpack_id: selectedBackpack.id,
        };
    });
  }, [selectedBackpack, masterLayout, catalog]);

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => [{ ...notif, id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toISOString(), read: false }, ...prev]);
  };

  const navigateTo = (view: ViewState) => {
    if (view !== 'DETAIL') { setSelectedBackpackId(null); setShowQrPrompt(false); }
    setCurrentView(view);
  };
  
  const handleGoBack = async () => {
    if (currentView === 'DETAIL' && selectedBackpack && selectedBackpack.operationalStatus === 'IN_PREPARATION') {
      const currentStatus = calculateOperationalStatus(selectedBackpack, masterLayout);
      if (selectedBackpack.operationalStatus !== currentStatus) {
        await db.updateBackpackStatus(selectedBackpack.id, currentStatus);
      }
    }
    navigateTo(isMobile ? 'DASHBOARD_MOBILE' : 'DASHBOARD');
  };
  
  const handleSelectBackpack = (id: string) => {
    const backpack = backpacks.find(b => b.id === id);
    if (!backpack) return;
    if (!isMobile && backpack.operationalStatus !== 'NEEDS_ATTENTION') return;
    
    setSelectedBackpackId(id);
    if (isMobile) {
      setCurrentView('DETAIL');
    }
  };

  const handleScanClick = () => { setScanMode('QR_BACKPACK'); setScannerOpen(true); };
  
  const handleStartReplacement = (module: Module) => {
    if (module.status !== 'OK') {
      setReplacementMode({ targetX: module.pos_x, targetY: module.pos_y });
      setReplacementStep(module.status === 'MISSING' ? 'SCAN_NEW' : 'SCAN_OLD');
    }
  };

  const handleSkipScanOld = () => {
    if (replacementStep === 'SCAN_OLD') {
      setReplacementStep('SCAN_NEW');
    }
  };

  const handleScanSuccess = async (scannedId: string): Promise<{success: boolean; message: string} | void> => {
    if (scanMode === 'QR_BACKPACK') {
        const found = backpacks.find(b => b.id.toLowerCase() === scannedId.toLowerCase().trim() || b.qrCode === scannedId || b.name.toLowerCase().includes(scannedId.toLowerCase().trim()));
        if (found) { handleSelectBackpack(found.id); } else { alert("Koffer niet gevonden."); }
        return;
    } 
    
    if (scanMode === 'RFID_MODULE' && selectedBackpack && replacementMode) {
      const targetModule = displayedModulesForDetail.find(m => m.pos_x === replacementMode.targetX && m.pos_y === replacementMode.targetY);
      if (!targetModule) return { success: false, message: 'Doelmodule niet gevonden.' };

      if (replacementStep === 'SCAN_OLD') {
        if (scannedId.trim() === targetModule.id.trim()) {
          setReplacementStep('SCAN_NEW');
          return { success: true, message: 'Oud zakje geverifieerd. Scan nu het nieuwe zakje.' };
        } else {
          return { success: false, message: `Verkeerd zakje gescand. Verwacht: ${targetModule.id}` };
        }
      }

      if (replacementStep === 'SCAN_NEW') {
        const existingModule = await db.getModuleById(scannedId);
        if (!existingModule) {
            return { success: false, message: `Fout: Zakje ${scannedId} is niet geregistreerd.` };
        }

        if (existingModule.backpack_id) {
            return { success: false, message: `Fout: Zakje is al toegewezen aan koffer ${existingModule.backpack_id}.` };
        }
        if (existingModule.status !== 'WAITING_FOR_MATCHMAKING') {
            return { success: false, message: `Fout: Zakje is niet beschikbaar (status: ${existingModule.status}).` };
        }

        const validation = validateReplacement(targetModule.id, scannedId);
        if (!validation.success) {
          return validation;
        }
        
        const newModule: Module = {
            ...existingModule,
            pos_x: targetModule.pos_x,
            pos_y: targetModule.pos_y,
            width: targetModule.width,
            height: targetModule.height,
            status: 'OK',
            lastUpdate: new Date().toISOString(),
            backpack_id: selectedBackpack.id,
        };
        
        const updatedBackpack = {
            ...selectedBackpack,
            modules: [
                ...selectedBackpack.modules.filter(m => m.pos_x !== newModule.pos_x || m.pos_y !== newModule.pos_y),
                newModule
            ]
        };

        const finalStatus = calculateOperationalStatus(updatedBackpack, masterLayout);
        updatedBackpack.operationalStatus = finalStatus;

        setBackpacks(prev => prev.map(b => b.id === updatedBackpack.id ? updatedBackpack : b));
        await db.saveBackpack(updatedBackpack);
        return validation;
      }
    }
  };

  const getHeaderTitle = () => {
    if (isMobile) {
        switch(currentView) {
            case 'DASHBOARD_MOBILE': return 'Koffer Overzicht';
            case 'ADMIN': return 'Beheer';
            case 'DETAIL': return selectedBackpack?.name || 'Details';
            default: return 'Smart-Grid';
        }
    }
    return currentView === 'ADMIN' ? 'Beheerconsole' : 'Dashboard Overzicht';
  };

  const targetModuleForScanner = useMemo(() => {
    if (replacementMode && selectedBackpack) {
        return displayedModulesForDetail.find(m => m.pos_x === replacementMode.targetX && m.pos_y === replacementMode.targetY);
    }
    return undefined;
  }, [replacementMode, selectedBackpack, displayedModulesForDetail]);

  if (isMobile && currentView === 'HOME') {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-main border border-slate-200 w-full max-w-sm">
                <div className="mx-auto w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-5 border-4 border-primary-50">
                    <ShieldCheck className="w-8 h-8 text-primary-700" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800">Smart-Grid Koffer</h1>
                <p className="text-slate-500 mt-2 text-sm">Start met het scannen van een koffer om de status te bekijken of onderhoud te plegen.</p>
            </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 z-10">
            <div className="relative h-20 w-full max-w-sm mx-auto">
                <button
                    onClick={handleScanClick}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 w-20 h-20 bg-primary-700 rounded-full text-white flex items-center justify-center shadow-lg shadow-primary-200 hover:bg-primary-800 transition-all transform active:scale-90 z-20"
                    aria-label="Scan QR Code"
                >
                    <QrCode className="w-10 h-10" />
                </button>
                <button
                    onClick={() => navigateTo('ADMIN')}
                    className="absolute bottom-6 left-1/2 translate-x-12 w-12 h-12 bg-slate-600 rounded-full text-white flex items-center justify-center shadow-md hover:bg-slate-700 transition-all transform active:scale-90 z-10"
                    aria-label="Instellingen"
                >
                    <Settings className="w-6 h-6" />
                </button>
            </div>
             <div className="text-center mt-2">
                <button 
                    onClick={() => navigateTo('DASHBOARD_MOBILE')} 
                    className="w-full text-sm font-semibold text-slate-600 hover:text-primary-700"
                >
                    Of bekijk het koffer overzicht
                </button>
            </div>
        </div>
        
        {connectionError && <p className="fixed bottom-4 left-4 text-xs text-Warning bg-Warning-50 p-2 rounded-md">{connectionError}</p>}
        <ScannerModal isOpen={scannerOpen} mode={scanMode} step={replacementStep} targetModuleId={undefined} targetModuleName={undefined} onClose={() => setScannerOpen(false)} onSuccess={handleScanSuccess} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
        <ScannerModal
            isOpen={scannerOpen}
            mode={scanMode}
            step={replacementStep}
            targetModuleId={targetModuleForScanner?.id}
            targetModuleName={targetModuleForScanner?.name}
            onClose={() => { setScannerOpen(false); setReplacementMode(null); setReplacementStep(null); }}
            onSuccess={handleScanSuccess}
            onSkip={handleSkipScanOld}
            isConfiguring={selectedBackpack?.operationalStatus === 'IN_PREPARATION'}
        />
        <AlertOverlay alert={activeAlert} onNavigate={(id) => { setActiveAlert(null); handleSelectBackpack(id); }} onDismiss={() => setActiveAlert(null)} />
      
        {!isMobile && <SideNav currentView={currentView} onNavigate={(v) => navigateTo(v)} />}

        <div className="flex-1 flex flex-col overflow-hidden">
            <TopHeader 
                title={getHeaderTitle()}
                showBackButton={isMobile && currentView === 'DETAIL'}
                onBack={handleGoBack}
                notifications={notifications}
                onMarkAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
                onClearAll={() => setNotifications([])}
            />
            
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                {connectionError && (
                    <div className="bg-Warning-50 text-Warning-600 p-4 rounded-xl border border-Warning-100 mb-6">
                        <p className="font-bold text-sm">{connectionError}</p>
                    </div>
                )}
                {currentView === 'DASHBOARD' && <DashboardView backpacks={backpacks} isMobile={false} onSelectBackpack={handleSelectBackpack} />}
                {currentView === 'DASHBOARD_MOBILE' && <DashboardView backpacks={backpacks} isMobile={true} onSelectBackpack={handleSelectBackpack} />}
                {currentView === 'ADMIN' && <AdminPanel onBackpackAdded={fetchData} catalog={catalog} />}
                {currentView === 'DETAIL' && selectedBackpack && <DetailView backpack={selectedBackpack} displayedModules={displayedModulesForDetail} onStartReplacement={handleStartReplacement} replacementMode={replacementMode} />}
            </main>

            {isMobile && <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} onScanClick={handleScanClick} />}
        </div>
    </div>
  );
}

const DetailView: React.FC<{ backpack: Backpack, displayedModules: Module[], replacementMode: any, onStartReplacement: (module: Module) => void }> = ({ backpack, displayedModules, replacementMode, onStartReplacement }) => {
    const needsAction = backpack.operationalStatus === 'NEEDS_ATTENTION';
    const isPreparing = backpack.operationalStatus === 'IN_PREPARATION';

    const handleStartConfiguration = async () => { await db.updateBackpackStatus(backpack.id, 'IN_PREPARATION'); };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn pb-20">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-main border border-slate-200 p-4 sm:p-6 h-[60vh] lg:h-auto">
                <BackpackDesigner
                   mode="VIEW" modules={displayedModules} gridCols={backpack.grid_cols} gridRows={backpack.grid_rows}
                   onModuleClick={onStartReplacement} replacementTarget={replacementMode}
                />
            </div>
            <div className="lg:h-full">
                {needsAction && !isPreparing && (
                    <div className="bg-white p-6 rounded-xl shadow-main border border-slate-200 text-center space-y-4">
                        <div>
                            <h3 className="font-bold text-Warning-600">Actie Vereist</h3>
                            <p className="text-sm text-slate-500 mt-1">Deze koffer moet worden gecontroleerd.</p>
                        </div>
                        <button 
                            onClick={handleStartConfiguration} 
                            className="w-full bg-primary-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-800 transition-colors shadow-lg shadow-primary-100"
                        >
                            <PackagePlus className="w-5 h-5" />
                            Vul de Koffer
                        </button>
                    </div>
                )}
                {(isPreparing || (needsAction && isPreparing)) ? (
                     <PickList modules={displayedModules} onStartReplacement={onStartReplacement} isConfiguring={isPreparing} />
                ) : !isPreparing && backpack.operationalStatus === 'OPERATIONAL' ? (
                  <div className="bg-white p-4 rounded-xl shadow-main border border-slate-200">
                    <div className="bg-Success-50 text-Success-600 p-4 rounded-xl border border-Success-100 text-center">
                      <h3 className="font-bold text-sm">Alles in Orde</h3>
                      <p className="text-xs mt-1">Deze koffer is volledig operationeel.</p>
                    </div>
                  </div>
                ) : null}
            </div>
        </div>
    );
}

export default App;
