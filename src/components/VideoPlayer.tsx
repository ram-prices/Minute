/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Volume2, VolumeX, Play, Pause, Maximize } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  hlsUrl?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  className?: string;
  poster?: string;
  playOnHover?: boolean;
}

export default function VideoPlayer({ 
  src, 
  hlsUrl, 
  autoPlay = false, 
  muted = false, 
  controls = true,
  className = "",
  poster = "",
  playOnHover = false
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(muted);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [showControls, setShowControls] = useState(false);

  const handleMouseEnter = () => {
    setShowControls(true);
    if (playOnHover && videoRef.current) {
      videoRef.current.play().catch(e => console.error("Hover play failed", e));
      setIsPlaying(true);
    }
  };

  const handleMouseLeave = () => {
    setShowControls(false);
    if (playOnHover && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    setIsMuted(muted);
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (hlsUrl && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) {
          video.play().catch(e => console.error("Autoplay failed", e));
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = hlsUrl || src;
      if (autoPlay) {
        video.play().catch(e => console.error("Autoplay failed", e));
      }
    } else {
      // Fallback to direct source
      video.src = src;
    }

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      if (hls) {
        hls.destroy();
      }
    };
  }, [src, hlsUrl, autoPlay]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const newMuted = !videoRef.current.muted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    if (playOnHover) return; // Let parent handle clicks if it's a preview
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div 
      className={`relative group bg-black overflow-hidden ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        poster={poster}
        muted={isMuted}
        loop
        playsInline
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onContextMenu={(e) => e.preventDefault()}
      />

      {controls && (
        <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="hover:scale-110 transition-transform">
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>
              <button onClick={toggleMute} className="hover:scale-110 transition-transform">
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>
            
            <button onClick={handleFullscreen} className="hover:scale-110 transition-transform">
              <Maximize size={20} />
            </button>
          </div>
        </div>
      )}

      {!isPlaying && !showControls && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="p-4 bg-black/40 backdrop-blur-sm rounded-full text-white">
            <Play size={32} fill="currentColor" className="ml-1" />
          </div>
        </div>
      )}
    </div>
  );
}
