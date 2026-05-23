// Supabase client for AK ScanReport.
//
// These two values are the PUBLIC, publishable credentials. They are designed
// to be shipped in client apps and are safe to commit — every request is still
// gated by Row-Level Security policies in the database (see supabase/schema.sql).
//
// NEVER put the `service_role` / secret key in this file or anywhere in the app.
//
// CI or local builds may override these via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://aducewrrialzzssgkwdo.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWNld3JyaWFsenpzc2drd2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTc0OTAsImV4cCI6MjA5NDk5MzQ5MH0.p_LwHpR6lkcPAdVmVUstCff8N9ztgrA_NQrPRCyYpQ8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The desktop app loads from file://, where the URL never carries auth
    // params, so don't try to parse a session out of the page URL there.
    detectSessionInUrl: false,
  },
});
