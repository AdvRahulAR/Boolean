

import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ChatDisplay } from './components/ResponseDisplay';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorMessage } from './components/ErrorMessage';
import { ChatHistoryPanel } from './components/ChatHistoryPanel';
import { ChatInputBar } from './components/ChatInputBar';
import { ServiceArea, LegalTask, ProcessedFile, ChatSession, ChatMessage, UserQueryMessage, AIResponseMessage, SystemMessage, ProcessedFileInfoForChat, AIResponse, QueryPayload } from './types';
import { getAIResponse } from './services/geminiService';
// import { mockFetchLegalInfo } from './services/webSearchService'; // No longer used here
import { saveChatSession, getAllChatSessions, deleteChatSession as deleteSessionFromStorage, getChatSession } from './services/localStorageService';

const generateUUID = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const [currentServiceArea, setCurrentServiceArea] = useState<ServiceArea>(ServiceArea.VENTURE_CAPITAL);
  const [currentLegalTask, setCurrentLegalTask] = useState<LegalTask>(LegalTask.GENERAL_QUERY);

  useEffect(() => {
    const loadedSessions = getAllChatSessions();
    setChatSessions(loadedSessions);
  }, []);

  const activeChatSession = chatSessions.find(session => session.id === activeChatSessionId);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  const addMessageToSessionState = useCallback((sessionId: string, message: ChatMessage, isNewSession: boolean = false, newSessionData?: Omit<ChatSession, 'messages'>) => {
    setChatSessions(prevSessions => {
      let updatedSessions;
      if (isNewSession && newSessionData) {
        const sessionToAdd: ChatSession = { ...newSessionData, messages: [message], updatedAt: Date.now() };
        if (prevSessions.length === 0) setIsSidebarOpen(true);
        updatedSessions = [sessionToAdd, ...prevSessions];
        saveChatSession(sessionToAdd);
      } else {
        const sessionIndex = prevSessions.findIndex(s => s.id === sessionId);
        if (sessionIndex > -1) {
          const currentSession = prevSessions[sessionIndex];
          const updatedSession: ChatSession = {
            ...currentSession,
            messages: [...currentSession.messages, message],
            updatedAt: Date.now(),
            initialServiceArea: currentSession.messages.length === 0 && message.role === 'user' 
              ? (message as UserQueryMessage).serviceArea 
              : currentSession.initialServiceArea,
            initialLegalTask: currentSession.messages.length === 0 && message.role === 'user' 
              ? (message as UserQueryMessage).legalTask 
              : currentSession.initialLegalTask,
          };
          saveChatSession(updatedSession);
          updatedSessions = [...prevSessions];
          updatedSessions[sessionIndex] = updatedSession;
        } else {
          console.warn(`addMessageToSessionState: Session with ID ${sessionId} not found.`);
          return prevSessions; 
        }
      }
      return updatedSessions.sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, [setIsSidebarOpen]);


  const handleContextChange = (newArea?: ServiceArea, newTask?: LegalTask) => {
    let messageText = "";
    if (newArea && newArea !== currentServiceArea) {
      setCurrentServiceArea(newArea);
      messageText += `Service Area updated to "${newArea}". `;
    }
    if (newTask && newTask !== currentLegalTask) {
      setCurrentLegalTask(newTask);
      messageText += `Legal Task updated to "${newTask}".`;
    }

    if (messageText && activeChatSessionId) {
      const systemMessage: SystemMessage = {
        id: generateUUID(),
        role: 'system',
        timestamp: Date.now(),
        text: messageText.trim(),
      };
      addMessageToSessionState(activeChatSessionId, systemMessage);
    }
  };

  const handleSubmitQuery = useCallback(async (
    queryText: string,
    processedFiles: ProcessedFile[],
    isWebSearchEnabled: boolean // Added for web search toggle
  ) => {
    setIsLoading(true);
    setError(null);

    const filesInfo: ProcessedFileInfoForChat[] = processedFiles.map(pf => ({
      name: pf.name,
      type: pf.type,
      size: pf.originalFile.size,
    }));

    const userMessage: UserQueryMessage = {
      id: generateUUID(),
      role: 'user',
      timestamp: Date.now(),
      serviceArea: currentServiceArea,
      legalTask: currentLegalTask,
      queryText,
      filesInfo,
    };

    let targetSessionId: string;
    let currentChatHistory: ChatMessage[] = [];

    if (!activeChatSessionId) {
      targetSessionId = generateUUID();
      const newSessionBase: Omit<ChatSession, 'messages'> = {
        id: targetSessionId,
        title: queryText.substring(0, 40) + (queryText.length > 40 ? '...' : ''),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        initialServiceArea: currentServiceArea,
        initialLegalTask: currentLegalTask,
      };
      setActiveChatSessionId(targetSessionId);
      addMessageToSessionState(targetSessionId, userMessage, true, newSessionBase);
    } else { 
      targetSessionId = activeChatSessionId;
      currentChatHistory = chatSessions.find(s => s.id === activeChatSessionId)?.messages || [];
      addMessageToSessionState(targetSessionId, userMessage);
    }
    
    try {
      const primaryFile = processedFiles.length > 0 ? processedFiles[0] : null;

      const payloadForAI: QueryPayload = {
        serviceArea: userMessage.serviceArea,
        task: userMessage.legalTask,
        userQuery: queryText,
        fileName: filesInfo.map(f => f.name).join(', ') || (primaryFile ? primaryFile.name : undefined),
        documentTextContent: primaryFile?.textContent,
        documentImagePages: primaryFile?.imagePageDataUrls,
        documentMimeType: primaryFile?.type,
        chatHistory: currentChatHistory,
        enableGoogleSearch: isWebSearchEnabled, // Pass the web search toggle state
      };
      
      console.log("App.tsx: handleSubmitQuery, payload for getAIResponse:", {
          serviceArea: payloadForAI.serviceArea,
          task: payloadForAI.task,
          userQuery: payloadForAI.userQuery,
          fileName: payloadForAI.fileName,
          documentMimeType: payloadForAI.documentMimeType,
          hasTextContent: !!payloadForAI.documentTextContent,
          numImagePages: payloadForAI.documentImagePages?.length || 0,
          chatHistoryLength: currentChatHistory?.length || 0,
          enableGoogleSearch: payloadForAI.enableGoogleSearch,
      });

      const aiResponseData: AIResponse = await getAIResponse(payloadForAI);
      
      const aiMessage: AIResponseMessage = {
        ...aiResponseData,
        id: generateUUID(),
        role: 'ai',
        timestamp: Date.now(),
        fileName: filesInfo.length > 0 ? filesInfo.map(f => f.name).join(', ') : undefined,
      };
      
      addMessageToSessionState(targetSessionId, aiMessage);

    } catch (err) {
      console.error("Error getting AI response:", err);
      const message = err instanceof Error ? `Failed to get AI response: ${err.message}` : "An unknown error occurred.";
      setError(message); 
      const errorAiMessage: AIResponseMessage = {
        id: generateUUID(),
        role: 'ai',
        timestamp: Date.now(),
        text: `Error: ${message}`,
      };
      addMessageToSessionState(targetSessionId, errorAiMessage);
    } finally {
      setIsLoading(false);
    }
  }, [activeChatSessionId, currentServiceArea, currentLegalTask, addMessageToSessionState, setActiveChatSessionId, setIsLoading, setError, chatSessions]);


  const handleStartNewChat = () => {
    setActiveChatSessionId(null);
    if (!isSidebarOpen) setIsSidebarOpen(true); 
  };

  const handleLoadChat = (sessionId: string) => {
    const sessionToLoad = chatSessions.find(s => s.id === sessionId);
    if (sessionToLoad) {
      setActiveChatSessionId(sessionId);
      setCurrentServiceArea(sessionToLoad.initialServiceArea || ServiceArea.VENTURE_CAPITAL);
      setCurrentLegalTask(sessionToLoad.initialLegalTask || LegalTask.GENERAL_QUERY);
      if (!isSidebarOpen) setIsSidebarOpen(true);
    }
  };

  const handleDeleteChat = (sessionId: string) => {
    deleteSessionFromStorage(sessionId);
    setChatSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeChatSessionId === sessionId) {
      setActiveChatSessionId(null);
    }
  };
  
  const handleRenameChat = (sessionId: string, newTitle: string) => {
    setChatSessions(prevSessions => {
        const sessionIndex = prevSessions.findIndex(s => s.id === sessionId);
        if (sessionIndex > -1) {
            const updatedSession = { 
                ...prevSessions[sessionIndex], 
                title: newTitle, 
                updatedAt: Date.now() 
            };
            saveChatSession(updatedSession);
            const newSessions = [...prevSessions];
            newSessions[sessionIndex] = updatedSession;
            return newSessions.sort((a, b) => b.updatedAt - a.updatedAt);
        }
        return prevSessions;
    });
  };

  const welcomeMessage = (
    <div className="flex flex-col items-center justify-center h-full text-center p-4 sm:p-6 md:p-8 animate-fade-in-slide-up">
      <div className="bg-slate-800 shadow-2xl rounded-xl p-6 sm:p-8 md:p-10 border border-slate-700">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
            <span className="text-gray-100">Boolean Legal </span>
            <span className="text-red-500">AI Assistant</span>
        </h2>
        <p className="mb-3 sm:mb-4 text-lg sm:text-xl text-slate-300">
            Welcome, Lalu!
        </p>
        <p className="text-sm sm:text-base text-slate-400 max-w-sm sm:max-w-md mx-auto">
            I'm here to assist with your legal queries. Type your question below, upload documents using the '+' icon, or select a previous chat from the panel.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-900 text-gray-100 overflow-hidden">
      <ChatHistoryPanel
        sessions={chatSessions}
        activeSessionId={activeChatSessionId}
        onLoadChat={handleLoadChat}
        onNewChat={handleStartNewChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        isOpen={isSidebarOpen}
        onCloseRequest={toggleSidebar}
      />
      
      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-1/2 left-0 z-30 flex items-center justify-center w-8 h-10 sm:w-10 sm:h-12 bg-red-600 text-white rounded-r-md shadow-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900 transform -translate-y-1/2 transition-all hover:scale-105 active:scale-95"
          aria-label="Open chat history"
          title="Open chat history"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}

      <div className={`flex-1 flex flex-col overflow-hidden ${isSidebarOpen ? 'hidden sm:flex' : 'flex'}`}>
        <Header />
        <main className="flex-grow flex flex-col" style={{minHeight:0}}>
          {error && !isLoading && <div className="p-2 sm:p-4 flex-shrink-0 animate-fade-in"><ErrorMessage message={error} /></div>}
          
          <div className="flex-grow p-2 sm:p-3 md:p-4 lg:p-6 overflow-y-auto custom-scrollbar" style={{minHeight: 0}}>
            {!activeChatSession ? (
              welcomeMessage
            ) : (
              <>
                <ChatDisplay messages={activeChatSession.messages} />
                {isLoading && activeChatSession.messages.length > 0 &&  (
                    <div className="flex justify-start pl-2 sm:pl-4 pb-2 sm:pb-4 items-center text-xs sm:text-sm text-slate-400">
                        <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-t-2 border-b-2 border-red-500 mr-2"></div>
                        <span className="animate-subtle-pulse">AI is thinking...</span>
                    </div>
                )}
              </>
            )}
            {isLoading && (!activeChatSession || activeChatSession.messages.length === 0) && (
                <div className="flex justify-center py-4 sm:py-8 animate-fade-in"><LoadingSpinner /></div>
            )}
          </div>
        </main>
        <ChatInputBar
            onSubmit={handleSubmitQuery}
            isLoading={isLoading}
            serviceArea={currentServiceArea}
            legalTask={currentLegalTask}
            onServiceAreaChange={(sa) => handleContextChange(sa, undefined)}
            onLegalTaskChange={(lt) => handleContextChange(undefined, lt)}
        />
        <Footer />
      </div>
    </div>
  );
};

export default App;