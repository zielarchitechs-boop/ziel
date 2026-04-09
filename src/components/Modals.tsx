import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Mail, Building2, ChevronRight, FileText, Code, TrendingUp, Settings, Calendar, CheckCircle2, Loader2, Printer, Shield, Plus, Trash2, Paperclip, Phone, Globe, Briefcase, ExternalLink, Download } from 'lucide-react';
import { SERVICES, ServiceItem, ServiceCategory, OrderForm, DisplayInvoice, Project } from '../types';
import { supabase } from '../lib/supabase';
import { uploadFileWithRetry, MAX_FILE_SIZE } from '../lib/storage';
import { sendEmail, getEmailTemplate } from '../lib/email';
import { COUNTRY_DATA, ROLES, PHONE_CODES } from '../constants';

export const OrderFormModal = ({ isOpen, onClose, onOrderComplete }: { isOpen: boolean, onClose: () => void, onOrderComplete: (invoice: DisplayInvoice) => void }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [formData, setFormData] = useState<OrderForm>({
    category: '',
    productType: '',
    projectName: '',
    description: '',
    deliveryMode: 'Single Delivery',
    deadline: '',
    quoteAmount: '',
    quoteCurrency: 'USD',
    specifications: [],
    subtasks: [],
    accountType: 'Returning User',
    billingType: 'Individual',
    firstName: '',
    lastName: '',
    middleName: '',
    countryCode: '+1',
    phoneNumber: '',
    institution: '',
    role: '',
    country: '',
    clientEmail: '',
    password: '',
    confirmPassword: ''
  });

  const categories = ['Architectural Design', 'Technical & Compliance', 'Project Management', 'Other Services'];

  const getProductTypes = (category: string) => {
    return SERVICES.filter(s => s.category === category).map(s => s.name);
  };

  const addSubtask = () => {
    setFormData(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, { id: Math.random().toString(36).substr(2, 9), title: '', deadline: '' }]
    }));
  };

  useEffect(() => {
    if (isOpen) {
      const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsLoggedIn(true);
          setFormData(prev => ({ ...prev, accountType: 'Returning User', clientEmail: session.user.email || '' }));
          
          // Fetch profile to pre-fill name and institution
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, institution')
            .eq('id', session.user.id)
            .maybeSingle();
          
          if (profile) {
            setFormData(prev => ({
              ...prev,
              firstName: profile.first_name || '',
              lastName: profile.last_name || '',
              institution: profile.institution || '',
              billingType: profile.institution ? 'Institution' : 'Individual'
            }));
          }
        } else {
          setIsLoggedIn(false);
          setFormData(prev => ({ ...prev, accountType: 'Returning User' }));
        }
      };
      checkSession();
    }
  }, [isOpen]);

  const removeSubtask = (id: string) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter(s => s.id !== id)
    }));
  };

  const updateSubtask = (id: string, field: 'title' | 'deadline', value: string) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  const addSpecification = () => {
    if (formData.specifications.length >= 7) return;
    setFormData(prev => ({
      ...prev,
      specifications: [...prev.specifications, { id: Math.random().toString(36).substr(2, 9), type: 'Payment With Order', deadline: '', amount: '' }]
    }));
  };

  const removeSpecification = (id: string) => {
    setFormData(prev => ({
      ...prev,
      specifications: prev.specifications.filter(i => i.id !== id)
    }));
  };

  const updateSpecification = (id: string, field: 'type' | 'deadline' | 'amount', value: string) => {
    setFormData(prev => ({
      ...prev,
      specifications: prev.specifications.map(i => i.id === id ? { ...i, [field]: value } : i)
    }));
  };

  const minDate = new Date().toISOString().slice(0, 16);
  const isPastDate = (dateString: string) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  const totalSpecifications = formData.specifications.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const quoteAmount = parseFloat(formData.quoteAmount) || 0;
  const isSpecificationsValid = formData.specifications.length === 0 || Math.abs(totalSpecifications - quoteAmount) < 0.01;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      const validFiles = newFiles.filter(file => {
        if (file.size > MAX_FILE_SIZE) {
          alert(`File "${file.name}" exceeds the 50MB limit.`);
          return false;
        }
        return true;
      });
      setAttachments(prev => [...prev, ...validFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let userId: string | undefined;
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      const { data: { user: verifiedUser } } = await supabase.auth.getUser();

      if (verifiedUser) {
        userId = verifiedUser.id;
      } else if (formData.clientEmail && formData.password) {
        // Try to sign in if we have credentials (for non-logged in users)
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: formData.clientEmail,
          password: formData.password
        });
        if (authError) throw authError;
        userId = authData.user?.id;
      } else {
        // If we thought we were logged in but session is gone
        if (isLoggedIn) {
          throw new Error('Your session has expired. Please refresh the page and sign in again to place an order.');
        } else {
          throw new Error('Please provide your email and password to place an order.');
        }
      }

      if (!userId) {
        throw new Error('User authentication failed. Please try logging in again.');
      }

      // Update profile with institution if needed BEFORE upload
      // This ensures RLS policies that might check the profile have the latest data
      if (formData.billingType === 'Institution' && formData.institution) {
        try {
          await supabase
            .from('profiles')
            .update({ institution: formData.institution })
            .eq('id', userId);
        } catch (err) {
          console.warn('Failed to update profile institution:', err);
          // We don't throw here to avoid blocking the order if profile update fails
        }
      }

      // Validate file sizes before starting
      for (const file of attachments) {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`File "${file.name}" exceeds the 50MB size limit.`);
        }
      }

      // Upload attachments if any
      const uploadedUrls: string[] = [];
      if (attachments.length > 0) {
        setUploadProgress({ current: 0, total: attachments.length });
        for (let i = 0; i < attachments.length; i++) {
          const file = attachments[i];
          try {
            const publicUrl = await uploadFileWithRetry(file, userId!);
            uploadedUrls.push(publicUrl);
            setUploadProgress({ current: i + 1, total: attachments.length });
          } catch (uploadErr: any) {
            console.error('Upload failed for file:', file.name, uploadErr);
            const proceed = window.confirm(`Failed to upload "${file.name}": ${uploadErr.message}. Would you like to proceed with the order without this file?`);
            if (!proceed) {
              throw new Error(`Upload failed for ${file.name}. Order submission cancelled.`);
            }
          }
        }
        setUploadProgress(null);
      }

      const totalAmount = parseFloat(formData.quoteAmount) || 0; 
      const subtasksText = formData.deliveryMode === 'Scheduled Delivery' 
        ? '\n\nSubtasks:\n' + formData.subtasks.map(s => `- ${s.title}: ${s.deadline}`).join('\n')
        : '';
      
      const specificationsText = formData.specifications.length > 0
        ? '\n\nSpecifications:\n' + formData.specifications.map((p, i) => `Specification ${i+1}: ${p.type} - ${formData.quoteCurrency} ${p.amount} on ${p.deadline}`).join('\n')
        : '';

      const fullDescription = formData.description + subtasksText + specificationsText;

      let clientName = '';
      
      if (formData.billingType === 'Institution') {
        clientName = formData.institution;
      } else {
        // Try to get name from form data first (for new users)
        if (formData.firstName && formData.lastName) {
          clientName = `${formData.firstName} ${formData.lastName}`.trim();
        } 
        // Then try metadata if user is already logged in
        else if (existingSession?.user?.user_metadata?.first_name) {
          const meta = existingSession.user.user_metadata;
          clientName = `${meta.first_name} ${meta.last_name || ''}`.trim();
        }
        else if (existingSession?.user?.user_metadata?.full_name) {
          clientName = existingSession.user.user_metadata.full_name;
        }
      }

      // If clientName is still empty, fetch from profile (crucial for returning users)
      if (!clientName.trim() && userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, institution')
          .eq('id', userId)
          .single();
        
        if (profile) {
          if (formData.billingType === 'Institution' && profile.institution) {
            clientName = profile.institution;
          } else if (profile.first_name) {
            clientName = `${profile.first_name} ${profile.last_name || ''}`.trim();
          }
        }
      }

      // Final fallback
      if (!clientName.trim()) {
        clientName = formData.clientEmail || 'Valued Client';
      }

      // Create project
      const projectId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const { error: projectError } = await supabase
        .from('projects')
        .insert([{
          id: projectId,
          created_at: createdAt,
          user_id: userId,
          name: formData.projectName,
          description: fullDescription,
          client_name: clientName,
          deadline: formData.deliveryMode === 'Single Delivery' ? formData.deadline : null,
          status: 'Awaiting Approval',
          billing_type: formData.billingType,
          quote_amount: totalAmount,
          quote_currency: formData.quoteCurrency,
          attachments: uploadedUrls,
          specifications: formData.specifications
        }]);

      if (projectError) throw projectError;

      // Send Email Notification to Admin
      const adminEmail = 'studyguide.me001@gmail.com';
      const adminEmailContent = `
        <p>A new order has been submitted and is awaiting approval.</p>
        <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin: 24px 0; border: 1px solid #e2e8f0;">
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Order Details</p>
          <p style="margin: 0 0 8px 0;"><strong>Project Name:</strong> ${formData.projectName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Client Name:</strong> ${clientName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Client Email:</strong> ${formData.clientEmail || existingSession?.user?.email || 'N/A'}</p>
          <p style="margin: 0 0 8px 0;"><strong>Quote:</strong> ${formData.quoteCurrency} ${totalAmount.toLocaleString()}</p>
          <p style="margin: 0;"><strong>Service Type:</strong> ${formData.productType}</p>
        </div>
        <p>Please log in to the Admin Dashboard to review and approve this order.</p>
        <div style="margin-top: 32px; text-align: center;">
          <a href="${window.location.origin}/admin" style="background-color: #d97706; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">Review Order</a>
        </div>
      `;
      await sendEmail(adminEmail, `New Order Submitted: ${formData.projectName}`, getEmailTemplate('New Order Submitted', adminEmailContent));

      onOrderComplete({
        id: `ORD-${projectId.slice(0, 8).toUpperCase()}`,
        date: new Date(createdAt).toLocaleDateString(),
        clientName: clientName,
        clientEmail: formData.clientEmail || existingSession?.user?.email || '',
        services: SERVICES.filter(s => s.name === formData.productType),
        totalAmount: totalAmount,
        currency: formData.quoteCurrency,
        specifications: formData.specifications,
        billingType: formData.billingType
      });

      onClose();
      setStep(1);
      setFormData({
        category: '',
        productType: '',
        projectName: '',
        description: '',
        deliveryMode: 'Single Delivery',
        deadline: '',
        quoteAmount: '',
        quoteCurrency: 'USD',
        specifications: [],
        subtasks: [],
        accountType: 'Returning User',
        billingType: 'Individual',
        firstName: '',
        lastName: '',
        middleName: '',
        countryCode: '+1',
        phoneNumber: '',
        institution: '',
        role: '',
        country: '',
        clientEmail: '',
        password: '',
        confirmPassword: ''
      });
      setAttachments([]);
    } catch (err: any) {
      console.error('Error submitting order:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const isAccountInfoValid = () => {
    if (formData.billingType === 'Institution' && !formData.institution) return false;
    if (isLoggedIn) return true;
    return formData.clientEmail && formData.password;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] p-4 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
      >
        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
          <div>
            <h2 className="text-xl font-bold text-stone-950">Service Order Form</h2>
            <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold mt-1">Step {step} of 5</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 p-8">
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-stone-800">Product/Service Category <span className="text-red-500">*</span></label>
                <select 
                  required
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value, productType: ''})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {formData.category && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-stone-800">Product Type <span className="text-red-500">*</span></label>
                  <select 
                    required
                    value={formData.productType}
                    onChange={e => setFormData({...formData, productType: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all"
                  >
                    <option value="">Select Product Type</option>
                    {getProductTypes(formData.category).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
              <div className="pt-4">
                <button 
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!formData.category || !formData.productType}
                  className="w-full py-4 bg-stone-950 text-white font-bold rounded-xl hover:bg-amber-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Next: Project Details <ChevronRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-stone-800">Project Name <span className="text-red-500">*</span></label>
                <input 
                  required
                  type="text"
                  value={formData.projectName}
                  onChange={e => setFormData({...formData, projectName: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all"
                  placeholder="Enter a descriptive name for your project..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-stone-800">Description <span className="text-red-500">*</span></label>
                <textarea 
                  required
                  rows={5}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all resize-none"
                  placeholder="Please provide specific details about your project..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-stone-800 flex items-center gap-2">
                  <FileText size={16} /> Additional Materials (Optional)
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 cursor-pointer">
                    <div className="px-4 py-3 rounded-xl border-2 border-dashed border-stone-200 hover:border-amber-600 transition-all text-center text-stone-500 text-sm">
                      Click to upload or drag files here
                    </div>
                    <input type="file" multiple onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-stone-50 rounded-lg text-sm text-stone-800">
                        <span className="truncate">{file.name}</span>
                        <button type="button" onClick={() => removeAttachment(i)} className="text-red-500 hover:text-red-700">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 bg-stone-100 text-stone-950 font-bold rounded-xl hover:bg-stone-200 transition-all">Back</button>
                <button type="button" onClick={() => setStep(3)} disabled={!formData.description} className="flex-[2] py-4 bg-stone-950 text-white font-bold rounded-xl hover:bg-amber-900 transition-all disabled:opacity-50">Next: Delivery & Deadlines</button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-stone-800">Delivery Mode <span className="text-red-500">*</span></label>
                <select 
                  required
                  value={formData.deliveryMode}
                  onChange={e => setFormData({...formData, deliveryMode: e.target.value as any})}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all"
                >
                  <option value="Single Delivery">Single Delivery</option>
                  <option value="Scheduled Delivery">Scheduled Delivery</option>
                </select>
              </div>

              {formData.deliveryMode === 'Single Delivery' ? (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-stone-800 flex items-center gap-2">
                    <Calendar size={16} /> Deadline (Month Day Year Hour) <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required
                    type="datetime-local"
                    min={minDate}
                    value={formData.deadline}
                    onChange={e => setFormData({...formData, deadline: e.target.value})}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all ${isPastDate(formData.deadline!) ? 'border-red-500 bg-red-50' : 'border-stone-200'}`}
                  />
                  {isPastDate(formData.deadline!) && <p className="text-xs text-red-500 font-medium">Deadline cannot be in the past</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-stone-800">Subtasks & Deadlines <span className="text-red-500">*</span></label>
                    <button type="button" onClick={addSubtask} className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1">
                      <Plus size={14} /> Add Subtask
                    </button>
                  </div>
                  {formData.subtasks.map((subtask, i) => (
                    <div key={subtask.id} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Subtask {i + 1}</span>
                        <button type="button" onClick={() => removeSubtask(subtask.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input 
                          required
                          type="text"
                          placeholder="Subtask Title"
                          value={subtask.title}
                          onChange={e => updateSubtask(subtask.id, 'title', e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none"
                        />
                        <div className="space-y-1">
                          <input 
                            required
                            type="datetime-local"
                            min={minDate}
                            value={subtask.deadline}
                            onChange={e => updateSubtask(subtask.id, 'deadline', e.target.value)}
                            className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none ${isPastDate(subtask.deadline) ? 'border-red-500 bg-red-50' : 'border-stone-200'}`}
                          />
                          {isPastDate(subtask.deadline) && <p className="text-[10px] text-red-500 font-medium">Cannot be in the past</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {formData.subtasks.length === 0 && (
                    <p className="text-center text-sm text-stone-400 py-4">No subtasks added yet.</p>
                  )}
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-stone-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-stone-800">Project Quote <span className="text-red-500">*</span></label>
                    <input 
                      required
                      type="number"
                      placeholder="Amount"
                      value={formData.quoteAmount}
                      onChange={e => setFormData({...formData, quoteAmount: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-stone-800">Currency <span className="text-red-500">*</span></label>
                    <select 
                      required
                      value={formData.quoteCurrency}
                      onChange={e => setFormData({...formData, quoteCurrency: e.target.value as any})}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">Euros (€)</option>
                      <option value="AUD">AUD (A$)</option>
                      <option value="GBP">UK Pounds (£)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-stone-800">Payment Specifications (Required)</label>
                    <button 
                      type="button" 
                      onClick={addSpecification} 
                      disabled={formData.specifications.length >= 7}
                      className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Plus size={14} /> Add specification
                    </button>
                  </div>
                  {formData.specifications.map((specification, i) => (
                    <div key={specification.id} className="p-4 bg-stone-50/50 rounded-2xl border border-stone-100 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Specification {i + 1}</span>
                        <button type="button" onClick={() => removeSpecification(specification.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <select 
                          required
                          value={specification.type}
                          onChange={e => updateSpecification(specification.id, 'type', e.target.value as any)}
                          className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none"
                        >
                          <option value="Payment With Order">Payment With Order</option>
                          <option value="Payment of Partial Delivery">Payment of Partial Delivery</option>
                          <option value="Payment on Full Delivery">Payment on Full Delivery</option>
                        </select>
                        <div className="space-y-1">
                          <input 
                            required
                            type="datetime-local"
                            min={minDate}
                            value={specification.deadline}
                            onChange={e => updateSpecification(specification.id, 'deadline', e.target.value)}
                            className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none ${isPastDate(specification.deadline) ? 'border-red-500 bg-red-50' : 'border-stone-200'}`}
                          />
                          {isPastDate(specification.deadline) && <p className="text-[10px] text-red-500 font-medium">Cannot be in the past</p>}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-stone-800">Specification Amount ({formData.quoteCurrency}) <span className="text-red-500">*</span></label>
                        <input 
                          required
                          type="number"
                          placeholder="Amount"
                          value={specification.amount}
                          onChange={e => updateSpecification(specification.id, 'amount', e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                  ))}
                  {formData.specifications.length > 0 && (
                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-2">
                      <div className="flex justify-between items-center font-bold text-stone-950">
                        <span>Total Specifications:</span>
                        <span>{formData.quoteCurrency} {totalSpecifications.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {!isSpecificationsValid && (
                        <p className="text-xs text-red-500 font-medium">
                          The total of your specifications ({totalSpecifications.toFixed(2)}) must match the project quote ({quoteAmount.toFixed(2)}).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setStep(2)} className="flex-1 py-4 bg-stone-100 text-stone-950 font-bold rounded-xl hover:bg-stone-200 transition-all">Back</button>
                <button 
                  type="button" 
                  onClick={() => setStep(4)} 
                  disabled={
                    (formData.deliveryMode === 'Single Delivery' ? (!formData.deadline || isPastDate(formData.deadline)) : (formData.subtasks.length === 0 || formData.subtasks.some(s => !s.title || !s.deadline || isPastDate(s.deadline)))) ||
                    !formData.quoteAmount || 
                    formData.specifications.length === 0 ||
                    !isSpecificationsValid ||
                    formData.specifications.some(p => !p.deadline || isPastDate(p.deadline) || !p.amount)
                  }
                  className="flex-[2] py-4 bg-stone-950 text-white font-bold rounded-xl hover:bg-amber-900 transition-all disabled:opacity-50"
                >
                  Next: Preview Order
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="bg-stone-50 rounded-3xl p-6 space-y-6 border border-stone-100">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Category</h4>
                    <p className="text-stone-950 font-medium">{formData.category}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Product Type</h4>
                    <p className="text-stone-950 font-medium">{formData.productType}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Description</h4>
                  <p className="text-stone-950 text-sm whitespace-pre-wrap">{formData.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Delivery Mode</h4>
                    <p className="text-stone-950 font-medium">{formData.deliveryMode}</p>
                  </div>
                  {formData.deliveryMode === 'Single Delivery' && (
                    <div>
                      <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Deadline</h4>
                      <p className="text-stone-950 font-medium">{new Date(formData.deadline!).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Project Quote</h4>
                    <p className="text-stone-950 font-bold">{formData.quoteCurrency} {formData.quoteAmount}</p>
                  </div>
                </div>

                {formData.specifications.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Specifications</h4>
                    <div className="space-y-2">
                      {formData.specifications.map((p, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-white rounded-xl border border-stone-100 text-sm">
                          <div className="flex flex-col">
                            <span className="font-medium text-stone-950">{p.type}</span>
                            <span className="text-xs text-amber-600 font-bold">{formData.quoteCurrency} {p.amount}</span>
                          </div>
                          <span className="text-stone-500">{new Date(p.deadline).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {formData.deliveryMode === 'Scheduled Delivery' && (
                  <div>
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Subtasks</h4>
                    <div className="space-y-2">
                      {formData.subtasks.map((s, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-white rounded-xl border border-stone-100 text-sm">
                          <span className="font-medium text-stone-950">{s.title}</span>
                          <span className="text-stone-500">{new Date(s.deadline).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {attachments.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Attachments</h4>
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((file, i) => (
                        <span key={i} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium flex items-center gap-1">
                          <Paperclip size={12} /> {file.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setStep(3)} className="flex-1 py-4 bg-stone-100 text-stone-950 font-bold rounded-xl hover:bg-stone-200 transition-all">Back</button>
                <button type="button" onClick={() => setStep(5)} className="flex-[2] py-4 bg-stone-950 text-white font-bold rounded-xl hover:bg-amber-900 transition-all">Proceed to Account Info</button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-stone-800">Order As <span className="text-red-500">*</span></label>
                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, billingType: 'Individual'})}
                    className={`flex-1 py-3 rounded-xl border transition-all font-semibold ${formData.billingType === 'Individual' ? 'bg-stone-950 border-stone-950 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'}`}
                  >
                    Individual
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, billingType: 'Institution'})}
                    className={`flex-1 py-3 rounded-xl border transition-all font-semibold ${formData.billingType === 'Institution' ? 'bg-stone-950 border-stone-950 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'}`}
                  >
                    Institution
                  </button>
                </div>
                <p className="text-[10px] text-stone-500 italic">
                  {formData.billingType === 'Individual' 
                    ? "Invoice will be addressed to your profile name." 
                    : "Invoice will be addressed to your institution/company."}
                </p>
              </div>

              {formData.billingType === 'Institution' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-stone-800 flex items-center gap-2">
                    <Building2 size={16} /> Institution Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required
                    type="text"
                    value={formData.institution}
                    onChange={e => setFormData({...formData, institution: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all"
                    placeholder="Enter your institution or company name"
                  />
                </div>
              )}

              {!isLoggedIn && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-stone-800 flex items-center gap-2"><Mail size={16} /> Email Address <span className="text-red-500">*</span></label>
                    <input 
                      required
                      type="email"
                      value={formData.clientEmail}
                      onChange={e => setFormData({...formData, clientEmail: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all"
                      placeholder="name@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-stone-800 flex items-center gap-2"><Shield size={16} /> Password <span className="text-red-500">*</span></label>
                    <input 
                      required
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                  <p className="text-xs text-amber-600 italic">
                    New users must sign up first through the login page.
                  </p>
                </div>
              )}

              {uploadProgress && (
                <div className="mb-4 p-4 bg-stone-50 border border-stone-100 rounded-xl">
                  <div className="flex justify-between text-xs font-bold text-stone-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin" size={14} />
                      Uploading Attachments...
                    </span>
                    <span>{uploadProgress.current} / {uploadProgress.total}</span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                    <motion.div 
                      className="bg-amber-600 h-full transition-all duration-300"
                      initial={{ width: 0 }}
                      animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700">
                  <Shield size={18} className="shrink-0 mt-0.5" />
                  <div className="text-sm font-medium">{error}</div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setStep(4)} className="flex-1 py-4 bg-stone-100 text-stone-950 font-bold rounded-xl hover:bg-stone-200 transition-all">Back</button>
                <button 
                  type="submit"
                  disabled={loading || !isAccountInfoValid()}
                  className="flex-[2] py-4 bg-stone-950 text-white font-bold rounded-xl hover:bg-amber-900 transition-all shadow-lg shadow-stone-100 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Submit Order'}
                </button>
              </div>
            </motion.div>
          )}
        </form>
      </motion.div>
    </div>
  );
};

export const ProjectDetailsModal = ({ project, onClose }: { project: Project | null, onClose: () => void }) => {
  if (!project) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-stone-100 text-stone-700 border-stone-200';
      case 'In Progress': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Pending': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'On Hold': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Awaiting Approval': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Awaiting Acceptance': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Inactive': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto p-4 flex items-center justify-center bg-stone-900/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-stone-950 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-stone-100">
              <Briefcase size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-emerald-900">{project.name}</h2>
              <p className="text-xs text-sky-500 uppercase tracking-widest font-semibold mt-1">Order #{project.order_number || project.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-sky-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">Status</h4>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>
            <div className="space-y-1">
              <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">Created At</h4>
              <p className="text-sm font-bold text-emerald-900">{new Date(project.created_at).toLocaleDateString()}</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">Client</h4>
              <p className="text-sm font-bold text-emerald-900">{project.client_name?.trim() || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">Deadline</h4>
              <p className="text-sm font-bold text-emerald-900">
                {project.deadline ? new Date(project.deadline).toLocaleString() : 'No fixed deadline'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">Description</h4>
            <div className="p-6 bg-sky-50/50 rounded-2xl border border-sky-100 text-sm text-emerald-800 whitespace-pre-wrap leading-relaxed">
              {project.description || 'No description provided.'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">Quote Amount</h4>
              <p className="text-xl font-black text-emerald-600">
                {project.quote_currency} {project.quote_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-1">
              <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">Billing Type</h4>
              <p className="text-sm font-bold text-emerald-900">{project.billing_type || 'Individual'}</p>
            </div>
          </div>

          {project.attachments && project.attachments.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">Initial Attachments</h4>
              <div className="grid grid-cols-1 gap-2">
                {project.attachments.map((url, i) => (
                  <a 
                    key={i} 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-white border border-sky-100 rounded-2xl hover:bg-sky-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Paperclip size={20} />
                      </div>
                      <span className="text-sm font-bold text-emerald-900">Attachment {i + 1}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs hover:text-emerald-700">
                        View <ExternalLink size={14} />
                      </div>
                      <span 
                        className="flex items-center gap-2 text-sky-600 font-bold text-xs hover:text-sky-700"
                      >
                        Download <Download size={14} />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {project.completed_files && project.completed_files.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Completed Project Files</h4>
              <div className="grid grid-cols-1 gap-2">
                {project.completed_files.map((url, i) => (
                  <a 
                    key={i} 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl hover:bg-emerald-100 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-sm">
                        <CheckCircle2 size={20} />
                      </div>
                      <span className="text-sm font-bold text-emerald-900">Final Deliverable {i + 1}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs hover:text-emerald-700">
                        View <ExternalLink size={14} />
                      </div>
                      <span 
                        className="flex items-center gap-2 text-sky-600 font-bold text-xs hover:text-sky-700"
                      >
                        Download <Download size={14} />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-sky-50 border-t border-sky-100">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const InvoiceModal = ({ invoice, onClose }: { invoice: DisplayInvoice | null, onClose: () => void }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!invoice) return null;

  const handlePrint = () => {
    const printContent = invoiceRef.current;
    if (!printContent) return;

    // Create a hidden iframe for printing to avoid unresponsive main window
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.zIndex = '-1';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.write(`
      <html>
        <head>
          <title>Invoice - ${invoice.id}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { padding: 0; margin: 0; }
              .no-print { display: none; }
              .print-container { width: 100%; max-width: 100%; padding: 20px; }
              .page-break-avoid { page-break-inside: avoid; }
            }
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            body { font-family: 'Inter', sans-serif; }
          </style>
        </head>
        <body class="bg-white">
          <div class="print-container mx-auto max-w-3xl">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => {
                window.frameElement.remove();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  };

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto p-4 flex items-center justify-center bg-emerald-900/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
      >
        <div className="p-6 border-b border-sky-100 flex justify-between items-center bg-emerald-600 text-white no-print">
          <h2 className="text-xl font-bold">Order Confirmation & Invoice</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white" ref={invoiceRef}>
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="relative w-12 h-12 bg-stone-950 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-stone-100">
                <div className="text-white">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white shadow-sm" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-black text-stone-950 tracking-tighter leading-none uppercase">Ziel</h1>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.3em] mt-1">Architects</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-4xl font-light text-sky-100 uppercase tracking-tighter mb-2">Invoice</h2>
              <div className="space-y-1">
                <p className="text-xs font-black text-emerald-900">{invoice.id}</p>
                {invoice.orderNumber && (
                  <p className="text-[9px] font-black text-sky-400 uppercase tracking-widest">Order #{invoice.orderNumber}</p>
                )}
                <p className="text-xs font-medium text-sky-500">{invoice.date}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-10">
            <div>
              <h3 className="text-[9px] font-black text-sky-400 uppercase tracking-[0.2em] mb-2">Bill To</h3>
              <p className="text-base font-bold text-emerald-900 mb-0.5">{invoice.clientName}</p>
              {invoice.billingType !== 'Institution' && (
                <p className="text-emerald-600 font-medium text-xs">{invoice.clientEmail}</p>
              )}
            </div>
            <div>
              <h3 className="text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">From</h3>
              <p className="text-base font-bold text-stone-950 mb-0.5">Ziel Architects</p>
              <p className="text-stone-600 font-medium text-xs">enquiries@ziel-architects.store</p>
            </div>
          </div>

          <div className="mb-8">
            <div className="grid grid-cols-12 border-b border-sky-50 pb-2 mb-3">
              <div className="col-span-8">
                <h3 className="text-[9px] font-black text-sky-400 uppercase tracking-[0.2em]">Service Description</h3>
              </div>
              <div className="col-span-4 text-right">
                <h3 className="text-[9px] font-black text-sky-400 uppercase tracking-[0.2em]">Amount</h3>
              </div>
            </div>
            <div className="space-y-4">
              {invoice.services.map((service) => (
                <div key={service.id} className="grid grid-cols-12 items-start">
                  <div className="col-span-8">
                    <p className="text-base font-bold text-emerald-900 mb-0.5">{service.name}</p>
                    <p className="text-xs font-bold text-sky-500">{service.category}</p>
                  </div>
                  <div className="col-span-4 text-right">
                    <p className="text-base font-black text-emerald-900">
                      {invoice.currency} {invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t-2 border-sky-50 flex justify-between items-center mb-8">
            <h3 className="text-xs font-black text-sky-400 uppercase tracking-[0.2em]">Total Amount</h3>
            <p className="text-3xl font-black text-emerald-600">
              {invoice.currency} {invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {invoice.specifications && invoice.specifications.length > 0 && (
            <div className="mt-8 pt-6 border-t border-sky-100 page-break-avoid">
              <h3 className="text-[9px] font-black text-sky-400 uppercase tracking-[0.2em] mb-4">Payment Schedule & Due Dates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {invoice.specifications.map((spec, i) => (
                  <div key={spec.id} className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[9px] font-black text-sky-400 uppercase tracking-widest">Installment {i + 1}</span>
                      <span className="text-xs font-black text-emerald-600">{invoice.currency} {parseFloat(spec.amount).toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-bold text-emerald-900 mb-0.5">{spec.type}</p>
                    <p className="text-[10px] font-medium text-sky-500">Due: {new Date(spec.deadline).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual Payment Details */}
          <div className="mt-8 p-4 bg-stone-50 rounded-xl border border-stone-100 page-break-avoid">
            <h3 className="text-[9px] font-black text-stone-600 uppercase tracking-[0.2em] mb-3">Manual Payment Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
              <div>
                <p className="text-stone-800 font-bold">Account Name:</p>
                <p className="text-stone-900">Ziel Architects</p>
              </div>
              <div>
                <p className="text-emerald-800 font-bold">Account Number:</p>
                <p className="text-emerald-900">0111111</p>
              </div>
              <div>
                <p className="text-emerald-800 font-bold">Bank:</p>
                <p className="text-emerald-900">Diamond Trust Bank</p>
              </div>
              <div>
                <p className="text-emerald-800 font-bold">Branch:</p>
                <p className="text-emerald-900">Kenol Branch</p>
              </div>
              <div>
                <p className="text-emerald-800 font-bold">Swift Code:</p>
                <p className="text-emerald-900">DTKEKENA</p>
              </div>
            </div>
          </div>

          {/* Express Checkout Link for Individuals */}
          {invoice.billingType === 'Individual' && (
            <div className="mt-8 no-print">
              <button 
                onClick={() => alert('Redirecting to Banking API Gateway for Card Payment...')}
                className="w-full py-4 bg-emerald-600 text-white text-center font-black rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
              >
                Express Checkout: Pay with Card
              </button>
              <p className="text-[10px] text-sky-400 text-center mt-2 uppercase tracking-widest font-bold">Secure Card Payment via Banking Gateway</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-sky-50 border-t border-sky-100 flex gap-4 no-print">
          <button 
            onClick={handlePrint}
            className="flex-1 py-4 bg-white border-2 border-emerald-600 text-emerald-600 font-black rounded-2xl hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
          >
            <Printer size={20} /> Print
          </button>
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
