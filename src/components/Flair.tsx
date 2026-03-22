/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface FlairProps {
  text?: string;
  richtext?: Array<{ e: 'text'; t?: string } | { e: 'emoji'; u: string; a: string }>;
  backgroundColor?: string;
  textColor?: string;
  className?: string;
}

export default function Flair({ text, richtext, backgroundColor, textColor, className = "" }: FlairProps) {
  if (!text && (!richtext || richtext.length === 0)) return null;

  const isDark = textColor === 'dark';
  const bg = backgroundColor || '#1A1A1B';
  const color = isDark ? '#030303' : '#D7DADC';

  return (
    <span 
      className={`px-1.5 py-0.5 text-[10px] rounded font-bold border border-white/10 shadow-sm flex items-center gap-1 w-fit ${className}`}
      style={{ backgroundColor: bg, color }}
    >
      {richtext && richtext.length > 0 ? (
        richtext.map((part, i) => {
          if (part.e === 'text') {
            return <span key={i}>{part.t || part.e}</span>;
          }
          if (part.e === 'emoji') {
            return (
              <img 
                key={i}
                src={part.u.replace(/&amp;/g, '&')} 
                alt={part.a} 
                className="w-3.5 h-3.5 object-contain"
                referrerPolicy="no-referrer"
              />
            );
          }
          return null;
        })
      ) : (
        <span>{text}</span>
      )}
    </span>
  );
}
