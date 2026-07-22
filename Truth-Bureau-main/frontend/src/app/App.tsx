import { useState, useRef } from 'react';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { InputCanvas } from './components/input-canvas';
import { AnalysisBoard } from './components/analysis-board';
import { ClaimBreakdown } from './components/claim-breakdown';
import { GroundTruth } from './components/ground-truth';
import { SourceTracking } from './components/source-tracking';
import { LoadingPress } from './components/loading-press';
import { Download, Network, Loader2 } from 'lucide-react';

// ── Types matching the backend AnalysisResponse ──────────────────────────
interface Annotation {
  type: 'contradiction' | 'fallacy' | 'unverified' | 'verified';
  note: string;
}

interface Segment {
  text: string;
  isSuspicious: boolean;
  annotation?: Annotation;
}

interface EvidenceNode {
  id: string;
  role: 'hostile' | 'amplifier' | 'current';
  type: string;
  date: string;
  author: string;
  content: string;
  x: number;
  y: number;
  rotation: number;
  url?: string;
}

interface Connection {
  from: string;
  to: string;
  nli: { type: 'contradiction' | 'entailment'; score: number };
}

interface AnalysisData {
  claim: string;
  verdict: 'VERIFIED' | 'FABRICATED' | 'INCONCLUSIVE';
  confidence: number;
  confidenceExplanation: string;
  segments: Segment[];
  sourceTree: EvidenceNode[];
  connections: Connection[];
  groundTruth: string;
}

const API_URL = 'http://localhost:8000';

export default function App() {
  const [claim, setClaim] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async () => {
    if (!claim.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Guarantee the LoadingPress animation plays for at least 6 seconds
      const [res] = await Promise.all([
        fetch(`${API_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: claim }),
        }),
        new Promise(resolve => setTimeout(resolve, 6000)),
      ]);

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `Server error: ${res.status}`);
      }

      const data = await res.json();

      setAnalysis({
        claim: data.claim,
        verdict: data.verdict,
        confidence: data.confidence,
        confidenceExplanation: data.confidenceExplanation,
        segments: data.segments,
        sourceTree: data.sourceTree,
        connections: data.connections,
        groundTruth: data.groundTruth,
      });
      setIsAnalyzing(false);
      setIsAnalyzed(true);
    } catch (err: unknown) {
      setIsAnalyzing(false);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    }
  };

  const handleReset = () => {
    setClaim('');
    setAnalysis(null);
    setIsAnalyzed(false);
    setIsAnalyzing(false);
    setError(null);
  };

  const exportToPDF = async () => {
    if (!reportRef.current || isExporting) return;
    setIsExporting(true);
    try {
      // Paint delay to ensure React finishes rendering
      await new Promise(resolve => setTimeout(resolve, 500));

      const target = reportRef.current;
      const fullHeight = target.scrollHeight;
      const fullWidth = target.scrollWidth;

      const dataUrl = await toJpeg(target, {
        quality: 0.8,
        backgroundColor: '#F4F4F0',
        pixelRatio: 1.5,
        width: fullWidth,
        height: fullHeight,
        style: { transform: 'none' } // Prevents flex/grid scaling issues during capture
      });

      // Create a custom-sized PDF that perfectly matches the continuous scroll height
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [fullWidth, fullHeight]
      });

      pdf.addImage(dataUrl, 'JPEG', 0, 0, fullWidth, fullHeight);
      pdf.save(`Truth-Bureau-Case-${Math.floor(Math.random() * 10000)}.pdf`);
    } catch (err: any) {
      console.error('PDF export failed:', err);
      alert(`PDF Generation Failed: ${err.message || 'Unknown Error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EAE8E3] text-[#111111] p-0 md:p-8 font-serif selection:bg-[#D92D20] selection:text-[#F4F4F0]">
      {/* Outer wrapper to look like a physical paper laid on a desk */}
      <div ref={reportRef} className="max-w-[1400px] mx-auto bg-[#F4F4F0] min-h-screen shadow-2xl md:border-x-[1px] md:border-[#111111]/20 relative">
        
        {/* Newspaper Edge Highlight */}
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-r from-white to-transparent opacity-50 pointer-events-none" />

        {/* NEWSPAPER MASTHEAD */}
        <header className="px-6 pt-10 pb-4 border-b-[12px] border-[#111111] text-center bg-[#F4F4F0]">
          {/* Top Meta Line */}
          <div className="flex flex-col md:flex-row justify-between items-center md:items-end border-b-2 border-[#111111] pb-2 mb-6 font-mono text-[0.65rem] md:text-xs uppercase tracking-widest gap-2 md:gap-0">
            <span className="md:w-1/3 text-left hidden md:block">Vol. CXCIV, No. 42</span>
            <span className="md:w-1/3 text-center font-bold">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <span className="md:w-1/3 text-right hidden md:block">Late City Edition</span>
          </div>
          
          <h1
            className="uppercase tracking-tighter mb-4"
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: '900',
              fontSize: 'clamp(3.5rem, 10vw, 9rem)',
              lineHeight: '0.8',
              color: '#111111',
            }}
          >
            Truth Bureau
          </h1>
          
          <div className="border-y-[3px] border-[#111111] py-2 inline-block px-4 md:px-16 w-full max-w-5xl">
            <div
              className="uppercase tracking-[0.2em] md:tracking-[0.4em] font-mono text-[0.6rem] md:text-sm font-bold"
            >
              Independent Fact Verification Platform — Est. 2026
            </div>
          </div>
        </header>

        <main className="px-6 py-8">
          {isAnalyzing ? (
            <LoadingPress />
          ) : error ? (
            // ERROR STATE
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-8">
              <div className="border-4 border-[#D92D20] bg-white p-12 max-w-2xl w-full text-center">
                <div className="font-mono text-xs uppercase tracking-widest text-[#D92D20] font-bold mb-4">
                  [ Investigation Failed ]
                </div>
                <p className="text-lg font-serif mb-8">{error}</p>
                <button
                  onClick={handleReset}
                  className="bg-[#111111] text-[#F4F4F0] px-12 py-4 uppercase tracking-[0.3em] hover:opacity-80 transition-opacity font-mono text-sm font-bold border-3 border-[#111111]"
                >
                  ◼ Try Again
                </button>
              </div>
            </div>
          ) : !isAnalyzed || !analysis ? (
            // INITIAL STATE: Front Page Layout
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
              
              {/* Left Column: Editorial / Instructions */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 lg:border-r-2 lg:border-[#111111] lg:pr-10 pb-8 lg:pb-0 border-b-2 border-[#111111] lg:border-b-0">
                <div>
                  <h2 className="text-4xl lg:text-[3.2rem] xl:text-[4rem] font-black uppercase leading-[0.9] mb-4 tracking-tighter" style={{ wordBreak: 'normal', overflowWrap: 'normal' }}>
                    The War on Falsehoods Continues
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mb-4 font-mono text-[0.65rem] uppercase tracking-widest border-y border-[#111111] py-2">
                    <span className="font-bold">By The Editorial Board</span>
                    <span className="hidden md:inline">•</span>
                    <span>Opinion & Analysis</span>
                  </div>
                </div>
                
                <div className="text-lg leading-relaxed text-justify" style={{ textJustify: 'inter-word' }}>
                  <span className="float-left text-7xl leading-[0.8] font-black pr-3 pt-1">S</span>
                  ubmit any claim, statement, or article for independent verification. Our editorial team analyzes sources, cross-references facts, and identifies logical fallacies hidden within the text.
                </div>
                
                <div className="text-lg leading-relaxed text-justify" style={{ textJustify: 'inter-word' }}>
                  In an era of rapid information spread, determining the origin and validity of a statement requires rigorous scrutiny. Provide the suspect text in the adjacent canvas, and our automated investigative journalism tools will dissect its validity and build a comprehensive evidence dossier.
                </div>
              </div>

              {/* Right Column: Submission Form */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-[2px] w-8 bg-[#111111]" />
                  <span className="font-mono text-xs uppercase tracking-widest font-bold shrink-0">Official Submission Desk</span>
                  <div className="h-[2px] w-full bg-[#111111]" />
                </div>
                
                <div className="flex-1">
                  <InputCanvas value={claim} onChange={setClaim} onSubmit={handleSubmit} />
                </div>
              </div>

            </div>
          ) : (
            // ANALYZED STATE: Dossier Spread
            <div id="report-container" className="space-y-12">
              
              {/* Case Header / Section Headline */}
              <div className="border-y-8 border-[#111111] py-5 bg-[#111111] text-[#F4F4F0] px-6 lg:px-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-[8px_8px_0px_#D92D20]">
                <div>
                  <div className="uppercase tracking-[0.3em] font-mono text-[0.65rem] md:text-sm mb-2 text-[#F4F4F0]/80">
                    Investigative Report — Case No. TB-{Math.floor(Math.random() * 10000).toString().padStart(6, '0')}
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">
                    Analysis Complete
                  </h2>
                </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                  <button
                    onClick={exportToPDF}
                    disabled={isExporting}
                    className="border-2 border-[#F4F4F0] px-6 py-4 uppercase tracking-wider hover:bg-[#F4F4F0] hover:text-[#111111] transition-colors font-mono text-xs font-bold whitespace-nowrap active:translate-y-1 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isExporting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF...</>
                    ) : (
                      <><Download className="w-4 h-4" /> Export Report</>
                    )}
                  </button>
                  <button
                    onClick={handleReset}
                    className="bg-[#F4F4F0] text-[#111111] border-2 border-[#F4F4F0] px-8 py-4 uppercase tracking-wider hover:bg-transparent hover:text-[#F4F4F0] transition-colors font-mono text-xs font-bold whitespace-nowrap active:translate-y-1"
                  >
                    New Investigation
                  </button>
                </div>
              </div>

              {/* Top Level Board */}
              <div className="flex flex-col gap-10 md:gap-16">
                <div className="border-b-4 border-dashed border-[#111111] pb-10 md:pb-12">
                  <AnalysisBoard 
                    verdict={analysis.verdict} 
                    confidence={analysis.confidence} 
                    confidenceExplanation={analysis.confidenceExplanation} 
                  />
                </div>
                
                {/* The Full-Width Map Section */}
                <div className="flex flex-col gap-6 w-full">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-1 bg-[#111111]" />
                    <h3 className="shrink-0 font-black uppercase text-2xl md:text-3xl tracking-tighter flex items-center gap-3">
                      <Network className="w-6 h-6 md:w-8 md:h-8" />
                      Origin & Mutation Map
                    </h3>
                    <div className="w-full h-1 bg-[#111111]" />
                  </div>
                  <SourceTracking sourceTree={analysis.sourceTree} connections={analysis.connections} />
                </div>

                {/* The Analysis Row: 50/50 Split */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-stretch">
                  {/* Left: Claim Breakdown */}
                  <div className="flex flex-col gap-6 h-full">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-1 bg-[#111111]" />
                      <h3 className="shrink-0 font-black uppercase text-2xl tracking-tighter">Evidence Analysis</h3>
                      <div className="w-full h-1 bg-[#111111]" />
                    </div>
                    <div className="h-full">
                      <ClaimBreakdown segments={analysis.segments} />
                    </div>
                  </div>

                  {/* Right: Established Fact */}
                  <div className="flex flex-col gap-6 h-full">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-1 bg-[#111111]" />
                      <h3 className="shrink-0 font-black uppercase text-2xl tracking-tighter">Established Fact</h3>
                      <div className="w-full h-1 bg-[#111111]" />
                    </div>
                    <div className="h-full">
                      <GroundTruth groundTruth={analysis.groundTruth} />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t-[12px] border-[#111111] bg-[#111111] text-[#F4F4F0] mt-16 px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-center md:text-left">
            <div className="font-serif font-black text-4xl uppercase tracking-tighter">Truth Bureau</div>
            <div className="font-mono text-[0.65rem] uppercase tracking-widest leading-relaxed text-[#F4F4F0]/70">
              <p>Disclaimer: Analysis based on available sources as of print date.</p>
              <p>Verification status subject to change.</p>
            </div>
            <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] md:text-right">
              © 2026 — Independent<br />Non-partisan • Evidence-based
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}