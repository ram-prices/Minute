import React, { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface RippleProps {
  color?: string;
  duration?: number;
}

interface RippleItem {
  id: number;
  x: number;
  y: number;
  size: number;
}

export const Ripple = ({ color = 'currentColor', duration = 600 }: RippleProps) => {
  const [ripples, setRipples] = useState<RippleItem[]>([]);
  const [isTapping, setIsTapping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const addRipple = (event: MouseEvent | TouchEvent) => {
    if (!containerRef.current) return;
    
    setIsTapping(true);
    const container = containerRef.current.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    // Increase size to ensure it covers the entire area even from corners
    const size = Math.max(container.width, container.height) * 2.5;
    const x = clientX - container.left - size / 2;
    const y = clientY - container.top - size / 2;

    const newRipple: RippleItem = {
      id: Date.now() + Math.random(),
      x,
      y,
      size,
    };

    setRipples((prev) => [...prev, newRipple]);
  };

  const handleStopTapping = () => setIsTapping(false);

  useLayoutEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return;

    const onMouseDown = (e: MouseEvent) => addRipple(e);
    const onTouchStart = (e: TouchEvent) => addRipple(e);
    const onStop = () => handleStopTapping();

    parent.addEventListener('mousedown', onMouseDown);
    parent.addEventListener('touchstart', onTouchStart, { passive: true });
    parent.addEventListener('mouseup', onStop);
    parent.addEventListener('mouseleave', onStop);
    parent.addEventListener('touchend', onStop);
    parent.addEventListener('touchcancel', onStop);

    return () => {
      parent.removeEventListener('mousedown', onMouseDown);
      parent.removeEventListener('touchstart', onTouchStart);
      parent.removeEventListener('mouseup', onStop);
      parent.removeEventListener('mouseleave', onStop);
      parent.removeEventListener('touchend', onStop);
      parent.removeEventListener('touchcancel', onStop);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none rounded-[inherit] z-0"
    >
      <AnimatePresence>
        {isTapping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.05 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
            style={{ backgroundColor: color }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.2 }}
            animate={{ scale: 1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: duration / 1000, 
              ease: [0.25, 0.1, 0.25, 1.0] // Smoother ease-out
            }}
            onAnimationComplete={() => {
              setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
            }}
            style={{
              position: 'absolute',
              top: ripple.y,
              left: ripple.x,
              width: ripple.size,
              height: ripple.size,
              borderRadius: '50%',
              backgroundColor: color,
              pointerEvents: 'none',
              filter: 'blur(12px)', // Much softer edges like the video
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export const withRipple = <P extends object>(Component: React.ComponentType<P>) => {
  return (props: P & { rippleColor?: string }) => {
    const { rippleColor, ...rest } = props;
    return (
      <div className="relative overflow-hidden rounded-[inherit] inline-flex">
        <Component {...(rest as P)} />
        <Ripple color={rippleColor} />
      </div>
    );
  };
};
