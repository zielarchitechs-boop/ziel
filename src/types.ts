import React from 'react';

export type ServiceCategory = 'Architectural Design' | 'Technical & Compliance' | 'Project Management' | 'Other Services';

export interface Project {
  id: string;
  order_number?: string;
  user_id: string;
  name: string;
  description: string | null;
  status: 'Pending' | 'In Progress' | 'Completed' | 'On Hold' | 'Awaiting Approval' | 'Awaiting Acceptance' | 'Inactive';
  client_name: string | null;
  deadline: string | null;
  created_at: string;
  billing_type?: 'Individual' | 'Institution';
  quote_amount?: number;
  quote_currency?: string;
  attachments?: string[];
  completed_files?: string[];
  specifications?: PaymentSpecification[];
}

export interface Invoice {
  id: string;
  project_id: string | null;
  user_id: string;
  amount: number;
  status: 'Unpaid' | 'Paid' | 'Overdue' | 'Cancelled';
  due_date: string | null;
  created_at: string;
}

export interface DisplayInvoice {
  id: string;
  orderNumber?: string;
  date: string;
  clientName: string;
  clientEmail: string;
  services: ServiceItem[];
  totalAmount: number;
  currency: string;
  description?: string;
  billingType?: 'Individual' | 'Institution';
  specifications?: PaymentSpecification[];
  attachments?: string[];
}

export interface ServiceItem {
  id: string;
  name: string;
  category: ServiceCategory;
  description?: string;
}

export interface ServiceCardProps {
  title: string;
  description: string;
  icon: any;
  items: string[];
  image: string;
  key?: React.Key;
}

export interface Subtask {
  id: string;
  title: string;
  deadline: string;
}

export interface PaymentSpecification {
  id: string;
  type: 'Payment With Order' | 'Payment of Partial Delivery' | 'Payment on Full Delivery';
  deadline: string;
  amount: string;
}

export interface OrderForm {
  category: string;
  productType: string;
  projectName: string;
  description: string;
  deliveryMode: 'Single Delivery' | 'Scheduled Delivery';
  deadline?: string;
  quoteAmount: string;
  quoteCurrency: 'USD' | 'EUR' | 'AUD' | 'GBP';
  specifications: PaymentSpecification[];
  subtasks: Subtask[];
  accountType: 'Returning User' | 'New User';
  billingType: 'Individual' | 'Institution';
  firstName: string;
  lastName: string;
  middleName?: string;
  countryCode: string;
  phoneNumber: string;
  institution: string;
  role: string;
  country: string;
  clientEmail: string;
  password?: string;
  confirmPassword?: string;
}

export const SERVICES: ServiceItem[] = [
  // Architectural Design
  { id: 'arch-concept', name: 'Conceptual Design', category: 'Architectural Design' },
  { id: 'arch-docs', name: 'Detailed Construction Documents', category: 'Architectural Design' },
  { id: 'arch-interior', name: 'Interior Design', category: 'Architectural Design' },

  // Technical & Compliance
  { id: 'tech-struct', name: 'Structural Coordination', category: 'Technical & Compliance' },
  { id: 'tech-code', name: 'Building Code Analysis', category: 'Technical & Compliance' },
  { id: 'tech-site', name: 'Site Analysis', category: 'Technical & Compliance' },

  // Project Management
  { id: 'pm-budget', name: 'Budgeting', category: 'Project Management' },
  { id: 'pm-super', name: 'Construction Supervision', category: 'Project Management' },

  // Other Services
  { id: 'other-consult', name: 'Other Consultancy Services', category: 'Other Services' },
];
