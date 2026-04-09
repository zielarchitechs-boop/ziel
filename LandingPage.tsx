import React from 'react';
import { Navbar, Hero, ServicesSection, Footer } from '../components/LandingPageComponents';

export const LandingPage = ({ onOrderClick }: { onOrderClick: () => void }) => {
  return (
    <div className="min-h-screen bg-white font-sans text-stone-950 selection:bg-amber-600 selection:text-white relative overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-amber-50/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-stone-100/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-[20%] right-[5%] w-[30%] h-[30%] bg-amber-50/40 rounded-full blur-[100px]" />
        <div className="absolute top-[60%] left-[5%] w-[25%] h-[25%] bg-stone-50/30 rounded-full blur-[80px]" />
        
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <Navbar onOrderClick={onOrderClick} />
      
      <main>
        <Hero onOrderClick={onOrderClick} />
        
        <ServicesSection />

        <section id="about" className="py-24 bg-stone-950 text-white px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-8 tracking-tight">Ready to build your vision?</h2>
            <p className="text-stone-300 text-lg mb-12">Join the developers and property owners who trust Ziel Architects for elite architectural design and construction consultancy.</p>
            <button 
              onClick={onOrderClick}
              className="px-10 py-5 bg-amber-600 text-white font-bold rounded-2xl hover:bg-amber-500 transition-all shadow-xl shadow-amber-900/20"
            >
              Access Project Portal
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default LandingPage;
