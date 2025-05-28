
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-slate-900 shadow-lg border-b border-slate-700 sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center">
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="text-gray-100">boolean</span>
            <span className="text-red-500">legal</span>
          </h1>
        </div>
        <span className="text-xs sm:text-sm text-slate-500 text-right">Powered by<br className="xxs:hidden sm:hidden"/> UB Intelligence</span>
      </div>
    </header>
  );
};
