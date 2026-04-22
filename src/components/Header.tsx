import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import type { WebsiteSettings } from '../types/website';

type Props = {
  settings: WebsiteSettings;
};

type CmsLink = {
  title: string;
  slug: string;
};

export function Header({ settings }: Props) {
  const location = useLocation();
  const [headerLinks, setHeaderLinks] = useState<CmsLink[]>([]);
  const [logoBroken, setLogoBroken] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

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

  const isAuthenticated = useMemo(() => {
    void location.pathname;
    return Boolean(localStorage.getItem('an_user_token'));
  }, [location.pathname]);

  const headerMenuLinks = useMemo(() => {
    const seen = new Set<string>();
    return headerLinks.filter((item) => {
      const key = item.slug?.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [headerLinks]);

  useEffect(() => {
    let mounted = true;

    const loadCmsLinks = async () => {
      try {
        const headerRes = await api.get<CmsLink[]>('/content/public', {
          params: { placement: 'header', audience, limit: 20 },
        });

        if (!mounted) return;
        setHeaderLinks(Array.isArray(headerRes.data) ? headerRes.data : []);
      } catch {
        if (!mounted) return;
        setHeaderLinks([]);
      }
    };

    void loadCmsLinks();

    return () => {
      mounted = false;
    };
  }, [audience]);

  useEffect(() => {
    setLogoBroken(false);
  }, [settings.logoUrl]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <header className="site-header fixed-top">
      <div className="header-top">
        <div className="container d-flex justify-content-between flex-wrap gap-2 small">
          <div className="d-flex gap-2 flex-wrap align-items-center">
            {settings.contactPhone ? <span className="chip"><i className="bi bi-telephone me-1" />{settings.contactPhone}</span> : null}
            {settings.contactEmail ? <span className="chip"><i className="bi bi-envelope me-1" />{settings.contactEmail}</span> : null}
            <span className="chip"><i className="bi bi-shield-check me-1" />Doğrulanmis Platform</span>
          </div>
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <span className="chip chip-soft">120 Saat Kurali</span>
            <span className="chip chip-soft">7/24 Operasyon</span>
            {headerLinks.length > 0 ? (
              headerLinks.slice(0, 3).map((item) => (
                <NavLink key={item.slug} to={`/content/${item.slug}`} className="chip text-decoration-none">
                  {item.title}
                </NavLink>
              ))
            ) : (
              <>
                <NavLink to="/blog" className="chip text-decoration-none">Blog</NavLink>
                <NavLink to="/contact" className="chip text-decoration-none">Demo Talebi</NavLink>
              </>
            )}
          </div>
        </div>
      </div>

      <nav className="navbar navbar-expand-lg premium-nav">
        <div className="container">
          <NavLink to="/" className="navbar-brand d-flex align-items-center" aria-label="Ana sayfa">
            {settings.logoUrl && !logoBroken ? (
              <img
                src={settings.logoUrl}
                alt={settings.logoAltText || settings.siteName}
                className="brand-logo"
                loading="eager"
                decoding="async"
                onError={() => setLogoBroken(true)}
              />
            ) : (
              <span className="brand-badge">MK</span>
            )}
          </NavLink>

          <button
            className="navbar-toggler"
            type="button"
            aria-controls="siteNav"
            aria-expanded={navOpen ? 'true' : 'false'}
            onClick={() => setNavOpen((prev) => !prev)}
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div className={`navbar-collapse collapse ${navOpen ? 'show' : ''}`} id="siteNav">
            <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
              <li className="nav-item"><NavLink to="/" className="nav-link" onClick={() => setNavOpen(false)}>Ana Sayfa</NavLink></li>
              {headerMenuLinks.map((item) => (
                <li className="nav-item" key={`header-nav-${item.slug}`}>
                  <NavLink to={`/content/${item.slug}`} className="nav-link" onClick={() => setNavOpen(false)}>{item.title}</NavLink>
                </li>
              ))}
              <li className="nav-item"><NavLink to="/app" className="nav-link" onClick={() => setNavOpen(false)}>Yük İşlemleri</NavLink></li>
              <li className="nav-item"><NavLink to="/blog" className="nav-link" onClick={() => setNavOpen(false)}>Blog</NavLink></li>
              {isAuthenticated ? (
                <li className="nav-item">
                  <NavLink to="/hesabim" className="btn btn-primary ms-lg-2" onClick={() => setNavOpen(false)}>Hesabım</NavLink>
                </li>
              ) : (
                <>
                  <li className="nav-item"><NavLink to="/login" className="nav-link" onClick={() => setNavOpen(false)}>Giriş</NavLink></li>
                  <li className="nav-item"><NavLink to="/register" className="btn btn-primary ms-lg-2" onClick={() => setNavOpen(false)}>Kayıt Ol</NavLink></li>
                </>
              )}
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
}



