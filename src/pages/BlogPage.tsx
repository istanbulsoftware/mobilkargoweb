import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MediaLightbox } from '../components/MediaLightbox';
import { api, toAbsoluteAssetUrl } from '../lib/api';

type PublicContent = {
  _id: string;
  slug: string;
  title: string;
  summary?: string;
  body?: string;
  category: 'blog' | 'contract' | 'corporate' | 'info' | 'help';
  coverImageUrl?: string;
  publishedAt?: string;
};

export function BlogPage() {
  const [posts, setPosts] = useState<PublicContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadPosts = async () => {
      try {
        const { data } = await api.get<PublicContent[]>('/content/public', {
          params: { category: 'blog', audience: 'public', limit: 60 },
        });
        if (!mounted) return;
        setPosts(Array.isArray(data) ? data : []);
      } catch {
        if (!mounted) return;
        setPosts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadPosts();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return posts;
    return posts.filter((item) => {
      const title = item.title?.toLowerCase() || '';
      const summary = item.summary?.toLowerCase() || '';
      return title.includes(query) || summary.includes(query);
    });
  }, [posts, search]);

  const featured = filteredPosts[0];
  const list = filteredPosts.slice(1);

  return (
    <section className="container py-5">
      <div className="blog-hero mb-4">
        <div className="row g-4 align-items-center">
          <div className="col-lg-8">
            <span className="hero-kicker">MOBIL KARGO BLOG</span>
            <h1 className="fw-bold mt-2 mb-2">Operasyon, tasima ve platform rehberleri</h1>
            <p className="text-secondary mb-0">
              Yük yonetimi, arac secimi, teklif süreçleri ve sahadaki en iyi uygulamalarla ilgili güncel icerikleri kesfedin.
            </p>
          </div>
          <div className="col-lg-4">
            <input
              className="form-control form-control-lg"
              placeholder="Blog içinde ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="panel-card p-4">İçerikler yükleniyor...</div>
      ) : null}

      {!loading && !filteredPosts.length ? (
        <div className="panel-card p-4 text-secondary">Blog icerigi bulunamadi.</div>
      ) : null}

      {!loading && featured ? (
        <article className="panel-card blog-featured mb-4">
          <div className="row g-0">
            <div className="col-lg-5">
              <img
                src={toAbsoluteAssetUrl(featured.coverImageUrl) || 'https://picsum.photos/900/520?random=91'}
                alt={featured.title}
                className="img-fluid blog-featured-image"
                role="button"
                onClick={() => {
                  setPreviewUrl(toAbsoluteAssetUrl(featured.coverImageUrl) || 'https://picsum.photos/900/520?random=91');
                  setPreviewTitle(featured.title);
                }}
              />
            </div>
            <div className="col-lg-7 p-4 p-lg-5 d-grid align-content-center">
              <span className="home-premium-pill mb-2">One Cikan Yazi</span>
              <h3 className="fw-bold mb-2">{featured.title}</h3>
              <p className="text-secondary mb-3">
                {(featured.summary || stripHtml(featured.body)).slice(0, 220)}
              </p>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <small className="text-secondary">
                  {featured.publishedAt ? new Date(featured.publishedAt).toLocaleDateString('tr-TR') : 'Yayinda'}
                </small>
                <Link to={`/content/${featured.slug}`} className="home-premium-link">Devamini oku</Link>
              </div>
            </div>
          </div>
        </article>
      ) : null}

      {!loading && list.length ? (
        <div className="row g-4">
          {list.map((post, idx) => (
            <div className="col-md-6 col-xl-4" key={post._id || `${post.slug}-${idx}`}>
              <article className="panel-card blog-list-card p-4 h-100">
                <img
                  src={toAbsoluteAssetUrl(post.coverImageUrl) || `https://picsum.photos/800/420?random=${idx + 20}`}
                  alt={post.title}
                  className="blog-list-image mb-3"
                  role="button"
                  onClick={() => {
                    setPreviewUrl(toAbsoluteAssetUrl(post.coverImageUrl) || `https://picsum.photos/800/420?random=${idx + 20}`);
                    setPreviewTitle(post.title);
                  }}
                />
                <h5 className="mb-2">{post.title}</h5>
                <p className="text-secondary mb-3">
                  {(post.summary || stripHtml(post.body)).slice(0, 130)}
                </p>
                <div className="d-flex justify-content-between align-items-center mt-auto">
                  <small className="text-secondary">
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('tr-TR') : 'Yayinda'}
                  </small>
                  <Link to={`/content/${post.slug}`} className="home-premium-link">Oku</Link>
                </div>
              </article>
            </div>
          ))}
        </div>
      ) : null}
      <MediaLightbox open={Boolean(previewUrl)} url={previewUrl} title={previewTitle} onClose={() => setPreviewUrl('')} />
    </section>
  );
}

function stripHtml(value?: string) {
  if (!value) return '';
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}


