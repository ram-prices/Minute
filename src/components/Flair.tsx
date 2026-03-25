/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { decodeHtml } from '../lib/decode';

interface FlairProps {
  text?: string;
  richtext?: Array<{ e: 'text'; t?: string } | { e: 'emoji'; u: string; a: string }>;
  backgroundColor?: string;
  textColor?: string;
  className?: string;
}

function getContrastColor(hexColor: string) {
  if (!hexColor || hexColor === 'transparent') return 'var(--md-sys-color-on-surface-variant)';
  
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return 'var(--md-sys-color-on-surface-variant)';
  
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export default function Flair({ text, richtext, backgroundColor, textColor, className = "" }: FlairProps) {
  if (!text && (!richtext || richtext.length === 0)) return null;

  const bg = backgroundColor && backgroundColor !== 'transparent' ? backgroundColor : 'var(--md-sys-color-surface-container-highest)';
  const color = backgroundColor && backgroundColor !== 'transparent' ? getContrastColor(backgroundColor) : 'var(--md-sys-color-on-surface-variant)';

  return (
    <span 
      className={`px-2 py-0.5 text-xs rounded-full font-medium flex items-center gap-1 w-fit ${className}`}
      style={{ backgroundColor: bg, color }}
    >
      {richtext && richtext.length > 0 ? (
        richtext.map((part, i) => {
          if (part.e === 'text') {
            return <span key={i}>{decodeHtml(part.t || '')}</span>;
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
        <span>{decodeHtml(text || '')}</span>
      )}
    </span>
  );
}
