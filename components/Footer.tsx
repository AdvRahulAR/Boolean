
import React from 'react';
import { FOOTER_TEXT } from '../constants';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-center py-3 sm:py-4 md:py-6 border-t border-slate-700">
      <p className="text-xs sm:text-sm text-slate-500 px-2">{FOOTER_TEXT}</p>
    </footer>
  );
};
