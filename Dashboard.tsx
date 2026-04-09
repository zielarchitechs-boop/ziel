import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layout, 
  Settings, 
  User, 
  LogOut, 
  Search, 
  Globe, 
  Shield, 
  Zap, 
  FileText, 
  Mail, 
  CheckCircle2, 
  ChevronRight, 
  ArrowRight, 
  Printer, 
  Download,
  Menu,
  X,
  Building2,
  Calendar,
  Layers,
  Code,
  Database,
  ShoppingCart,
  Share2,
  TrendingUp,
  PenTool,
  Bell,
  MoreVertical,
  Plus,
  Clock,
  Briefcase,
  Activity,
  BarChart3,
  PieChart,
  MessageSquare,
  FileSearch,
  Cpu,
  Cloud,
  Lock,
  Eye,
  Trash2,
  Edit3,
  ExternalLink,
  Info,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
  MoreHorizontal,
  Home,
  Loader2,
  Paperclip
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Project, Invoice } from '../types';
import { Logo } from '../components/Logo';
import { OrderFormModal, InvoiceModal, ProjectDetailsModal } from '../components/Modals';

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectSubTab, setProjectSubTab] = useState<'inactive' | 'pending' | 'active'>('active');

  const ADMIN_EMAIL = 'studyguide.me001@gmail.com';

  const handleViewInvoice = (invoice: Invoice) => {
    const project = projects.find(p => p.id === invoice.project_id);
    if (!project) return;

    const displayInvoice = {
      id: `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
      orderNumber: project.order_number || project.id.slice(0, 8).toUpperCase(),
      date: new Date(invoice.created_at).toLocaleDateString(),
      clientName: project.client_name?.trim() || userProfile?.first_name + ' ' + userProfile?.last_name || 'N/A',
      clientEmail: userProfile?.email || 'N/A',
      services: [{ id: 'service-1', name: project.name, category: 'Other Services' }],
      totalAmount: invoice.amount,
      currency: project.quote_currency || 'USD',
      description: project.description || '',
      billingType: project.billing_type,
      specifications: project.specifications || []
    };
    setSelectedInvoice(displayInvoice);
  };

  const fetchData = useCallback(async (isInitial = false) => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Secrets.');
      setLoading(false);
      return;
    }

    let isFinished = false;
    const timeoutId = setTimeout(() => {
      if (isInitial && !isFinished) {
        console.error('Dashboard fetch timed out');
        setError('Data fetch is taking longer than usual. Please try refreshing the page.');
        setLoading(false);
      }
    }, 30000); // Increased to 30 seconds

    try {
      if (isInitial) setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      
      if (!session?.user) {
        isFinished = true;
        clearTimeout(timeoutId);
        setLoading(false);
        return;
      }

      setIsAdmin(session.user.email === ADMIN_EMAIL);

      // Fetch profile, projects, and invoices
      const profilePromise = supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      const projectsPromise = supabase.from('projects').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
      const invoicesPromise = supabase.from('invoices').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });

      const [profileResponse, projectsResponse, invoicesResponse] = await Promise.allSettled([
        profilePromise,
        projectsPromise,
        invoicesPromise
      ]);

      // Handle Profile
      if (profileResponse.status === 'fulfilled') {
        const res = profileResponse.value;
        if (res.error) console.warn('Profile fetch error:', res.error.message);
        if (res.data) {
          setUserProfile(res.data);
          if (res.data.is_admin) setIsAdmin(true);
        } else {
          setUserProfile({
            first_name: session.user.user_metadata?.first_name || 'User',
            last_name: session.user.user_metadata?.last_name || '',
            role: session.user.user_metadata?.role || 'User',
            institution: session.user.user_metadata?.institution || 'N/A'
          });
        }
      }

      // Handle Projects
      if (projectsResponse.status === 'fulfilled') {
        const res = projectsResponse.value;
        if (res.error) {
          console.error('Projects fetch error:', res.error.message);
          if (res.error.message.includes('schema cache')) {
            setError('Database tables are missing. Please ensure the SQL setup script has been run in Supabase.');
          } else {
            setError(res.error.message);
          }
        } else if (res.data) {
          setProjects(res.data);
        }
      } else {
        console.error('Projects fetch failed');
      }

      // Handle Invoices
      if (invoicesResponse.status === 'fulfilled') {
        const res = invoicesResponse.value;
        if (res.error) console.warn('Invoices fetch error:', res.error.message);
        if (res.data) {
          const fetchedProjects = projectsResponse.status === 'fulfilled' ? projectsResponse.value.data || [] : [];
          const filteredInvoices = res.data.filter(inv => {
            const project = fetchedProjects.find(p => p.id === inv.project_id);
            return project?.status !== 'Inactive';
          });
          setInvoices(filteredInvoices);
        }
      }

      if (!error) setError(null);
    } catch (err: any) {
      console.error('Dashboard fetch error:', err.message);
      setError(err.message);
    } finally {
      isFinished = true;
      clearTimeout(timeoutId);
      if (isInitial) setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (isAdmin) {
      navigate('/admin');
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    
    fetchData(true);

    // Subscribe to changes
    const projectsSubscription = supabase
      .channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchData(false))
      .subscribe();

    const invoicesSubscription = supabase
      .channel('invoices-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchData(false))
      .subscribe();

    return () => {
      projectsSubscription.unsubscribe();
      invoicesSubscription.unsubscribe();
    };
  }, [fetchData]);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    navigate('/login');
  };

  const handleOrderComplete = (invoice: any) => {
    setIsOrderModalOpen(false);
    setSelectedInvoice(invoice);
    fetchData();
  };

  const stats = [
    { 
      label: 'Active Projects', 
      value: projects.filter(p => p.status === 'In Progress' || p.status === 'Pending').length.toString(), 
      icon: Briefcase, 
      color: 'text-stone-950', 
      bg: 'bg-stone-50' 
    },
    { 
      label: 'Unpaid Invoices', 
      value: invoices.filter(i => {
        const project = projects.find(p => p.id === i.project_id);
        return i.status === 'Unpaid' && project?.status !== 'Inactive';
      }).length.toString(), 
      icon: FileText, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50' 
    },
    { 
      label: 'Total Projects', 
      value: projects.length.toString(), 
      icon: Layers, 
      color: 'text-stone-950', 
      bg: 'bg-stone-50' 
    },
    { 
      label: 'Total Revenue', 
      value: `${invoices.filter(i => i.status === 'Paid').reduce((acc, curr) => acc + Number(curr.amount), 0).toLocaleString()}`, 
      icon: TrendingUp, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50' 
    },
  ];

  const recentProjects = [
    { id: 'PRJ-001', name: 'Wellness Blueprint 2026', status: 'In Progress', client: 'HealthCorp', date: '2026-03-15' },
    { id: 'PRJ-002', name: 'E-commerce API Integration', status: 'Completed', client: 'ShopifyPlus', date: '2026-03-10' },
    { id: 'PRJ-003', name: 'SEO Strategy Audit', status: 'Pending', client: 'TechStart', date: '2026-03-18' },
    { id: 'PRJ-004', name: 'Pilot Proposal: AI Ethics', status: 'In Progress', client: 'UniResearch', date: '2026-03-12' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4 text-center">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-stone-950 mb-3">Dashboard Error</h2>
        <p className="text-stone-600 mb-8 max-w-md leading-relaxed">
          {error}
        </p>
        <button 
          onClick={() => fetchData(true)} 
          className="px-8 py-4 bg-stone-950 text-white rounded-2xl font-bold shadow-lg shadow-stone-950/20 hover:bg-amber-900 transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw size={20} /> Retry
        </button>
      </div>
    );
  }

  if (userProfile?.is_admin_pending) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Clock size={40} />
          </div>
          <h1 className="text-2xl font-bold text-stone-950 mb-4">Account Under Review</h1>
          <p className="text-stone-600 mb-8 leading-relaxed">
            Your request for administrator access is currently being reviewed by our team. 
            You will be notified once your account has been approved.
          </p>
          <div className="space-y-4">
            <div className="p-4 bg-stone-50 rounded-xl text-sm text-stone-700 font-medium">
              Institution: {userProfile?.institution || 'N/A'}
            </div>
            <button 
              onClick={handleLogout}
              className="w-full py-4 bg-stone-950 text-white font-bold rounded-xl hover:bg-amber-900 transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={20} /> Sign Out
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex text-stone-950 font-sans selection:bg-amber-600 selection:text-white">
      {/* Sidebar Overlay for Mobile */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : (isMobile ? 0 : 80),
          x: isMobile && !isSidebarOpen ? -280 : 0
        }}
        className={`bg-stone-950 text-white flex flex-col h-screen ${isMobile ? 'fixed left-0 top-0 z-50' : 'sticky top-0 z-50'} overflow-hidden transition-all`}
      >
        <div className="p-6 flex items-center justify-between">
          <Link to="/">
            <Logo light={true} hideText={!isSidebarOpen} />
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Home },
            { id: 'projects', label: 'Projects', icon: Briefcase },
            { id: 'invoices', label: 'Invoices', icon: FileText },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'messages', label: 'Messages', icon: MessageSquare },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-white/10 text-amber-300 font-bold' 
                  : 'text-stone-100 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
          
          {isAdmin && (
            <Link
              to="/admin"
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-amber-300 hover:bg-white/5 hover:text-amber-200"
            >
              <Shield size={20} />
              {isSidebarOpen && <span>Admin Dashboard</span>}
            </Link>
          )}
        </nav>

        <div className="p-4 mt-auto border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-stone-100 hover:bg-white/5 hover:text-white transition-all"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen bg-stone-50/30">
        {/* Header */}
        <header className="bg-white border-b border-stone-100 h-20 flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-stone-50 rounded-lg transition-colors text-stone-700"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-xl font-bold text-stone-950 capitalize">{activeTab}</h2>
          </div>

          <div className="flex items-center gap-6">
            <button 
              onClick={handleLogout}
              className="sm:hidden p-2 hover:bg-stone-50 rounded-lg transition-colors text-red-500"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="pl-10 pr-4 py-2 rounded-xl border border-stone-100 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all w-64 text-sm"
              />
            </div>
            <button className="relative p-2 hover:bg-stone-50 rounded-lg transition-colors text-stone-700">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full border-2 border-white" />
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-stone-100">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-stone-950">
                  {userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Loading...'}
                </p>
                <p className="text-xs text-stone-500">{userProfile?.role || 'User'}</p>
              </div>
              <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center shadow-sm">
                <User size={20} className="text-stone-950" />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8 space-y-8">
          {activeTab === 'overview' && (
            <>
              {/* Welcome Section */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-stone-950">
                    Good morning, {userProfile?.first_name || 'User'}
                  </h1>
                  <p className="text-sm md:text-base text-stone-600">Here's what's happening with your architectural projects today.</p>
                </div>
                <button 
                  onClick={() => setIsOrderModalOpen(true)}
                  className="w-full md:w-auto px-6 py-3 bg-stone-950 text-white font-bold rounded-xl hover:bg-amber-900 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-100 text-sm md:text-base"
                >
                  <Plus size={20} /> New Project
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white p-4 md:p-6 rounded-3xl border border-stone-100 shadow-sm flex items-center gap-4 md:gap-6"
                  >
                    <div className={`w-12 h-12 md:w-14 md:h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                      <stat.icon size={24} className="md:w-7 md:h-7" />
                    </div>
                    <div>
                      <p className="text-[10px] md:text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className="text-xl md:text-2xl font-bold text-stone-950">{stat.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Main Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Projects Table */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
                  <div className="p-4 md:p-6 border-b border-stone-50 flex justify-between items-center">
                    <h3 className="text-base md:text-lg font-bold text-stone-950">Recent Projects</h3>
                    <button 
                      onClick={() => setActiveTab('projects')}
                      className="text-xs md:text-sm font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                    >
                      View All <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-stone-50/50">
                          <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest min-w-[200px]">Project Name</th>
                          <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest min-w-[150px]">Client</th>
                          <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Status</th>
                          <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {projects.slice(0, 5).map((project) => (
                          <tr key={project.id} className="hover:bg-stone-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-start gap-2">
                                <p className="font-bold text-stone-950 break-words max-w-[300px]">{project.name}</p>
                                {project.attachments && project.attachments.length > 0 && (
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-stone-50 text-stone-600 rounded-md text-[10px] font-bold mt-1" title={`${project.attachments.length} attachment(s)`}>
                                    <Paperclip size={10} /> {project.attachments.length}
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-stone-400">{project.id.slice(0, 8).toUpperCase()}</p>
                            </td>
                            <td className="px-6 py-4 text-sm text-stone-700 break-words max-w-[200px]">
                              {project.client_name?.trim() || (userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'N/A')}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                project.status === 'Completed' ? 'bg-stone-100 text-stone-700' :
                                project.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                                project.status === 'Awaiting Acceptance' ? 'bg-amber-50 text-amber-600 animate-pulse' :
                                project.status === 'Inactive' ? 'bg-red-100 text-red-700' :
                                'bg-amber-50 text-amber-600'
                              }`}>
                                {project.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                              {project.status === 'Awaiting Acceptance' ? (
                                <button 
                                  onClick={async () => {
                                    const { error } = await supabase
                                      .from('projects')
                                      .update({ status: 'Awaiting Approval' })
                                      .eq('id', project.id);
                                    if (!error) {
                                      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: 'Awaiting Approval' } : p));
                                    }
                                  }}
                                  className="px-3 py-1 bg-stone-950 text-white rounded-lg text-xs font-bold hover:bg-amber-900 transition-colors"
                                >
                                  Accept
                                </button>
                              ) : (
                                <button 
                                  onClick={() => setSelectedProject(project)}
                                  className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
                                  title="View Details"
                                >
                                  <Eye size={18} />
                                </button>
                              )}
                              <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400">
                                <MoreHorizontal size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {projects.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-stone-400">
                              No projects found. Start by creating a new one!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sidebar Widgets */}
                <div className="space-y-8">
                  {/* Activity Feed */}
                  <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-stone-950 mb-6">Recent Activity</h3>
                    <div className="space-y-6">
                      {[
                        { text: 'Invoice INV-8273 paid', time: '2 hours ago', icon: CheckCircle2, color: 'text-stone-950' },
                        { text: 'New message from Client', time: '5 hours ago', icon: MessageSquare, color: 'text-amber-600' },
                        { text: 'Project audit completed', time: 'Yesterday', icon: Shield, color: 'text-stone-950' },
                        { text: 'New service order received', time: '2 days ago', icon: ShoppingCart, color: 'text-amber-600' },
                      ].map((activity, i) => (
                        <div key={i} className="flex gap-4">
                          <div className={`mt-1 ${activity.color}`}>
                            <activity.icon size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-stone-950">{activity.text}</p>
                            <p className="text-xs text-stone-400">{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-stone-950 rounded-3xl p-6 text-white">
                    <h3 className="text-lg font-bold mb-4">Quick Support</h3>
                    <p className="text-stone-100 text-sm mb-6 leading-relaxed">Need help with your architectural design or construction project? Our experts are available 24/7.</p>
                    <a 
                      href="mailto:support@ziel-architects.com"
                      className="w-full py-3 bg-amber-500 text-stone-950 font-bold rounded-xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
                    >
                      <MessageSquare size={18} /> Chat with Expert
                    </a>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'projects' && (
            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-stone-50 flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-stone-950">All Projects</h3>
                  <button 
                    onClick={() => setIsOrderModalOpen(true)}
                    className="px-4 py-2 bg-stone-950 text-white rounded-xl text-sm font-bold hover:bg-amber-900 transition-all flex items-center gap-2"
                  >
                    <Plus size={18} /> New Project
                  </button>
                </div>
                
                <div className="flex gap-2 p-1 bg-stone-50 rounded-2xl w-fit">
                  {[
                    { id: 'inactive', label: 'Inactive', count: projects.filter(p => p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance').length },
                    { id: 'pending', label: 'Pending', count: projects.filter(p => {
                      if (p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance') return false;
                      const projectInvoices = invoices.filter(inv => inv.project_id === p.id);
                      return projectInvoices.length === 0 || projectInvoices.some(inv => inv.status === 'Unpaid' || inv.status === 'Overdue');
                    }).length },
                    { id: 'active', label: 'Active', count: projects.filter(p => {
                      if (p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance') return false;
                      const projectInvoices = invoices.filter(inv => inv.project_id === p.id);
                      return projectInvoices.length > 0 && projectInvoices.every(inv => inv.status === 'Paid');
                    }).length }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setProjectSubTab(tab.id as any)}
                      className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                        projectSubTab === tab.id 
                          ? 'bg-white text-stone-950 shadow-sm' 
                          : 'text-stone-400 hover:text-stone-950'
                      }`}
                    >
                      {tab.label}
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] ${
                        projectSubTab === tab.id ? 'bg-amber-100 text-stone-950' : 'bg-stone-100 text-stone-400'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-stone-50/50">
                      <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Project Name</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Description</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                        {projects.filter(p => {
                          if (projectSubTab === 'inactive') {
                            return p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance';
                          }
                          if (projectSubTab === 'pending') {
                            if (p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance') return false;
                            const projectInvoices = invoices.filter(inv => inv.project_id === p.id);
                            return projectInvoices.length === 0 || projectInvoices.some(inv => inv.status === 'Unpaid' || inv.status === 'Overdue');
                          }
                          if (projectSubTab === 'active') {
                            if (p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance') return false;
                            const projectInvoices = invoices.filter(inv => inv.project_id === p.id);
                            return projectInvoices.length > 0 && projectInvoices.every(inv => inv.status === 'Paid');
                          }
                          return true;
                        }).map((project) => (
                          <tr key={project.id} className="hover:bg-stone-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-stone-950">{project.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">#{project.order_number || project.id.slice(0, 8).toUpperCase()}</span>
                                <span className="text-stone-200">•</span>
                                <p className="text-xs text-stone-400">{new Date(project.created_at).toLocaleDateString()}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-stone-700 max-w-xs truncate">{project.description}</td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                project.status === 'Completed' ? 'bg-stone-100 text-stone-700' :
                                project.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                                project.status === 'Inactive' ? 'bg-red-100 text-red-700' :
                                'bg-amber-50 text-amber-600'
                              }`}>
                                {project.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                              <button 
                                onClick={() => setSelectedProject(project)}
                                className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
                                title="Preview Order"
                              >
                                <Eye size={18} />
                              </button>
                              <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400">
                                <MoreHorizontal size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    {projects.filter(p => {
                      if (projectSubTab === 'inactive') return p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance';
                      if (projectSubTab === 'pending') {
                        if (p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance') return false;
                        const projectInvoices = invoices.filter(inv => inv.project_id === p.id);
                        return projectInvoices.length === 0 || projectInvoices.some(inv => inv.status === 'Unpaid' || inv.status === 'Overdue');
                      }
                      if (projectSubTab === 'active') {
                        if (p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance') return false;
                        const projectInvoices = invoices.filter(inv => inv.project_id === p.id);
                        return projectInvoices.length > 0 && projectInvoices.every(inv => inv.status === 'Paid');
                      }
                      return true;
                    }).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-stone-400">
                          No {projectSubTab} projects found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-stone-50">
                <h3 className="text-lg font-bold text-stone-950">Your Invoices</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-stone-50/50">
                      <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Invoice ID</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Due Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {invoices.filter(inv => {
                      const project = projects.find(p => p.id === inv.project_id);
                      return project?.status !== 'Inactive';
                    }).map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-sky-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-emerald-900">INV-{invoice.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-xs text-sky-400">{new Date(invoice.created_at).toLocaleDateString()}</p>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-emerald-900">${invoice.amount}</td>
                        <td className="px-6 py-4 text-sm text-emerald-700">{new Date(invoice.due_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleViewInvoice(invoice)}
                            className="px-3 py-1 bg-sky-400 text-white rounded-lg text-xs font-bold hover:bg-sky-500 transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {invoices.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-sky-400">
                          No invoices found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-3xl border border-sky-100 shadow-sm p-8">
              <h3 className="text-xl font-bold text-emerald-900 mb-6">Account Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-sky-400 uppercase tracking-widest block mb-2">First Name</label>
                    <input 
                      type="text" 
                      readOnly 
                      value={userProfile?.first_name || ''} 
                      className="w-full px-4 py-3 rounded-xl border border-sky-100 bg-sky-50/50 text-emerald-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-sky-400 uppercase tracking-widest block mb-2">Last Name</label>
                    <input 
                      type="text" 
                      readOnly 
                      value={userProfile?.last_name || ''} 
                      className="w-full px-4 py-3 rounded-xl border border-sky-100 bg-sky-50/50 text-emerald-900 outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-sky-400 uppercase tracking-widest block mb-2">Email Address</label>
                    <input 
                      type="email" 
                      readOnly 
                      value={userProfile?.email || ''} 
                      className="w-full px-4 py-3 rounded-xl border border-sky-100 bg-sky-50/50 text-emerald-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-sky-400 uppercase tracking-widest block mb-2">Institution</label>
                    <input 
                      type="text" 
                      readOnly 
                      value={userProfile?.institution || ''} 
                      className="w-full px-4 py-3 rounded-xl border border-sky-100 bg-sky-50/50 text-emerald-900 outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-sky-50">
                <button 
                  onClick={() => alert('Profile editing coming soon!')}
                  className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <OrderFormModal 
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onOrderComplete={handleOrderComplete}
      />

      <AnimatePresence>
        {selectedProject && (
          <ProjectDetailsModal 
            project={selectedProject} 
            onClose={() => setSelectedProject(null)} 
          />
        )}
        {selectedInvoice && (
          <InvoiceModal 
            invoice={selectedInvoice} 
            onClose={() => setSelectedInvoice(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
