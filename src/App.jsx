import React, { useState, useEffect, useRef, useMemo } from 'react';
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

const splitBionic = (word) => {
  const match = word.match(/^([a-zA-Z0-9]+)(.*)$/);
  if (!match) return { bold: '', rest: word };
  const [, coreWord, punctuation] = match;
  const mid = Math.ceil(coreWord.length / 2);
  return { bold: coreWord.slice(0, mid), rest: coreWord.slice(mid) + punctuation };
};

const renderBionicText = (text) => {
  return text.split(/\s+/).map((word, i) => {
    const { bold, rest } = splitBionic(word);
    if (!bold) return <span key={i}>{word} </span>;
    return (
      <span key={i}>
        <strong className="font-bold text-[var(--ink)]">{bold}</strong>
        <span className="text-[var(--muted)]">{rest}</span>{' '}
      </span>
    );
  });
};

const cardShortTitle = (text, idx) => {
  const words = text.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return `Card ${idx + 1}`;
  return words.slice(0, 3).join(' ').replace(/^\w/, (c) => c.toUpperCase());
};

const buildFlashcards = (page) => {
  const cards = [];
  (page.flowchart || []).forEach((n) => {
    cards.push({
      q: `What does “${n.title}” cover?`,
      a: n.detail || 'Key concept from this slide.',
    });
  });
  (page.summary || []).forEach((point, i) => {
    cards.push({
      q: `Executive takeaway ${i + 1}?`,
      a: point,
    });
  });
  if (page.eli5) {
    cards.push({
      q: 'Explain this slide simply (ELI5).',
      a: page.eli5,
    });
  }
  return cards.slice(0, 6);
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
  const [isFlowchartFullscreen, setIsFlowchartFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Settings State
  const [apiKey, setApiKey] = useState("");
  const [useAI, setUseAI] = useState(false);
  const [isDyslexicFont, setIsDyslexicFont] = useState(false);
  const [isBionic, setIsBionic] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fileName, setFileName] = useState("Sample_Presentation.pptx");

  // Mockup reading interactions
  const [activeCard, setActiveCard] = useState(0);
  const [wpm, setWpm] = useState(170);
  const [playing, setPlaying] = useState(false);
  const [wordIdx, setWordIdx] = useState(-1);
  const [cardsRead, setCardsRead] = useState(() => new Set([0]));
  const [flowStep, setFlowStep] = useState(0);
  const [flowPlaying, setFlowPlaying] = useState(false);
  const [flashIdx, setFlashIdx] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);

  const playTimerRef = useRef(null);
  const fallbackTimeoutRef = useRef(null);
  const flowTimerRef = useRef(null);
  const utteranceRef = useRef(null);
  const boundarySeenRef = useRef(false);
  const wordOffsetsRef = useRef([]);

  // Screen Reader Accessibility Announcement State
  const [announcement, setAnnouncement] = useState("Document loaded successfully.");

  const pageCount = Object.keys(pages).length;
  const currentPageData = pages[currentPage] || pages[1];
  const cards = currentPageData.cards || [];
  const activeText = cards[activeCard] || cards[0] || '';
  const stageWords = useMemo(() => activeText.split(/\s+/).filter(Boolean), [activeText]);
  const totalSec = Math.max(1, Math.round((stageWords.length / Math.max(wpm, 1)) * 60));
  const flashcards = useMemo(() => buildFlashcards(currentPageData), [currentPageData]);
  const flowNodes = currentPageData.flowchart || [];

  const stopAudio = () => {
    clearInterval(playTimerRef.current);
    playTimerRef.current = null;
    clearTimeout(fallbackTimeoutRef.current);
    fallbackTimeoutRef.current = null;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    boundarySeenRef.current = false;
  };

  const buildWordOffsets = (text, words) => {
    const offsets = [];
    let cursor = 0;
    words.forEach((word) => {
      const idx = text.indexOf(word, cursor);
      if (idx >= 0) {
        offsets.push(idx);
        cursor = idx + word.length;
      } else {
        offsets.push(cursor);
        cursor += word.length + 1;
      }
    });
    return offsets;
  };

  const wordIndexFromChar = (charIndex) => {
    const offsets = wordOffsetsRef.current;
    if (!offsets.length) return 0;
    let wi = 0;
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i] <= charIndex) wi = i;
      else break;
    }
    return wi;
  };

  const startFallbackHighlight = (fromIdx = -1) => {
    clearInterval(playTimerRef.current);
    let idx = fromIdx;
    const intervalMs = Math.max(120, 60000 / wpm);
    playTimerRef.current = setInterval(() => {
      idx += 1;
      if (idx >= stageWords.length) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
        setPlaying(false);
        return;
      }
      setWordIdx(idx);
    }, intervalMs);
  };

  const startAudio = (fromWord = 0) => {
    stopAudio();
    const words = stageWords;
    if (!words.length) {
      setPlaying(false);
      return;
    }

    const startAt = Math.max(0, Math.min(fromWord, words.length - 1));
    const remainingWords = words.slice(startAt);
    const textToSpeak = remainingWords.join(' ');
    wordOffsetsRef.current = buildWordOffsets(textToSpeak, remainingWords);
    setWordIdx(startAt);

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setAnnouncement('Speech not available — using visual sync only.');
      startFallbackHighlight(startAt - 1);
      return;
    }

    const utter = new SpeechSynthesisUtterance(textToSpeak);
    utter.rate = Math.min(2, Math.max(0.6, wpm / 170));
    utter.pitch = 1;
    utter.volume = 1;
    utteranceRef.current = utter;
    boundarySeenRef.current = false;

    utter.onboundary = (event) => {
      if (event.name && event.name !== 'word') return;
      boundarySeenRef.current = true;
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
      const localIdx = wordIndexFromChar(event.charIndex);
      setWordIdx(startAt + localIdx);
    };

    utter.onend = () => {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
      setWordIdx(words.length - 1);
      setPlaying(false);
      utteranceRef.current = null;
    };

    utter.onerror = () => {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
      setPlaying(false);
      utteranceRef.current = null;
    };

    // Chrome can drop speak() if called immediately after cancel()
    window.speechSynthesis.cancel();
    fallbackTimeoutRef.current = setTimeout(() => {
      window.speechSynthesis.speak(utter);
      // If word boundaries never fire, keep highlight moving via WPM
      fallbackTimeoutRef.current = setTimeout(() => {
        if (!boundarySeenRef.current && utteranceRef.current === utter) {
          startFallbackHighlight(startAt - 1);
        }
      }, 700);
    }, 40);
  };

  // Sync mockup-style theme attributes on <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-contrast', isDarkMode ? 'high' : 'low');
  }, [isDarkMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-dyslexic', isDyslexicFont ? 'on' : 'off');
  }, [isDyslexicFont]);

  // Reset reading UI when page changes
  useEffect(() => {
    stopAudio();
    setActiveCard(0);
    setWordIdx(-1);
    setPlaying(false);
    setCardsRead(new Set([0]));
    setFlowStep(0);
    setFlowPlaying(false);
    setFlashIdx(0);
    setFlashFlipped(false);
  }, [currentPage, pages]);

  // Stop audio on unmount
  useEffect(() => () => stopAudio(), []);

  // Concept flow autoplay
  useEffect(() => {
    if (!flowPlaying) {
      clearInterval(flowTimerRef.current);
      return;
    }
    flowTimerRef.current = setInterval(() => {
      setFlowStep((prev) => (prev + 1) % Math.max(flowNodes.length, 1));
    }, 1400);
    return () => clearInterval(flowTimerRef.current);
  }, [flowPlaying, flowNodes.length]);

  // Helper for screen reader notifications
  const announce = (msg) => setAnnouncement(msg);

  const selectCard = (idx) => {
    stopAudio();
    setActiveCard(idx);
    setWordIdx(-1);
    setPlaying(false);
    setCardsRead((prev) => new Set([...prev, idx]));
    announce(`Opened card ${idx + 1}`);
  };

  const togglePlay = () => {
    if (playing) {
      stopAudio();
      setPlaying(false);
      announce('Paused audio');
      return;
    }

    const finished = wordIdx < 0 || wordIdx >= stageWords.length - 1;
    const startFrom = finished ? 0 : wordIdx;
    if (finished) setWordIdx(-1);
    setPlaying(true);
    startAudio(startFrom);
    announce('Playing synced audio');
  };

  const toggleFlowPlay = () => {
    if (flowPlaying) {
      setFlowPlaying(false);
      announce('Paused concept flowchart');
      return;
    }
    setFlowStep(0);
    setFlowPlaying(true);
    announce('Playing concept flowchart');
  };

  const createMicroCards = (rawText) => {
    const paragraphs = rawText
      .split(/(?<=\.)\s+|\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 10);
    return paragraphs.length > 0 ? paragraphs : [rawText];
  };

  const processTextForPage = async (pageText, pageNum, docName) => {
    const pageCards = createMicroCards(pageText);

    if (useAI && apiKey.trim().length > 0) {
      try {
        const aiResult = await fetchOpenAIAnalysis(pageText, apiKey);
        return {
          title: `Slide ${pageNum}: ${docName}`,
          cards: pageCards,
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
      cards: pageCards,
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
    stopAudio();
    setPlaying(false);
    setCurrentPage(newPage);
    announce(`Navigated to page ${newPage} of ${pageCount}`);
  };

  const formatTime = (sec) => {
    const s = Math.max(0, Math.round(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  const scrubPct = wordIdx < 0 ? 0 : ((wordIdx + 1) / Math.max(stageWords.length, 1)) * 100;
  const elapsedSec = wordIdx < 0 ? 0 : ((wordIdx + 1) / Math.max(stageWords.length, 1)) * totalSec;
  const rereadMins = Math.max(1, Math.round(cardsRead.size * 2.5));
  const focusPct = cards.length ? Math.round((cardsRead.size / cards.length) * 100) : 0;

  const Switch = ({ on, onToggle, label, id }) => (
    <div className="flex items-center gap-1.5 font-display text-[12.5px] font-medium text-[var(--muted)]">
      <span className="hidden md:inline">{label}</span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        className={`relative w-[34px] h-[19px] rounded-full border shrink-0 transition-colors duration-[320ms] ${
          on
            ? 'bg-[var(--teal-soft)] border-[var(--teal)]'
            : 'bg-[var(--surface-2)] border-[var(--border)]'
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-[13px] h-[13px] rounded-full transition-all duration-[320ms] ${
            on
              ? 'translate-x-[15px] bg-[var(--teal)]'
              : 'translate-x-0 bg-[var(--muted)]'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] font-body transition-colors duration-[320ms] selection:bg-[var(--teal-soft)] selection:text-[var(--teal)]">
      
      {/* 🔊 WCAG 2.1 Screen Reader Live Region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* ⌨️ WCAG 2.4.1 Skip Link for Keyboard Users */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-[var(--teal)] focus:text-white focus:rounded-nf-sm focus:shadow-nf"
      >
        Skip to main content
      </a>

      {/* App shell */}
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[236px_1fr_300px] grid-rows-[60px_1fr] [grid-template-areas:'top''main''side''aside'] lg:[grid-template-areas:'top_top_top''side_main_aside']">

        {/* TOP BAR */}
        <header
          className="[grid-area:top] flex items-center gap-3 sm:gap-4 px-3 sm:px-5 border-b border-[var(--border)] bg-[var(--surface)] z-30 sticky top-0"
          role="banner"
        >
          <div className="flex items-center gap-2 font-display font-bold text-[16px] tracking-tight shrink-0">
            <span
              className="w-[22px] h-[22px] rounded-[6px] bg-gradient-to-br from-[var(--teal)] to-[var(--gold)] inline-flex shrink-0"
              aria-hidden="true"
            />
            NeuroFlex
          </div>

          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[12px] text-[var(--muted)] bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-1 rounded-full max-w-[220px] truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal)] shrink-0" aria-hidden="true" />
            <span className="truncate">{fileName}</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end" role="group" aria-label="Accessibility options">
            <Switch
              id="sw-bionic"
              label="Bionic reading"
              on={isBionic}
              onToggle={() => {
                setIsBionic(!isBionic);
                announce(`Bionic Reading mode ${!isBionic ? 'enabled' : 'disabled'}`);
              }}
            />
            <Switch
              id="sw-dyslexic"
              label="OpenDyslexic"
              on={isDyslexicFont}
              onToggle={() => {
                setIsDyslexicFont(!isDyslexicFont);
                announce(`Dyslexia font ${!isDyslexicFont ? 'enabled' : 'disabled'}`);
              }}
            />
            <Switch
              id="sw-contrast"
              label="High contrast"
              on={isDarkMode}
              onToggle={() => {
                setIsDarkMode(!isDarkMode);
                announce(`Switched to ${!isDarkMode ? 'high contrast' : 'calm'} theme`);
              }}
            />
          </div>
        </header>

        {/* LEFT SIDEBAR */}
        <aside className="[grid-area:side] border-r-0 lg:border-r border-t lg:border-t-0 border-[var(--border)] bg-[var(--surface)] px-4 py-5 flex flex-col gap-6 overflow-y-auto">
          <div>
            <div className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] mb-2.5">
              Document
            </div>
            <label className="block cursor-pointer">
              <div className="border-[1.5px] border-dashed border-[var(--border)] rounded-nf-sm px-3 py-4 text-center text-[12.5px] text-[var(--muted)] bg-[var(--surface-2)] hover:border-[var(--teal)] transition-colors">
                <strong className="block text-[var(--ink)] text-[13px] mb-0.5 truncate">
                  {isLoading ? 'Extracting…' : fileName}
                </strong>
                Parsed locally · {pageCount} page{pageCount === 1 ? '' : 's'}
              </div>
              <input
                type="file"
                accept=".pdf,.pptx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isLoading}
              />
            </label>
          </div>

          <div>
            <div className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] mb-2.5">
              Engine mode
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (useAI) {
                    setUseAI(false);
                    announce('Switched engine to Local NLP');
                  }
                }}
                aria-pressed={!useAI}
                className={`flex items-start gap-2 border rounded-nf-sm px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                  !useAI
                    ? 'border-[var(--teal)] bg-[var(--teal-soft)]'
                    : 'border-[var(--border)] bg-transparent hover:border-[var(--teal)]'
                }`}
              >
                <span className="mt-0.5 w-3 h-3 rounded-full border border-[var(--border)] shrink-0 flex items-center justify-center">
                  {!useAI && <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal)]" />}
                </span>
                <span>
                  <span className="font-bold block text-[var(--ink)]">Local fallback</span>
                  <span className="text-[var(--muted)] text-[11.5px]">Runs offline in your browser. Nothing leaves your device.</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!useAI) {
                    setUseAI(true);
                    announce('Switched engine to OpenAI');
                  }
                }}
                aria-pressed={useAI}
                className={`flex items-start gap-2 border rounded-nf-sm px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                  useAI
                    ? 'border-[var(--teal)] bg-[var(--teal-soft)]'
                    : 'border-[var(--border)] bg-transparent hover:border-[var(--teal)]'
                }`}
              >
                <span className="mt-0.5 w-3 h-3 rounded-full border border-[var(--border)] shrink-0 flex items-center justify-center">
                  {useAI && <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal)]" />}
                </span>
                <span>
                  <span className="font-bold block text-[var(--ink)]">Semantic AI</span>
                  <span className="text-[var(--muted)] text-[11.5px]">Deeper summaries when you're online.</span>
                </span>
              </button>
            </div>
            {useAI && (
              <input
                type="password"
                aria-label="OpenAI API Key"
                placeholder="Paste OpenAI key…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="mt-2 w-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink)] placeholder:text-[var(--muted)] px-2.5 py-2 rounded-nf-sm text-[12px] focus:outline-none focus:border-[var(--teal)]"
              />
            )}
          </div>

          <div>
            <div className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] mb-0">
              Reading speed
            </div>
            <label className="flex justify-between text-[12.5px] mt-2.5 mb-2">
              <span>Words per minute</span>
              <span className="font-mono text-[var(--teal)] font-medium">{wpm}</span>
            </label>
            <input
              type="range"
              min={90}
              max={320}
              value={wpm}
              onChange={(e) => {
                const next = Number(e.target.value);
                setWpm(next);
                if (playing) {
                  const resumeAt = Math.max(0, wordIdx);
                  startAudio(resumeAt);
                }
              }}
              aria-label="Reading speed in words per minute"
              className="w-full accent-[var(--teal)] h-1"
            />
          </div>

          <div>
            <div className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] mb-2.5">
              This session
            </div>
            <div className="mb-3">
              <div className="flex justify-between font-mono text-[11.5px] text-[var(--muted)] mb-1.5">
                <span>Cards read</span>
                <span>{cardsRead.size} / {cards.length || 1}</span>
              </div>
              <div className="h-[5px] rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--teal)]"
                  style={{ width: `${cards.length ? (cardsRead.size / cards.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="mb-3">
              <div className="flex justify-between font-mono text-[11.5px] text-[var(--muted)] mb-1.5">
                <span>Re-reads avoided</span>
                <span>~{rereadMins} min</span>
              </div>
              <div className="h-[5px] rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--gold)]"
                  style={{ width: `${Math.min(100, rereadMins * 8)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between font-mono text-[11.5px] text-[var(--muted)] mb-1.5">
                <span>Focus lens uptime</span>
                <span>{focusPct}%</span>
              </div>
              <div className="h-[5px] rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--teal)]" style={{ width: `${focusPct}%` }} />
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main id="main-content" className="[grid-area:main] px-4 sm:px-7 py-5 sm:py-7 overflow-y-auto">
          <div className="mb-5">
            <div className="font-mono text-[11px] tracking-[0.06em] text-[var(--teal)] uppercase mb-1.5">
              Reading canvas
            </div>
            <h1 className="font-display text-[22px] sm:text-[23px] font-bold tracking-tight m-0 mb-1.5">
              {currentPageData.title}
            </h1>
            <p className="m-0 text-[var(--muted)] text-[13.5px] max-w-[56ch]">
              Chunked into micro-cards{isBionic ? ' and bolded at the word stem' : ''}, so your eyes catch the shape of the sentence without re-reading it. Pick a card to open it and read along.
            </p>
          </div>

          {/* Pagination */}
          <nav
            aria-label="Slide pagination"
            className="mb-5 p-3 rounded-nf border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between shadow-nf"
          >
            <button
              onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              aria-label="Previous Page"
              className="px-3 py-1.5 rounded-nf-sm text-[12px] font-display font-semibold disabled:opacity-30 bg-[var(--surface-2)] text-[var(--ink)]"
            >
              ◄ Previous
            </button>
            <div className="text-center">
              <span className="font-mono text-[11px] uppercase tracking-wider block text-[var(--teal)]">
                Slide navigation
              </span>
              <span className="text-[13px] font-display font-semibold">
                Page {currentPage} of {pageCount}
              </span>
            </div>
            <button
              onClick={() => handlePageChange(Math.min(currentPage + 1, pageCount))}
              disabled={currentPage === pageCount}
              aria-label="Next Page"
              className="px-3 py-1.5 rounded-nf-sm text-[12px] font-display font-semibold disabled:opacity-30 bg-[var(--surface-2)] text-[var(--ink)]"
            >
              Next ►
            </button>
          </nav>

          {/* Focus-lens micro-card grid */}
          <div
            className="grid gap-3 mb-6"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
            role="list"
            aria-label="Micro-cards"
            aria-busy={isLoading}
          >
            {cards.map((text, idx) => {
              const isActive = idx === activeCard;
              return (
                <button
                  key={idx}
                  type="button"
                  role="listitem"
                  onClick={() => selectCard(idx)}
                  className={`text-left p-3.5 rounded-nf border bg-[var(--surface)] transition-all duration-[320ms] cursor-pointer ${
                    isActive
                      ? 'opacity-100 border-[var(--teal)] shadow-nf'
                      : 'opacity-55 border-[var(--border)] hover:border-[var(--teal)]'
                  } ${isDyslexicFont ? 'font-dyslexic' : ''}`}
                >
                  <div className="font-mono text-[10.5px] text-[var(--muted)] flex items-center gap-1.5 mb-2">
                    <span
                      className={`w-4 h-4 rounded-[4px] inline-flex items-center justify-center text-[9px] ${
                        isActive
                          ? 'bg-[var(--teal)] text-white'
                          : 'bg-[var(--surface-2)] text-[var(--ink)]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    {cardShortTitle(text, idx)}
                  </div>
                  <p className="m-0 text-[14px] leading-snug line-clamp-3">
                    {isBionic ? renderBionicText(text) : text}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Reading stage */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-nf shadow-nf px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 font-display font-semibold text-[14px]">
                Card {activeCard + 1}
                <span className="bg-[var(--gold-soft)] text-[var(--gold)] rounded-full px-2.5 py-0.5 text-[10.5px] font-mono font-medium">
                  {isBionic ? 'Bionic · synced audio' : 'Synced audio'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsFlowchartFullscreen(true)}
                className="font-mono text-[11px] text-[var(--teal)] border border-[var(--teal)] rounded-full px-2.5 py-0.5 hover:bg-[var(--teal-soft)]"
              >
                Diagram
              </button>
            </div>

            <p
              className={`m-0 text-[18px] sm:text-[22px] leading-[1.85] tracking-wide max-w-[72ch] ${
                isDyslexicFont ? 'font-dyslexic' : ''
              }`}
            >
              {stageWords.map((word, i) => {
                const { bold, rest } = splitBionic(word);
                const active = i === wordIdx;
                return (
                  <span
                    key={`${activeCard}-${i}`}
                    className={`inline px-0.5 rounded transition-colors duration-[320ms] ${
                      active
                        ? 'bg-[var(--gold-soft)] text-[var(--gold)] shadow-[inset_0_0_0_1px_var(--gold)]'
                        : ''
                    }`}
                  >
                    {isBionic && bold ? (
                      <>
                        <strong className="font-bold">{bold}</strong>
                        <span className={active ? '' : 'text-[var(--muted)]'}>{rest}</span>
                      </>
                    ) : (
                      word
                    )}{' '}
                  </span>
                );
              })}
            </p>

            <div className="flex items-center gap-2 mt-3.5 pt-3.5 border-t border-[var(--border)] text-[12px] text-[var(--muted)]">
              <span aria-hidden="true">◐</span>
              Focus lens dims the cards you're not reading, so only this one pulls your eye.
            </div>

            <div className="flex items-center gap-2.5 mt-3.5">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pause audio sync' : 'Play audio sync'}
                className="w-[34px] h-[34px] rounded-full border-0 bg-[var(--teal)] text-white flex items-center justify-center shadow-[0_4px_10px_-4px_rgba(43,110,107,0.6)] text-[12px]"
              >
                {playing ? '❚❚' : '▶'}
              </button>
              <div className="flex-1 h-1 rounded-full bg-[var(--surface-2)] relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-[var(--teal)] rounded-full transition-[width] duration-100 linear"
                  style={{ width: `${scrubPct}%` }}
                />
              </div>
              <div className="font-mono text-[11px] text-[var(--muted)] w-16 text-right tabular-nums">
                {formatTime(elapsedSec)} / {formatTime(totalSec)}
              </div>
            </div>
          </div>

          {/* Takeaways */}
          <div className="mt-6 rounded-nf bg-[var(--teal-soft)] px-5 py-4">
            <h3 className="m-0 mb-2 font-display text-[12px] uppercase tracking-[0.06em] text-[var(--teal)]">
              Executive takeaways
            </h3>
            <ul className="m-0 pl-[18px] text-[13px] text-[var(--ink)] leading-[1.7]">
              {currentPageData.summary.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="border border-[var(--border)] rounded-nf bg-[var(--surface)] p-4">
              <h3 className="m-0 mb-2 font-display text-[12px] uppercase tracking-[0.06em] text-[var(--teal)]">
                Simple context (ELI5)
              </h3>
              <p className="m-0 text-[12.5px] leading-relaxed text-[var(--muted)]">{currentPageData.eli5}</p>
            </div>
            <div className="border border-[var(--border)] rounded-nf bg-[var(--surface)] p-4">
              <h3 className="m-0 mb-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Key terms
              </h3>
              <div className="flex flex-wrap gap-2">
                {currentPageData.jargon.map((term, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-nf-sm text-[11px] font-mono font-medium border border-[var(--border)] bg-[var(--gold-soft)] text-[var(--gold)]"
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT ASIDE */}
        <aside
          className="[grid-area:aside] border-l-0 lg:border-l border-t lg:border-t-0 border-[var(--border)] bg-[var(--surface)] px-4 py-5 flex flex-col gap-6 overflow-y-auto"
          aria-label="Concept tools"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-[13px] font-semibold m-0">Concept flowchart</h2>
              <button
                type="button"
                onClick={toggleFlowPlay}
                className="font-mono text-[11px] text-[var(--teal)] border border-[var(--teal)] rounded-full px-2.5 py-0.5 hover:bg-[var(--teal-soft)] transition-colors"
              >
                {flowPlaying ? 'Pause' : 'Play'}
              </button>
            </div>
            <div className="flex flex-col">
              {flowNodes.map((node, i) => {
                const isActive = i === flowStep;
                return (
                  <div key={node.id || i}>
                    <button
                      type="button"
                      onClick={() => {
                        setFlowPlaying(false);
                        setFlowStep(i);
                      }}
                      className={`w-full text-left flex gap-2.5 px-3 py-2.5 rounded-nf-sm border mb-1 transition-all duration-[320ms] ${
                        isActive
                          ? 'border-[var(--teal)] bg-[var(--teal-soft)] shadow-nf'
                          : 'border-[var(--border)] bg-[var(--surface-2)] hover:translate-x-0.5'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-[7px] border flex items-center justify-center font-mono text-[11px] shrink-0 ${
                          isActive
                            ? 'bg-[var(--teal)] border-[var(--teal)] text-white'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)]'
                        }`}
                      >
                        {node.step || `0${i + 1}`}
                      </span>
                      <span>
                        <span className="font-display font-semibold text-[13px] block mb-0.5 text-[var(--ink)]">
                          {node.title}
                        </span>
                        <span className="text-[11.5px] text-[var(--muted)] leading-snug block">
                          {node.detail}
                        </span>
                      </span>
                    </button>
                    {i < flowNodes.length - 1 && (
                      <div
                        className={`w-[1.5px] h-4 ml-[23px] ${
                          i < flowStep ? 'bg-[var(--teal)]' : 'bg-[var(--border)]'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setIsFlowchartFullscreen(true)}
              className="mt-3 w-full font-mono text-[11px] text-[var(--muted)] border border-[var(--border)] rounded-nf-sm py-2 hover:border-[var(--teal)] hover:text-[var(--teal)] transition-colors"
            >
              Open interactive diagram
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-[13px] font-semibold m-0">Sure-question flashcard</h2>
              <span className="text-[11px] text-[var(--muted)]">
                {flashcards.length ? flashIdx + 1 : 0} / {flashcards.length || 0}
              </span>
            </div>

            {flashcards.length > 0 ? (
              <>
                <div className="[perspective:1000px]">
                  <button
                    type="button"
                    onClick={() => setFlashFlipped((f) => !f)}
                    className="relative w-full h-[150px] border-0 bg-transparent p-0 cursor-pointer text-left"
                    style={{
                      transformStyle: 'preserve-3d',
                      transition: 'transform 480ms cubic-bezier(.2,.8,.2,1)',
                      transform: flashFlipped ? 'rotateY(180deg)' : 'none',
                    }}
                    aria-label={flashFlipped ? 'Flip flashcard back' : 'Reveal flashcard answer'}
                  >
                    <div
                      className="absolute inset-0 rounded-nf border border-[var(--border)] p-4 flex flex-col justify-between bg-[var(--surface)] shadow-nf"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--coral)]">
                        Question
                      </div>
                      <div className="font-display font-semibold text-[14.5px] leading-snug text-[var(--ink)]">
                        {flashcards[flashIdx].q}
                      </div>
                      <div className="text-[11px] text-[var(--muted)]">Tap to reveal</div>
                    </div>
                    <div
                      className="absolute inset-0 rounded-nf border border-[var(--border)] p-4 flex flex-col justify-between bg-[var(--coral-soft)] shadow-nf"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--coral)]">
                        Answer
                      </div>
                      <div className="font-display font-semibold text-[14.5px] leading-snug text-[var(--ink)]">
                        {flashcards[flashIdx].a}
                      </div>
                      <div className="text-[11px] text-[var(--muted)]">Tap to flip back</div>
                    </div>
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    disabled={flashIdx === 0}
                    onClick={() => {
                      setFlashIdx((i) => Math.max(0, i - 1));
                      setFlashFlipped(false);
                    }}
                    className="flex-1 font-mono text-[11px] py-1.5 rounded-full border border-[var(--border)] text-[var(--muted)] disabled:opacity-30"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={flashIdx >= flashcards.length - 1}
                    onClick={() => {
                      setFlashIdx((i) => Math.min(flashcards.length - 1, i + 1));
                      setFlashFlipped(false);
                    }}
                    className="flex-1 font-mono text-[11px] py-1.5 rounded-full border border-[var(--teal)] text-[var(--teal)] disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-[var(--muted)] m-0">No flashcards for this slide yet.</p>
            )}
          </div>
        </aside>
      </div>

      {/* FULLSCREEN OVERLAY */}
      {isFlowchartFullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Interactive Process Flow Workspace"
          className="fixed inset-0 z-50 bg-[var(--bg)]/95 backdrop-blur-md p-4 sm:p-6 flex flex-col"
        >
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
            <div>
              <h2 className="text-lg font-display font-bold text-[var(--ink)] m-0">
                Interactive process flow
              </h2>
              <p className="text-xs text-[var(--muted)] m-0 mt-0.5">
                Page {currentPage} of {pageCount} · {useAI ? 'Semantic AI' : 'Local fallback'}
              </p>
            </div>

            <button
              onClick={() => {
                setIsFlowchartFullscreen(false);
                announce('Exited fullscreen flowchart view.');
              }}
              className="px-4 py-2.5 rounded-nf-sm bg-[var(--teal)] hover:opacity-90 text-white text-xs font-display font-semibold transition shadow-nf flex items-center gap-2"
            >
              Exit fullscreen
            </button>
          </div>

          <div className="flex-1 w-full my-4 rounded-nf border border-[var(--border)] overflow-hidden bg-[var(--surface)] shadow-nf">
            <Flowchart data={currentPageData.flowchart} />
          </div>
        </div>
      )}
    </div>
  );
}