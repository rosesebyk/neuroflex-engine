# ⚡ NeuroFlex Engine

> **Accessible Document & Concept-Flowchart Visualizer**  
> Built for cognitive accessibility, Bionic Reading, and low-latency document processing.

![WCAG 2.1 AA](https://img.shields.io/badge/WCAG_2.1_AA-Compliant-emerald)
![License](https://img.shields.io/badge/License-MIT-indigo)
![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-5-purple)

---

## 🚀 Key Features

- 🧠 **Micro-Card Chunking:** Converts dense PDF and PPTX slides into scannable visual chunks.
- 📊 **Interactive Concept Flowcharts:** Automatically extracts step-by-step logic nodes.
- ⚡ **Dual-Engine Processing:**
  - **OpenAI GPT-4o-mini Engine:** Deep semantic abstraction and ELI5 summaries.
  - **Local NLP Saliency Engine:** Zero-dependency, offline-ready fallback parsing.
- ♿ **Inclusive UI Design (WCAG 2.1 AA):**
  - High contrast ratio ($\ge 7:1$) across dark/light themes.
  - Typographic Bionic Reading engine (pure font-weight mapping).
  - OpenDyslexic font toggle.
  - Screen reader support via `aria-live` regions and keyboard skip links (`focus:not-sr-only`).

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS
- **Document Parsing:** PDF.js, JSZip
- **AI / NLP:** OpenAI API, Client-Side Heuristic Saliency Engine

---

## 🏁 Quick Start

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YOUR_USERNAME/neuroflex-engine.git](https://github.com/YOUR_USERNAME/neuroflex-engine.git)
   cd neuroflex-engine