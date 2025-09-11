import * as React from 'react';
import { createPortal } from 'react-dom';

interface SimpleTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
}

export function SimpleTooltip({ children, content }: SimpleTooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  // Anchor stores the trigger's centerX, top and bottom for placement calculations
  const [anchor, setAnchor] = React.useState({ centerX: 0, top: 0, bottom: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = React.useState({ width: 0, height: 0 });

  // Create or get tooltip container
  const getTooltipContainer = () => {
    let container = document.getElementById('tooltip-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tooltip-container';
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '999999';
      document.body.appendChild(container);
    }
    return container;
  };

  const updateAnchor = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setAnchor({ centerX: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom });
  }, []);

  const handleMouseEnter = () => {
    updateAnchor();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  React.useEffect(() => {
    if (!isVisible) return;
    const measure = () => {
      const el = tooltipRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTooltipSize({ width: rect.width, height: rect.height });
    };
    // Measure on next paint
    const raf = requestAnimationFrame(measure);
    // Keep tooltip positioned on resize/scroll
    const onResize = () => {
      updateAnchor();
      measure();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [isVisible, updateAnchor]);

  // Compute safe, clamped position inside the viewport
  const margin = 8;
  const width = tooltipSize.width || 240; // sensible defaults before first measure
  const height = tooltipSize.height || 40;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const hasRoomAbove = anchor.top >= height + margin + 2;
  const desiredTop = hasRoomAbove ? anchor.top - margin - height : anchor.bottom + margin;
  const clampedTop = Math.max(margin, Math.min(desiredTop, vh - margin - height));
  const clampedCenterX = Math.max(
    margin + width / 2,
    Math.min(anchor.centerX, vw - margin - width / 2),
  );

  return (
    <>
      <button
        type="button"
        ref={triggerRef as unknown as React.RefObject<HTMLButtonElement>}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block bg-transparent p-0 m-0 border-0"
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
      >
        {children}
      </button>
      {isVisible &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              position: 'fixed',
              left: clampedCenterX,
              top: clampedTop,
              transform: 'translateX(-50%)',
              zIndex: 999999,
              padding: '6px 12px',
              fontSize: '12px',
              color: 'white',
              backgroundColor: '#1f2937',
              borderRadius: '6px',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #374151',
              maxWidth: '300px',
              whiteSpace: 'pre-line',
              pointerEvents: 'none',
            }}
          >
            {content}
          </div>,
          getTooltipContainer(),
        )}
    </>
  );
}
