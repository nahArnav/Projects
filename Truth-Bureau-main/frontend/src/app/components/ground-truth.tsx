import { Scale } from 'lucide-react';

interface GroundTruthProps {
  groundTruth: string;
}

export function GroundTruth({ groundTruth }: GroundTruthProps) {
  // Strip any leaked HTML entities
  const cleanText = groundTruth.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

  return (
    <div className="h-full flex flex-col bg-[#111111] text-[#F4F4F0] p-8 lg:p-12 shadow-[8px_8px_0px_#D92D20] relative border-4 border-[#111111]">
      <div className="absolute top-6 right-6 lg:top-8 lg:right-8 text-[#D92D20]">
        <Scale size={32} strokeWidth={2.5} />
      </div>
      <div className="font-mono text-[0.65rem] md:text-xs uppercase tracking-[0.2em] font-bold mb-4 text-[#F4F4F0]/80">
        [ ✓ ESTABLISHED FACT ]
      </div>
      <p className="font-serif font-bold text-xl md:text-2xl leading-snug pr-12">
        {cleanText}
      </p>
    </div>
  );
}
