import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Eye } from 'lucide-react';
import {
  placeImagePreviewPanel,
  type ImagePreviewRect,
  type ImagePreviewSize,
} from '../utils/imageHoverPreview';

type ImageHoverPreviewProps = {
  src: string;
  alt?: string;
  buttonClassName?: string;
  iconSize?: number;
  title?: string;
};

function rectFromDom(rect: DOMRect): ImagePreviewRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export default function ImageHoverPreview({
  src,
  alt,
  buttonClassName = '',
  iconSize = 14,
  title = '悬停预览100%',
}: ImageHoverPreviewProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<ImagePreviewRect | null>(null);
  const [naturalSize, setNaturalSize] = useState<ImagePreviewSize | null>(null);

  const updateAnchor = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setAnchor(rectFromDom(rect));
  }, []);

  const showPreview = useCallback(() => {
    updateAnchor();
    setOpen(true);
  }, [updateAnchor]);

  const hidePreview = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    setNaturalSize(null);
    setOpen(false);
  }, [src]);

  useEffect(() => {
    if (!open) return undefined;
    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [open, updateAnchor]);

  const placement = useMemo(() => {
    if (!open || !anchor || typeof window === 'undefined') return null;
    return placeImagePreviewPanel(anchor, naturalSize, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, [anchor, naturalSize, open]);

  const panelStyle: CSSProperties | undefined = placement
    ? {
        left: placement.left,
        top: placement.top,
        width: placement.width,
        height: placement.height,
      }
    : undefined;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`nodrag nopan t8-btn t8-mini-icon-button t8-image-preview-trigger ${buttonClassName}`}
        title={title}
        aria-label={title}
        onPointerEnter={showPreview}
        onPointerMove={updateAnchor}
        onPointerLeave={hidePreview}
        onFocus={showPreview}
        onBlur={hidePreview}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <Eye size={iconSize} />
      </button>
      {open && placement && typeof document !== 'undefined'
        ? createPortal(
            <div className="t8-image-preview-popover" style={panelStyle}>
              <img
                className="t8-image-preview-popover__image"
                src={src}
                alt={alt || title}
                width={placement.width}
                height={placement.height}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  setNaturalSize({
                    width: image.naturalWidth,
                    height: image.naturalHeight,
                  });
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
