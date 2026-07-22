interface AnalysisBoardProps {
  verdict: 'VERIFIED' | 'FABRICATED' | 'INCONCLUSIVE';
  confidence: number;
  confidenceExplanation?: string; // <-- We added the prop here!
}

export function AnalysisBoard({ verdict, confidence, confidenceExplanation }: AnalysisBoardProps) {
  const verdictColors = {
    VERIFIED: '#2B6B4A',
    FABRICATED: '#D92D20',
    INCONCLUSIVE: '#111111',
  };

  const verdictLabels = {
    VERIFIED: 'VERIFIED',
    FABRICATED: 'FABRICATED',
    INCONCLUSIVE: 'INCONCLUSIVE',
  };

  return (
    <div className="border-4 border-[#111111] bg-white p-12">
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        {/* Massive brutalist typography stamp */}
        <div
          className="text-center mb-8 select-none"
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: '900',
            fontSize: 'clamp(3rem, 12vw, 8rem)',
            lineHeight: '0.9',
            letterSpacing: '-0.02em',
            color: verdictColors[verdict],
            textTransform: 'uppercase',
            transform: 'rotate(-2deg)',
          }}
        >
          {verdictLabels[verdict]}
        </div>

        {/* Stamp border effect */}
        <div
          className="border-8 p-8 mt-4 max-w-2xl bg-white"
          style={{
            borderColor: verdictColors[verdict],
            transform: 'rotate(1deg)',
          }}
        >
          <div
            className="text-center uppercase tracking-wider font-bold"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.2rem',
              color: verdictColors[verdict],
            }}
          >
            Confidence: {confidence}%
          </div>
          
          <div
            className="mt-4 mb-6 text-center pb-4"
            style={{
              borderBottom: confidenceExplanation ? `2px dashed ${verdictColors[verdict]}` : 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: '#111111',
              letterSpacing: '0.15em',
            }}
          >
            ANALYSIS COMPLETE
          </div>
        </div>

        {/* Detailed Explanation Block — editorial column style */}
        {confidenceExplanation && (
          <div
            className="mt-8 text-left text-base leading-relaxed border-l-4 pl-6 py-2 max-w-2xl"
            style={{
              fontFamily: 'var(--font-serif)',
              color: '#333333',
              borderColor: verdictColors[verdict],
              textTransform: 'none',
              letterSpacing: 'normal',
            }}
          >
            <div className="font-mono text-xs font-bold uppercase tracking-widest mb-3 opacity-60">
              [ Algorithmic Reasoning ]
            </div>
            <div className="space-y-3">
              {confidenceExplanation.split(' ▸ ').map((step, i) => (
                <p key={i} className="text-sm leading-relaxed" style={{ fontFamily: 'var(--font-serif)' }}>
                  {step.trim()}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}