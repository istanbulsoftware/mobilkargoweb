import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { MediaLightbox } from '../components/MediaLightbox';
import { api, toAbsoluteAssetUrl } from '../lib/api';

type UserProfile = {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  role: 'shipper' | 'carrier' | 'admin';
  personType?: 'individual' | 'sole_proprietor' | 'corporate';
  membershipStatus: string;
  workingModes?: Array<'intracity' | 'intercity'>;
  city?: string;
  district?: string;
  serviceCities?: string[];
  profileUpdatedAt?: string;
  carrierPlan?: {
    planId: string;
    title: string;
    monthlyOfferLimit: number | null;
    isUnlimited: boolean;
  } | null;
  offerQuota?: {
    monthKey: string;
    usedThisMonth: number;
    remainingThisMonth: number | null;
    monthlyOfferLimit: number | null;
    isUnlimited: boolean;
  } | null;
};

type ShipmentRow = {
  _id: string;
  title: string;
  status: string;
  transportMode: 'intracity' | 'intercity';
  pickupCity?: string;
  pickupDistrict?: string;
  dropoffCity?: string;
  dropoffDistrict?: string;
  createdAt: string;
  scheduledPickupAt?: string;
  offerStats?: {
    total: number;
    submitted: number;
    accepted: number;
    rejected: number;
    withdrawn: number;
  };
};

type ShipmentsDetailedResponse = {
  summary: {
    totalShipments: number;
    published: number;
    offerCollecting: number;
    matched: number;
    completed: number;
    cancelled: number;
  };
  rows: ShipmentRow[];
};

type CityOption = { id: string; name: string };
type DistrictOption = { id: string; name: string; cityId: string };
type LookupVehicleType = { key: string; label: string; modes: Array<'intracity' | 'intercity'> };
type LookupLoadType = { key: string; label: string };
type CarrierFeedShipment = {
  _id: string;
  title: string;
  status: string;
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
  shipmentId?: { _id?: string; title?: string; transportMode?: 'intracity' | 'intercity'; pickupCity?: string; dropoffCity?: string };
  vehicleId?: { _id?: string; plateMasked?: string; brand?: string; model?: string };
};
type MyVehicle = {
  _id: string;
  status: string;
  plateMasked?: string;
  brand?: string;
  model?: string;
  vehicleTypeId?: { _id?: string; name?: string; slug?: string };
};
type MyDocument = {
  _id: string;
  vehicleId?: string;
  documentType: string;
  fileUrl?: string;
  status: string;
  createdAt?: string;
};

type SubscriptionPurchase = {
  _id: string;
  planTitle: string;
  amount: number;
  currency: string;
  purchasedAt: string;
  transactionRef?: string;
};

export function AccountPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [activePanel, setActivePanel] = useState<'overview' | 'profile' | 'shipments' | 'feed' | 'offers' | 'vehicle_add' | 'vehicle_list' | 'vehicle_docs'>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [data, setData] = useState<ShipmentsDetailedResponse | null>(null);
  const [carrierFeed, setCarrierFeed] = useState<CarrierFeedShipment[]>([]);
  const [carrierOffers, setCarrierOffers] = useState<CarrierOffer[]>([]);
  const [carrierOfferTab, setCarrierOfferTab] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'other'>('all');
  const [myVehicles, setMyVehicles] = useState<MyVehicle[]>([]);
  const [offerDraft, setOfferDraft] = useState<Record<string, { vehicleId: string; amount: string; note: string }>>({});
  const [offerActionLoading, setOfferActionLoading] = useState('');
  const [cities, setCities] = useState<CityOption[]>([]);
  const [districtByCity, setDistrictByCity] = useState<Record<string, DistrictOption[]>>({});
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedDistrictName, setSelectedDistrictName] = useState('');
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState<LookupVehicleType[]>([]);
  const [loadTypeOptions, setLoadTypeOptions] = useState<LookupLoadType[]>([]);

  const [vehicleTypeSlug, setVehicleTypeSlug] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleCapacityKg, setVehicleCapacityKg] = useState('');
  const [vehicleVolumeM3, setVehicleVolumeM3] = useState('');
  const [vehicleModes, setVehicleModes] = useState<Array<'intracity' | 'intercity'>>(['intracity']);
  const [vehicleServiceCityId, setVehicleServiceCityId] = useState('');
  const [vehicleServiceDistricts, setVehicleServiceDistricts] = useState<string[]>([]);
  const [vehicleSupportedLoadSlugs, setVehicleSupportedLoadSlugs] = useState<string[]>([]);
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleMessage, setVehicleMessage] = useState('');
  const [myDocuments, setMyDocuments] = useState<MyDocument[]>([]);
  const [subscriptionPurchases, setSubscriptionPurchases] = useState<SubscriptionPurchase[]>([]);
  const [selectedDocVehicleId, setSelectedDocVehicleId] = useState('');
  const [documentType, setDocumentType] = useState('vehicle_registration');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentMessage, setDocumentMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const [editFullName, setEditFullName] = useState('');
  const [editPersonType, setEditPersonType] = useState<UserProfile['personType']>('individual');
  const [editWorkingModes, setEditWorkingModes] = useState<Array<'intracity' | 'intercity'>>([]);

  const token = localStorage.getItem('an_user_token');

  const modeLabel = (mode?: 'intracity' | 'intercity') =>
    mode === 'intercity' ? 'Şehirler Arasi' : 'Şehir Ici';

  const districtOptions = useMemo(() => districtByCity[selectedCityId] || [], [districtByCity, selectedCityId]);
  const vehicleDistrictOptions = useMemo(() => districtByCity[vehicleServiceCityId] || [], [districtByCity, vehicleServiceCityId]);
  const selectedVehicleType = useMemo(
    () => vehicleTypeOptions.find((x) => x.key === vehicleTypeSlug) || null,
    [vehicleTypeOptions, vehicleTypeSlug],
  );

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
    const load = async () => {
      if (!token) {
        setMessage('Hesabım sayfasi için once giris yapmalisiniz.');
        setLoading(false);
        return;
      }

      try {
        const [profileRes, citiesRes, vehicleTypesRes, loadTypesRes] = await Promise.all([
          api.get<UserProfile>('/users/me/profile'),
          api.get<CityOption[]>('/lookups/cities'),
          api.get<LookupVehicleType[]>('/lookups/vehicle-types'),
          api.get<LookupLoadType[]>('/lookups/load-types'),
        ]);

        const nextProfile = profileRes.data;
        setProfile(nextProfile);
        const nextCities = Array.isArray(citiesRes.data) ? citiesRes.data : [];
        setCities(nextCities);
        setVehicleTypeOptions(Array.isArray(vehicleTypesRes.data) ? vehicleTypesRes.data : []);
        setLoadTypeOptions(Array.isArray(loadTypesRes.data) ? loadTypesRes.data : []);

        setEditFullName(nextProfile.fullName || '');
        setEditPersonType((nextProfile.personType || 'individual') as UserProfile['personType']);
        setEditWorkingModes(nextProfile.workingModes || []);

        const foundCity = nextCities.find((c) => c.name === (nextProfile.city || ''));
        if (foundCity) {
          setSelectedCityId(foundCity.id);
          await loadDistricts(foundCity.id);
          setSelectedDistrictName(nextProfile.district || '');
        } else {
          setSelectedCityId('');
          setSelectedDistrictName('');
        }

        if (nextProfile.role === 'shipper') {
          const shipmentsRes = await api.get<ShipmentsDetailedResponse>('/shipments/my/detailed');
          setData(shipmentsRes.data);
          setCarrierFeed([]);
          setCarrierOffers([]);
          setMyVehicles([]);
          setMyDocuments([]);
        } else if (nextProfile.role === 'carrier') {
          const [feedRes, offersRes, vehiclesRes, docsRes, subRes] = await Promise.all([
            api.get<CarrierFeedShipment[]>('/shipments/feed'),
            api.get<CarrierOffer[]>('/offers/my/detailed'),
            api.get<MyVehicle[]>('/vehicles/my'),
            api.get<MyDocument[]>('/documents/my'),
            api.get<{ purchases?: SubscriptionPurchase[] }>('/carrier-subscriptions/me'),
          ]);
          setCarrierFeed(Array.isArray(feedRes.data) ? feedRes.data : []);
          setCarrierOffers(Array.isArray(offersRes.data) ? offersRes.data : []);
          setMyVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
          setMyDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
          setSubscriptionPurchases(Array.isArray(subRes.data?.purchases) ? subRes.data.purchases : []);
          setData(null);
        } else {
          setData(null);
          setCarrierFeed([]);
          setCarrierOffers([]);
          setMyVehicles([]);
          setMyDocuments([]);
          setSubscriptionPurchases([]);
        }
      } catch (error: any) {
        setMessage(error?.response?.data?.message || 'Hesap verileri yüklenemedi.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [token]);

  useEffect(() => {
    if (!selectedCityId) {
      setSelectedDistrictName('');
      return;
    }
    void loadDistricts(selectedCityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCityId]);

  useEffect(() => {
    if (!vehicleServiceCityId) {
      setVehicleServiceDistricts([]);
      return;
    }
    void loadDistricts(vehicleServiceCityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleServiceCityId]);

  useEffect(() => {
    if (!selectedVehicleType) return;
    const allowed = new Set(selectedVehicleType.modes || []);
    setVehicleModes((prev) => {
      const filtered = prev.filter((m) => allowed.has(m));
      if (filtered.length) return filtered;
      return selectedVehicleType.modes?.length ? [selectedVehicleType.modes[0]] : ['intracity'];
    });
  }, [selectedVehicleType]);

  useEffect(() => {
    if (!myVehicles.length) {
      setSelectedDocVehicleId('');
      return;
    }
    if (!selectedDocVehicleId || !myVehicles.some((v) => v._id === selectedDocVehicleId)) {
      setSelectedDocVehicleId(myVehicles[0]._id);
    }
  }, [myVehicles, selectedDocVehicleId]);

  const saveProfile = async () => {
    if (!profile) return;
    if (!editFullName.trim()) {
      setSaveMessage('Ad soyad zorunlu.');
      return;
    }
    setSaving(true);
    setSaveMessage('');
    try {
      const cityName = cities.find((c) => c.id === selectedCityId)?.name || '';
      const payload: Record<string, unknown> = {
        fullName: editFullName.trim(),
        personType: editPersonType || 'individual',
        city: cityName || undefined,
        district: selectedDistrictName || undefined,
      };
      if (profile.role === 'carrier') payload.workingModes = editWorkingModes;

      await api.patch('/users/me', payload);

      const fresh = await api.get<UserProfile>('/users/me/profile');
      setProfile(fresh.data);
      setSaveMessage('Profil bilgileri güncellendi.');
    } catch (error: any) {
      setSaveMessage(error?.response?.data?.message || 'Profil güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const latestShipments = useMemo(() => (data?.rows || []).slice(0, 20), [data?.rows]);
  const activeVehicles = useMemo(() => myVehicles.filter((v) => v.status === 'active'), [myVehicles]);
  const offeredInFeed = useMemo(() => carrierFeed.filter((x) => x.hasMyOffer), [carrierFeed]);
  const openFeed = useMemo(() => carrierFeed.filter((x) => !x.hasMyOffer), [carrierFeed]);
  const filteredCarrierOffers = useMemo(() => {
    if (carrierOfferTab === 'all') return carrierOffers;
    if (carrierOfferTab === 'pending') return carrierOffers.filter((x) => ['submitted', 'updated'].includes(x.status));
    if (carrierOfferTab === 'accepted') return carrierOffers.filter((x) => x.status === 'accepted');
    if (carrierOfferTab === 'rejected') return carrierOffers.filter((x) => x.status === 'rejected');
    if (carrierOfferTab === 'withdrawn') return carrierOffers.filter((x) => x.status === 'withdrawn');
    return carrierOffers.filter((x) => ['cancelled', 'expired'].includes(x.status));
  }, [carrierOffers, carrierOfferTab]);

  const getDefaultVehicleForShipment = (shipment: CarrierFeedShipment) => {
    if (!activeVehicles.length) return '';
    const toId = (value: unknown) => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value !== null && '_id' in (value as Record<string, unknown>)) {
        return String((value as { _id?: string })._id || '');
      }
      return '';
    };
    const recommendedIds = (shipment.recommendedVehicleTypeIds || []).map(toId).filter(Boolean);
    if (!recommendedIds.length) return activeVehicles[0]?._id || '';
    const matched = activeVehicles.find((v) => {
      const vehicleTypeId = toId(v.vehicleTypeId as unknown);
      return vehicleTypeId ? recommendedIds.includes(vehicleTypeId) : false;
    });
    return matched?._id || activeVehicles[0]?._id || '';
  };

  const refreshCarrierData = async () => {
    const [feedRes, offersRes, vehiclesRes, docsRes] = await Promise.all([
      api.get<CarrierFeedShipment[]>('/shipments/feed'),
      api.get<CarrierOffer[]>('/offers/my/detailed'),
      api.get<MyVehicle[]>('/vehicles/my'),
      api.get<MyDocument[]>('/documents/my'),
    ]);
    setCarrierFeed(Array.isArray(feedRes.data) ? feedRes.data : []);
    setCarrierOffers(Array.isArray(offersRes.data) ? offersRes.data : []);
    setMyVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
    setMyDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
  };

  const submitOffer = async (shipmentId: string, fallbackVehicleId?: string) => {
    const draft = offerDraft[shipmentId] || { vehicleId: fallbackVehicleId || '', amount: '', note: '' };
    if (!draft?.vehicleId || !draft?.amount) {
      setMessage('Teklif için arac ve tutar secimi zorunlu.');
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
      await refreshCarrierData();
      setMessage('Teklif başarıyla gönderildi.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Teklif gönderilemedi.');
    } finally {
      setOfferActionLoading('');
    }
  };

  const withdrawOffer = async (offerId: string) => {
    setOfferActionLoading(offerId);
    setMessage('');
    try {
      await api.patch(`/offers/${offerId}/withdraw`);
      await refreshCarrierData();
      setMessage('Teklif geri cekildi.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Teklif geri cekilemedi.');
    } finally {
      setOfferActionLoading('');
    }
  };

  const resetVehicleForm = () => {
    setVehicleTypeSlug('');
    setVehiclePlate('');
    setVehicleBrand('');
    setVehicleModel('');
    setVehicleYear('');
    setVehicleCapacityKg('');
    setVehicleVolumeM3('');
    setVehicleModes(['intracity']);
    setVehicleServiceCityId('');
    setVehicleServiceDistricts([]);
    setVehicleSupportedLoadSlugs([]);
  };

  const submitVehicle = async () => {
    setVehicleMessage('');
    if (!vehicleTypeSlug) {
      setVehicleMessage('Araç tipi secmelisiniz.');
      return;
    }
    if (!vehiclePlate.trim()) {
      setVehicleMessage('Plaka zorunlu.');
      return;
    }
    if (!vehicleServiceCityId) {
      setVehicleMessage('Hizmet sehri secmelisiniz.');
      return;
    }
    if (!vehicleModes.length) {
      setVehicleMessage('En az bir tasima modu secmelisiniz.');
      return;
    }
    if (!vehicleSupportedLoadSlugs.length) {
      setVehicleMessage('En az bir desteklenen yuk tipi secmelisiniz.');
      return;
    }

    const cityName = cities.find((c) => c.id === vehicleServiceCityId)?.name;
    if (!cityName) {
      setVehicleMessage('Hizmet sehri gecersiz.');
      return;
    }

    setVehicleSaving(true);
    try {
      await api.post('/vehicles', {
        vehicleTypeSlug,
        plate: vehiclePlate.trim().toUpperCase(),
        brand: vehicleBrand.trim() || undefined,
        model: vehicleModel.trim() || undefined,
        year: vehicleYear ? Number(vehicleYear) : undefined,
        capacityKg: vehicleCapacityKg ? Number(vehicleCapacityKg) : undefined,
        volumeM3: vehicleVolumeM3 ? Number(vehicleVolumeM3) : undefined,
        modes: vehicleModes,
        serviceCities: [cityName],
        serviceDistricts: vehicleServiceDistricts.length ? vehicleServiceDistricts : undefined,
        supportedLoadTypeSlugs: vehicleSupportedLoadSlugs,
      });
      await refreshCarrierData();
      resetVehicleForm();
      setVehicleMessage('Araç basariyla eklendi. Inceleme süreçi için belge adimina gecebilirsiniz.');
      setActivePanel('vehicle_list');
    } catch (error: any) {
      setVehicleMessage(error?.response?.data?.message || 'Araç eklenemedi.');
    } finally {
      setVehicleSaving(false);
    }
  };

  const filteredVehicleDocs = useMemo(() => {
    if (!selectedDocVehicleId) return myDocuments.filter((d) => !!d.vehicleId);
    return myDocuments.filter((d) => String(d.vehicleId) === selectedDocVehicleId);
  }, [myDocuments, selectedDocVehicleId]);

  const submitVehicleDocument = async () => {
    setDocumentMessage('');
    if (!selectedDocVehicleId) {
      setDocumentMessage('Belge yÃ¼klenecek aracÄ± seÃ§melisiniz.');
      return;
    }
    if (!documentType.trim()) {
      setDocumentMessage('Belge tipi seÃ§melisiniz.');
      return;
    }
    if (!documentFile) {
      setDocumentMessage('Dosya seÃ§melisiniz.');
      return;
    }

    setDocumentUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', documentFile);
      formData.append('vehicleId', selectedDocVehicleId);
      formData.append('documentType', documentType.trim());
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshCarrierData();
      setDocumentFile(null);
      setDocumentMessage('AraÃ§ belgesi yÃ¼klendi.');
    } catch (error: any) {
      setDocumentMessage(error?.response?.data?.message || 'Belge yÃ¼klenemedi.');
    } finally {
      setDocumentUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('an_user_token');
    localStorage.removeItem('an_user_profile');
    navigate('/login');
  };

  const switchPanel = (
    panel: 'overview' | 'profile' | 'shipments' | 'feed' | 'offers' | 'vehicle_add' | 'vehicle_list' | 'vehicle_docs',
  ) => {
    setActivePanel(panel);
    setMobileSidebarOpen(false);
  };

  if (loading) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4">
          <div className="text-secondary">Hesap bilgileri yükleniyor...</div>
        </div>
      </section>
    );
  }

  if (!token) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4">
          <h3 className="fw-bold mb-2">Giriş Gerekli</h3>
          <p className="text-secondary mb-3">Bu sayfayi goruntulemek için hesabinizla giris yapin.</p>
          <Link to="/login" className="btn btn-primary">Giriş Yap</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="container py-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <h1 className="shipment-page-title mb-0">Hesabım</h1>
        <div className="d-flex gap-2">
          <Link to="/app" className="btn btn-outline-primary">
            {profile?.role === 'carrier' ? 'Yük Havuzuna Git' : 'Yeni Yük Oluştur'}
          </Link>
        </div>
      </div>

      {message ? <div className="alert alert-warning">{message}</div> : null}

      <div className="d-lg-none mb-3">
        <button
          type="button"
          className="btn btn-outline-primary w-100 account-sidebar-toggle"
          onClick={() => setMobileSidebarOpen((prev) => !prev)}
        >
          <i className={`bi ${mobileSidebarOpen ? 'bi-x-lg' : 'bi-list'} me-2`} />
          {mobileSidebarOpen ? 'Menüyü Kapat' : 'Hesap Menüsünü Aç'}
        </button>
      </div>

      {mobileSidebarOpen ? (
        <button type="button" className="account-sidebar-backdrop d-lg-none" onClick={() => setMobileSidebarOpen(false)} aria-label="Menüyü kapat" />
      ) : null}

      <div className="row g-4 account-shell">
        <div className="col-lg-3">
          <aside className={`panel-card p-3 account-sidebar ${mobileSidebarOpen ? 'is-open-mobile' : ''}`}>
            <div className="account-sidebar-head">
              <div className="account-avatar"><i className="bi bi-person-circle" /></div>
              <div>
                <strong>{profile?.fullName || 'Kullaniçi'}</strong>
                <small>{profile?.membershipStatus || '-'}</small>
              </div>
            </div>
            <div className="account-menu">
              <button
                type="button"
                className={`account-menu-item ${activePanel === 'overview' ? 'is-active' : ''}`}
                onClick={() => switchPanel('overview')}
              >
                <i className="bi bi-grid" /> Genel Bakis
              </button>
              <button
                type="button"
                className={`account-menu-item ${activePanel === 'profile' ? 'is-active' : ''}`}
                onClick={() => switchPanel('profile')}
              >
                <i className="bi bi-person-gear" /> Profil Duzenle
              </button>
              {profile?.role === 'shipper' ? (
                <button
                  type="button"
                  className={`account-menu-item ${activePanel === 'shipments' ? 'is-active' : ''}`}
                  onClick={() => switchPanel('shipments')}
                >
                  <i className="bi bi-truck" /> Yüklerim
                </button>
              ) : null}
              {profile?.role === 'carrier' ? (
                <>
                  <button
                    type="button"
                    className={`account-menu-item ${activePanel === 'vehicle_add' ? 'is-active' : ''}`}
                    onClick={() => switchPanel('vehicle_add')}
                  >
                    <i className="bi bi-plus-circle" /> Araç Ekle
                  </button>
                  <button
                    type="button"
                    className={`account-menu-item ${activePanel === 'vehicle_list' ? 'is-active' : ''}`}
                    onClick={() => switchPanel('vehicle_list')}
                  >
                    <i className="bi bi-truck-front" /> Araç Listem
                  </button>
                  <button
                    type="button"
                    className={`account-menu-item ${activePanel === 'vehicle_docs' ? 'is-active' : ''}`}
                    onClick={() => switchPanel('vehicle_docs')}
                  >
                    <i className="bi bi-file-earmark-arrow-up" /> Araç Belgeleri
                  </button>
                  <button
                    type="button"
                    className={`account-menu-item ${activePanel === 'feed' ? 'is-active' : ''}`}
                    onClick={() => switchPanel('feed')}
                  >
                    <i className="bi bi-search" /> Yük Havuzu
                  </button>
                  <button
                    type="button"
                    className={`account-menu-item ${activePanel === 'offers' ? 'is-active' : ''}`}
                    onClick={() => switchPanel('offers')}
                  >
                    <i className="bi bi-receipt" /> Tekliflerim
                  </button>
                </>
              ) : null}
            </div>
            <div className="account-sidebar-actions">
              <Link to="/app" className="btn btn-primary w-100">
                {profile?.role === 'carrier' ? 'Yük Havuzuna Git' : 'Yeni Yük Oluştur'}
              </Link>
              <button type="button" className="btn btn-outline-danger w-100 mt-2" onClick={handleLogout}>
                Çıkış Yap
              </button>
            </div>
          </aside>
        </div>
        <div className="col-lg-9">
          {activePanel === 'overview' && profile ? (
            <>
              <div className="panel-card p-4 account-profile-card mb-4">
                <h4 className="fw-bold mb-3">Hesap Bilgileri</h4>
                <div className="row g-3">
                  <div className="col-lg-3 col-md-6">
                    <small>Ad Soyad</small>
                    <strong>{profile.fullName}</strong>
                  </div>
                  <div className="col-lg-3 col-md-6">
                    <small>Telefon</small>
                    <strong>{profile.phone}</strong>
                  </div>
                  <div className="col-lg-3 col-md-6">
                    <small>E-posta</small>
                    <strong>{profile.email || '-'}</strong>
                  </div>
                  <div className="col-lg-3 col-md-6">
                    <small>Üyelik Durumu</small>
                    <strong>{profile.membershipStatus}</strong>
                  </div>
                  <div className="col-lg-3 col-md-6">
                    <small>Şehir</small>
                    <strong>{profile.city || '-'}</strong>
                  </div>
                  <div className="col-lg-3 col-md-6">
                    <small>İlçe</small>
                    <strong>{profile.district || '-'}</strong>
                  </div>
                  <div className="col-lg-3 col-md-6">
                    <small>Taşıma Modlari</small>
                    <strong>{(profile.workingModes || []).length ? (profile.workingModes || []).map(modeLabel).join(', ') : '-'}</strong>
                  </div>
                  <div className="col-lg-3 col-md-6">
                    <small>Rol</small>
                    <strong>{profile.role}</strong>
                  </div>
                </div>
              </div>

              {profile.role === 'shipper' ? (
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <div className="panel-card p-3 account-stat-card">
                      <small>Toplam Yük</small>
                      <h4>{data?.summary.totalShipments || 0}</h4>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="panel-card p-3 account-stat-card">
                      <small>Aktif Ilanlar</small>
                      <h4>{(data?.summary.published || 0) + (data?.summary.offerCollecting || 0)}</h4>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="panel-card p-3 account-stat-card">
                      <small>Tamamlanan</small>
                      <h4>{data?.summary.completed || 0}</h4>
                    </div>
                  </div>
                </div>
              ) : null}
              {profile.role === 'carrier' ? (
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <div className="panel-card p-3 account-stat-card">
                      <small>Pazardaki Uygun Yük</small>
                      <h4>{carrierFeed.length}</h4>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="panel-card p-3 account-stat-card">
                      <small>Toplam Teklifim</small>
                      <h4>{carrierOffers.length}</h4>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="panel-card p-3 account-stat-card">
                      <small>Aktif Araçim</small>
                      <h4>{activeVehicles.length}</h4>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="panel-card p-3 account-stat-card">
                      <small>Paketim</small>
                      <h4>{profile.carrierPlan?.title || 'Başlangıç Planı'}</h4>
                      <small className="d-block mt-1">
                        {profile.offerQuota?.isUnlimited
                          ? 'Bu ay sınırsız teklif hakkınız var.'
                          : `Bu ay kalan teklif: ${profile.offerQuota?.remainingThisMonth ?? 0} / ${profile.offerQuota?.monthlyOfferLimit ?? 0}`}
                      </small>
                    </div>
                  </div>
                </div>
              ) : null}

              {profile.role === 'carrier' ? (
                <div className="panel-card p-3 mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="fw-bold mb-0">Abonelik Satin Alma Gecmisi</h5>
                    <Link to="/abonelik/plan-1776496671427" className="btn btn-sm btn-outline-primary">
                      Paketi Yukselt
                    </Link>
                  </div>
                  {!subscriptionPurchases.length ? (
                    <p className="text-secondary mb-0">Henuz satin alma kaydi yok.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Paket</th>
                            <th>Tutar</th>
                            <th>Tarih</th>
                            <th>Islem No</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subscriptionPurchases.slice(0, 6).map((row) => (
                            <tr key={row._id}>
                              <td>{row.planTitle}</td>
                              <td>{row.amount} {row.currency}</td>
                              <td>{new Date(row.purchasedAt).toLocaleString('tr-TR')}</td>
                              <td>{row.transactionRef || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          ) : null}

          {activePanel === 'profile' && profile ? (
            <div className="panel-card p-4 mb-4">
              <h4 className="fw-bold mb-3">Profil Duzenle</h4>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Ad Soyad</label>
                  <input
                    className="form-control"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Kullaniçi Tipi</label>
                  <select
                    className="form-select"
                    value={editPersonType || 'individual'}
                    onChange={(e) => setEditPersonType(e.target.value as UserProfile['personType'])}
                  >
                    <option value="individual">Bireysel</option>
                    <option value="sole_proprietor">Sahis Firmasi</option>
                    <option value="corporate">Kurumsal</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Şehir</label>
                  <select
                    className="form-select"
                    value={selectedCityId}
                    onChange={(e) => {
                      setSelectedCityId(e.target.value);
                      setSelectedDistrictName('');
                    }}
                  >
                    <option value="">Şehir seçiniz</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>{city.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">İlçe</label>
                  <select
                    className="form-select"
                    value={selectedDistrictName}
                    onChange={(e) => setSelectedDistrictName(e.target.value)}
                    disabled={!selectedCityId}
                  >
                    <option value="">İlçe seçiniz</option>
                    {districtOptions.map((district) => (
                      <option key={district.id} value={district.name}>{district.name}</option>
                    ))}
                  </select>
                </div>

                {profile.role === 'carrier' ? (
                  <div className="col-md-8">
                    <label className="form-label d-block">Taşıma Modlari</label>
                    <div className="form-check form-check-inline">
                      <input
                        id="modeIntracity"
                        className="form-check-input"
                        type="checkbox"
                        checked={editWorkingModes.includes('intracity')}
                        onChange={(e) => {
                          if (e.target.checked) setEditWorkingModes((prev) => (prev.includes('intracity') ? prev : [...prev, 'intracity']));
                          else setEditWorkingModes((prev) => prev.filter((m) => m !== 'intracity'));
                        }}
                      />
                      <label htmlFor="modeIntracity" className="form-check-label">Şehir Ici</label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        id="modeIntercity"
                        className="form-check-input"
                        type="checkbox"
                        checked={editWorkingModes.includes('intercity')}
                        onChange={(e) => {
                          if (e.target.checked) setEditWorkingModes((prev) => (prev.includes('intercity') ? prev : [...prev, 'intercity']));
                          else setEditWorkingModes((prev) => prev.filter((m) => m !== 'intercity'));
                        }}
                      />
                      <label htmlFor="modeIntercity" className="form-check-label">Şehirler Arasi</label>
                    </div>
                  </div>
                ) : null}

                <div className="col-12 d-flex flex-wrap gap-2 align-items-center">
                  <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveProfile()}>
                    {saving ? 'Kaydediliyor...' : 'Profili Kaydet'}
                  </button>
                  {saveMessage ? <span className="text-secondary small">{saveMessage}</span> : null}
                </div>
              </div>
            </div>
          ) : null}

          {profile?.role === 'shipper' && activePanel === 'shipments' ? (
            <div className="panel-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0">Oluşturdugum Yükler</h4>
                <span className="text-secondary small">Son {latestShipments.length} kayit</span>
              </div>
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Baslik</th>
                      <th>Guzergah</th>
                      <th>Mod</th>
                      <th>Durum</th>
                      <th>Teklif</th>
                      <th>Tarih</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestShipments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-secondary">Henuz olusturulmus yuk bulunmuyor.</td>
                      </tr>
                    ) : (
                      latestShipments.map((item) => (
                        <tr key={item._id}>
                          <td>{item.title}</td>
                          <td>{`${item.pickupCity || '-'} / ${item.dropoffCity || '-'}`}</td>
                          <td>{modeLabel(item.transportMode)}</td>
                          <td><span className="badge text-bg-light border">{item.status}</span></td>
                          <td>{item.offerStats?.total ?? 0}</td>
                          <td>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</td>
                          <td className="text-end">
                            <div className="d-flex gap-2 justify-content-end">
                              <Link className="btn btn-sm btn-outline-primary" to={`/hesabim/yuk/${item._id}`}>
                                Detay
                              </Link>
                              <Link className="btn btn-sm btn-outline-secondary" to={`/hesabim/yuk/${item._id}/duzenle`}>
                                Duzenle
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {profile?.role === 'shipper' && activePanel !== 'shipments' ? (
            <div className="panel-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0">Oluşturdugum Yükler</h4>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setActivePanel('shipments')}>
                  Tumunu Gor
                </button>
              </div>
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Baslik</th>
                      <th>Durum</th>
                      <th>Tarih</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestShipments.slice(0, 5).length === 0 ? (
                      <tr><td colSpan={4} className="text-secondary">Kayıt bulunmuyor.</td></tr>
                    ) : (
                      latestShipments.slice(0, 5).map((item) => (
                        <tr key={item._id}>
                          <td>{item.title}</td>
                          <td><span className="badge text-bg-light border">{item.status}</span></td>
                          <td>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</td>
                          <td className="text-end">
                            <div className="d-flex gap-2 justify-content-end">
                              <Link className="btn btn-sm btn-outline-primary" to={`/hesabim/yuk/${item._id}`}>Detay</Link>
                              <Link className="btn btn-sm btn-outline-secondary" to={`/hesabim/yuk/${item._id}/duzenle`}>Duzenle</Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {profile?.role === 'carrier' && activePanel === 'feed' ? (
            <div className="panel-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0">Yük Havuzu</h4>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void refreshCarrierData()}>
                  Yenile
                </button>
              </div>
              {activeVehicles.length === 0 ? (
                <div className="alert alert-warning mb-3">
                  Teklif verebilmek için en az bir aktif araca ihtiyaciniz var.
                </div>
              ) : null}
              <div className="alert alert-info mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  Yük havuzunda sadece teklif vermediğiniz ilanlar gösteriliyor. Teklif verdikleriniz ayrı listelenir.
                </div>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setActivePanel('offers')}>
                  Tekliflerime Git
                </button>
              </div>
              {offeredInFeed.length > 0 ? (
                <div className="mb-3">
                  <div className="small text-secondary mb-2">Yük havuzunda teklif verdiğim ilanlar:</div>
                  <div className="d-flex flex-wrap gap-2">
                    {offeredInFeed.slice(0, 12).map((item) => (
                      <Link key={item._id} to={`/hesabim/yuk/${item._id}`} className="btn btn-sm btn-outline-secondary">
                        {item.title} {item.myOfferStatus ? `(${item.myOfferStatus})` : ''}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Yük</th>
                      <th>Rota</th>
                      <th>Durum</th>
                      <th>Araç</th>
                      <th>Tutar</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {openFeed.length === 0 ? (
                      <tr><td colSpan={6} className="text-secondary">Teklif verilebilecek uygun yuk bulunamadi.</td></tr>
                    ) : (
                      openFeed.map((item) => {
                        const defaultVehicleId = getDefaultVehicleForShipment(item);
                        const draft = offerDraft[item._id] || { vehicleId: defaultVehicleId, amount: '', note: '' };
                        return (
                          <tr key={item._id}>
                            <td>
                              <Link className="text-decoration-none fw-semibold" to={`/hesabim/yuk/${item._id}`}>
                                {item.title}
                              </Link>
                            </td>
                            <td>{`${item.pickupCity || '-'} / ${item.dropoffCity || '-'}`}</td>
                            <td><span className="badge text-bg-light border">{item.status}</span></td>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={draft.vehicleId}
                                onChange={(e) => setOfferDraft((prev) => ({ ...prev, [item._id]: { ...draft, vehicleId: e.target.value } }))}
                                disabled={activeVehicles.length === 0}
                              >
                                <option value="">Araç seçin</option>
                                {activeVehicles.map((v) => (
                                  <option key={v._id} value={v._id}>{`${v.vehicleTypeId?.name || 'Araç'} - ${v.plateMasked || ''}`}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                type="number"
                                min={1}
                                value={draft.amount}
                                onChange={(e) => setOfferDraft((prev) => ({ ...prev, [item._id]: { ...draft, amount: e.target.value } }))}
                                placeholder="â‚º"
                              />
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={offerActionLoading === item._id || activeVehicles.length === 0}
                                onClick={() => void submitOffer(item._id, defaultVehicleId)}
                              >
                                {offerActionLoading === item._id ? 'Gönderiliyor...' : 'Teklif Ver'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {profile?.role === 'carrier' && activePanel === 'vehicle_add' ? (
            <div className="panel-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0">Tasiyiçi Araç Ekleme Adimlari</h4>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void refreshCarrierData()}>
                  Listeyi Yenile
                </button>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <div className="border rounded-3 p-3 h-100">
                    <small className="text-secondary d-block">Adim 1</small>
                    <strong>Araç Kimligi</strong>
                    <div className="small text-secondary mt-1">Araç tipi, plaka, marka/model, yil</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="border rounded-3 p-3 h-100">
                    <small className="text-secondary d-block">Adim 2</small>
                    <strong>Kapasite ve Mod</strong>
                    <div className="small text-secondary mt-1">Taşıma modu, kg/m3 kapasitesi</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="border rounded-3 p-3 h-100">
                    <small className="text-secondary d-block">Adim 3</small>
                    <strong>Hizmet ve Yük Tipi</strong>
                    <div className="small text-secondary mt-1">Hizmet sehri/ilce ve desteklenen yukler</div>
                  </div>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Araç Tipi *</label>
                  <select className="form-select" value={vehicleTypeSlug} onChange={(e) => setVehicleTypeSlug(e.target.value)}>
                    <option value="">Seciniz</option>
                    {vehicleTypeOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                  {selectedVehicleType ? (
                    <small className="text-secondary d-block mt-1">Desteklenen modlar: {selectedVehicleType.modes.map(modeLabel).join(', ')}</small>
                  ) : null}
                </div>
                <div className="col-md-4">
                  <label className="form-label">Plaka *</label>
                  <input className="form-control" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} placeholder="34 ABC 123" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Yil</label>
                  <input className="form-control" type="number" min={1990} max={2100} value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Marka</label>
                  <input className="form-control" value={vehicleBrand} onChange={(e) => setVehicleBrand(e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Model</label>
                  <input className="form-control" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Kapasite (kg)</label>
                  <input className="form-control" type="number" min={0} value={vehicleCapacityKg} onChange={(e) => setVehicleCapacityKg(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Hacim (m3)</label>
                  <input className="form-control" type="number" min={0} step="0.1" value={vehicleVolumeM3} onChange={(e) => setVehicleVolumeM3(e.target.value)} />
                </div>

                <div className="col-md-6">
                  <label className="form-label d-block">Taşıma Modlari *</label>
                  <div className="form-check form-check-inline">
                    <input
                      id="vehicleModeIntracity"
                      className="form-check-input"
                      type="checkbox"
                      checked={vehicleModes.includes('intracity')}
                      onChange={(e) =>
                        setVehicleModes((prev) =>
                          e.target.checked
                            ? (prev.includes('intracity') ? prev : [...prev, 'intracity'])
                            : prev.filter((m) => m !== 'intracity'),
                        )
                      }
                    />
                    <label htmlFor="vehicleModeIntracity" className="form-check-label">Şehir Ici</label>
                  </div>
                  <div className="form-check form-check-inline">
                    <input
                      id="vehicleModeIntercity"
                      className="form-check-input"
                      type="checkbox"
                      checked={vehicleModes.includes('intercity')}
                      onChange={(e) =>
                        setVehicleModes((prev) =>
                          e.target.checked
                            ? (prev.includes('intercity') ? prev : [...prev, 'intercity'])
                            : prev.filter((m) => m !== 'intercity'),
                        )
                      }
                    />
                    <label htmlFor="vehicleModeIntercity" className="form-check-label">Şehirler Arasi</label>
                  </div>
                </div>

                <div className="col-md-3">
                  <label className="form-label">Hizmet Sehri *</label>
                  <select
                    className="form-select"
                    value={vehicleServiceCityId}
                    onChange={(e) => {
                      setVehicleServiceCityId(e.target.value);
                      setVehicleServiceDistricts([]);
                    }}
                  >
                    <option value="">Şehir seçiniz</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>{city.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Hizmet İlçeleri</label>
                  <select
                    multiple
                    className="form-select"
                    value={vehicleServiceDistricts}
                    onChange={(e) => {
                      const next = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                      setVehicleServiceDistricts(next);
                    }}
                    onFocus={() => {
                      if (vehicleServiceCityId) void loadDistricts(vehicleServiceCityId);
                    }}
                    disabled={!vehicleServiceCityId}
                    style={{ minHeight: 120 }}
                  >
                    {vehicleDistrictOptions.map((district) => (
                      <option key={district.id} value={district.name}>{district.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label d-block">Desteklenen Yük Tipleri *</label>
                  <div className="d-flex flex-wrap gap-2">
                    {loadTypeOptions.map((opt) => {
                      const checked = vehicleSupportedLoadSlugs.includes(opt.key);
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          className={`btn btn-sm ${checked ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() =>
                            setVehicleSupportedLoadSlugs((prev) =>
                              checked ? prev.filter((x) => x !== opt.key) : [...prev, opt.key],
                            )
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="col-12 d-flex gap-2 align-items-center">
                  <button type="button" className="btn btn-primary" disabled={vehicleSaving} onClick={() => void submitVehicle()}>
                    {vehicleSaving ? 'Kaydediliyor...' : 'Araçi Ekle'}
                  </button>
                  <button type="button" className="btn btn-outline-secondary" disabled={vehicleSaving} onClick={resetVehicleForm}>
                    Temizle
                  </button>
                  {vehicleMessage ? <span className="text-secondary small">{vehicleMessage}</span> : null}
                </div>
              </div>

            </div>
          ) : null}

          {profile?.role === 'carrier' && activePanel === 'vehicle_list' ? (
            <div className="panel-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0">Araç Listem</h4>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void refreshCarrierData()}>
                  Yenile
                </button>
              </div>
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Araç Tipi</th>
                      <th>Plaka</th>
                      <th>Marka / Model</th>
                      <th>Durum</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {myVehicles.length === 0 ? (
                      <tr><td colSpan={5} className="text-secondary">Henuz arac kaydi yok.</td></tr>
                    ) : (
                      myVehicles.map((v) => (
                        <tr key={v._id}>
                          <td>{v.vehicleTypeId?.name || '-'}</td>
                          <td>{v.plateMasked || '-'}</td>
                          <td>{`${v.brand || '-'} ${v.model || ''}`.trim()}</td>
                          <td><span className="badge text-bg-light border">{v.status}</span></td>
                          <td className="text-end">
                            <div className="d-flex gap-2 justify-content-end">
                              <Link className="btn btn-sm btn-outline-primary" to={`/hesabim/arac/${v._id}`}>Detay</Link>
                              <Link className="btn btn-sm btn-outline-secondary" to={`/hesabim/arac/${v._id}/duzenle`}>Duzenle</Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {profile?.role === 'carrier' && activePanel === 'vehicle_docs' ? (
            <div className="panel-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0">Araç Belgeleri</h4>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void refreshCarrierData()}>
                  Yenile
                </button>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label">Araç *</label>
                  <select
                    className="form-select"
                    value={selectedDocVehicleId}
                    onChange={(e) => setSelectedDocVehicleId(e.target.value)}
                  >
                    <option value="">Araç seçiniz</option>
                    {myVehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {`${v.vehicleTypeId?.name || 'Araç'} - ${v.plateMasked || ''}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Belge Tipi *</label>
                  <select className="form-select" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                    <option value="vehicle_registration">Ruhsat</option>
                    <option value="k1">K1 Yetki Belgesi</option>
                    <option value="k3">K3 Yetki Belgesi</option>
                    <option value="src4">SRC4 Belgesi</option>
                    <option value="psychotechnic">Psikoteknik</option>
                    <option value="vehicle_front_photo">Araç On Fotograf</option>
                    <option value="vehicle_plate_photo">Plaka Fotograf</option>
                    <option value="other_vehicle_document">Diger Araç Belgesi</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Dosya *</label>
                  <input
                    className="form-control"
                    type="file"
                    onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="col-12 d-flex gap-2 align-items-center">
                  <button type="button" className="btn btn-primary" disabled={documentUploading} onClick={() => void submitVehicleDocument()}>
                    {documentUploading ? 'Yükleniyor...' : 'Belge Yükle'}
                  </button>
                  {documentMessage ? <span className="text-secondary small">{documentMessage}</span> : null}
                </div>
              </div>

              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Araç</th>
                      <th>Belge Tipi</th>
                      <th>Durum</th>
                      <th>Tarih</th>
                      <th>Dosya</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVehicleDocs.length === 0 ? (
                      <tr><td colSpan={5} className="text-secondary">Secilen araca ait belge kaydi yok.</td></tr>
                    ) : (
                      filteredVehicleDocs.map((doc) => (
                        <tr key={doc._id}>
                          <td>{myVehicles.find((v) => v._id === String(doc.vehicleId))?.plateMasked || '-'}</td>
                          <td>{doc.documentType}</td>
                          <td><span className="badge text-bg-light border">{doc.status}</span></td>
                          <td>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('tr-TR') : '-'}</td>
                          <td>
                            {doc.fileUrl ? (
                              <div className="d-flex gap-2">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => {
                                    setPreviewUrl(toAbsoluteAssetUrl(doc.fileUrl));
                                    setPreviewTitle(`${doc.documentType} - ${myVehicles.find((v) => v._id === String(doc.vehicleId))?.plateMasked || 'Belge'}`);
                                  }}
                                >
                                  Onizle
                                </button>
                                <a href={toAbsoluteAssetUrl(doc.fileUrl)} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary">Ac</a>
                              </div>
                            ) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {profile?.role === 'carrier' && activePanel === 'offers' ? (
            <div className="panel-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0">Tekliflerim</h4>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void refreshCarrierData()}>
                  Yenile
                </button>
              </div>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button type="button" className={`btn btn-sm ${carrierOfferTab === 'all' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setCarrierOfferTab('all')}>Tumu ({carrierOffers.length})</button>
                <button type="button" className={`btn btn-sm ${carrierOfferTab === 'pending' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setCarrierOfferTab('pending')}>
                  Bekleyen ({carrierOffers.filter((x) => ['submitted', 'updated'].includes(x.status)).length})
                </button>
                <button type="button" className={`btn btn-sm ${carrierOfferTab === 'accepted' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setCarrierOfferTab('accepted')}>
                  Kabul ({carrierOffers.filter((x) => x.status === 'accepted').length})
                </button>
                <button type="button" className={`btn btn-sm ${carrierOfferTab === 'rejected' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setCarrierOfferTab('rejected')}>
                  Reddedilen ({carrierOffers.filter((x) => x.status === 'rejected').length})
                </button>
                <button type="button" className={`btn btn-sm ${carrierOfferTab === 'withdrawn' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setCarrierOfferTab('withdrawn')}>
                  Geri Cekilen ({carrierOffers.filter((x) => x.status === 'withdrawn').length})
                </button>
                <button type="button" className={`btn btn-sm ${carrierOfferTab === 'other' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setCarrierOfferTab('other')}>
                  Diger ({carrierOffers.filter((x) => ['cancelled', 'expired'].includes(x.status)).length})
                </button>
              </div>
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Yük</th>
                      <th>Rota</th>
                      <th>Tutar</th>
                      <th>Durum</th>
                      <th>Tarih</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCarrierOffers.length === 0 ? (
                      <tr><td colSpan={6} className="text-secondary">Henuz teklif kaydiniz yok.</td></tr>
                    ) : (
                      filteredCarrierOffers.map((offer) => (
                        <tr key={offer._id}>
                          <td>{offer.shipmentId?.title || '-'}</td>
                          <td>{`${offer.shipmentId?.pickupCity || '-'} / ${offer.shipmentId?.dropoffCity || '-'}`}</td>
                          <td>{typeof offer.price === 'number' ? `â‚º${offer.price}` : '-'}</td>
                          <td><span className="badge text-bg-light border">{offer.status}</span></td>
                          <td>{offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('tr-TR') : '-'}</td>
                          <td className="text-end">
                            <div className="d-flex gap-2 justify-content-end">
                              {offer.shipmentId?._id ? (
                                <Link to={`/hesabim/yuk/${offer.shipmentId._id}`} className="btn btn-sm btn-outline-primary">
                                  Ilan Detayi
                                </Link>
                              ) : null}
                              {['submitted', 'updated'].includes(offer.status) ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  disabled={offerActionLoading === offer._id}
                                  onClick={() => void withdrawOffer(offer._id)}
                                >
                                  {offerActionLoading === offer._id ? 'Isleniyor...' : 'Geri Cek'}
                                </button>
                              ) : (
                                <span className="text-secondary small">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <MediaLightbox open={Boolean(previewUrl)} url={previewUrl} title={previewTitle} onClose={() => setPreviewUrl('')} />
        </div>
      </div>
    </section>
  );
}



