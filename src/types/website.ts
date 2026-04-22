export type FooterMetaLink = {
  label: string;
  url: string;
};

export type WebsiteSettings = {
  siteName: string;
  siteTagline: string;
  logoUrl: string;
  logoAltText: string;
  faviconUrl: string;
  ogImageUrl: string;
  defaultMetaTitle: string;
  defaultMetaDescription: string;
  defaultMetaKeywords: string[];
  contactEmail: string;
  contactPhone: string;
  footerCompanyText: string;
  footerCopyrightText: string;
  footerMetaLinks: FooterMetaLink[];
  heroSectionEnabled: boolean;
  heroAutoplayMs: number;
  heroSlides: Array<{
    id: string;
    title: string;
    subtitle: string;
    description: string;
    imageUrl: string;
    badgeText: string;
    primaryButtonLabel: string;
    primaryButtonLink: string;
    secondaryButtonLabel: string;
    secondaryButtonLink: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  journeySectionEnabled: boolean;
  journeySectionTitle: string;
  journeySectionSubtitle: string;
  journeySectionNote: string;
  journeyCards: Array<{
    id: string;
    title: string;
    metricValue: string;
    description: string;
    imageUrl: string;
    badgeText: string;
    overlayMode: 'bottom' | 'center' | 'none';
    sortOrder: number;
    isActive: boolean;
  }>;
  featureMatrixEnabled: boolean;
  featureMatrixBadge: string;
  featureMatrixTitle: string;
  featureMatrixDescription: string;
  featureMatrixSideLeft: string;
  featureMatrixSideRight: string;
  featureMatrixCards: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    isHighlighted: boolean;
    sortOrder: number;
    isActive: boolean;
  }>;
  appShowcaseEnabled: boolean;
  appShowcaseTitle: string;
  appShowcaseSubtitle: string;
  appShowcaseItems: Array<{
    id: string;
    title: string;
    subtitle: string;
    imageUrl: string;
    size: 'narrow' | 'wide';
    sortOrder: number;
    isActive: boolean;
  }>;
  subscriptionSectionEnabled: boolean;
  subscriptionSectionTitle: string;
  subscriptionSectionSubtitle: string;
  subscriptionPlans: Array<{
    id: string;
    title: string;
    subtitle: string;
    priceValue: string;
    pricePeriod: string;
    currency: string;
    monthlyOfferLimit: number | null;
    description: string;
    features: Array<{
      text: string;
      included: boolean;
    }>;
    ctaLabel: string;
    ctaLink: string;
    isHighlighted: boolean;
    badgeText: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  announcementBarEnabled: boolean;
  announcementText: string;
  announcementLink: string;
  announcementTheme: 'info' | 'success' | 'warning' | 'danger';
  operationFilterPresets: Array<{
    id: string;
    label: string;
    segment: 'all' | 'personal' | 'company' | 'industrial';
    searchSeed: string;
    keywords: string[];
    isActive: boolean;
    sortOrder: number;
  }>;
  shipmentSubCategoryGroups: Array<{
    id: string;
    segment: 'personal' | 'company' | 'industrial';
    label: string;
    sortOrder: number;
    isActive: boolean;
    items: Array<{
      id: string;
      label: string;
      keywords: string[];
      sortOrder: number;
      isActive: boolean;
    }>;
  }>;
};

export const defaultWebsiteSettings: WebsiteSettings = {
  siteName: 'Mobil Kargo',
  siteTagline: 'Akilli Taşıma Platformu',
  logoUrl: '',
  logoAltText: 'Mobil Kargo',
  faviconUrl: '',
  ogImageUrl: '',
  defaultMetaTitle: 'Mobil Kargo | Akilli Taşıma Platformu',
  defaultMetaDescription:
    'Doğrulanmis tasimaci agi ile sehir içi ve sehirler arası yuk eşleştirme platformu.',
  defaultMetaKeywords: ['nakliye', 'lojistik', 'tasimacilik'],
  contactEmail: 'destek@mobilkargo.com',
  contactPhone: '+90 850 000 00 00',
  footerCompanyText:
    'Doğrulanmis uyelik, akilli eşleşme ve operasyon denetimi ile premium dijital nakliye platformu.',
  footerCopyrightText: '(c) Mobil Kargo. Tum haklari saklidir.',
  footerMetaLinks: [
    { label: 'KVKK', url: '#' },
    { label: 'Kullanim Sartlari', url: '#' },
    { label: 'Gizlilik', url: '#' },
  ],
  heroSectionEnabled: true,
  heroAutoplayMs: 5000,
  heroSlides: [
    {
      id: 'hero-1',
      title: 'Yük bildir, dogru tasiyiçi ile hızlı eşleş',
      subtitle: 'Şehir içi odakli premium lojistik platformu',
      description: 'Doğrulanmis tasiyiçi havuzu, dinamik teklif sistemi ve operasyon odakli panel ile tüm süreçi tek noktadan yonetin.',
      imageUrl: '',
      badgeText: 'Mobil Kargo',
      primaryButtonLabel: 'Yük Oluştur',
      primaryButtonLink: '/app',
      secondaryButtonLabel: 'Tasiyiçi Basvurusu',
      secondaryButtonLink: '/register',
      sortOrder: 1,
      isActive: true,
    },
  ],
  journeySectionEnabled: true,
  journeySectionTitle: 'Taşıma Surecinde Yeni Nesil Deneyim',
  journeySectionSubtitle: 'Yük olusturma, hızlı teklif alma ve canli takip adimlarini tek ekranda yonetin.',
  journeySectionNote: 'Mobil Kargo ile dogru tasiyiçiya daha kisa surede ulasin.',
  journeyCards: [
    {
      id: 'journey-1',
      title: 'Topluluk',
      metricValue: '2.6k',
      description: 'Aylik aktif yuk sahibi ve tasimaci etkilesimi.',
      imageUrl: '',
      badgeText: 'Topluluk',
      overlayMode: 'bottom',
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 'journey-2',
      title: 'Hizli Teklif',
      metricValue: 'x20',
      description: 'Ilan detayina gore anlik teklif hizlandirma.',
      imageUrl: '',
      badgeText: 'Hizli Teklif',
      overlayMode: 'center',
      sortOrder: 2,
      isActive: true,
    },
    {
      id: 'journey-3',
      title: '',
      metricValue: '',
      description: '',
      imageUrl: '',
      badgeText: '',
      overlayMode: 'none',
      sortOrder: 3,
      isActive: true,
    },
    {
      id: 'journey-4',
      title: 'Takip Orani',
      metricValue: '48%',
      description: 'Canli durum ekranini aktif kullanan operasyon payi.',
      imageUrl: '',
      badgeText: 'Takip',
      overlayMode: 'bottom',
      sortOrder: 4,
      isActive: true,
    },
    {
      id: 'journey-5',
      title: 'Pro Paket',
      metricValue: '399 TL',
      description: 'Sinirsiz teklif ve oncelikli destek avantaji.',
      imageUrl: '',
      badgeText: 'Pro',
      overlayMode: 'bottom',
      sortOrder: 5,
      isActive: true,
    },
  ],
  featureMatrixEnabled: true,
  featureMatrixBadge: 'Premium Özellikler',
  featureMatrixTitle: 'Operasyonlarinizi tek panelden hızlı, guvenli ve olceklenebilir yonetin.',
  featureMatrixDescription: 'Yük olusturmadan teklif yonetimine, dogrulama süreçlerinden mesajlasmaya kadar tüm akisi tek noktada toplayin.',
  featureMatrixSideLeft: 'UI',
  featureMatrixSideRight: 'Mobil Kargo',
  featureMatrixCards: [
    {
      id: 'feature-1',
      title: 'Coklu mod operasyon',
      description: 'Şehir içi ve sehirler arası süreçleri ayni yapida yonetin.',
      icon: 'bi bi-grid-3x3-gap',
      isHighlighted: true,
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 'feature-2',
      title: 'Doğrulama odakli guvenlik',
      description: 'Belge akisi, uyelik durumu ve onay adimlari net takip edilir.',
      icon: 'bi bi-shield-check',
      isHighlighted: false,
      sortOrder: 2,
      isActive: true,
    },
    {
      id: 'feature-3',
      title: 'Hizli teklif akisi',
      description: 'Uygun tasiyiçi havuzu ile daha hızlı teklif donusleri alin.',
      icon: 'bi bi-lightning-charge',
      isHighlighted: false,
      sortOrder: 3,
      isActive: true,
    },
    {
      id: 'feature-4',
      title: 'Anlik iletisim',
      description: 'Teklif, is emri ve destek kanallarini tek mesaj yapisinda toplayin.',
      icon: 'bi bi-chat-dots',
      isHighlighted: false,
      sortOrder: 4,
      isActive: true,
    },
    {
      id: 'feature-5',
      title: 'Rapor ve analiz',
      description: 'Aktif/pasif uye, teklif orani ve performans metriklerini izleyin.',
      icon: 'bi bi-bar-chart-line',
      isHighlighted: false,
      sortOrder: 5,
      isActive: true,
    },
    {
      id: 'feature-6',
      title: 'Premium destek',
      description: 'Operasyon takiminiz için hızlı destek ve süreç danismanligi alin.',
      icon: 'bi bi-star',
      isHighlighted: false,
      sortOrder: 6,
      isActive: true,
    },
  ],
  appShowcaseEnabled: true,
  appShowcaseTitle: 'Uygulama Ekran Goruntuleri',
  appShowcaseSubtitle: 'Yük, teklif ve operasyon akisini gercek ekranlardan inceleyin.',
  appShowcaseItems: [
    {
      id: 'app-shot-1',
      title: 'Yük Paneli',
      subtitle: 'Ilan, durum, teklif',
      imageUrl: '',
      size: 'narrow',
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 'app-shot-2',
      title: 'Operasyon Akisi',
      subtitle: 'Takip, mesaj, is emri',
      imageUrl: '',
      size: 'wide',
      sortOrder: 2,
      isActive: true,
    },
    {
      id: 'app-shot-3',
      title: 'Tasiyiçi Ekrani',
      subtitle: 'Uygun yukler, hızlı teklif',
      imageUrl: '',
      size: 'wide',
      sortOrder: 3,
      isActive: true,
    },
    {
      id: 'app-shot-4',
      title: 'Mobil Teklif',
      subtitle: 'Uygulama, bildirim',
      imageUrl: '',
      size: 'narrow',
      sortOrder: 4,
      isActive: true,
    },
  ],
  subscriptionSectionEnabled: true,
  subscriptionSectionTitle: 'Abonelik Paketleri',
  subscriptionSectionSubtitle: 'Ihtiyaciniza uygun plani seçin, operasyonunuzu guclendirin.',
  subscriptionPlans: [
    {
      id: 'plan-1776496536900',
      title: 'Baslangic Plani',
      subtitle: 'Aylik 3 teklif limiti',
      priceValue: '0',
      pricePeriod: 'aylik',
      currency: 'TRY',
      monthlyOfferLimit: 3,
      description: 'Platformu denemek ve temel akislar için.',
      features: [
        { text: 'Aylik 3 teklif', included: true },
        { text: 'Temel destek', included: true },
        { text: 'Gelismis raporlar', included: false },
      ],
      ctaLabel: 'Ucretsiz Basla',
      ctaLink: '/register',
      isHighlighted: false,
      badgeText: '',
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 'plan-1776496671427',
      title: 'Sinirsiz Plan',
      subtitle: 'Sinirsiz teklif hakki',
      priceValue: '999',
      pricePeriod: 'aylik',
      currency: 'TRY',
      monthlyOfferLimit: null,
      description: 'Yüksek hacimli operasyonlar için.',
      features: [
        { text: 'Sinirsiz teklif', included: true },
        { text: 'Oncelikli destek', included: true },
        { text: 'Gelismis raporlar', included: true },
      ],
      ctaLabel: "Pro'ya Gec",
      ctaLink: '/register',
      isHighlighted: true,
      badgeText: 'Populer',
      sortOrder: 2,
      isActive: true,
    },
  ],
  announcementBarEnabled: false,
  announcementText: '',
  announcementLink: '',
  announcementTheme: 'info',
  operationFilterPresets: [
    {
      id: 'preset-food',
      label: 'Gıda',
      segment: 'company',
      searchSeed: 'gida icecek',
      keywords: ['gida', 'icecek', 'restoran', 'market', 'soguk'],
      isActive: true,
      sortOrder: 1,
    },
    {
      id: 'preset-chemical',
      label: 'Kimyasal',
      segment: 'industrial',
      searchSeed: 'kimyasal adr',
      keywords: ['kimyasal', 'adr', 'tehlikeli', 'tanker', 'yaniçi'],
      isActive: true,
      sortOrder: 2,
    },
    {
      id: 'preset-heavy-industrial',
      label: 'Agir Sanayi',
      segment: 'industrial',
      searchSeed: 'ağır sanayi',
      keywords: ['ağır', 'lowbed', 'oversize', 'metal', 'makine', 'proje'],
      isActive: true,
      sortOrder: 3,
    },
  ],
  shipmentSubCategoryGroups: [
    {
      id: 'seg-personal',
      segment: 'personal',
      label: 'Kişisel Gönderiler',
      sortOrder: 1,
      isActive: true,
      items: [
        { id: 'all', label: 'Tumu', keywords: [], sortOrder: 1, isActive: true },
        { id: 'ev_esyalari', label: 'Ev Eşyaları', keywords: ['ev', 'yasam'], sortOrder: 2, isActive: true },
        { id: 'beyaz_esya', label: 'Beyaz Eşya Gönderileri', keywords: ['beyaz eşya'], sortOrder: 3, isActive: true },
        { id: 'elektronik_hassas', label: 'Elektronik ve Hassas Ev Cihazlari', keywords: ['elektronik', 'hassas', 'cihaz'], sortOrder: 4, isActive: true },
        { id: 'koli_paket', label: 'Koli ve Paket Gönderileri', keywords: ['koli', 'paket', 'parca'], sortOrder: 5, isActive: true },
        { id: 'ozel_esya', label: 'Özel Eşya Gönderileri', keywords: ['özel eşya', 'sanat', 'antika', 'muzik'], sortOrder: 6, isActive: true },
        { id: 'kucuk_arac_ekipman', label: 'Küçük Araç ve Kişisel Ekipman Taşıma', keywords: ['motosiklet', 'bisiklet', 'kişisel ekipman', 'atv', 'scooter'], sortOrder: 7, isActive: true },
        { id: 'ofis_ev_ofis', label: 'Ofis / Ev Ofis Kişisel Taşımalar', keywords: ['ofis', 'ev ofis'], sortOrder: 8, isActive: true },
      ],
    },
    {
      id: 'seg-company',
      segment: 'company',
      label: 'Şirket Gönderileri',
      sortOrder: 2,
      isActive: true,
      items: [
        { id: 'all', label: 'Tumu', keywords: [], sortOrder: 1, isActive: true },
        { id: 'perakende_magaza', label: 'Perakende ve Magaza Sevkiyatlari', keywords: ['perakende', 'magaza', 'avm'], sortOrder: 2, isActive: true },
        { id: 'eticaret_paket', label: 'E-Ticaret ve Paket Dagitimi', keywords: ['e-ticaret', 'siparis', 'dagitim', 'mikro'], sortOrder: 3, isActive: true },
        { id: 'ofis_kurumsal', label: 'Ofis ve Kurumsal Taşımalar', keywords: ['ofis', 'kurumsal', 'evrak', 'it'], sortOrder: 4, isActive: true },
        { id: 'ticari_urun', label: 'Ticari Urun Yükleri', keywords: ['ticari', 'palet', 'urun', 'sevkiyat'], sortOrder: 5, isActive: true },
        { id: 'fuar_organizasyon', label: 'Fuar ve Organizasyon Yükleri', keywords: ['fuar', 'organizasyon', 'stand', 'etkinlik'], sortOrder: 6, isActive: true },
        { id: 'soguk_zincir', label: 'Soğuk Zincir Yükleri', keywords: ['soguk zincir', 'frigorifik', 'donuk'], sortOrder: 7, isActive: true },
        { id: 'arac_mobil_ekipman', label: 'Araç ve Mobil Ekipman Taşıma', keywords: ['arac', 'mobil ekipman', 'forklift', 'is makinesi'], sortOrder: 8, isActive: true },
      ],
    },
    {
      id: 'seg-industrial',
      segment: 'industrial',
      label: 'Sanayi Tipi İşler',
      sortOrder: 3,
      isActive: true,
      items: [
        { id: 'all', label: 'Tumu', keywords: [], sortOrder: 1, isActive: true },
        { id: 'makine_uretim', label: 'Makine ve Uretim Ekipmanlari', keywords: ['makine', 'uretim', 'cnc', 'pres', 'torna'], sortOrder: 2, isActive: true },
        { id: 'fabrika_atölye', label: 'Fabrika ve Atolye Taşımalari', keywords: ['fabrika', 'atölye', 'hat', 'ekipman'], sortOrder: 3, isActive: true },
        { id: 'ağır_tonaj', label: 'Agir Yük ve Tonajli Malzemeler', keywords: ['ağır', 'tonaj', 'celik', 'rulo', 'kalip'], sortOrder: 4, isActive: true },
        { id: 'hammadde_yarimamul', label: 'Hammadde ve Yari Mamul Urunler', keywords: ['hammadde', 'yari mamul', 'profil', 'bobin'], sortOrder: 5, isActive: true },
        { id: 'ozel_operasyon', label: 'Özel Operasyon Gerektiren Yükler', keywords: ['vinc', 'forklift', 'asansor', 'gabari', 'lashing'], sortOrder: 6, isActive: true },
        { id: 'insaat_yapi', label: 'İnşaat ve Yapı Malzemeleri', keywords: ['insaat', 'yapi', 'cimento', 'demir', 'seramik'], sortOrder: 7, isActive: true },
        { id: 'santiye', label: 'Santiye Ekipmanlari', keywords: ['santiye', 'iskele', 'bariyer', 'konteyner'], sortOrder: 8, isActive: true },
        { id: 'tarim_gida_soguk', label: 'Tarım, Gıda ve Soğuk Zincir Yükleri', keywords: ['tarim', 'gida', 'soguk zincir', 'meyve', 'sebze'], sortOrder: 9, isActive: true },
        { id: 'gida_sevkiyat', label: 'Gıda Sevkiyatları', keywords: ['gida sevkiyat', 'market', 'icecek', 'catering'], sortOrder: 10, isActive: true },
        { id: 'soguk_zincir', label: 'Soğuk Zincir Yükleri', keywords: ['soguk zincir', 'frigorifik', 'donuk'], sortOrder: 11, isActive: true },
        { id: 'arac_mobil_ekipman', label: 'Araç ve Mobil Ekipman Taşıma', keywords: ['arac', 'mobil ekipman', 'forklift', 'is makinesi'], sortOrder: 12, isActive: true },
      ],
    },
  ],
};



