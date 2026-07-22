import React, { useState, useRef, useEffect } from 'react';
import { Network, AlertTriangle, Zap, Target, ExternalLink } from 'lucide-react';

/** Strip leaked HTML entities like &nbsp; */
const cleanText = (s: string) => s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export interface EvidenceNode {
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

export interface Connection {
  from: string;
  to: string;
  nli?: {
    type: 'contradiction' | 'entailment';
    score: number;
  };
}

interface SourceTrackingProps {
  sourceTree: EvidenceNode[];
  connections: Connection[];
}

export function SourceTracking({ sourceTree, connections }: SourceTrackingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<EvidenceNode[]>(sourceTree || []);
  
  const [dragging, setDragging] = useState<{
    id: string;
    startX: number;
    startY: number;
    initialNodeX: number;
    initialNodeY: number;
  } | null>(null);

  // Sync state if props change (though typically static per analysis)
  useEffect(() => {
    setNodes(sourceTree || []);
  }, [sourceTree]);

  // Handle Dragging Logic
  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;
      
      const dxPct = (dx / rect.width) * 100;
      const dyPct = (dy / rect.height) * 100;
      
      setNodes(prev => prev.map(n => n.id === dragging.id ? {
        ...n,
        x: Math.max(5, Math.min(95, dragging.initialNodeX + dxPct)),
        y: Math.max(5, Math.min(95, dragging.initialNodeY + dyPct))
      } : n));
    };

    const handlePointerUp = () => setDragging(null);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging]);

  const handlePointerDown = (e: React.PointerEvent, node: EvidenceNode) => {
    // Only drag with left click
    if (e.button !== 0) return;
    
    // Prevent text selection while dragging
    e.preventDefault();
    
    // Bring to front by moving to end of array
    setNodes(prev => {
      const filtered = prev.filter(n => n.id !== node.id);
      return [...filtered, node];
    });

    setDragging({
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      initialNodeX: node.x,
      initialNodeY: node.y
    });
  };

  const roleStyles = {
    hostile: { bg: '#D92D20', text: '#F4F4F0', label: 'HOSTILE ACTOR', icon: AlertTriangle },
    amplifier: { bg: '#F5D000', text: '#111111', label: 'AMPLIFIER', icon: Zap },
    current: { bg: '#111111', text: '#F4F4F0', label: 'CURRENT CLAIM', icon: Target }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Legend */}
      <div className="flex justify-end mb-4 pr-2">
        <div className="flex gap-6 text-[0.65rem] tracking-wider uppercase font-mono">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#D92D20] border border-[#111111]" /> Hostile Actor
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#F5D000] border border-[#111111]" /> Amplifier
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#111111] border border-[#111111]" /> Current Claim
          </div>
        </div>
      </div>

      {/* Board Container */}
      <div 
        ref={containerRef}
        className="relative w-full h-[750px] bg-[#EAE8E3] overflow-hidden border-[6px] border-[#111111]"
        style={{
          backgroundImage: 'radial-gradient(#111111 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
          backgroundPosition: '-12px -12px'
        }}
      >
        {/* SVG String Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {/* Drop shadow filter for physical string effect */}
          <filter id="string-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="4" stdDeviation="2" floodOpacity="0.4" />
          </filter>

          {connections?.map((conn, i) => {
            const fromNode = nodes.find(n => n.id === conn.from);
            const toNode = nodes.find(n => n.id === conn.to);
            if (!fromNode || !toNode) return null;

            return (
              <g key={`conn-${i}`}>
                {/* String */}
                <line
                  x1={`${fromNode.x}%`}
                  y1={`${fromNode.y}%`}
                  x2={`${toNode.x}%`}
                  y2={`${toNode.y}%`}
                  stroke="#D92D20"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  style={{ filter: 'url(#string-shadow)' }}
                />
              </g>
            );
          })}
          
          {/* Pins */}
          {nodes.map(node => (
            <circle
              key={`pin-${node.id}`}
              cx={`${node.x}%`}
              cy={`${node.y}%`}
              r="5"
              fill="#111111"
              stroke="#F4F4F0"
              strokeWidth="1.5"
              style={{ filter: 'url(#string-shadow)' }}
            />
          ))}
        </svg>

        {/* NLI Score Badges */}
        {connections?.map((conn, i) => {
          if (!conn.nli) return null;
          const fromNode = nodes.find(n => n.id === conn.from);
          const toNode = nodes.find(n => n.id === conn.to);
          if (!fromNode || !toNode) return null;

          const midX = (fromNode.x + toNode.x) / 2;
          const midY = (fromNode.y + toNode.y) / 2;

          const isContradiction = conn.nli.type === 'contradiction';
          const accentColor = isContradiction ? '#D92D20' : '#16A34A';
          
          return (
            <div 
              key={`badge-${i}`}
              className="absolute z-[15] pointer-events-none px-2.5 py-1 rounded-full border-[1.5px] border-[#111111] bg-white flex items-center gap-1.5 shadow-[2px_2px_0px_#111111]"
              style={{
                left: `${midX}%`,
                top: `${midY}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div 
                className="w-2 h-2 rounded-full border border-[#111111]" 
                style={{ backgroundColor: accentColor }} 
              />
              <span className="font-mono text-[0.6rem] font-bold text-[#111111] uppercase tracking-wider whitespace-nowrap mt-px">
                {conn.nli.score}% {conn.nli.type}
              </span>
            </div>
          );
        })}

        {/* Nodes (Clippings) */}
        {nodes.map(node => {
          const styleConfig = roleStyles[node.role];
          const Icon = styleConfig.icon;
          
          return (
            <div
              key={node.id}
              onPointerDown={(e) => handlePointerDown(e, node)}
              className="absolute z-20 cursor-grab active:cursor-grabbing w-[240px] shadow-[6px_6px_0px_#111111] border-2 border-[#111111] bg-white transition-shadow hover:shadow-[8px_8px_0px_#111111]"
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: `translate(-50%, -50%) rotate(${node.rotation}deg)`,
                touchAction: 'none'
              }}
            >
              {/* Tape Graphic */}
              <div 
                className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-6 border border-[#111111]/20 bg-[#F4F4F0]/80 z-30"
                style={{
                  transform: 'rotate(-4deg)',
                  boxShadow: '1px 1px 2px rgba(0,0,0,0.1)'
                }}
              />

              {/* Node Header */}
              <div 
                className="px-3 py-2 border-b-2 border-[#111111] flex items-center gap-2"
                style={{ backgroundColor: styleConfig.bg, color: styleConfig.text }}
              >
                <Icon className="w-4 h-4" />
                <span 
                  className="font-mono text-[0.65rem] tracking-wider uppercase font-bold"
                >
                  {styleConfig.label}
                </span>
              </div>

              {/* Node Content */}
              <div className="p-4 flex flex-col gap-3">
                {/* Meta */}
                <div 
                  className="font-mono text-[0.6rem] uppercase tracking-wide text-[#555555] flex flex-col border-b border-dashed border-[#111111] pb-2"
                >
                  <span className="font-bold text-[#111111]">{cleanText(node.type)}</span>
                  <span>{cleanText(node.author)}</span>
                  <span>{node.date}</span>
                </div>

                {/* Snippet */}
                <p 
                  className="leading-snug text-[0.85rem]"
                  style={{
                    fontFamily: 'var(--font-serif)',
                    color: '#111111'
                  }}
                >
                  "{cleanText(node.content)}"
                </p>

                {/* Source Link */}
                {node.url && (
                  <div className="mt-1 pt-3 border-t border-dashed border-[#111111]">
                    <a 
                      href={node.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onPointerDown={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-[#111111] hover:text-[#D92D20] hover:underline w-full transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Examine Source
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Footer / Interaction Hint */}
      <div className="border-t-4 border-[#111111] p-3 bg-white text-center">
        <span className="font-mono text-[0.65rem] uppercase tracking-widest text-[#111111] font-bold">
          [ Interactive Evidence Board • Drag clippings to rearrange network ]
        </span>
      </div>
    </div>
  );
}
