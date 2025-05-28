
import { ChatSession } from '../types';

const CHAT_SESSIONS_KEY = 'booleanLegalAIChatSessions';

export const getAllChatSessions = (): ChatSession[] => {
  try {
    const sessionsJson = localStorage.getItem(CHAT_SESSIONS_KEY);
    if (sessionsJson) {
      const sessions = JSON.parse(sessionsJson) as ChatSession[];
      // Sort by most recently updated
      return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    }
  } catch (error) {
    console.error("Error loading chat sessions from localStorage:", error);
  }
  return [];
};

export const getChatSession = (sessionId: string): ChatSession | null => {
  const sessions = getAllChatSessions();
  return sessions.find(session => session.id === sessionId) || null;
};

export const saveChatSession = (session: ChatSession): void => {
  try {
    const sessions = getAllChatSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    if (existingIndex > -1) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    // Sort again before saving if order matters for retrieval (getAllChatSessions sorts anyway)
    // sessions.sort((a, b) => b.updatedAt - a.updatedAt); 
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Error saving chat session to localStorage:", error);
    // Potentially handle quota exceeded error
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert('Could not save chat session: Local storage quota exceeded. You may need to clear some old chats or other site data.');
    }
  }
};

export const deleteChatSession = (sessionId: string): void => {
  try {
    let sessions = getAllChatSessions();
    sessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Error deleting chat session from localStorage:", error);
  }
};

// Optional: Clear all sessions - use with caution
export const deleteAllChatSessions = (): void => {
    try {
        localStorage.removeItem(CHAT_SESSIONS_KEY);
    } catch (error) {
        console.error("Error deleting all chat sessions from localStorage:", error);
    }
}
