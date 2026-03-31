/**
 * MD3 Expressive Carousel with parallax — for gallery posts
 * Usage: drop into PostDetail where gallery items are rendered
 */

import React, { useState, useCallback } from 'react';
import { motion, useMotionValue, animate, PanInfo, useTransform } from 'motion/react';

interface GalleryItem {
  media_id: string;
  id: number;
}

interface MediaMetadata {
  [key: string]: {
    s: { u: string; x?: number; y?: number };
    p?: { u: string; x: number; y: number }[];
    t?: string;
    id?: string;
    gif?: string;
  };
}

interface M3ExpressiveCarouselProps {
  items: GalleryItem[];
  mediaMetadata: MediaMetadata;
  title: string;
  onMediaClick?: (index: number) => void;
}

const L = 220;
const M = 80;
const S = 40;
const G = 8;
const STEP = L + G; // 228
const CARD_HEIGHT = 380;

function CarouselItem({
  item,
  index,
  x,
  mediaMetadata,
  title,
  onMediaClick,
  activeIndex,
  goTo,
  total,
}: {
  item: GalleryItem;
  index: number;
  x: any;
  mediaMetadata: MediaMetadata;
  title: string;
  onMediaClick?: (index: number) => void;
  activeIndex: number;
  goTo: (index: number) => void;
  total: number;
}) {
  const inputRange = [];
  const widthRange = [];
  const xRange = [];

  for (let k = -1; k <= total; k++) {
    inputRange.push(k * STEP);
    const d = index - k;
    
    let absX = 0;
    if (d <= 0) {
      widthRange.push(L);
      absX = d * (L + G);
    } else if (d === 1) {
      widthRange.push(M);
      absX = L + G;
    } else {
      widthRange.push(S);
      absX = L + M + 2 * G + (d - 2) * (S + G);
    }
    xRange.push(absX + k * STEP);
  }

  const scrollX = useTransform(x, (v: number) => -v);
  const width = useTransform(scrollX, inputRange, widthRange, { clamp: false });
  const leftPos = useTransform(scrollX, inputRange, xRange, { clamp: false });

  const clipPath = useTransform(width, (w) => `inset(0px ${L - w}px 0px 0px round 24px)`);
  const parallaxX = useTransform(width, (w) => -(L - w) / 2);
  const badgeOpacity = useTransform(width, [L - 40, L], [0, 1]);

  const meta = mediaMetadata[item.media_id];
  const preview = meta?.p?.find(p => p.x >= 640) || meta?.p?.[meta.p.length - 1];
  const mediaUrl = (preview?.u || meta?.s?.u || '').replace(/&amp;/g, '&');

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: leftPos,
        width: L,
        height: CARD_HEIGHT,
        clipPath,
        WebkitClipPath: clipPath,
        cursor: 'pointer',
      }}
      onClick={() => {
        if (index === activeIndex) {
          onMediaClick?.(index);
        } else {
          goTo(index);
        }
      }}
      whileTap={{ scale: 0.98 }}
    >
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          x: parallaxX,
        }}
      >
        <img
          src={mediaUrl}
          alt={title}
          draggable={false}
          referrerPolicy="no-referrer"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
            display: 'block',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </motion.div>

      {/* Subtle Scrim for Badge */}
      <motion.div 
        style={{ opacity: badgeOpacity }}
        className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" 
      />

      {/* Index Badge */}
      <motion.div 
        style={{ opacity: badgeOpacity }}
        className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full pointer-events-none tracking-wide"
      >
        {index + 1} / {total}
      </motion.div>
    </motion.div>
  );
}

export default function M3ExpressiveCarousel({
  items,
  mediaMetadata,
  title,
  onMediaClick,
}: M3ExpressiveCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const x = useMotionValue(0);

  const snapTo = useCallback((index: number) => -(index * STEP), []);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      setActiveIndex(clamped);
      animate(x, snapTo(clamped), {
        type: 'spring',
        stiffness: 500,
        damping: 35,
        mass: 0.5,
      });
    },
    [items.length, snapTo, x]
  );

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const velocity = info.velocity.x;
    const projectedX = x.get() + velocity * 0.2;
    const projectedIndex = Math.round(-projectedX / STEP);
    goTo(projectedIndex);
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="w-full overflow-hidden select-none py-4">
      <div className="relative w-full" style={{ height: CARD_HEIGHT }}>
        <motion.div
          className="absolute top-0 bottom-0 cursor-grab active:cursor-grabbing"
          style={{ x, left: 0, right: 0 }}
          drag="x"
          dragConstraints={{
            left: snapTo(items.length - 1),
            right: 0,
          }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
        >
          {items.map((item, index) => (
            <CarouselItem
              key={item.media_id}
              item={item}
              index={index}
              x={x}
              mediaMetadata={mediaMetadata}
              title={title}
              onMediaClick={onMediaClick}
              activeIndex={activeIndex}
              goTo={goTo}
              total={items.length}
            />
          ))}
        </motion.div>
      </div>

      {/* Pill-dot indicators */}
      <div className="flex justify-center items-center gap-1.5 mt-4">
        {items.map((_, i) => (
          <motion.button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to image ${i + 1}`}
            animate={{
              width: i === activeIndex ? 24 : 6,
              opacity: i === activeIndex ? 1 : 0.4,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="h-1.5 rounded-full bg-primary flex-shrink-0"
          />
        ))}
      </div>
    </div>
  );
}
