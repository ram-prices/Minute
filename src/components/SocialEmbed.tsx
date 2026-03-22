/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Twitter, ExternalLink, MessageCircle } from 'lucide-react';

interface SocialEmbedProps {
  url: string;
  type: 'twitter' | 'bluesky';
}

export default function SocialEmbed({ url, type }: SocialEmbedProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(false);
      try {
        if (type === 'twitter') {
          const match = url.match(/(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/i);
          if (match) {
            const id = match[3];
            const response = await fetch(`https://api.fxtwitter.com/status/${id}`);
            if (response.ok) {
              const json = await response.json();
              setData(json.tweet);
            } else {
              setError(true);
            }
          }
        } else if (type === 'bluesky') {
          // Bluesky OEmbed
          const response = await fetch(`https://bsky.app/oembed?url=${encodeURIComponent(url)}`);
          if (response.ok) {
            const json = await response.json();
            setData(json);
          } else {
            setError(true);
          }
        }
      } catch (e) {
        console.error('Failed to fetch social metadata', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url, type]);

  if (loading) {
    return (
      <div className="w-full p-6 bg-[#1A1A1B] rounded-xl animate-pulse flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/5" />
          <div className="flex flex-col gap-2">
            <div className="w-24 h-3 bg-white/5 rounded" />
            <div className="w-16 h-2 bg-white/5 rounded" />
          </div>
        </div>
        <div className="w-full h-20 bg-white/5 rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block w-full p-4 bg-[#1A1A1B] rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#818384]">
            {type === 'twitter' ? <Twitter size={16} /> : <MessageCircle size={16} />}
            <span className="text-xs font-bold uppercase tracking-widest">{type}</span>
          </div>
          <ExternalLink size={14} className="text-[#818384]" />
        </div>
        <p className="mt-2 text-sm text-[#D7DADC] truncate">{url}</p>
      </a>
    );
  }

  if (type === 'twitter') {
    return (
      <div className="w-full p-4 bg-[#1A1A1B] rounded-xl border border-white/10 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={data.author.avatar_url} 
              alt="" 
              className="w-10 h-10 rounded-full border border-white/5"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#D7DADC]">{data.author.name}</span>
              <span className="text-xs text-[#818384]">@{data.author.screen_name}</span>
            </div>
          </div>
          <Twitter size={18} className="text-[#1DA1F2]" />
        </div>
        <p className="text-[15px] text-[#D7DADC] leading-relaxed whitespace-pre-wrap">
          {data.text}
        </p>
        {data.media?.photos?.length > 0 && (
          <div className="grid grid-cols-1 gap-2 rounded-lg overflow-hidden mt-2">
            {data.media.photos.map((photo: any, i: number) => (
              <img 
                key={i}
                src={photo.url} 
                alt="" 
                className="w-full h-auto object-cover max-h-[500px] rounded-lg border border-white/5"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
        )}
        {data.media?.videos?.length > 0 && (
          <div className="w-full aspect-video rounded-lg overflow-hidden mt-2 border border-white/5 bg-black">
            <video 
              src={data.media.videos[0].url} 
              controls 
              className="w-full h-full object-contain"
              poster={data.media.videos[0].thumbnail_url}
            />
          </div>
        )}
        <div className="flex items-center gap-4 text-[11px] text-[#818384] font-bold uppercase tracking-wider mt-1">
          <span>{new Date(data.created_at).toLocaleDateString()}</span>
          <span>•</span>
          <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-[#D7DADC] flex items-center gap-1">
            View on X <ExternalLink size={10} />
          </a>
        </div>
      </div>
    );
  }

  // Bluesky
  return (
    <div className="w-full p-4 bg-[#1A1A1B] rounded-xl border border-white/10 flex flex-col gap-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold overflow-hidden">
            {data.author_name?.charAt(0) || 'B'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#D7DADC]">{data.author_name || 'Bluesky User'}</span>
            <span className="text-xs text-[#818384]">Bluesky</span>
          </div>
        </div>
        <MessageCircle size={18} className="text-blue-400" />
      </div>
      <div 
        className="text-[15px] text-[#D7DADC] leading-relaxed whitespace-pre-wrap social-embed-content" 
        dangerouslySetInnerHTML={{ __html: data.html }} 
      />
      <div className="flex items-center gap-4 text-[11px] text-[#818384] font-bold uppercase tracking-wider mt-1">
        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-[#D7DADC] flex items-center gap-1">
          View on Bluesky <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}
