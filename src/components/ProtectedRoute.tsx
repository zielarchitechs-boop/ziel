import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AlertCircle, RefreshCw, LogIn, Settings } from 'lucide-react';

export const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const ADMIN_EMAIL = 'studyguide.me001@gmail.com';

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError('Supabase is not configured. Please add the required environment variables to your Secrets.');
      return;
    }

    let mounted = true;
    let authCheckFinished = false;

    // Global timeout for initial auth check
    const timeoutId = setTimeout(() => {
      if (mounted && !authCheckFinished) {
        console.error('Auth check timed out');
        setError('Authentication check is taking longer than usual. This might be due to a slow connection or a session issue.');
        setLoading(false);
      }
    }, 30000);

    const checkUserStatus = async (session: any) => {
      if (!session) {
        if (mounted) {
          setAuthenticated(false);
          setIsAdmin(false);
          setLoading(false);
          authCheckFinished = true;
          clearTimeout(timeoutId);
          navigate('/login');
        }
        return;
      }

      try {
        // Check if user is in password recovery mode
        const isRecovering = sessionStorage.getItem('is_recovering') === 'true';
        if (isRecovering) {
          navigate('/reset-password');
          return;
        }

        const isHardcodedAdmin = session.user.email === ADMIN_EMAIL;
        
        // Fetch profile with a local timeout
        const profilePromise = supabase
          .from('profiles')
          .select('is_admin, institution')
          .eq('id', session.user.id)
          .maybeSingle();

        // Race the profile fetch against a 10s timeout
        const profileTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timed out')), 10000)
        );

        const { data: profile, error: profileError } = await Promise.race([
          profilePromise,
          profileTimeout
        ]) as any;

        if (profileError) console.warn('Profile fetch error:', profileError.message);
        
        if (!mounted) return;

        const userAdmin = isHardcodedAdmin || (profile?.is_admin || false) || (profile?.institution === 'Ziel Architects');
        setIsAdmin(userAdmin);
        
        if (adminOnly && !userAdmin) {
          navigate('/dashboard');
        } else {
          setAuthenticated(true);
        }
        setError(null);
      } catch (err: any) {
        console.error('User status check error:', err.message);
        if (mounted) {
          // If profile fetch fails, we still allow authenticated state if not adminOnly
          if (!adminOnly) {
            setAuthenticated(true);
          } else {
            setError('Could not verify admin privileges. Please try again.');
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
          authCheckFinished = true;
          clearTimeout(timeoutId);
        }
      }
    };

    // Initial check
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (mounted) checkUserStatus(session);
      }).catch(err => {
        console.error('Initial session fetch error:', err);
        if (mounted) {
          setError('Failed to retrieve session. Please check your connection.');
          setLoading(false);
          authCheckFinished = true;
          clearTimeout(timeoutId);
        }
      });
    }

    // Listen for changes
    let subscription: any = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event: string, session: any) => {
        if (!mounted) return;
        
        if (event === 'SIGNED_OUT') {
          setAuthenticated(false);
          setIsAdmin(false);
          setLoading(false);
          authCheckFinished = true;
          clearTimeout(timeoutId);
          navigate('/login');
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          checkUserStatus(session);
        }
      });
      subscription = data.subscription;
    }

    return () => {
      mounted = false;
      authCheckFinished = true;
      clearTimeout(timeoutId);
      if (subscription) subscription.unsubscribe();
    };
  }, [navigate, adminOnly]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-950"></div>
      </div>
    );
  }

  if (error && !authenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4 text-center">
        <div className={`w-20 h-20 ${!isSupabaseConfigured ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'} rounded-3xl flex items-center justify-center mb-6 shadow-sm`}>
          {!isSupabaseConfigured ? <Settings size={40} /> : <AlertCircle size={40} />}
        </div>
        <h2 className="text-2xl font-bold text-stone-950 mb-3">
          {!isSupabaseConfigured ? 'Configuration Required' : 'Authentication Issue'}
        </h2>
        <p className="text-stone-600 mb-8 max-w-md leading-relaxed">
          {error}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          {!isSupabaseConfigured ? (
            <a 
              href="https://supabase.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 py-4 bg-stone-950 text-white rounded-2xl font-bold shadow-lg shadow-stone-950/20 hover:bg-amber-900 transition-all flex items-center justify-center gap-2"
            >
              Get Supabase Keys
            </a>
          ) : (
            <>
              <button 
                onClick={() => window.location.reload()} 
                className="flex-1 py-4 bg-stone-950 text-white rounded-2xl font-bold shadow-lg shadow-stone-950/20 hover:bg-amber-900 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={20} /> Retry
              </button>
              <button 
                onClick={() => {
                  // Clear Supabase session from local storage
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.includes('supabase.auth.token')) {
                      localStorage.removeItem(key);
                    }
                  }
                  navigate('/login');
                }} 
                className="flex-1 py-4 bg-stone-100 text-stone-950 rounded-2xl font-bold hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
              >
                <LogIn size={20} /> Clear & Login
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return authenticated ? <>{children}</> : null;
};
