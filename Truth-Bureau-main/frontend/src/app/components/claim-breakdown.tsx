interface AnnotatedSegment {
  text: string;
  isSuspicious: boolean;
  annotation?: {
    type: 'contradiction' | 'fallacy' | 'unverified' | 'verified';
    note: string;
  };
}

interface ClaimBreakdownProps {
  segments: AnnotatedSegment[];
}

export function ClaimBreakdown({ segments }: ClaimBreakdownProps) {
  return (
    <div className="border-4 border-[#111111] bg-white h-full flex flex-col">
      {/* Document area with annotations */}
      <div className="p-8 lg:p-12 relative flex-1">
        {/* Main document text */}
        <div
          className="leading-loose relative"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.125rem',
            lineHeight: '2.5rem',
          }}
        >
          {segments.map((segment, idx) => (
            <span key={idx} className="relative inline">
              {segment.isSuspicious ? (
                <span className="relative inline-block group">
                  {/* Red highlight effect - rough marker style */}
                  <span
                    className="absolute inset-0 -mx-1 -my-1"
                    style={{
                      background: 'rgba(217, 45, 32, 0.25)',
                      clipPath: 'polygon(0% 5%, 2% 0%, 98% 3%, 100% 8%, 99% 95%, 98% 100%, 2% 97%, 0% 92%)',
                    }}
                  />
                  <span className="relative">{segment.text}</span>
                  
                  {/* Connection line to margin note */}
                  {segment.annotation && (
                    <span className="absolute left-full top-1/2 w-16 h-[2px] bg-[#111111] hidden group-hover:block" />
                  )}
                </span>
              ) : (
                <span>{segment.text}</span>
              )}
            </span>
          ))}
        </div>

        {/* Margin notes */}
        <div className="mt-12 space-y-6 border-t-4 border-[#111111] pt-8">
          {segments
            .filter((s) => s.annotation)
            .map((segment, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                {/* Red pen mark indicator */}
                <div className="flex-shrink-0">
                  <div
                    className="w-6 h-6 border-2 flex items-center justify-center"
                    style={{
                      borderColor: segment.annotation!.type === 'verified' ? '#2B6B4A' : '#D92D20',
                      color: segment.annotation!.type === 'verified' ? '#2B6B4A' : '#D92D20',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      {idx + 1}
                    </span>
                  </div>
                </div>

                {/* Annotation text */}
                <div className="flex-1">
                  <div
                    className="uppercase mb-1 tracking-wider"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: segment.annotation!.type === 'verified' ? '#2B6B4A' : '#D92D20',
                    }}
                  >
                    {segment.annotation!.type}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                      color: '#111111',
                    }}
                  >
                    {segment.annotation!.note.split('\n').map((line, lineIdx) => (
                      <span key={lineIdx}>
                        {line}
                        {lineIdx < segment.annotation!.note.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
