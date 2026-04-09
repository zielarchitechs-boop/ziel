import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Globe, 
  Zap, 
  FileText, 
  Mail, 
  CheckCircle2, 
  ArrowRight, 
  Menu,
  X,
  Search,
  LogIn,
  Compass,
  Building2,
  Layout,
  HardHat
} from 'lucide-react';
import { SERVICES, ServiceCardProps } from '../types';
import { Logo } from './Logo';

export const Navbar = ({ onOrderClick }: { onOrderClick: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <Link to="/">
            <Logo />
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-sm font-medium text-stone-700 hover:text-amber-900 transition-colors">Services</a>
            <a href="#about" className="text-sm font-medium text-stone-700 hover:text-amber-900 transition-colors">About</a>
            <a href="#contact" className="text-sm font-medium text-stone-700 hover:text-amber-900 transition-colors">Contact</a>
            <div className="h-6 w-px bg-stone-100 mx-2" />
            <Link 
              to="/login"
              className="flex items-center gap-2 text-sm font-bold text-stone-900 hover:text-amber-900 transition-colors"
            >
              <LogIn size={18} />
              Login
            </Link>
            <button 
              onClick={onOrderClick}
              className="px-5 py-2.5 bg-stone-950 text-white text-sm font-medium rounded-full hover:bg-amber-900 transition-all shadow-sm"
            >
              Request Consultation
            </button>
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-stone-900">
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-white border-b border-stone-100 px-4 py-6 space-y-4"
          >
            <a href="#services" className="block text-lg font-medium text-stone-900" onClick={() => setIsOpen(false)}>Services</a>
            <a href="#about" className="block text-lg font-medium text-stone-900" onClick={() => setIsOpen(false)}>About</a>
            <a href="#contact" className="block text-lg font-medium text-stone-900" onClick={() => setIsOpen(false)}>Contact</a>
            <Link 
              to="/login"
              className="flex items-center gap-3 text-lg font-bold text-stone-900"
              onClick={() => setIsOpen(false)}
            >
              <LogIn size={20} />
              Login
            </Link>
            <button 
              onClick={() => { onOrderClick(); setIsOpen(false); }}
              className="w-full py-3 bg-stone-950 text-white font-medium rounded-xl"
            >
              Request Consultation
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export const Hero = ({ onOrderClick }: { onOrderClick: () => void }) => {
  return (
    <section className="pt-40 pb-24 px-4 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center text-left">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-stone-950 mb-8 leading-[1.1]">
              Architectural Excellence & <span className="text-amber-700">Structural Integrity.</span>
            </h1>
            <p className="text-lg md:text-xl text-stone-600 max-w-2xl mb-12 leading-relaxed">
              Transforming visions into structural reality through conceptual design, technical precision, and expert construction supervision.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button 
                onClick={onOrderClick}
                className="w-full sm:w-auto px-8 py-4 bg-stone-950 text-white font-semibold rounded-2xl hover:bg-amber-900 transition-all flex items-center justify-center gap-2 group shadow-xl shadow-stone-200"
              >
                Start Your Project
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <a 
                href="#services"
                className="w-full sm:w-auto px-8 py-4 bg-white text-stone-900 font-semibold rounded-2xl border border-stone-200 hover:bg-stone-50 transition-all text-center"
              >
                Our Expertise
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative z-10 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white">
              <img 
                src="https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1200&q=80" 
                alt="Architectural Excellence" 
                className="w-full aspect-[4/3] object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-stone-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export const ServiceCard = ({ title, description, icon: Icon, items, image }: ServiceCardProps) => {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-full"
    >
      <div className="h-48 overflow-hidden relative">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/40 to-transparent" />
        <div className="absolute bottom-4 left-6 w-12 h-12 bg-white/90 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg">
          <Icon size={24} className="text-amber-900" />
        </div>
      </div>
      <div className="p-8 flex-1 flex flex-col">
        <h3 className="text-2xl font-bold text-stone-950 mb-3">{title}</h3>
        <p className="text-stone-600 mb-6 leading-relaxed text-sm">{description}</p>
        <ul className="space-y-3 mt-auto">
          {items.slice(0, 8).map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-stone-700">
              <CheckCircle2 size={16} className="text-amber-600" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};

export const ServicesSection = () => {
  const categories = [
    {
      title: "Architectural Design",
      description: "Transforming concepts into detailed blueprints. We specialize in conceptual design, construction documents, and bespoke interior design.",
      icon: Layout,
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
      items: SERVICES.filter(s => s.category === 'Architectural Design').map(s => s.name)
    },
    {
      title: "Technical & Compliance",
      description: "Ensuring structural integrity and regulatory adherence through rigorous code analysis, site evaluation, and coordination.",
      icon: Compass,
      image: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80",
      items: SERVICES.filter(s => s.category === 'Technical & Compliance').map(s => s.name)
    },
    {
      title: "Project Management",
      description: "From budgeting to final inspection, we provide comprehensive supervision to ensure your project is delivered to perfection.",
      icon: HardHat,
      image: "https://images.unsplash.com/photo-1531834685032-c34bf0d84c77?auto=format&fit=crop&w=800&q=80",
      items: SERVICES.filter(s => s.category === 'Project Management').map(s => s.name)
    }
  ];

  return (
    <section id="services" className="py-24 px-4 relative">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-stone-950 mb-4">Our Expertise</h2>
          <p className="text-stone-600 max-w-2xl mx-auto text-lg">We provide specialized architectural solutions tailored to the unique needs of developers, property owners, and construction firms.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {categories.map((cat, i) => (
            <ServiceCard 
              key={i} 
              title={cat.title}
              description={cat.description}
              icon={cat.icon}
              items={cat.items}
              image={cat.image}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export const Footer = () => {
  return (
    <footer id="contact" className="bg-stone-950 text-white py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2 flex flex-col items-center text-center md:items-start md:text-left">
            <div className="mb-8">
              <Logo light />
            </div>
            <p className="text-stone-300 max-w-md leading-relaxed mb-8 mx-auto md:mx-0">
              Pioneering architectural excellence through conceptual design, technical precision, and expert construction supervision.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-center md:justify-start gap-3 text-stone-300">
                <Mail size={20} className="text-amber-500" />
                <a href="mailto:enquiries@ziel-architects.com" className="hover:text-amber-400 transition-colors">enquiries@ziel-architects.com</a>
              </div>
            </div>
          </div>
          
          <div className="text-center md:text-left">
            <h4 className="text-sm font-bold uppercase tracking-widest text-amber-500 mb-6">Services</h4>
            <ul className="space-y-4 text-stone-300">
              <li><a href="#services" className="hover:text-amber-400 transition-colors">Architectural Design</a></li>
              <li><a href="#services" className="hover:text-amber-400 transition-colors">Technical Compliance</a></li>
              <li><a href="#services" className="hover:text-amber-400 transition-colors">Project Management</a></li>
              <li><a href="#services" className="hover:text-amber-400 transition-colors">Interior Design</a></li>
            </ul>
          </div>

          <div className="text-center md:text-left">
            <h4 className="text-sm font-bold uppercase tracking-widest text-amber-500 mb-6">Company</h4>
            <ul className="space-y-4 text-stone-300">
              <li><a href="#about" className="hover:text-amber-400 transition-colors">About Us</a></li>
              <li><a href="#about" className="hover:text-amber-400 transition-colors">Our Process</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-stone-800 flex flex-col md:flex-row justify-between items-center gap-4 text-stone-500 text-sm">
          <p>© 2026 Ziel Architects. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-amber-400 transition-colors">Twitter</a>
            <a href="#" className="hover:text-amber-400 transition-colors">LinkedIn</a>
            <a href="#" className="hover:text-amber-400 transition-colors">Instagram</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
