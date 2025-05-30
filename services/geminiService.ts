import { GoogleGenAI, GenerateContentResponse, GenerateContentParameters, Tool, Part, Content } from "@google/genai";
import { ServiceArea, LegalTask, AIResponse, GroundingChunk, QueryPayload, ChatMessage, UserQueryMessage, AIResponseMessage } from '../types';
import { GEMINI_TEXT_MODEL } from '../constants';

if (!import.meta.env.VITE_GEMINI_API_KEY) {
  console.warn(
    "VITE_GEMINI_API_KEY environment variable not found. Gemini API calls will likely fail."
  );
}

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

interface ChatContextPayload extends QueryPayload {
  chatHistory?: ChatMessage[];
}

type AnalysisTarget = 'text content' | 'image pages' | 'base64 document' | 'mixed content' | 'uploaded image file';


const BASE_SYSTEM_INSTRUCTION = `You are the Boolean Legal AI Assistant, a specialized legal advisor focusing on Indian law. Engage in a helpful and professional chatbot conversation.
Your primary jurisdiction is Indian law. If information about other jurisdictions is requested, clearly state the jurisdiction and always add a disclaimer to consult with a qualified local counsel.
When citing sources or legal provisions, use provided web context (if any) or publicly verifiable information (e.g., "Section X of Indian Contract Act, 1872"). Do not invent citations.
If a query is too complex, ambiguous, or requires definitive legal advice beyond your capabilities as an AI, clearly state that it requires review by a qualified human lawyer at Boolean Legal. Do not provide definitive legal advice.
Maintain a professional, precise, and chatbot-friendly tone.
When documents are uploaded or discussed, refer to them by their file names if mentioned in the chat.
Pay close attention to the current ServiceArea and LegalTask selected by the user for their query, as well as the history of the conversation.
`;

const buildChatContents = (
  payload: ChatContextPayload,
  chatHistory: ChatMessage[] = []
): Content[] => {
  const {
    serviceArea, 
    task,        
    userQuery,   
    fileName,
    documentTextContent,
    documentImagePages,
    documentMimeType,
    webContext // This might still be used if manually populated, but not by App.tsx's new toggle logic
  } = payload;

  const historyContents: Content[] = chatHistory
    .map((msg): Content | null => {
      let role: 'user' | 'model';
      let textForApi = '';

      if (msg.role === 'user') {
        role = 'user';
        const userMsg = msg as UserQueryMessage;
        textForApi = `Context: Service Area was "${userMsg.serviceArea}", Legal Task was "${userMsg.legalTask}".\nQuery: ${userMsg.queryText}`;
        if (userMsg.filesInfo && userMsg.filesInfo.length > 0) {
          textForApi += `\n(User had attached files: ${userMsg.filesInfo.map(f => f.name).join(', ')})`;
        }
        return { role, parts: [{ text: textForApi }] };
      } else if (msg.role === 'ai') {
        role = 'model';
        const aiMsg = msg as AIResponseMessage;
        textForApi = aiMsg.text;
        // Include sources if they exist, as this is part of AI's previous turn
        if (aiMsg.sources && aiMsg.sources.length > 0) {
            const sourcesText = aiMsg.sources.map((s, i) => `${i+1}. ${s.web.title || s.web.uri} (${s.web.uri})`).join('\n');
            textForApi += `\n\nWeb Search Sources Provided in Previous Turn:\n${sourcesText}`;
        }
        return { role, parts: [{ text: textForApi }] };
      } else if (msg.role === 'system') {
        return null;
      } else {
        console.warn(`buildChatContents: Unexpected message role encountered: ${(msg as any).role}`);
        return null;
      }
    })
    .filter((content): content is Content => content !== null);


  const currentUserMessageParts: Part[] = [];
  let userQueryTextForAPI = `Considering the ongoing conversation, and for the current context of Service Area: "${serviceArea}" and Legal Task: "${task}". My query is: "${userQuery}"`;

  if (fileName && (documentTextContent || (documentImagePages && documentImagePages.length > 0))) {
    let analysisTarget: AnalysisTarget = 'mixed content';
    if (documentTextContent && documentMimeType && (documentMimeType.includes('wordprocessingml') || documentMimeType.includes('msword'))) {
        analysisTarget = 'base64 document';
    } else if (documentMimeType?.startsWith('image/') && documentImagePages && documentImagePages.length > 0) {
        analysisTarget = 'uploaded image file';
    } else if (documentTextContent && (!documentImagePages || documentImagePages.length === 0)) {
        analysisTarget = 'text content';
    } else if (!documentTextContent && (documentImagePages && documentImagePages.length > 0)) {
        analysisTarget = 'image pages';
    } else if (documentTextContent && documentImagePages && documentImagePages.length > 0) {
        analysisTarget = 'mixed content';
    }
    console.log(`geminiService: Determined analysisTarget for current query: ${analysisTarget} for file ${fileName} (MIME: ${documentMimeType})`);

    userQueryTextForAPI += `\n\nPlease analyze the attached file(s) named "${fileName}" (provided as ${analysisTarget}) in relation to my query. Focus on:
1. Overview of the document/image.
2. Relevance to my query, the current service area, and task.
3. Key findings or insights.
${serviceArea === ServiceArea.CASE_LAW_ANALYSIS ? "4. For judgments: Factual Matrix, Issues, Reasoning, Ratio Decidendi, Final Order." : ""}
---
`;
    currentUserMessageParts.push({ text: userQueryTextForAPI });

    if (documentTextContent) {
      if (documentTextContent.startsWith('data:') && documentMimeType) {
         console.log(`geminiService: Adding base64 inlineData part for ${fileName}, MIME: ${documentMimeType}`);
         const base64Data = documentTextContent.substring(documentTextContent.indexOf(',') + 1);
         currentUserMessageParts.push({ inlineData: { mimeType: documentMimeType, data: base64Data } });
      } else {
         console.log(`geminiService: Adding text part for ${fileName}`);
         currentUserMessageParts.push({ text: `\n--- Start of Uploaded Document Text (${fileName}) ---\n${documentTextContent}\n--- End of Uploaded Document Text (${fileName}) ---` });
      }
    }
    if (documentImagePages && documentImagePages.length > 0) {
      console.log(`geminiService: Adding ${documentImagePages.length} image page(s) for ${fileName}. Assumed MIME for these parts: ${documentMimeType?.startsWith('image/') ? documentMimeType : 'image/png'}`);
      currentUserMessageParts.push({ text: `\n--- Start of Uploaded Document Images/Pages (${fileName}) ---`});
      documentImagePages.forEach((imageDataUrl, index) => {
        const base64Data = imageDataUrl.substring(imageDataUrl.indexOf(',') + 1);
        const imagePartMimeType = documentMimeType?.startsWith('image/') ? documentMimeType : 'image/png';
        currentUserMessageParts.push({ text: `${analysisTarget === 'uploaded image file' ? 'Uploaded Image:' : `Image Page ${index + 1}:`}` });
        currentUserMessageParts.push({ inlineData: { mimeType: imagePartMimeType, data: base64Data } });
      });
      currentUserMessageParts.push({ text: `\n--- End of Uploaded Document Images/Pages (${fileName}) ---`});
    }
  } else {
    if (webContext) { // If webContext was somehow provided (e.g. by a different future mechanism)
      userQueryTextForAPI += `\n\nRelevant Context from Web Search (use critically):\n${webContext}`;
    }
    currentUserMessageParts.push({ text: userQueryTextForAPI });
  }

  const finalContents = [...historyContents, { role: 'user', parts: currentUserMessageParts }];

  const loggableFinalContents = finalContents.map(c => ({
    role: c.role,
    parts: c.parts.map(p => {
      if (p.text && p.text.length > 100) {
        return { text: p.text.substring(0, 100) + "[truncated]" };
      }
      if (p.inlineData && typeof p.inlineData.data === 'string' && p.inlineData.data.length > 100) {
        return { inlineData: { mimeType: p.inlineData.mimeType, data: "[truncated]" } };
      }
      return p;
    })
  }));
  console.log("geminiService: Constructed contents for API:", JSON.stringify(loggableFinalContents, null, 2));
  return finalContents;
};


export const getAIResponse = async (payload: ChatContextPayload): Promise<AIResponse> => {
  const {
    serviceArea,
    task,
    // userQuery, // Keep for system instruction context // Not directly used here, but part of payload for buildChatContents
    fileName, 
    chatHistory = [],
    enableGoogleSearch // Destructure the new flag
  } = payload;

  const contentsForApi = buildChatContents(payload, chatHistory);
  
  let apiConfig: GenerateContentParameters['config'] = {};

  if (enableGoogleSearch) {
    console.log("geminiService: Web search enabled. Config will only include 'tools'. System instruction and other model params omitted for search grounding.");
    apiConfig.tools = [{ googleSearch: {} }];
    // As per Gemini guidelines, when using googleSearch, the config should ideally only contain `tools`.
    // Other parameters like systemInstruction, temperature, topP, topK are omitted.
  } else {
    const systemInstructionText = `${BASE_SYSTEM_INSTRUCTION}\nCurrent Service Area (for this specific query): ${serviceArea}.\nCurrent LegalTask (for this specific query): ${task}.`;
    apiConfig.systemInstruction = systemInstructionText;
    apiConfig.temperature = 0.45;
    apiConfig.topP = 0.9;
    apiConfig.topK = 40;
  }

  const generateParams: GenerateContentParameters = {
    model: GEMINI_TEXT_MODEL,
    contents: contentsForApi,
    config: apiConfig, // Use the conditionally built config
  };
  
  try {
    let loggableParams = {...generateParams};
    if (Array.isArray(loggableParams.contents)) { 
        const loggableContents = loggableParams.contents.map(contentItem => ({
            ...contentItem,
            parts: contentItem.parts.map(part => {
                if ('inlineData' in part && part.inlineData?.data && typeof part.inlineData.data === 'string' && part.inlineData.data.length > 200) {
                    return {...part, inlineData: {...part.inlineData, data: part.inlineData.data.substring(0,100) + "...[truncated]"}};
                }
                if ('text' in part && part.text && part.text.length > 500) {
                    return {...part, text: part.text.substring(0, 400) + "...[truncated]"};
                }
                return part;
            })
        }));
        loggableParams = {...generateParams, contents: loggableContents};
    }
    console.log("Sending to Gemini with params (multi-turn history included):", JSON.stringify(loggableParams, null, 2));

    const response: GenerateContentResponse = await ai.models.generateContent(generateParams);
    
    console.log("Raw Gemini response object:", JSON.stringify(response, null, 2));

    if (!response) {
        console.error("Gemini API call returned undefined/null response object.");
        throw new Error("Gemini API returned an invalid response object.");
    }

    if (response.promptFeedback?.blockReason) {
      const blockMessage = `AI response was blocked. Reason: ${response.promptFeedback.blockReason}. Please revise your query or uploaded content.`;
      console.warn(blockMessage, response.promptFeedback);
      return { text: blockMessage, sources: [], rawResponse: response, fileName };
    }

    if (response.candidates && response.candidates.length > 0) {
        const mainCandidate = response.candidates[0];
        if (mainCandidate.finishReason && mainCandidate.finishReason !== 'STOP' && mainCandidate.finishReason !== 'MAX_TOKENS') {
            console.warn(`Gemini response candidate finished with reason: ${mainCandidate.finishReason}`, mainCandidate);
            const safetyMessage = (mainCandidate.safetyRatings && mainCandidate.safetyRatings.length > 0) ?
                `Safety details: ${mainCandidate.safetyRatings.map(r => `${r.category} - ${r.probability}`).join(', ')}` :
                'No specific safety details provided.';
            return {
                text: `AI response generation was interrupted or flagged. Reason: ${mainCandidate.finishReason}. ${mainCandidate.finishReason === 'SAFETY' ? safetyMessage : 'Please review your input.'}`,
                sources: [],
                rawResponse: response,
                fileName
            };
        }
    } else if (!response.promptFeedback?.blockReason) { 
        console.warn("Gemini returned no candidates and was not blocked by promptFeedback. This might indicate an issue. Full response:", response);
        if (typeof response.text === 'string' && response.text.trim() !== "") {
             console.log("Gemini response has text despite no candidates. Using text property.");
        } else {
             return { text: "AI returned no actionable response or candidates. Please try rephrasing or check the uploaded content and API logs.", sources: [], rawResponse: response, fileName };
        }
    }
    
    const text = response.text; 
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
    
    console.log("Gemini response received. Text extracted successfully. Text length:", text?.length);
    if (sources) console.log("Grounding sources:", sources.length);

    if (typeof text !== 'string' || text.trim() === "") {
        if (!response.promptFeedback?.blockReason && !(response.candidates && response.candidates.some(c => c.finishReason !== 'STOP' && c.finishReason !== 'MAX_TOKENS'))) {
            console.warn("Gemini response text is empty or not a string, despite no explicit block/error reason. Full response:", response);
        }
        return { text: text || "AI returned a response, but the content is empty.", sources, rawResponse: response, fileName };
    }

    return { text, sources, rawResponse: response, fileName };

  } catch (error) {
    console.error("Gemini API call failed:", error);
    let errorMessage = "Unknown error calling Gemini API.";
    if (error instanceof Error) {
        errorMessage = `Gemini API error: ${error.message}`;
        if (error.message.includes("API_KEY_INVALID") || error.message.includes("permission") || error.message.includes("API key not valid")) {
             errorMessage = `API Key error: ${error.message}. Ensure API key is correct and has permissions.`;
        }
        if ('cause' in error && typeof (error as any).cause === 'object' && (error as any).cause !== null) {
            console.error("Gemini API Error Cause:", (error as any).cause);
            const causeDetails = JSON.stringify((error as any).cause);
            errorMessage += ` Details: ${causeDetails}`;
        } else if ('response' in error && typeof (error as any).response === 'object' && (error as any).response !== null) {
             console.error("Gemini API Error Response (from caught error object):", (error as any).response);
             const responseDetails = JSON.stringify((error as any).response);
             errorMessage += ` Response Details: ${responseDetails}`;
        }
    } else if (typeof error === 'object' && error !== null) {
        console.error("Gemini API call failed with non-Error object:", error);
        errorMessage = `Gemini API error: ${JSON.stringify(error)}`;
    }
    throw new Error(errorMessage);
  }
};