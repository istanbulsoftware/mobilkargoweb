import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { MediaLightbox } from '../components/MediaLightbox';
import { NearbyLoadsMapPanel } from '../components/NearbyLoadsMapPanel';
import { api, toAbsoluteAssetUrl } from '../lib/api';

type UserProfile = {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  role: 'shipper' | 'carrier' | 'admin';
  personType?: 'individual' | 'sole_proprietor' | 'corporate';
  companyName?: string;
  companyTitle?: string;
  taxNumber?: string;
  authorizedPersonName?: string;
  billingAddress?: string;
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
  description?: string;
  transportMode: 'intracity' | 'intercity';
  pickupGeo?: { type?: 'Point'; coordinates?: [number, number] | number[] };
  pickupCity?: string;
  pickupDistrict?: string;
  dropoffCity?: string;
  dropoffDistrict?: string;
  routeDistanceKm?: number;
  routeDurationMin?: number;
  scheduledPickupAt?: string;
  estimatedWeightKg?: number;
  estimatedVolumeM3?: number;
  pieceCount?: number;
  isUrgent?: boolean;
  createdAt?: string;
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
    status?: string;
    transportMode?: 'intracity' | 'intercity';
    pickupCity?: string;
    dropoffCity?: string;
  };
  vehicleId?: { _id?: string; plateMasked?: string; brand?: string; model?: string };
};
type ReviewShipmentStatusRow = {
  shipmentId: string;
  status: string;
  hasMyReview: boolean;
  hasReceivedReview: boolean;
  canReview: boolean;
  shouldPromptReciprocal: boolean;
};
type ReceivedReviewRow = {
  _id: string;
  rating?: number;
  comment?: string;
  createdAt?: string;
  reviewerUserId?: { _id?: string; fullName?: string; role?: string } | string;
  shipmentId?: { _id?: string; title?: string; status?: string } | string;
};
type ReceivedReviewResponse = {
  summary?: {
    count?: number;
    avg?: number;
  };
  rows?: ReceivedReviewRow[];
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
type CarrierLoadAlert = {
  _id: string;
  name: string;
  transportMode: 'all' | 'intracity' | 'intercity';
  city?: string;
  district?: string;
  loadTypeSlug?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [activePanel, setActivePanel] = useState<'overview' | 'profile' | 'reviews' | 'shipments' | 'nearby_map' | 'offers' | 'completed_loads' | 'load_alerts' | 'subscriptions' | 'vehicle_add' | 'vehicle_list' | 'vehicle_docs'>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [data, setData] = useState<ShipmentsDetailedResponse | null>(null);
  const [carrierFeed, setCarrierFeed] = useState<CarrierFeedShipment[]>([]);
  const [carrierOffers, setCarrierOffers] = useState<CarrierOffer[]>([]);
  const [reviewStatusByShipmentId, setReviewStatusByShipmentId] = useState<Record<string, ReviewShipmentStatusRow>>({});
  const [receivedReviews, setReceivedReviews] = useState<ReceivedReviewRow[]>([]);
  const [receivedReviewSummary, setReceivedReviewSummary] = useState<{ count: number; avg: number }>({ count: 0, avg: 0 });
  const [receivedReviewSort, setReceivedReviewSort] = useState<'newest' | 'oldest' | 'rating_high' | 'rating_low' | 'commented_first'>('newest');
  const [carrierOfferTab, setCarrierOfferTab] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'other'>('all');
  const [carrierOfferSort, setCarrierOfferSort] = useState<'newest' | 'oldest' | 'price_high' | 'price_low' | 'status'>('newest');
  const [carrierCompletedSort, setCarrierCompletedSort] = useState<'newest' | 'oldest' | 'price_high' | 'price_low' | 'title'>('newest');
  const [shipperShipmentTab, setShipperShipmentTab] = useState<'all' | 'open_pool' | 'matched' | 'completed' | 'expired' | 'cancelled' | 'other'>('all');
  const [shipperShipmentSort, setShipperShipmentSort] = useState<'newest' | 'oldest' | 'offers_high' | 'offers_low' | 'title'>('newest');
  const [carrierAlerts, setCarrierAlerts] = useState<CarrierLoadAlert[]>([]);
  const [alertActionLoading, setAlertActionLoading] = useState('');
  const [alertEditId, setAlertEditId] = useState('');
  const [alertName, setAlertName] = useState('');
  const [alertMode, setAlertMode] = useState<'all' | 'intracity' | 'intercity'>('all');
  const [alertCityId, setAlertCityId] = useState('');
  const [alertDistrict, setAlertDistrict] = useState('');
  const [alertLoadTypeSlug, setAlertLoadTypeSlug] = useState('');
  const [myVehicles, setMyVehicles] = useState<MyVehicle[]>([]);
  const [offerActionLoading, setOfferActionLoading] = useState('');
  const [shipmentActionLoading, setShipmentActionLoading] = useState('');
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
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editCompanyTitle, setEditCompanyTitle] = useState('');
  const [editTaxNumber, setEditTaxNumber] = useState('');
  const [editAuthorizedPersonName, setEditAuthorizedPersonName] = useState('');
  const [editBillingAddress, setEditBillingAddress] = useState('');

  const token = localStorage.getItem('an_user_token');
  const panelParam = searchParams.get('panel');
  const vehicleIdParam = searchParams.get('vehicleId');
  const shipperTabParam = searchParams.get('shipperTab');

  const modeLabel = (mode?: 'intracity' | 'intercity') =>
    mode === 'intercity' ? 'Şehirler Arasi' : 'Şehir Ici';

  const shipmentStatusLabel = (status?: string) => {
    const map: Record<string, string> = {
      draft: 'Taslak',
      published: 'Yayinda',
      offer_collecting: 'Teklif Topluyor',
      matched: 'Eslesti',
      completed: 'Tamamlandi',
      cancelled: 'Iptal',
      suspended: 'Durduruldu',
    };
    return map[status || ''] || status || '-';
  };

  const shipmentStatusBadgeLabel = (status?: string) => {
    if (status === 'published' || status === 'offer_collecting') return 'Yayinda · Teklif Topluyor';
    return shipmentStatusLabel(status);
  };

  const shipmentStatusPillTone = (status?: string) => {
    if (status === 'published' || status === 'offer_collecting') return 'tone-info';
    if (status === 'matched') return 'tone-success';
    if (status === 'completed') return 'tone-warning';
    if (status === 'cancelled') return 'tone-danger';
    return 'tone-neutral';
  };
  const isExpiredUnassignedShipment = (shipment?: ShipmentRow) => {
    if (!shipment) return false;
    if (!['published', 'offer_collecting'].includes(shipment.status)) return false;
    if (!shipment.scheduledPickupAt) return false;
    return new Date(shipment.scheduledPickupAt).getTime() < Date.now();
  };
  const shipmentListStatusLabel = (shipment?: ShipmentRow) =>
    isExpiredUnassignedShipment(shipment) ? 'Süresi Geçti' : shipmentStatusBadgeLabel(shipment?.status);
  const shipmentListStatusTone = (shipment?: ShipmentRow) =>
    isExpiredUnassignedShipment(shipment) ? 'tone-danger' : shipmentStatusPillTone(shipment?.status);

  const offerStatusLabel = (status?: string) => {
    const map: Record<string, string> = {
      submitted: 'Gonderildi',
      updated: 'Guncellendi',
      accepted: 'Kabul Edildi',
      rejected: 'Reddedildi',
      withdrawn: 'Geri Cekildi',
      cancelled: 'Iptal',
      expired: 'Suresi Doldu',
    };
    return map[status || ''] || status || '-';
  };

  const offerStatusPillTone = (status?: string) => {
    if (['accepted'].includes(status || '')) return 'tone-success';
    if (['rejected', 'cancelled', 'withdrawn', 'expired'].includes(status || '')) return 'tone-danger';
    if (['submitted', 'updated'].includes(status || '')) return 'tone-warning';
    return 'tone-neutral';
  };
  const roleLabel = (role?: string) => {
    if (role === 'shipper') return 'Gönderici';
    if (role === 'carrier') return 'Taşıyıcı';
    if (role === 'admin') return 'Yönetici';
    return '-';
  };

  const vehicleStatusLabel = (status?: string) => {
    const map: Record<string, string> = {
      active: 'Aktif',
      pending_review: 'Incelemede',
      suspended: 'Askida',
      rejected: 'Reddedildi',
      passive: 'Pasif',
      inactive: 'Pasif',
    };
    return map[status || ''] || status || '-';
  };

  const vehicleStatusPillTone = (status?: string) => {
    if (status === 'active') return 'tone-success';
    if (['pending_review'].includes(status || '')) return 'tone-warning';
    if (['rejected', 'suspended'].includes(status || '')) return 'tone-danger';
    return 'tone-neutral';
  };

  const vehicleDocumentTypeLabel = (documentType?: string) => {
    const map: Record<string, string> = {
      vehicle_registration: 'Ruhsat',
      k1: 'K1 Yetki Belgesi',
      k3: 'K3 Yetki Belgesi',
      src4: 'SRC4 Belgesi',
      psychotechnic: 'Psikoteknik',
      vehicle_front_photo: 'Araç Ön Fotoğrafı',
      vehicle_plate_photo: 'Plaka Fotoğrafı',
      other_vehicle_document: 'Diğer Araç Belgesi',
    };
    return map[documentType || ''] || documentType || '-';
  };

  const vehicleDocumentStatusLabel = (status?: string) => {
    const map: Record<string, string> = {
      pending: 'Beklemede',
      pending_review: 'Incelemede',
      approved: 'Onaylandi',
      rejected: 'Reddedildi',
      revision_required: 'Revizyon Gerekli',
      expired: 'Suresi Doldu',
    };
    return map[status || ''] || status || '-';
  };

  const vehicleDocumentStatusPillTone = (status?: string) => {
    if (status === 'approved') return 'tone-success';
    if (['pending', 'pending_review'].includes(status || '')) return 'tone-warning';
    if (['rejected', 'revision_required', 'expired'].includes(status || '')) return 'tone-danger';
    return 'tone-neutral';
  };

  const formatTryPrice = (value?: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '-';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const notifyError = (text: string) => {
    void Swal.fire({ icon: 'error', title: 'Hata', text, confirmButtonText: 'Tamam' });
  };

  const notifySuccess = (text: string) => {
    void Swal.fire({ icon: 'success', title: 'Başarılı', text, confirmButtonText: 'Tamam' });
  };

  const notifyWarning = (text: string) => {
    void Swal.fire({ icon: 'warning', title: 'Uyarı', text, confirmButtonText: 'Tamam' });
  };

  const districtOptions = useMemo(() => districtByCity[selectedCityId] || [], [districtByCity, selectedCityId]);
  const vehicleDistrictOptions = useMemo(() => districtByCity[vehicleServiceCityId] || [], [districtByCity, vehicleServiceCityId]);
  const alertDistrictOptions = useMemo(() => districtByCity[alertCityId] || [], [districtByCity, alertCityId]);
  const alertCityName = useMemo(() => cities.find((x) => x.id === alertCityId)?.name || '', [cities, alertCityId]);
  const loadTypeLabelMap = useMemo(
    () => loadTypeOptions.reduce((acc, item) => ({ ...acc, [item.key]: item.label }), {} as Record<string, string>),
    [loadTypeOptions],
  );
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
        notifyWarning('Hesabım sayfası için önce giriş yapmalısınız.');
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
        setEditCompanyName(nextProfile.companyName || '');
        setEditCompanyTitle(nextProfile.companyTitle || '');
        setEditTaxNumber(nextProfile.taxNumber || '');
        setEditAuthorizedPersonName(nextProfile.authorizedPersonName || '');
        setEditBillingAddress(nextProfile.billingAddress || '');

        const foundCity = nextCities.find((c) => c.name === (nextProfile.city || ''));
        if (foundCity) {
          setSelectedCityId(foundCity.id);
          void loadDistricts(foundCity.id);
          setSelectedDistrictName(nextProfile.district || '');
        } else {
          setSelectedCityId('');
          setSelectedDistrictName('');
        }

        // İlk ekranı hızlı aç: role'e özel ağır istekleri arka planda yükle.
        setLoading(false);

        if (nextProfile.role === 'shipper') {
          setCarrierFeed([]);
          setCarrierOffers([]);
          setCarrierAlerts([]);
          setMyVehicles([]);
          setMyDocuments([]);
          setSubscriptionPurchases([]);
          void (async () => {
            try {
              const [shipmentsRes, receivedReviewsRes] = await Promise.all([
                api.get<ShipmentsDetailedResponse>('/shipments/my/detailed'),
                api.get<ReceivedReviewResponse>('/reviews/me/received'),
              ]);
              setData(shipmentsRes.data);
              setReceivedReviews(Array.isArray(receivedReviewsRes.data?.rows) ? receivedReviewsRes.data?.rows || [] : []);
              setReceivedReviewSummary({
                count: Number(receivedReviewsRes.data?.summary?.count || 0),
                avg: Number(receivedReviewsRes.data?.summary?.avg || 0),
              });
              const shipmentIds = (shipmentsRes.data?.rows || []).map((row) => row._id);
              await loadReviewStatuses(shipmentIds);
            } catch {
              // ilk açılışı bloklamamak için sessiz geç
              setReviewStatusByShipmentId({});
              setReceivedReviews([]);
              setReceivedReviewSummary({ count: 0, avg: 0 });
            }
          })();
        } else if (nextProfile.role === 'carrier') {
          setData(null);
          void (async () => {
            try {
              const [feedRes, offersRes, vehiclesRes, docsRes, subRes, receivedReviewsRes, alertsRes] = await Promise.all([
                api.get<CarrierFeedShipment[]>('/shipments/feed'),
                api.get<CarrierOffer[]>('/offers/my/detailed'),
                api.get<MyVehicle[]>('/vehicles/my'),
                api.get<MyDocument[]>('/documents/my'),
                api.get<{ purchases?: SubscriptionPurchase[] }>('/carrier-subscriptions/me'),
                api.get<ReceivedReviewResponse>('/reviews/me/received'),
                api.get<CarrierLoadAlert[]>('/carrier-load-alerts/my'),
              ]);
              setCarrierFeed(Array.isArray(feedRes.data) ? feedRes.data : []);
              setCarrierOffers(Array.isArray(offersRes.data) ? offersRes.data : []);
              setCarrierAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
              setMyVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
              setMyDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
              setSubscriptionPurchases(Array.isArray(subRes.data?.purchases) ? subRes.data.purchases : []);
              setReceivedReviews(Array.isArray(receivedReviewsRes.data?.rows) ? receivedReviewsRes.data?.rows || [] : []);
              setReceivedReviewSummary({
                count: Number(receivedReviewsRes.data?.summary?.count || 0),
                avg: Number(receivedReviewsRes.data?.summary?.avg || 0),
              });
              const shipmentIds = (Array.isArray(offersRes.data) ? offersRes.data : [])
                .map((offer) => String(offer?.shipmentId?._id || ''))
                .filter(Boolean);
              await loadReviewStatuses(shipmentIds);
            } catch {
              // ilk açılışı bloklamamak için sessiz geç
              setReviewStatusByShipmentId({});
              setReceivedReviews([]);
              setReceivedReviewSummary({ count: 0, avg: 0 });
            }
          })();
        } else {
          setData(null);
          setCarrierFeed([]);
          setCarrierOffers([]);
          setCarrierAlerts([]);
          setMyVehicles([]);
          setMyDocuments([]);
          setSubscriptionPurchases([]);
          setReviewStatusByShipmentId({});
          setReceivedReviews([]);
          setReceivedReviewSummary({ count: 0, avg: 0 });
        }
      } catch (error: any) {
        const errText = error?.response?.data?.message || 'Hesap verileri yüklenemedi.';
        setMessage(errText);
        notifyError(errText);
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
    if (!alertCityId) {
      setAlertDistrict('');
      return;
    }
    void loadDistricts(alertCityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertCityId]);

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

  useEffect(() => {
    if (!vehicleIdParam) return;
    if (!myVehicles.length) return;
    const exists = myVehicles.some((v) => v._id === vehicleIdParam);
    if (!exists) return;
    setSelectedDocVehicleId(vehicleIdParam);
    setActivePanel('vehicle_docs');
  }, [vehicleIdParam, myVehicles]);
  useEffect(() => {
    if (!profile) return;
    if (!panelParam) return;

    const carrierPanels = new Set(['overview', 'profile', 'reviews', 'nearby_map', 'offers', 'completed_loads', 'load_alerts', 'subscriptions', 'vehicle_add', 'vehicle_list', 'vehicle_docs']);
    const shipperPanels = new Set(['overview', 'profile', 'reviews', 'shipments']);

    if (profile.role === 'carrier' && carrierPanels.has(panelParam)) {
      setActivePanel(panelParam as 'overview' | 'profile' | 'reviews' | 'nearby_map' | 'offers' | 'completed_loads' | 'load_alerts' | 'subscriptions' | 'vehicle_add' | 'vehicle_list' | 'vehicle_docs');
      return;
    }
    if (profile.role === 'shipper' && shipperPanels.has(panelParam)) {
      setActivePanel(panelParam as 'overview' | 'profile' | 'reviews' | 'shipments');
      if (panelParam === 'shipments' && shipperTabParam) {
        const allowed = new Set(['all', 'open_pool', 'matched', 'completed', 'expired', 'cancelled', 'other']);
        if (allowed.has(shipperTabParam)) {
          setShipperShipmentTab(
            shipperTabParam as 'all' | 'open_pool' | 'matched' | 'completed' | 'expired' | 'cancelled' | 'other',
          );
        }
      }
    }
  }, [panelParam, profile, shipperTabParam]);

  const saveProfile = async () => {
    if (!profile) return;
    if (!editFullName.trim()) {
      setSaveMessage('Ad soyad zorunlu.');
      notifyWarning('Ad soyad zorunlu.');
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
        companyName: editCompanyName.trim() || undefined,
        companyTitle: editCompanyTitle.trim() || undefined,
        taxNumber: editTaxNumber.trim() || undefined,
        authorizedPersonName: editAuthorizedPersonName.trim() || undefined,
        billingAddress: editBillingAddress.trim() || undefined,
      };
      if (profile.role === 'carrier') payload.workingModes = editWorkingModes;

      await api.patch('/users/me', payload);

      const fresh = await api.get<UserProfile>('/users/me/profile');
      setProfile(fresh.data);
      setSaveMessage('Profil bilgileri güncellendi.');
      notifySuccess('Profil bilgileri güncellendi.');
    } catch (error: any) {
      const errText = error?.response?.data?.message || 'Profil güncellenemedi.';
      setSaveMessage(errText);
      notifyError(errText);
    } finally {
      setSaving(false);
    }
  };

  const latestShipments = useMemo(() => (data?.rows || []).slice(0, 20), [data?.rows]);
  const activeVehicles = useMemo(() => myVehicles.filter((v) => v.status === 'active'), [myVehicles]);
  const filteredCarrierOffers = useMemo(() => {
    if (carrierOfferTab === 'all') return carrierOffers;
    if (carrierOfferTab === 'pending') return carrierOffers.filter((x) => ['submitted', 'updated'].includes(x.status));
    if (carrierOfferTab === 'accepted') return carrierOffers.filter((x) => x.status === 'accepted');
    if (carrierOfferTab === 'rejected') return carrierOffers.filter((x) => x.status === 'rejected');
    if (carrierOfferTab === 'withdrawn') return carrierOffers.filter((x) => x.status === 'withdrawn');
    return carrierOffers.filter((x) => ['cancelled', 'expired'].includes(x.status));
  }, [carrierOffers, carrierOfferTab]);
  const sortedCarrierOffers = useMemo(() => {
    const rows = [...filteredCarrierOffers];
    if (carrierOfferSort === 'newest') {
      rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return rows;
    }
    if (carrierOfferSort === 'oldest') {
      rows.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      return rows;
    }
    if (carrierOfferSort === 'price_high') {
      rows.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
      return rows;
    }
    if (carrierOfferSort === 'price_low') {
      rows.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      return rows;
    }
    rows.sort((a, b) => offerStatusLabel(a.status).localeCompare(offerStatusLabel(b.status), 'tr'));
    return rows;
  }, [filteredCarrierOffers, carrierOfferSort]);
  const carrierCompletedOffers = useMemo(() => {
    const acceptedCompleted = carrierOffers.filter(
      (offer) => offer.status === 'accepted' && offer.shipmentId?._id && offer.shipmentId?.status === 'completed',
    );
    const byShipment: Record<string, CarrierOffer> = {};
    acceptedCompleted.forEach((offer) => {
      const shipmentId = String(offer.shipmentId?._id || '');
      if (!shipmentId) return;
      const current = byShipment[shipmentId];
      if (!current) {
        byShipment[shipmentId] = offer;
        return;
      }
      const currentTs = new Date(current.createdAt || 0).getTime();
      const nextTs = new Date(offer.createdAt || 0).getTime();
      if (nextTs > currentTs) byShipment[shipmentId] = offer;
    });
    return Object.values(byShipment);
  }, [carrierOffers]);
  const sortedCarrierCompletedOffers = useMemo(() => {
    const rows = [...carrierCompletedOffers];
    if (carrierCompletedSort === 'newest') {
      rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return rows;
    }
    if (carrierCompletedSort === 'oldest') {
      rows.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      return rows;
    }
    if (carrierCompletedSort === 'price_high') {
      rows.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
      return rows;
    }
    if (carrierCompletedSort === 'price_low') {
      rows.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      return rows;
    }
    rows.sort((a, b) => String(a.shipmentId?.title || '').localeCompare(String(b.shipmentId?.title || ''), 'tr'));
    return rows;
  }, [carrierCompletedOffers, carrierCompletedSort]);
  const filteredShipperShipments = useMemo(() => {
    if (shipperShipmentTab === 'all') return latestShipments;
    if (shipperShipmentTab === 'open_pool') {
      return latestShipments.filter((x) => ['published', 'offer_collecting'].includes(x.status) && !isExpiredUnassignedShipment(x));
    }
    if (shipperShipmentTab === 'expired') {
      return latestShipments.filter((x) => isExpiredUnassignedShipment(x));
    }
    if (shipperShipmentTab === 'other') {
      return latestShipments.filter((x) => !['published', 'offer_collecting', 'matched', 'completed', 'cancelled'].includes(x.status));
    }
    return latestShipments.filter((x) => x.status === shipperShipmentTab);
  }, [latestShipments, shipperShipmentTab]);
  const sortedShipperShipments = useMemo(() => {
    const rows = [...filteredShipperShipments];
    if (shipperShipmentSort === 'newest') {
      rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return rows;
    }
    if (shipperShipmentSort === 'oldest') {
      rows.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      return rows;
    }
    if (shipperShipmentSort === 'offers_high') {
      rows.sort((a, b) => Number(b.offerStats?.total || 0) - Number(a.offerStats?.total || 0));
      return rows;
    }
    if (shipperShipmentSort === 'offers_low') {
      rows.sort((a, b) => Number(a.offerStats?.total || 0) - Number(b.offerStats?.total || 0));
      return rows;
    }
    rows.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'tr'));
    return rows;
  }, [filteredShipperShipments, shipperShipmentSort]);
  const sortedReceivedReviews = useMemo(() => {
    const rows = [...receivedReviews];
    if (receivedReviewSort === 'newest') {
      rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return rows;
    }
    if (receivedReviewSort === 'oldest') {
      rows.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      return rows;
    }
    if (receivedReviewSort === 'rating_high') {
      rows.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
      return rows;
    }
    if (receivedReviewSort === 'rating_low') {
      rows.sort((a, b) => Number(a.rating || 0) - Number(b.rating || 0));
      return rows;
    }
    rows.sort((a, b) => Number(Boolean(b.comment?.trim())) - Number(Boolean(a.comment?.trim())));
    return rows;
  }, [receivedReviews, receivedReviewSort]);

  const mapReviewStatuses = (rows: ReviewShipmentStatusRow[]) => {
    const next: Record<string, ReviewShipmentStatusRow> = {};
    (rows || []).forEach((row) => {
      if (!row?.shipmentId) return;
      next[row.shipmentId] = row;
    });
    setReviewStatusByShipmentId(next);
  };

  const loadReviewStatuses = async (shipmentIds: string[]) => {
    const ids = Array.from(new Set((shipmentIds || []).filter(Boolean)));
    if (!ids.length) {
      setReviewStatusByShipmentId({});
      return;
    }
    try {
      const { data: reviewData } = await api.get<{ rows?: ReviewShipmentStatusRow[] }>('/reviews/me/shipments-status', {
        params: { shipmentIds: ids.join(',') },
      });
      mapReviewStatuses(Array.isArray(reviewData?.rows) ? reviewData.rows : []);
    } catch {
      setReviewStatusByShipmentId({});
    }
  };

  const getReviewBadge = (shipmentId?: string, shipmentStatus?: string) => {
    if (!shipmentId || shipmentStatus !== 'completed') return null;
    const info = reviewStatusByShipmentId[shipmentId];
    if (!info) return null;
    if (info.shouldPromptReciprocal) {
      return <span className="badge text-bg-warning">Cevap bekleniyor</span>;
    }
    if (info.hasReceivedReview && !info.hasMyReview) {
      return <span className="badge text-bg-success">Yeni yorum var</span>;
    }
    return null;
  };
  const loadReceivedReviews = async () => {
    try {
      const { data } = await api.get<ReceivedReviewResponse>('/reviews/me/received');
      setReceivedReviews(Array.isArray(data?.rows) ? data.rows : []);
      setReceivedReviewSummary({
        count: Number(data?.summary?.count || 0),
        avg: Number(data?.summary?.avg || 0),
      });
    } catch {
      setReceivedReviews([]);
      setReceivedReviewSummary({ count: 0, avg: 0 });
    }
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
    const shipmentIds = (Array.isArray(offersRes.data) ? offersRes.data : [])
      .map((offer) => String(offer?.shipmentId?._id || ''))
      .filter(Boolean);
    await loadReviewStatuses(shipmentIds);
    await loadReceivedReviews();
  };
  const resetAlertForm = () => {
    setAlertEditId('');
    setAlertName('');
    setAlertMode('all');
    setAlertCityId('');
    setAlertDistrict('');
    setAlertLoadTypeSlug('');
  };

  const startEditAlert = (alert: CarrierLoadAlert) => {
    const matchedCityId =
      cities.find(
        (city) =>
          (city.name || '').trim().toLocaleUpperCase('tr-TR') === (alert.city || '').trim().toLocaleUpperCase('tr-TR'),
      )?.id || '';
    setAlertEditId(alert._id);
    setAlertName(alert.name || '');
    setAlertMode(alert.transportMode || 'all');
    setAlertCityId(matchedCityId);
    setAlertDistrict(alert.district || '');
    setAlertLoadTypeSlug(alert.loadTypeSlug || '');
  };

  const refreshCarrierAlerts = async () => {
    const { data } = await api.get<CarrierLoadAlert[]>('/carrier-load-alerts/my');
    setCarrierAlerts(Array.isArray(data) ? data : []);
  };

  const saveCarrierAlert = async () => {
    if (!alertName.trim()) {
      setMessage('Bildirim kuralı adı zorunlu.');
      notifyWarning('Bildirim kuralı adı zorunlu.');
      return;
    }
    setAlertActionLoading('save');
    setMessage('');
    try {
      const payload = {
        name: alertName.trim(),
        transportMode: alertMode,
        city: alertCityName || undefined,
        district: alertDistrict || undefined,
        loadTypeSlug: alertLoadTypeSlug || undefined,
        isActive: true,
      };
      if (alertEditId) {
        await api.patch(`/carrier-load-alerts/${alertEditId}`, payload);
      } else {
        await api.post('/carrier-load-alerts', payload);
      }
      await refreshCarrierAlerts();
      resetAlertForm();
      notifySuccess(alertEditId ? 'Bildirim kuralı güncellendi.' : 'Bildirim kuralı kaydedildi.');
    } catch (error: any) {
      const errText = error?.response?.data?.message || 'Bildirim kurali kaydedilemedi.';
      setMessage(errText);
      notifyError(errText);
    } finally {
      setAlertActionLoading('');
    }
  };

  const toggleCarrierAlert = async (alert: CarrierLoadAlert) => {
    setAlertActionLoading(alert._id);
    setMessage('');
    try {
      await api.patch(`/carrier-load-alerts/${alert._id}`, { isActive: !alert.isActive });
      await refreshCarrierAlerts();
      notifySuccess(`Bildirim ${alert.isActive ? 'pasif' : 'aktif'} edildi.`);
    } catch (error: any) {
      const errText = error?.response?.data?.message || 'Bildirim durumu degistirilemedi.';
      setMessage(errText);
      notifyError(errText);
    } finally {
      setAlertActionLoading('');
    }
  };

  const deleteCarrierAlert = async (alertId: string) => {
    setAlertActionLoading(alertId);
    setMessage('');
    try {
      await api.delete(`/carrier-load-alerts/${alertId}`);
      await refreshCarrierAlerts();
      if (alertEditId === alertId) resetAlertForm();
      notifySuccess('Bildirim kuralı silindi.');
    } catch (error: any) {
      const errText = error?.response?.data?.message || 'Bildirim kurali silinemedi.';
      setMessage(errText);
      notifyError(errText);
    } finally {
      setAlertActionLoading('');
    }
  };

  const refreshShipperData = async () => {
    const shipmentsRes = await api.get<ShipmentsDetailedResponse>('/shipments/my/detailed');
    setData(shipmentsRes.data);
    const shipmentIds = (shipmentsRes.data?.rows || []).map((row) => row._id);
    await loadReviewStatuses(shipmentIds);
    await loadReceivedReviews();
  };

  const withdrawOffer = async (offerId: string) => {
    setOfferActionLoading(offerId);
    setMessage('');
    try {
      await api.patch(`/offers/${offerId}/withdraw`);
      await refreshCarrierData();
      setMessage('Teklif geri cekildi.');
      notifySuccess('Teklif geri çekildi.');
    } catch (error: any) {
      const errText = error?.response?.data?.message || 'Teklif geri cekilemedi.';
      setMessage(errText);
      notifyError(errText);
    } finally {
      setOfferActionLoading('');
    }
  };

  const cancelShipment = async (shipmentId: string) => {
    const ok = await Swal.fire({
      icon: 'warning',
      title: 'İlanı İptal Et',
      text: 'Bu ilan iptal edilecek. Devam etmek istiyor musun?',
      showCancelButton: true,
      confirmButtonText: 'Evet, İptal Et',
      cancelButtonText: 'Vazgeç',
      reverseButtons: true,
    });
    if (!ok.isConfirmed) return;

    setShipmentActionLoading(shipmentId);
    setMessage('');
    try {
      await api.patch(`/shipments/${shipmentId}`, { status: 'cancelled' });
      await refreshShipperData();
      setMessage('Ilan iptal edildi.');
      notifySuccess('İlan iptal edildi.');
    } catch (error: any) {
      const errText = error?.response?.data?.message || 'Ilan iptal edilemedi.';
      setMessage(errText);
      notifyError(errText);
    } finally {
      setShipmentActionLoading('');
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
      notifyWarning('Araç tipi seçmelisiniz.');
      return;
    }
    if (!vehiclePlate.trim()) {
      setVehicleMessage('Plaka zorunlu.');
      notifyWarning('Plaka zorunlu.');
      return;
    }
    if (!vehicleServiceCityId) {
      setVehicleMessage('Hizmet sehri secmelisiniz.');
      notifyWarning('Hizmet şehri seçmelisiniz.');
      return;
    }
    if (!vehicleModes.length) {
      setVehicleMessage('En az bir tasima modu secmelisiniz.');
      notifyWarning('En az bir taşıma modu seçmelisiniz.');
      return;
    }
    if (!vehicleSupportedLoadSlugs.length) {
      setVehicleMessage('En az bir desteklenen yuk tipi secmelisiniz.');
      notifyWarning('En az bir desteklenen yük tipi seçmelisiniz.');
      return;
    }

    const cityName = cities.find((c) => c.id === vehicleServiceCityId)?.name;
    if (!cityName) {
      setVehicleMessage('Hizmet sehri gecersiz.');
      notifyWarning('Hizmet şehri geçersiz.');
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
      notifySuccess('Araç başarıyla eklendi. İnceleme süreci için belge adımına geçebilirsiniz.');
      setActivePanel('vehicle_list');
    } catch (error: any) {
      const errText = error?.response?.data?.message || 'Araç eklenemedi.';
      setVehicleMessage(errText);
      notifyError(errText);
    } finally {
      setVehicleSaving(false);
    }
  };

  const filteredVehicleDocs = useMemo(() => {
    if (!selectedDocVehicleId) return myDocuments.filter((d) => !!d.vehicleId);
    return myDocuments.filter((d) => String(d.vehicleId) === selectedDocVehicleId);
  }, [myDocuments, selectedDocVehicleId]);

  const hasActiveSelectedDocument = useMemo(() => {
    if (!selectedDocVehicleId || !documentType) return false;
    return myDocuments.some((d) => {
      if (String(d.vehicleId) !== selectedDocVehicleId) return false;
      if (d.documentType !== documentType) return false;
      return !['rejected', 'revision_required', 'expired'].includes(String(d.status || ''));
    });
  }, [myDocuments, selectedDocVehicleId, documentType]);

  const submitVehicleDocument = async () => {
    setDocumentMessage('');
    if (!selectedDocVehicleId) {
      setDocumentMessage('Belge yüklenecek aracı seçmelisiniz.');
      notifyWarning('Belge yüklenecek aracı seçmelisiniz.');
      return;
    }
    if (!documentType.trim()) {
      setDocumentMessage('Belge tipi seçmelisiniz.');
      notifyWarning('Belge tipi seçmelisiniz.');
      return;
    }
    if (!documentFile) {
      setDocumentMessage('Dosya seçmelisiniz.');
      notifyWarning('Dosya seçmelisiniz.');
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
      setDocumentMessage('Araç belgesi yüklendi.');
      notifySuccess('Araç belgesi yüklendi.');
    } catch (error: any) {
      const errText = error?.response?.data?.message || 'Belge yüklenemedi.';
      setDocumentMessage(errText);
      notifyError(errText);
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
    panel: 'overview' | 'profile' | 'reviews' | 'shipments' | 'nearby_map' | 'offers' | 'completed_loads' | 'load_alerts' | 'subscriptions' | 'vehicle_add' | 'vehicle_list' | 'vehicle_docs',
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
            {profile?.role === 'carrier' ? 'Yük İşlemleri' : 'Yeni Yük Oluştur'}
          </Link>
          {profile?.role === 'carrier' ? (
            <Link to="/hesabim?panel=vehicle_docs" className="btn btn-primary">
              Araç Belgeleri
            </Link>
          ) : null}
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
                <div className="account-sidebar-rating mt-1">
                  <span className="account-sidebar-rating-chip">
                    <i className="bi bi-chat-left-text" /> {receivedReviewSummary.count} yorum
                  </span>
                  <span className="account-sidebar-rating-chip is-score">
                    <i className="bi bi-star-fill" /> {receivedReviewSummary.count > 0 ? `${receivedReviewSummary.avg.toFixed(1)} puan` : 'Puan yok'}
                  </span>
                </div>
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
                    className={`account-menu-item ${activePanel === 'offers' ? 'is-active' : ''}`}
                    onClick={() => switchPanel('offers')}
                  >
                    <i className="bi bi-receipt" /> Tekliflerim
                  </button>
                  <button
                    type="button"
                    className={`account-menu-item ${activePanel === 'completed_loads' ? 'is-active' : ''}`}
                    onClick={() => switchPanel('completed_loads')}
                  >
                    <i className="bi bi-check2-circle" /> Tamamlanan Yükler
                  </button>
                  <button
                    type="button"
                    className={`account-menu-item ${activePanel === 'nearby_map' ? 'is-active' : ''}`}
                    onClick={() => switchPanel('nearby_map')}
                  >
                    <i className="bi bi-geo-alt" /> Yakinimdaki Yukler
                  </button>
                  <button
                    type="button"
                    className={`account-menu-item ${activePanel === 'load_alerts' ? 'is-active' : ''}`}
                    onClick={() => switchPanel('load_alerts')}
                  >
                    <i className="bi bi-bell" /> Yük Gelince Bildir
                  </button>
                  <button
                    type="button"
                    className={`account-menu-item ${activePanel === 'subscriptions' ? 'is-active' : ''}`}
                    onClick={() => switchPanel('subscriptions')}
                  >
                    <i className="bi bi-credit-card-2-front" /> Abonelik Geçmişi
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
                    className={`account-menu-item ${activePanel === 'vehicle_add' ? 'is-active' : ''}`}
                    onClick={() => switchPanel('vehicle_add')}
                  >
                    <i className="bi bi-plus-circle" /> Araç Ekle
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className={`account-menu-item ${activePanel === 'reviews' ? 'is-active' : ''}`}
                onClick={() => switchPanel('reviews')}
              >
                <i className="bi bi-star" /> Yorumlarim
              </button>
            </div>
            <div className="account-sidebar-actions">
              <Link to="/app" className="btn btn-primary w-100">
                {profile?.role === 'carrier' ? 'Yük İşlemleri' : 'Yeni Yük Oluştur'}
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

                {(profile.personType === 'sole_proprietor' || profile.personType === 'corporate' || profile.companyName || profile.companyTitle) ? (
                  <div className="mt-4 pt-3 border-top">
                    <h6 className="fw-bold mb-3">Sirket Bilgileri</h6>
                    <div className="row g-3">
                      <div className="col-lg-4 col-md-6">
                        <small>Sirket Adi</small>
                        <strong>{profile.companyName || '-'}</strong>
                      </div>
                      <div className="col-lg-4 col-md-6">
                        <small>Sirket Unvani</small>
                        <strong>{profile.companyTitle || '-'}</strong>
                      </div>
                      <div className="col-lg-4 col-md-6">
                        <small>Vergi Numarasi</small>
                        <strong>{profile.taxNumber || '-'}</strong>
                      </div>
                      <div className="col-lg-4 col-md-6">
                        <small>Yetkili Kisi</small>
                        <strong>{profile.authorizedPersonName || '-'}</strong>
                      </div>
                      <div className="col-lg-8 col-md-12">
                        <small>Fatura Adresi</small>
                        <strong>{profile.billingAddress || '-'}</strong>
                      </div>
                    </div>
                  </div>
                ) : null}
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

            </>
          ) : null}
          {profile?.role === 'carrier' && activePanel === 'subscriptions' ? (
            <div className="panel-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0">Abonelik Satin Alma Gecmisi</h4>
                <Link to="/abonelik/plan-1776496671427" className="btn btn-sm btn-outline-primary">
                  Paketi Yukselt
                </Link>
              </div>
              {!subscriptionPurchases.length ? (
                <div className="text-secondary">Henuz satin alma kaydi yok.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Paket</th>
                        <th>Tutar</th>
                        <th>Tarih</th>
                        <th>Islem No</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptionPurchases.map((row) => (
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

          {activePanel === 'profile' && profile ? (
            <div className="panel-card p-4 mb-4 account-edit-shell">
              <div className="account-edit-head mb-3">
                <h4 className="fw-bold mb-1">Profil Duzenle</h4>
                <p className="mb-0">Bilgilerini daha hizli yonetebilmen icin alanlari mantikli gruplara ayirdik.</p>
              </div>

              <div className="account-edit-section mb-3">
                <div className="account-edit-section-title">Temel Bilgiler</div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Ad Soyad</label>
                    <input
                      className="form-control"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      placeholder="Ad Soyad"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Kullanici Tipi</label>
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
                </div>
              </div>

              <div className="account-edit-section mb-3">
                <div className="account-edit-section-title">Iletisim Bilgileri</div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Telefon</label>
                    <input className="form-control" value={profile.phone || ''} disabled />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">E-posta</label>
                    <input className="form-control" value={profile.email || '-'} disabled />
                  </div>
                </div>
              </div>

              <div className="account-edit-section mb-3">
                <div className="account-edit-section-title">Konum</div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Sehir</label>
                    <select
                      className="form-select"
                      value={selectedCityId}
                      onChange={(e) => {
                        setSelectedCityId(e.target.value);
                        setSelectedDistrictName('');
                      }}
                    >
                      <option value="">Sehir seciniz</option>
                      {cities.map((city) => (
                        <option key={city.id} value={city.id}>{city.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Ilce</label>
                    <select
                      className="form-select"
                      value={selectedDistrictName}
                      onChange={(e) => setSelectedDistrictName(e.target.value)}
                      disabled={!selectedCityId}
                    >
                      <option value="">Ilce seciniz</option>
                      {districtOptions.map((district) => (
                        <option key={district.id} value={district.name}>{district.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {profile.role === 'carrier' ? (
                <div className="account-edit-section mb-3">
                  <div className="account-edit-section-title">Tasima Modlari</div>
                  <div className="account-mode-grid">
                    <label className={`account-mode-chip ${editWorkingModes.includes('intracity') ? 'is-active' : ''}`} htmlFor="modeIntracity">
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
                      <span>Sehir Ici</span>
                    </label>
                    <label className={`account-mode-chip ${editWorkingModes.includes('intercity') ? 'is-active' : ''}`} htmlFor="modeIntercity">
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
                      <span>Sehirler Arasi</span>
                    </label>
                  </div>
                </div>
              ) : null}

              {(editPersonType === 'sole_proprietor' || editPersonType === 'corporate') ? (
                <div className="account-edit-section mb-3">
                  <div className="account-edit-section-title">Sirket Bilgileri</div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Sirket Adi</label>
                      <input
                        className="form-control"
                        value={editCompanyName}
                        onChange={(e) => setEditCompanyName(e.target.value)}
                        placeholder="Ornek: Kargo Lojistik"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Sirket Unvani</label>
                      <input
                        className="form-control"
                        value={editCompanyTitle}
                        onChange={(e) => setEditCompanyTitle(e.target.value)}
                        placeholder="Ornek: Kargo Lojistik Tic. Ltd. Sti."
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Vergi Numarasi</label>
                      <input
                        className="form-control"
                        value={editTaxNumber}
                        onChange={(e) => setEditTaxNumber(e.target.value)}
                        placeholder="Vergi numarasi"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Yetkili Kisi</label>
                      <input
                        className="form-control"
                        value={editAuthorizedPersonName}
                        onChange={(e) => setEditAuthorizedPersonName(e.target.value)}
                        placeholder="Ad Soyad"
                      />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label">Fatura Adresi</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={editBillingAddress}
                        onChange={(e) => setEditBillingAddress(e.target.value)}
                        placeholder="Fatura adresi"
                      />
                    </div>
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
          ) : null}

          {activePanel === 'reviews' && profile ? (
            <div className="panel-card p-3 mb-4 received-reviews-shell">
              <div className="received-reviews-head">
                <div>
                  <h5 className="fw-bold mb-1">Aldığım Yorumlar ve Puanlar</h5>
                  <p className="mb-0">Karşı taraftan aldığınız değerlendirmeleri buradan takip edebilirsiniz.</p>
                </div>
                <div className="received-reviews-stats">
                  <span className="received-reviews-stat">
                    <small>Toplam</small>
                    <strong>{receivedReviewSummary.count}</strong>
                  </span>
                  <span className="received-reviews-stat is-score">
                    <small>Ortalama</small>
                    <strong>{receivedReviewSummary.avg > 0 ? `${receivedReviewSummary.avg.toFixed(2)} / 5` : '- / 5'}</strong>
                  </span>
                </div>
              </div>

              <div className="received-reviews-toolbar mb-2">
                <span className="carrier-offers-toolbar-count">{sortedReceivedReviews.length} kayıt</span>
                <select
                  className="form-select form-select-sm received-reviews-sort"
                  value={receivedReviewSort}
                  onChange={(e) =>
                    setReceivedReviewSort(
                      e.target.value as 'newest' | 'oldest' | 'rating_high' | 'rating_low' | 'commented_first',
                    )
                  }
                >
                  <option value="newest">Sıralama: En Yeni</option>
                  <option value="oldest">Sıralama: En Eski</option>
                  <option value="rating_high">Sıralama: Puan (Yüksekten)</option>
                  <option value="rating_low">Sıralama: Puan (Düşükten)</option>
                  <option value="commented_first">Sıralama: Yorumlu Olanlar</option>
                </select>
              </div>

              {sortedReceivedReviews.length === 0 ? (
                <div className="text-secondary">Henüz aldığınız yorum bulunmuyor.</div>
              ) : (
                <div className="received-reviews-list">
                  {sortedReceivedReviews.map((row) => {
                    const reviewerName =
                      typeof row.reviewerUserId === 'string' ? 'Kullanıcı' : row.reviewerUserId?.fullName || 'Kullanıcı';
                    const reviewerRole =
                      typeof row.reviewerUserId === 'string' ? '' : row.reviewerUserId?.role || '';
                    const shipmentObj = typeof row.shipmentId === 'string' ? null : row.shipmentId;
                    const shipmentId = shipmentObj?._id || (typeof row.shipmentId === 'string' ? row.shipmentId : '');
                    const shipmentTitle = shipmentObj?.title || 'İlan';
                    const initials = reviewerName
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p.charAt(0).toLocaleUpperCase('tr-TR'))
                      .join('') || 'K';
                    const rating = Math.max(1, Math.min(5, Number(row.rating || 0) || 0));
                    return (
                      <article key={row._id} className="received-review-card">
                        <div className="received-review-avatar">{initials}</div>
                        <div className="received-review-main">
                          <div className="received-review-top">
                            <div>
                              <strong>{reviewerName}</strong>
                              <span className="received-review-role">{roleLabel(reviewerRole)}</span>
                            </div>
                            <div className="received-review-stars" aria-label={`${rating} yıldız`}>
                              {'★'.repeat(rating)}
                              {'☆'.repeat(Math.max(0, 5 - rating))}
                            </div>
                          </div>
                          <div className="received-review-comment">{row.comment?.trim() || 'Yorum bırakılmadı.'}</div>
                          <div className="received-review-meta">
                            <span>
                              <i className="bi bi-calendar3" />{' '}
                              {row.createdAt ? new Date(row.createdAt).toLocaleString('tr-TR') : '-'}
                            </span>
                            {shipmentId ? (
                              <Link to={`/hesabim/yuk/${shipmentId}`} className="received-review-shipment-link">
                                <i className="bi bi-box-seam" /> {shipmentTitle}
                              </Link>
                            ) : (
                              <span>
                                <i className="bi bi-box-seam" /> {shipmentTitle}
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {profile?.role === 'shipper' && activePanel === 'shipments' ? (
            <div className="panel-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0">Oluşturdugum Yükler</h4>
                <span className="text-secondary small">Son {latestShipments.length} kayit</span>
              </div>
              <div className="carrier-tabs mb-3">
                <button type="button" className={`carrier-tab-btn ${shipperShipmentTab === 'all' ? 'is-active' : ''}`} onClick={() => setShipperShipmentTab('all')}>
                  Tumu <span className="carrier-tab-count">{latestShipments.length}</span>
                </button>
                <button type="button" className={`carrier-tab-btn ${shipperShipmentTab === 'open_pool' ? 'is-active' : ''}`} onClick={() => setShipperShipmentTab('open_pool')}>
                  Aktif İlanlar <span className="carrier-tab-count">{latestShipments.filter((x) => ['published', 'offer_collecting'].includes(x.status) && !isExpiredUnassignedShipment(x)).length}</span>
                </button>
                <button type="button" className={`carrier-tab-btn ${shipperShipmentTab === 'matched' ? 'is-active' : ''}`} onClick={() => setShipperShipmentTab('matched')}>
                  Eslesen <span className="carrier-tab-count">{latestShipments.filter((x) => x.status === 'matched').length}</span>
                </button>
                <button type="button" className={`carrier-tab-btn ${shipperShipmentTab === 'completed' ? 'is-active' : ''}`} onClick={() => setShipperShipmentTab('completed')}>
                  Tamamlanan <span className="carrier-tab-count">{latestShipments.filter((x) => x.status === 'completed').length}</span>
                </button>
                <button type="button" className={`carrier-tab-btn ${shipperShipmentTab === 'expired' ? 'is-active' : ''}`} onClick={() => setShipperShipmentTab('expired')}>
                  Süresi Biten <span className="carrier-tab-count">{latestShipments.filter((x) => isExpiredUnassignedShipment(x)).length}</span>
                </button>
                <button type="button" className={`carrier-tab-btn ${shipperShipmentTab === 'cancelled' ? 'is-active' : ''}`} onClick={() => setShipperShipmentTab('cancelled')}>
                  Iptal <span className="carrier-tab-count">{latestShipments.filter((x) => x.status === 'cancelled').length}</span>
                </button>
                <button type="button" className={`carrier-tab-btn ${shipperShipmentTab === 'other' ? 'is-active' : ''}`} onClick={() => setShipperShipmentTab('other')}>
                  Diger <span className="carrier-tab-count">{latestShipments.filter((x) => !['published', 'offer_collecting', 'matched', 'completed', 'cancelled'].includes(x.status)).length}</span>
                </button>
              </div>
              <div className="carrier-offers-toolbar mb-3">
                <span className="carrier-offers-toolbar-count">{sortedShipperShipments.length} kayit</span>
                <select
                  className="form-select form-select-sm shipper-shipments-sort"
                  value={shipperShipmentSort}
                  onChange={(e) => setShipperShipmentSort(e.target.value as 'newest' | 'oldest' | 'offers_high' | 'offers_low' | 'title')}
                >
                  <option value="newest">Siralama: En Yeni</option>
                  <option value="oldest">Siralama: En Eski</option>
                  <option value="offers_high">Siralama: Teklif (Yuksekten)</option>
                  <option value="offers_low">Siralama: Teklif (Dusukten)</option>
                  <option value="title">Siralama: Basliga Gore</option>
                </select>
              </div>
              {sortedShipperShipments.length === 0 ? (
                <div className="text-secondary">Henuz olusturulmus yuk bulunmuyor.</div>
              ) : (
                <div className="shipper-shipment-premium-list">
                  {sortedShipperShipments.map((item) => {
                    const isExpired = isExpiredUnassignedShipment(item);
                    const hasOffer = Number(item.offerStats?.total || 0) > 0;
                    const canCancelOpenWithOffer = ['published', 'offer_collecting'].includes(item.status) && hasOffer;
                    const canEdit = !['matched', 'completed', 'cancelled'].includes(item.status) && !canCancelOpenWithOffer && !isExpired;
                    const canRepublish = item.status === 'cancelled' || isExpired;
                    const canCancel = canCancelOpenWithOffer || isExpired;
                    return (
                      <article key={item._id} className="shipper-shipment-premium-card">
                        <div className="shipper-shipment-premium-main">
                          <div className="shipper-shipment-premium-top">
                            <h5 className="mb-0">{item.title || '-'}</h5>
                            <span className={`shipment-status-pill ${shipmentListStatusTone(item)}`}>
                              {shipmentListStatusLabel(item)}
                            </span>
                          </div>
                          <div className="shipper-shipment-premium-meta">
                            <span><i className="bi bi-geo-alt"></i> {`${item.pickupCity || '-'} / ${item.dropoffCity || '-'}`}</span>
                            <span><i className="bi bi-signpost-2"></i> {modeLabel(item.transportMode)}</span>
                            <span><i className="bi bi-cash-stack"></i> Teklif: {item.offerStats?.total ?? 0}</span>
                            <span><i className="bi bi-calendar3"></i> {new Date(item.createdAt).toLocaleDateString('tr-TR')}</span>
                          </div>
                          <div className="mt-2">{getReviewBadge(item._id, item.status)}</div>
                        </div>
                        <div className="shipper-shipment-premium-actions">
                          <Link className="btn btn-sm btn-outline-primary" to={`/hesabim/yuk/${item._id}`}>
                            Detay
                          </Link>
                          {item.status === 'completed' ? (
                            <Link className="btn btn-sm btn-outline-success" to={`/hesabim/yuk/${item._id}`}>
                              Yorum Yap
                            </Link>
                          ) : null}
                          {canEdit ? (
                            <Link className="btn btn-sm btn-outline-secondary" to={`/hesabim/yuk/${item._id}/duzenle`}>
                              Duzenle
                            </Link>
                          ) : null}
                          {canCancel ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={shipmentActionLoading === item._id}
                              onClick={() => void cancelShipment(item._id)}
                            >
                              {shipmentActionLoading === item._id ? 'Isleniyor...' : 'Iptal Et'}
                            </button>
                          ) : null}
                          {canRepublish ? (
                            <Link className="btn btn-sm btn-primary" to={`/app?tekrar=${item._id}`}>
                              Kopyala ve Yeniden Yayinla
                            </Link>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
          {profile?.role === 'shipper' && activePanel === 'overview' ? (
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
                          <td>
                            <div>{item.title}</div>
                            <div className="mt-1">{getReviewBadge(item._id, item.status)}</div>
                          </td>
                          <td>
                            <span className={`shipment-status-pill ${shipmentListStatusTone(item)}`}>
                              {shipmentListStatusLabel(item)}
                            </span>
                          </td>
                          <td>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</td>
                          <td className="text-end">
                            <div className="d-flex gap-2 justify-content-end">
                              <Link className="btn btn-sm btn-outline-primary" to={`/hesabim/yuk/${item._id}`}>Detay</Link>
                              {item.status === 'completed' ? (
                                <Link className="btn btn-sm btn-outline-success" to={`/hesabim/yuk/${item._id}`}>Yorum Yap</Link>
                              ) : null}
                              {!['matched', 'completed', 'cancelled'].includes(item.status) && !(Number(item.offerStats?.total || 0) > 0 && ['published', 'offer_collecting'].includes(item.status)) && !isExpiredUnassignedShipment(item) ? (
                                <Link className="btn btn-sm btn-outline-secondary" to={`/hesabim/yuk/${item._id}/duzenle`}>Duzenle</Link>
                              ) : null}
                              {(Number(item.offerStats?.total || 0) > 0 && ['published', 'offer_collecting'].includes(item.status)) || isExpiredUnassignedShipment(item) ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  disabled={shipmentActionLoading === item._id}
                                  onClick={() => void cancelShipment(item._id)}
                                >
                                  {shipmentActionLoading === item._id ? 'Isleniyor...' : 'Iptal Et'}
                                </button>
                              ) : null}
                              {item.status === 'cancelled' || isExpiredUnassignedShipment(item) ? (
                                <Link className="btn btn-sm btn-primary" to={`/app?tekrar=${item._id}`}>
                                  Kopyala ve Yeniden Yayinla
                                </Link>
                              ) : null}
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

          {profile?.role === 'carrier' && activePanel === 'nearby_map' ? (
            <NearbyLoadsMapPanel
              loads={carrierFeed}
              onOpenDetail={(shipmentId) => navigate(`/hesabim/yuk/${shipmentId}`)}
            />
          ) : null}
          {profile?.role === 'carrier' && activePanel === 'load_alerts' ? (
            <div className="d-grid gap-3">
              <div className="panel-card p-4 carrier-alert-form-card">
                <div className="carrier-alert-form-head d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h4 className="fw-bold mb-1">
                      <i className="bi bi-bell-fill me-2 text-primary"></i>
                      {alertEditId ? 'Bildirim Kuralını Düzenle' : 'Yeni Bildirim Kuralı'}
                    </h4>
                    <p className="text-secondary mb-0">
                      Yeni bir yük yayınlandığında sana hangi kriterlerde bildirim gelsin belirle.
                    </p>
                  </div>
                  {alertEditId ? (
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetAlertForm}>
                      Düzenlemeyi İptal Et
                    </button>
                  ) : null}
                </div>

                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Kural Adı</label>
                    <input
                      className="form-control shipment-input carrier-alert-input"
                      placeholder="Örn: İstanbul içi soğuk zincir"
                      value={alertName}
                      onChange={(e) => setAlertName(e.target.value)}
                    />
                    <small className="text-secondary">Kurala kısa ve ayırt edici bir isim ver.</small>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label fw-semibold">Taşıma Modu</label>
                    <select className="form-select shipment-input carrier-alert-input" value={alertMode} onChange={(e) => setAlertMode(e.target.value as 'all' | 'intracity' | 'intercity')}>
                      <option value="all">Tümü</option>
                      <option value="intracity">Şehir İçi</option>
                      <option value="intercity">Şehirler Arası</option>
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label fw-semibold">İl</label>
                    <select className="form-select shipment-input carrier-alert-input" value={alertCityId} onChange={(e) => setAlertCityId(e.target.value)}>
                      <option value="">Tüm İller</option>
                      {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label fw-semibold">İlçe</label>
                    <select
                      className="form-select shipment-input carrier-alert-input"
                      value={alertDistrict}
                      onChange={(e) => setAlertDistrict(e.target.value)}
                      disabled={!alertCityId}
                    >
                      <option value="">Tüm İlçeler</option>
                      {alertDistrictOptions.map((district) => <option key={district.id} value={district.name}>{district.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label fw-semibold">Yük Tipi</label>
                    <select
                      className="form-select shipment-input carrier-alert-input"
                      value={alertLoadTypeSlug}
                      onChange={(e) => setAlertLoadTypeSlug(e.target.value)}
                    >
                      <option value="">Tüm Yük Tipleri</option>
                      {loadTypeOptions.map((loadType) => (
                        <option key={loadType.key} value={loadType.key}>
                          {loadType.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="carrier-alert-preview mt-3">
                  <span className="carrier-alert-preview-label">Önizleme:</span>
                  <span className="badge text-bg-light">Mod: {alertMode === 'all' ? 'Tümü' : modeLabel(alertMode)}</span>
                  <span className="badge text-bg-light">İl: {alertCityName || 'Tüm İller'}</span>
                  <span className="badge text-bg-light">İlçe: {alertDistrict || 'Tüm İlçeler'}</span>
                  <span className="badge text-bg-light">
                    Yük: {alertLoadTypeSlug ? (loadTypeLabelMap[alertLoadTypeSlug] || alertLoadTypeSlug) : 'Tüm Yük Tipleri'}
                  </span>
                </div>

                <div className="carrier-alert-form-actions mt-3 d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary px-4"
                    disabled={alertActionLoading === 'save'}
                    onClick={() => void saveCarrierAlert()}
                  >
                    {alertActionLoading === 'save' ? 'Kaydediliyor...' : alertEditId ? 'Güncelle' : 'Kuralı Kaydet'}
                  </button>
                  {!alertEditId ? (
                    <button type="button" className="btn btn-light border px-3" onClick={resetAlertForm}>
                      Temizle
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="panel-card p-4 carrier-alert-list-card">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h4 className="fw-bold mb-0">Kayıtlı Bildirim Kuralları</h4>
                  <span className="badge text-bg-light fs-6">{carrierAlerts.length} adet</span>
                </div>
                {carrierAlerts.length === 0 ? (
                  <div className="carrier-alert-empty text-secondary">
                    <i className="bi bi-bell-slash me-2"></i>
                    Henüz bildirim kuralı eklenmedi.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle carrier-alert-table">
                      <thead>
                        <tr>
                          <th>Kural</th>
                          <th>Filtre</th>
                          <th>Durum</th>
                          <th className="text-end">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {carrierAlerts.map((alert) => (
                          <tr key={alert._id}>
                            <td>
                              <div className="fw-semibold">{alert.name}</div>
                              <small className="text-secondary">{alert.createdAt ? new Date(alert.createdAt).toLocaleString('tr-TR') : '-'}</small>
                            </td>
                            <td>
                              <span className="badge text-bg-light me-1">
                                {alert.transportMode === 'all' ? 'Tümü' : modeLabel(alert.transportMode)}
                              </span>
                              {alert.city ? <span className="badge text-bg-light me-1">{alert.city}</span> : null}
                              {alert.district ? <span className="badge text-bg-light me-1">{alert.district}</span> : null}
                              {alert.loadTypeSlug ? (
                                <span className="badge text-bg-light">
                                  {loadTypeLabelMap[alert.loadTypeSlug] || alert.loadTypeSlug}
                                </span>
                              ) : null}
                            </td>
                            <td>
                              <span className={`badge ${alert.isActive ? 'text-bg-success' : 'text-bg-secondary'}`}>
                                {alert.isActive ? 'Aktif' : 'Pasif'}
                              </span>
                            </td>
                            <td className="text-end">
                              <div className="d-inline-flex gap-2">
                                <button type="button" className="btn btn-sm btn-outline-primary px-3" onClick={() => startEditAlert(alert)}>
                                  Düzenle
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-warning px-3"
                                  disabled={alertActionLoading === alert._id}
                                  onClick={() => void toggleCarrierAlert(alert)}
                                >
                                  {alert.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger px-3"
                                  disabled={alertActionLoading === alert._id}
                                  onClick={() => void deleteCarrierAlert(alert._id)}
                                >
                                  Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
              {myVehicles.length === 0 ? (
                <div className="text-secondary">Henuz arac kaydi yok.</div>
              ) : (
                <div className="vehicle-premium-list">
                  {myVehicles.map((v) => (
                    <article key={v._id} className="vehicle-premium-card">
                      <div className="vehicle-premium-main">
                        <div className="vehicle-premium-top">
                          <div>
                            <strong className="vehicle-premium-title">{v.vehicleTypeId?.name || 'Araç'}</strong>
                            <div className="vehicle-premium-plate">{v.plateMasked || '-'}</div>
                          </div>
                          <span className={`shipment-status-pill ${vehicleStatusPillTone(v.status)}`}>
                            {vehicleStatusLabel(v.status)}
                          </span>
                        </div>
                        <div className="vehicle-premium-meta">
                          <span><i className="bi bi-truck" /> Marka / Model: {`${v.brand || '-'} ${v.model || ''}`.trim()}</span>
                        </div>
                      </div>
                      <div className="vehicle-premium-actions">
                        <Link className="btn btn-sm btn-outline-primary" to={`/hesabim/arac/${v._id}`}>Detay</Link>
                        <Link className="btn btn-sm btn-outline-secondary" to={`/hesabim/arac/${v._id}/duzenle`}>Duzenle</Link>
                        <Link
                          className="btn btn-sm btn-primary"
                          to={`/hesabim?panel=vehicle_docs&vehicleId=${encodeURIComponent(v._id)}`}
                        >
                          Belge Ekle
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
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
                  <div className="d-flex gap-2 align-items-center vehicle-doc-upload-row">
                    <input
                      className="form-control"
                      type="file"
                      disabled={hasActiveSelectedDocument}
                      onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                    />
                    {!hasActiveSelectedDocument ? (
                      <button
                        type="button"
                        className="btn btn-primary flex-shrink-0"
                        disabled={documentUploading}
                        onClick={() => void submitVehicleDocument()}
                      >
                        {documentUploading ? 'Yükleniyor...' : 'Dosyayı Gönder'}
                      </button>
                    ) : (
                      <span className="badge text-bg-success flex-shrink-0">Seçilen belge zaten yüklü</span>
                    )}
                  </div>
                </div>
                <div className="col-12 d-flex gap-2 align-items-center">
                  {documentMessage ? <span className="text-secondary small">{documentMessage}</span> : null}
                </div>
              </div>
              {filteredVehicleDocs.length === 0 ? (
                <div className="text-secondary">Secilen araca ait belge kaydi yok.</div>
              ) : (
                <div className="vehicle-doc-premium-list">
                  {filteredVehicleDocs.map((doc) => (
                    <article key={doc._id} className="vehicle-doc-premium-card">
                      <div className="vehicle-doc-premium-main">
                        <div className="vehicle-doc-premium-top">
                          <strong>{vehicleDocumentTypeLabel(doc.documentType)}</strong>
                          <span className={`shipment-status-pill ${vehicleDocumentStatusPillTone(doc.status)}`}>
                            {vehicleDocumentStatusLabel(doc.status)}
                          </span>
                        </div>
                        <div className="vehicle-doc-premium-meta">
                          <span><i className="bi bi-truck" /> {myVehicles.find((v) => v._id === String(doc.vehicleId))?.plateMasked || '-'}</span>
                          <span><i className="bi bi-calendar3" /> {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('tr-TR') : '-'}</span>
                        </div>
                      </div>
                      <div className="vehicle-doc-premium-actions">
                        {doc.fileUrl ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                setPreviewUrl(toAbsoluteAssetUrl(doc.fileUrl));
                                setPreviewTitle(`${vehicleDocumentTypeLabel(doc.documentType)} - ${myVehicles.find((v) => v._id === String(doc.vehicleId))?.plateMasked || 'Belge'}`);
                              }}
                            >
                              Onizle
                            </button>
                            <a href={toAbsoluteAssetUrl(doc.fileUrl)} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary">Ac</a>
                          </>
                        ) : (
                          <span className="text-secondary small">Dosya yok</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
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
              <div className="carrier-offers-toolbar mb-3">
                <span className="carrier-offers-toolbar-count">{sortedCarrierOffers.length} kayit</span>
                <select
                  className="form-select form-select-sm carrier-offers-sort"
                  value={carrierOfferSort}
                  onChange={(e) => setCarrierOfferSort(e.target.value as 'newest' | 'oldest' | 'price_high' | 'price_low' | 'status')}
                >
                  <option value="newest">Siralama: En Yeni</option>
                  <option value="oldest">Siralama: En Eski</option>
                  <option value="price_high">Siralama: Fiyat (Yuksekten)</option>
                  <option value="price_low">Siralama: Fiyat (Dusukten)</option>
                  <option value="status">Siralama: Duruma Gore</option>
                </select>
              </div>
              {sortedCarrierOffers.length === 0 ? (
                <div className="text-secondary">Henuz teklif kaydiniz yok.</div>
              ) : (
                <div className="carrier-offers-premium-list">
                  {sortedCarrierOffers.map((offer) => (
                    <article key={offer._id} className="carrier-offers-premium-card">
                      <div className="carrier-offers-premium-main">
                        <div className="carrier-offers-premium-top">
                          <div>
                            <strong className="carrier-offers-premium-title">{offer.shipmentId?.title || '-'}</strong>
                            <div className="carrier-offers-premium-route">
                              {`${offer.shipmentId?.pickupCity || '-'} / ${offer.shipmentId?.dropoffCity || '-'}`}
                            </div>
                          </div>
                          <span className={`shipment-status-pill ${offerStatusPillTone(offer.status)}`}>
                            {offerStatusLabel(offer.status)}
                          </span>
                        </div>

                        <div className="carrier-offers-premium-meta">
                          <span>
                            <i className="bi bi-truck" /> {offer.vehicleId?.plateMasked || '-'} {offer.vehicleId?.brand || ''}
                          </span>
                          <span>
                            <i className="bi bi-calendar3" /> {offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('tr-TR') : '-'}
                          </span>
                        </div>

                        <div className="mt-2">{getReviewBadge(offer.shipmentId?._id, offer.shipmentId?.status)}</div>
                      </div>

                      <div className="carrier-offers-premium-right">
                        <strong className="carrier-offers-price">{formatTryPrice(offer.price)}</strong>
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
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          {profile?.role === 'carrier' && activePanel === 'completed_loads' ? (
            <div className="panel-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0">Tamamlanan Yükler</h4>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void refreshCarrierData()}>
                  Yenile
                </button>
              </div>
              <div className="carrier-offers-toolbar mb-3">
                <span className="carrier-offers-toolbar-count">{sortedCarrierCompletedOffers.length} kayit</span>
                <select
                  className="form-select form-select-sm carrier-offers-sort"
                  value={carrierCompletedSort}
                  onChange={(e) => setCarrierCompletedSort(e.target.value as 'newest' | 'oldest' | 'price_high' | 'price_low' | 'title')}
                >
                  <option value="newest">Siralama: En Yeni</option>
                  <option value="oldest">Siralama: En Eski</option>
                  <option value="price_high">Siralama: Fiyat (Yuksekten)</option>
                  <option value="price_low">Siralama: Fiyat (Dusukten)</option>
                  <option value="title">Siralama: Basliga Gore</option>
                </select>
              </div>
              {sortedCarrierCompletedOffers.length === 0 ? (
                <div className="text-secondary">Henuz tamamlanan yük kaydiniz yok.</div>
              ) : (
                <div className="carrier-offers-premium-list">
                  {sortedCarrierCompletedOffers.map((offer) => (
                    <article key={offer._id} className="carrier-offers-premium-card">
                      <div className="carrier-offers-premium-main">
                        <div className="carrier-offers-premium-top">
                          <div>
                            <strong className="carrier-offers-premium-title">{offer.shipmentId?.title || '-'}</strong>
                            <div className="carrier-offers-premium-route">
                              {`${offer.shipmentId?.pickupCity || '-'} / ${offer.shipmentId?.dropoffCity || '-'}`}
                            </div>
                          </div>
                          <span className={`shipment-status-pill ${shipmentStatusPillTone('completed')}`}>
                            Tamamlandi
                          </span>
                        </div>
                        <div className="carrier-offers-premium-meta">
                          <span>
                            <i className="bi bi-truck" /> {offer.vehicleId?.plateMasked || '-'} {offer.vehicleId?.brand || ''}
                          </span>
                          <span>
                            <i className="bi bi-calendar3" /> {offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('tr-TR') : '-'}
                          </span>
                        </div>
                        <div className="mt-2">{getReviewBadge(offer.shipmentId?._id, offer.shipmentId?.status)}</div>
                      </div>
                      <div className="carrier-offers-premium-right">
                        <strong className="carrier-offers-price">{formatTryPrice(offer.price)}</strong>
                        {offer.shipmentId?._id ? (
                          <Link to={`/hesabim/yuk/${offer.shipmentId._id}`} className="btn btn-sm btn-outline-primary">
                            Ilan Detayi
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <MediaLightbox open={Boolean(previewUrl)} url={previewUrl} title={previewTitle} onClose={() => setPreviewUrl('')} />
        </div>
      </div>
    </section>
  );
}












