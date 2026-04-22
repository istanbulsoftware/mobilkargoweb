import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type UserProfile = {
  id: string;
  fullName: string;
  role: 'shipper' | 'carrier' | 'admin';
  status: string;
};

type CityOption = { id: string; name: string };
type DistrictOption = { id: string; name: string; cityId: string };

type DeliveryOption = {
  id: string;
  icon?: string;
  title: string;
  subtitle?: string;
  description?: string;
  priceText?: string;
  isActive?: boolean;
  sortOrder?: number;
};

type CargoTypeOption = {
  id: string;
  slug: string;
  name: string;
  category?: string;
  businessSegment?: 'personal' | 'company' | 'industrial';
  subGroup?: string;
};

type VehicleTypeOption = {
  id: string;
  slug: string;
  name: string;
  description?: string;
};

type FieldRuleOption = {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: 'text' | 'number' | 'select' | 'boolean' | 'date';
  isRequired: boolean;
  options?: string[];
  sortOrder?: number;
};

type FormOptionsResponse = {
  deliveryOptions: DeliveryOption[];
  cargoTypes: CargoTypeOption[];
  vehicleTypes: VehicleTypeOption[];
  fieldRules: FieldRuleOption[];
  selectedLoadTypeSlug?: string | null;
};

type CarrierFeedShipment = {
  _id: string;
  title: string;
  transportMode: 'intracity' | 'intercity';
  pickupCity?: string;
  pickupDistrict?: string;
  dropoffCity?: string;
  dropoffDistrict?: string;
  hasMyOffer?: boolean;
  myOfferStatus?: string;
  myOfferPrice?: number;
  recommendedVehicleTypeIds?: Array<string | { _id?: string }>;
};

type CarrierOffer = {
  _id: string;
  status: string;
  price?: number;
  createdAt?: string;
  shipmentId?: {
    _id?: string;
    title?: string;
    transportMode?: 'intracity' | 'intercity';
    pickupCity?: string;
    dropoffCity?: string;
  };
  vehicleId?: { _id?: string; plateMasked?: string; brand?: string; model?: string };
};

type CarrierVehicle = {
  _id: string;
  status: string;
  plateMasked?: string;
  brand?: string;
  model?: string;
  vehicleTypeId?: { _id?: string; name?: string; slug?: string };
};

const MODE_LABEL: Record<'intracity' | 'intercity', string> = {
  intracity: 'Şehir İçi',
  intercity: 'Şehirler Arası',
};

const OFFER_TABS = [
  { key: 'pool', label: 'Yük Havuzu' },
  { key: 'offered', label: 'Teklif Verdiklerim' },
  { key: 'offers', label: 'Tekliflerim' },
] as const;

const SEGMENTS: Array<{
  key: 'personal' | 'company' | 'industrial';
  label: string;
  tone: 'personal' | 'company' | 'industrial';
  desc: string;
  icon: string;
  subCategories: Array<{ id: string; label: string; keywords: string }>;
}> = [
  {
    key: 'personal',
    label: 'Kişisel Gönderiler',
    tone: 'personal',
    desc: 'Ev eşyası, parça eşya, bireysel taşımalar',
    icon: 'bi-house-heart',
    subCategories: [
      { id: 'ev_esyalari', label: 'Ev Eşyaları', keywords: 'ev,eşya,parça,öğrenci' },
      { id: 'beyaz_esya', label: 'Beyaz Eşya Gönderileri', keywords: 'beyaz eşya,çamaşır,buzdolabı' },
      { id: 'elektronik_hassas', label: 'Elektronik ve Hassas Ev Cihazları', keywords: 'elektronik,hassas,cihaz' },
      { id: 'koli_paket', label: 'Koli ve Paket Gönderileri', keywords: 'koli,paket' },
      { id: 'ozel_esya', label: 'Özel Eşya Gönderileri', keywords: 'özel,antika,sanat,müzik' },
      { id: 'kucuk_arac_ekipman', label: 'Küçük Araç ve Kişisel Ekipman Taşıma', keywords: 'motosiklet,atv,scooter' },
      { id: 'ofis_ev_ofis', label: 'Ofis / Ev Ofis Kişisel Taşımalar', keywords: 'ofis,evrak,arşiv' },
    ],
  },
  {
    key: 'company',
    label: 'Şirket Gönderileri',
    tone: 'company',
    desc: 'Perakende, e-ticaret, kurumsal sevkiyat',
    icon: 'bi-buildings',
    subCategories: [
      { id: 'perakende_magaza', label: 'Perakende ve Mağaza Sevkiyatları', keywords: 'perakende,mağaza,avm' },
      { id: 'eticaret_paket', label: 'E-Ticaret ve Paket Dağıtımı', keywords: 'eticaret,paket,dağıtım' },
      { id: 'ofis_kurumsal', label: 'Ofis ve Kurumsal Taşımalar', keywords: 'ofis,kurumsal' },
      { id: 'ticari_urun', label: 'Ticari Ürün Yükleri', keywords: 'ticari,palet,depo' },
      { id: 'fuar_organizasyon', label: 'Fuar ve Organizasyon Yükleri', keywords: 'fuar,organizasyon,stand' },
      { id: 'soguk_zincir', label: 'Soğuk Zincir Yükleri', keywords: 'soğuk zincir,gıda,frigorifik' },
      { id: 'arac_mobil_ekipman', label: 'Araç ve Mobil Ekipman Taşıma', keywords: 'araç,mobil ekipman,yedek parça' },
    ],
  },
  {
    key: 'industrial',
    label: 'Sanayi Tipi İşler',
    tone: 'industrial',
    desc: 'Ağır yük, üretim ve özel operasyonlar',
    icon: 'bi-gear-wide-connected',
    subCategories: [
      { id: 'makine_uretim', label: 'Makine ve Üretim Ekipmanları', keywords: 'makine,cnc,üretim' },
      { id: 'fabrika_atolye', label: 'Fabrika ve Atölye Taşımaları', keywords: 'fabrika,atölye,hat' },
      { id: 'agir_tonaj', label: 'Ağır Yük ve Tonajlı Malzemeler', keywords: 'ağır,tonaj,lowbed' },
      { id: 'hammadde_yarimamul', label: 'Hammadde ve Yarı Mamul Ürünler', keywords: 'hammadde,yarı mamul' },
      { id: 'ozel_operasyon', label: 'Özel Operasyon Gerektiren Yükler', keywords: 'vinç,forklift,özel operasyon' },
      { id: 'insaat_yapi', label: 'İnşaat ve Yapı Malzemeleri', keywords: 'inşaat,yapı,şantiye' },
      { id: 'santiye', label: 'Şantiye Ekipmanları', keywords: 'şantiye,ekipman' },
      { id: 'tarim_gida_soguk', label: 'Tarım, Gıda ve Soğuk Zincir Yükleri', keywords: 'tarım,gıda,soğuk zincir' },
      { id: 'gida_sevkiyat', label: 'Gıda Sevkiyatları', keywords: 'gıda,kuru gıda,yaş gıda,sıvı gıda' },
      { id: 'soguk_zincir', label: 'Soğuk Zincir Yükleri', keywords: 'soğuk zincir,dondurulmuş' },
      { id: 'arac_mobil_ekipman', label: 'Araç ve Mobil Ekipman Taşıma', keywords: 'araç,mobil ekipman' },
    ],
  },
];

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString('tr-TR') : '-');

export function AppPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('an_user_token');

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [cities, setCities] = useState<CityOption[]>([]);
  const [districtByCity, setDistrictByCity] = useState<Record<string, DistrictOption[]>>({});

  const [segment, setSegment] = useState<'personal' | 'company' | 'industrial'>('personal');
  const [subCategoryId, setSubCategoryId] = useState('ev_esyalari');
  const [selectedDeliveryId, setSelectedDeliveryId] = useState('quick_window');
  const [selectedLoadTypeSlug, setSelectedLoadTypeSlug] = useState('');
  const [selectedVehicleTypeSlug, setSelectedVehicleTypeSlug] = useState('');
  const [loadScope, setLoadScope] = useState<'parca' | 'tam' | 'parsiyel' | 'paletli'>('parca');

  const [scheduleMode, setScheduleMode] = useState<'today' | 'tomorrow' | 'planned'>('today');
  const [plannedDate, setPlannedDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('10:00');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const [originCityId, setOriginCityId] = useState('');
  const [originDistrict, setOriginDistrict] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [destinationCityId, setDestinationCityId] = useState('');
  const [destinationDistrict, setDestinationDistrict] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');

  const [weightKg, setWeightKg] = useState('');
  const [volumeM3, setVolumeM3] = useState('');
  const [pieceCount, setPieceCount] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [cargoAttributes, setCargoAttributes] = useState<string[]>([]);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');

  const [optionsLoading, setOptionsLoading] = useState(false);
  const [formOptions, setFormOptions] = useState<FormOptionsResponse | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [carrierTab, setCarrierTab] = useState<(typeof OFFER_TABS)[number]['key']>('pool');
  const [carrierFeed, setCarrierFeed] = useState<CarrierFeedShipment[]>([]);
  const [carrierOffers, setCarrierOffers] = useState<CarrierOffer[]>([]);
  const [carrierVehicles, setCarrierVehicles] = useState<CarrierVehicle[]>([]);
  const [offerDraft, setOfferDraft] = useState<Record<string, { vehicleId: string; amount: string; note: string }>>({});
  const [offerActionLoading, setOfferActionLoading] = useState('');

  const segmentConfig = useMemo(() => SEGMENTS.find((x) => x.key === segment) || SEGMENTS[0], [segment]);

  const originDistricts = useMemo(() => districtByCity[originCityId] || [], [districtByCity, originCityId]);
  const destinationDistricts = useMemo(() => districtByCity[destinationCityId] || [], [districtByCity, destinationCityId]);

  const originCityName = useMemo(() => cities.find((x) => x.id === originCityId)?.name || '', [cities, originCityId]);
  const destinationCityName = useMemo(() => cities.find((x) => x.id === destinationCityId)?.name || '', [cities, destinationCityId]);

  const computedTransportMode: 'intracity' | 'intercity' = useMemo(() => {
    if (!originCityName || !destinationCityName) return 'intracity';
    return originCityName === destinationCityName ? 'intracity' : 'intercity';
  }, [originCityName, destinationCityName]);

  const weekDays = ['Pts', 'Sal', 'Çar', 'Per', 'Cum', 'Cts', 'Paz'];
  const plannedDays = useMemo(() => {
    const start = new Date();
    const values: Date[] = [];
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      values.push(d);
    }
    return values;
  }, []);

  const plannedCalendarCells = useMemo(() => {
    if (!plannedDays.length) return [] as Array<{ type: 'empty' | 'day'; iso?: string; day?: number }>;
    const first = plannedDays[0];
    // Monday-based week index: Mon=0 ... Sun=6
    const firstWeekDay = (first.getDay() + 6) % 7;
    const cells: Array<{ type: 'empty' | 'day'; iso?: string; day?: number }> = [];
    for (let i = 0; i < firstWeekDay; i += 1) cells.push({ type: 'empty' });
    plannedDays.forEach((d) => {
      cells.push({ type: 'day', iso: d.toISOString().slice(0, 10), day: d.getDate() });
    });
    return cells;
  }, [plannedDays]);

  const carrierPool = useMemo(() => carrierFeed.filter((x) => !x.hasMyOffer), [carrierFeed]);
  const carrierOffered = useMemo(() => carrierFeed.filter((x) => x.hasMyOffer), [carrierFeed]);

  useEffect(() => {
    // Backend compatibility: keep delivery option id in sync with the selected time mode.
    if (scheduleMode === 'today') setSelectedDeliveryId('quick_window');
    if (scheduleMode === 'tomorrow') setSelectedDeliveryId('same_day');
    if (scheduleMode === 'planned') setSelectedDeliveryId('scheduled');
  }, [scheduleMode]);

  const loadDistricts = async (cityId: string) => {
    if (!cityId || districtByCity[cityId]) return;
    try {
      const { data } = await api.get<DistrictOption[]>('/lookups/districts', { params: { cityId } });
      setDistrictByCity((prev) => ({ ...prev, [cityId]: Array.isArray(data) ? data : [] }));
    } catch {
      setDistrictByCity((prev) => ({ ...prev, [cityId]: [] }));
    }
  };

  useEffect(() => {
    const boot = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const [{ data: me }, { data: cityRows }] = await Promise.all([
          api.get<UserProfile>('/users/me/profile'),
          api.get<CityOption[]>('/lookups/cities'),
        ]);
        setProfile(me);
        setCities(Array.isArray(cityRows) ? cityRows : []);

        if (me.role === 'carrier') {
          const [feedRes, offersRes, vehiclesRes] = await Promise.all([
            api.get<CarrierFeedShipment[]>('/shipments/feed'),
            api.get<CarrierOffer[]>('/offers/my/detailed'),
            api.get<CarrierVehicle[]>('/vehicles/my'),
          ]);
          setCarrierFeed(Array.isArray(feedRes.data) ? feedRes.data : []);
          setCarrierOffers(Array.isArray(offersRes.data) ? offersRes.data : []);
          setCarrierVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
        }
      } catch (error: any) {
        setMessage(error?.response?.data?.message || 'Sayfa yüklenemedi.');
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, [token]);

  useEffect(() => {
    if (!token || profile?.role !== 'shipper') return;
    let mounted = true;
    const loadOptions = async () => {
      setOptionsLoading(true);
      const activeSub = segmentConfig.subCategories.find((x) => x.id === subCategoryId) || segmentConfig.subCategories[0];
      try {
        const { data } = await api.get<FormOptionsResponse>('/shipments/form/options', {
          params: {
            businessSegment: segment,
            subCategoryId: activeSub?.id || 'all',
            subCategoryKeywords: activeSub?.keywords || '',
            transportMode: computedTransportMode,
            loadTypeSlug: selectedLoadTypeSlug || undefined,
          },
        });
        if (!mounted) return;
        setFormOptions(data);

        if (!selectedLoadTypeSlug && data.cargoTypes?.length) {
          setSelectedLoadTypeSlug(data.selectedLoadTypeSlug || data.cargoTypes[0].slug);
        } else if (selectedLoadTypeSlug && !data.cargoTypes.some((x) => x.slug === selectedLoadTypeSlug) && data.cargoTypes?.length) {
          setSelectedLoadTypeSlug(data.selectedLoadTypeSlug || data.cargoTypes[0].slug);
        }

        if (!selectedVehicleTypeSlug && data.vehicleTypes?.length) {
          setSelectedVehicleTypeSlug(data.vehicleTypes[0].slug);
        } else if (selectedVehicleTypeSlug && !data.vehicleTypes.some((x) => x.slug === selectedVehicleTypeSlug) && data.vehicleTypes?.length) {
          setSelectedVehicleTypeSlug(data.vehicleTypes[0].slug);
        }

        if (!selectedDeliveryId && data.deliveryOptions?.length) {
          setSelectedDeliveryId(data.deliveryOptions[0].id);
        }
      } catch (error: any) {
        if (!mounted) return;
        setMessage(error?.response?.data?.message || 'Form verileri yüklenemedi.');
      } finally {
        if (mounted) setOptionsLoading(false);
      }
    };
    void loadOptions();
    return () => {
      mounted = false;
    };
  }, [token, profile?.role, segment, subCategoryId, computedTransportMode]);

  useEffect(() => {
    if (!originCityId) {
      setOriginDistrict('');
      return;
    }
    void loadDistricts(originCityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originCityId]);

  useEffect(() => {
    if (!destinationCityId) {
      setDestinationDistrict('');
      return;
    }
    void loadDistricts(destinationCityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationCityId]);

  const setAttribute = (value: string, checked: boolean) => {
    setCargoAttributes((prev) => {
      if (checked) return prev.includes(value) ? prev : [...prev, value];
      return prev.filter((x) => x !== value);
    });
  };

  const composeScheduledAt = () => {
    const now = new Date();
    const dt = new Date(now);

    if (scheduleMode === 'tomorrow') dt.setDate(now.getDate() + 1);
    if (scheduleMode === 'planned' && plannedDate) {
      const picked = new Date(plannedDate);
      if (!Number.isNaN(picked.getTime())) dt.setTime(picked.getTime());
    }

    const [hh, mm] = (scheduledTime || '10:00').split(':');
    dt.setHours(Number(hh || 10), Number(mm || 0), 0, 0);
    return dt.toISOString();
  };

  const composeDescription = () => {
    const lines = [
      `Açıklama: ${description.trim() || '-'}`,
      `Not: ${notes.trim() || '-'}`,
      `Yük Yapısı: ${loadScope}`,
      `Çıkış Adresi: ${originAddress.trim() || '-'}`,
      `Varış Adresi: ${destinationAddress.trim() || '-'}`,
      `Yükleme Tarihi: ${composeScheduledAt()}`,
      `Teslim Son Tarihi: ${deadlineDate ? `${deadlineDate}${deadlineTime ? ` ${deadlineTime}` : ''}` : '-'}`,
      `Bütçe Aralığı: ${budgetRange.trim() || '-'}`,
      `Yük Niteliği: ${cargoAttributes.length ? cargoAttributes.join(', ') : '-'}`,
      `Ek Alanlar: ${Object.entries(fieldValues).map(([k, v]) => `${k}=${v}`).join('; ') || '-'}`,
    ];
    return lines.join('\n');
  };

  const submitShipment = async () => {
    if (!title.trim() || /[\r\n]/.test(title)) {
      setMessage('İlan başlığı zorunlu ve tek satır olmalı.');
      return;
    }
    if (!selectedLoadTypeSlug || !selectedVehicleTypeSlug) {
      setMessage('Yük tipi ve araç tipi seçiniz.');
      return;
    }
    if (!originCityName || !destinationCityName) {
      setMessage('Çıkış ve varış şehirlerini seçiniz.');
      return;
    }
    if (scheduleMode === 'planned' && !plannedDate) {
      setMessage('Planlı tarih seçiniz.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      await api.post('/shipments', {
        title: title.trim(),
        description: composeDescription(),
        transportMode: computedTransportMode,
        loadTypeSlug: selectedLoadTypeSlug,
        originCity: originCityName,
        originDistrict,
        destinationCity: destinationCityName,
        destinationDistrict,
        preferredVehicleTypeSlugs: [selectedVehicleTypeSlug],
        isUrgent: selectedDeliveryId === 'priority_60',
        scheduledAt: composeScheduledAt(),
        deliveryDeadlineAt: deadlineDate
          ? new Date(`${deadlineDate}T${deadlineTime || '23:59'}:00`).toISOString()
          : undefined,
        estimatedWeightKg: weightKg ? Number(weightKg) : undefined,
        estimatedVolumeM3: volumeM3 ? Number(volumeM3) : undefined,
        pieceCount: pieceCount ? Number(pieceCount) : undefined,
      });
      navigate('/hesabim');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Yük oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRecommendedVehicle = (shipment: CarrierFeedShipment) => {
    const recommendedIds = (shipment.recommendedVehicleTypeIds || []).map((x) =>
      typeof x === 'string' ? x : String(x?._id || ''),
    );
    const preferred = carrierVehicles.find((v) => {
      if (v.status !== 'active') return false;
      const typeId = String(v.vehicleTypeId?._id || '');
      return recommendedIds.includes(typeId);
    });
    return preferred?._id || carrierVehicles.find((x) => x.status === 'active')?._id || '';
  };

  const ensureOfferDraft = (shipment: CarrierFeedShipment) => {
    const found = offerDraft[shipment._id];
    if (found) return found;
    return { vehicleId: getRecommendedVehicle(shipment), amount: '', note: '' };
  };

  const setOfferField = (shipmentId: string, key: 'vehicleId' | 'amount' | 'note', value: string) => {
    setOfferDraft((prev) => ({
      ...prev,
      [shipmentId]: {
        ...(prev[shipmentId] || { vehicleId: '', amount: '', note: '' }),
        [key]: value,
      },
    }));
  };

  const submitOffer = async (shipmentId: string) => {
    const draft = offerDraft[shipmentId];
    if (!draft?.vehicleId || !draft?.amount) {
      setMessage('Teklif için araç ve tutar giriniz.');
      return;
    }

    setOfferActionLoading(shipmentId);
    setMessage('');
    try {
      await api.post('/offers', {
        shipmentId,
        vehicleId: draft.vehicleId,
        amount: Number(draft.amount),
        note: draft.note || undefined,
      });
      const [feedRes, offersRes] = await Promise.all([
        api.get<CarrierFeedShipment[]>('/shipments/feed'),
        api.get<CarrierOffer[]>('/offers/my/detailed'),
      ]);
      setCarrierFeed(Array.isArray(feedRes.data) ? feedRes.data : []);
      setCarrierOffers(Array.isArray(offersRes.data) ? offersRes.data : []);
      setCarrierTab('offered');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Teklif verilemedi.');
    } finally {
      setOfferActionLoading('');
    }
  };

  if (loading) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4 text-secondary">Yükleniyor...</div>
      </section>
    );
  }

  if (!token) {
    return (
      <section className="container py-5">
        <div className="panel-card verify-gate-card p-4">
          <div className="verify-gate-head mb-3">
            <div className="verify-gate-icon"><i className="bi bi-shield-lock"></i></div>
            <div>
              <h1 className="verify-gate-title mb-1">Yük Oluşturmadan Önce</h1>
              <p className="verify-gate-subtitle mb-0">Bu alanı kullanmak için gönderici hesabı ile giriş yapmalısınız.</p>
            </div>
          </div>
          <div className="d-flex gap-2">
            <Link to="/login" className="btn btn-primary">Giriş Yap</Link>
            <Link to="/register" className="btn btn-outline-primary">Kayıt Ol</Link>
          </div>
        </div>
      </section>
    );
  }

  if (profile?.role === 'carrier') {
    return (
      <section className="container py-5">
        <h1 className="shipment-page-title mb-4">Taşıyıcı Yük Alanı</h1>
        {message ? <div className="alert alert-warning">{message}</div> : null}

        <div className="d-flex flex-wrap gap-2 mb-3">
          {OFFER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`btn ${carrierTab === tab.key ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setCarrierTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {carrierTab === 'pool' ? (
          <div className="panel-card p-4">
            <h4 className="fw-bold mb-3">Yük Havuzu ({carrierPool.length})</h4>
            {carrierPool.length === 0 ? (
              <div className="text-secondary">Teklif verilebilecek yeni yük bulunmuyor.</div>
            ) : (
              <div className="d-grid gap-3">
                {carrierPool.map((shipment) => {
                  const draft = ensureOfferDraft(shipment);
                  return (
                    <div key={shipment._id} className="border rounded-3 p-3">
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <div>
                          <Link to={`/hesabim/yuk/${shipment._id}`} className="fw-bold text-decoration-none">
                            {shipment.title}
                          </Link>
                          <div className="small text-secondary">
                            {MODE_LABEL[shipment.transportMode]} · {shipment.pickupCity || '-'} / {shipment.pickupDistrict || '-'} → {shipment.dropoffCity || '-'} / {shipment.dropoffDistrict || '-'}
                          </div>
                        </div>
                        <span className="badge text-bg-light">{MODE_LABEL[shipment.transportMode]}</span>
                      </div>

                      <div className="row g-2">
                        <div className="col-md-4">
                          <select
                            className="form-select shipment-input"
                            value={draft.vehicleId}
                            onChange={(e) => setOfferField(shipment._id, 'vehicleId', e.target.value)}
                          >
                            <option value="">Araç seçin</option>
                            {carrierVehicles.filter((x) => x.status === 'active').map((vehicle) => (
                              <option key={vehicle._id} value={vehicle._id}>
                                {(vehicle.plateMasked || '-')} · {vehicle.vehicleTypeId?.name || 'Araç'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <input
                            className="form-control shipment-input"
                            placeholder="Teklif (₺)"
                            value={draft.amount}
                            onChange={(e) => setOfferField(shipment._id, 'amount', e.target.value)}
                          />
                        </div>
                        <div className="col-md-3">
                          <input
                            className="form-control shipment-input"
                            placeholder="Not (opsiyonel)"
                            value={draft.note}
                            onChange={(e) => setOfferField(shipment._id, 'note', e.target.value)}
                          />
                        </div>
                        <div className="col-md-2">
                          <button
                            type="button"
                            className="btn btn-primary w-100"
                            disabled={offerActionLoading === shipment._id}
                            onClick={() => submitOffer(shipment._id)}
                          >
                            {offerActionLoading === shipment._id ? '...' : 'Teklif Ver'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {carrierTab === 'offered' ? (
          <div className="panel-card p-4">
            <h4 className="fw-bold mb-3">Teklif Verdiklerim ({carrierOffered.length})</h4>
            {carrierOffered.length === 0 ? (
              <div className="text-secondary">Henüz teklif verdiğiniz yük yok.</div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Yük</th>
                      <th>Rota</th>
                      <th>Durum</th>
                      <th>Teklifim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrierOffered.map((item) => (
                      <tr key={item._id}>
                        <td><Link to={`/hesabim/yuk/${item._id}`} className="text-decoration-none">{item.title}</Link></td>
                        <td>{item.pickupCity || '-'} → {item.dropoffCity || '-'}</td>
                        <td>{item.myOfferStatus || '-'}</td>
                        <td>{typeof item.myOfferPrice === 'number' ? `₺${item.myOfferPrice}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {carrierTab === 'offers' ? (
          <div className="panel-card p-4">
            <h4 className="fw-bold mb-3">Tekliflerim ({carrierOffers.length})</h4>
            {carrierOffers.length === 0 ? (
              <div className="text-secondary">Henüz teklif kaydı bulunmuyor.</div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Yük</th>
                      <th>Araç</th>
                      <th>Tutar</th>
                      <th>Durum</th>
                      <th>Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrierOffers.map((offer) => (
                      <tr key={offer._id}>
                        <td>
                          {offer.shipmentId?._id ? (
                            <Link to={`/hesabim/yuk/${offer.shipmentId._id}`} className="text-decoration-none">
                              {offer.shipmentId?.title || '-'}
                            </Link>
                          ) : '-'}
                        </td>
                        <td>{offer.vehicleId?.plateMasked || '-'} {offer.vehicleId?.brand || ''}</td>
                        <td>{typeof offer.price === 'number' ? `₺${offer.price}` : '-'}</td>
                        <td>{offer.status}</td>
                        <td>{formatDate(offer.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="container py-5">
      <h1 className="shipment-page-title mb-4">Gönderi Oluştur</h1>
      {message ? <div className="alert alert-warning">{message}</div> : null}

      <div className="shipment-create-shell">
        <div className="panel-card p-4">
          <h3 className="shipment-section-title">1. Zaman ve Taşıma</h3>
          <div className="shipment-load-scope-switch shipment-mode-switch mt-1 mb-3">
            {[
              { key: 'parca', label: 'Parça Yük' },
              { key: 'tam', label: 'Tam Yük' },
              { key: 'parsiyel', label: 'Parsiyel' },
              { key: 'paletli', label: 'Paletli' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`shipment-mode-btn ${loadScope === item.key ? 'is-active' : ''}`}
                onClick={() => setLoadScope(item.key as 'parca' | 'tam' | 'parsiyel' | 'paletli')}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="shipment-preset-info-chip mb-3">
            <i className="bi bi-signpost-split"></i> Taşıma modu otomatik belirlenir: <strong>{MODE_LABEL[computedTransportMode]}</strong>
          </div>

          <div className="shipment-options-grid shipment-options-grid-compact">
            <button
              type="button"
              className={`shipment-option-card shipment-option-card-compact ${scheduleMode === 'today' ? 'is-selected' : ''}`}
              onClick={() => setScheduleMode('today')}
            >
              <div className="shipment-option-head">
                <span className="shipment-option-icon"><i className="bi bi-stopwatch"></i></span>
                <span className="shipment-option-badge">Hemen Başlat</span>
              </div>
              <h4>Bugün</h4>
              <p>Bugün içinde en hızlı şekilde eşleştirme ve çıkış planlanır.</p>
            </button>

            <button
              type="button"
              className={`shipment-option-card shipment-option-card-compact ${scheduleMode === 'tomorrow' ? 'is-selected' : ''}`}
              onClick={() => setScheduleMode('tomorrow')}
            >
              <div className="shipment-option-head">
                <span className="shipment-option-icon"><i className="bi bi-lightning-charge"></i></span>
                <span className="shipment-option-badge">Planlı Başlangıç</span>
              </div>
              <h4>Yarın</h4>
              <p>Yarın için planlı çıkış ve teslimat akışına dahil edilir.</p>
            </button>

            <button
              type="button"
              className={`shipment-option-card shipment-option-card-compact ${scheduleMode === 'planned' ? 'is-selected' : ''}`}
              onClick={() => setScheduleMode('planned')}
            >
              <div className="shipment-option-head">
                <span className="shipment-option-icon"><i className="bi bi-calendar3"></i></span>
                <span className="shipment-option-badge">Takvim Seçimi</span>
              </div>
              <h4>Planlı Tarih</h4>
              <p>Belirttiğiniz tarih ve saat penceresinde teslimata çıkılır.</p>
            </button>
          </div>

          {scheduleMode === 'planned' ? (
            <div className="shipment-calendar-card mt-3">
              <div className="shipment-calendar-head">
                <span className="shipment-calendar-icon"><i className="bi bi-calendar-week"></i></span>
                <div>
                  <strong>Planlı Tarih</strong>
                  <small>İki haftalık takvimden gün seçin</small>
                </div>
              </div>
              <div className="shipment-mini-calendar-scroll">
                <div className="shipment-mini-calendar-head">
                  {weekDays.map((d) => <span key={d}>{d}</span>)}
                </div>
                <div className="shipment-mini-calendar-grid">
                  {plannedCalendarCells.map((cell, idx) =>
                    cell.type === 'empty' ? (
                      <div key={`empty-${idx}`} className="shipment-mini-calendar-empty"></div>
                    ) : (
                      <button
                        key={cell.iso}
                        type="button"
                        className={`shipment-mini-calendar-day ${plannedDate === cell.iso ? 'is-selected' : ''}`}
                        onClick={() => setPlannedDate(cell.iso || '')}
                      >
                        {cell.day}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="row g-2 mt-2">
                <div className="col-md-3">
                  <label className="form-label mb-1">Saat</label>
                  <input
                    type="time"
                    className="form-control shipment-input"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="panel-card p-4">
          <h3 className="shipment-section-title">5. İlan Bilgileri</h3>
          <div className="row g-3">
            <div className="col-md-12">
              <label className="form-label">İlan Başlığı</label>
              <input
                className="form-control shipment-input"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value.replace(/\r?\n/g, ''))}
                placeholder="Tek satır başlık giriniz"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">İlan Açıklaması</label>
              <textarea className="form-control shipment-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Dikkat Edilmesi Gerekenler (Notlar)</label>
              <textarea className="form-control shipment-input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="shipment-step-flow">
          <div className="shipment-step-item">
            <div className="shipment-step-rail">
              <div className="shipment-step-number">1</div>
              <div className="shipment-step-line" />
            </div>
            <div className="panel-card p-4">
              <h3 className="shipment-section-title">Çıkış Adresi</h3>
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label">Çıkış şehri</label>
                  <select className="form-select shipment-input" value={originCityId} onChange={(e) => setOriginCityId(e.target.value)}>
                    <option value="">İl seçiniz</option>
                    {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Çıkış ilçesi</label>
                  <select className="form-select shipment-input" value={originDistrict} onChange={(e) => setOriginDistrict(e.target.value)}>
                    <option value="">İlçe seçiniz</option>
                    {originDistricts.map((district) => <option key={district.id} value={district.name}>{district.name}</option>)}
                  </select>
                </div>
                <div className="col-md-12">
                  <label className="form-label">Çıkış adresi</label>
                  <input className="form-control shipment-input" value={originAddress} onChange={(e) => setOriginAddress(e.target.value)} placeholder="Sokak, cadde, site/plaza bilgisi" />
                </div>
              </div>
            </div>
          </div>

          <div className="shipment-step-item">
            <div className="shipment-step-rail">
              <div className="shipment-step-number">2</div>
              <div className="shipment-step-line" />
            </div>
            <div className="panel-card p-4">
              <h3 className="shipment-section-title">Varış Adresi</h3>
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label">Varış şehri</label>
                  <select className="form-select shipment-input" value={destinationCityId} onChange={(e) => setDestinationCityId(e.target.value)}>
                    <option value="">İl seçiniz</option>
                    {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Varış ilçesi</label>
                  <select className="form-select shipment-input" value={destinationDistrict} onChange={(e) => setDestinationDistrict(e.target.value)}>
                    <option value="">İlçe seçiniz</option>
                    {destinationDistricts.map((district) => <option key={district.id} value={district.name}>{district.name}</option>)}
                  </select>
                </div>
                <div className="col-md-12">
                  <label className="form-label">Varış adresi</label>
                  <input className="form-control shipment-input" value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} placeholder="Teslimat adresi" />
                </div>
              </div>
            </div>
          </div>

          <div className="shipment-step-item">
            <div className="shipment-step-rail">
              <div className="shipment-step-number">3</div>
            </div>
            <div className="panel-card p-4">
              <h3 className="shipment-section-title">Ölçü, Kapasite ve Yükün Niteliği</h3>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Ağırlık (kg)</label>
                  <input className="form-control shipment-input" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Hacim (m3)</label>
                  <input className="form-control shipment-input" value={volumeM3} onChange={(e) => setVolumeM3(e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Parça Adedi</label>
                  <input className="form-control shipment-input" value={pieceCount} onChange={(e) => setPieceCount(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Bütçe Min (Opsiyonel)</label>
                  <input
                    className="form-control shipment-input"
                    value={budgetRange.includes('-') ? budgetRange.split('-')[0] : budgetRange}
                    onChange={(e) => {
                      const max = budgetRange.includes('-') ? budgetRange.split('-')[1] : '';
                      setBudgetRange(`${e.target.value}${max ? `-${max}` : ''}`);
                    }}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Bütçe Maks (Opsiyonel)</label>
                  <input
                    className="form-control shipment-input"
                    value={budgetRange.includes('-') ? budgetRange.split('-')[1] : ''}
                    onChange={(e) => {
                      const min = budgetRange.includes('-') ? budgetRange.split('-')[0] : '';
                      setBudgetRange(`${min || ''}-${e.target.value}`);
                    }}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Teslim edilme tarihi (saatli)</label>
                  <div className="position-relative">
                    <input
                      type="datetime-local"
                      className="form-control shipment-input pe-5"
                      value={deadlineDate && deadlineTime ? `${deadlineDate}T${deadlineTime}` : ''}
                      onChange={(e) => {
                        const v = e.target.value || '';
                        if (!v.includes('T')) {
                          setDeadlineDate('');
                          setDeadlineTime('');
                          return;
                        }
                        const [d, t] = v.split('T');
                        setDeadlineDate(d);
                        setDeadlineTime(t);
                      }}
                    />
                    <i className="bi bi-calendar-event position-absolute top-50 end-0 translate-middle-y me-3 text-secondary"></i>
                  </div>
                </div>
              </div>

              <div className="row g-2 mt-2">
                {['Kırılabilir', 'Hassas', 'Soğuk Zincir', 'Sıvı', 'Tehlikeli Madde', 'Vinç Gerekli', 'Forklift Gerekli'].map((attr) => (
                  <div key={attr} className="col-md-3 col-sm-6">
                    <label className="form-check-label d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={cargoAttributes.includes(attr)}
                        onChange={(e) => setAttribute(attr, e.target.checked)}
                      />
                      <span>{attr}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="panel-card p-4">
          <h3 className="shipment-section-title">2. Gönderi Segmenti</h3>
          <div className="shipment-segment-grid">
            {SEGMENTS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`shipment-segment-card tone-${item.tone} ${segment === item.key ? 'is-selected' : ''}`}
                onClick={() => {
                  setSegment(item.key);
                  setSubCategoryId(item.subCategories[0]?.id || 'all');
                  setSelectedLoadTypeSlug('');
                  setSelectedVehicleTypeSlug('');
                }}
              >
                <span className="shipment-segment-icon"><i className={`bi ${item.icon}`}></i></span>
                <span className="shipment-segment-content">
                  <strong>{item.label}</strong>
                  <small>{item.desc}</small>
                </span>
                <span className="shipment-segment-check"><i className={`bi ${segment === item.key ? 'bi-check-circle-fill' : 'bi-circle'}`}></i></span>
              </button>
            ))}
          </div>
          <div className="shipment-preset-row mt-3">
            {segmentConfig.subCategories.map((sub) => (
              <button
                key={sub.id}
                type="button"
                className={`shipment-preset-chip ${subCategoryId === sub.id ? 'is-active' : ''}`}
                onClick={() => {
                  setSubCategoryId(sub.id);
                  setSelectedLoadTypeSlug('');
                  setSelectedVehicleTypeSlug('');
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-card p-4">
          <h3 className="shipment-section-title">3. Yük Tipi</h3>
          {optionsLoading ? (
            <div className="text-secondary">Yük tipleri yükleniyor...</div>
          ) : (
            <div className="shipment-cargo-group">
              {(formOptions?.cargoTypes || []).map((cargo) => (
                <button
                  key={cargo.id}
                  type="button"
                  className={`vehicle-option-card ${selectedLoadTypeSlug === cargo.slug ? 'is-selected' : ''}`}
                  onClick={() => setSelectedLoadTypeSlug(cargo.slug)}
                >
                  <span className="vehicle-option-icon"><i className="bi bi-box-seam"></i></span>
                  <span>
                    <strong>{cargo.name}</strong>
                    <small>{cargo.subGroup || cargo.category || 'Yük tipi'}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel-card p-4">
          <h3 className="shipment-section-title">4. Araç Tipi</h3>
          {optionsLoading ? (
            <div className="text-secondary">Araç tipleri yükleniyor...</div>
          ) : (
            <div className="vehicle-option-grid">
              {(formOptions?.vehicleTypes || []).map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  className={`vehicle-option-card ${selectedVehicleTypeSlug === vehicle.slug ? 'is-selected' : ''}`}
                  onClick={() => setSelectedVehicleTypeSlug(vehicle.slug)}
                >
                  <span className="vehicle-option-icon"><i className="bi bi-truck"></i></span>
                  <span>
                    <strong>{vehicle.name}</strong>
                    <small>{vehicle.description || 'Uygun araç'}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>





        <div className="panel-card p-4">
          <h3 className="shipment-section-title">9. Yük Tipine Özel Alanlar</h3>
          {optionsLoading ? <div className="text-secondary">Alanlar yükleniyor...</div> : null}
          {!optionsLoading && formOptions?.fieldRules?.length ? (
            <div className="row g-3">
              {formOptions.fieldRules.map((rule) => (
                <div key={rule.id} className="col-md-4">
                  <label className="form-label">
                    {rule.fieldLabel} {rule.isRequired ? <span className="text-danger">*</span> : null}
                  </label>
                  {rule.fieldType === 'select' ? (
                    <select
                      className="form-select shipment-input"
                      value={fieldValues[rule.fieldKey] || ''}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [rule.fieldKey]: e.target.value }))}
                    >
                      <option value="">Seçiniz</option>
                      {(rule.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : rule.fieldType === 'boolean' ? (
                    <select
                      className="form-select shipment-input"
                      value={fieldValues[rule.fieldKey] || ''}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [rule.fieldKey]: e.target.value }))}
                    >
                      <option value="">Seçiniz</option>
                      <option value="Evet">Evet</option>
                      <option value="Hayır">Hayır</option>
                    </select>
                  ) : (
                    <input
                      type={rule.fieldType === 'number' ? 'number' : rule.fieldType === 'date' ? 'date' : 'text'}
                      className="form-control shipment-input"
                      value={fieldValues[rule.fieldKey] || ''}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [rule.fieldKey]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : null}
          {!optionsLoading && !formOptions?.fieldRules?.length ? <div className="text-secondary">Bu yük tipi için ek alan yok.</div> : null}
        </div>

        <div className="d-flex justify-content-end">
          <button type="button" className="btn btn-primary px-4" onClick={submitShipment} disabled={submitting}>
            {submitting ? 'Kaydediliyor...' : 'İlanı Yayınla'}
          </button>
        </div>
      </div>
    </section>
  );
}
