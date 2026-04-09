
import React, { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const TIMEOUT_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

export const SessionTimeout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('Session timed out due to inactivity.');
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
  }, []);

  const resetTimer = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      timeoutRef.current = setTimeout(handleLogout, TIMEOUT_DURATION);
    }
  }, [handleLogout]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    
    const onActivity = () => {
      resetTimer();
    };

    // Initial timer start
    resetTimer();

    events.forEach(event => {
      window.addEventListener(event, onActivity);
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, onActivity);
      });
    };
  }, [resetTimer]);

  return <>{children}</>;
};
