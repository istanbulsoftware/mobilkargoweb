import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MediaLightbox } from '../components/MediaLightbox';
import { api, toAbsoluteAssetUrl } from '../lib/api';

type ContentItem = {
  title: string;
  description?: string;
  imageUrl?: string;
};

type PublicContent = {
  _id: string;
  slug: string;
  title: string;
  summary?: string;
  body?: string;
  category: 'blog' | 'contract' | 'corporate' | 'info' | 'help';
  coverImageUrl?: string;
  galleryImageUrls?: string[];
  items?: ContentItem[];
  publishedAt?: string;
};

export function ContentPage() {
  const { slug } = useParams();
  const [item, setItem] = useState<PublicContent | null>(null);
  const [related, setRelated] = useState<PublicContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!slug) return;
      try {
        const { data } = await api.get<PublicContent>(`/content/public/${slug}`);
        if (!mounted) return;
        setItem(data);

        if (data.category === 'blog') {
          const { data: relatedData } = await api.get<PublicContent[]>('/content/public', {
            params: { category: 'blog', audience: 'public', limit: 6 },
          });
          if (!mounted) return;
          const filtered = (Array.isArray(relatedData) ? relatedData : []).filter((x) => x.slug !== slug).slice(0, 3);
          setRelated(filtered);
        } else {
          setRelated([]);
        }
      } catch {
        if (mounted) {
          setItem(null);
          setRelated([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const hasGallery = useMemo(() => Boolean(item?.galleryImageUrls?.length), [item?.galleryImageUrls]);

  if (loading) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4">İçerik yükleniyor...</div>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="container py-5">
        <div className="alert alert-warning mb-0">İçerik bulunamadi.</div>
      </section>
    );
  }

  return (
    <section className="container py-5">
      <nav className="small text-secondary mb-3">
        <Link to="/" className="text-decoration-none">Ana Sayfa</Link> /{' '}
        <Link to="/blog" className="text-decoration-none">Blog</Link> /{' '}
        <span>{item.title}</span>
      </nav>

      <article className="panel-card p-0 overflow-hidden">
        <div className="content-hero-wrap">
          <img
            src={toAbsoluteAssetUrl(item.coverImageUrl) || 'https://picsum.photos/1400/540?random=71'}
            alt={item.title}
            className="content-hero-image"
            role="button"
            onClick={() => {
              setPreviewUrl(toAbsoluteAssetUrl(item.coverImageUrl) || 'https://picsum.photos/1400/540?random=71');
              setPreviewTitle(item.title);
            }}
          />
          <div className="content-hero-overlay p-4 p-lg-5">
            <span className="home-premium-pill mb-2">{mapCategory(item.category)}</span>
            <h1 className="fw-bold text-white mb-2">{item.title}</h1>
            <p className="mb-0 text-light-emphasis">{item.summary || 'Detayli icerik metni asagidadir.'}</p>
          </div>
        </div>

        <div className="p-4 p-lg-5">
          <div className="d-flex flex-wrap gap-2 mb-4">
            <span className="content-meta-chip">
              <i className="bi bi-calendar-event me-1"></i>
              {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('tr-TR') : 'Yayin'}
            </span>
            <span className="content-meta-chip">
              <i className="bi bi-collection me-1"></i>
              {mapCategory(item.category)}
            </span>
          </div>

          <div className="content-body" dangerouslySetInnerHTML={{ __html: item.body || '' }} />

          {item.items?.length ? (
            <div className="mt-4">
              <h5 className="fw-bold mb-3">Ozet Basliklar</h5>
              <div className="row g-3">
                {item.items.map((subItem, idx) => (
                  <div className="col-md-6" key={`${subItem.title}-${idx}`}>
                    <div className="panel-card p-3 h-100">
                      <h6 className="fw-bold mb-1">{subItem.title}</h6>
                      <p className="text-secondary mb-0">{subItem.description || 'Aciklama bulunmuyor.'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {hasGallery ? (
            <div className="mt-4">
              <h5 className="fw-bold mb-3">Gorsel Galeri</h5>
              <div className="row g-3">
                {item.galleryImageUrls?.map((img, idx) => (
                  <div className="col-6 col-lg-4" key={`${img}-${idx}`}>
                    <img
                      src={toAbsoluteAssetUrl(img)}
                      alt={`${item.title} ${idx + 1}`}
                      className="img-fluid rounded-4 border w-100 content-gallery-image"
                      role="button"
                      onClick={() => {
                        setPreviewUrl(toAbsoluteAssetUrl(img));
                        setPreviewTitle(`${item.title} - Galeri ${idx + 1}`);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </article>

      {related.length ? (
        <section className="mt-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="fw-bold mb-0">Benzer İçerikler</h4>
            <Link to="/blog" className="home-premium-link">Tum blog yazilari</Link>
          </div>
          <div className="row g-4">
            {related.map((post, idx) => (
              <div className="col-md-6 col-xl-4" key={post._id || `${post.slug}-${idx}`}>
                <article className="panel-card p-3 h-100 blog-list-card">
                  <img
                    src={toAbsoluteAssetUrl(post.coverImageUrl) || `https://picsum.photos/700/420?random=${idx + 111}`}
                    alt={post.title}
                    className="blog-list-image mb-3"
                    role="button"
                    onClick={() => {
                      setPreviewUrl(toAbsoluteAssetUrl(post.coverImageUrl) || `https://picsum.photos/700/420?random=${idx + 111}`);
                      setPreviewTitle(post.title);
                    }}
                  />
                  <h6 className="fw-bold mb-2">{post.title}</h6>
                  <p className="text-secondary mb-3">{(post.summary || '').slice(0, 120)}</p>
                  <Link to={`/content/${post.slug}`} className="home-premium-link mt-auto">Detayi gor</Link>
                </article>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <MediaLightbox open={Boolean(previewUrl)} url={previewUrl} title={previewTitle} onClose={() => setPreviewUrl('')} />
    </section>
  );
}

function mapCategory(category: PublicContent['category']) {
  switch (category) {
    case 'blog':
      return 'Blog';
    case 'contract':
      return 'Sozlesme';
    case 'corporate':
      return 'Kurumsal';
    case 'info':
      return 'Bilgi';
    case 'help':
      return 'Yardim';
    default:
      return 'İçerik';
  }
}


