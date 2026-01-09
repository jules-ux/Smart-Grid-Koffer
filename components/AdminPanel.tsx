import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, QrCode, Tag, Package, Printer, Save, Warehouse, ArrowRight, Layers, Database, Copy, Check, ShoppingBag, Clock, Calendar, Smartphone, RefreshCw, Wifi, X, AlertTriangle, Search, Grid, Download } from 'lucide-react';
import { db } from '../services/database';
import { formatRFID } from '../services/inventoryService';
import { Backpack, ContentDefinition, Article, RecipeItem, ModuleContent, Module } from '../types';
import BackpackDesigner from './BackpackDesigner';

interface AdminPanelProps {
  onBackpackAdded: () => void;
  catalog: ContentDefinition[];
}

type AdminTab = 'LAYOUT' | 'BACKPACKS' | 'MODULES' | 'MAGAZIJN' | 'INPAKKEN' | 'SQL';

const SQL_SETUP_SCRIPT = `-- 1. Enable Realtime in your Supabase project
-- Go to Database -> Replication and enable it for the desired tables (backpacks, modules).

-- 2. Run this SQL script in your Supabase SQL Editor

-- CATALOG TABLE (Defines the types of modules/pouches)
CREATE TABLE IF NOT EXISTS catalog (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  default_width INT DEFAULT 1,
  default_height INT DEFAULT 1
);

-- ARTICLES TABLE (Stock items in the pharmacy)
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  manufacturer TEXT,
  unit TEXT,
  instructions TEXT,
  min_stock_warning INT DEFAULT 0
);

-- CATALOG_RECIPES TABLE (Junction table for what articles go into a catalog type)
CREATE TABLE IF NOT EXISTS catalog_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_code TEXT REFERENCES catalog(code) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  UNIQUE(catalog_code, article_id)
);

-- BACKPACKS TABLE
CREATE TABLE IF NOT EXISTS backpacks (
  id TEXT PRIMARY KEY,
  qr_code TEXT UNIQUE,
  name TEXT NOT NULL,
  hospital TEXT,
  type TEXT,
  last_sync TIMESTAMPTZ DEFAULT now(),
  battery_level INT DEFAULT 100,
  operational_status TEXT DEFAULT 'NEEDS_ATTENTION',
  grid_cols INT DEFAULT 4,
  grid_rows INT DEFAULT 6
);

-- MODULES TABLE (The physical RFID-tagged pouches)
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT DEFAULT 'WAITING_FOR_MATCHMAKING',
  last_update TIMESTAMPTZ DEFAULT now(),
  backpack_id TEXT REFERENCES backpacks(id) ON DELETE SET NULL,
  color TEXT,
  calculated_expiry DATE,
  pos_x INT,
  pos_y INT,
  width INT,
  height INT
);

-- MODULE_CONTENTS TABLE (The actual content of a specific module instance)
CREATE TABLE IF NOT EXISTS module_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id TEXT REFERENCES modules(id) ON DELETE CASCADE,
  article_name TEXT,
  batch_number TEXT,
  expiry_date DATE,
  quantity INT
);

-- MASTER_LAYOUTS TABLE (Defines the standard grid layout)
CREATE TABLE IF NOT EXISTS master_layouts (
  id TEXT PRIMARY KEY,
  grid_cols INT NOT NULL,
  grid_rows INT NOT NULL
);

-- MASTER_MODULES TABLE (Defines the modules within a master layout)
CREATE TABLE IF NOT EXISTS master_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_layout_id TEXT REFERENCES master_layouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pos_x INT NOT NULL,
  pos_y INT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  color TEXT
);

-- Insert a default layout if it doesn't exist
INSERT INTO master_layouts (id, grid_cols, grid_rows)
SELECT 'default_mug', 4, 6
WHERE NOT EXISTS (SELECT 1 FROM master_layouts WHERE id = 'default_mug');

-- Create policies for RLS (Row Level Security) if needed, e.g.:
-- ALTER TABLE backpacks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read access" ON backpacks FOR SELECT USING (true);
-- CREATE POLICY "Allow individual insert access" ON backpacks FOR INSERT WITH CHECK (true);
-- (Repeat for other tables as necessary)
`;

const inputClasses = "w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500";
const selectClasses = `${inputClasses} appearance-none`;


const AdminPanel: React.FC<AdminPanelProps> = ({ onBackpackAdded, catalog }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('LAYOUT');
  const [localCatalog, setLocalCatalog] = useState<ContentDefinition[]>(catalog);
  const [backpacks, setBackpacks] = useState<Backpack[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  
  // State for forms
  const [newBackpackName, setNewBackpackName] = useState('');
  const [newBackpackHospital, setNewBackpackHospital] = useState('');
  const [newBackpackType, setNewBackpackType] = useState('Spoed');
  const [newBackpackId, setNewBackpackId] = useState('');

  const [newContentCode, setNewContentCode] = useState('');
  const [newContentName, setNewContentName] = useState('');
  const [newContentDesc, setNewContentDesc] = useState('');

  const [newArticleName, setNewArticleName] = useState('');
  const [newArticleCategory, setNewArticleCategory] = useState('');
  const [newArticleManufacturer, setNewArticleManufacturer] = useState('');
  const [newArticleMinStock, setNewArticleMinStock] = useState<number>(0);
  
  // State for layout designer
  const [masterGridCols, setMasterGridCols] = useState(4);
  const [masterGridRows, setMasterGridRows] = useState(6);
  const [masterModules, setMasterModules] = useState<Module[]>([]);

  // State for recipe management
  const [selectedCatalogForRecipe, setSelectedCatalogForRecipe] = useState<string>('');
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [selectedArticleForRecipe, setSelectedArticleForRecipe] = useState('');

  // State for module packing
  const [selectedModuleToPack, setSelectedModuleToPack] = useState<Module | null>(null);
  const [moduleContents, setModuleContents] = useState<ModuleContent[]>([]);
  
  const [copySuccess, setCopySuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    setLocalCatalog(await db.getCatalog());
    setBackpacks(await db.getBackpacks());
    setArticles(await db.getArticles());
    setAllModules(await db.getAllModules());
    const layout = await db.getMasterLayout();
    setMasterGridCols(layout.grid_cols);
    setMasterGridRows(layout.grid_rows);
    setMasterModules(layout.modules);
    setIsLoading(false);
  };
  
  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCatalogForRecipe) {
      db.getRecipeForCatalog(selectedCatalogForRecipe).then(setRecipeItems);
    } else {
      setRecipeItems([]);
    }
  }, [selectedCatalogForRecipe]);

  useEffect(() => {
    if (selectedModuleToPack) {
      db.getModuleContents(selectedModuleToPack.id).then(setModuleContents);
    } else {
      setModuleContents([]);
    }
  }, [selectedModuleToPack]);
  
  const handleCreateBackpack = async () => {
    if (!newBackpackName || !newBackpackId) {
      alert('Naam en ID zijn verplicht.');
      return;
    }
    const newBackpack: Backpack = {
      id: newBackpackId,
      qrCode: `smartgrid:bp:${newBackpackId}`,
      name: newBackpackName,
      hospital: newBackpackHospital,
      type: newBackpackType,
      lastSync: new Date().toISOString(),
      batteryLevel: 100,
      operationalStatus: 'NEEDS_ATTENTION',
      modules: [],
      grid_cols: masterGridCols,
      grid_rows: masterGridRows,
    };
    await db.saveBackpack(newBackpack);
    onBackpackAdded();
    fetchData();
    setNewBackpackName('');
    setNewBackpackId('');
    setNewBackpackHospital('');
  };

  const handleDeleteBackpack = async (id: string) => {
    if(confirm(`Weet u zeker dat u koffer ${id} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)){
      await db.deleteBackpack(id);
      fetchData();
    }
  };

  const handleAddContentDef = async () => {
    if (!newContentCode || !newContentName) { alert('Code en Naam zijn verplicht.'); return; }
    await db.addContentDefinition({ code: newContentCode, name: newContentName, description: newContentDesc });
    fetchData();
    setNewContentCode('');
    setNewContentName('');
    setNewContentDesc('');
  };
  
  const handleAddArticle = async () => {
    if (!newArticleName) { alert('Naam is verplicht.'); return; }
    await db.addArticle({ 
      name: newArticleName, 
      category: newArticleCategory,
      manufacturer: newArticleManufacturer,
      min_stock_warning: newArticleMinStock
    });
    fetchData();
    setNewArticleName('');
    setNewArticleCategory('');
    setNewArticleManufacturer('');
    setNewArticleMinStock(0);
  };

  const handleAddToRecipe = async () => {
      if(!selectedCatalogForRecipe || !selectedArticleForRecipe) return;
      await db.addToRecipe(selectedCatalogForRecipe, selectedArticleForRecipe, 1);
      db.getRecipeForCatalog(selectedCatalogForRecipe).then(setRecipeItems);
  };
  
  const handleRemoveFromRecipe = async (recipeId: string) => {
    await db.removeFromRecipe(recipeId);
    db.getRecipeForCatalog(selectedCatalogForRecipe).then(setRecipeItems);
  };

  const handleSaveMasterLayout = async () => {
    await db.saveMasterLayout('default_mug', masterGridCols, masterGridRows, masterModules);
    alert('Master Layout opgeslagen!');
    fetchData();
  };
  
  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'LAYOUT', label: 'Standaard Layout', icon: Layers },
    { id: 'BACKPACKS', label: 'Nieuwe Koffer', icon: Package },
    { id: 'MODULES', label: 'Zakjes Beheer', icon: Tag },
    { id: 'MAGAZIJN', label: 'Artikelbeheer', icon: Warehouse },
    { id: 'INPAKKEN', label: 'Zakjes Vullen', icon: ShoppingBag },
    { id: 'SQL', label: 'Database Setup', icon: Database },
  ];
  
  const renderTabContent = () => {
    if (isLoading) return <div className="text-center p-8">Laden...</div>

    switch (activeTab) {
      case 'LAYOUT':
        return (
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-main border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Master Layout Designer</h3>
              <button onClick={handleSaveMasterLayout} className="bg-primary-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-primary-800"><Save className="w-4 h-4" /> Opslaan</button>
            </div>
            <BackpackDesigner 
              mode="DESIGN"
              modules={masterModules}
              gridCols={masterGridCols}
              gridRows={masterGridRows}
              onLayoutChange={setMasterModules}
              onGridResize={(cols, rows) => { setMasterGridCols(cols); setMasterGridRows(rows); }}
              assignableModules={localCatalog.map(c => ({ name: c.name, color: '' }))} 
            />
          </div>
        );
      case 'BACKPACKS':
        return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-main border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Nieuwe Koffer Registreren</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input value={newBackpackName} onChange={e => setNewBackpackName(e.target.value)} placeholder="Naam (bv. MUG-01)" className={inputClasses} />
                <input value={newBackpackHospital} onChange={e => setNewBackpackHospital(e.target.value)} placeholder="Ziekenhuis" className={inputClasses} />
                <input value={newBackpackId} onChange={e => setNewBackpackId(e.target.value)} placeholder="Uniek ID (bv. ESP32-XYZ)" className={inputClasses} />
                <select value={newBackpackType} onChange={e => setNewBackpackType(e.target.value)} className={selectClasses}>
                  <option>Spoed</option> <option>Interventie</option> <option>Transport</option>
                </select>
              </div>
              <button onClick={handleCreateBackpack} className="mt-4 bg-primary-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-primary-800"><Plus className="w-4 h-4"/> Aanmaken</button>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-main border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Bestaande Koffers</h3>
              <ul className="divide-y divide-slate-100">
                {backpacks.map(bp => (
                  <li key={bp.id} className="py-2 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-700">{bp.name}</span>
                      <span className="text-xs text-slate-500 ml-2 font-mono">{bp.id}</span>
                    </div>
                    <button onClick={() => handleDeleteBackpack(bp.id)} className="text-slate-400 hover:text-Danger-600 p-1"><Trash2 className="w-4 h-4"/></button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      case 'MODULES':
        return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-main border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Nieuw Type Zakje Definiëren</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input value={newContentCode} onChange={e => setNewContentCode(e.target.value)} placeholder="Code (4 cijfers)" className={inputClasses} />
                <input value={newContentName} onChange={e => setNewContentName(e.target.value)} placeholder="Naam (bv. Verbandset)" className={inputClasses} />
                <input value={newContentDesc} onChange={e => setNewContentDesc(e.target.value)} placeholder="Omschrijving" className={inputClasses} />
              </div>
              <button onClick={handleAddContentDef} className="mt-4 bg-primary-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-primary-800"><Plus className="w-4 h-4"/> Toevoegen</button>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-main border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Bestaande Definities</h3>
              <ul className="divide-y divide-slate-100">
                {localCatalog.map(c => ( <li key={c.code} className="py-2 font-mono text-sm text-slate-600">{c.code} - {c.name}</li> ))}
              </ul>
            </div>
          </div>
        );
      case 'MAGAZIJN':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-main border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Nieuw Artikel</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <input value={newArticleName} onChange={e => setNewArticleName(e.target.value)} placeholder="Artikelnaam" className={`${inputClasses} col-span-2`} />
                    <input value={newArticleManufacturer} onChange={e => setNewArticleManufacturer(e.target.value)} placeholder="Fabrikant" className={inputClasses} />
                    <input value={newArticleCategory} onChange={e => setNewArticleCategory(e.target.value)} placeholder="Categorie" className={inputClasses} />
                    <input type="number" value={newArticleMinStock} onChange={e => setNewArticleMinStock(parseInt(e.target.value) || 0)} placeholder="Min. voorraad" className={`${inputClasses} col-span-2`} />
                 </div>
                 <button onClick={handleAddArticle} className="mt-4 bg-primary-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-primary-800"><Plus className="w-4 h-4"/> Toevoegen</button>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-main border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Alle Artikelen</h3>
                <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100 border rounded-lg">
                  {articles.map(a => (
                    <li key={a.id} className="p-3 text-sm">
                      <p className="font-semibold text-slate-800">{a.name}</p>
                      <p className="text-xs text-slate-500">{a.manufacturer} - {a.category}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-main border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Receptuur Beheren</h3>
              <select value={selectedCatalogForRecipe} onChange={e => setSelectedCatalogForRecipe(e.target.value)} className={`${selectClasses} mb-4`}>
                <option value="">-- Selecteer Type Zakje --</option>
                {localCatalog.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
              </select>
              {selectedCatalogForRecipe && (
                <div>
                  <h4 className="font-semibold mb-2 text-slate-800">Inhoud voor {localCatalog.find(c=>c.code === selectedCatalogForRecipe)?.name}:</h4>
                  <ul className="mb-4 divide-y border rounded-lg max-h-60 overflow-y-auto">
                    {recipeItems.map(r => (
                      <li key={r.id} className="p-2 text-sm flex justify-between items-center">
                        <span>{r.article?.name} (x{r.quantity})</span>
                        <button onClick={() => handleRemoveFromRecipe(r.id)} className="text-slate-400 hover:text-Danger-600 p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                      </li>
                    ))}
                  </ul>
                  <h4 className="font-semibold mb-2 text-slate-800">Voeg artikel toe:</h4>
                  <div className="flex gap-2">
                    <select value={selectedArticleForRecipe} onChange={e => setSelectedArticleForRecipe(e.target.value)} className={`${selectClasses} flex-1`}>
                      <option value="">-- Selecteer Artikel --</option>
                      {articles.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <button onClick={handleAddToRecipe} className="bg-slate-200 text-slate-800 font-bold p-2 rounded-lg hover:bg-slate-300"><Plus className="w-5 h-5"/></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case 'INPAKKEN':
        const modulesToPack = allModules.filter(m => m.status === 'WAITING_FOR_MATCHMAKING');
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-main border border-slate-200">
               <h3 className="text-lg font-bold text-slate-800 mb-4">Lege Zakjes</h3>
               <ul className="divide-y border rounded-lg max-h-96 overflow-y-auto">
                  {modulesToPack.map(m => (
                    <li key={m.id} className={`p-3 cursor-pointer hover:bg-primary-50 ${selectedModuleToPack?.id === m.id ? 'bg-primary-100' : ''}`} onClick={() => setSelectedModuleToPack(m)}>
                      <p className="font-semibold text-slate-700">{m.name}</p>
                      <p className="font-mono text-sm text-slate-500">{formatRFID(m.id)}</p>
                    </li>
                  ))}
               </ul>
            </div>
            {selectedModuleToPack && (
               <div className="bg-white p-6 rounded-xl shadow-main border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Inpakinstructies voor: {selectedModuleToPack.name}</h3>
                  {/* Content to be added here */}
               </div>
            )}
          </div>
        );
      case 'SQL':
        return (
          <div className="bg-white p-6 rounded-xl shadow-main border border-slate-200">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">Database Setup Script</h3>
                <button onClick={handleCopySql} className="bg-slate-100 text-slate-700 font-bold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-slate-200">
                  {copySuccess ? <><Check className="w-4 h-4 text-Success-600"/> Gekopieerd</> : <><Copy className="w-4 h-4"/> Kopieer</>}
                </button>
             </div>
             <pre className="bg-slate-800 text-slate-300 p-4 rounded-lg text-xs overflow-x-auto max-h-[60vh]">
                <code>{SQL_SETUP_SCRIPT}</code>
             </pre>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
      <div className="hidden lg:flex flex-col w-64 bg-white p-4 rounded-xl shadow-main border border-slate-200 shrink-0">
        <h2 className="px-3 pb-3 text-lg font-bold text-slate-800 border-b border-slate-100">Beheerconsole</h2>
        <div className="mt-4 space-y-1">
            {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab.id ? 'bg-primary-100 text-primary-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                    <tab.icon className="w-5 h-5" /> {tab.label}
                </button>
            ))}
        </div>
      </div>
      
      <div className="lg:hidden w-full bg-white p-2 rounded-xl shadow-main border border-slate-200">
        <select onChange={(e) => setActiveTab(e.target.value as AdminTab)} value={activeTab} className="w-full bg-slate-50 border-slate-200 border rounded-lg p-3 font-semibold text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none">
            {TABS.map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
        </select>
      </div>

      <div className="flex-1 w-full">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AdminPanel;