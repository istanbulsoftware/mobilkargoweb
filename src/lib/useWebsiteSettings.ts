import { useEffect, useState } from 'react';
import { api, toAbsoluteAssetUrl } from '../lib/api';
import { defaultWebsiteSettings, type WebsiteSettings } from '../types/website';

export function useWebsiteSettings() {
  const [settings, setSettings] = useState<WebsiteSettings>(defaultWebsiteSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data } = await api.get<WebsiteSettings>('/website/public-settings');
        if (mounted) {
          setSettings({
            ...defaultWebsiteSettings,
            ...data,
            logoUrl: toAbsoluteAssetUrl(data.logoUrl),
            faviconUrl: toAbsoluteAssetUrl(data.faviconUrl),
            ogImageUrl: toAbsoluteAssetUrl(data.ogImageUrl),
            heroSlides: Array.isArray(data.heroSlides)
              ? data.heroSlides.map((slide) => ({
                  ...slide,
                  imageUrl: toAbsoluteAssetUrl(slide.imageUrl),
                }))
              : defaultWebsiteSettings.heroSlides,
            journeyCards: Array.isArray(data.journeyCards)
              ? data.journeyCards.map((card) => ({
                  ...card,
                  imageUrl: toAbsoluteAssetUrl(card.imageUrl),
                }))
              : defaultWebsiteSettings.journeyCards,
            appShowcaseItems: Array.isArray(data.appShowcaseItems)
              ? data.appShowcaseItems.map((item) => ({
                  ...item,
                  imageUrl: toAbsoluteAssetUrl(item.imageUrl),
                }))
              : defaultWebsiteSettings.appShowcaseItems,
            operationFilterPresets: Array.isArray(data.operationFilterPresets)
              ? data.operationFilterPresets
              : defaultWebsiteSettings.operationFilterPresets,
            shipmentSubCategoryGroups: Array.isArray(data.shipmentSubCategoryGroups)
              ? data.shipmentSubCategoryGroups
              : defaultWebsiteSettings.shipmentSubCategoryGroups,
          });
        }
      } catch {
        if (mounted) {
          setSettings(defaultWebsiteSettings);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    document.title = settings.defaultMetaTitle || defaultWebsiteSettings.defaultMetaTitle;

    const ensureMeta = (name: string, content: string) => {
      if (!content) return;
      let el = document.head.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    ensureMeta('description', settings.defaultMetaDescription);
    ensureMeta('keywords', settings.defaultMetaKeywords.join(', '));

    if (settings.faviconUrl) {
      let icon = document.querySelector("link[rel='icon']");
      if (!icon) {
        icon = document.createElement('link');
        icon.setAttribute('rel', 'icon');
        document.head.appendChild(icon);
      }
      icon.setAttribute('href', settings.faviconUrl);
    }
  }, [settings]);

  return { settings, loading };
}

