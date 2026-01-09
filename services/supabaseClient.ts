import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURATIE INSTRUCTIES
// ------------------------------------------------------------------
// 1. Maak een project aan op https://supabase.com
// 2. Ga naar Project Settings -> API
// 3. Kopieer de 'Project URL' en 'anon' public key hieronder
// ------------------------------------------------------------------

const SUPABASE_URL = 'https://dziyxrtiaihrpcvlmjha.supabase.co' as string;
// Gebruiker specifieke publishable key
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6aXl4cnRpYWlocnBjdmxtamhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODE3MjAsImV4cCI6MjA4MzM1NzcyMH0.DjYK5z3vZoXDbjWkcwkdaG0BGBZ9e0yCzPP__JWxLME' as string;

// Check of de gebruiker de placeholders heeft aangepast
export const isConfigured = 
  SUPABASE_URL !== 'YOUR_PROJECT_URL' && 
  SUPABASE_ANON_KEY !== 'YOUR_ANON_KEY';

if (!isConfigured) {
  console.log('Supabase niet geconfigureerd. App toont setup scherm.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});