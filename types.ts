export type ModuleStatus = 'OK' | 'OPENED' | 'MISSING' | 'ERROR' | 'WRONG_POS' | 'WAITING_FOR_MATCHMAKING';

export type OperationalStatus = 'OPERATIONAL' | 'NEEDS_ATTENTION' | 'IN_PREPARATION' | 'IN_USE';

export interface ParsedID {
  fullId: string;
  colorType: string; // First 2 digits (e.g. 01 for Red)
  serial: string;    // Next 2 digits (Sequence number 01-99)
  contentCode: string; // Last 4 digits (Catalog Code)
}

// Catalogus definitie (Het "Type" zakje)
export interface ContentDefinition {
  code: string; // "0001"
  name: string; // "Verbandset Basis"
  description?: string;
  default_width?: number; // Suggestie voor grid grootte
  default_height?: number;
}

// Uitgebreid Artikel (Nu inclusief batch/stock info)
export interface Article {
  id: string;
  name: string;
  category: string;
  manufacturer?: string;
  batch_number?: string;
  expiry_date?: string; // ISO Date
  unit?: string; // e.g. "ml", "stuks"
  instructions?: string;
  min_stock_warning?: number;
}

// Een regel in de "Receptuur" (Wat er in ZOU moeten zitten)
export interface RecipeItem {
  id: string; 
  catalog_code: string;
  article_id: string;
  quantity: number;
  article?: Article;
}

// Specifieke inhoud van een fysiek zakje (Wat er DAADWERKELIJK in zit)
export interface ModuleContent {
  id: string;
  module_id: string;
  article_name: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
}

export interface Module {
  id: string; // The 8-digit RFID code
  name: string; // Derived from content code
  status: ModuleStatus;
  lastUpdate: string; // ISO timestamp
  backpack_id?: string; // Foreign key
  color?: string; // "red", "blue", "yellow"
  calculated_expiry?: string; // The earliest expiry date of contents
  
  // Matrix Grid Properties
  pos_x: number; // Grid Column (0-based)
  pos_y: number; // Grid Row (0-based)
  width: number; // Grid Column Span
  height: number; // Grid Row Span
}

export interface Backpack {
  id: string; // Unique Identifier (UUID or generated)
  qrCode: string; // The string encoded in the QR
  name: string; // Friendly name (e.g., "MUG-01")
  hospital: string; // Changed from location to hospital
  type: string; // e.g., "Spoed", "Interventie"
  lastSync: string; // ISO timestamp
  batteryLevel: number; // 0-100
  modules: Module[];
  operationalStatus: OperationalStatus;
  
  // Matrix Properties
  grid_cols: number; // e.g. 4
  grid_rows: number; // e.g. 6
}

// FIX: Export MasterLayout interface
export interface MasterLayout {
  grid_cols: number;
  grid_rows: number;
  modules: Module[];
}

export interface ReplacementResult {
  success: boolean;
  message: string;
  timestamp: string;
}

export interface AppNotification {
  id: string;
  type: 'ALERT' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  backpackId?: string;
}

export interface UrgentAlert {
  backpackId: string;
  backpackName: string;
  moduleId: string;
  moduleName: string;
  status: ModuleStatus;
  timestamp: string;
}