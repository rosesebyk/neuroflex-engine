import React, { useState, useEffect } from 'react';
import Flowchart from './Flowchart';

// Configure PDF.js Worker
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ==========================================
// 🧠 SMART NLP HEURISTICS (Local Engine)
// ==========================================

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will',
  'with', 'this', 'but', 'they', 'have', 'had', 'what', 'when', 'where',
  'who', 'which', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'can', 'just', 'should', 'now', 'also', 'into', 'over'
]);

const extractKeywords = (text) => {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  const freqMap = {};
  words.forEach(w => {
    if (w.length > 3 && !STOP_WORDS.has(w)) {
      freqMap[w] = (freqMap[w] || 0) + 1;
    }
  });
  return freqMap;
};

const scoreSentences = (text) => {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 15);
  const freqMap = extractKeywords(text);

  return sentences.map(sentence => {
    const words = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
    let score = 0;
    words.forEach(w => { if (freqMap[w]) score += freqMap[w]; });
    const normalizedScore = words.length > 0 ? score / words.length : 0;
    return { sentence, score: normalizedScore };
  }).sort((a, b) => b.score - a.score);
};

const extractSmartFlowchart = (text) => {
  const rawChunks = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 12);
  if (rawChunks.length === 0) {
    return [{ id: 1, step: "01", title: "Content Analysis", detail: "Document loaded into visual workspace.", icon: "⚡" }];
  }

  const icons = ["🎯", "⚡", "🔄", "💡", "🚀", "📊"];
  const selectedChunks = rawChunks.slice(0, 5);

  return selectedChunks.map((chunk, idx) => {
    const words = chunk.split(/\s+/);
    const nonStopWords = words.filter(w => !STOP_WORDS.has(w.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')));
    
    let title = "Core Concept";
    if (nonStopWords.length >= 2) {
      title = nonStopWords.slice(0, 3).join(' ').replace(/[^a-zA-Z0-9\s]/g, '');
      title = title.charAt(0).toUpperCase() + title.slice(1);
    } else if (words.length > 0) {
      title = words.slice(0, 2).join(' ').replace(/[^a-zA-Z0-9\s]/g, '');
    }

    return {
      id: idx + 1,
      step: `0${idx + 1}`,
      title: title || `Key Point ${idx + 1}`,
      detail: chunk.length > 85 ? chunk.substring(0, 82) + '...' : chunk,
      icon: icons[idx % icons.length]
    };
  });
};

const extractSmartSummary = (text) => {
  const scored = scoreSentences(text);
  if (scored.length === 0) return ["No structured text blocks found."];
  return scored.slice(0, 3).map(item => item.sentence);
};

const synthesizeELI5 = (text) => {
  const scored = scoreSentences(text);
  const freqMap = extractKeywords(text);
  const topWords = Object.keys(freqMap).sort((a, b) => freqMap[b] - freqMap[a]).slice(0, 3);

  if (scored.length === 0) return "This section contains minimal text or bullet point data.";
  
  const topSentence = scored[0].sentence;
  if (topWords.length > 0) {
    return `In plain terms: this section focuses on ${topWords.join(', ')}. Core takeaway: "${topSentence}"`;
  }
  return `Core takeaway: ${topSentence}`;
};

const extractJargonTerms = (text) => {
  const freqMap = extractKeywords(text);
  return Object.keys(freqMap)
    .filter(word => word.length >= 6)
    .sort((a, b) => freqMap[b] - freqMap[a])
    .slice(0, 5)
    .map(w => w.toUpperCase());
};

// ==========================================
// 🤖 OPENAI API INTEGRATION
// ==========================================

const fetchOpenAIAnalysis = async (text, apiKey) => {
  const prompt = `
    Analyze the following slide text and return ONLY valid JSON with this exact structure:
    {
      "flowchart": [
        {"id": 1, "step": "01", "title": "2-4 word Title", "detail": "1 concise sentence detail", "icon": "emoji"},
        {"id": 2, "step": "02", "title": "2-4 word Title", "detail": "1 concise sentence detail", "icon": "emoji"},
        {"id": 3, "step": "03", "title": "2-4 word Title", "detail": "1 concise sentence detail", "icon": "emoji"}
      ],
      "summary": [
        "Concise summary point 1",
        "Concise summary point 2",
        "Concise summary point 3"
      ],
      "eli5": "Simple 2-sentence explanation of what this slide actually means.",
      "jargon": ["TERM1", "TERM2", "TERM3"]
    }

    Slide Text:
    """${text}"""
  `;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an AI assistant that extracts structured concepts into strict JSON format.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error?.message || 'OpenAI API request failed.');
  }

  const data = await res.json();
  const rawJson = data.choices[0].message.content;
  return JSON.parse(rawJson);
};

// ==========================================
// 🎨 ACCESSIBLE BIONIC FORMATTER (WCAG Compliant)
// ==========================================
// Uses stark typographic weight (Bold Black / Bold White) rather than visual purple noise.

const renderBionicText = (text, isDark) => {
  return text.split(' ').map((word, i) => {
    const match = word.match(/^([a-zA-Z0-9]+)(.*)$/);
    if (!match) return <span key={i}>{word} </span>;
    
    const [, coreWord, punctuation] = match;
    const mid = Math.ceil(coreWord.length / 2);
    const boldPart = coreWord.slice(0, mid);
    const restPart = coreWord.slice(mid);

    return (
      <span key={i}>
        <strong className={`font-extrabold ${isDark ? 'text-white' : 'text-black'}`}>
          {boldPart}
        </strong>
        <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{restPart}</span>
        {punctuation}{' '}
      </span>
    );
  });
};

// ==========================================
// 📱 INITIAL DEMO DATA
// ==========================================

const INITIAL_DOC = {
  1: {
    title: "Cognitive Load in Information Design",
    cards: [
      "Over 15-20% of the global population experiences neurodivergent traits including ADHD, Dyslexia, and sensory fatigue.",
      "Dense, unformatted document blocks increase visual strain and trigger cognitive line tracking failure within 5 minutes of continuous reading.",
      "Micro-card chunking combined with automated flowchart extraction reduces cognitive load while preserving core logical retention."
    ],
    flowchart: [
      { id: 1, step: "01", title: "Identify Friction", detail: "Dense text triggers visual tracking failure and cognitive exhaustion.", icon: "🧠" },
      { id: 2, step: "02", title: "Parse Structure", detail: "Saliency scoring isolates key terms and semantic concepts.", icon: "⚡" },
      { id: 3, step: "03", title: "Map Dependencies", detail: "Sequential nodes display high-level logical flow.", icon: "🗺️" },
      { id: 4, step: "04", title: "Optimize Retention", detail: "Chunked micro-cards double reading speed and comprehension.", icon: "🎯" }
    ],
    summary: [
      "Traditional text blocks cause rapid visual strain and tracking loss.",
      "Concept-level extraction reduces friction by mapping dependencies visually.",
      "Micro-card chunking maintains reader focus and cognitive retention."
    ],
    eli5: "Instead of forcing your brain to wade through walls of text, this system strips out the filler, maps the core steps visually, and gives you bite-sized summary cards.",
    jargon: ["NEURODIVERGENT", "RETENTION", "SALIENCY", "CHUNKING"]
  }
};

// ==========================================
// 🚀 MAIN APPLICATION
// ==========================================

export default function App() {
  const [pages, setPages] = useState(INITIAL_DOC);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFlowchart, setShowFlowchart] = useState(true);
  const [isFlowchartFullscreen, setIsFlowchartFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Settings State
  const [apiKey, setApiKey] = useState("");
  const [useAI, setUseAI] = useState(false);
  const [isDyslexicFont, setIsDyslexicFont] = useState(false);
  const [isBionic, setIsBionic] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [fileName, setFileName] = useState("Sample_Presentation.pptx");

  // Screen Reader Accessibility Announcement State
  const [announcement, setAnnouncement] = useState("Document loaded successfully.");

  const pageCount = Object.keys(pages).length;
  const currentPageData = pages[currentPage] || pages[1];

  // Helper for screen reader notifications
  const announce = (msg) => setAnnouncement(msg);

  const createMicroCards = (rawText) => {
    const paragraphs = rawText
      .split(/(?<=\.)\s+|\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 10);
    return paragraphs.length > 0 ? paragraphs : [rawText];
  };

  const processTextForPage = async (pageText, pageNum, docName) => {
    const cards = createMicroCards(pageText);

    if (useAI && apiKey.trim().length > 0) {
      try {
        const aiResult = await fetchOpenAIAnalysis(pageText, apiKey);
        return {
          title: `Slide ${pageNum}: ${docName}`,
          cards,
          flowchart: aiResult.flowchart || extractSmartFlowchart(pageText),
          summary: aiResult.summary || extractSmartSummary(pageText),
          eli5: aiResult.eli5 || synthesizeELI5(pageText),
          jargon: aiResult.jargon || extractJargonTerms(pageText)
        };
      } catch (err) {
        console.warn("AI Generation failed, falling back to local NLP engine:", err);
      }
    }

    return {
      title: `Slide ${pageNum}: ${docName}`,
      cards,
      flowchart: extractSmartFlowchart(pageText),
      summary: extractSmartSummary(pageText),
      eli5: synthesizeELI5(pageText),
      jargon: extractJargonTerms(pageText)
    };
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    announce(`Uploading and processing file ${file.name}...`);
    setFileName(file.name);
    const ext = file.name.split('.').pop().toLowerCase();
    const newPages = {};

    try {
      if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          
          newPages[i] = await processTextForPage(pageText, i, file.name);
        }
      } else if (ext === 'pptx') {
        const zip = await window.JSZip.loadAsync(file);
        const slideFiles = Object.keys(zip.files)
          .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
          .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)[0] || 0);
            const numB = parseInt(b.match(/\d+/)[0] || 0);
            return numA - numB;
          });

        let slideIndex = 1;
        for (const slidePath of slideFiles) {
          const xmlText = await zip.files[slidePath].async('text');
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
          const textNodes = Array.from(xmlDoc.getElementsByTagName('a:t'))
            .map(node => node.textContent.trim())
            .filter(t => t.length > 0);

          const fullSlideText = textNodes.join(' ');
          newPages[slideIndex] = await processTextForPage(fullSlideText, slideIndex, file.name);
          slideIndex++;
        }
      }

      if (Object.keys(newPages).length > 0) {
        setPages(newPages);
        setCurrentPage(1);
        announce(`Successfully processed ${Object.keys(newPages).length} slides from ${file.name}.`);
      }
    } catch (err) {
      console.error("Error parsing document:", err);
      announce("Error reading file format.");
      alert("Error reading file format.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    announce(`Navigated to page ${newPage} of ${pageCount}`);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans selection:bg-indigo-500 selection:text-white ${
      isDarkMode ? 'bg-[#0B0F19] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
    }`}>
      
      {/* 🔊 WCAG 2.1 Screen Reader Live Region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* ⌨️ WCAG 2.4.1 Skip Link for Keyboard Users */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:p-3 focus:bg-indigo-700 focus:text-white focus:rounded-xl focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Background Ambience */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-1/3 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className={`border-b sticky top-0 z-30 backdrop-blur-xl transition-colors ${
        isDarkMode ? 'border-slate-800/80 bg-[#0B0F19]/80' : 'border-slate-200 bg-white/90 shadow-sm'
      }`} role="banner">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-teal-400 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center text-lg" aria-hidden="true">
                ⚡
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-base font-extrabold tracking-tight ${
                  isDarkMode ? 'text-slate-100' : 'text-slate-900'
                }`}>
                  NeuroFlex Engine
                </h1>
                {/* Contrast boost in light mode: text-indigo-700 (7.1:1 ratio) */}
                <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
                  isDarkMode 
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                    : 'bg-indigo-50 text-indigo-800 border-indigo-300'
                }`}>
                  v3.2 Canvas
                </span>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Semantic Document & Flowchart Visualizer
              </p>
            </div>
          </div>

          {/* Controls & Engine Toggles */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 p-1.5 rounded-xl border text-xs ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-100 border-slate-300'
            }`}>
              <button 
                onClick={() => {
                  setUseAI(!useAI);
                  announce(`Switched engine to ${!useAI ? 'OpenAI' : 'Local NLP'}`);
                }}
                aria-pressed={useAI}
                className={`px-2.5 py-1 rounded-lg font-bold transition focus-visible:ring-2 ${
                  useAI 
                    ? 'bg-indigo-700 text-white' 
                    : isDarkMode 
                      ? 'text-slate-300 hover:text-slate-100' 
                      : 'text-slate-800 hover:text-slate-950'
                }`}
              >
                {useAI ? "🤖 OpenAI Engine" : "⚡ Local Engine"}
              </button>

              {useAI && (
                <input 
                  type="password" 
                  aria-label="OpenAI API Key"
                  placeholder="Paste OpenAI Key..." 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className={`border px-2 py-1 rounded-lg text-xs focus:outline-none focus:border-indigo-600 w-36 ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              )}
            </div>

            <label className="cursor-pointer group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-teal-400 rounded-xl blur opacity-30 group-hover:opacity-75 transition duration-300"></div>
              <div className={`relative px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition ${
                isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
              }`}>
                <span>{isLoading ? "⏳ Extracting..." : `📄 ${fileName}`}</span>
                <input 
                  type="file" 
                  accept=".pdf,.pptx" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={isLoading}
                />
              </div>
            </label>

            <div className="h-4 w-[1px] bg-slate-700/40 hidden sm:block" />

            {/* Accessibility Controls */}
            <div className={`flex items-center gap-1.5 p-1 rounded-xl border text-xs font-medium ${
              isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
            }`} role="group" aria-label="Accessibility options">
              <button 
                onClick={() => {
                  setIsDyslexicFont(!isDyslexicFont);
                  announce(`Dyslexia font ${!isDyslexicFont ? 'enabled' : 'disabled'}`);
                }}
                aria-pressed={isDyslexicFont}
                className={`px-3 py-1.5 rounded-lg transition focus-visible:ring-2 ${
                  isDyslexicFont 
                    ? 'bg-indigo-700 text-white shadow-md' 
                    : isDarkMode 
                      ? 'text-slate-300 hover:text-white' 
                      : 'text-slate-700 hover:text-black font-semibold'
                }`}
              >
                OpenDyslexic
              </button>

              <button 
                onClick={() => {
                  setIsBionic(!isBionic);
                  announce(`Bionic Reading mode ${!isBionic ? 'enabled' : 'disabled'}`);
                }}
                aria-pressed={isBionic}
                className={`px-3 py-1.5 rounded-lg transition focus-visible:ring-2 ${
                  isBionic 
                    ? 'bg-teal-700 text-white shadow-md font-bold' 
                    : isDarkMode 
                      ? 'text-slate-300 hover:text-white' 
                      : 'text-slate-700 hover:text-black font-semibold'
                }`}
              >
                Bionic
              </button>

              <button 
                onClick={() => {
                  setIsDarkMode(!isDarkMode);
                  announce(`Switched to ${!isDarkMode ? 'Dark' : 'Light'} theme`);
                }}
                aria-label={`Switch to ${isDarkMode ? 'Light' : 'Dark'} theme`}
                className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition focus-visible:ring-2"
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main id="main-content" className="max-w-7xl mx-auto px-6 py-8 space-y-6 relative z-10">
        
        {/* 📊 GRAPHICAL FLOWCHART DRAWER */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setShowFlowchart(!showFlowchart);
                  announce(`Flowchart diagram ${!showFlowchart ? 'expanded' : 'collapsed'}`);
                }}
                aria-expanded={showFlowchart}
                className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs tracking-wider uppercase flex items-center gap-3 transition-all duration-300 shadow-lg focus-visible:ring-2 ${
                  showFlowchart 
                    ? 'bg-gradient-to-r from-indigo-700 to-teal-600 text-white shadow-indigo-500/25' 
                    : isDarkMode 
                      ? 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-indigo-400' 
                      : 'bg-white hover:bg-slate-100 border border-slate-300 text-indigo-800'
                }`}
              >
                <span className="text-sm" aria-hidden="true">{showFlowchart ? '🔽' : '📊'}</span>
                <span>{showFlowchart ? "Hide Visual Concept Diagram" : "View Visual Concept Diagram"}</span>
              </button>

              {showFlowchart && (
                <button
                  onClick={() => setIsFlowchartFullscreen(true)}
                  className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 border transition focus-visible:ring-2 ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' 
                      : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <span aria-hidden="true">⛶</span>
                  <span>Expand Fullscreen</span>
                </button>
              )}
            </div>

            {showFlowchart && (
              <span className={`text-xs font-semibold flex items-center gap-2 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-700'
              }`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                Interactive Concept Flowchart
              </span>
            )}
          </div>

          {/* Inline Flowchart Drawer */}
          {showFlowchart && !isFlowchartFullscreen && (
            <section 
              aria-label="Interactive concept flowchart" 
              className={`p-6 rounded-3xl border transition-all duration-300 relative overflow-hidden shadow-2xl h-[450px] ${
                isDarkMode 
                  ? 'bg-slate-900/80 border-slate-800/80 backdrop-blur-xl shadow-slate-950/50' 
                  : 'bg-white border-slate-300 shadow-slate-200/80'
              }`}
            >
              <Flowchart data={currentPageData.flowchart} />
            </section>
          )}
        </div>

        {/* 📚 READING CARDS & SIDEBAR */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Micro-Cards Reading Area */}
          <section className="lg:col-span-7 space-y-6" aria-labelledby="cards-section-heading">
            <h2 id="cards-section-heading" className="sr-only">Document Micro-Cards</h2>
            
            {/* Pagination Controls */}
            <nav 
              aria-label="Slide pagination" 
              className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm ${
                isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-300'
              }`}
            >
              <button 
                onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                aria-label="Previous Page"
                className={`px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-30 transition focus-visible:ring-2 ${
                  isDarkMode 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' 
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
                }`}
              >
                ◄ Previous
              </button>

              <div className="text-center">
                <span className={`text-xs font-bold uppercase tracking-wider block ${
                  isDarkMode ? 'text-indigo-400' : 'text-indigo-800'
                }`}>
                  Slide Navigation
                </span>
                <span className={`text-sm font-extrabold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                  Page {currentPage} of {pageCount}
                </span>
              </div>

              <button 
                onClick={() => handlePageChange(Math.min(currentPage + 1, pageCount))}
                disabled={currentPage === pageCount}
                aria-label="Next Page"
                className={`px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-30 transition focus-visible:ring-2 ${
                  isDarkMode 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' 
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
                }`}
              >
                Next ►
              </button>
            </nav>

            {/* Micro Cards */}
            <div className="space-y-4" role="feed" aria-busy={isLoading}>
              {currentPageData.cards.map((text, idx) => (
                <article 
                  key={idx}
                  tabIndex={0}
                  aria-label={`Block ${idx + 1} of ${currentPageData.cards.length}`}
                  className={`p-6 rounded-2xl border transition-all duration-300 focus:outline-none focus-visible:ring-4 ${
                    isDarkMode 
                      ? 'bg-slate-900/40 border-slate-800 text-slate-200 focus-visible:ring-indigo-400' 
                      : 'bg-white border-slate-300 text-slate-900 shadow-sm focus-visible:ring-indigo-600'
                  } ${isDyslexicFont ? 'font-mono tracking-wide leading-loose' : 'font-sans'}`}
                >
                  <div className={`flex items-center justify-between text-[11px] font-bold mb-3 uppercase tracking-wider ${
                    isDarkMode ? 'text-indigo-400' : 'text-indigo-800'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" aria-hidden="true" />
                      Block {idx + 1} of {currentPageData.cards.length}
                    </span>
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Readable Chunk</span>
                  </div>

                  <p className="text-base sm:text-lg leading-relaxed font-normal">
                    {isBionic ? (
                      renderBionicText(text, isDarkMode)
                    ) : (
                      text
                    )}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* AI Insights Sidebar */}
          <aside className="lg:col-span-5 space-y-5" aria-label="Slide Summary Insights">
            
            {/* Takeaways */}
            <div className={`p-6 rounded-2xl border shadow-sm ${
              isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-300'
            }`}>
              <div className={`flex items-center gap-2 mb-4 font-bold ${
                isDarkMode ? 'text-indigo-400' : 'text-indigo-800'
              }`}>
                <span aria-hidden="true">📌</span>
                <h3 className="text-xs uppercase tracking-wider">Executive Takeaways</h3>
              </div>
              <ul className="space-y-3 text-xs leading-relaxed">
                {currentPageData.summary.map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-indigo-600 mt-0.5" aria-hidden="true">•</span>
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-900 font-medium'}>
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ELI5 */}
            <div className={`p-6 rounded-2xl border shadow-sm ${
              isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-300'
            }`}>
              <div className={`flex items-center gap-2 mb-3 font-bold ${
                isDarkMode ? 'text-teal-400' : 'text-teal-800'
              }`}>
                <span aria-hidden="true">💡</span>
                <h3 className="text-xs uppercase tracking-wider">Simple Context (ELI5)</h3>
              </div>
              <p className={`text-xs leading-relaxed ${
                isDarkMode ? 'text-slate-300' : 'text-slate-900 font-medium'
              }`}>
                {currentPageData.eli5}
              </p>
            </div>

            {/* Key Terms */}
            <div className={`p-6 rounded-2xl border shadow-sm ${
              isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-300'
            }`}>
              <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-3 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-700'
              }`}>
                🏷️ Extracted Key Terms
              </h3>
              <div className="flex flex-wrap gap-2">
                {currentPageData.jargon.map((term, i) => (
                  <span 
                    key={i} 
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
                      isDarkMode 
                        ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' 
                        : 'bg-indigo-100 border-indigo-300 text-indigo-950'
                    }`}
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>

          </aside>

        </div>
      </main>

      {/* 🚀 FULLSCREEN OVERLAY MODAL */}
      {isFlowchartFullscreen && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-label="Interactive Process Flow Workspace"
          className="fixed inset-0 z-50 bg-[#0B0F19]/95 backdrop-blur-2xl p-6 flex flex-col justify-between animate-fadeIn"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">📊</span>
              <div>
                <h2 className="text-lg font-extrabold text-slate-100">
                  Interactive Process Flow Workspace
                </h2>
                <p className="text-xs text-slate-400">
                  Page {currentPage} of {pageCount} • Powered by {useAI ? 'OpenAI Engine' : 'Local Engine'}
                </p>
              </div>
            </div>

            <button 
              onClick={() => {
                setIsFlowchartFullscreen(false);
                announce("Exited fullscreen flowchart view.");
              }}
              className="px-5 py-2.5 rounded-2xl bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-extrabold transition shadow-lg shadow-indigo-600/30 flex items-center gap-2 focus-visible:ring-2"
            >
              <span aria-hidden="true">✕</span>
              <span>Exit Fullscreen</span>
            </button>
          </div>

          {/* Fullscreen Canvas */}
          <div className="flex-1 w-full my-4 rounded-3xl border border-slate-800/80 overflow-hidden bg-slate-950/60 shadow-2xl">
            <Flowchart data={currentPageData.flowchart} />
          </div>
        </div>
      )}

    </div>
  );
}