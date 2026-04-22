import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, toAbsoluteAssetUrl } from '../lib/api';
import { useWebsiteSettings } from '../lib/useWebsiteSettings';

type CmsContent = {
  _id: string;
  title: string;
  slug: string;
  summary?: string;
  body?: string;
  category: 'blog' | 'contract' | 'corporate' | 'info' | 'help';
  coverImageUrl?: string;
  publishedAt?: string;
};

const FALLBACK_FAQ = [
  {
    title: 'Tasiyiçi uyeligi ne kadar surede aktif olur?',
    body: 'Belgeler eksiksiz yüklendikten sonra inceleme süreçi baslar. Onay akisi tamamlaninca uyelik aktif hale gelir.',
  },
  {
    title: 'Şehir içi ve sehirler arası secimi neden zorunlu?',
    body: 'Bu secim, dogru tasiyiçi havuzuna erisim ve hızlı teklif donusu için sistemin temel filtreleme adimidir.',
  },
  {
    title: 'Yük ilaninda arac tipi secimi yapmali miyim?',
    body: 'Evet. Araç tipi secimi, yuk tipi ile daha kaliteli eşleşme sağlar ve ilgisiz teklifleri azaltir.',
  },
];
export function HomePage() {
  const { settings } = useWebsiteSettings();
  const [blogPosts, setBlogPosts] = useState<CmsContent[]>([]);
  const [faqItems, setFaqItems] = useState<CmsContent[]>([]);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [activeShowcaseIndex, setActiveShowcaseIndex] = useState(0);
  const showcaseRefs = useRef<Array<HTMLElement | null>>([]);

  const audience = useMemo(() => {
    try {
      const raw = localStorage.getItem('an_user_profile');
      if (!raw) return 'public';
      const parsed = JSON.parse(raw);
      if (parsed?.role === 'carrier') return 'carrier';
      if (parsed?.role === 'shipper') return 'shipper';
      return 'public';
    } catch {
      return 'public';
    }
  }, []);
  const isAuthenticated = useMemo(() => Boolean(localStorage.getItem('an_user_token')), []);

  const heroSlides = useMemo(() => {
    if (!settings.heroSlides?.length) return [];
    return settings.heroSlides
      .filter((slide) => slide.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [settings.heroSlides]);

  useEffect(() => {
    setActiveHeroIndex(0);
  }, [heroSlides.length]);

  useEffect(() => {
    if (!settings.heroSectionEnabled || heroSlides.length <= 1) return;
    const delay = Math.max(2000, Number(settings.heroAutoplayMs) || 5000);
    const timer = window.setInterval(() => {
      setActiveHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, delay);

    return () => window.clearInterval(timer);
  }, [settings.heroSectionEnabled, settings.heroAutoplayMs, heroSlides.length]);

  useEffect(() => {
    let mounted = true;

    const loadCmsBlocks = async () => {
      try {
        const [blogRes, faqRes] = await Promise.all([
          api.get<CmsContent[]>('/content/public', {
            params: { category: 'blog', audience, limit: 3 },
          }),
          api.get<CmsContent[]>('/content/public', {
            params: { category: 'help', audience, limit: 6 },
          }),
        ]);

        if (!mounted) return;
        setBlogPosts(Array.isArray(blogRes.data) ? blogRes.data.slice(0, 3) : []);
        setFaqItems(Array.isArray(faqRes.data) ? faqRes.data : []);
      } catch {
        if (!mounted) return;
        setBlogPosts([]);
        setFaqItems([]);
      }
    };

    void loadCmsBlocks();

    return () => {
      mounted = false;
    };
  }, [audience]);

  const stripHtml = (value?: string) => {
    if (!value) return '';
    return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const goPrevSlide = () => {
    if (!heroSlides.length) return;
    setActiveHeroIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  const goNextSlide = () => {
    if (!heroSlides.length) return;
    setActiveHeroIndex((prev) => (prev + 1) % heroSlides.length);
  };

  const showcaseItems = useMemo(() => {
    return (settings.appShowcaseItems || [])
      .filter((item) => item.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, 10);
  }, [settings.appShowcaseItems]);

  const goShowcase = (next: number) => {
    const max = Math.max(0, showcaseItems.length - 1);
    const clamped = Math.max(0, Math.min(max, next));
    setActiveShowcaseIndex(clamped);
    showcaseRefs.current[clamped]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  };

  useEffect(() => {
    setActiveShowcaseIndex(0);
  }, [showcaseItems.length]);

  const journeyCards = useMemo(() => {
    const active = (settings.journeyCards || [])
      .filter((card) => card.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return active.slice(0, 5);
  }, [settings.journeyCards]);

  const featureCards = useMemo(() => {
    return (settings.featureMatrixCards || [])
      .filter((card) => card.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, 6);
  }, [settings.featureMatrixCards]);

  return (
    <>
      {settings.heroSectionEnabled && heroSlides.length ? (
        <section className="hero-slider-section">
          <div className="hero-slider-shell" aria-label="Ana tanitim slaytlari">
            {heroSlides.map((slide, index) => {
              const bgImage = slide.imageUrl || `https://picsum.photos/1600/900?random=${index + 751}`;
              return (
                <article
                  key={slide.id || `hero-slide-${index}`}
                  className={`hero-slide ${index === activeHeroIndex ? 'is-active' : ''}`}
                  aria-hidden={index === activeHeroIndex ? 'false' : 'true'}
                >
                  <img src={bgImage} alt={slide.title} className="hero-slide-bg" loading={index === 0 ? 'eager' : 'lazy'} />
                  <div className="hero-slide-overlay">
                    <div className="container hero-content-container">
                      <div className="hero-slide-inner row g-4 align-items-center">
                        <div className="col-lg-7">
                          <div className="hero-slide-content">
                            <span className="hero-badge">{slide.badgeText || settings.siteName}</span>
                            {slide.subtitle ? <p className="hero-slide-subtitle">{slide.subtitle}</p> : null}
                            <h1>{slide.title}</h1>
                            {slide.description ? <p className="hero-slide-description">{slide.description}</p> : null}
                            <div className="d-flex flex-wrap gap-2 mt-3">
                              <a href={slide.primaryButtonLink || '/app'} className="btn btn-primary btn-lg">
                                {slide.primaryButtonLabel || 'Yük Oluştur'}
                              </a>
                              <a href={slide.secondaryButtonLink || '/register'} className="btn btn-outline-light btn-lg">
                                {slide.secondaryButtonLabel || 'Tasiyiçi Basvurusu'}
                              </a>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-5">
                          <div className="hero-metrics-card">
                            <h5 className="fw-semibold mb-3">Operasyon Ozeti</h5>
                            <div className="row g-3 mt-1">
                              <div className="col-6"><div className="metric"><strong>1.240+</strong><span>Aktif yuk</span></div></div>
                              <div className="col-6"><div className="metric"><strong>%91</strong><span>Ilk 30 dk teklif</span></div></div>
                              <div className="col-6"><div className="metric"><strong>7/24</strong><span>Operasyon destegi</span></div></div>
                              <div className="col-6"><div className="metric"><strong>120s</strong><span>Basvuru dogrulama</span></div></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {heroSlides.length > 1 ? (
              <>
                <button type="button" className="hero-nav hero-nav-prev" onClick={goPrevSlide} aria-label="Onceki slayt">
                  <i className="bi bi-chevron-left"></i>
                </button>
                <button type="button" className="hero-nav hero-nav-next" onClick={goNextSlide} aria-label="Sonraki slayt">
                  <i className="bi bi-chevron-right"></i>
                </button>
                <div className="hero-dots" role="tablist" aria-label="Hero slayt secimi">
                  {heroSlides.map((slide, idx) => (
                    <button
                      key={`${slide.id || 'dot'}-${idx}`}
                      type="button"
                      className={`hero-dot ${idx === activeHeroIndex ? 'is-active' : ''}`}
                      onClick={() => setActiveHeroIndex(idx)}
                      aria-label={`Slayt ${idx + 1}`}
                      aria-selected={idx === activeHeroIndex ? 'true' : 'false'}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {settings.journeySectionEnabled ? (
        <section className="container py-5">
          <div className="journey-section">
            <div className="text-center mb-4">
              <h2 className="journey-title">{settings.journeySectionTitle}</h2>
              <p className="journey-subtitle mb-1">{settings.journeySectionSubtitle}</p>
              <p className="journey-note mb-0">{settings.journeySectionNote}</p>
            </div>

            <div className="journey-grid">
              <article className="journey-card journey-card-tall">
                <img
                  src={journeyCards[0]?.imageUrl || 'https://picsum.photos/700/980?random=1101'}
                  alt={journeyCards[0]?.title || 'Journey kart 1'}
                />
                {journeyCards[0] ? (
                  <div className="journey-overlay-card">
                    <small>{journeyCards[0].badgeText || journeyCards[0].title}</small>
                    <strong>{journeyCards[0].metricValue}</strong>
                    <p className="mb-0">{journeyCards[0].description}</p>
                  </div>
                ) : null}
              </article>

              <article className="journey-card journey-card-stack">
                <div className="journey-stack-item">
                  <img
                    src={journeyCards[1]?.imageUrl || 'https://picsum.photos/700/450?random=1102'}
                    alt={journeyCards[1]?.title || 'Journey kart 2'}
                  />
                  {journeyCards[1] && journeyCards[1].overlayMode !== 'none' ? (
                    <div className={`journey-overlay-card ${journeyCards[1].overlayMode === 'center' ? 'journey-overlay-compact' : ''}`}>
                      <small>{journeyCards[1].badgeText || journeyCards[1].title}</small>
                      <strong>{journeyCards[1].metricValue}</strong>
                      <p className="mb-0">{journeyCards[1].description}</p>
                    </div>
                  ) : null}
                </div>
                <div className="journey-stack-item">
                  <img
                    src={journeyCards[2]?.imageUrl || 'https://picsum.photos/700/450?random=1103'}
                    alt={journeyCards[2]?.title || 'Journey kart 3'}
                  />
                  {journeyCards[2] && journeyCards[2].overlayMode !== 'none' ? (
                    <div className={`journey-overlay-card ${journeyCards[2].overlayMode === 'center' ? 'journey-overlay-compact' : ''}`}>
                      <small>{journeyCards[2].badgeText || journeyCards[2].title}</small>
                      <strong>{journeyCards[2].metricValue}</strong>
                      <p className="mb-0">{journeyCards[2].description}</p>
                    </div>
                  ) : null}
                </div>
              </article>

              <article className="journey-card journey-card-tall">
                <img
                  src={journeyCards[3]?.imageUrl || 'https://picsum.photos/700/980?random=1104'}
                  alt={journeyCards[3]?.title || 'Journey kart 4'}
                />
                {journeyCards[3] && journeyCards[3].overlayMode !== 'none' ? (
                  <div className={`journey-overlay-card ${journeyCards[3].overlayMode === 'center' ? 'journey-overlay-compact' : ''}`}>
                    <small>{journeyCards[3].badgeText || journeyCards[3].title}</small>
                    <strong>{journeyCards[3].metricValue}</strong>
                    <p className="mb-0">{journeyCards[3].description}</p>
                  </div>
                ) : null}
              </article>

              <article className="journey-card journey-card-tall">
                <img
                  src={journeyCards[4]?.imageUrl || 'https://picsum.photos/700/980?random=1105'}
                  alt={journeyCards[4]?.title || 'Journey kart 5'}
                />
                {journeyCards[4] && journeyCards[4].overlayMode !== 'none' ? (
                  <div className={`journey-overlay-card ${journeyCards[4].overlayMode === 'center' ? 'journey-overlay-compact' : ''}`}>
                    <small>{journeyCards[4].badgeText || journeyCards[4].title}</small>
                    <strong>{journeyCards[4].metricValue}</strong>
                    <p className="mb-0">{journeyCards[4].description}</p>
                  </div>
                ) : null}
              </article>
            </div>
          </div>
        </section>
      ) : null}

      {settings.featureMatrixEnabled ? (
        <section className="container pb-5">
          <div className="feature-matrix">
            <div className="row g-4 align-items-start">
              <div className="col-lg-4">
                <span className="feature-chip">{settings.featureMatrixBadge}</span>
                <h2 className="feature-matrix-title mt-3 mb-3">
                  {settings.featureMatrixTitle}
                </h2>
                <p className="text-secondary mb-0">
                  {settings.featureMatrixDescription}
                </p>
              </div>

              <div className="col-lg-8">
                <div className="feature-grid">
                  {featureCards.map((card) => (
                    <article className={`feature-item ${card.isHighlighted ? 'feature-item-highlight' : ''}`} key={card.id}>
                      <div className="feature-icon"><i className={card.icon || 'bi bi-star'}></i></div>
                      <h4>{card.title}</h4>
                      <p>{card.description}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {settings.appShowcaseEnabled && showcaseItems.length ? (
      <section className="app-showcase-section pb-5">
        <div className="app-showcase-wrap">
          <div className="container mb-3">
            <h3 className="fw-bold mb-1">{settings.appShowcaseTitle}</h3>
            <p className="text-secondary mb-0">{settings.appShowcaseSubtitle}</p>
          </div>
          <div className="app-showcase-track" role="region" aria-label="Uygulama ekran goruntuleri">
            {showcaseItems.map((item, idx) => (
              <article
                key={item.id}
                ref={(el) => {
                  showcaseRefs.current[idx] = el;
                }}
                className={`app-showcase-card is-${item.size} ${idx === activeShowcaseIndex ? 'is-active' : ''}`}
              >
                <img
                  src={item.imageUrl || `https://picsum.photos/1200/900?random=${1600 + idx}`}
                  alt={item.title}
                />
                <div className="app-showcase-overlay">
                  <h4>{item.title}</h4>
                  <p>{item.subtitle}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="app-showcase-controls">
            <div className="app-showcase-nav">
              <button type="button" onClick={() => goShowcase(activeShowcaseIndex - 1)} aria-label="Onceki ekran">
                <i className="bi bi-arrow-left"></i>
              </button>
              <button type="button" onClick={() => goShowcase(activeShowcaseIndex + 1)} aria-label="Sonraki ekran">
                <i className="bi bi-arrow-right"></i>
              </button>
            </div>
            <div className="app-showcase-counter">
              <strong>{activeShowcaseIndex + 1}</strong>
              <span />
              <small>{showcaseItems.length}</small>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {settings.subscriptionSectionEnabled ? (
        <section className="container py-5">
          <div className="pricing-shell">
            <div className="text-center mb-4">
              <h2 className="fw-bold mb-2">{settings.subscriptionSectionTitle}</h2>
              <p className="text-secondary mb-0">{settings.subscriptionSectionSubtitle}</p>
            </div>
            <div className="row g-4 justify-content-center pricing-deck">
              {settings.subscriptionPlans
                .filter((plan) => plan.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((plan) => (
                  <div className="col-md-6 col-xl-4" key={plan.id}>
                    <article className={`pricing-card premium-pricing-card h-100 ${plan.isHighlighted ? 'is-highlighted' : ''}`}>
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <h5 className="mb-0">{plan.title}</h5>
                          {plan.subtitle ? <p className="pricing-plan-subtitle mb-0 mt-1">{plan.subtitle}</p> : null}
                        </div>
                        {plan.badgeText ? <span className="pricing-badge">{plan.badgeText}</span> : null}
                      </div>

                      <div className="pricing-price-row mb-3">
                        <strong>{plan.currency === 'TRY' ? '₺' : '$'}{plan.priceValue}</strong>
                        {plan.pricePeriod ? <span>/ {plan.pricePeriod}</span> : null}
                      </div>

                      {plan.description ? <p className="pricing-plan-description mb-3">{plan.description}</p> : null}
                      <p className="pricing-plan-description mb-3">
                        {plan.monthlyOfferLimit == null
                          ? 'Aylik teklif limiti: Sinirsiz'
                          : `Aylik teklif limiti: ${plan.monthlyOfferLimit}`}
                      </p>

                      <ul className="list-unstyled d-grid gap-2 mb-4">
                        {plan.features.map((feature, idx) => (
                          <li key={`${plan.id}-feature-${idx}`} className={`pricing-feature ${feature.included ? 'is-included' : 'is-excluded'}`}>
                            <i className={`bi ${feature.included ? 'bi-check2' : 'bi-dash'}`}></i>
                            <span>{feature.text}</span>
                          </li>
                        ))}
                      </ul>

                      <a
                        href={isAuthenticated ? `/abonelik/${plan.id}` : '/login'}
                        className={`btn w-100 pricing-cta-btn ${plan.isHighlighted ? 'is-highlighted' : ''}`}
                      >
                        <span className="pricing-cta-icon"><i className="bi bi-arrow-up-right"></i></span>
                        <span>{plan.ctaLabel}</span>
                      </a>
                    </article>
                  </div>
                ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="container py-5">
        <div className="row g-4">
          <div className="col-md-4"><div className="panel-card p-4 h-100"><h5>Yük Oluşturma</h5><p className="text-secondary">Şehir içi/sehirler arası secimiyle formlar otomatik sadelesir.</p></div></div>
          <div className="col-md-4"><div className="panel-card p-4 h-100"><h5>Akilli Eslesme</h5><p className="text-secondary">Yük tipi + arac tipi + calisma modu ile daha temiz teklif havuzu.</p></div></div>
          <div className="col-md-4"><div className="panel-card p-4 h-100"><h5>Canli Takip</h5><p className="text-secondary">Ilan, teklif, onay ve operasyon adimlari tek akista izlenir.</p></div></div>
        </div>
      </section>

      <section className="container pb-5">
        <div className="home-premium-surface p-4 p-lg-5">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div>
              <span className="footer-kicker">BILGI MERKEZI</span>
              <h3 className="fw-bold mb-0">Son Blog Yazilari</h3>
            </div>
            <Link to="/blog" className="home-premium-link">Tum yazilari gor</Link>
          </div>
          <div className="row g-4 mt-1">
            {(blogPosts.length ? blogPosts : []).map((post, idx) => (
              <div className="col-md-6 col-lg-4" key={post._id || post.slug}>
                <article className="home-premium-card h-100 p-4 home-blog-card">
                  <img
                    src={toAbsoluteAssetUrl(post.coverImageUrl) || `https://picsum.photos/620/390?random=${idx + 410}`}
                    alt={post.title}
                    className="home-blog-thumb mb-3"
                  />
                  <span className="home-premium-pill mb-2">Blog</span>
                  <h5 className="mb-2">{post.title}</h5>
                  <p className="text-secondary mb-3">
                    {(post.summary || stripHtml(post.body)).slice(0, 120) || 'İçerik yakinda burada yayinda olacak.'}
                  </p>
                  <Link to={`/content/${post.slug}`} className="home-premium-link">Devamini oku</Link>
                </article>
              </div>
            ))}
            {!blogPosts.length ? (
              <div className="col-12">
                <div className="home-premium-card p-4 text-secondary">Blog icerigi bulunamadi. İçerik yonetiminden blog ekledikce burada gorunecek.</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="container pb-5">
        <div className="home-premium-surface p-4 p-lg-5">
          <span className="footer-kicker">YARDIM MERKEZI</span>
          <h3 className="fw-bold mb-3">Sik Sorulan Sorular</h3>
          <div className="accordion home-faq" id="homeFaqAccordion">
            {(faqItems.length ? faqItems : FALLBACK_FAQ).map((item, index) => {
              const title = 'slug' in item ? item.title : item.title;
              const body = 'slug' in item
                ? item.summary || stripHtml(item.body) || 'Detayli aciklama yakinda eklenecektir.'
                : item.body;
              const headingId = `faq-heading-${index}`;
              const collapseId = `faq-collapse-${index}`;
              return (
                <div className="accordion-item" key={`${title}-${index}`}>
                  <h2 className="accordion-header" id={headingId}>
                    <button
                      className={`accordion-button ${index === 0 ? '' : 'collapsed'}`}
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target={`#${collapseId}`}
                      aria-expanded={index === 0 ? 'true' : 'false'}
                      aria-controls={collapseId}
                    >
                      {title}
                    </button>
                  </h2>
                  <div
                    id={collapseId}
                    className={`accordion-collapse collapse ${index === 0 ? 'show' : ''}`}
                    aria-labelledby={headingId}
                    data-bs-parent="#homeFaqAccordion"
                  >
                    <div className="accordion-body">{body}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}





