import { useEffect, type PropsWithChildren } from 'react';
import { Footer } from './Footer';
import { Header } from './Header';
import { RightUtilityRail } from './RightUtilityRail';
import { ScrollToTop } from './ScrollToTop';
import type { WebsiteSettings } from '../types/website';

type Props = PropsWithChildren<{
  settings: WebsiteSettings;
}>;

export function Layout({ settings, children }: Props) {
  useEffect(() => {
    const setHeaderOffset = () => {
      const header = document.querySelector('.site-header') as HTMLElement | null;
      const height = header?.offsetHeight ?? 0;
      document.documentElement.style.setProperty('--header-offset', `${height}px`);
    };

    setHeaderOffset();
    const rafId = window.requestAnimationFrame(setHeaderOffset);
    const t1 = window.setTimeout(setHeaderOffset, 250);
    const t2 = window.setTimeout(setHeaderOffset, 900);
    window.addEventListener('resize', setHeaderOffset);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', setHeaderOffset);
    };
  }, []);

  return (
    <>
      <ScrollToTop />
      <Header settings={settings} />
      <RightUtilityRail />
      <main className="page-main">{children}</main>
      <Footer settings={settings} />
    </>
  );
}

