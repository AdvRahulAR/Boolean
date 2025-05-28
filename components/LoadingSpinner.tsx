
import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center py-10" aria-label="Loading response">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-500"></div>
      <p className="ml-4 text-xl text-slate-300">AI is processing your request...</p>
    </div>
  );
};