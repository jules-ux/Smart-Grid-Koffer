import { Backpack, ContentDefinition, Module, Article, RecipeItem, ModuleContent, OperationalStatus, ModuleStatus } from '../types';
import { supabase, isConfigured } from './supabaseClient';

const VALID_MODULE_STATUSES: ModuleStatus[] = ['OK', 'OPENED', 'MISSING', 'ERROR', 'WRONG_POS', 'WAITING_FOR_MATCHMAKING'];
const sanitizeStatus = (status: any): ModuleStatus => {
  if (VALID_MODULE_STATUSES.includes(status)) {
    return status as ModuleStatus;
  }
  console.warn(`Ongeldige module status '${status}' gelezen uit DB, standaard naar 'ERROR'.`);
  return 'ERROR';
};


export const db = {
  // --- Connection Check ---
  testConnection: async (): Promise<{ success: boolean; message?: string }> => {
    if (!isConfigured) return { success: false, message: 'Niet geconfigureerd' };
    try {
      // Check for essential tables introduced in different stages
      const tablesToCheck = ['backpacks', 'modules', 'articles', 'master_layouts', 'master_modules'];
      for (const table of tablesToCheck) {
        const { error } = await supabase.from(table).select('id', { count: 'exact', head: true });
        if (error) {
          if (error.code === '42P01') { // "relation does not exist"
            throw new Error(`Tabel '${table}' niet gevonden. Voer het meest recente Database Setup script uit in de Supabase SQL Editor.`);
          }
          throw error;
        }
      }
      return { success: true };
    } catch (err: any) {
      console.error('Supabase connection test failed:', err);
      let errorMessage = 'Kon geen verbinding maken met de database.';

      if (typeof err === 'object' && err !== null && err.message) {
        // This handles Supabase PostgrestError and many other error objects
        errorMessage = err.message;
        if (err.details) errorMessage += ` Details: ${err.details}`;
        if (err.hint) errorMessage += ` Hint: ${err.hint}`;

        // Add more specific user-friendly messages for common issues
        if (errorMessage.toLowerCase().includes('failed to fetch')) {
            errorMessage = 'Netwerkfout: Kon de Supabase server niet bereiken. Controleer de internetverbinding en de Project URL in `supabaseClient.ts`.';
        } else if (errorMessage.toLowerCase().includes('invalid jwt') || errorMessage.toLowerCase().includes('api key')) {
            errorMessage = 'Authenticatiefout: De Supabase API Key is ongeldig. Controleer de `anon` key in `supabaseClient.ts`.';
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      return { success: false, message: errorMessage };
    }
  },

  // --- Catalog Operations ---
  getCatalog: async (): Promise<ContentDefinition[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('catalog').select('*').order('code');
    if (error) {
        console.error('Error fetching catalog:', error);
        throw error;
    }
    return data || [];
  },

  addContentDefinition: async (def: ContentDefinition) => {
    if (!isConfigured) throw new Error("Database not configured");
    // Ensure code is 4 digits
    const formattedDef = {
        ...def,
        code: def.code.padStart(4, '0')
    };
    const { error } = await supabase.from('catalog').upsert(formattedDef);
    if (error) throw error;
  },

  importCatalogBatch: async (items: ContentDefinition[]) => {
    if (!isConfigured) throw new Error("Database not configured");
    const { error } = await supabase.from('catalog').upsert(items);
    if (error) throw error;
  },

  getContentName: async (code: string): Promise<string> => {
    if (!isConfigured) return 'Onbekend (Geen DB)';
    try {
      const { data, error } = await supabase.from('catalog').select('name').eq('code', code).single();
      return data ? data.name : 'Onbekende Inhoud';
    } catch (err) {
      return 'Onbekende Inhoud';
    }
  },

  // --- Article & Recipe Operations (Magazijn) ---
  
  getArticles: async (): Promise<Article[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('articles').select('*').order('name');
    if (error) {
        console.error('Error fetching articles:', error);
        throw error;
    }
    return data || [];
  },

  addArticle: async (article: Partial<Article>) => {
    if (!isConfigured) throw new Error("Database not configured");
    const { error } = await supabase.from('articles').insert(article);
    if (error) throw error;
  },

  getRecipeForCatalog: async (catalogCode: string): Promise<RecipeItem[]> => {
     if (!isConfigured) return [];
     // Fetch recipe items and join with article details
     const { data, error } = await supabase
        .from('catalog_recipes')
        .select(`*, article:articles(*)`)
        .eq('catalog_code', catalogCode);
     
     if (error) { console.error(error); return []; }
     return data || [];
  },

  addToRecipe: async (catalogCode: string, articleId: string, quantity: number = 1) => {
      if (!isConfigured) throw new Error("Database not configured");
      const { error } = await supabase.from('catalog_recipes').upsert({
          catalog_code: catalogCode,
          article_id: articleId,
          quantity: quantity
      }, { onConflict: 'catalog_code, article_id' });
      if (error) throw error;
  },
  
  removeFromRecipe: async (recipeId: string) => {
      if (!isConfigured) throw new Error("Database not configured");
      const { error } = await supabase.from('catalog_recipes').delete().eq('id', recipeId);
      if (error) throw error;
  },

  // --- Module Packing & Contents (Inpakken) ---

  getAllModules: async (): Promise<Module[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('modules').select('*').order('last_update', { ascending: false });
    if (error) {
        console.error('Error fetching all modules:', error);
        throw error;
    }
    
    return data.map((m: any) => ({
        id: m.id,
        name: m.name,
        status: sanitizeStatus(m.status),
        lastUpdate: m.last_update,
        backpack_id: m.backpack_id,
        color: m.color,
        calculated_expiry: m.calculated_expiry,
        pos_x: m.pos_x || 0,
        pos_y: m.pos_y || 0,
        width: m.width || 1,
        height: m.height || 1
    }));
  },

  getModuleById: async (id: string): Promise<Module | null> => {
    if (!isConfigured) return null;
    try {
      const { data, error } = await supabase.from('modules').select('*').eq('id', id).single();
      if (error) {
        if (error.code !== 'PGRST116') { // PGRST116 = "The result contains 0 rows"
          console.error(`Error fetching module by ID ${id}:`, error);
        }
        return null;
      }
      if (!data) return null;
      return {
        id: data.id,
        name: data.name,
        status: sanitizeStatus(data.status),
        lastUpdate: data.last_update,
        backpack_id: data.backpack_id,
        color: data.color,
        calculated_expiry: data.calculated_expiry,
        pos_x: data.pos_x || 0,
        pos_y: data.pos_y || 0,
        width: data.width || 1,
        height: data.height || 1
      };
    } catch (err) {
      console.error(`Exception fetching module by ID ${id}:`, err);
      return null;
    }
  },

  registerModule: async (id: string, name: string, color: string) => {
    if (!isConfigured) throw new Error("Database not configured");
    const { error } = await supabase.from('modules').upsert({
        id: id,
        name: name,
        color: color,
        status: 'WAITING_FOR_MATCHMAKING',
        last_update: new Date().toISOString(),
        backpack_id: null
    });
    if (error) throw error;
  },

  updateModuleDetails: async (id: string, color: string, name: string) => {
    if (!isConfigured) return;
    const { error } = await supabase.from('modules').upsert({ id, name, color, last_update: new Date().toISOString() });
    if (error) throw error;
  },

  addModuleContent: async (content: Omit<ModuleContent, 'id'>) => {
    if (!isConfigured) return;
    const { error } = await supabase.from('module_contents').insert(content);
    if (error) throw error;
    await db.recalculateModuleExpiry(content.module_id);
  },

  getModuleContents: async (moduleId: string): Promise<ModuleContent[]> => {
    if(!isConfigured) return [];
    const { data } = await supabase.from('module_contents').select('*').eq('module_id', moduleId);
    return data || [];
  },

  clearModuleContents: async (moduleId: string) => {
     if(!isConfigured) return;
     await supabase.from('module_contents').delete().eq('module_id', moduleId);
     await db.recalculateModuleExpiry(moduleId);
  },

  recalculateModuleExpiry: async (moduleId: string) => {
    const { data } = await supabase.from('module_contents').select('expiry_date').eq('module_id', moduleId);
    let earliest = null;
    if (data && data.length > 0) {
       const sorted = data.map(d => d.expiry_date).sort();
       earliest = sorted[0];
    }
    await supabase.from('modules').update({ calculated_expiry: earliest }).eq('id', moduleId);
  },

  // --- Backpack Operations ---
  getBackpacks: async (): Promise<Backpack[]> => {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase.from('backpacks').select(`*, modules (*)`).order('name');
      if (error) throw error;
      
      return (data || []).map((bp: any) => ({
        id: bp.id,
        qrCode: bp.qr_code,
        name: bp.name,
        hospital: bp.hospital,
        type: bp.type,
        lastSync: bp.last_sync,
        batteryLevel: bp.battery_level,
        operationalStatus: bp.operational_status || 'OPERATIONAL',
        grid_cols: bp.grid_cols || 4,
        grid_rows: bp.grid_rows || 4,
        modules: (bp.modules || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          status: sanitizeStatus(m.status),
          lastUpdate: m.last_update,
          backpack_id: m.backpack_id,
          color: m.color,
          calculated_expiry: m.calculated_expiry,
          pos_x: m.pos_x || 0,
          pos_y: m.pos_y || 0,
          width: m.width || 1,
          height: m.height || 1
        }))
      }));
    } catch (err: any) {
      console.error('CRITICAL DATABASE ERROR:', err.message || err);
      return [];
    }
  },

  saveBackpack: async (backpack: Backpack) => {
    if (!isConfigured) throw new Error("Database not configured");
    
    // Save Backpack Meta including Grid size
    const { error: bpError } = await supabase.from('backpacks').upsert({
      id: backpack.id,
      qr_code: backpack.qrCode,
      name: backpack.name,
      hospital: backpack.hospital,
      type: backpack.type,
      last_sync: backpack.lastSync,
      battery_level: backpack.batteryLevel,
      operational_status: backpack.operationalStatus,
      grid_cols: backpack.grid_cols,
      grid_rows: backpack.grid_rows,
    });
    if (bpError) throw bpError;

    // Save Modules with Coordinates
    if (backpack.modules.length > 0) {
      const modulesPayload = backpack.modules.map(m => ({
        id: m.id,
        backpack_id: backpack.id,
        name: m.name,
        status: m.status,
        last_update: m.lastUpdate,
        color: m.color,
        calculated_expiry: m.calculated_expiry,
        pos_x: m.pos_x,
        pos_y: m.pos_y,
        width: m.width,
        height: m.height
      }));
      const { error: modError } = await supabase.from('modules').upsert(modulesPayload);
      if (modError) throw modError;
    }
  },

  // New, efficient function to only update a backpack's status
  updateBackpackStatus: async (id: string, status: OperationalStatus) => {
    if (!isConfigured) throw new Error("Database not configured");
    const { error } = await supabase
      .from('backpacks')
      .update({ operational_status: status, last_sync: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  deleteBackpack: async (id: string) => {
    if (!isConfigured) throw new Error("Database not configured");
    const { error } = await supabase.from('backpacks').delete().eq('id', id);
    if (error) throw error;
  },

  // --- Master Layout Operations ---
  getMasterLayout: async (layoutId: string = 'default_mug'): Promise<{ grid_cols: number, grid_rows: number, modules: Module[] }> => {
    if (!isConfigured) return { grid_cols: 4, grid_rows: 4, modules: [] };
    
    const { data: layoutData, error: layoutError } = await supabase.from('master_layouts').select('*').eq('id', layoutId).single();
    if (layoutError) {
        console.error("Error fetching master layout:", layoutError);
        throw new Error(`Fout bij ophalen master layout: ${layoutError.message}`);
    }
    
    const { data: modulesData, error: modulesError } = await supabase.from('master_modules').select('*').eq('master_layout_id', layoutId);
    if (modulesError) { 
        console.error("Error fetching master modules:", modulesError);
        throw new Error(`Fout bij ophalen master modules: ${modulesError.message}`);
    }
    
    return {
      grid_cols: layoutData.grid_cols,
      grid_rows: layoutData.grid_rows,
      // Map master_module to Module type for the designer
      modules: (modulesData || []).map(m => ({
        id: m.id,
        name: m.name,
        color: m.color,
        pos_x: m.pos_x,
        pos_y: m.pos_y,
        width: m.width,
        height: m.height,
        status: 'MISSING', // status is irrelevant for layout
        lastUpdate: new Date().toISOString()
      }))
    };
  },

  saveMasterLayout: async (layoutId: string = 'default_mug', grid_cols: number, grid_rows: number, modules: Module[]) => {
      if (!isConfigured) throw new Error("Database not configured");
      
      const { error: layoutError } = await supabase.from('master_layouts').update({ grid_cols, grid_rows }).eq('id', layoutId);
      if (layoutError) throw layoutError;

      const { error: deleteError } = await supabase.from('master_modules').delete().eq('master_layout_id', layoutId);
      if (deleteError) throw deleteError;

      if (modules.length > 0) {
          const modulesPayload = modules.map(m => ({
              master_layout_id: layoutId,
              name: m.name,
              pos_x: m.pos_x,
              pos_y: m.pos_y,
              width: m.width,
              height: m.height,
              color: m.color
          }));
          const { error: insertError } = await supabase.from('master_modules').insert(modulesPayload);
          if (insertError) throw insertError;
      }
  }
};