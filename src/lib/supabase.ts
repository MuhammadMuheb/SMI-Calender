import { createClient } from '@supabase/supabase-js';

// Falls back to the production project so existing deployments keep working
// unmodified. Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local
// (see .env.example) to point this app at a staging project instead.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://bchjkyavanfaegdbewnj.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaGpreWF2YW5mYWVnZGJld25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDEyOTYsImV4cCI6MjA5MTQxNzI5Nn0.WdN1sJeLxwBJ0HlJN_nmvwhvx6xsV1NY-nCH_jHVgVQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
