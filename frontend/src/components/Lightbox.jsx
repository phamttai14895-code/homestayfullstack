import React, { useEffect, useMemo, useRef, useState } from "react";

export default function Lightbox({ images = [], index = 0, onIndex, onClose }) {
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const wrapRef = useRef(null);
  const savedFocusRef = useRef(/** @type {HTMLElement | null} */ (null));
  const closeBtnRef = useRef(/** @type {HTMLButtonElement | null} */ (null));

  const src = useMemo(() => images?.[index] || "", [images, index]);

  // lock body scroll + focus trap: save focus, move to close button
  useEffect(() => {
    savedFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => {
      document.body.style.overflow = prev;
      savedFocusRef.current?.focus();
    };
  }, []);

  // focus trap: keep Tab/Shift+Tab inside modal
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function onKeyDown(e) {
      if (e.key !== "Tab") return;
      const focusable = wrap.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const list = Array.from(focusable).filter((el) => !(el instanceof HTMLElement) || !el.hidden);
      const first = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first && lastEl instanceof HTMLElement) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl && first instanceof HTMLElement) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    wrap.addEventListener("keydown", onKeyDown);
    return () => wrap.removeEventListener("keydown", onKeyDown);
  }, []);

  // reset transform when image changes
  useEffect(() => {
    setScale(1);
    setDrag({ x: 0, y: 0 });
  }, [src]);

  function clampScale(v) {
    return Math.max(1, Math.min(4, v));
  }

  function close() {
    onClose?.();
  }

  function prevImg() {
    if (!images?.length) return;
    onIndex?.((index - 1 + images.length) % images.length);
  }

  function nextImg() {
    if (!images?.length) return;
    onIndex?.((index + 1) % images.length);
  }

  function onKey(e) {
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") prevImg();
    if (e.key === "ArrowRight") nextImg();
  }

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Wheel zoom (center zoom UX)
  function onWheel(e) {
    e.preventDefault();
    const delta = -e.deltaY;
    const step = delta > 0 ? 0.15 : -0.15;
    setScale((s) => clampScale(Number((s + step).toFixed(2))));
  }

  // Double click zoom toggle
  function onDoubleClick() {
    setScale((s) => (s === 1 ? 2 : 1));
    setDrag({ x: 0, y: 0 });
  }

  // Drag/pan only when zoomed
  function onMouseDown(e) {
    if (scale <= 1) return;
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
  }
  function onMouseMove(e) {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setDrag((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
  function stopDrag() {
    dragging.current = false;
  }

  // Touch: pinch not implemented (optional), but pan works
  function onTouchStart(e) {
    if (scale <= 1) return;
    if (e.touches.length !== 1) return;
    dragging.current = true;
    last.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchMove(e) {
    if (!dragging.current) return;
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - last.current.x;
    const dy = e.touches[0].clientY - last.current.y;
    last.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setDrag((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
  function onTouchEnd() {
    dragging.current = false;
  }

  return (
    <div
      className="lb"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      {/* Click inside shouldn't close */}
      <div
        className="lb-fit"
        ref={wrapRef}
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
      >
        {!!src && (
          <img
            className="lb-img-fit"
            src={src}
            alt=""
            draggable={false}
            onDoubleClick={onDoubleClick}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
              transform: `translate3d(${drag.x}px, ${drag.y}px, 0) scale(${scale})`,
              cursor: scale > 1 ? (dragging.current ? "grabbing" : "grab") : "zoom-in"
            }}
          />
        )}

        <button ref={closeBtnRef} className="lb-x" onClick={close} type="button" aria-label="Đóng">×</button>

        {images.length > 1 && (
          <>
            <span className="lb-counter" aria-live="polite">
              {index + 1} / {images.length}
            </span>
            <button className="lb-nav left" type="button" onClick={prevImg} aria-label="Ảnh trước">‹</button>
            <button className="lb-nav right" type="button" onClick={nextImg} aria-label="Ảnh sau">›</button>
          </>
        )}

        <div className="lb-hint">
          Con lăn zoom • Double click phóng to/thu nhỏ • Esc đóng
        </div>
      </div>
    </div>
  );
}
