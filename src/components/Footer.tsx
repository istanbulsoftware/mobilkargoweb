import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { WebsiteSettings } from '../types/website';

type Props = {
  settings: WebsiteSettings;
};

type FooterContentLink = {
  title: string;
  slug: string;
  category: 'blog' | 'contract' | 'corporate' | 'info' | 'help';
};

export function Footer({ settings }: Props) {
  const [footerLinks, setFooterLinks] = useState<FooterContentLink[]>([]);
  const isAuthenticated = useMemo(() => Boolean(localStorage.getItem('an_user_token')), []);

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

  useEffect(() => {
    let mounted = true;
    const loadFooterContents = async () => {
      try {
        const { data } = await api.get<FooterContentLink[]>('/content/public', {
          params: { placement: 'footer', audience, limit: 50 },
        });
        if (!mounted) return;
        setFooterLinks(Array.isArray(data) ? data : []);
      } catch {
        if (!mounted) return;
        setFooterLinks([]);
      }
    };

    void loadFooterContents();
    return () => {
      mounted = false;
    };
  }, [audience]);

  const corporateLinks = footerLinks.filter((item) => item.category === 'corporate');
  const contractLinks = footerLinks.filter((item) => item.category === 'contract');

  return (
    <footer className="footer-premium mt-5">
      <div className="footer-premium-bg" />
      <div className="container footer-wrap py-5">
        <div className="footer-cta-card mb-4">
          <div>
            <span className="footer-kicker">MOBIL UYGULAMA</span>
            <h4 className="fw-bold mb-2">Mobil uygulamamizi indir, nakliyeyi telefondan yonet</h4>
            <p className="mb-0 text-footer-muted">
              Uygulamadan ilan acabilir, teklifleri takip edebilir ve operasyonu tek ekrandan yonetebilirsin.
            </p>
          </div>
          <div className="d-flex flex-wrap gap-2 footer-store-buttons">
            <a href="#" className="store-btn store-btn-android">
              <i className="bi bi-google-play" />
              <span><small>Hemen indir</small><strong>Google Play</strong></span>
            </a>
            <a href="#" className="store-btn store-btn-ios">
              <i className="bi bi-apple" />
              <span><small>Yükle</small><strong>App Store</strong></span>
            </a>
          </div>
        </div>

        <div className="row g-4 align-items-start footer-main-grid">
          <div className="col-lg-4">
            <div className="d-flex align-items-center gap-2 mb-3">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.logoAltText || settings.siteName} className="footer-brand-logo" />
              ) : (
                <span className="brand-badge">AN</span>
              )}
              <h5 className="fw-bold mb-0 text-white">{settings.siteName}</h5>
            </div>
            <p className="text-footer-muted mb-2">Sorulariniz mi var? 7/24 destek hatti</p>
            <h4 className="fw-bold text-white mb-3">{settings.contactPhone}</h4>
            <div className="small text-footer-muted d-grid gap-1 mb-3">
              <span>İletişim Bilgileri</span>
              <span>ISTANBUL</span>
              <span>{settings.contactEmail}</span>
            </div>
            <div className="d-flex gap-2">
              <a className="social-btn" href="#"><i className="bi bi-instagram" /></a>
              <a className="social-btn" href="#"><i className="bi bi-twitter" /></a>
              <a className="social-btn" href="#"><i className="bi bi-tiktok" /></a>
              <a className="social-btn" href="#"><i className="bi bi-youtube" /></a>
              <a className="social-btn" href="#"><i className="bi bi-linkedin" /></a>
            </div>
          </div>

          <div className="col-6 col-lg-2">
            <h6 className="footer-title">KURUMSAL</h6>
            <ul className="list-unstyled d-grid gap-2 mt-3 footer-links">
              {corporateLinks.length > 0 ? (
                corporateLinks.map((item) => (
                  <li key={`corp-${item.slug}`}>
                    <Link to={`/content/${item.slug}`}>{item.title}</Link>
                  </li>
                ))
              ) : (
                <>
                  <li><Link to="/about">Hakkimizda</Link></li>
                  <li><Link to="/contact">İletişim</Link></li>
                  <li><Link to="/blog">Blog</Link></li>
                </>
              )}
            </ul>
          </div>

          <div className="col-6 col-lg-3">
            <h6 className="footer-title">PLATFORM</h6>
            <ul className="list-unstyled d-grid gap-2 mt-3 footer-links">
              <li><Link to="/app">Yük Oluştur</Link></li>
              <li><Link to="/app">Yük Takip</Link></li>
              <li><Link to="/register">Kayıt Ol</Link></li>
              <li><Link to="/login">Giriş Yap</Link></li>
            </ul>
          </div>

          <div className="col-12 col-lg-3">
            <h6 className="footer-title">SOZLESMELER</h6>
            <ul className="list-unstyled d-grid gap-2 mt-3 footer-links">
              {contractLinks.length > 0 ? (
                contractLinks.map((item) => (
                  <li key={`contract-${item.slug}`}>
                    <Link to={`/content/${item.slug}`}>{item.title}</Link>
                  </li>
                ))
              ) : (
                settings.footerMetaLinks.map((item, idx) => (
                  <li key={`${item.label}-${idx}`}>
                    <a href={item.url}>{item.label}</a>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="footer-partner-card mt-4">
          <div>
            <span className="footer-kicker">IS ORTAKLARI</span>
            <h4 className="fw-bold mb-2 text-white">Birden cok araci olan nakliye firmalari icin operasyon paneli</h4>
            <p className="mb-0 text-footer-muted">
              Arac, belge, teklif ve yuk operasyonlarini tek panelden merkezi olarak yonetebilirsiniz.
            </p>
          </div>
          <Link to={isAuthenticated ? '/hesabim' : '/login'} className="partner-btn">
            <i className="bi bi-shop" />
            <span><small>Partner girisi</small><strong>Nakliye Firma Paneli</strong></span>
          </Link>
        </div>
      </div>

      <div className="footer-bottom-bar">
        <div className="container d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 py-3">
          <span className="small text-footer-muted">{settings.footerCopyrightText}</span>
          <div className="d-flex gap-2">
            <span className="payment-pill">iyzico</span>
            <span className="payment-pill">VISA</span>
            <span className="payment-pill">Mastercard</span>
          </div>
        </div>
      </div>
    </footer>
  );
}


