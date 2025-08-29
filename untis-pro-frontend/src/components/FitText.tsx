import React, { useLayoutEffect, useRef, useState } from 'react';

export default function FitText({
    children,
    reserveBottom = 0,
    align = 'left',
    mode = 'both',
    minScale = 0.6,
    maxScale = 2.0,
    className,
}: {
    children: React.ReactNode;
    reserveBottom?: number; // pixels to reserve at the bottom (e.g., for badges)
    align?: 'left' | 'right';
    mode?: 'height' | 'both';
    minScale?: number;
    maxScale?: number;
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        const measure = () => {
            const cont = containerRef.current;
            const content = contentRef.current;
            if (!cont || !content) return;
            const prev = content.style.transform;
            content.style.transform = 'scale(1)';
            const cw = cont.clientWidth || 1;
            const ch = Math.max(1, (cont.clientHeight || 1) - reserveBottom);
            const sw = content.scrollWidth || 1;
            const sh = content.scrollHeight || 1;
            const sW = cw / sw;
            const sH = ch / sh;
            const raw = mode === 'height' ? sH : Math.min(sW, sH);
            const s = Math.max(minScale, Math.min(maxScale, raw));
            if (Number.isFinite(s)) setScale(s);
            content.style.transform = prev;
        };
        measure();
        const ro = new ResizeObserver(measure);
        if (containerRef.current) ro.observe(containerRef.current);
        if (contentRef.current) ro.observe(contentRef.current);
        window.addEventListener('resize', measure);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [reserveBottom, mode, minScale, maxScale]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ position: 'relative', overflow: 'hidden', height: '100%' }}
        >
            <div
                ref={contentRef}
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin:
                        align === 'right' ? 'top right' : 'top left',
                    display: 'block',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                }}
            >
                {children}
            </div>
        </div>
    );
}
