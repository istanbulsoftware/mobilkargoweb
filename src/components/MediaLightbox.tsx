type MediaLightboxProps = {
  open: boolean;
  url?: string;
  title?: string;
  onClose: () => void;
};

const isImageUrl = (url?: string) => {
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?.*)?$/i.test(url);
};

export function MediaLightbox({ open, url, title, onClose }: MediaLightboxProps) {
  if (!open || !url) return null;
  const image = isImageUrl(url);

  return (
    <div className="media-lightbox-backdrop" onClick={onClose} role="presentation">
      <div className="media-lightbox-panel" onClick={(e) => e.stopPropagation()} role="presentation">
        <div className="media-lightbox-head">
          <strong>{title || 'Onizleme'}</strong>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Kapat</button>
        </div>
        <div className="media-lightbox-body">
          {image ? (
            <img src={url} alt={title || 'Onizleme'} className="media-lightbox-image" />
          ) : (
            <iframe src={url} title={title || 'Onizleme'} className="media-lightbox-frame" />
          )}
        </div>
      </div>
    </div>
  );
}


