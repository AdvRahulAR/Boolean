import React, { useState } from 'react';
import { ChatSession } from '../types';

interface ChatHistoryPanelProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onLoadChat: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (sessionId: string) => void;
  onRenameChat: (sessionId: string, newTitle: string) => void;
  isOpen: boolean;
  onCloseRequest: () => void;
}

export const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({
  sessions,
  activeSessionId,
  onLoadChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  isOpen,
  onCloseRequest,
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const handleRenameStart = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setNewTitle(session.title);
  };

  const handleRenameSubmit = (sessionId: string) => {
    if (newTitle.trim()) {
      onRenameChat(sessionId, newTitle.trim());
    }
    setEditingSessionId(null);
    setNewTitle('');
  };
  
  const confirmDelete = (sessionId: string, sessionTitle: string) => {
    if (window.confirm(`Are you sure you want to delete the chat "${sessionTitle}"? This action cannot be undone.`)) {
      onDeleteChat(sessionId);
    }
  };

  return (
    <div
      className={`
        bg-slate-800 border-r border-slate-700 flex flex-col h-full shadow-lg z-40
        transition-all duration-300 ease-in-out
        ${isOpen ? 'p-2 sm:p-3 w-full sm:w-60 md:w-72 lg:w-80' : 'w-0 p-0 overflow-hidden'}
      `}
      aria-hidden={!isOpen}
    >
      {isOpen && (
        <>
          <div className="flex items-center justify-between mb-2 sm:mb-3 pb-2 sm:pb-3 border-b border-slate-700">
            <h2 className="text-md sm:text-lg font-semibold text-white ml-1">Chat History</h2>
            <button
              onClick={onCloseRequest}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-red-400 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 transition-transform duration-150 hover:scale-110 active:scale-95"
              aria-label="Close chat history"
              title="Close chat history"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          </div>

          <div className="mb-2 sm:mb-3">
            <button
              onClick={onNewChat}
              className="w-full px-2 py-2 sm:px-3 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-all duration-150 hover:scale-105 active:scale-95"
            >
              + New Chat
            </button>
          </div>

          <nav className="flex-grow overflow-y-auto space-y-1 -mr-1 pr-1"> {/* Negative margin for scrollbar */}
            {sessions.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">No chat history yet.</p>
            )}
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group p-2 sm:p-2.5 rounded-md cursor-pointer transition-all duration-200 ease-in-out ${
                  activeSessionId === session.id
                    ? 'bg-slate-700 border-l-2 border-red-500' 
                    : 'hover:bg-slate-700/60 hover:shadow-md hover:-translate-y-px'
                }`}
              >
                {editingSessionId === session.id ? (
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onBlur={() => handleRenameSubmit(session.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(session.id)}
                      className="flex-grow p-1 text-xs sm:text-sm bg-slate-600 text-white rounded-md border border-slate-500 focus:ring-1 focus:ring-red-500"
                      autoFocus
                    />
                    <button onClick={() => handleRenameSubmit(session.id)} className="ml-1 p-1 text-green-400 hover:text-green-300 transition-transform duration-150 hover:scale-110" title="Save">✓</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between" onClick={() => onLoadChat(session.id)}>
                    <div className="flex-grow truncate">
                        <p className={`text-xs sm:text-sm font-medium truncate ${activeSessionId === session.id ? 'text-red-300' : 'text-slate-200'}`} title={session.title}>
                        {session.title}
                        </p>
                        <p className="text-[0.65rem] sm:text-xs text-slate-400">
                        {new Date(session.updatedAt).toLocaleString([], { year: '2-digit', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                    </div>
                    <div className="flex-shrink-0 space-x-0.5 sm:space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRenameStart(session); }}
                        className="p-0.5 sm:p-1 text-slate-400 hover:text-slate-200 transition-transform duration-150 hover:scale-110"
                        aria-label="Rename chat"
                        title="Rename"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmDelete(session.id, session.title); }}
                        className="p-0.5 sm:p-1 text-red-400 hover:text-red-300 transition-transform duration-150 hover:scale-110"
                        aria-label="Delete chat"
                        title="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c1.153 0 2.243.462 3.032 1.214a48.09 48.09 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="text-center text-[0.65rem] sm:text-xs text-slate-600 pt-2 sm:pt-3 mt-auto border-t border-slate-700">
            Chat history is stored locally.
          </div>
        </>
      )}
    </div>
  );
};
