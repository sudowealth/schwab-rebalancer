import * as React from 'react';
import { createPortal } from 'react-dom';

interface SimpleTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
}

export function SimpleTooltip({ children, content }: SimpleTooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);

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

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();

      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

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
            style={{
              position: 'fixed',
              left: Math.max(10, Math.min(position.x, window.innerWidth - 200)),
              top: Math.max(10, position.y - 10),
              transform: 'translate(-50%, -100%)',
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
