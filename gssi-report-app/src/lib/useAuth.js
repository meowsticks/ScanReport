// Thin auth hook over Supabase. Reading the current session is local (no
// network), so this never blocks the app when offline; only sign in / sign up
// touch the network.

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setSession(data?.session ?? null);
          setReady(true);
        }
      })
      .catch(() => mounted && setReady(true));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    ready,
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email: email.trim(), password }),
    signUp: (email, password) =>
      supabase.auth.signUp({ email: email.trim(), password }),
    signOut: () => supabase.auth.signOut(),
  };
}
