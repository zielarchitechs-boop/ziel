import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  Layout, 
  Settings, 
  User, 
  LogOut, 
  Search, 
  FileText, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Plus, 
  Briefcase, 
  Edit3, 
  Check, 
  X, 
  Loader2,
  Mail,
  Building2,
  Calendar,
  Layers,
  TrendingUp,
  MoreHorizontal,
  Home,
  Bell,
  Menu,
  AlertCircle,
  UserCheck,
  Clock,
  Shield,
  RefreshCw,
  Trash2,
  Zap,
  Eye,
  Paperclip
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { uploadFileWithRetry } from '../lib/storage';
import { Project, Invoice, SERVICES, DisplayInvoice } from '../types';
import { Logo } from '../components/Logo';
import { InvoiceModal, ProjectDetailsModal } from '../components/Modals';
import { sendEmail, getEmailTemplate } from '../lib/email';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pendingAdmins, setPendingAdmins] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [completingProject, setCompletingProject] = useState<Project | null>(null);
  const [completedFiles, setCompletedFiles] = useState<File[]>([]);
  const [existingCompletedFiles, setExistingCompletedFiles] = useState<string[]>([]);
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<DisplayInvoice | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectSubTab, setProjectSubTab] = useState<'inactive' | 'pending' | 'active' | 'completed'>('active');
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

  const [isTestingApi, setIsTestingApi] = useState(false);

  const testApiConnection = async () => {
    setIsTestingApi(true);
    try {
      const response = await fetch('/api/test');
      const data = await response.json();
      if (response.ok) {
        alert(`API Connection Successful!\nServer Time: ${data.timestamp}\nConfig: ${JSON.stringify(data.env)}`);
      } else {
        alert(`API Connection Failed: ${response.status}\n${JSON.stringify(data)}`);
      }
    } catch (err: any) {
      alert(`Network Error: ${err.message}\nPlease check if the server is running.`);
    } finally {
      setIsTestingApi(false);
    }
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
        console.error('Admin Dashboard fetch timed out');
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

      // Fetch admin profile, projects, invoices, and pending admins
      const profilePromise = supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      const projectsPromise = supabase.from('projects').select('*').order('created_at', { ascending: false });
      const invoicesPromise = supabase.from('invoices').select('*').order('created_at', { ascending: false });
      const adminsPromise = supabase.from('profiles').select('*').eq('is_admin_pending', true);
      const allProfilesPromise = supabase.from('profiles').select('*');

      const [profileResponse, projectsResponse, invoicesResponse, adminsResponse, allProfilesResponse] = await Promise.allSettled([
        profilePromise,
        projectsPromise,
        invoicesPromise,
        adminsPromise,
        allProfilesPromise
      ]);

      // Handle Profile
      if (profileResponse.status === 'fulfilled') {
        const res = profileResponse.value;
        if (res.error) console.warn('Admin profile fetch error:', res.error.message);
        if (res.data) {
          setUserProfile(res.data);
          // Auto-repair admin status if email matches hardcoded admin
          if (res.data.email === 'studyguide.me001@gmail.com' && !res.data.is_admin) {
            console.log('Auto-repairing admin status in DB for', res.data.email);
            await supabase.from('profiles').update({ is_admin: true }).eq('id', res.data.id);
          }
        } else {
          setUserProfile({
            first_name: session.user.user_metadata?.first_name || 'Admin',
            last_name: session.user.user_metadata?.last_name || '',
            role: session.user.user_metadata?.role || 'Administrator'
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
      }

      // Handle Invoices
      if (invoicesResponse.status === 'fulfilled') {
        const res = invoicesResponse.value;
        if (res.error) console.warn('Invoices fetch error:', res.error.message);
        if (res.data) setInvoices(res.data);
      }

      // Handle Pending Admins
      if (adminsResponse.status === 'fulfilled') {
        const res = adminsResponse.value;
        if (res.error) console.warn('Pending admins fetch error:', res.error.message);
        if (res.data) setPendingAdmins(res.data);
      }

      // Handle All Profiles
      if (allProfilesResponse.status === 'fulfilled') {
        const res = allProfilesResponse.value;
        if (res.error) {
          console.error('All profiles fetch error:', res.error.message);
          setProfilesError(res.error.message);
        } else {
          setProfilesError(null);
        }
        
        if (res.data) {
          console.log('Fetched all profiles. Total count:', res.data.length);
          setAllClients(res.data);
        } else {
          console.log('No profiles found in database');
          setAllClients([]);
        }
      }

      if (!error) setError(null);
    } catch (err: any) {
      console.error('Admin Dashboard fetch error:', err.message);
      setError(err.message);
    } finally {
      isFinished = true;
      clearTimeout(timeoutId);
      if (isInitial) setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    fetchData(true);

    const projectsSubscription = supabase
      .channel('projects-changes-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchData(false))
      .subscribe();

    return () => {
      projectsSubscription.unsubscribe();
    };
  }, [fetchData]);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    navigate('/login');
  };

  const handleApprove = async (project: Project) => {
    try {
      setLoading(true);
      // Update project status
      const { error: projectError } = await supabase
        .from('projects')
        .update({ status: 'Pending' })
        .eq('id', project.id);

      if (projectError) throw projectError;

      // Generate invoice if not exists
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('*')
        .eq('project_id', project.id)
        .single();

      if (!existingInvoice) {
        const { error: invoiceError } = await supabase
          .from('invoices')
          .insert([{
            user_id: project.user_id,
            project_id: project.id,
            amount: project.quote_amount || 0,
            status: 'Unpaid',
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }]);
        if (invoiceError) throw invoiceError;
      }

      // Send Acceptance Email
      let client = allClients.find(c => c.id === project.user_id);
      
      // If client not in allClients, try to fetch directly
      if (!client) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', project.user_id).single();
        if (profile) client = profile;
      }

      if (client && client.email) {
        const emailContent = `
          <p>Dear ${client.first_name || 'Client'},</p>
          <p>We are pleased to inform you that your order for <strong>${project.name}</strong> has been confirmed. Thank you for choosing Ziel Architects!</p>
          <p>To activate your order and allow our experts to begin work, please proceed with the payment as per the agreed schedule. You can view your invoice and make secure payments directly through your dashboard.</p>
          <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin: 24px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Order Summary</p>
            <p style="margin: 0 0 8px 0;"><strong>Project:</strong> ${project.name}</p>
            <p style="margin: 0;"><strong>Total Amount:</strong> ${project.quote_currency} ${project.quote_amount?.toLocaleString()}</p>
          </div>
          <p>Once the initial payment is confirmed, your project status will move to 'In Progress'.</p>
          <div style="margin-top: 32px; text-align: center;">
            <a href="${window.location.origin}/dashboard" style="background-color: #d97706; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">View Dashboard & Pay</a>
          </div>
          <p style="margin-top: 32px;">We look forward to working with you!</p>
        `;
        await sendEmail(client.email, `Order Confirmed: ${project.name}`, getEmailTemplate('Order Confirmed', emailContent));
      }

      alert(`Project ${project.name} approved and invoice generated.`);
      fetchData();
    } catch (err: any) {
      console.error('Error approving project:', err.message);
      alert('Failed to approve project.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;
    
    try {
      setLoading(true);
      // Delete associated invoices first
      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('project_id', projectId);
      
      if (invoiceError) console.warn('Error deleting invoices:', invoiceError.message);

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
      
      if (error) throw error;
      
      alert('Order deleted successfully.');
      await fetchData();
    } catch (err: any) {
      console.error('Error deleting project:', err.message);
      alert('Failed to delete order.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllCompleted = async () => {
    const completedProjects = projects.filter(p => p.status === 'Completed');
    if (completedProjects.length === 0) {
      alert('No completed orders to remove.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete all ${completedProjects.length} completed orders? This action cannot be undone.`)) return;

    try {
      setLoading(true);
      const projectIds = completedProjects.map(p => p.id);

      // Delete associated invoices
      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .in('project_id', projectIds);
      
      if (invoiceError) console.warn('Error deleting invoices:', invoiceError.message);

      // Delete projects
      const { error } = await supabase
        .from('projects')
        .delete()
        .in('id', projectIds);
      
      if (error) throw error;
      
      alert('All completed orders deleted successfully.');
      await fetchData();
    } catch (err: any) {
      console.error('Error clearing completed projects:', err.message);
      alert('Failed to clear completed orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = (invoice: Invoice) => {
    const project = projects.find(p => p.id === invoice.project_id);
    if (!project) return;

    const displayInvoice: DisplayInvoice = {
      id: `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
      orderNumber: project.order_number || project.id.slice(0, 8).toUpperCase(),
      date: new Date(invoice.created_at).toLocaleDateString(),
      clientName: project.client_name?.trim() || 'N/A',
      clientEmail: allClients.find(c => c.id === invoice.user_id)?.email || 'N/A',
      services: [{ id: 'service-1', name: project.name, category: 'Other Services' }],
      totalAmount: invoice.amount,
      currency: project.quote_currency || 'USD',
      description: project.description || '',
      billingType: project.billing_type,
      specifications: project.specifications || []
    };
    setSelectedInvoice(displayInvoice);
  };

  const handleApproveAdmin = async (userId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: true, is_admin_pending: false })
        .eq('id', userId);
      if (error) throw error;
      alert('Admin approved successfully.');
      fetchData();
    } catch (err: any) {
      console.error('Error approving admin:', err.message);
      alert('Failed to approve admin.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (projectId: string) => {
    try {
      setLoading(true);
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'Paid' })
        .eq('project_id', projectId)
        .eq('status', 'Unpaid');

      if (invoiceError) throw invoiceError;

      const { error: projectError } = await supabase
        .from('projects')
        .update({ status: 'In Progress' })
        .eq('id', projectId);

      if (projectError) throw projectError;

      // Send Activation Email
      const project = projects.find(p => p.id === projectId);
      if (project) {
        const client = allClients.find(c => c.id === project.user_id);
        if (client && client.email) {
          const emailContent = `
            <p>Dear ${client.first_name || 'Client'},</p>
            <p>This is to confirm that we have successfully received your payment for project <strong>${project.name}</strong>. Thank you for your prompt action.</p>
            <p>Your project is now officially <strong>Active</strong> and our team has commenced work. We are committed to delivering high-quality results within the specified timeline.</p>
            <p>You can monitor the progress and communicate with our team through your client dashboard.</p>
            <div style="margin-top: 32px; text-align: center;">
              <a href="${window.location.origin}/dashboard" style="background-color: #059669; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">Track Progress</a>
            </div>
            <p style="margin-top: 32px;">Thank you for your continued trust in our services!</p>
          `;
          await sendEmail(client.email, `Payment Received: ${project.name}`, getEmailTemplate('Payment Received', emailContent));
        }

        // Send Notification to Admin
        const adminEmail = 'studyguide.me001@gmail.com';
        const adminEmailContent = `
          <p>Payment has been received for project <strong>${project.name}</strong>. The order has been activated and moved to 'In Progress'.</p>
          <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin: 24px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Project Details</p>
            <p style="margin: 0 0 8px 0;"><strong>Project:</strong> ${project.name}</p>
            <p style="margin: 0 0 8px 0;"><strong>Client:</strong> ${project.client_name}</p>
            <p style="margin: 0;"><strong>Amount:</strong> ${project.quote_currency} ${project.quote_amount?.toLocaleString()}</p>
          </div>
          <p>Please ensure the team is assigned and work has commenced.</p>
          <div style="margin-top: 32px; text-align: center;">
            <a href="${window.location.origin}/admin" style="background-color: #059669; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">Manage Project</a>
          </div>
        `;
        await sendEmail(adminEmail, `Order Activated: ${project.name}`, getEmailTemplate('Order Activated', adminEmailContent));
      }

      alert('Order marked as paid and activated.');
      fetchData();
    } catch (err: any) {
      console.error('Error marking as paid:', err.message);
      alert('Failed to mark as paid.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsComplete = async (projectId: string, completedFiles: File[], existingUrls: string[] = []) => {
    try {
      setLoading(true);
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const uploadedUrls: string[] = [...existingUrls];
      for (const file of completedFiles) {
        try {
          const publicUrl = await uploadFileWithRetry(file, project.user_id, 'completed');
          uploadedUrls.push(publicUrl);
        } catch (uploadErr: any) {
          console.error('Error uploading completed file:', file.name, uploadErr.message);
          // If one file fails, we might want to alert the user but continue or stop
          const proceed = window.confirm(`Failed to upload "${file.name}": ${uploadErr.message}. Would you like to proceed with completing the project without this file?`);
          if (!proceed) {
            throw new Error(`Upload failed for ${file.name}. Completion cancelled.`);
          }
        }
      }

      const { error: projectError } = await supabase
        .from('projects')
        .update({ 
          status: 'Completed',
          completed_files: uploadedUrls
        })
        .eq('id', projectId);

      if (projectError) throw projectError;

      // Send Completion Email
      const client = allClients.find(c => c.id === project.user_id);
      if (client && client.email) {
        const emailContent = `
          <p>Dear ${client.first_name || 'Client'},</p>
          <p>We are excited to inform you that your project <strong>${project.name}</strong> has been successfully completed!</p>
          <p>The final deliverables have been uploaded and are now available for download in your dashboard under the project details.</p>
          <p>We hope the results meet and exceed your expectations. It has been a pleasure working on this project with you.</p>
          <div style="margin-top: 32px; text-align: center;">
            <a href="${window.location.origin}/dashboard" style="background-color: #d97706; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">Download Files</a>
          </div>
          <p style="margin-top: 32px;">If you have any questions or require further assistance, please do not hesitate to reach out.</p>
          <p>Thank you for choosing Ziel Architects!</p>
        `;
        await sendEmail(client.email, `Project Completed: ${project.name}`, getEmailTemplate('Project Completed', emailContent));
      }

      alert('Project marked as completed and files uploaded.');
      fetchData();
    } catch (err: any) {
      console.error('Error marking as complete:', err.message);
      alert(`Failed to mark as complete: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    try {
      setLoading(true);

      // Upload new attachments if any
      const uploadedUrls: string[] = [...(editingProject.attachments || [])];
      for (const file of newAttachments) {
        try {
          const publicUrl = await uploadFileWithRetry(file, editingProject.user_id);
          uploadedUrls.push(publicUrl);
        } catch (uploadErr) {
          console.error('Upload failed for file:', file.name, uploadErr);
        }
      }

      const { error } = await supabase
        .from('projects')
        .update({
          name: editingProject.name,
          description: editingProject.description,
          deadline: editingProject.deadline,
          quote_amount: editingProject.quote_amount,
          quote_currency: editingProject.quote_currency,
          client_name: editingProject.client_name,
          specifications: editingProject.specifications,
          attachments: uploadedUrls
        })
        .eq('id', editingProject.id);

      if (error) throw error;

      // Update invoice if it exists
      await supabase
        .from('invoices')
        .update({ amount: editingProject.quote_amount })
        .eq('project_id', editingProject.id);

      setEditingProject(null);
      setNewAttachments([]);
      alert('Project updated successfully.');
      fetchData();
    } catch (err: any) {
      console.error('Error updating project:', err.message);
      alert('Failed to update project.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this profile? This action cannot be undone.')) return;
    try {
      setLoading(true);
      
      // Call server-side API to delete from auth AND profiles
      const apiUrl = '/api/delete-profile';
      console.log(`[Admin] Attempting to delete profile via ${apiUrl} for userId: ${userId} using method: DELETE`);
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      console.log(`[Admin] Delete profile response status: ${response.status} for userId: ${userId}`);

      let responseData: any = null;
      const responseText = await response.text();
      try {
        if (responseText) {
          responseData = JSON.parse(responseText);
        }
      } catch (e) {
        console.warn('Failed to parse response as JSON:', responseText);
      }

      if (!response.ok) {
        const errorMessage = responseData?.error || responseText || `Error ${response.status}`;
        const errorDetails = responseData?.details ? (typeof responseData.details === 'string' ? responseData.details : JSON.stringify(responseData.details)) : '';
        throw new Error(errorMessage + (errorDetails ? `: ${errorDetails}` : ''));
      }

      alert('Profile and authentication account deleted successfully.');
      fetchData();
    } catch (err: any) {
      console.error('Error deleting profile:', err.message);
      alert('Failed to delete profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUserByEmail = async () => {
    const email = window.prompt('Enter the email of the user you want to delete:');
    if (!email) return;
    
    if (!window.confirm(`Are you sure you want to delete user with email ${email}? This action cannot be undone.`)) return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/delete-user-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to delete user');
      }
    } catch (err: any) {
      console.error('Delete User By Email Error:', err);
      alert('Error deleting user: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getUrgentOrders = () => {
    const activeStatuses = ['In Progress', 'Pending', 'Awaiting Approval', 'Awaiting Acceptance'];
    return projects
      .filter(p => activeStatuses.includes(p.status) && p.deadline)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      .slice(0, 3);
  };

  const formatTimeRemaining = (deadline: string) => {
    const diff = new Date(deadline).getTime() - new Date().getTime();
    if (diff <= 0) return "Overdue";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return `${days}d ${hours}h`;
  };

  const stats = [
    { label: 'Total Projects', value: projects.length.toString(), icon: Layers, color: 'text-stone-950', bg: 'bg-stone-50' },
    { label: 'Awaiting Approval', value: projects.filter(p => p.status === 'Awaiting Approval' || p.status === 'Pending').length.toString(), icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Unpaid Invoices', value: invoices.filter(i => i.status === 'Unpaid').length.toString(), icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const isApprovedAdmin = userProfile?.is_admin || userProfile?.email === 'studyguide.me001@gmail.com';
  const isPendingAdmin = userProfile?.is_admin_pending || userProfile?.institution === 'Ziel Architects';

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
        <h2 className="text-2xl font-bold text-stone-950 mb-3">Admin Dashboard Error</h2>
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

  if (!isApprovedAdmin && isPendingAdmin) {
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
            { id: 'overview', label: 'Overview', icon: Layout },
            { id: 'projects', label: 'Projects', icon: Briefcase },
            { id: 'invoices', label: 'Invoices', icon: FileText },
            { id: 'approvals', label: 'User Approvals', icon: UserCheck, count: pendingAdmins.length },
            { id: 'clients', label: 'Clients', icon: User, count: allClients.filter(c => !c.is_admin).length },
            { id: 'users', label: 'Users', icon: Shield, count: allClients.filter(c => c.is_admin).length },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-white/10 text-amber-300 font-bold' 
                  : 'text-stone-100 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-4">
                <item.icon size={20} />
                {isSidebarOpen && <span>{item.label}</span>}
              </div>
              {isSidebarOpen && item.count !== undefined && item.count > 0 && (
                <span className="bg-amber-500 text-stone-950 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {item.count}
                </span>
              )}
            </button>
          ))}
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
        <header className="bg-white border-b border-stone-100 h-20 flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-stone-50 rounded-lg transition-colors text-stone-700">
              <Menu size={20} />
            </button>
            <h2 className="text-xl font-bold text-stone-950 capitalize">Admin Dashboard</h2>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={handleLogout}
              className="sm:hidden p-2 hover:bg-stone-50 rounded-lg transition-colors text-red-500"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-stone-100">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-stone-950">
                  {userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Loading...'}
                </p>
                <p className="text-xs text-stone-500">{userProfile?.role || 'Administrator'}</p>
              </div>
              <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center shadow-sm">
                <User size={20} className="text-stone-950" />
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-emerald-900">Website Overview</h1>
                  <p className="text-sm md:text-base text-sky-600">Global statistics and recent activity across the platform.</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={testApiConnection}
                    disabled={isTestingApi}
                    className="p-3 bg-white border border-sky-100 text-blue-600 rounded-xl hover:bg-blue-50 transition-all shadow-sm disabled:opacity-50"
                    title="Test API Connection"
                  >
                    <RefreshCw size={20} className={isTestingApi ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => fetchData(true)}
                    className="p-3 bg-white border border-sky-100 text-emerald-600 rounded-xl hover:bg-sky-50 transition-all shadow-sm"
                    title="Refresh Data"
                  >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-white p-4 md:p-6 rounded-3xl border border-sky-100 shadow-sm flex items-center gap-4 md:gap-6">
                    <div className={`w-12 h-12 md:w-14 md:h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                      <stat.icon size={24} className="md:w-7 md:h-7" />
                    </div>
                    <div>
                      <p className="text-[10px] md:text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className="text-xl md:text-2xl font-bold text-emerald-900">{stat.value}</p>
                    </div>
                  </div>
                ))}

                {/* Urgent Orders Card */}
                <div className="bg-white p-4 md:p-6 rounded-3xl border border-sky-100 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] md:text-xs font-bold text-sky-400 uppercase tracking-widest mb-3">Urgent Orders</p>
                  <div className="space-y-2">
                    {getUrgentOrders().map((order) => (
                      <div key={order.id} className="flex justify-between items-center gap-2">
                        <button 
                          onClick={() => setSelectedProject(order)}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors truncate"
                        >
                          #{order.order_number || order.id.slice(0, 8).toUpperCase()}
                        </button>
                        <span className="text-[10px] font-medium text-amber-600 whitespace-nowrap bg-amber-50 px-2 py-0.5 rounded-lg">
                          {formatTimeRemaining(order.deadline!)}
                        </span>
                      </div>
                    ))}
                    {getUrgentOrders().length === 0 && (
                      <p className="text-[10px] text-sky-300 italic">No urgent orders.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Projects Summary */}
                <div className="bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden">
                  <div className="p-4 md:p-6 border-b border-sky-50 flex justify-between items-center">
                    <h3 className="text-base md:text-lg font-bold text-emerald-900">Recent Projects</h3>
                    <button onClick={() => setActiveTab('projects')} className="text-xs md:text-sm font-bold text-emerald-600 hover:underline">View All</button>
                  </div>
                  <div className="p-0">
                    <div className="divide-y divide-sky-50">
                      {projects.slice(0, 5).map((project) => (
                        <div key={project.id} className="p-4 flex items-center justify-between hover:bg-sky-50/30 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600">
                              <Briefcase size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-emerald-900 text-sm break-words">{project.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">#{project.order_number || project.id.slice(0, 8).toUpperCase()}</span>
                                <span className="text-sky-200">•</span>
                                <p className="text-xs text-sky-400 break-words truncate max-w-[150px]">{project.client_name?.trim() || 'Unknown Client'}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setSelectedProject(project)}
                              className="opacity-0 group-hover:opacity-100 p-2 hover:bg-sky-100 rounded-lg transition-all text-sky-400"
                              title="Preview Order"
                            >
                              <Eye size={16} />
                            </button>
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap ${
                              project.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                              project.status === 'In Progress' ? 'bg-sky-100 text-sky-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {project.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {projects.length === 0 && (
                        <div className="p-8 text-center text-sky-400 italic">No projects yet.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Clients Summary */}
                <div className="bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-sky-50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-emerald-900">New Clients</h3>
                    <button onClick={() => setActiveTab('clients')} className="text-sm font-bold text-emerald-600 hover:underline">View All</button>
                  </div>
                  <div className="p-0">
                    <div className="divide-y divide-sky-50">
                      {allClients.filter(c => !c.is_admin).slice(0, 5).map((client) => (
                        <div key={client.id} className="p-4 flex items-center justify-between hover:bg-sky-50/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                              <User size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-emerald-900 text-sm truncate">{client.first_name} {client.last_name}</p>
                              <p className="text-xs text-sky-400 truncate">{client.email}</p>
                            </div>
                          </div>
                          <p className="text-xs text-sky-500 whitespace-nowrap">{client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      ))}
                      {allClients.filter(c => !c.is_admin).length === 0 && (
                        <div className="p-8 text-center text-sky-400 italic">No clients yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-emerald-900">Project Management</h1>
                  <p className="text-sky-600">Review, edit, and approve client orders.</p>
                </div>
                <div className="flex gap-3">
                  {projectSubTab === 'completed' && projects.some(p => p.status === 'Completed') && (
                    <button 
                      onClick={handleClearAllCompleted}
                      className="px-6 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-all flex items-center gap-2 border border-red-100"
                    >
                      <Trash2 size={20} /> Clear All Completed
                    </button>
                  )}
                  <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
                  >
                    <Plus size={20} /> Place Order for Client
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-sky-50 flex flex-col gap-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-emerald-900">All Orders</h3>
                    <div className="flex gap-2 p-1 bg-sky-50 rounded-2xl w-fit">
                      {[
                        { id: 'inactive', label: 'Inactive', count: projects.filter(p => p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance').length },
                        { id: 'pending', label: 'Pending', count: projects.filter(p => {
                          if (p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance') return false;
                          const projectInvoices = invoices.filter(inv => inv.project_id === p.id);
                          return projectInvoices.length === 0 || projectInvoices.some(inv => inv.status === 'Unpaid' || inv.status === 'Overdue');
                        }).length },
                        { id: 'active', label: 'Active', count: projects.filter(p => {
                          if (p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance' || p.status === 'Completed') return false;
                          const projectInvoices = invoices.filter(inv => inv.project_id === p.id);
                          return projectInvoices.length > 0 && projectInvoices.every(inv => inv.status === 'Paid');
                        }).length },
                        { id: 'completed', label: 'Completed', count: projects.filter(p => p.status === 'Completed').length }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setProjectSubTab(tab.id as any)}
                          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                            projectSubTab === tab.id 
                              ? 'bg-white text-emerald-600 shadow-sm' 
                              : 'text-sky-400 hover:text-emerald-600'
                          }`}
                        >
                          {tab.label}
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] ${
                            projectSubTab === tab.id ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-400'
                          }`}>
                            {tab.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-sky-50/50">
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest min-w-[200px]">Project</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest min-w-[150px]">Client Name</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Billing Type</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Quote</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-50">
                      {projects.filter(p => {
                        if (projectSubTab === 'inactive') return p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance';
                        if (projectSubTab === 'pending') {
                          if (p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance' || p.status === 'Completed') return false;
                          const projectInvoices = invoices.filter(inv => inv.project_id === p.id);
                          return projectInvoices.length === 0 || projectInvoices.some(inv => inv.status === 'Unpaid' || inv.status === 'Overdue');
                        }
                        if (projectSubTab === 'active') {
                          if (p.status === 'Inactive' || p.status === 'Awaiting Approval' || p.status === 'Awaiting Acceptance' || p.status === 'Completed') return false;
                          const projectInvoices = invoices.filter(inv => inv.project_id === p.id);
                          return projectInvoices.length > 0 && projectInvoices.every(inv => inv.status === 'Paid');
                        }
                        if (projectSubTab === 'completed') return p.status === 'Completed';
                        return true;
                      }).map((project) => {
                        const projectInvoices = invoices.filter(inv => inv.project_id === project.id);
                        const isUnpaid = projectInvoices.some(inv => inv.status === 'Unpaid' || inv.status === 'Overdue');

                        return (
                          <tr key={project.id} className="hover:bg-sky-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-start gap-2">
                                <p className="font-bold text-emerald-900 break-words max-w-[300px]">{project.name}</p>
                                {project.attachments && project.attachments.length > 0 && (
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-sky-50 text-sky-600 rounded-md text-[10px] font-bold mt-1" title={`${project.attachments.length} attachment(s)`}>
                                    <Paperclip size={10} /> {project.attachments.length}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">#{project.order_number || project.id.slice(0, 8).toUpperCase()}</span>
                                <span className="text-sky-200">•</span>
                                <p className="text-xs text-sky-400">{new Date(project.created_at).toLocaleDateString()}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-emerald-700 font-medium break-words max-w-[200px]">
                              <button 
                                onClick={() => {
                                  const client = allClients.find(c => c.id === project.user_id);
                                  if (client) {
                                    setSelectedClient(client);
                                    setActiveTab('clients');
                                  }
                                }}
                                className="hover:text-emerald-600 hover:underline text-left transition-all"
                              >
                                {project.client_name?.trim() || (() => {
                                  const client = allClients.find(c => c.id === project.user_id);
                                  return client ? `${client.first_name} ${client.last_name}` : 'N/A';
                                })()}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${project.billing_type === 'Institution' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {project.billing_type || 'Individual'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-emerald-900">
                              {project.quote_currency} {project.quote_amount}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest w-fit ${
                                  project.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                  project.status === 'In Progress' ? 'bg-sky-100 text-sky-700' :
                                  project.status === 'Awaiting Approval' ? 'bg-amber-100 text-amber-700' :
                                  project.status === 'Inactive' ? 'bg-red-100 text-red-700' :
                                  'bg-sky-50 text-sky-400'
                                }`}>
                                  {project.status}
                                </span>
                                {projectSubTab === 'pending' && isUnpaid && (
                                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                                    Unpaid
                                  </span>
                                )}
                                {projectSubTab === 'active' && projectInvoices.length > 0 && (
                                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                                    Paid
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                {projectSubTab === 'pending' && isUnpaid && (
                                  <button 
                                    onClick={() => handleMarkAsPaid(project.id)}
                                    className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors flex items-center gap-1"
                                    title="Mark as Paid"
                                  >
                                    <CheckCircle2 size={14} /> Mark as Paid
                                  </button>
                                )}
                                {(projectSubTab === 'active' || projectSubTab === 'completed') && (
                                  <button 
                                    onClick={() => {
                                      setCompletingProject(project);
                                      setExistingCompletedFiles(project.completed_files || []);
                                    }}
                                    className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1"
                                    title={project.status === 'Completed' ? 'Update Deliverables' : 'Mark as Complete'}
                                  >
                                    <CheckCircle2 size={14} /> {project.status === 'Completed' ? 'Update Files' : 'Complete'}
                                  </button>
                                )}
                                <button 
                                  onClick={() => setSelectedProject(project)}
                                  className="p-2 hover:bg-sky-100 rounded-lg transition-colors text-sky-600"
                                  title="Preview Order"
                                >
                                  <Eye size={18} />
                                </button>
                                <button 
                                  onClick={() => {
                                    const isPaid = projectInvoices.length > 0 && projectInvoices.every(inv => inv.status === 'Paid');
                                    if (isPaid) {
                                      alert('Paid orders cannot be edited.');
                                      return;
                                    }
                                    setEditingProject(project);
                                  }}
                                  className={`p-2 rounded-lg transition-colors ${
                                    projectInvoices.length > 0 && projectInvoices.every(inv => inv.status === 'Paid')
                                      ? 'text-gray-400 cursor-not-allowed'
                                      : 'hover:bg-sky-100 text-sky-600'
                                  }`}
                                  title={projectInvoices.length > 0 && projectInvoices.every(inv => inv.status === 'Paid') ? "Paid orders cannot be edited" : "Edit Order"}
                                >
                                  <Edit3 size={18} />
                                </button>
                                {(project.status === 'Pending' || project.status === 'Awaiting Approval' || project.status === 'Inactive') && (
                                  <button 
                                    onClick={() => handleApprove(project)}
                                    className="p-2 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-600"
                                    title="Approve & Generate Invoice"
                                  >
                                    <Check size={18} />
                                  </button>
                                )}
                                {(project.status === 'Inactive' || project.status === 'Pending' || project.status === 'Awaiting Approval' || project.status === 'Completed') && (
                                  <button 
                                    onClick={() => handleDeleteProject(project.id)}
                                    className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                                    title="Delete Order"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
                          <td colSpan={6} className="px-6 py-12 text-center text-sky-400">
                            No {projectSubTab} projects found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'approvals' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-emerald-900">Admin Approvals</h1>
                <p className="text-sky-600">Review and approve requests for administrator access.</p>
              </div>

              <div className="bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-sky-50/50">
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">User</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Institution</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Email</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-50">
                      {pendingAdmins.map((admin) => (
                        <tr key={admin.id} className="hover:bg-sky-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-emerald-900">{admin.first_name} {admin.last_name}</p>
                            <p className="text-xs text-sky-400">Joined {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : 'N/A'}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-emerald-700">{admin.institution}</td>
                          <td className="px-6 py-4 text-sm text-emerald-700">{admin.email}</td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleApproveAdmin(admin.id)}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 ml-auto"
                            >
                              <UserCheck size={18} /> Approve Admin
                            </button>
                          </td>
                        </tr>
                      ))}
                      {pendingAdmins.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-sky-400 italic">
                            No pending admin requests at this time.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-emerald-900">Invoices Management</h1>
                <p className="text-sky-600">Track and manage client billing.</p>
              </div>
              <div className="bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-sky-50/50">
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Invoice ID</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Client</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Amount</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-50">
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-sky-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-emerald-900">INV-{invoice.id.slice(0, 8).toUpperCase()}</p>
                            <p className="text-xs text-sky-400">{new Date(invoice.created_at).toLocaleDateString()}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-emerald-700 font-medium">
                            <button 
                              onClick={() => {
                                const project = projects.find(p => p.id === invoice.project_id);
                                const client = project ? allClients.find(c => c.id === project.user_id) : null;
                                if (client) {
                                  setSelectedClient(client);
                                  setActiveTab('clients');
                                }
                              }}
                              className="hover:text-emerald-600 hover:underline text-left transition-all"
                            >
                              {projects.find(p => p.id === invoice.project_id)?.client_name?.trim() || (() => {
                                const project = projects.find(p => p.id === invoice.project_id);
                                const client = project ? allClients.find(c => c.id === project.user_id) : null;
                                return client ? `${client.first_name} ${client.last_name}` : 'N/A';
                              })()}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-emerald-900">${invoice.amount}</td>
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
                              className="px-3 py-1 bg-sky-500 text-white rounded-lg text-xs font-bold hover:bg-sky-600 transition-colors"
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
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-emerald-900">Client Profiles</h1>
                  <p className="text-sky-600">View client details and their project history.</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={handleDeleteUserByEmail}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all flex items-center gap-2 border border-red-100"
                  >
                    <Trash2 size={18} /> Delete User by Email
                  </button>
                  {selectedClient && (
                    <button 
                      onClick={() => setSelectedClient(null)}
                      className="px-4 py-2 bg-sky-100 text-emerald-900 rounded-xl text-sm font-bold hover:bg-sky-200 transition-all flex items-center gap-2"
                    >
                      <ChevronLeft size={18} /> Back to List
                    </button>
                  )}
                </div>
              </div>

              {!selectedClient ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {profilesError && (
                    <div className="col-span-full p-6 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm flex items-center gap-3">
                      <AlertCircle size={20} />
                      <div>
                        <p className="font-bold">Database Access Error</p>
                        <p>{profilesError}. This is likely due to Row Level Security (RLS) policies. Please run the provided SQL script to grant admin permissions.</p>
                      </div>
                    </div>
                  )}
                  {allClients.filter(c => !c.is_admin).map((client) => {
                    const clientProjects = projects.filter(p => p.user_id === client.id);
                    return (
                      <motion.div 
                        key={client.id}
                        whileHover={{ y: -4 }}
                        className="bg-white p-6 rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
                      >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProfile(client.id);
                            }}
                            className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                            title="Delete Client"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div onClick={() => setSelectedClient(client)}>
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                              <User size={24} />
                            </div>
                            <div>
                              <h3 className="font-bold text-emerald-900">
                                {client.first_name} {client.middle_name ? `${client.middle_name} ` : ''}{client.last_name}
                              </h3>
                              <p className="text-xs text-sky-500">{client.email}</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-sky-600">
                              <Building2 size={16} />
                              <span>{client.institution || 'Individual'}</span>
                            </div>
                            <div className="flex items-center justify-between pt-4 border-t border-sky-50">
                              <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">Projects</span>
                              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                                {clientProjects.length}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {allClients.filter(c => !c.is_admin).length === 0 && (
                    <div className="col-span-full p-12 text-center text-sky-400 italic bg-white rounded-3xl border border-sky-100">
                      No client profiles found.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white p-8 rounded-3xl border border-sky-100 shadow-sm flex flex-col md:flex-row gap-8 items-start">
                    <div className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600">
                      <User size={48} />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h3 className="text-2xl font-bold text-emerald-900">
                            {selectedClient.first_name} {selectedClient.middle_name ? `${selectedClient.middle_name} ` : ''}{selectedClient.last_name}
                          </h3>
                          <p className="text-sky-600">{selectedClient.email}</p>
                          <div className="flex gap-4 mt-4">
                            <div className="px-3 py-1 bg-sky-50 text-sky-600 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                              {selectedClient.role || 'No Role'}
                            </div>
                            <div className="px-3 py-1 bg-sky-50 text-sky-600 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                              {selectedClient.country || 'No Country'}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-sky-50 rounded-2xl">
                            <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-1">Phone</p>
                            <p className="text-sm font-bold text-emerald-900">
                              {selectedClient.phone_code ? `${selectedClient.phone_code} ` : ''}{selectedClient.phone_number || 'N/A'}
                            </p>
                          </div>
                          <div className="p-4 bg-sky-50 rounded-2xl">
                            <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-1">Institution</p>
                            <p className="text-sm font-bold text-emerald-900">{selectedClient.institution || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-sky-50">
                      <h3 className="text-lg font-bold text-emerald-900">Project History</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-sky-50/50">
                            <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Project</th>
                            <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Amount</th>
                            <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Date</th>
                            <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sky-50">
                          {projects.filter(p => p.user_id === selectedClient.id).map((project) => (
                            <tr key={project.id} className="hover:bg-sky-50/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-start gap-2">
                                  <div>
                                    <p className="font-bold text-emerald-900">{project.name}</p>
                                    <p className="text-xs text-sky-400 truncate max-w-xs">{project.description}</p>
                                  </div>
                                  {project.attachments && project.attachments.length > 0 && (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-sky-50 text-sky-600 rounded-md text-[10px] font-bold mt-1" title={`${project.attachments.length} attachment(s)`}>
                                      <Paperclip size={10} /> {project.attachments.length}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-emerald-900">
                                {project.quote_currency} {project.quote_amount}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                  project.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                  project.status === 'In Progress' ? 'bg-sky-100 text-sky-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {project.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-sky-500">
                                {new Date(project.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => setSelectedProject(project)}
                                  className="p-2 hover:bg-sky-100 rounded-lg transition-colors text-sky-400"
                                  title="View Details"
                                >
                                  <Eye size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {projects.filter(p => p.user_id === selectedClient.id).length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-sky-400 italic">
                                No projects found for this client.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-emerald-900">Administrator Users</h1>
                <p className="text-sky-600">Manage platform administrators and their access.</p>
              </div>
              <div className="bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-sky-50/50">
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Admin</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Email</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest">Institution</th>
                        <th className="px-6 py-4 text-xs font-bold text-sky-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-50">
                      {profilesError && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8">
                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs flex items-center gap-3">
                              <AlertCircle size={16} />
                              <span>Error loading users: {profilesError}. Check RLS policies.</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {allClients.filter(c => c.is_admin).map((admin) => (
                        <tr key={admin.id} className="hover:bg-sky-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-emerald-900">{admin.first_name} {admin.last_name}</p>
                            <p className="text-xs text-sky-400">Joined {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : 'N/A'}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-emerald-700">{admin.email}</td>
                          <td className="px-6 py-4 text-sm text-emerald-700">{admin.institution}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => handleDeleteProfile(admin.id)}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500"
                                title="Delete Admin"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {allClients.filter(c => c.is_admin).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-sky-400 italic">
                            No administrator profiles found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-emerald-900">Admin Settings</h1>
                <p className="text-sky-600">Configure your administrative preferences.</p>
              </div>
              <div className="bg-white rounded-3xl border border-sky-100 shadow-sm p-12 text-center">
                <Settings size={48} className="mx-auto text-sky-200 mb-4" />
                <h3 className="text-xl font-bold text-emerald-900">System Settings</h3>
                <p className="text-sky-500">This feature is coming soon.</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-emerald-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
          >
            <div className="p-6 border-b border-sky-50 flex justify-between items-center bg-emerald-900 text-white">
              <h3 className="text-xl font-bold">Edit Project Order</h3>
              <button onClick={() => {
                setEditingProject(null);
                setNewAttachments([]);
              }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateProject} className="p-8 space-y-6 flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-emerald-800">Project Name</label>
                  <input 
                    type="text"
                    value={editingProject.name}
                    onChange={e => setEditingProject({...editingProject, name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-emerald-800">Client Name</label>
                  <input 
                    type="text"
                    value={editingProject.client_name || ''}
                    onChange={e => setEditingProject({...editingProject, client_name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-emerald-800">Description</label>
                <textarea 
                  rows={4}
                  value={editingProject.description || ''}
                  onChange={e => setEditingProject({...editingProject, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-emerald-800">Quote Amount</label>
                  <input 
                    type="number"
                    value={editingProject.quote_amount || 0}
                    onChange={e => setEditingProject({...editingProject, quote_amount: parseFloat(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-emerald-800">Currency</label>
                  <select 
                    value={editingProject.quote_currency || 'USD'}
                    onChange={e => setEditingProject({...editingProject, quote_currency: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="AUD">AUD</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-emerald-800">Deadline</label>
                <input 
                  type="date"
                  value={editingProject.deadline ? new Date(editingProject.deadline).toISOString().split('T')[0] : ''}
                  onChange={e => setEditingProject({...editingProject, deadline: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Attachments Section */}
              <div className="space-y-4 border-t border-sky-50 pt-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                    <Paperclip size={16} className="text-emerald-600" /> Attachments
                  </h4>
                  <label className="cursor-pointer px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1">
                    <Plus size={14} /> Add New
                    <input 
                      type="file" 
                      multiple 
                      className="hidden" 
                      onChange={e => {
                        if (e.target.files) {
                          setNewAttachments([...newAttachments, ...Array.from(e.target.files)]);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  {/* Existing Attachments */}
                  {(editingProject.attachments || []).map((url, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-sky-50 rounded-xl border border-sky-100">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Paperclip size={14} className="text-sky-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-emerald-900 truncate">Attachment {i + 1}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-sky-100 rounded-lg text-sky-600 transition-colors">
                          <Eye size={14} />
                        </a>
                        <button 
                          type="button" 
                          onClick={() => {
                            const newUrls = editingProject.attachments?.filter((_, index) => index !== i);
                            setEditingProject({...editingProject, attachments: newUrls});
                          }}
                          className="p-1.5 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* New Attachments */}
                  {newAttachments.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Paperclip size={14} className="text-emerald-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-emerald-900 truncate">{file.name}</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setNewAttachments(newAttachments.filter((_, index) => index !== i))}
                        className="p-1.5 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  {(editingProject.attachments || []).length === 0 && newAttachments.length === 0 && (
                    <p className="text-xs text-sky-400 italic text-center py-2">No attachments for this project.</p>
                  )}
                </div>
              </div>

              {/* Payment Plan (Specifications) */}
              <div className="space-y-4 border-t border-sky-50 pt-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                    <Zap size={16} className="text-amber-500" /> Payment Plan
                  </h4>
                  <button 
                    type="button"
                    onClick={() => {
                      const newSpec = {
                        id: crypto.randomUUID(),
                        type: 'Payment With Order' as const,
                        deadline: new Date().toISOString().split('T')[0],
                        amount: '0'
                      };
                      setEditingProject({
                        ...editingProject,
                        specifications: [...(editingProject.specifications || []), newSpec]
                      });
                    }}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Installment
                  </button>
                </div>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {(editingProject.specifications || []).map((spec, index) => (
                    <div key={spec.id} className="p-4 bg-sky-50 rounded-2xl border border-sky-100 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Installment {index + 1}</span>
                        <button 
                          type="button"
                          onClick={() => {
                            const newSpecs = editingProject.specifications?.filter(s => s.id !== spec.id);
                            setEditingProject({...editingProject, specifications: newSpecs});
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select 
                          value={spec.type}
                          onChange={e => {
                            const newSpecs = [...(editingProject.specifications || [])];
                            newSpecs[index] = {...spec, type: e.target.value as any};
                            setEditingProject({...editingProject, specifications: newSpecs});
                          }}
                          className="px-3 py-2 rounded-xl border border-sky-200 text-xs outline-none focus:ring-2 focus:ring-emerald-600"
                        >
                          <option value="Payment With Order">Payment With Order</option>
                          <option value="Payment of Partial Delivery">Payment of Partial Delivery</option>
                          <option value="Payment on Full Delivery">Payment on Full Delivery</option>
                        </select>
                        <input 
                          type="date"
                          value={spec.deadline ? new Date(spec.deadline).toISOString().split('T')[0] : ''}
                          onChange={e => {
                            const newSpecs = [...(editingProject.specifications || [])];
                            newSpecs[index] = {...spec, deadline: e.target.value};
                            setEditingProject({...editingProject, specifications: newSpecs});
                          }}
                          className="px-3 py-2 rounded-xl border border-sky-200 text-xs outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400 text-xs">{editingProject.quote_currency}</span>
                          <input 
                            type="number"
                            value={spec.amount}
                            onChange={e => {
                              const newSpecs = [...(editingProject.specifications || [])];
                              newSpecs[index] = {...spec, amount: e.target.value};
                              setEditingProject({...editingProject, specifications: newSpecs});
                            }}
                            className="w-full pl-10 pr-3 py-2 rounded-xl border border-sky-200 text-xs outline-none focus:ring-2 focus:ring-emerald-600"
                            placeholder="Amount"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(editingProject.specifications || []).length === 0 && (
                    <p className="text-xs text-sky-400 italic text-center py-4">No payment plan defined for this project.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => {
                  setEditingProject(null);
                  setNewAttachments([]);
                }} className="flex-1 py-4 bg-sky-100 text-emerald-900 font-bold rounded-xl hover:bg-sky-200 transition-all">Cancel</button>
                <button type="submit" disabled={loading} className="flex-[2] py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 className="animate-spin" size={20} />} Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Create Project Modal (Simplified for Admin) */}
      {isCreateModalOpen && (
        <AdminCreateOrderModal 
          isOpen={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)} 
        />
      )}

      <InvoiceModal 
        invoice={selectedInvoice} 
        onClose={() => setSelectedInvoice(null)} 
      />

      <ProjectDetailsModal 
        project={selectedProject} 
        onClose={() => setSelectedProject(null)} 
      />

      {completingProject && (
        <div className="fixed inset-0 z-[110] overflow-y-auto p-4 flex items-center justify-center bg-emerald-900/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-sky-100 flex justify-between items-center bg-sky-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-emerald-900">Mark as Complete</h2>
                  <p className="text-xs text-sky-500 uppercase tracking-widest font-semibold mt-1">Order #{completingProject.order_number || completingProject.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setCompletingProject(null);
                  setCompletedFiles([]);
                }} 
                className="p-2 hover:bg-sky-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">Upload Completed Files</h4>
                <div className="grid grid-cols-1 gap-3">
                  {/* Existing Files */}
                  {existingCompletedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-[9px] font-bold text-sky-400 uppercase tracking-widest">Existing Deliverables</h5>
                      {existingCompletedFiles.map((url, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                            <span className="text-xs font-bold text-emerald-900 truncate">Deliverable {i + 1}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors">
                              <Eye size={14} />
                            </a>
                            <button 
                              onClick={() => setExistingCompletedFiles(prev => prev.filter((_, idx) => idx !== i))}
                              className="p-1 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-sky-200 rounded-2xl hover:bg-sky-50 hover:border-emerald-400 transition-all cursor-pointer group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Plus className="w-8 h-8 text-sky-400 group-hover:text-emerald-600 mb-2" />
                      <p className="text-sm font-bold text-sky-600 group-hover:text-emerald-700">Click to upload final deliverables</p>
                      <p className="text-[10px] text-sky-400 mt-1">PDF, ZIP, DOCX, etc.</p>
                    </div>
                    <input 
                      type="file" 
                      multiple 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files) as File[];
                          const oversized = files.filter(f => f.size > MAX_FILE_SIZE);
                          if (oversized.length > 0) {
                            alert(`Some files exceed the 50MB limit: ${oversized.map(f => f.name).join(', ')}`);
                            return;
                          }
                          setCompletedFiles(prev => [...prev, ...files]);
                        }
                      }}
                    />
                  </label>

                  {completedFiles.length > 0 && (
                    <div className="space-y-2">
                      {completedFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-sky-50 rounded-xl border border-sky-100">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <Paperclip size={16} className="text-sky-400 flex-shrink-0" />
                            <span className="text-xs font-bold text-emerald-900 truncate">{file.name}</span>
                          </div>
                          <button 
                            onClick={() => setCompletedFiles(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-1 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-4">
                <AlertCircle className="text-amber-500 flex-shrink-0" size={20} />
                <p className="text-xs font-bold text-amber-800 leading-relaxed">
                  Marking this project as complete will notify the client and move it to the "Completed" status. Please ensure all final deliverables are attached.
                </p>
              </div>
            </div>

            <div className="p-6 bg-sky-50 border-t border-sky-100 flex gap-4">
              <button 
                onClick={() => {
                  setCompletingProject(null);
                  setCompletedFiles([]);
                }}
                className="flex-1 py-4 bg-white text-sky-600 font-black rounded-2xl border border-sky-200 hover:bg-sky-100 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  await handleMarkAsComplete(completingProject.id, completedFiles, existingCompletedFiles);
                  setCompletingProject(null);
                  setCompletedFiles([]);
                  setExistingCompletedFiles([]);
                }}
                disabled={loading}
                className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : completingProject.status === 'Completed' ? 'Update Deliverables' : 'Complete Project'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const AdminCreateOrderModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    userId: '',
    productType: '',
    projectName: '',
    description: '',
    quoteAmount: '',
    quoteCurrency: 'USD',
    billingType: 'Individual' as 'Individual' | 'Institution'
  });

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from('profiles').select('*');
      if (data) setClients(data);
    };
    fetchClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId) return;
    setLoading(true);
    try {
      const client = clients.find(c => c.id === formData.userId);
      const clientName = formData.billingType === 'Institution' ? client.institution : `${client.first_name} ${client.last_name}`;

      // Upload attachments if any
      const uploadedUrls: string[] = [];
      for (const file of attachments) {
        try {
          const publicUrl = await uploadFileWithRetry(file, formData.userId);
          uploadedUrls.push(publicUrl);
        } catch (uploadErr) {
          console.error('Upload failed for file:', file.name, uploadErr);
        }
      }

      const { error } = await supabase
        .from('projects')
        .insert([{
          user_id: formData.userId,
          name: formData.projectName,
          description: formData.description,
          quote_amount: parseFloat(formData.quoteAmount),
          quote_currency: formData.quoteCurrency,
          billing_type: formData.billingType,
          client_name: clientName,
          status: 'Awaiting Acceptance',
          attachments: uploadedUrls
        }]);

      if (error) throw error;
      alert('Order placed for client. They will need to accept it from their dashboard.');
      onClose();
    } catch (err: any) {
      console.error('Error creating order:', err.message);
      alert('Failed to place order.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-emerald-900/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-sky-50 flex justify-between items-center bg-emerald-900 text-white">
          <h3 className="text-xl font-bold">Place Order for Client</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6 flex-1 overflow-y-auto min-h-0">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-emerald-800">Select Client</label>
            <select 
              required
              value={formData.userId}
              onChange={e => setFormData({...formData, userId: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">Select a client</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-emerald-800">Product/Service</label>
              <select 
                required
                value={formData.productType}
                onChange={e => setFormData({...formData, productType: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="">Select Service</option>
                {SERVICES.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-emerald-800">Billing Type</label>
              <select 
                value={formData.billingType}
                onChange={e => setFormData({...formData, billingType: e.target.value as any})}
                className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="Individual">Individual</option>
                <option value="Institution">Institution</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-emerald-800">Project Name</label>
            <input 
              required
              type="text"
              value={formData.projectName}
              onChange={e => setFormData({...formData, projectName: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Enter project name..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-emerald-800">Description</label>
            <textarea 
              required
              rows={3}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-emerald-800">Quote Amount</label>
              <input 
                required
                type="number"
                value={formData.quoteAmount}
                onChange={e => setFormData({...formData, quoteAmount: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-emerald-800">Currency</label>
              <select 
                value={formData.quoteCurrency}
                onChange={e => setFormData({...formData, quoteCurrency: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-sky-200 outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-emerald-800">Attachments</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-emerald-700 rounded-lg text-xs font-bold border border-sky-100">
                  <Paperclip size={14} />
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-sky-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group">
              <input 
                type="file" 
                multiple 
                onChange={e => e.target.files && setAttachments(prev => [...prev, ...Array.from(e.target.files!)])}
                className="hidden" 
              />
              <Paperclip size={20} className="text-sky-400 group-hover:text-emerald-600" />
              <span className="text-sm font-bold text-sky-500 group-hover:text-emerald-700">Add Project Files</span>
            </label>
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-sky-100 text-emerald-900 font-bold rounded-xl hover:bg-sky-200 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-[2] py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
              {loading && <Loader2 className="animate-spin" size={20} />} Place Order
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
