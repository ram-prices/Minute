/**
 * MD3 Expressive Carousel with parallax — for gallery posts
 * Usage: drop into PostDetail where gallery items are rendered
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, useMotionValue, animate, PanInfo, useTransform } from 'motion/react';

interface GalleryItem {
  media_id: string;
  id: number;
}

interface MediaMetadata {
  [key: string]: {
    s: { u: string; x?: number; y?: number };
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

const MAX_WIDTH = 320;
const MIN_WIDTH = 140;
const GAP = 12;
const SCROLL_STEP = (MAX_WIDTH + MIN_WIDTH) / 2 + GAP; // 242
const CARD_HEIGHT = 420;
const PARALLAX_STRENGTH = 40;

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
  const cx = index * SCROLL_STEP;

  // Distance from the center of the screen
  const distance = useTransform(x, (latestX: number) => latestX + cx);

  const width = useTransform(
    distance,
    [-SCROLL_STEP, 0, SCROLL_STEP],
    [MIN_WIDTH, MAX_WIDTH, MIN_WIDTH],
    { clamp: true }
  );

  const parallaxX = useTransform(
    distance,
    [-SCROLL_STEP, 0, SCROLL_STEP],
    [-PARALLAX_STRENGTH, 0, PARALLAX_STRENGTH],
    { clamp: true }
  );

  const opacity = useTransform(
    distance,
    [-2 * SCROLL_STEP, -SCROLL_STEP, 0, SCROLL_STEP, 2 * SCROLL_STEP],
    [0, 1, 1, 1, 0],
    { clamp: true }
  );

  const meta = mediaMetadata[item.media_id];
  const mediaUrl = meta?.s?.u?.replace(/&amp;/g, '&') || '';

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: cx,
        x: '-50%',
        width,
        height: CARD_HEIGHT,
        opacity,
        borderRadius: 24,
        overflow: 'hidden',
        cursor: 'pointer',
        // Removed background color to meet requirements
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
          left: -PARALLAX_STRENGTH,
          right: -PARALLAX_STRENGTH,
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
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

      {/* Index Badge */}
      <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full pointer-events-none tracking-wide">
        {index + 1} / {total}
      </div>
      
      {/* Active Border */}
      {index === activeIndex && (
        <div className="absolute inset-0 rounded-[24px] border border-white/20 pointer-events-none" />
      )}
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

  const snapTo = useCallback((index: number) => -(index * SCROLL_STEP), []);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      setActiveIndex(clamped);
      animate(x, snapTo(clamped), {
        type: 'spring',
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      });
    },
    [items.length, snapTo, x]
  );

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const velocity = info.velocity.x;
    const offset = info.offset.x;
    
    // Determine if the swipe was strong enough or far enough to change cards
    if (velocity < -300 || offset < -(SCROLL_STEP / 3)) {
      goTo(activeIndex + 1);
    } else if (velocity > 300 || offset > SCROLL_STEP / 3) {
      goTo(activeIndex - 1);
    } else {
      goTo(activeIndex);
    }
  };

  return (
    <div className="w-full overflow-hidden select-none py-4">
      <div className="relative w-full" style={{ height: CARD_HEIGHT }}>
        <motion.div
          className="absolute top-0 bottom-0 cursor-grab active:cursor-grabbing"
          style={{ x, left: '50%' }}
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
