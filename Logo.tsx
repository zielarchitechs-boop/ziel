import React from 'react';

export const Logo = ({ light = false, hideText = false }: { light?: boolean; hideText?: boolean }) => (
  <div className="flex items-center gap-3 group cursor-pointer">
    <div className="relative">
      <div className={`w-11 h-11 ${light ? 'bg-amber-100' : 'bg-stone-950'} rounded-xl flex items-center justify-center shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-[10deg]`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={light ? 'text-stone-950' : 'text-amber-500'}>
          <path d="M3 21h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 21V9l3-3 3 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 21h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M7 21h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 3v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className={`absolute -top-1 -right-1 w-4 h-4 ${light ? 'bg-stone-950' : 'bg-amber-600'} rounded-full border-2 ${light ? 'border-amber-100' : 'border-white'} shadow-sm`} />
    </div>
    {!hideText && (
      <div className="flex flex-col ml-3 text-left">
        <div className={`text-2xl font-black tracking-tighter ${light ? 'text-white' : 'text-stone-950'} uppercase leading-none`}>
          Ziel
        </div>
        <div className={`text-[10px] font-bold tracking-[0.3em] ${light ? 'text-amber-200' : 'text-amber-700'} uppercase mt-0.5`}>
          Architects
        </div>
      </div>
    )}
  </div>
);
