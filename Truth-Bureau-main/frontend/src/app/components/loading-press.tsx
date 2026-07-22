import { useState, useEffect } from 'react';

export type OperationStatus = 'pending' | 'active' | 'done';

export interface Operation {
  id: string;
  name: string;
  status: OperationStatus;
}

interface LoadingPressProps {
  operations?: Operation[];
  currentAction?: string;
}

const DEFAULT_OPERATIONS: Operation[] = [
  { id: '1', name: 'SCRAPING LIVE NEWS FEEDS...', status: 'pending' },
  { id: '2', name: 'PARSING LINGUISTIC FALLACIES...', status: 'pending' },
  { id: '3', name: 'EXTRACTING GROUND TRUTH DATA...', status: 'pending' }
];

export function LoadingPress({ operations: externalOps, currentAction: externalAction }: LoadingPressProps) {
  const [internalOps, setInternalOps] = useState<Operation[]>(DEFAULT_OPERATIONS);
  const [internalAction, setInternalAction] = useState('> INITIALIZING SEQUENCE...');
  const [typedAction, setTypedAction] = useState('');
  
  const ops = externalOps || internalOps;
  const actionText = externalAction || internalAction;

  // Simulation effect if no external props are provided
  useEffect(() => {
    if (externalOps) return;

    let isMounted = true;

    const runSequence = async () => {
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      // 20ms per character typing speed
      const typingTime = (text: string) => (text.length + 1) * 20;

      if (!isMounted) return;
      setInternalAction('> SCRAPING LIVE NEWS FEEDS...');
      setInternalOps(prev => {
        const newOps = [...prev];
        newOps[0] = { ...newOps[0], status: 'active' };
        return newOps;
      });
      // Wait for typing to finish + 600ms processing pause
      await wait(typingTime('> SCRAPING LIVE NEWS FEEDS...') + 600);

      if (!isMounted) return;
      setInternalAction('> PARSING LINGUISTIC FALLACIES...');
      setInternalOps(prev => {
        const newOps = [...prev];
        newOps[0] = { ...newOps[0], status: 'done' };
        newOps[1] = { ...newOps[1], status: 'active' };
        return newOps;
      });
      await wait(typingTime('> PARSING LINGUISTIC FALLACIES...') + 600);

      if (!isMounted) return;
      setInternalAction('> EXTRACTING GROUND TRUTH DATA...');
      setInternalOps(prev => {
        const newOps = [...prev];
        newOps[1] = { ...newOps[1], status: 'done' };
        newOps[2] = { ...newOps[2], status: 'active' };
        return newOps;
      });
      await wait(typingTime('> EXTRACTING GROUND TRUTH DATA...') + 600);

      if (!isMounted) return;
      setInternalAction('> CROSS-REFERENCING GLOBAL ARCHIVE...');
      setInternalOps(prev => {
        const newOps = [...prev];
        newOps[2] = { ...newOps[2], status: 'done' };
        return newOps;
      });
      // The parent App.tsx handles the final 1500ms+ delay before unmounting
    };

    runSequence();

    return () => { isMounted = false; };
  }, [externalOps]);

  // Typewriter effect for the large action text
  useEffect(() => {
    setTypedAction(''); // Reset when action changes
    let currentIndex = 0;
    
    const interval = setInterval(() => {
      if (currentIndex <= actionText.length) {
        setTypedAction(actionText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 20); // 20ms fast typing speed
    
    return () => clearInterval(interval);
  }, [actionText]);

  return (
    <div className="flex flex-col items-center min-h-[70vh] bg-[#F4F4F0] px-8 pt-[144px] pb-[144px] md:px-16 md:pt-[192px] border-[12px] border-[#111111] shadow-[16px_16px_0px_#111111] relative overflow-hidden">
      <style>{`
        @keyframes terminal-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-terminal-blink {
          animation: terminal-blink 0.3s step-end infinite;
        }
      `}</style>

      {/* Subtle background grid texture to feel like draft paper */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#111111 1px, transparent 1px), linear-gradient(90deg, #111111 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          backgroundPosition: '0 0'
        }}
      />
      
      <div className="w-full max-w-4xl relative z-10 mx-auto px-4 md:px-12">
        {/* Operations List */}
        <div className="text-[#111111]/40 text-sm md:text-base lg:text-lg mb-[48px] space-y-4 font-mono font-bold tracking-widest uppercase flex flex-col items-start ml-2 md:ml-4">
          {ops.map((op) => {
            if (op.status === 'pending') return null;
            
            return (
              <div key={op.id} className="flex items-center gap-4 transition-all duration-500 text-[#111111]/40">
                <span className={`shrink-0 px-2 py-1 flex items-center justify-center min-w-[70px] ${op.status === 'done' ? 'bg-[#111111]/10' : 'bg-[#D92D20]/10 text-[#D92D20] animate-pulse'}`}>
                  {op.status === 'done' ? '[DONE]' : '[EXEC]'}
                </span>
                <span className="truncate">{op.name}</span>
              </div>
            );
          })}
        </div>
        
        {/* Current Action / Typewriter Text */}
        <div className="text-2xl md:text-3xl lg:text-4xl font-mono font-bold text-[#111111] uppercase tracking-tighter min-h-[96px] leading-[48px]">
          {typedAction}
          <span className="inline-block ml-3 w-[0.5em] h-[0.8em] bg-[#E06C5B] align-middle translate-y-[-0.1em] animate-terminal-blink"></span>
        </div>
      </div>
    </div>
  );
}
