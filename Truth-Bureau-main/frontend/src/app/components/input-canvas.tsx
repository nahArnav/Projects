interface InputCanvasProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function InputCanvas({ value, onChange, onSubmit }: InputCanvasProps) {
  return (
    <div className="border-4 border-[#111111] bg-white p-8 relative">
      {/* Paper texture lines */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="h-[1px] bg-[#111111]"
            style={{ marginTop: i === 0 ? '48px' : '32px' }}
          />
        ))}
      </div>
      
      <div className="relative">
        <label
          htmlFor="claim-input"
          className="block mb-4 uppercase tracking-wider"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Submit Claim for Investigation
        </label>
        
        <textarea
          id="claim-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste the claim, article, or statement you wish to verify..."
          className="w-full min-h-[300px] bg-transparent border-none outline-none resize-none p-0"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.125rem',
            lineHeight: '2rem',
            color: '#111111',
          }}
        />
        
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="mt-8 bg-[#111111] text-[#F4F4F0] px-12 py-6 uppercase tracking-[0.3em] disabled:opacity-30 disabled:cursor-not-allowed transition-opacity hover:opacity-80"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.875rem',
            letterSpacing: '0.3em',
            border: '3px solid #111111',
          }}
        >
          ◼ Investigate Claim
        </button>
      </div>
    </div>
  );
}
