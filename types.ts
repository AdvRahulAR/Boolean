

export enum ServiceArea {
  VENTURE_CAPITAL = "Venture Capital & Startup Advisory",
  MERGERS_ACQUISITIONS = "Mergers & Acquisitions (M&A)",
  REGULATORY_GUIDANCE = "Regulatory Guidance",
  INTELLECTUAL_PROPERTY = "Intellectual Property, Media & Technology",
  VIRTUAL_GENERAL_COUNSEL = "Virtual General Counsel Services",
  LEGAL_TECH_SOLUTIONS = "Legal Tech Solutions",
  CASE_LAW_ANALYSIS = "Case Law & Judgment Analysis", // Added new service area
}

export enum LegalTask {
  GENERAL_QUERY = "General Legal Q&A",
  DRAFT_DOCUMENT = "Draft Document / Clause",
  SUMMARIZE_LEGAL_CONCEPT = "Summarize Legal Concept",
  LEGAL_RESEARCH = "Legal Research & Updates",
  COMPLIANCE_CHECKLIST = "Compliance Checklist/Guidance",
  ANALYZE_CONTRACT_RISKS = "Analyze Contract for Risks & Issues",
  REVIEW_COMPLIANCE_AGAINST_DOCUMENT = "Review Document for Compliance",
  SUMMARIZE_UPLOADED_DOCUMENT_KEY_POINTS = "Summarize Uploaded Document (Key Points)",
  EXTRACT_DEFINITIONS_OBLIGATIONS_FROM_DOCUMENT = "Extract Definitions & Obligations from Document",
}

export interface ProcessedFile {
  id: string; 
  name: string;
  type: string; 
  originalFile: File; 
  status: 'pending' | 'processing' | 'processed' | 'error';
  textContent?: string; 
  imagePageDataUrls?: string[]; 
  errorMessage?: string;
}

export interface QueryPayload {
  serviceArea: ServiceArea;
  task: LegalTask;
  userQuery: string;
  webContext?: string; // Remains for potential other uses, but not primary for this feature
  fileName?: string; 
  documentTextContent?: string; 
  documentImagePages?: string[]; 
  documentMimeType?: string; 
  chatHistory?: ChatMessage[];
  enableGoogleSearch?: boolean; // Added to control Gemini's googleSearch tool
}

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web: GroundingChunkWeb;
}

export interface AIResponse {
  text: string;
  sources?: GroundingChunk[];
  rawResponse?: any; 
  fileName?: string; 
}


export enum FeedbackCategory {
  ACCURACY = "Accuracy Issue",
  CLARITY = "Clarity Needed",
  MISSING_INFO = "Missing Information",
  SUGGESTION = "Suggestion",
  POSITIVE = "Positive Feedback",
  OTHER = "Other",
}

// --- Chat History Types ---

export interface ProcessedFileInfoForChat {
  name: string;
  type: string;
  size: number;
}

export interface UserQueryMessage {
  id:string;
  role: 'user';
  timestamp: number;
  serviceArea: ServiceArea; 
  legalTask: LegalTask;     
  queryText: string;
  filesInfo?: ProcessedFileInfoForChat[]; 
}

export interface AIResponseMessage extends AIResponse {
  id: string;
  role: 'ai';
  timestamp: number;
}

export interface SystemMessage {
  id: string;
  role: 'system';
  timestamp: number;
  text: string; 
}

export type ChatMessage = UserQueryMessage | AIResponseMessage | SystemMessage;

export interface ChatSession {
  id: string; 
  title: string; 
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  initialServiceArea?: ServiceArea; 
  initialLegalTask?: LegalTask;   
}