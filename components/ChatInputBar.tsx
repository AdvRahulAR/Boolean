

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ServiceArea, LegalTask, ProcessedFile } from '../types';
import * as pdfjsLib from 'pdfjs-dist'; 
import { SUGGESTED_PROMPTS_BY_AREA } from '../services/suggestedPrompts'; 

interface ChatInputBarProps {
  onSubmit: (queryText: string, processedFiles: ProcessedFile[], isWebSearchEnabled: boolean) => void;
  isLoading: boolean;
  serviceArea: ServiceArea;
  legalTask: LegalTask;
  onServiceAreaChange: (serviceArea: ServiceArea) => void;
  onLegalTaskChange: (legalTask: LegalTask) => void;
}

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const PDF_TEXT_EXTRACTION_MIN_CHARS_PER_PAGE_HEURISTIC = 50;
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];


export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSubmit,
  isLoading,
  serviceArea,
  legalTask,
  onServiceAreaChange,
  onLegalTaskChange,
}) => {
  const [queryText, setQueryText] = useState<string>('');
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState<boolean>(false); // State for web search toggle

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);


  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; 
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = parseInt(getComputedStyle(textareaRef.current).maxHeight, 10);
      if (scrollHeight > maxHeight && maxHeight > 0) {
        textareaRef.current.style.height = `${maxHeight}px`;
      } else {
        textareaRef.current.style.height = `${scrollHeight}px`;
      }
    }
  }, [queryText]);

  useEffect(() => {
    if (!isLoading && queryText === '' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading, queryText]);

  useEffect(() => {
    if (queryText.trim() && serviceArea) {
      const promptsForCurrentArea = SUGGESTED_PROMPTS_BY_AREA[serviceArea] || [];
      const filteredSuggestions = promptsForCurrentArea.filter(prompt =>
        prompt.toLowerCase().includes(queryText.toLowerCase())
      );
      setSuggestions(filteredSuggestions.slice(0, 10)); 
      setShowSuggestions(filteredSuggestions.length > 0);
      setActiveSuggestionIndex(-1); 
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [queryText, serviceArea]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [suggestionsRef, textareaRef]);


  const handleFileProcessing = useCallback(async (file: File): Promise<Omit<ProcessedFile, 'id' | 'originalFile'>> => {
    console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { name: file.name, type: file.type, status: 'error', errorMessage: `File too large (max ${MAX_FILE_SIZE_MB}MB)` };
    }

    if (file.type === 'application/pdf') {
      try {
        console.log(`Starting PDF processing for ${file.name}`);
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        console.log(`PDF ${file.name} has ${pdfDoc.numPages} pages.`);
        let totalChars = 0;
        let textContent = '';

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const pageTextContent = await page.getTextContent();
          const pageText = pageTextContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
          textContent += pageText + '\\n\\n'; 
          totalChars += pageText.length;
          console.log(`PDF ${file.name}, Page ${i}: ${pageText.length} chars extracted.`);
        }
        
        console.log(`PDF ${file.name}: Total chars extracted: ${totalChars}, Avg chars/page: ${pdfDoc.numPages > 0 ? totalChars / pdfDoc.numPages : 0}`);
        if (pdfDoc.numPages > 0 && (totalChars / pdfDoc.numPages) < PDF_TEXT_EXTRACTION_MIN_CHARS_PER_PAGE_HEURISTIC && pdfDoc.numPages <=5 ) {
          console.log(`Low text content for ${file.name}. Attempting OCR via image conversion (max 5 pages).`);
          const imagePageDataUrls: string[] = [];
          for (let i = 1; i <= Math.min(pdfDoc.numPages, 5); i++) { 
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 }); 
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            if (context) {
              await page.render({ canvasContext: context, viewport: viewport }).promise;
              imagePageDataUrls.push(canvas.toDataURL('image/png')); 
              console.log(`PDF ${file.name}, Page ${i}: Converted to image for OCR.`);
            } else {
              console.error(`Could not get canvas context for PDF page ${i} of ${file.name}.`);
            }
          }
           if (imagePageDataUrls.length > 0) {
            return { name: file.name, type: file.type, imagePageDataUrls, status: 'processed' };
          } else {
            if (textContent.trim()) {
                 console.log(`PDF ${file.name}: Image conversion failed, but some text was extracted. Using text content.`);
                 return { name: file.name, type: file.type, textContent: textContent.trim(), status: 'processed'};
            }
            return { name: file.name, type: file.type, status: 'error', errorMessage: 'PDF has low text content, and image conversion for OCR failed.' };
          }
        }
         console.log(`PDF ${file.name}: Processed with text extraction.`);
        return { name: file.name, type: file.type, textContent: textContent.trim(), status: 'processed' };
      } catch (e: unknown) {
        console.error(`Error processing PDF ${file.name}:`, e);
        let specificErrorMessage = "Error processing PDF.";
        if (e instanceof Error) {
            if (e.name === 'PasswordException') { 
                specificErrorMessage = 'PDF is password protected and cannot be processed.';
            } else if (e.name === 'InvalidPDFException') {
                specificErrorMessage = 'Invalid or corrupted PDF file.';
            } else {
                specificErrorMessage = `PDF Error (${e.name}): ${e.message}`;
            }
        } else {
            specificErrorMessage = String(e);
        }
        return { name: file.name, type: file.type, status: 'error', errorMessage: specificErrorMessage };
      }
    } else if (IMAGE_MIME_TYPES.includes(file.type)) {
      console.log(`Processing image file: ${file.name}`);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageDataUrl = e.target?.result as string;
          console.log(`Image ${file.name} read as data URL, length: ${imageDataUrl.length}`);
          resolve({ name: file.name, type: file.type, imagePageDataUrls: [imageDataUrl], status: 'processed' });
        };
        reader.onerror = (e) => {
          console.error(`Error reading image file ${file.name}:`, e);
          resolve({ name: file.name, type: file.type, status: 'error', errorMessage: 'Error reading image file.' });
        };
        reader.readAsDataURL(file);
      });
    } else if (file.type === 'text/plain' || file.type === 'text/markdown') {
      console.log(`Processing text file: ${file.name}`);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const textContent = e.target?.result as string;
            console.log(`Text file ${file.name} read, length: ${textContent.length}`);
            resolve({ name: file.name, type: file.type, textContent, status: 'processed' });
        };
        reader.onerror = (e) => {
            console.error(`Error reading text file ${file.name}:`, e);
            resolve({ name: file.name, type: file.type, status: 'error', errorMessage: 'Error reading text file.' });
        };
        reader.readAsText(file);
      });
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.type === 'application/msword') {
       console.log(`Processing Word document: ${file.name}`);
       return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            console.log(`Word document ${file.name} read as data URL, length: ${dataUrl.length}`);
            resolve({ name: file.name, type: file.type, textContent: dataUrl, status: 'processed' });
        };
        reader.onerror = (e) => {
            console.error(`Error reading Word document ${file.name}:`, e);
            resolve({ name: file.name, type: file.type, status: 'error', errorMessage: 'Error reading document file.' });
        };
        reader.readAsDataURL(file); 
      });
    }
    console.warn(`File type ${file.type} for ${file.name} is not explicitly handled for direct content extraction. Attempting to read as data URL for potential generic upload.`);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        console.log(`Generic file ${file.name} read as data URL, length: ${dataUrl.length}`);
        resolve({ name: file.name, type: file.type, textContent: dataUrl, status: 'processed' });
      };
      reader.onerror = (e) => {
        console.error(`Error reading generic file ${file.name}:`, e);
        resolve({ name: file.name, type: file.type, status: 'error', errorMessage: 'Error reading file data.'});
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFilesChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const currentFileCount = processedFiles.length;
      const newFilesToAdd = Array.from(files).slice(0, 5 - currentFileCount); 

      for (const file of newFilesToAdd) {
        const fileId = `${file.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).substring(2,9)}`;
        const placeholderFile: ProcessedFile = { id: fileId, name: file.name, type: file.type, originalFile: file, status: 'processing' };
        
        setProcessedFiles(prev => [...prev, placeholderFile]);

        handleFileProcessing(file).then(result => {
          setProcessedFiles(prev => prev.map(pf => pf.id === fileId ? { ...pf, ...result, status: result.status || (result.errorMessage ? 'error' : 'processed') } : pf));
        }).catch(error => {
            console.error("Error in handleFileProcessing promise chain:", error);
            setProcessedFiles(prev => prev.map(pf => pf.id === fileId ? {...pf, status: 'error', errorMessage: "Unexpected processing error."} : pf));
        });
      }
      if (fileInputRef.current) fileInputRef.current.value = ""; 
    }
  }, [processedFiles, handleFileProcessing]);

  const removeFile = (fileIdToRemove: string) => {
    setProcessedFiles(prev => prev.filter(pf => pf.id !== fileIdToRemove));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const filesForSubmission = processedFiles.filter(pf => pf.status === 'processed');
    
    if (!queryText.trim() && filesForSubmission.length === 0) {
      return;
    }
    if (processedFiles.some(pf => pf.status === 'processing')) {
      alert("Some files are still processing. Please wait.");
      return;
    }
    const filesWithErrors = processedFiles.filter(pf => pf.status === 'error');
    if (filesWithErrors.length > 0) {
        if (!confirm(`${filesWithErrors.length} file(s) had processing errors. Do you want to proceed with the successfully processed files and your query? Errors: ${filesWithErrors.map(f => `${f.name}: ${f.errorMessage}`).join(', ')}`)) {
            return;
        }
    }
    onSubmit(queryText, filesForSubmission, isWebSearchEnabled); // Pass isWebSearchEnabled
    setQueryText('');
    setProcessedFiles([]);
    // isWebSearchEnabled state persists by default, which is generally desired user experience.
    setShowSuggestions(false); 
    if (textareaRef.current) { 
        textareaRef.current.style.height = 'auto';
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQueryText(suggestion);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' && activeSuggestionIndex > -1) {
        e.preventDefault();
        handleSuggestionClick(suggestions[activeSuggestionIndex]);
        setActiveSuggestionIndex(-1); 
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !(showSuggestions && activeSuggestionIndex > -1) ) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  const toggleWebSearch = () => {
    setIsWebSearchEnabled(prev => !prev);
  };

  return (
    <div className="bg-slate-800 p-2 sm:p-3 md:p-4 border-t border-slate-700 relative">
      {processedFiles.length > 0 && (
        <div className="mb-1.5 sm:mb-2 flex flex-wrap gap-1 sm:gap-2 items-center">
          {processedFiles.map((pf) => (
            <div
              key={pf.id}
              className={`flex items-center text-[0.7rem] sm:text-xs rounded-full py-0.5 px-2 sm:py-1 sm:px-3 space-x-1 animate-fade-in transition-transform duration-150 hover:scale-105 hover:shadow-md
                ${pf.status === 'processed' ? 'bg-green-600/30 text-green-300' : ''}
                ${pf.status === 'processing' ? 'bg-yellow-600/30 text-yellow-300 animate-pulse' : ''}
                ${pf.status === 'error' ? 'bg-red-600/30 text-red-300' : ''}
              `}
              title={pf.status === 'error' ? pf.errorMessage : pf.name}
            >
              {pf.status === 'processing' && <svg className="animate-spin h-3 w-3 mr-1 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              {pf.status === 'processed' && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-current" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
              {pf.status === 'error' && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-current" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>}
              
              <span>{pf.name.length > 15 ? pf.name.substring(0,13) + '...' : pf.name}</span>
              
              <button
                type="button"
                onClick={() => removeFile(pf.id)}
                disabled={isLoading}
                className="ml-0.5 sm:ml-1 text-current hover:text-white font-bold leading-none disabled:opacity-50"
                aria-label={`Remove ${pf.name}`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end bg-slate-700 rounded-lg sm:rounded-xl p-0.5 sm:p-1 shadow-md">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || processedFiles.length >= 5} 
          className="p-2 sm:p-2.5 text-slate-400 hover:text-red-400 disabled:text-slate-600 disabled:cursor-not-allowed focus:outline-none rounded-full hover:bg-slate-600/50 transition-all duration-200 hover:scale-110 active:scale-100"
          aria-label="Upload documents"
          title="Upload documents (max 5 files)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={handleFilesChange}
          className="hidden"
          accept=".txt,.md,.pdf,.doc,.docx,application/pdf,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          disabled={isLoading || processedFiles.length >= 5}
        />

        {/* Web Search Toggle Button */}
        <button
          type="button"
          onClick={toggleWebSearch}
          disabled={isLoading}
          className={`p-2 sm:p-2.5 rounded-full focus:outline-none hover:bg-slate-600/50 transition-all duration-200 hover:scale-110 active:scale-100
            ${isWebSearchEnabled ? 'text-red-500 hover:text-red-600' : 'text-slate-400 hover:text-red-400'}
            ${isLoading ? 'disabled:text-slate-600 disabled:cursor-not-allowed' : ''}
          `}
          aria-label="Toggle Web Search"
          title={isWebSearchEnabled ? "Disable Web Search" : "Enable Web Search"}
          aria-pressed={isWebSearchEnabled}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A11.978 11.978 0 0112 13.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0021 12c0 .778-.099 1.533-.284 2.253M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          onFocus={() => queryText.trim() && suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Type your legal query..."
          className="flex-grow p-2 sm:p-2.5 bg-transparent border-none focus:ring-0 text-sm sm:text-base text-gray-100 placeholder-slate-400 resize-none overflow-y-auto min-h-9 sm:min-h-11 max-h-32 sm:max-h-40 custom-scrollbar-thin"
          disabled={isLoading}
          aria-autocomplete="list"
          aria-controls="suggestions-listbox"
          aria-activedescendant={activeSuggestionIndex > -1 ? `suggestion-${activeSuggestionIndex}` : undefined}
        />
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isLoading || (!queryText.trim() && processedFiles.filter(f=>f.status === 'processed').length === 0) || processedFiles.some(f => f.status === 'processing')}
          className="p-2 sm:p-2.5 bg-red-600 text-white rounded-md sm:rounded-lg hover:bg-red-700 disabled:bg-red-800/50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-700 transition-all duration-200 hover:scale-105 active:scale-95 ml-0.5 sm:ml-1"
          aria-label="Send message"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 sm:h-6 sm:w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          id="suggestions-listbox"
          className="absolute bottom-full left-0 right-0 mb-1 bg-slate-700 border border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto z-50 custom-scrollbar-thin animate-fade-in-scale-up"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              id={`suggestion-${index}`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setActiveSuggestionIndex(index)}
              className={`p-2 sm:p-2.5 text-xs sm:text-sm text-slate-200 hover:bg-slate-600 cursor-pointer ${activeSuggestionIndex === index ? 'bg-slate-600' : ''}`}
              role="option"
              aria-selected={activeSuggestionIndex === index} 
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}


      <div className="grid md:grid-cols-2 gap-2 sm:gap-3 mt-2 sm:mt-3">
        <div>
          <label htmlFor="chatServiceArea" className="sr-only">Service Area</label>
          <select
            id="chatServiceArea"
            value={serviceArea}
            onChange={(e) => onServiceAreaChange(e.target.value as ServiceArea)}
            className="w-full p-2 sm:p-2.5 text-xs sm:text-sm bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 text-gray-100 placeholder-slate-400 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-md"
            disabled={isLoading}
            aria-label="Select Service Area"
          >
            {Object.values(ServiceArea).map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="chatLegalTask" className="sr-only">Legal Task</label>
          <select
            id="chatLegalTask"
            value={legalTask}
            onChange={(e) => onLegalTaskChange(e.target.value as LegalTask)}
            className="w-full p-2 sm:p-2.5 text-xs sm:text-sm bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 text-gray-100 placeholder-slate-400 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-md"
            disabled={isLoading}
            aria-label="Select Legal Task"
          >
            {Object.values(LegalTask).map((taskItem) => (
              <option key={taskItem} value={taskItem}>
                {taskItem}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};