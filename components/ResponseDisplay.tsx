import React, { useEffect, useState, useRef } from 'react';
import { marked } from 'marked';
import { ChatMessage, UserQueryMessage, AIResponseMessage, SystemMessage, GroundingChunk, FeedbackCategory, ProcessedFileInfoForChat } from '../types';

interface ChatDisplayProps {
  messages: ChatMessage[];
}

const SourceItem: React.FC<{ source: GroundingChunk, index: number }> = ({ source, index }) => (
  <li key={source.web.uri || index} className="mb-1 last:mb-0">
    <a
      href={source.web.uri}
      target="_blank"
      rel="noopener noreferrer"
      className="text-red-300 hover:text-red-200 hover:underline break-all text-[0.7rem] sm:text-xs"
      title={source.web.title || source.web.uri}
    >
      {index + 1}. {source.web.title || source.web.uri}
    </a>
  </li>
);

const UserMessageCard: React.FC<{ message: UserQueryMessage }> = ({ message }) => {
  const [parsedHtml, setParsedHtml] = useState('');
  useEffect(() => {
    marked.setOptions({ gfm: true, breaks: true });
    setParsedHtml(marked.parse(message.queryText) as string);
  }, [message.queryText]);

  return (
    <div className="flex justify-end mb-3 sm:mb-4 group animate-fade-in-slide-up">
      <div className="bg-red-600 text-white p-2 sm:p-3 rounded-l-xl rounded-tr-xl shadow-md max-w-[85%] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
        <div className="prose prose-sm md:prose-base prose-invert max-w-none text-white" dangerouslySetInnerHTML={{ __html: parsedHtml }} />
        {message.filesInfo && message.filesInfo.length > 0 && (
          <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-red-400/50">
            <p className="text-[0.7rem] sm:text-xs font-medium text-red-200 mb-0.5 sm:mb-1">Attached:</p>
            <ul className="list-none pl-0 space-y-0.5">
              {message.filesInfo.map(file => (
                <li key={file.name} className="text-[0.7rem] sm:text-xs text-red-100 break-all">
                  📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[0.65rem] sm:text-xs text-red-200/80 mt-1.5 sm:mt-2 text-right">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </div>
  );
};

const AIMessageCard: React.FC<{ message: AIResponseMessage }> = ({ message }) => {
  const [parsedHtml, setParsedHtml] = useState('');
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>(FeedbackCategory.ACCURACY);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    if (message.text) {
      marked.setOptions({ gfm: true, breaks: true });
      const html = marked.parse(message.text) as string;
      setParsedHtml(html);
    } else {
      setParsedHtml('');
    }
  }, [message.text]);

  const toggleSourcesExpansion = () => setIsSourcesExpanded(!isSourcesExpanded);

  const handleRating = (rating: 'helpful' | 'unhelpful') => {
    console.log(`Feedback for AI message ID ${message.id}: ${rating}`);
    alert(`Thank you for your feedback!`); 
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({
      messageId: message.id,
      category: feedbackCategory,
      comment: feedbackComment,
    });
    setFeedbackSubmitted(true);
    setShowFeedbackForm(false);
    setTimeout(() => setFeedbackSubmitted(false), 3000); 
  };

  return (
    <div className="flex justify-start mb-3 sm:mb-4 group animate-fade-in-slide-up">
      <div className="bg-slate-700 p-2 sm:p-3 rounded-r-xl rounded-tl-xl shadow-md max-w-[85%] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
        {parsedHtml ? (
          <div
            className="prose prose-sm md:prose-base prose-invert ai-message-enhanced-spacing max-w-none text-slate-100 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parsedHtml }}
          />
        ) : (
          <p className="text-slate-400">AI response processing...</p>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 sm:mt-3 pt-1.5 sm:pt-2 border-t border-slate-600">
            <button
              onClick={toggleSourcesExpansion}
              aria-expanded={isSourcesExpanded}
              aria-controls={`web-search-sources-${message.id}`}
              className="w-full flex items-center justify-between text-left text-[0.7rem] sm:text-xs font-semibold mb-1 text-red-400 hover:text-red-300 focus:outline-none"
            >
              <span>Web Search Sources ({message.sources.length})</span>
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-2.5 h-2.5 sm:w-3 sm:h-3 transition-transform duration-200 ${isSourcesExpanded ? 'transform rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {isSourcesExpanded && (
              <div id={`web-search-sources-${message.id}`} className="mt-1">
                <ul className="list-none pl-0 space-y-0.5">
                  {message.sources.map((source, index) => (
                    source.web && source.web.uri ? <SourceItem key={index} source={source} index={index} /> : null
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-slate-600/50 flex items-center justify-between">
          <p className="text-[0.65rem] sm:text-xs text-slate-400/80">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          {!message.text.startsWith("Error:") && (
            <div className="flex space-x-1 sm:space-x-1.5 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {feedbackSubmitted ? (
                <span className="text-[0.7rem] sm:text-xs text-green-400">Thanks!</span>
              ) : (
                <>
                  <button onClick={() => handleRating('helpful')} className="p-0.5 sm:p-1 rounded hover:bg-slate-600 transition-all duration-150 hover:scale-110 active:scale-95" aria-label="Helpful"><span className="text-xs sm:text-sm">👍</span></button>
                  <button onClick={() => handleRating('unhelpful')} className="p-0.5 sm:p-1 rounded hover:bg-slate-600 transition-all duration-150 hover:scale-110 active:scale-95" aria-label="Not helpful"><span className="text-xs sm:text-sm">👎</span></button>
                  <button onClick={() => setShowFeedbackForm(!showFeedbackForm)} className="p-0.5 sm:p-1 rounded hover:bg-slate-600 text-[0.65rem] sm:text-xs text-slate-400 hover:text-slate-200 transition-all duration-150 hover:scale-110 active:scale-95" aria-label="Detailed feedback">{showFeedbackForm ? 'Cancel' : 'More'}</button>
                </>
              )}
            </div>
          )}
        </div>

        {showFeedbackForm && !feedbackSubmitted && (
            <form onSubmit={handleFeedbackSubmit} className="space-y-1.5 sm:space-y-2 mt-1.5 sm:mt-2 p-1.5 sm:p-2 bg-slate-600/70 rounded-md text-[0.7rem] sm:text-xs" id={`detailed-feedback-form-${message.id}`}>
              <select
                id={`feedbackCategory-${message.id}`}
                value={feedbackCategory}
                onChange={(e) => setFeedbackCategory(e.target.value as FeedbackCategory)}
                className="w-full p-1 sm:p-1.5 bg-slate-700 border border-slate-500 rounded-md focus:ring-red-500 focus:border-red-500 text-gray-100 text-[0.7rem] sm:text-xs"
              >
                {Object.values(FeedbackCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <textarea
                id={`feedbackComment-${message.id}`}
                rows={2}
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Optional comments..."
                className="w-full p-1 sm:p-1.5 bg-slate-700 border border-slate-500 rounded-md focus:ring-red-500 focus:border-red-500 text-gray-100 placeholder-slate-400 resize-y text-[0.7rem] sm:text-xs"
              />
              <button type="submit" className="px-1.5 py-0.5 sm:px-2 sm:py-1 font-medium rounded-md bg-red-600 hover:bg-red-700 text-white focus:outline-none text-[0.7rem] sm:text-xs transition-colors">Submit</button>
            </form>
        )}
      </div>
    </div>
  );
};

const SystemMessageCard: React.FC<{ message: SystemMessage }> = ({ message }) => {
  return (
    <div className="my-2 sm:my-3 text-center animate-fade-in-slide-up">
      <span className="inline-block bg-slate-700 text-slate-300 text-[0.65rem] sm:text-xs px-2 py-0.5 sm:px-3 sm:py-1 rounded-full shadow">
        {message.text} – <span className="text-slate-400">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </span>
    </div>
  );
};


export const ChatDisplay: React.FC<ChatDisplayProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!messages || messages.length === 0) {
    return (
      <div className="text-center text-slate-500 py-6 sm:py-10 animate-fade-in">
        <p className="text-sm">No messages in this chat yet. Send one to start!</p>
      </div>
    );
  }

  return (
    <div className="px-1 sm:px-2 md:px-4"> 
      {messages.map((msg) => {
        if (msg.role === 'user') {
          return <UserMessageCard key={msg.id} message={msg as UserQueryMessage} />;
        } else if (msg.role === 'ai') {
          return <AIMessageCard key={msg.id} message={msg as AIResponseMessage} />;
        } else if (msg.role === 'system') {
          return <SystemMessageCard key={msg.id} message={msg as SystemMessage} />;
        }
        return null;
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};
