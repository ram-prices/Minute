import React from 'react';

interface SquigglyLoaderProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

export function SquigglyLoader({ className = '', size = 48, strokeWidth = 5 }: SquigglyLoaderProps) {
  // Generate a wavy circle path
  const points = Array.from({ length: 360 }, (_, i) => {
    const angle = (i * Math.PI) / 180;
    // Base radius 18, wave amplitude 2.5, 12 waves
    const radius = 18 + 2.5 * Math.sin(12 * angle);
    const x = 24 + radius * Math.cos(angle);
    const y = 24 + radius * Math.sin(angle);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ') + ' Z';

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 48 48" 
      className={`animate-spin ${className}`}
      style={{ animationDuration: '2s' }}
    >
      <path 
        d={points} 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={strokeWidth} 
        strokeLinejoin="round"
        strokeLinecap="round"
        className="opacity-20"
      />
      <path 
        d={points} 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={strokeWidth} 
        strokeLinejoin="round"
        strokeLinecap="round"
        className="animate-[squiggly-dash_1.5s_ease-in-out_infinite]"
      />
    </svg>
  );
}
