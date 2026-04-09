import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, ArrowRight, User, Phone, Globe, Shield, ChevronLeft, Building2, Briefcase, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { COUNTRY_DATA, ROLES, PHONE_CODES } from '../constants';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState('');
  const [institution, setInstitution] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Secrets.');
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem('is_recovering', 'true');
        navigate('/reset-password');
      } else if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('is_recovering');
      } else if (session) {
        // Check if we are in recovery mode
        const isRecovering = sessionStorage.getItem('is_recovering') === 'true';
        if (isRecovering) {
          navigate('/reset-password');
        } else {
          // Check if user is admin and redirect accordingly
          const ADMIN_EMAIL = 'studyguide.me001@gmail.com';
          if (session.user.email === ADMIN_EMAIL) {
            navigate('/admin');
          } else {
            navigate('/dashboard');
          }
        }
      }
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please add the required environment variables to your Secrets.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      console.log('Attempting password reset with redirect:', redirectTo);
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      
      if (resetError) {
        console.error('Supabase reset error:', resetError);
        throw resetError;
      }
      
      setError('Password reset link sent! Please check your email.');
      setIsForgotPassword(false);
    } catch (err: any) {
      console.error('Password reset catch:', err);
      if (err.message?.includes('Error sending recovery email')) {
        setError('Could not send reset link. This may be due to a configuration issue or rate limit. Please try again later or contact support.');
      } else {
        setError(err.message || 'An error occurred while sending the reset link.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please add the required environment variables to your Secrets.');
      return;
    }
    if (isForgotPassword) {
      return handleForgotPassword(e);
    }
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginError) throw loginError;
        
        // Redirection is handled by onAuthStateChange
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              middle_name: middleName,
              phone_code: countryCode,
              phone_number: phoneNumber,
              institution,
              role,
              country,
              is_admin_pending: institution === 'Ziel Architects',
            }
          }
        });

        if (signUpError) throw signUpError;

        setError('Account created! Please check your email for verification or sign in.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-amber-50/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-stone-100/20 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full ${isLogin ? 'max-w-md' : 'max-w-2xl'} bg-white rounded-3xl shadow-2xl border border-stone-100 p-6 md:p-10 transition-all duration-500`}
      >
        <div className="flex flex-col items-center mb-8 md:mb-10">
          <Link to="/" className="mb-6 md:mb-8">
            <Logo />
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-stone-950 mb-2">
            {isForgotPassword ? 'Reset Password' : (isLogin ? 'Secure Login' : 'Create Account')}
          </h1>
          <p className="text-sm md:text-base text-stone-600 text-center">
            {isForgotPassword 
              ? 'Enter your email to receive a reset link'
              : (isLogin 
                ? 'Please enter your credentials to access your portal' 
                : 'Join our architectural community')}
          </p>
        </div>

        <div className="space-y-6">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl flex items-center gap-3 text-xs md:text-sm ${
                error.includes('created') || error.includes('sent')
                  ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                  : 'bg-red-50 text-red-700 border border-red-100'
              }`}
            >
              {error.includes('created') || error.includes('sent') ? <Shield size={18} /> : <AlertCircle size={18} />}
              {error}
            </motion.div>
          )}
          <AnimatePresence mode="wait">
            {!isLogin && !isForgotPassword ? (
              <motion.div 
                key="signup-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className="space-y-2">
                  <label className="text-xs md:text-sm font-semibold text-stone-800 flex items-center gap-2">
                    <User size={16} /> First Name
                  </label>
                  <input 
                    required
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm md:text-base"
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs md:text-sm font-semibold text-stone-800 flex items-center gap-2">
                    <User size={16} /> Last Name
                  </label>
                  <input 
                    required
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm md:text-base"
                    placeholder="Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs md:text-sm font-semibold text-stone-800 flex items-center gap-2">
                    <User size={16} /> Middle Name (Optional)
                  </label>
                  <input 
                    type="text"
                    value={middleName}
                    onChange={e => setMiddleName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm md:text-base"
                    placeholder="Middle"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs md:text-sm font-semibold text-stone-800 flex items-center gap-2">
                    <Phone size={16} /> Phone Number
                  </label>
                  <div className="flex flex-col gap-2">
                    <select 
                      required
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all bg-white text-xs md:text-sm"
                    >
                      <option value="">Select Country Code</option>
                      {COUNTRY_DATA.map(c => (
                        <option key={`${c.name}-${c.code}`} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                    <input 
                      required
                      type="text"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm md:text-base"
                      placeholder="Phone Number (e.g. 1234567890)"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs md:text-sm font-semibold text-stone-800 flex items-center gap-2">
                    <Building2 size={16} /> Institution / Company
                  </label>
                  <input 
                    required
                    type="text"
                    value={institution}
                    onChange={e => setInstitution(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm md:text-base"
                    placeholder="University or Company Name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs md:text-sm font-semibold text-stone-800 flex items-center gap-2">
                    <Briefcase size={16} /> Role
                  </label>
                  <select 
                    required
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all bg-white text-sm md:text-base"
                  >
                    <option value="">Select Role</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs md:text-sm font-semibold text-stone-800 flex items-center gap-2">
                    <Globe size={16} /> Country
                  </label>
                  <select 
                    required
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all bg-white text-sm md:text-base"
                  >
                    <option value="">Select Country</option>
                    {COUNTRY_DATA.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="space-y-2">
            <label className="text-xs md:text-sm font-semibold text-stone-800 flex items-center gap-2">
              <Mail size={16} /> Email Address
            </label>
            <input 
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm md:text-base"
              placeholder="name@company.com"
            />
          </div>

          <div className={`grid grid-cols-1 ${isLogin || isForgotPassword ? '' : 'md:grid-cols-2'} gap-4`}>
            {!isForgotPassword && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs md:text-sm font-semibold text-stone-800 flex items-center gap-2">
                    <Lock size={16} /> Password
                  </label>
                  {isLogin && (
                    <button 
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-[10px] md:text-xs font-semibold text-amber-600 hover:text-amber-700"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <input 
                  required
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm md:text-base"
                  placeholder="••••••••"
                />
              </div>
            )}

            {!isLogin && !isForgotPassword && (
              <div className="space-y-2">
                <label className="text-xs md:text-sm font-semibold text-stone-800 flex items-center gap-2">
                  <Lock size={16} /> Confirm Password
                </label>
                <input 
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm md:text-base"
                  placeholder="••••••••"
                />
              </div>
            )}
          </div>

          <button 
            type="button"
            onClick={(e) => handleSubmit(e as any)}
            disabled={loading}
            className="w-full py-4 bg-stone-950 text-white font-bold rounded-xl hover:bg-amber-900 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-100 disabled:opacity-70 disabled:cursor-not-allowed text-sm md:text-base"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {isForgotPassword ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Create Account')}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>

        <div className="mt-10 pt-8 border-t border-stone-50 text-center">
          <p className="text-sm text-stone-600">
            {isForgotPassword ? (
              <>
                Remember your password? <button onClick={() => setIsForgotPassword(false)} className="font-bold text-stone-950 hover:text-amber-900">Sign in</button>
              </>
            ) : isLogin ? (
              <>
                Don't have an account? <button onClick={() => { setIsLogin(false); setIsForgotPassword(false); }} className="font-bold text-stone-950 hover:text-amber-900">Sign up</button>
              </>
            ) : (
              <>
                Already have an account? <button onClick={() => { setIsLogin(true); setIsForgotPassword(false); }} className="font-bold text-stone-950 hover:text-amber-900">Sign in</button>
              </>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
