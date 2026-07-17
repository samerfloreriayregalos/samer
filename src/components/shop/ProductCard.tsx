'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Product } from '@/types';

interface ProductCardProps {
  product: Product;
}

interface ImageViewerProps {
  src: string;
  alt: string;
  triggerRect: DOMRect | null;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, triggerRect, onClose }) => {
  const [phase, setPhase] = useState<'opening' | 'open' | 'closing'>('opening');
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetAtDrag = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  // Animación entrada
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('open'));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Botón atrás
  useEffect(() => {
    window.history.pushState({ imageViewer: true }, '');
    const handlePop = () => triggerClose();
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') triggerClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Bloquear scroll body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Wheel nativo passive:false — solo en el contenedor de imagen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const next = clampScale(scaleRef.current - e.deltaY * 0.005);
      scaleRef.current = next;
      setScale(next);
      if (next === 1) {
        offsetRef.current = { x: 0, y: 0 };
        setOffset({ x: 0, y: 0 });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const clampScale = (s: number) => Math.min(Math.max(s, 1), 4);

  const triggerClose = useCallback(() => {
    setPhase('closing');
    if (window.history.state?.imageViewer) window.history.back();
  }, []);

  const handleTransitionEnd = () => {
    if (phase === 'closing') onClose();
  };

  // Pan mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scaleRef.current <= 1) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetAtDrag.current = { ...offsetRef.current };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const clamped = clampOffset(
      offsetAtDrag.current.x + (e.clientX - dragStart.current.x),
      offsetAtDrag.current.y + (e.clientY - dragStart.current.y),
    );
    offsetRef.current = clamped;
    setOffset(clamped);
  };
  const handleMouseUp = () => { isDragging.current = false; };

  // Touch
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scaleRef.current > 1) {
      isDragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      offsetAtDrag.current = { ...offsetRef.current };
    }
    if (e.touches.length === 2) lastPinchDist.current = getPinchDist(e);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = getPinchDist(e);
      if (lastPinchDist.current) {
        const next = clampScale(scaleRef.current + (dist - lastPinchDist.current) * 0.01);
        scaleRef.current = next;
        setScale(next);
      }
      lastPinchDist.current = dist;
      return;
    }
    if (isDragging.current && e.touches.length === 1) {
      const clamped = clampOffset(
        offsetAtDrag.current.x + (e.touches[0].clientX - dragStart.current.x),
        offsetAtDrag.current.y + (e.touches[0].clientY - dragStart.current.y),
      );
      offsetRef.current = clamped;
      setOffset(clamped);
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) lastPinchDist.current = null;
    isDragging.current = false;
  };

  const getPinchDist = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const clampOffset = (x: number, y: number) => {
    if (!imgRef.current || !containerRef.current) return { x, y };
    const con = containerRef.current.getBoundingClientRect();
    const scaledW = con.width * scaleRef.current;
    const scaledH = con.height * scaleRef.current;
    const maxX = Math.max(0, (scaledW - con.width) / 2);
    const maxY = Math.max(0, (scaledH - con.height) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const handleDoubleClick = () => {
    if (scaleRef.current > 1) {
      scaleRef.current = 1; offsetRef.current = { x: 0, y: 0 };
      setScale(1); setOffset({ x: 0, y: 0 });
    } else {
      scaleRef.current = 2; setScale(2);
    }
  };

  // ── Animación: usar clientWidth/clientHeight para ignorar el scrollbar
  //    y así centrar correctamente aunque haya overflow en la página
  const getModalStyle = (): React.CSSProperties => {
    if (!triggerRect) return {};
    // clientWidth excluye scrollbars — evita el descentrado
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const fromX = triggerRect.left + triggerRect.width / 2;
    const fromY = triggerRect.top + triggerRect.height / 2;

    if (phase === 'opening' || phase === 'closing') {
      return {
        transform: `translate(${fromX - vw / 2}px, ${fromY - vh / 2}px) scale(0.08)`,
        opacity: 0,
      };
    }
    return { transform: 'translate(0,0) scale(1)', opacity: 1 };
  };

  return (
    // El overlay ocupa exactamente el viewport con position:fixed
    <div
      onClick={triggerClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: phase === 'open' ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0)',
        transition: 'background-color 0.35s ease',
        // Importante: evita que el overlay mismo cause overflow
        overflow: 'hidden',
      }}
    >
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        onTransitionEnd={handleTransitionEnd}
        style={{
          position: 'relative',
          maxWidth: '92vw',
          maxHeight: '86vh',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          cursor: scale > 1 ? 'grab' : 'zoom-in',
          userSelect: 'none',
          touchAction: 'none',
          ...getModalStyle(),
          transition:
            phase !== 'open'
              ? 'transform 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.38s ease'
              : 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1), opacity 0.38s ease',
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          style={{
            display: 'block',
            maxWidth: '92vw',
            maxHeight: '86vh',
            objectFit: 'contain',
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
            transition: isDragging.current ? 'none' : 'transform 0.18s ease',
            transformOrigin: 'center center',
          }}
        />

        {/* Botón cerrar */}
        <button
          onClick={(e) => { e.stopPropagation(); triggerClose(); }}
          title="Cerrar"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'rgba(0,0,0,0.55)',
            color: '#fff',
            fontSize: '18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
            zIndex: 10,
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(219,39,119,0.85)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.55)'; }}
        >
          ✕
        </button>

        {scale === 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0,0,0,0.45)',
              color: '#fff',
              fontSize: '11px',
              padding: '4px 12px',
              borderRadius: '20px',
              backdropFilter: 'blur(4px)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Doble clic · Rueda · Pellizco para zoom
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  ProductCard
// ─────────────────────────────────────────────
export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);

  const openViewer = () => {
    if (!product.image_urls?.[0]) return;
    setTriggerRect(imgWrapRef.current?.getBoundingClientRect() ?? null);
    setViewerOpen(true);
  };

  return (
    <>
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(219,39,119,0.2)';
          e.currentTarget.style.transform = 'translateY(-5px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Imagen */}
        <div
          ref={imgWrapRef}
          onClick={openViewer}
          style={{
            height: '280px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ccc',
            fontSize: '14px',
            backgroundImage: product.image_urls?.[0] ? `url(${product.image_urls[0]})` : 'none',
            backgroundColor: '#ffe0e6',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            cursor: product.image_urls?.[0] ? 'zoom-in' : 'default',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            if (!product.image_urls?.[0]) return;
            const hint = e.currentTarget.querySelector<HTMLDivElement>('.zoom-hint');
            if (hint) hint.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            const hint = e.currentTarget.querySelector<HTMLDivElement>('.zoom-hint');
            if (hint) hint.style.opacity = '0';
          }}
        >
          {!product.image_urls?.[0] && 'Sin imagen'}
          {product.image_urls?.[0] && (
            <div
              className="zoom-hint"
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(219,39,119,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.25s ease',
                backdropFilter: 'blur(1px)',
              }}
            >
              <span style={{
                fontSize: '28px',
                background: 'rgba(255,255,255,0.85)',
                borderRadius: '50%',
                width: '52px',
                height: '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              }}>🔍</span>
            </div>
          )}
        </div>

        {/* Contenido */}
        <div style={{ padding: '20px' }}>
          <h3 style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '20px',
            fontWeight: '600',
            color: '#1a1a1a',
            marginBottom: '10px',
            minHeight: '50px',
          }}>
            {product.name}
          </h3>

          <p style={{
            color: '#666',
            fontSize: '14px',
            lineHeight: '1.5',
            marginBottom: '15px',
            minHeight: '60px',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {product.description}
          </p>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px',
            paddingTop: '15px',
            borderTop: '1px solid #eee',
          }}>
            <span style={{ color: '#999', fontSize: '13px' }}>
              Stock: <strong style={{ color: '#1a1a1a' }}>{product.stock}</strong>
            </span>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              padding: '4px 12px',
              borderRadius: '12px',
              backgroundColor: product.stock > 5 ? '#e8f5e9' : '#fff3e0',
              color: product.stock > 5 ? '#27ae60' : '#f57c00',
            }}>
              {product.stock > 5 ? '✓ Disponible' : '⚠ Limitado'}
            </span>
          </div>

          {product.show_price && product.price && (
            <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
              <p style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>Desde</p>
              <p style={{ fontSize: '28px', fontWeight: '700', color: '#db2777' }}>
                S/. {product.price.toFixed(2)}
              </p>
            </div>
          )}

          <button
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#db2777',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#c11f63'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#db2777'; }}
            onClick={() => {
              const message = `Hola, me interesa el arreglo: ${product.name}. ${product.description}`;
              window.open(`https://wa.me/51961144177?text=${encodeURIComponent(message)}`, '_blank');
            }}
          >
            💬 Consultar por WhatsApp
          </button>
        </div>
      </div>

      {viewerOpen && (
        <ImageViewer
          src={product.image_urls![0]}
          alt={product.name}
          triggerRect={triggerRect}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
};
