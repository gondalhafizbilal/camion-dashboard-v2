'use client';

import { useEffect, useState } from 'react';

export default function GlobalImagePreview() {
  const [imageSrc, setImageSrc] = useState('');
  const [imageAlt, setImageAlt] = useState('');

  useEffect(() => {
    const onClick = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;

      const inContent = target.closest('.content-body');
      const inModal = target.closest('.modal');
      if (!inContent && !inModal) return;

      const src = target.currentSrc || target.src || '';
      if (!src) return;

      setImageSrc(src);
      setImageAlt(target.alt || 'Preview');
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setImageSrc('');
      }
    };

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  if (!imageSrc) return null;

  return (
    <div className="global-image-preview-overlay" onClick={() => setImageSrc('')} role="presentation">
      <button
        type="button"
        className="global-image-preview-close"
        onClick={() => setImageSrc('')}
        aria-label="Close image preview"
      >
        ×
      </button>
      <img
        src={imageSrc}
        alt={imageAlt}
        className="global-image-preview-image"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
