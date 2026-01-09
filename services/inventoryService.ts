import { ParsedID, ReplacementResult, Module, Backpack, OperationalStatus, MasterLayout } from '../types';
import { db } from './database';

// Logic: Parses the 8-digit ID string, now handles placeholders like '01XX0001'
// Format: aabbcccc (aa=kleur, bb=volgnummer, cccc=inhoudscode)
export const parseRFID = (id: string): ParsedID => {
  const isPlaceholder = id.includes('XX');
  const safeId = id.padEnd(8, '0');

  return {
    fullId: id,
    colorType: safeId.substring(0, 2),
    serial: isPlaceholder ? 'XX' : safeId.substring(2, 4),
    contentCode: safeId.substring(4, 8)
  };
};

// New function to format the ID for display, now handles placeholders
export const formatRFID = (id: string | null | undefined): string => {
  if (!id) return '';
  if (id.length !== 8 && !id.includes('XX')) {
    return id; // Return as is if not a valid format
  }
  
  if (id.includes('XX')) {
    const color = id.substring(0, 2);
    const content = id.substring(4, 8);
    return `${color} -- ${content}`; // Special formatting for templates
  }

  const color = id.substring(0, 2);
  const serial = id.substring(2, 4);
  const content = id.substring(4, 8);
  return `${color} ${serial} ${content}`;
};

// Updated: Async wrapper for DB call
export const getContentName = async (contentCode: string): Promise<string> => {
  return await db.getContentName(contentCode);
};

// Logic: Determines if a replacement bag is valid. Now handles placeholders for filling empty slots.
export const validateReplacement = (oldId: string, newId:string): ReplacementResult => {
  // Normaliseer de input door alle spaties te verwijderen.
  const normalizedNewId = newId.replace(/\s/g, '');

  // Check 1: The new ID must be a valid 8-digit numeric format. This is the "full ID" structure check.
  if (normalizedNewId.length !== 8 || !/^\d+$/.test(normalizedNewId)) {
    return {
      success: false,
      message: `Ongeldig ID formaat. Vereist 8 cijfers, ontvangen: "${newId}".`,
      timestamp: new Date().toISOString()
    };
  }
  
  try {
    const oldParsed = parseRFID(oldId);
    const newParsed = parseRFID(normalizedNewId);
    
    // Check 2: Cannot replace a module with itself. This covers checking the full ID including serial number.
    if (oldParsed.serial !== 'XX' && oldId === normalizedNewId) {
      return {
        success: false,
        message: 'FOUT: Kan een zakje niet met zichzelf vervangen.',
        timestamp: new Date().toISOString()
      };
    }

    // Check 3: Content type must match (last 4 digits - cccc).
    if (oldParsed.contentCode !== newParsed.contentCode) {
         return {
        success: false,
        message: `FOUT: Inhoudscode komt niet overeen! Verwacht: ${oldParsed.contentCode}, Gescand: ${newParsed.contentCode}.`,
        timestamp: new Date().toISOString()
      };
    }

    // Check 4: Color type must match (first 2 digits - aa).
    if (oldParsed.colorType !== newParsed.colorType) {
        return {
            success: false,
            message: `FOUT: Verkeerde kleur! Verwacht type: ${oldParsed.colorType}, Gescand: ${newParsed.colorType}.`,
            timestamp: new Date().toISOString()
        };
    }

    // Provide different success messages for filling vs. replacing
    if (oldParsed.serial === 'XX') {
       return {
        success: true,
        message: `Plaatsing goedgekeurd. Zakje ${formatRFID(newParsed.fullId)} geplaatst.`,
        timestamp: new Date().toISOString()
      };
    } else {
       return {
        success: true,
        message: `Vervanging goedgekeurd. Zakje #${newParsed.serial} vervangt zakje #${oldParsed.serial}.`,
        timestamp: new Date().toISOString()
      };
    }

  } catch (e) {
    // Fallback for any other parsing errors
    return {
      success: false,
      message: "Onverwachte fout tijdens validatie.",
      timestamp: new Date().toISOString()
    };
  }
};

export const getExpiryStatus = (isoDate?: string): 'EXPIRED' | 'WARNING' | 'OK' => {
  if (!isoDate) return 'OK';
  const now = new Date();
  const expiry = new Date(isoDate);
  
  if (expiry < now) return 'EXPIRED';
  
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 30) return 'WARNING';
  return 'OK';
};

// Replaces the old getBackpackStatus with a function that determines the correct persistent status.
export const calculateOperationalStatus = (backpack: Backpack, masterLayout: MasterLayout | null): OperationalStatus => {
  const IN_USE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minuten
  
  if (Date.now() - new Date(backpack.lastSync).getTime() > IN_USE_THRESHOLD_MS) {
    return 'IN_USE';
  }

  // If a user is actively preparing it, keep that status.
  if (backpack.operationalStatus === 'IN_PREPARATION') {
      return 'IN_PREPARATION';
  }

  // A backpack cannot be operational without a master layout to check against.
  if (!masterLayout || masterLayout.modules.length === 0) {
    return 'NEEDS_ATTENTION';
  }

  // A backpack is not operational if it's not fully stocked.
  if (backpack.modules.length < masterLayout.modules.length) {
    return 'NEEDS_ATTENTION';
  }

  // Check modules for critical issues or warnings.
  for (const mod of backpack.modules) {
    // Any module status other than OK requires attention.
    if (mod.status !== 'OK') {
      return 'NEEDS_ATTENTION';
    }

    // Check expiry dates.
    const expiryStatus = getExpiryStatus(mod.calculated_expiry);
    if (expiryStatus === 'EXPIRED' || expiryStatus === 'WARNING') {
      return 'NEEDS_ATTENTION';
    }
  }

  // If all checks pass, it's operational.
  return 'OPERATIONAL';
};