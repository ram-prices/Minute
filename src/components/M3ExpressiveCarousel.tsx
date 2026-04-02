/**
 * MD3 Expressive Carousel with parallax — for gallery posts
 * Usage: drop into PostDetail where gallery items are rendered
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
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

const G = 8;
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
  L,
  M,
  S,
  STEP,
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
  L: number;
  M: number;
  S: number;
  STEP: number;
}) {
  const inputRange = [];
  const widthRange = [];
  const xRange = [];

  const maxBaseK = Math.max(0, total - 3);

  for (let k = -1; k <= total; k++) {
    inputRange.push(k * STEP);
    
    let base_k = Math.min(k, maxBaseK);
    let shift = Math.max(0, k - base_k);
    
    let w0, w1, w2;
    if (shift === 0) { w0 = L; w1 = M; w2 = S; }
    else if (shift === 1) { w0 = M; w1 = L; w2 = S; }
    else if (shift === 2) { w0 = S; w1 = M; w2 = L; }
    else { w0 = S; w1 = M; w2 = L; }

    let pos0 = 0;
    let pos1 = w0 + G;
    let pos2 = w0 + w1 + 2 * G;

    let w = 0;
    let absX = 0;

    if (index < base_k) {
      w = L;
      absX = (index - base_k) * (L + G);
    } else if (index === base_k) {
      w = w0;
      absX = pos0;
    } else if (index === base_k + 1) {
      w = w1;
      absX = pos1;
    } else if (index === base_k + 2) {
      w = w2;
      absX = pos2;
    } else {
      w = 0;
      absX = pos2 + w2 + G + (index - (base_k + 3)) * (S + G);
    }

    widthRange.push(w);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  let L = 0, M = 0, S = 0, STEP = 0;
  if (containerWidth > 0) {
    if (items.length === 1) {
      L = containerWidth;
      M = 0;
      S = 0;
      STEP = L + G;
    } else if (items.length === 2) {
      const available = containerWidth - G;
      L = Math.floor(available * 0.75);
      M = available - L;
      S = 0;
      STEP = L + G;
    } else {
      const available = containerWidth - 2 * G;
      L = Math.floor(available * 0.647);
      M = Math.floor(available * 0.235);
      S = available - L - M;
      STEP = L + G;
    }
  }

  const snapTo = useCallback((index: number) => {
    return -(index * STEP);
  }, [STEP]);

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
    <div className="w-full overflow-hidden select-none py-4" ref={containerRef}>
      {containerWidth > 0 && (
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
                L={L}
                M={M}
                S={S}
                STEP={STEP}
              />
            ))}
          </motion.div>
        </div>
      )}

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
