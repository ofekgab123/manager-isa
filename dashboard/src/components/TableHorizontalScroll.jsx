import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Wide table wrapper: horizontal scrollbar above + below (synced), with side arrow buttons.
 */
export default function TableHorizontalScroll({ children, className = '' }) {
  const mainScrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const syncLock = useRef(false);

  const [mirrorWidth, setMirrorWidth] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setMirrorWidth(scrollWidth);
    const overflow = scrollWidth > clientWidth + 1;
    setHasOverflow(overflow);
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    updateScrollState();
    const onMainScroll = () => {
      if (syncLock.current) return;
      const top = topScrollRef.current;
      if (top && top.scrollLeft !== el.scrollLeft) {
        syncLock.current = true;
        top.scrollLeft = el.scrollLeft;
        requestAnimationFrame(() => {
          syncLock.current = false;
        });
      }
      updateScrollState();
    };
    el.addEventListener('scroll', onMainScroll, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    const mo = new MutationObserver(() => {
      requestAnimationFrame(updateScrollState);
    });
    mo.observe(el, { childList: true, subtree: true, attributes: true });
    return () => {
      el.removeEventListener('scroll', onMainScroll);
      ro.disconnect();
      mo.disconnect();
    };
  }, [updateScrollState]);

  useEffect(() => {
    const main = mainScrollRef.current;
    const top = topScrollRef.current;
    if (!main || !top || !hasOverflow) return;
    top.scrollLeft = main.scrollLeft;
  }, [hasOverflow, mirrorWidth]);

  const onTopScroll = useCallback(() => {
    const main = mainScrollRef.current;
    const top = topScrollRef.current;
    if (!main || !top || syncLock.current) return;
    syncLock.current = true;
    main.scrollLeft = top.scrollLeft;
    requestAnimationFrame(() => {
      syncLock.current = false;
    });
    updateScrollState();
  }, [updateScrollState]);

  const step = () => {
    const el = mainScrollRef.current;
    if (!el) return Math.min(320, Math.floor(window.innerWidth * 0.45));
    return Math.min(320, Math.floor(el.clientWidth * 0.75));
  };

  const scrollPrev = () => mainScrollRef.current?.scrollBy({ left: -step(), behavior: 'smooth' });
  const scrollNext = () => mainScrollRef.current?.scrollBy({ left: step(), behavior: 'smooth' });

  const btnBase =
    'shrink-0 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 disabled:pointer-events-none disabled:opacity-25';

  const scrollRowClass = 'min-w-0 flex-1 overflow-x-auto scroll-smooth';

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {hasOverflow && mirrorWidth > 0 && (
        <div className="flex items-stretch gap-1">
          <span className="w-10 shrink-0 self-center" aria-hidden />
          <div
            ref={topScrollRef}
            onScroll={onTopScroll}
            className={`${scrollRowClass} max-h-[14px] overflow-y-hidden rounded border border-slate-100 bg-slate-50/80`}
            aria-label="Table horizontal scroll (top)"
          >
            <div style={{ width: mirrorWidth, height: 1 }} aria-hidden />
          </div>
          <span className="w-10 shrink-0 self-center" aria-hidden />
        </div>
      )}
      <div className="flex items-stretch gap-1">
        {hasOverflow && (
          <button
            type="button"
            aria-label="Scroll table left"
            className={`${btnBase} self-center`}
            onClick={scrollPrev}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="h-6 w-6 shrink-0" strokeWidth={2.25} />
          </button>
        )}
        <div ref={mainScrollRef} className={scrollRowClass}>
          {children}
        </div>
        {hasOverflow && (
          <button
            type="button"
            aria-label="Scroll table right"
            className={`${btnBase} self-center`}
            onClick={scrollNext}
            disabled={!canScrollRight}
          >
            <ChevronRight className="h-6 w-6 shrink-0" strokeWidth={2.25} />
          </button>
        )}
      </div>
    </div>
  );
}
