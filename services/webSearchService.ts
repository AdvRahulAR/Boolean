
// This is a MOCKED web search service.
// In a real application, this would integrate with a proper search API (e.g., Google Custom Search).

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

// Simulates fetching legal information from the web.
export const mockFetchLegalInfo = async (query: string): Promise<string> => {
  console.log(`Simulating web search for: ${query}`);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 700));

  // Mocked results - tailor these for better simulation if needed
  const mockResults: SearchResult[] = [];

  if (query.toLowerCase().includes("dora compliance")) {
    mockResults.push(
      {
        title: "Understanding DORA Compliance for Financial Entities - Official EU Overview",
        link: "https://example.com/dora-eu-overview",
        snippet: "The Digital Operational Resilience Act (DORA) aims to enhance IT security of financial entities in the EU..."
      },
      {
        title: "Key Aspects of DORA for SaaS Providers in India - Legal Perspective",
        link: "https://example.com/dora-saas-india",
        snippet: "Indian SaaS companies serving EU financial clients must understand DORA's implications for third-party ICT risk management..."
      }
    );
  } else if (query.toLowerCase().includes("venture capital trends india")) {
     mockResults.push(
      {
        title: "Latest Venture Capital Investment Trends in India 2024 - TechCrunch",
        link: "https://example.com/vc-trends-india-2024",
        snippet: "Seed stage funding sees a rise in fintech and SaaS. Later stage deals are becoming more selective..."
      },
      {
        title: "Regulatory Landscape for VC Funding in India - SEBI Guidelines",
        link: "https://example.com/sebi-vc-guidelines",
        snippet: "SEBI's AIF regulations govern venture capital funds in India, outlining compliance and reporting requirements..."
      }
    );
  } else {
    mockResults.push({
      title: "General Legal Information Portal - India",
      link: "https://example.com/indian-legal-portal",
      snippet: "A comprehensive resource for Indian laws, statutes, and legal news."
    });
  }

  if (mockResults.length === 0) {
    return "No specific web search context found for this query through mock search.";
  }

  // Format the mock results into a string context for the AI
  let context = "Web Search Snippets:\n";
  mockResults.forEach((result, index) => {
    context += `${index + 1}. Title: ${result.title}\n   Snippet: ${result.snippet}\n   Source: ${result.link}\n\n`;
  });
  
  return context.trim();
};
    