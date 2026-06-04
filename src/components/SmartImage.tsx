import { useEffect, useMemo, useRef, useState, type ImgHTMLAttributes } from 'react';
import { previewImageUrl } from '../utils/mediaPreview';

type SmartImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  thumbSize?: number;
};

export default function SmartImage({
  src,
  thumbSize = 360,
  loading = 'lazy',
  decoding = 'async',
  onError,
  ...props
}: SmartImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewSrc = useMemo(() => previewImageUrl(src, thumbSize), [src, thumbSize]);
  const [fallback, setFallback] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(loading !== 'lazy');

  useEffect(() => {
    setFallback(false);
    setShouldLoad(loading !== 'lazy');
  }, [previewSrc, loading]);

  useEffect(() => {
    if (shouldLoad || loading !== 'lazy') return;
    const el = imgRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '720px 720px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [previewSrc, loading, shouldLoad]);

  const actualSrc = shouldLoad ? (fallback ? src : previewSrc) : undefined;

  return (
    <img
      {...props}
      ref={imgRef}
      src={actualSrc}
      data-full-src={src}
      data-preview-src={previewSrc}
      loading={loading}
      decoding={decoding}
      onError={(event) => {
        if (!actualSrc) return;
        if (!fallback && actualSrc !== src) {
          setFallback(true);
          return;
        }
        onError?.(event);
      }}
    />
  );
}
