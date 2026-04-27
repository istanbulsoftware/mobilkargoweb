import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import Swal from 'sweetalert2';
import { MediaLightbox } from '../components/MediaLightbox';
import { NearbyLoadsMapPanel } from '../components/NearbyLoadsMapPanel';
import { api, apiOrigin } from '../lib/api';

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
  quickModeCargoTypeSlugs?: string[];
  quickModeCargoTypes?: CargoTypeOption[];
};

type CarrierFeedShipment = {
  _id: string;
  title: string;
  status?: string;
  description?: string;
  loadTypeSlug?: string;
  cargoTypeId?: string | { _id?: string; slug?: string; name?: string };
  offerCount?: number;
  transportMode: 'intracity' | 'intercity';
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
  pickupGeo?: { type?: 'Point'; coordinates?: [number, number] };
  dropoffGeo?: { type?: 'Point'; coordinates?: [number, number] };
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

type CarrierJobShipment = {
  _id?: string;
  title?: string;
  status?: string;
  transportMode?: 'intracity' | 'intercity';
  pickupCity?: string;
  pickupDistrict?: string;
  dropoffCity?: string;
  dropoffDistrict?: string;
  scheduledPickupAt?: string;
  createdAt?: string;
};

type CarrierJobRow = {
  jobBucket: 'upcoming' | 'active' | 'past';
  offerId: string;
  offerStatus: string;
  acceptedAt?: string;
  price?: number;
  shipment?: CarrierJobShipment;
  vehicle?: { _id?: string; plateMasked?: string; brand?: string; model?: string };
};

type CarrierJobsResponse = {
  summary: {
    totalAccepted: number;
    upcoming: number;
    active: number;
    past: number;
  };
  upcoming: CarrierJobRow[];
  active: CarrierJobRow[];
  past: CarrierJobRow[];
};

type AppConversationMessage = {
  _id: string;
  conversationId?: string;
  senderUserId?: string | { _id?: string; fullName?: string };
  text?: string;
  createdAt?: string;
};

type LookupLoadType = {
  key: string;
  label: string;
};

type PlaceSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

type RouteSummaryInfo = {
  distanceKm: number;
  durationMin: number;
  durationBaseMin?: number;
  durationMultiplier?: number;
  summary: string;
  polyline?: string;
};

type ResolvedLocationInfo = {
  cityName: string;
  districtName: string;
  formattedAddress: string;
  lat?: number;
  lng?: number;
};

type RegisterContractComplianceItem = {
  _id: string;
  slug: string;
  title: string;
  summary?: string;
  isRequiredOnRegister?: boolean;
  updatedAt?: string | null;
  latestAcceptedAt?: string | null;
  needsAcceptance?: boolean;
};

type RegisterContractComplianceResponse = {
  role?: 'shipper' | 'carrier';
  compliant?: boolean;
  pendingCount?: number;
  pendingContracts?: RegisterContractComplianceItem[];
};

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

const MODE_LABEL: Record<'intracity' | 'intercity', string> = {
  intracity: 'Şehir İçi',
  intercity: 'Şehirler Arası',
};

const SHIPMENT_COMPLAINT_REASONS: Array<{ value: string; label: string }> = [
  { value: 'shipment_fraud', label: 'Sahte / yanıltıcı ilan' },
  { value: 'shipment_wrong_info', label: 'İlan bilgileri hatalı' },
  { value: 'shipment_spam_duplicate', label: 'Spam / mükerrer ilan' },
  { value: 'shipment_illegal_prohibited', label: 'Yasak / uygunsuz içerik' },
  { value: 'shipment_contact_abuse', label: 'Taciz / uygunsuz iletişim' },
  { value: 'shipment_other', label: 'Diğer' },
];

const OFFER_TABS = [
  { key: 'pool', label: 'Yük Havuzu' },
  { key: 'nearby_map', label: 'Haritada Göster' },
  { key: 'active_jobs', label: 'Aktif Taşımalar' },
  { key: 'offered', label: 'Teklif Verdiğim İlanlar' },
  { key: 'offers', label: 'Teklif Kayıtlarım' },
] as const;

const EMPTY_CARRIER_JOBS: CarrierJobsResponse = {
  summary: { totalAccepted: 0, upcoming: 0, active: 0, past: 0 },
  upcoming: [],
  active: [],
  past: [],
};

const normalizeCarrierJobs = (raw?: Partial<CarrierJobsResponse> | null): CarrierJobsResponse => ({
  summary: {
    totalAccepted: Number(raw?.summary?.totalAccepted || 0),
    upcoming: Number(raw?.summary?.upcoming || 0),
    active: Number(raw?.summary?.active || 0),
    past: Number(raw?.summary?.past || 0),
  },
  upcoming: Array.isArray(raw?.upcoming) ? raw.upcoming : [],
  active: Array.isArray(raw?.active) ? raw.active : [],
  past: Array.isArray(raw?.past) ? raw.past : [],
});

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
const formatTryCurrency = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
};
const offerStatusLabel = (status?: string) => {
  const map: Record<string, string> = {
    submitted: 'Gönderildi',
    updated: 'Güncellendi',
    accepted: 'Kabul Edildi',
    rejected: 'Reddedildi',
    withdrawn: 'Geri Çekildi',
    cancelled: 'İptal',
    expired: 'Süresi Doldu',
  };
  return map[status || ''] || status || '-';
};

const offerStatusPillTone = (status?: string) => {
  if (status === 'accepted') return 'tone-success';
  if (['rejected', 'withdrawn', 'cancelled', 'expired'].includes(status || '')) return 'tone-danger';
  if (['submitted', 'updated'].includes(status || '')) return 'tone-warning';
  return 'tone-neutral';
};

const trUpper = (value?: string) => (value || '').trim().toLocaleUpperCase('tr-TR');

const getDurationMultiplierByVehicle = (vehicleSlug?: string, vehicleName?: string) => {
  const haystack = `${vehicleSlug || ''} ${vehicleName || ''}`.toLocaleLowerCase('tr-TR');
  if (!haystack.trim()) return 1;
  // Kamyon operasyonu şehir içi/dışı ortalama hız farkı nedeniyle süreyi yükseltir.
  if (/\bkamyon\b/u.test(haystack)) return 1.22;
  return 1;
};

const buildDistrictCandidates = (districtName?: string) => {
  if (!districtName) return [];
  const normalized = trUpper(districtName);
  const cleaned = normalized
    .replace(/^ILCESI\s+/g, '')
    .replace(/\s+ILCESI$/g, '')
    .replace(/\s+MERKEZ$/g, '')
    .replace(/^MERKEZ\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const compact = cleaned.replace(/\s+/g, '');
  return Array.from(new Set([normalized, cleaned, compact]));
};

const toRad = (deg: number) => (deg * Math.PI) / 180;
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getShipmentPickupLatLng = (shipment: CarrierFeedShipment): { lat: number; lng: number } | null => {
  const coords = shipment.pickupGeo?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

export function AppPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem('an_user_token');
  const queryTab = (searchParams.get('tab') || '').trim();
  const queryConversationId = (searchParams.get('conversationId') || '').trim();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const notifyError = (text: string) => {
    void Swal.fire({ icon: 'error', title: 'Hata', text, confirmButtonText: 'Tamam' });
  };
  const notifySuccess = (text: string) => {
    void Swal.fire({ icon: 'success', title: 'Başarılı', text, confirmButtonText: 'Tamam' });
  };
  const notifyWarning = (text: string) => {
    void Swal.fire({ icon: 'warning', title: 'Uyarı', text, confirmButtonText: 'Tamam' });
  };
  const askUpdatedRegisterContractsConsent = async (items: RegisterContractComplianceItem[]) => {
    if (!items.length) return [];

    const contractRows = items
      .map((item, index) => {
        const requiredBadge = item.isRequiredOnRegister
          ? '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:#ffe8c2;color:#8a5c00;font-weight:700;">Zorunlu</span>'
          : '<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:#e9f4ff;color:#22598a;font-weight:700;">Opsiyonel</span>';
        return `
          <div style="padding:10px 12px;border:1px solid #e8eaf1;border-radius:12px;margin-bottom:10px;">
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
              <input type="checkbox" class="updated-contract-check" data-contract-slug="${item.slug}" checked />
              <span style="display:block;text-align:left;">
                <span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <strong>${index + 1}. ${item.title}</strong>
                  ${requiredBadge}
                </span>
                ${item.summary ? `<small style="display:block;color:#5b6475;margin-top:2px;">${item.summary}</small>` : ''}
                <a href="/content/${item.slug}" target="_blank" rel="noreferrer" style="font-size:12px;">Metni görüntüle</a>
              </span>
            </label>
          </div>
        `;
      })
      .join('');

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Sözleşmeler Güncellendi',
      html: `
        <div style="text-align:left">
          <p style="margin-bottom:12px;">Yük işlemlerine devam etmek için güncellenen sözleşmeleri tekrar onaylamanız gerekiyor.</p>
          ${contractRows}
        </div>
      `,
      showCancelButton: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
      confirmButtonText: 'Onayla ve Devam Et',
      cancelButtonText: 'Çıkış Yap',
      preConfirm: () => {
        const checked = Array.from(document.querySelectorAll<HTMLInputElement>('.updated-contract-check:checked')).map(
          (el) => String(el.dataset.contractSlug || '').trim(),
        );
        const allPendingSlugs = items.map((item) => item.slug).filter(Boolean);
        const missingAny = allPendingSlugs.filter((slug) => !checked.includes(slug));
        if (missingAny.length) {
          Swal.showValidationMessage('Devam etmek için güncellenen tüm sözleşmeleri onaylamalısınız.');
          return null;
        }
        return checked.filter(Boolean);
      },
    });

    if (!result.isConfirmed) return null;
    return Array.isArray(result.value) ? result.value : [];
  };
  const openShipmentComplaintModal = async (shipment: CarrierFeedShipment) => {
    const optionsHtml = SHIPMENT_COMPLAINT_REASONS.map(
      (item) => `<option value="${item.value}">${item.label}</option>`,
    ).join('');

    const result = await Swal.fire({
      title: 'İlanı Şikayet Et',
      html: `
        <div style="text-align:left;display:flex;flex-direction:column;gap:10px;">
          <label for="shipment-complaint-reason" style="font-weight:600;">Şikayet Konusu</label>
          <select id="shipment-complaint-reason" class="swal2-input" style="margin:0;width:100%;">
            <option value="">Lütfen seçiniz</option>
            ${optionsHtml}
          </select>
          <label for="shipment-complaint-description" style="font-weight:600;">Açıklama</label>
          <textarea id="shipment-complaint-description" class="swal2-textarea" style="margin:0;width:100%;" maxlength="600" placeholder="Şikayet sebebinizi kısa ve net şekilde yazın"></textarea>
        </div>
      `,
      confirmButtonText: 'Şikayeti Gönder',
      cancelButtonText: 'Vazgeç',
      showCancelButton: true,
      focusConfirm: false,
      preConfirm: () => {
        const reasonEl = document.getElementById('shipment-complaint-reason') as HTMLSelectElement | null;
        const descEl = document.getElementById('shipment-complaint-description') as HTMLTextAreaElement | null;
        const reasonType = reasonEl?.value?.trim() || '';
        const description = descEl?.value?.trim() || '';
        if (!reasonType) {
          Swal.showValidationMessage('Lütfen şikayet konusu seçiniz.');
          return null;
        }
        if (description.length < 5) {
          Swal.showValidationMessage('Açıklama en az 5 karakter olmalı.');
          return null;
        }
        return { reasonType, description };
      },
    });

    if (!result.isConfirmed || !result.value) return;
    try {
      await api.post(`/shipments/${shipment._id}/complaints`, result.value);
      notifySuccess('Şikayetiniz alındı. İnceleme sonrası değerlendirilecektir.');
    } catch (error: any) {
      const errText = error?.response?.data?.message || 'Şikayet gönderilemedi.';
      notifyError(errText);
    }
  };
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [registerContractPending, setRegisterContractPending] = useState<RegisterContractComplianceItem[]>([]);
  const [registerContractChecking, setRegisterContractChecking] = useState(false);
  const [registerContractSaving, setRegisterContractSaving] = useState(false);

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

  const [originCityId, setOriginCityId] = useState('');
  const [originDistrict, setOriginDistrict] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [destinationCityId, setDestinationCityId] = useState('');
  const [destinationDistrict, setDestinationDistrict] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [originSearchQuery, setOriginSearchQuery] = useState('');
  const [destinationSearchQuery, setDestinationSearchQuery] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState<PlaceSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<PlaceSuggestion[]>([]);
  const [originResolvedLocation, setOriginResolvedLocation] = useState<ResolvedLocationInfo | null>(null);
  const [destinationResolvedLocation, setDestinationResolvedLocation] = useState<ResolvedLocationInfo | null>(null);
  const [originManualEdit, setOriginManualEdit] = useState(false);
  const [destinationManualEdit, setDestinationManualEdit] = useState(false);
  const [originExtraEnabled, setOriginExtraEnabled] = useState(false);
  const [destinationExtraEnabled, setDestinationExtraEnabled] = useState(false);
  const [originExtraNote, setOriginExtraNote] = useState('');
  const [destinationExtraNote, setDestinationExtraNote] = useState('');
  const [mapPreviewUrl, setMapPreviewUrl] = useState('');
  const [mapPreviewTitle, setMapPreviewTitle] = useState('');
  const [originSearchBusy, setOriginSearchBusy] = useState(false);
  const [destinationSearchBusy, setDestinationSearchBusy] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsLoadError, setMapsLoadError] = useState('');
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);
  const [routeInfo, setRouteInfo] = useState<RouteSummaryInfo | null>(null);
  const [routeGeo, setRouteGeo] = useState<{
    pickupGeo?: { type: 'Point'; coordinates: [number, number] };
    dropoffGeo?: { type: 'Point'; coordinates: [number, number] };
  } | null>(null);

  const [measurementValue, setMeasurementValue] = useState('');
  const [measurementUnit, setMeasurementUnit] = useState<'kg' | 'ton' | 'm3' | 'adet'>('kg');
  const [budgetRange, setBudgetRange] = useState('');
  const [cargoAttributes, setCargoAttributes] = useState<string[]>([]);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');

  const [optionsLoading, setOptionsLoading] = useState(false);
  const [formOptions, setFormOptions] = useState<FormOptionsResponse | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<'quick' | 'detailed' | null>('quick');

  const [carrierTab, setCarrierTab] = useState<(typeof OFFER_TABS)[number]['key']>('pool');
  const [carrierFeed, setCarrierFeed] = useState<CarrierFeedShipment[]>([]);
  const [carrierOffers, setCarrierOffers] = useState<CarrierOffer[]>([]);
  const [carrierJobs, setCarrierJobs] = useState<CarrierJobsResponse>(EMPTY_CARRIER_JOBS);
  const [carrierLoadTypes, setCarrierLoadTypes] = useState<LookupLoadType[]>([]);
  const [carrierFilterMode, setCarrierFilterMode] = useState<'all' | 'intracity' | 'intercity'>('all');
  const [carrierFilterCityId, setCarrierFilterCityId] = useState('');
  const [carrierFilterDistrict, setCarrierFilterDistrict] = useState('');
  const [carrierFiltersOpen, setCarrierFiltersOpen] = useState(true);
  const [carrierSortMode, setCarrierSortMode] = useState<'newest' | 'oldest' | 'nearest' | 'farthest' | 'most_offers'>(
    'newest',
  );
  const [carrierNearbyLoading, setCarrierNearbyLoading] = useState(false);
  const [carrierNearbyLabel, setCarrierNearbyLabel] = useState('');
  const [carrierNearbyCenter, setCarrierNearbyCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [carrierRadiusKm, setCarrierRadiusKm] = useState(50);
  const carrierAutoNearbyAppliedRef = useRef(false);
  const [chatConversationId, setChatConversationId] = useState('');
  const [chatMessages, setChatMessages] = useState<AppConversationMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatConnecting, setChatConnecting] = useState(false);
  const chatSocketRef = useRef<Socket | null>(null);

  const segmentConfig = useMemo(() => SEGMENTS.find((x) => x.key === segment) || SEGMENTS[0], [segment]);

  const carrierFilterDistricts = useMemo(() => districtByCity[carrierFilterCityId] || [], [districtByCity, carrierFilterCityId]);

  const originCityName = useMemo(() => cities.find((x) => x.id === originCityId)?.name || '', [cities, originCityId]);
  const destinationCityName = useMemo(() => cities.find((x) => x.id === destinationCityId)?.name || '', [cities, destinationCityId]);
  const carrierFilterCityName = useMemo(
    () => cities.find((x) => x.id === carrierFilterCityId)?.name || '',
    [cities, carrierFilterCityId],
  );
  const selectedVehicleType = useMemo(
    () => formOptions?.vehicleTypes?.find((v) => v.slug === selectedVehicleTypeSlug) || null,
    [formOptions?.vehicleTypes, selectedVehicleTypeSlug],
  );
  const selectedVehicleDurationMultiplier = useMemo(
    () => getDurationMultiplierByVehicle(selectedVehicleType?.slug, selectedVehicleType?.name),
    [selectedVehicleType?.slug, selectedVehicleType?.name],
  );

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
  const carrierActiveJobs = useMemo(() => {
    const all = [...carrierJobs.active, ...carrierJobs.upcoming];
    return all.sort((a, b) => {
      const aTs = new Date(a.shipment?.scheduledPickupAt || a.acceptedAt || 0).getTime();
      const bTs = new Date(b.shipment?.scheduledPickupAt || b.acceptedAt || 0).getTime();
      return bTs - aTs;
    });
  }, [carrierJobs.active, carrierJobs.upcoming]);
  const carrierDistanceMap = useMemo(() => {
    const result: Record<string, number> = {};
    if (!carrierNearbyCenter) return result;
    carrierPool.forEach((item) => {
      const point = getShipmentPickupLatLng(item);
      if (!point) return;
      result[item._id] = Number(
        haversineKm(carrierNearbyCenter.lat, carrierNearbyCenter.lng, point.lat, point.lng).toFixed(1),
      );
    });
    return result;
  }, [carrierPool, carrierNearbyCenter]);
  const carrierFilteredPool = useMemo(() => {
    return carrierPool.filter((item) => {
      if (carrierFilterMode !== 'all' && item.transportMode !== carrierFilterMode) return false;
      if (carrierFilterCityName) {
        const pickupCity = trUpper(item.pickupCity);
        if (pickupCity !== trUpper(carrierFilterCityName)) return false;
      }
      if (carrierFilterDistrict) {
        const pickupDistrict = trUpper(item.pickupDistrict);
        if (pickupDistrict !== trUpper(carrierFilterDistrict)) return false;
      }
      if (carrierNearbyCenter) {
        const dist = carrierDistanceMap[item._id];
        if (typeof dist !== 'number' || dist > carrierRadiusKm) return false;
      }
      return true;
    });
  }, [
    carrierPool,
    carrierFilterMode,
    carrierFilterCityName,
    carrierFilterDistrict,
    carrierNearbyCenter,
    carrierRadiusKm,
    carrierDistanceMap,
  ]);
  const carrierDisplayedPool = useMemo(() => {
    const rows = [...carrierFilteredPool];
    if (carrierSortMode === 'newest') {
      rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return rows;
    }
    if (carrierSortMode === 'oldest') {
      rows.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      return rows;
    }
    if (carrierSortMode === 'most_offers') {
      rows.sort((a, b) => Number(b.offerCount || 0) - Number(a.offerCount || 0));
      return rows;
    }
    if (carrierSortMode === 'nearest') {
      rows.sort((a, b) => {
        const aDist = typeof carrierDistanceMap[a._id] === 'number' ? carrierDistanceMap[a._id] : Number.POSITIVE_INFINITY;
        const bDist = typeof carrierDistanceMap[b._id] === 'number' ? carrierDistanceMap[b._id] : Number.POSITIVE_INFINITY;
        return aDist - bDist;
      });
      return rows;
    }
    if (carrierSortMode === 'farthest') {
      rows.sort((a, b) => {
        const aDist = typeof carrierDistanceMap[a._id] === 'number' ? carrierDistanceMap[a._id] : Number.NEGATIVE_INFINITY;
        const bDist = typeof carrierDistanceMap[b._id] === 'number' ? carrierDistanceMap[b._id] : Number.NEGATIVE_INFINITY;
        return bDist - aDist;
      });
      return rows;
    }
    return rows;
  }, [carrierFilteredPool, carrierSortMode, carrierDistanceMap]);
  const quickLoadTypeOptions = useMemo(() => {
    const all = formOptions?.cargoTypes || [];
    if (!all.length) return [] as CargoTypeOption[];
    const configuredRows = (formOptions?.quickModeCargoTypes || []).filter(Boolean);
    if (configuredRows.length) return configuredRows;
    const configuredSlugs = (formOptions?.quickModeCargoTypeSlugs || []).map((s) => s.trim()).filter(Boolean);
    if (configuredSlugs.length) {
      const bySlugRows = all.filter((item) => configuredSlugs.includes(item.slug));
      if (bySlugRows.length) return bySlugRows;
    }
    const groups = [
      ['koli', 'paket'],
      ['ev', 'eşya', 'esya'],
      ['palet'],
      ['soğuk', 'soguk', 'zincir', 'frigorifik'],
      ['ağır', 'agir', 'tonaj', 'sanayi'],
      ['hassas', 'kırıl', 'kiril', 'elektronik'],
    ];
    const picks: CargoTypeOption[] = [];
    const used = new Set<string>();
    groups.forEach((words) => {
      const found = all.find((item) => {
        const hay = `${item.name} ${item.slug} ${item.subGroup || ''} ${item.category || ''}`
          .toLocaleLowerCase('tr-TR');
        return words.some((w) => hay.includes(w));
      });
      if (found && !used.has(found.slug)) {
        used.add(found.slug);
        picks.push(found);
      }
    });
    if (!picks.length) return all.slice(0, 6);
    return picks.slice(0, 6);
  }, [formOptions?.cargoTypes, formOptions?.quickModeCargoTypeSlugs, formOptions?.quickModeCargoTypes]);

  const effectiveLoadTypeSlug = useMemo(
    () => {
      if (selectedLoadTypeSlug) return selectedLoadTypeSlug;
      if (creationMode === 'quick') return quickLoadTypeOptions[0]?.slug || formOptions?.cargoTypes?.[0]?.slug || '';
      return formOptions?.cargoTypes?.[0]?.slug || '';
    },
    [selectedLoadTypeSlug, formOptions?.cargoTypes, creationMode, quickLoadTypeOptions],
  );
  const effectiveVehicleTypeSlug = useMemo(
    () => selectedVehicleTypeSlug || formOptions?.vehicleTypes?.[0]?.slug || '',
    [selectedVehicleTypeSlug, formOptions?.vehicleTypes],
  );
  const activeSubCategory = useMemo(
    () => segmentConfig.subCategories.find((x) => x.id === subCategoryId) || null,
    [segmentConfig, subCategoryId],
  );
  const selectedLoadTypeLabel = useMemo(
    () => formOptions?.cargoTypes?.find((c) => c.slug === effectiveLoadTypeSlug)?.name || '-',
    [formOptions?.cargoTypes, effectiveLoadTypeSlug],
  );
  const selectedVehicleTypeLabel = useMemo(
    () => formOptions?.vehicleTypes?.find((v) => v.slug === effectiveVehicleTypeSlug)?.name || '-',
    [formOptions?.vehicleTypes, effectiveVehicleTypeSlug],
  );
  const loadTypeLabelMap = useMemo(
    () =>
      carrierLoadTypes.reduce<Record<string, string>>((acc, row) => {
        acc[row.key] = row.label;
        return acc;
      }, {}),
    [carrierLoadTypes],
  );
  const hasFieldRules = Boolean(formOptions?.fieldRules?.length);
  const isTimedDelivery = cargoAttributes.includes('Saatli Teslimat');

  const findCityIdByName = (rawCityName?: string) => {
    if (!rawCityName) return '';
    const target = trUpper(rawCityName);
    return cities.find((city) => trUpper(city.name) === target)?.id || '';
  };

  const resolveDistrictName = (list: DistrictOption[], rawDistrictName?: string) => {
    if (!rawDistrictName || !list.length) return '';
    const candidates = buildDistrictCandidates(rawDistrictName);
    const found = list.find((row) => {
      const name = trUpper(row.name);
      return candidates.includes(name) || candidates.includes(name.replace(/\s+/g, ''));
    });
    return found?.name || '';
  };

  const openLocationMapPreview = (location: ResolvedLocationInfo | null, title: string) => {
    if (!location) return;
    const hasLatLng = Number.isFinite(location.lat) && Number.isFinite(location.lng);
    const mapUrl = hasLatLng
      ? `https://www.google.com/maps?q=${location.lat},${location.lng}&z=15&output=embed`
      : `https://www.google.com/maps?q=${encodeURIComponent(location.formattedAddress || `${location.districtName || ''} ${location.cityName || ''}`)}&output=embed`;
    setMapPreviewUrl(mapUrl);
    setMapPreviewTitle(title);
  };

  const applyPlaceToAddress = async (target: 'origin' | 'destination', place: any) => {
    const components: any[] = place?.address_components || [];
    const cityComp = components.find((c) => c.types?.includes('administrative_area_level_1'));
    const districtComp =
      components.find((c) => c.types?.includes('administrative_area_level_2')) ||
      components.find((c) => c.types?.includes('administrative_area_level_3')) ||
      components.find((c) => c.types?.includes('sublocality_level_1')) ||
      components.find((c) => c.types?.includes('locality'));

    const cityName = cityComp?.long_name || '';
    const districtName = districtComp?.long_name || '';
    const formattedAddress = place?.formatted_address || '';
    const lat = Number(place?.geometry?.location?.lat?.() ?? place?.geometry?.location?.lat ?? NaN);
    const lng = Number(place?.geometry?.location?.lng?.() ?? place?.geometry?.location?.lng ?? NaN);
    const cityId = findCityIdByName(cityName);

    if (target === 'origin') {
      setOriginAddress(formattedAddress);
      setOriginManualEdit(false);
      // Programatik secimden sonra tekrar suggestion tetiklenmemesi icin arama kutusunu temizle.
      setOriginSearchQuery('');
      setOriginSuggestions([]);
      setOriginResolvedLocation({
        cityName: cityName || '',
        districtName: districtName || '',
        formattedAddress,
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
      });
      if (cityId) {
        setOriginCityId(cityId);
        const list = await loadDistricts(cityId);
        const matchedDistrict = resolveDistrictName(list, districtName);
        if (matchedDistrict) setOriginDistrict(matchedDistrict);
      }
      return;
    }

    setDestinationAddress(formattedAddress);
    setDestinationManualEdit(false);
    // Programatik secimden sonra tekrar suggestion tetiklenmemesi icin arama kutusunu temizle.
    setDestinationSearchQuery('');
    setDestinationSuggestions([]);
    setDestinationResolvedLocation({
      cityName: cityName || '',
      districtName: districtName || '',
      formattedAddress,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
    });
    if (cityId) {
      setDestinationCityId(cityId);
      const list = await loadDistricts(cityId);
      const matchedDistrict = resolveDistrictName(list, districtName);
      if (matchedDistrict) setDestinationDistrict(matchedDistrict);
    }
  };

  const loadPlaceDetails = (target: 'origin' | 'destination', placeId: string) => {
    const service = placesServiceRef.current;
    const googleObj = (window as any).google;
    if (!service || !googleObj?.maps?.places || !placeId) return;

    service.getDetails(
      {
        placeId,
        fields: ['formatted_address', 'address_components', 'geometry', 'name'],
      },
      (place: any, status: any) => {
        if (status !== googleObj.maps.places.PlacesServiceStatus.OK || !place) return;
        void applyPlaceToAddress(target, place);
      },
    );
  };

  const runAddressSearch = (target: 'origin' | 'destination', query: string) => {
    const service = autocompleteServiceRef.current;
    const googleObj = (window as any).google;
    if (!service || !googleObj?.maps?.places) return;
    if (!query || query.trim().length < 3) {
      if (target === 'origin') setOriginSuggestions([]);
      else setDestinationSuggestions([]);
      return;
    }

    if (target === 'origin') setOriginSearchBusy(true);
    else setDestinationSearchBusy(true);

    service.getPlacePredictions(
      {
        input: query.trim(),
        componentRestrictions: { country: 'tr' },
        language: 'tr',
      },
      (predictions: any[], status: any) => {
        const rows =
          status === googleObj.maps.places.PlacesServiceStatus.OK && Array.isArray(predictions)
            ? predictions.map((item) => ({
                placeId: item.place_id || '',
                description: item.description || '',
                mainText: item.structured_formatting?.main_text || item.description || '',
                secondaryText: item.structured_formatting?.secondary_text || '',
              }))
            : [];

        if (target === 'origin') {
          setOriginSuggestions(rows);
          setOriginSearchBusy(false);
        } else {
          setDestinationSuggestions(rows);
          setDestinationSearchBusy(false);
        }
      },
    );
  };

  const buildRouteAddress = (kind: 'origin' | 'destination') => {
    const city = kind === 'origin' ? originCityName : destinationCityName;
    const district = kind === 'origin' ? originDistrict : destinationDistrict;
    const addr = kind === 'origin' ? originAddress : destinationAddress;
    return [addr, district, city, 'Türkiye'].filter(Boolean).join(', ');
  };

  const calculateRoute = () => {
    const googleObj = (window as any).google;
    const service = directionsServiceRef.current;
    if (!googleObj?.maps?.DirectionsStatus || !service) return;

    const origin = buildRouteAddress('origin');
    const destination = buildRouteAddress('destination');
    if (!originCityName || !destinationCityName || origin.trim().length < 3 || destination.trim().length < 3) {
      setRouteInfo(null);
      setRouteGeo(null);
      return;
    }

    service.route(
      {
        origin,
        destination,
        travelMode: googleObj.maps.TravelMode.DRIVING,
        region: 'TR',
        provideRouteAlternatives: false,
      },
      (result: any, status: any) => {
        if (status !== googleObj.maps.DirectionsStatus.OK || !result?.routes?.length) {
          setRouteInfo(null);
          setRouteGeo(null);
          return;
        }

        const leg = result.routes?.[0]?.legs?.[0];
        const meters = Number(leg?.distance?.value || 0);
        const seconds = Number(leg?.duration?.value || 0);
        const distanceKm = Number((meters / 1000).toFixed(1));
        const durationMinBase = Math.max(1, Math.round(seconds / 60));
        const durationMultiplier = selectedVehicleDurationMultiplier;
        const durationMin = Math.max(1, Math.round(durationMinBase * durationMultiplier));
        const summary = String(result.routes?.[0]?.summary || '');
        const polyline = String(result.routes?.[0]?.overview_polyline?.toString?.() || '');
        const startLat = Number(leg?.start_location?.lat?.() ?? leg?.start_location?.lat ?? NaN);
        const startLng = Number(leg?.start_location?.lng?.() ?? leg?.start_location?.lng ?? NaN);
        const endLat = Number(leg?.end_location?.lat?.() ?? leg?.end_location?.lat ?? NaN);
        const endLng = Number(leg?.end_location?.lng?.() ?? leg?.end_location?.lng ?? NaN);

        setRouteInfo({
          distanceKm,
          durationMin,
          durationBaseMin: durationMinBase,
          durationMultiplier,
          summary,
          polyline,
        });
        if ([startLat, startLng, endLat, endLng].every((x) => Number.isFinite(x))) {
          setRouteGeo({
            pickupGeo: { type: 'Point', coordinates: [startLng, startLat] },
            dropoffGeo: { type: 'Point', coordinates: [endLng, endLat] },
          });
        } else {
          setRouteGeo(null);
        }
      },
    );
  };

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMapsLoadError('Google Maps API key tanımlı değil.');
      return;
    }

    const googleObj = (window as any).google;
    if (googleObj?.maps?.places) {
      setMapsReady(true);
      setMapsLoadError('');
      return;
    }

    const scriptId = 'google-maps-places-sdk';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => setMapsReady(true), { once: true });
      existing.addEventListener('error', () => setMapsLoadError('Google Maps yüklenemedi.'), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY,
    )}&libraries=places&language=tr&region=TR`;
    script.onload = () => {
      setMapsReady(true);
      setMapsLoadError('');
    };
    script.onerror = () => setMapsLoadError('Google Maps yüklenemedi.');
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapsReady) return;
    const googleObj = (window as any).google;
    if (!googleObj?.maps?.places) return;

    autocompleteServiceRef.current = new googleObj.maps.places.AutocompleteService();
    placesServiceRef.current = new googleObj.maps.places.PlacesService(document.createElement('div'));
    directionsServiceRef.current = new googleObj.maps.DirectionsService();
  }, [mapsReady]);

  useEffect(() => {
    if (!mapsReady || !originSearchQuery.trim()) {
      setOriginSuggestions([]);
      setOriginSearchBusy(false);
      return;
    }
    const timer = window.setTimeout(() => runAddressSearch('origin', originSearchQuery), 280);
    return () => window.clearTimeout(timer);
  }, [mapsReady, originSearchQuery]);

  useEffect(() => {
    if (!mapsReady || !destinationSearchQuery.trim()) {
      setDestinationSuggestions([]);
      setDestinationSearchBusy(false);
      return;
    }
    const timer = window.setTimeout(() => runAddressSearch('destination', destinationSearchQuery), 280);
    return () => window.clearTimeout(timer);
  }, [mapsReady, destinationSearchQuery]);

  useEffect(() => {
    if (!mapsReady) return;
    const timer = window.setTimeout(() => calculateRoute(), 350);
    return () => window.clearTimeout(timer);
  }, [mapsReady, originAddress, destinationAddress, originCityName, destinationCityName, originDistrict, destinationDistrict, selectedVehicleDurationMultiplier]);

  useEffect(() => {
    // Backend compatibility: keep delivery option id in sync with the selected time mode.
    if (scheduleMode === 'today') setSelectedDeliveryId('quick_window');
    if (scheduleMode === 'tomorrow') setSelectedDeliveryId('same_day');
    if (scheduleMode === 'planned') setSelectedDeliveryId('scheduled');
  }, [scheduleMode]);

  const loadDistricts = async (cityId: string): Promise<DistrictOption[]> => {
    if (!cityId) return [];
    if (districtByCity[cityId]) return districtByCity[cityId];
    try {
      const { data } = await api.get<DistrictOption[]>('/lookups/districts', { params: { cityId } });
      const rows = Array.isArray(data) ? data : [];
      setDistrictByCity((prev) => ({ ...prev, [cityId]: rows }));
      return rows;
    } catch {
      setDistrictByCity((prev) => ({ ...prev, [cityId]: [] }));
      return [];
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

        await refreshRegisterContractCompliance(me.role);

        if (me.role === 'carrier') {
          const [feedRes, offersRes, jobsRes, loadTypeRes] = await Promise.all([
            api.get<CarrierFeedShipment[]>('/shipments/feed'),
            api.get<CarrierOffer[]>('/offers/my/detailed'),
            api.get<CarrierJobsResponse>('/offers/carrier/jobs'),
            api.get<LookupLoadType[]>('/lookups/load-types'),
          ]);
          setCarrierFeed(Array.isArray(feedRes.data) ? feedRes.data : []);
          setCarrierOffers(Array.isArray(offersRes.data) ? offersRes.data : []);
          setCarrierJobs(normalizeCarrierJobs(jobsRes.data));
          setCarrierLoadTypes(Array.isArray(loadTypeRes.data) ? loadTypeRes.data : []);
        }
      } catch (error: any) {
        const errText = error?.response?.data?.message || 'Sayfa yüklenemedi.';
        setMessage(errText);
        notifyError(errText);
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, [token]);

  useEffect(() => {
    if (!token || profile?.role !== 'carrier' || carrierTab !== 'active_jobs') return;
    void refreshCarrierJobs(true);
  }, [token, profile?.role, carrierTab]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (profile?.role !== 'carrier') return;
    if (!carrierFeed.length) return;

    const rows = carrierFeed.map((shipment: any, index) => {
      const slugFromField = shipment?.loadTypeSlug || '';
      const slugFromCargoType =
        typeof shipment?.cargoTypeId === 'object'
          ? (shipment?.cargoTypeId?.slug || '')
          : '';
      const parsedFromDescription = parseDescriptionLine(shipment?.description, 'Yük Tipi');
      const resolvedSlug = slugFromField || slugFromCargoType || '';
      const resolvedLabel =
        (resolvedSlug && loadTypeLabelMap[resolvedSlug]) ||
        (typeof shipment?.cargoTypeId === 'object' ? shipment?.cargoTypeId?.name : '') ||
        parsedFromDescription ||
        '';
      return {
        no: index + 1,
        id: String(shipment?._id || ''),
        title: String(shipment?.title || ''),
        loadTypeSlug: resolvedSlug || '(yok)',
        loadTypeLabel: resolvedLabel || '(yok)',
        cargoTypeId:
          typeof shipment?.cargoTypeId === 'string'
            ? shipment.cargoTypeId
            : (shipment?.cargoTypeId?._id || '(yok)'),
        myOffer: shipment?.hasMyOffer ? 'Evet' : 'Hayır',
        status: shipment?.status || '-',
      };
    });

    console.groupCollapsed(`[Carrier Feed Debug] ${rows.length} ilan`);
    console.table(rows);
    carrierFeed.forEach((shipment: any, index) => {
      console.log(`[Carrier Feed #${index + 1}]`, shipment);
    });
    console.groupEnd();
  }, [profile?.role, carrierFeed, loadTypeLabelMap]);

  useEffect(() => {
    if (profile?.role !== 'carrier') return;
    const validTabs = new Set(OFFER_TABS.map((tab) => tab.key));
    if (queryTab && validTabs.has(queryTab as (typeof OFFER_TABS)[number]['key'])) {
      setCarrierTab(queryTab as (typeof OFFER_TABS)[number]['key']);
    }
    if (queryConversationId) {
      setChatConversationId(queryConversationId);
      setCarrierTab('active_jobs');
    }
  }, [profile?.role, queryTab, queryConversationId]);

  useEffect(() => {
    if (profile?.role !== 'carrier') return;
    if (registerContractPending.length === 0) return;
    if (carrierTab === 'pool' || carrierTab === 'nearby_map') {
      setCarrierTab('active_jobs');
    }
  }, [profile?.role, registerContractPending.length, carrierTab]);

  const loadConversationMessages = async (conversationId: string) => {
    if (!conversationId) return;
    setChatLoading(true);
    try {
      const { data } = await api.get<{ messages?: AppConversationMessage[] }>(`/conversations/${conversationId}`);
      setChatMessages(Array.isArray(data?.messages) ? data.messages : []);
      await api.patch(`/conversations/${conversationId}/read`);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Konuşma mesajları yüklenemedi.');
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  const sendConversationMessage = async () => {
    const text = chatInput.trim();
    if (!chatConversationId || !text) return;
    setChatSending(true);
    try {
      const { data } = await api.post<AppConversationMessage>(`/conversations/${chatConversationId}/messages`, {
        messageType: 'text',
        text,
      });
      setChatMessages((prev) => {
        const exists = prev.some((item) => item._id === data?._id);
        if (exists) return prev;
        return [...prev, data];
      });
      setChatInput('');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Mesaj gönderilemedi.');
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    if (!token || profile?.role !== 'carrier' || !chatConversationId) return;
    void loadConversationMessages(chatConversationId);
  }, [token, profile?.role, chatConversationId]);

  useEffect(() => {
    if (!token || profile?.role !== 'carrier' || !chatConversationId) return;

    setChatConnecting(true);
    const socket = io(apiOrigin, {
      transports: ['websocket'],
      auth: { token },
    });
    chatSocketRef.current = socket;

    socket.on('connect', () => {
      setChatConnecting(false);
      socket.emit('join:conversation', chatConversationId);
    });
    socket.on('disconnect', () => {
      setChatConnecting(true);
    });
    socket.on('conversation:message', (payload: AppConversationMessage) => {
      if (String(payload?.conversationId || '') !== chatConversationId) return;
      setChatMessages((prev) => {
        const exists = prev.some((item) => item._id === payload?._id);
        if (exists) return prev;
        return [...prev, payload];
      });
      void api.patch(`/conversations/${chatConversationId}/read`).catch(() => undefined);
    });

    return () => {
      try {
        socket.emit('leave:conversation', chatConversationId);
      } catch {
        // no-op
      }
      socket.disconnect();
      chatSocketRef.current = null;
      setChatConnecting(false);
    };
  }, [token, profile?.role, chatConversationId]);

  useEffect(() => {
    if (!token || profile?.role !== 'shipper') return;
    let mounted = true;
    const loadOptions = async () => {
      setOptionsLoading(true);
      const activeSub = segmentConfig.subCategories.find((x) => x.id === subCategoryId) || segmentConfig.subCategories[0];
      const isQuick = creationMode === 'quick';
      try {
        const { data } = await api.get<FormOptionsResponse>('/shipments/form/options', {
          params: {
            businessSegment: isQuick ? undefined : segment,
            subCategoryId: isQuick ? 'all' : (activeSub?.id || 'all'),
            subCategoryKeywords: isQuick ? '' : (activeSub?.keywords || ''),
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
        const errText = error?.response?.data?.message || 'Form verileri yüklenemedi.';
        setMessage(errText);
        notifyError(errText);
      } finally {
        if (mounted) setOptionsLoading(false);
      }
    };
    void loadOptions();
    return () => {
      mounted = false;
    };
  }, [token, profile?.role, segment, subCategoryId, computedTransportMode, creationMode]);

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

  useEffect(() => {
    if (!carrierFilterCityId) {
      setCarrierFilterDistrict('');
      return;
    }
    void loadDistricts(carrierFilterCityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrierFilterCityId]);

  useEffect(() => {
    const copyId = searchParams.get('tekrar');
    if (!copyId || !token || profile?.role !== 'shipper' || cities.length === 0) return;
    let mounted = true;
    const fillFromShipment = async () => {
      try {
        const { data } = await api.get<any>(`/shipments/${copyId}`);
        if (!mounted || !data?._id) return;

        const findCityId = (name?: string) =>
          cities.find((c) => (c.name || '').trim().toLocaleUpperCase('tr-TR') === (name || '').trim().toLocaleUpperCase('tr-TR'))?.id || '';

        setTitle(`${data.title || 'Yük'} (Tekrar)`);
        setDescription(parseDescriptionLine(data.description, 'Açıklama') || '');
        setOriginCityId(findCityId(data.pickupCity));
        setOriginDistrict(data.pickupDistrict || '');
        setDestinationCityId(findCityId(data.dropoffCity));
        setDestinationDistrict(data.dropoffDistrict || '');
        setOriginAddress(parseDescriptionLine(data.description, 'Çıkış Adresi') || '');
        setDestinationAddress(parseDescriptionLine(data.description, 'Varış Adresi') || '');

        const totalKg = Number(data.estimatedWeightKg || 0);
        const totalM3 = Number(data.estimatedVolumeM3 || 0);
        const totalPiece = Number(data.pieceCount || 0);
        if (totalM3 > 0) {
          setMeasurementUnit('m3');
          setMeasurementValue(String(totalM3));
        } else if (totalPiece > 0) {
          setMeasurementUnit('adet');
          setMeasurementValue(String(totalPiece));
        } else if (totalKg > 0) {
          if (totalKg >= 1000 && totalKg % 1000 === 0) {
            setMeasurementUnit('ton');
            setMeasurementValue(String(totalKg / 1000));
          } else {
            setMeasurementUnit('kg');
            setMeasurementValue(String(totalKg));
          }
        }

        if (data.scheduledPickupAt) {
          const dt = new Date(data.scheduledPickupAt);
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const target = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
          const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          setScheduledTime(`${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`);
          if (diffDays <= 0) setScheduleMode('today');
          else if (diffDays === 1) setScheduleMode('tomorrow');
          else {
            setScheduleMode('planned');
            setPlannedDate(dt.toISOString().slice(0, 10));
          }
        }
      } catch {
        // sessiz geç
      }
    };
    void fillFromShipment();
    return () => {
      mounted = false;
    };
  }, [searchParams, token, profile?.role, cities]);

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
    const measurementNumber = Number(measurementValue || 0) || 0;
    const lines = [
      `Açıklama: ${description.trim() || '-'}`,
      `Yük Yapısı: ${loadScope}`,
      `Gönderi Segmenti: ${segmentConfig.label}`,
      `Segment Alt Kategori: ${activeSubCategory?.label || '-'}`,
      `Yük Tipi: ${selectedLoadTypeLabel}`,
      `Araç Tipi: ${selectedVehicleTypeLabel}`,
      `Çıkış Konumu: ${originAddress.trim() || '-'}`,
      `Varış Konumu: ${destinationAddress.trim() || '-'}`,
      `Çıkış Ekstra Tarifi: ${originExtraEnabled ? (originExtraNote.trim() || '-') : '-'}`,
      `Varış Ekstra Tarifi: ${destinationExtraEnabled ? (destinationExtraNote.trim() || '-') : '-'}`,
      `Rota Mesafe (km): ${routeInfo?.distanceKm ?? '-'}`,
      `Rota Süre (dk): ${routeInfo?.durationMin ?? '-'}`,
      `Süre Katsayısı: ${routeInfo?.durationMultiplier ? `x${routeInfo.durationMultiplier.toFixed(2)}` : 'x1.00'}`,
      `Rota Özeti: ${routeInfo?.summary || '-'}`,
      `Yükleme Tarihi: ${composeScheduledAt()}`,
      `Teslim Son Tarihi: ${deadlineDate ? `${deadlineDate}${deadlineTime ? ` ${deadlineTime}` : ''}` : '-'}`,
      `Ölçü / Kapasite: ${measurementNumber > 0 ? `${measurementNumber} ${measurementUnit}` : '-'}`,
      `Bütçe Aralığı: ${budgetRange.trim() || '-'}`,
      `Yük Niteliği: ${cargoAttributes.length ? cargoAttributes.join(', ') : '-'}`,
      `Ek Alanlar: ${Object.entries(fieldValues).map(([k, v]) => `${k}=${v}`).join('; ') || '-'}`,
    ];
    return lines.join('\n');
  };

  const validateShipmentInputs = () => {
    if (creationMode === 'detailed' && (!title.trim() || /[\r\n]/.test(title))) {
      setMessage('İlan başlığı zorunlu ve tek satır olmalı.');
      notifyWarning('İlan başlığı zorunlu ve tek satır olmalı.');
      return false;
    }
    if (!effectiveLoadTypeSlug || !effectiveVehicleTypeSlug) {
      const warnText =
        creationMode === 'quick'
          ? 'Hızlı akış için uygun yük tipi/araç tipi bulunamadı. Lütfen segmenti değiştirin.'
          : 'Yük tipi ve araç tipi seçiniz.';
      setMessage(warnText);
      notifyWarning(warnText);
      return false;
    }
    if (!originCityName || !destinationCityName) {
      setMessage('Çıkış ve varış şehirlerini seçiniz.');
      notifyWarning('Çıkış ve varış şehirlerini seçiniz.');
      return false;
    }
    if (scheduleMode === 'planned' && !plannedDate) {
      setMessage('Planlı tarih seçiniz.');
      notifyWarning('Planlı tarih seçiniz.');
      return false;
    }
    if (isTimedDelivery && !deadlineDate) {
      setMessage('Saatli teslimat için teslim edilme tarihi seçiniz.');
      notifyWarning('Saatli teslimat için teslim edilme tarihi seçiniz.');
      return false;
    }
    return true;
  };

  const submitShipment = async () => {
    if (!validateShipmentInputs()) return;
    const measurementNumber = Number(measurementValue || 0) || 0;
    const calculatedWeightKg = measurementUnit === 'kg'
      ? measurementNumber
      : measurementUnit === 'ton'
        ? measurementNumber * 1000
        : 0;
    const calculatedVolumeM3 = measurementUnit === 'm3' ? measurementNumber : 0;
    const calculatedPieceCount = measurementUnit === 'adet' ? Math.round(measurementNumber) : 0;

    const finalTitle = title.trim() || `Hızlı Gönderi - ${originCityName || 'Çıkış'} > ${destinationCityName || 'Varış'}`;

    setSubmitting(true);
    setMessage('');
    try {
      await api.post('/shipments', {
        title: finalTitle,
        description: composeDescription(),
        transportMode: computedTransportMode,
        loadTypeSlug: effectiveLoadTypeSlug,
        originCity: originCityName,
        originDistrict,
        originAddress: originAddress.trim() || undefined,
        destinationCity: destinationCityName,
        destinationDistrict,
        destinationAddress: destinationAddress.trim() || undefined,
        pickupGeo: routeGeo?.pickupGeo,
        dropoffGeo: routeGeo?.dropoffGeo,
        preferredVehicleTypeSlugs: [effectiveVehicleTypeSlug],
        isUrgent: selectedDeliveryId === 'priority_60',
        scheduledAt: composeScheduledAt(),
        deliveryDeadlineAt: isTimedDelivery && deadlineDate
          ? new Date(`${deadlineDate}T${deadlineTime || '23:59'}:00`).toISOString()
          : undefined,
        estimatedWeightKg: calculatedWeightKg > 0 ? calculatedWeightKg : undefined,
        estimatedVolumeM3: calculatedVolumeM3 > 0 ? calculatedVolumeM3 : undefined,
        pieceCount: calculatedPieceCount > 0 ? calculatedPieceCount : undefined,
        routeDistanceKm: routeInfo?.distanceKm,
        routeDurationMin: routeInfo?.durationMin,
        routeSummary: routeInfo?.summary || undefined,
        routePolyline: routeInfo?.polyline || undefined,
        creationMode,
      });
      notifySuccess('Yük başarıyla oluşturuldu.');
      navigate('/hesabim');
    } catch (error: any) {
      const errText = error?.response?.data?.message || 'Yük oluşturulamadı.';
      setMessage(errText);
      notifyError(errText);
    } finally {
      setSubmitting(false);
    }
  };

  const openPreview = () => {
    if (creationMode === 'quick') {
      void submitShipment();
      return;
    }
    if (!validateShipmentInputs()) return;
    setMessage('');
    setPreviewOpen(true);
  };

  const clearCarrierPoolFilters = () => {
    setCarrierFilterMode('all');
    setCarrierFilterCityId('');
    setCarrierFilterDistrict('');
    setCarrierNearbyLabel('');
    setCarrierNearbyCenter(null);
    setCarrierRadiusKm(50);
  };

  const CARRIER_NEARBY_CACHE_KEY = 'an_carrier_nearby_center';
  const persistNearbyCenter = (center: { lat: number; lng: number }) => {
    try {
      localStorage.setItem(CARRIER_NEARBY_CACHE_KEY, JSON.stringify(center));
    } catch {
      // Ignore storage quota/private mode issues.
    }
  };

  const refreshRegisterContractCompliance = async (role?: UserProfile['role']) => {
    if (role !== 'shipper' && role !== 'carrier') {
      setRegisterContractPending([]);
      return;
    }
    setRegisterContractChecking(true);
    try {
      const { data } = await api.get<RegisterContractComplianceResponse>('/content/register-contracts/compliance');
      const pendingContracts = Array.isArray(data?.pendingContracts) ? data.pendingContracts : [];
      setRegisterContractPending(pendingContracts);
    } catch {
      setRegisterContractPending([]);
    } finally {
      setRegisterContractChecking(false);
    }
  };

  const handleResolveRegisterContracts = async () => {
    if (!registerContractPending.length) return;
    const acceptedSlugs = await askUpdatedRegisterContractsConsent(registerContractPending);
    if (!acceptedSlugs || acceptedSlugs.length === 0) return;
    setRegisterContractSaving(true);
    try {
      await api.post('/content/register-contracts/accept-updates', { slugs: acceptedSlugs });
      await refreshRegisterContractCompliance(profile?.role);
      notifySuccess('Güncellenen sözleşmeler onaylandı.');
    } catch (error: any) {
      const errText = error?.response?.data?.message || 'Sözleşme onayı kaydedilemedi.';
      notifyError(errText);
    } finally {
      setRegisterContractSaving(false);
    }
  };
  const readNearbyCenterFromCache = () => {
    try {
      const raw = localStorage.getItem(CARRIER_NEARBY_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
      if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) return null;
      return { lat: Number(parsed.lat), lng: Number(parsed.lng) };
    } catch {
      return null;
    }
  };

  const refreshCarrierJobs = async (silent = false) => {
    try {
      const { data } = await api.get<CarrierJobsResponse>('/offers/carrier/jobs');
      setCarrierJobs(normalizeCarrierJobs(data));
    } catch (error: any) {
      setCarrierJobs(EMPTY_CARRIER_JOBS);
      if (!silent) {
        const errText = error?.response?.data?.message || 'Aktif taşımalar yüklenemedi.';
        setMessage(errText);
        notifyError(errText);
      }
    }
  };

  const applyNearbyCarrierFilter = (options?: { forceRadiusKm?: number }) => {
    const openNearbyFallbackChoices = async (reasonText: string) => {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Konum alınamadı',
        text: reasonText,
        confirmButtonText: 'Tekrar Dene',
        showDenyButton: true,
        denyButtonText: 'İl / İlçe ile Devam Et',
        showCancelButton: true,
        cancelButtonText: 'Konumsuz Devam Et',
        allowOutsideClick: false,
      });

      if (result.isConfirmed) {
        applyNearbyCarrierFilter(options);
        return;
      }

      if (result.isDenied) {
        setCarrierNearbyCenter(null);
        setCarrierNearbyLabel('');
        setMessage('Konum alınamadı. İl / ilçe filtrelerini kullanarak devam edebilirsiniz.');
        const citySelect = document.getElementById('carrier-filter-city') as HTMLSelectElement | null;
        citySelect?.focus();
        return;
      }

      setCarrierNearbyCenter(null);
      setCarrierNearbyLabel('');
      setMessage('Konum alınamadı. Konumsuz şekilde tüm ilanlar gösteriliyor.');
    };

    if (typeof options?.forceRadiusKm === 'number' && options.forceRadiusKm > 0) {
      setCarrierRadiusKm(options.forceRadiusKm);
    }
    if (!navigator.geolocation) {
      void openNearbyFallbackChoices('Tarayıcı konum desteği bulunamadı.');
      return;
    }
    setCarrierNearbyLoading(true);
    setMessage('');
    void Swal.fire({
      title: 'Konum bilgileri alınıyor',
      text: 'Lütfen bekleyin...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Net davranış: Yakınımdakiler filtresi sadece radius + pickupGeo bazlı çalışır.
        // İl/ilçe filtreleri otomatik set edilmez, varsa temizlenir.
        setCarrierFilterCityId('');
        setCarrierFilterDistrict('');
        const currentCenter = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCarrierNearbyCenter(currentCenter);
        persistNearbyCenter(currentCenter);
        const googleObj = (window as any).google;
        const geocoder = googleObj?.maps ? new googleObj.maps.Geocoder() : null;
        if (!geocoder) {
          setCarrierNearbyLoading(false);
          if (Swal.isVisible()) Swal.close();
          setCarrierNearbyLabel(`Mevcut konum (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
          return;
        }
        geocoder.geocode(
          { location: { lat: pos.coords.latitude, lng: pos.coords.longitude }, language: 'tr', region: 'TR' },
          async (results: any[], status: any) => {
            setCarrierNearbyLoading(false);
            if (Swal.isVisible()) Swal.close();
            const ok = status === googleObj.maps.GeocoderStatus.OK && Array.isArray(results) && results.length > 0;
            if (!ok) {
              setCarrierNearbyLabel(`Mevcut konum (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
              return;
            }
            const components: any[] = results[0]?.address_components || [];
            const cityComponent = components.find((c) => c.types?.includes('administrative_area_level_1'));
            const districtComponent =
              components.find((c) => c.types?.includes('administrative_area_level_2')) ||
              components.find((c) => c.types?.includes('locality'));
            const cityLong = cityComponent?.long_name || cityComponent?.short_name || '';
            const districtLong = districtComponent?.long_name || districtComponent?.short_name || '';
            setCarrierNearbyLabel(
              `${cityLong || 'Mevcut konum'}${districtLong ? ` / ${districtLong}` : ''}`,
            );
          },
        );
      },
      (err) => {
        setCarrierNearbyLoading(false);
        if (Swal.isVisible()) Swal.close();
        const code = Number(err?.code || 0);
        const isTimeout = code === 3 || /timeout expired/i.test(String(err?.message || ''));
        const fallbackCenter = readNearbyCenterFromCache();
        if (isTimeout && fallbackCenter) {
          setCarrierFilterCityId('');
          setCarrierFilterDistrict('');
          setCarrierNearbyCenter(fallbackCenter);
          setCarrierNearbyLabel(`Son bilinen konum (${fallbackCenter.lat.toFixed(4)}, ${fallbackCenter.lng.toFixed(4)})`);
          const warnText = 'Canlı konum zaman aşımına uğradı, son bilinen konum kullanıldı.';
          setMessage(warnText);
          notifyWarning(warnText);
          return;
        }
        const errText = isTimeout
          ? 'Konum isteği zaman aşımına uğradı. Nasıl devam etmek istersiniz?'
          : err?.message || 'Konum alınamadı. Nasıl devam etmek istersiniz?';
        setMessage(errText);
        void openNearbyFallbackChoices(errText);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 },
    );
  };

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== 'carrier') return;
    if (carrierAutoNearbyAppliedRef.current) return;
    carrierAutoNearbyAppliedRef.current = true;
    applyNearbyCarrierFilter({ forceRadiusKm: 50 });
  }, [loading, profile?.role]);

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
    const isCarrierPoolLockedByContract = registerContractPending.length > 0;
    const carrierVisibleTabs = isCarrierPoolLockedByContract
      ? OFFER_TABS.filter((tab) => tab.key !== 'pool' && tab.key !== 'nearby_map')
      : OFFER_TABS;
    return (
      <section className="container py-5">
        <h1 className="shipment-page-title mb-4">Taşıyıcı Yük Alanı</h1>
        {message ? <div className="alert alert-warning">{message}</div> : null}
        {registerContractPending.length > 0 ? (
          <div className="alert alert-warning d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <strong>Güncel sözleşme onayı gerekli.</strong>
              <div className="small">
                {registerContractPending.length} sözleşme güncellendi. Yük işlemlerine devam etmek için onaylayın.
              </div>
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-warning"
                disabled={registerContractSaving}
                onClick={() => void handleResolveRegisterContracts()}
              >
                {registerContractSaving ? 'Kaydediliyor...' : 'Sözleşmeleri Onayla'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={registerContractChecking}
                onClick={() => void refreshRegisterContractCompliance(profile?.role)}
              >
                {registerContractChecking ? 'Kontrol ediliyor...' : 'Yenile'}
              </button>
            </div>
          </div>
        ) : null}
        {isCarrierPoolLockedByContract ? (
          <div className="panel-card p-3 mb-3 border border-warning-subtle">
            <div className="small text-secondary">
              <i className="bi bi-lock me-1"></i>
              Güncel sözleşme onayı tamamlanana kadar Yük Havuzu ve Haritada Göster sekmeleri gizlenir.
            </div>
          </div>
        ) : null}

        {chatConversationId ? (
          <div className="panel-card p-4 mb-3">
            <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
              <h4 className="fw-bold mb-0">Mesajlaşma</h4>
              <span className={`shipment-status-pill ${chatConnecting ? 'tone-warning' : 'tone-success'}`}>
                {chatConnecting ? 'Bağlanıyor...' : 'Bağlandı'}
              </span>
            </div>
            <div className="border rounded-3 p-3 mb-3" style={{ maxHeight: 300, overflowY: 'auto', background: '#faf9fe' }}>
              {chatLoading ? (
                <div className="text-secondary small">Mesajlar yükleniyor...</div>
              ) : chatMessages.length === 0 ? (
                <div className="text-secondary small">Henüz mesaj yok.</div>
              ) : (
                chatMessages.map((item) => {
                  const senderId =
                    typeof item.senderUserId === 'string'
                      ? item.senderUserId
                      : String(item.senderUserId?._id || '');
                  const mine = Boolean(profile?.id && senderId && profile.id === senderId);
                  return (
                    <div key={item._id} className={`d-flex mb-2 ${mine ? 'justify-content-end' : 'justify-content-start'}`}>
                      <div
                        className={`px-3 py-2 rounded-3 ${mine ? 'text-white' : ''}`}
                        style={{ maxWidth: '80%', background: mine ? '#3E2C78' : '#ffffff', border: mine ? 'none' : '1px solid #ece7ff' }}
                      >
                        <div className="small">{item.text || '-'}</div>
                        <div className={`small mt-1 ${mine ? 'text-white-50' : 'text-secondary'}`}>
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="d-flex gap-2">
              <input
                className="form-control shipment-input"
                placeholder="Mesaj yaz..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendConversationMessage();
                  }
                }}
              />
              <button type="button" className="btn btn-primary" disabled={chatSending || !chatInput.trim()} onClick={() => void sendConversationMessage()}>
                {chatSending ? 'Gönderiliyor...' : 'Gönder'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="d-flex flex-wrap gap-2 mb-3">
          {carrierVisibleTabs.map((tab) => (
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

        {carrierTab === 'pool' && !isCarrierPoolLockedByContract ? (
          <div className="panel-card p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h4 className="fw-bold mb-0">Yük Havuzu ({carrierDisplayedPool.length})</h4>
              {!carrierFiltersOpen ? (
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => setCarrierFiltersOpen(true)}
                  aria-expanded={carrierFiltersOpen}
                  title="Filtreleri Göster"
                >
                  <i className="bi bi-funnel"></i>
                </button>
              ) : null}
            </div>
            {carrierFiltersOpen ? (
              <div className="row g-2 align-items-end mb-3">
              <div className="col-md-3">
                <label className="form-label fw-semibold">Taşıma Modu</label>
                <select
                  className="form-select shipment-input"
                  value={carrierFilterMode}
                  onChange={(e) => setCarrierFilterMode(e.target.value as 'all' | 'intracity' | 'intercity')}
                >
                  <option value="all">Tümü</option>
                  <option value="intracity">Şehir İçi</option>
                  <option value="intercity">Şehirler Arası</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label fw-semibold">İl</label>
                <select
                  id="carrier-filter-city"
                  className="form-select shipment-input"
                  value={carrierFilterCityId}
                  onChange={(e) => setCarrierFilterCityId(e.target.value)}
                >
                  <option value="">Tüm İller</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label fw-semibold">İlçe</label>
                <select
                  className="form-select shipment-input"
                  value={carrierFilterDistrict}
                  onChange={(e) => setCarrierFilterDistrict(e.target.value)}
                  disabled={!carrierFilterCityId}
                >
                  <option value="">Tüm İlçeler</option>
                  {carrierFilterDistricts.map((district) => (
                    <option key={district.id} value={district.name}>{district.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label fw-semibold">Yarıçap</label>
                <select
                  className="form-select shipment-input"
                  value={carrierRadiusKm}
                  onChange={(e) => setCarrierRadiusKm(Number(e.target.value))}
                  disabled={!carrierNearbyCenter}
                >
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={25}>25 km</option>
                  <option value={50}>50 km</option>
                  <option value={100}>100 km</option>
                </select>
              </div>
              <div className="col-md-3 d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-success flex-fill"
                  onClick={() => applyNearbyCarrierFilter()}
                  disabled={carrierNearbyLoading}
                >
                  <i className="bi bi-geo-alt me-1"></i>
                  {carrierNearbyLoading ? 'Konum...' : 'Yakınımdakiler'}
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={clearCarrierPoolFilters}>
                  Temizle
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => setCarrierFiltersOpen((prev) => !prev)}
                  aria-expanded={carrierFiltersOpen}
                  title={carrierFiltersOpen ? 'Filtreleri Gizle' : 'Filtreleri Göster'}
                >
                  <i className={`bi ${carrierFiltersOpen ? 'bi-funnel-fill' : 'bi-funnel'}`}></i>
                </button>
              </div>
              </div>
            ) : null}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div className="small text-secondary">
                <i className="bi bi-pin-map me-1"></i>
                {carrierNearbyLabel ? (
                  <>
                    Yakın filtre aktif: <strong>{carrierNearbyLabel}</strong> · Yarıçap: <strong>{carrierRadiusKm} km</strong>
                  </>
                ) : (
                  <>Yakın filtre aktif değil</>
                )}
              </div>
              <select
                className="form-select form-select-sm shipment-input"
                value={carrierSortMode}
                onChange={(e) =>
                  setCarrierSortMode(
                    e.target.value as 'newest' | 'oldest' | 'nearest' | 'farthest' | 'most_offers',
                  )
                }
                style={{ minWidth: 220, maxWidth: 280 }}
              >
                <option value="newest">Sıralama: En Yeni</option>
                <option value="oldest">Sıralama: En Eski</option>
                <option value="nearest">Sıralama: En Yakın</option>
                <option value="farthest">Sıralama: En Uzak</option>
                <option value="most_offers">Sıralama: En Çok Teklif</option>
              </select>
            </div>
            {carrierDisplayedPool.length === 0 ? (
              <div className="text-secondary">Teklif verilebilecek yeni yük bulunmuyor.</div>
            ) : (
              <div className="carrier-pool-premium-grid">
                {carrierDisplayedPool.map((shipment) => {
                  const loadAttributesFromDescription = parseDescriptionLine(shipment.description, 'Yük Niteliği');
                  const topMetaText =
                    loadAttributesFromDescription && loadAttributesFromDescription.trim() !== '-'
                      ? loadAttributesFromDescription
                      : 'Teklife açık ilan';
                  const isTopMetaFallback = topMetaText === 'Teklife açık ilan';
                  const loadMetric =
                    typeof shipment.estimatedWeightKg === 'number' && shipment.estimatedWeightKg > 0
                      ? `${shipment.estimatedWeightKg} kg`
                      : typeof shipment.estimatedVolumeM3 === 'number' && shipment.estimatedVolumeM3 > 0
                        ? `${shipment.estimatedVolumeM3} m3`
                        : typeof shipment.pieceCount === 'number' && shipment.pieceCount > 0
                          ? `${shipment.pieceCount} adet`
                          : '-';
                  const metaMode = MODE_LABEL[shipment.transportMode] || 'Standart';
                  const loadTypeSlugFromPayload =
                    shipment.loadTypeSlug ||
                    (typeof shipment.cargoTypeId === 'object' ? (shipment.cargoTypeId?.slug || '') : '');
                  const loadTypeNameFromPayload =
                    typeof shipment.cargoTypeId === 'object' ? (shipment.cargoTypeId?.name || '') : '';
                  const loadTypeFromDescription = parseDescriptionLine(shipment.description, 'Yük Tipi');
                  const loadTypeText =
                    (loadTypeSlugFromPayload && (loadTypeLabelMap[loadTypeSlugFromPayload] || loadTypeSlugFromPayload)) ||
                    loadTypeNameFromPayload ||
                    loadTypeFromDescription ||
                    'Belirtilmemiş';
                  const recommendedVehicleTypeTextFromDescription = parseDescriptionLine(shipment.description, 'Araç Tipi');
                  const recommendedVehicleCount = Array.isArray(shipment.recommendedVehicleTypeIds)
                    ? shipment.recommendedVehicleTypeIds.length
                    : 0;
                  const recommendedVehicleText =
                    recommendedVehicleTypeTextFromDescription ||
                    (recommendedVehicleCount > 0 ? `${recommendedVehicleCount} uygun araç tipi` : 'Belirtilmemiş');
                  const totalOfferCount =
                    typeof shipment.offerCount === 'number'
                      ? shipment.offerCount
                      : shipment.status === 'offer_collecting'
                        ? 1
                        : 0;
                  const budgetFromDescription = parseDescriptionLine(shipment.description, 'Bütçe Aralığı');
                  const pickupDistanceKm =
                    carrierNearbyCenter && typeof carrierDistanceMap[shipment._id] === 'number'
                      ? carrierDistanceMap[shipment._id]
                      : null;
                  const budgetText =
                    budgetFromDescription && budgetFromDescription.trim() && budgetFromDescription.trim() !== '-'
                      ? budgetFromDescription.trim()
                      : '';
                  const budgetParts = budgetText
                    ? budgetText
                        .split('-')
                        .map((part) => part.trim())
                        .filter(Boolean)
                    : [];
                  const formatBudgetPart = (raw: string) => {
                    const cleaned = raw.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
                    const num = Number(cleaned);
                    if (Number.isFinite(num) && num > 0) {
                      return Math.round(num).toLocaleString('tr-TR');
                    }
                    return raw.replace(/[^\d.,-]/g, '').trim() || raw;
                  };
                  const budgetSummary =
                    budgetParts.length >= 2
                      ? `${formatBudgetPart(budgetParts[0])} - ${formatBudgetPart(budgetParts[1])}`
                      : budgetText
                        ? formatBudgetPart(budgetText)
                        : 'Bütçe girilmedi';
                  const distanceText = typeof pickupDistanceKm === 'number'
                    ? `Yükleme noktasına ${pickupDistanceKm.toFixed(1)} km`
                    : 'Yükleme noktasına uzaklık hesaplanamadı';
                  const pickupLabel = `${shipment.pickupCity || '-'} / ${shipment.pickupDistrict || '-'}`;
                  const dropoffLabel = `${shipment.dropoffCity || '-'} / ${shipment.dropoffDistrict || '-'}`;
                  const durationLabel =
                    typeof shipment.routeDurationMin === 'number'
                      ? `${Math.floor(shipment.routeDurationMin / 60)}s ${shipment.routeDurationMin % 60}dk`
                      : 'Süre hesaplanıyor';
                  return (
                    <article key={shipment._id} className="carrier-pool-premium-card">
                      <div className="carrier-pool-premium-top">
                        <div className="carrier-pool-premium-top-left">
                          <i className="bi bi-stars"></i>
                          <div>
                            <strong>{shipment.title}</strong>
                            <p className={`carrier-pool-premium-top-submeta ${isTopMetaFallback ? 'is-fallback' : ''}`}>
                              {topMetaText}
                            </p>
                          </div>
                        </div>
                        <div className="carrier-pool-premium-top-side">
                          <span className="carrier-pool-budget-note">
                            <span className="carrier-pool-budget-note-label">Bütçe Beklentisi</span>
                            <span className="carrier-pool-budget-note-value">{budgetSummary}</span>
                          </span>
                          <button
                            type="button"
                            className="carrier-pool-report-btn"
                            title="Bu ilanı şikayet et"
                            onClick={() => void openShipmentComplaintModal(shipment)}
                          >
                            <i className="bi bi-info-circle carrier-pool-premium-top-info"></i>
                          </button>
                        </div>
                      </div>

                      <div className="carrier-pool-premium-main">
                        <div className="carrier-pool-premium-main-left">
                          <div className="carrier-pool-premium-route-core">
                            <div className="carrier-pool-premium-center-meta">
                              <span className="carrier-pool-premium-center-chip">
                                <span className="carrier-pool-premium-center-meta-icon">
                                  <i className="bi bi-truck"></i>
                                </span>
                                <span className="carrier-pool-premium-center-meta-text">
                                  Uygun Araçlar: {recommendedVehicleText}
                                </span>
                              </span>
                              {loadTypeText !== 'Belirtilmemiş' ? (
                                <span className="carrier-pool-premium-center-chip is-load-type">
                                  <span className="carrier-pool-premium-center-meta-icon">
                                    <i className="bi bi-box-seam"></i>
                                  </span>
                                  <span className="carrier-pool-premium-center-meta-text">
                                    Yük Tipi: {loadTypeText}
                                  </span>
                                </span>
                              ) : null}
                            </div>
                            <div className="carrier-pool-premium-times">
                              <div className="carrier-pool-premium-pickup-stack">
                                <span className="carrier-pool-premium-brand-dot">
                                  <i className="bi bi-geo-alt-fill"></i>
                                </span>
                                <div className="carrier-pool-premium-point-block">
                                  <strong>{pickupLabel}</strong>
                                  <span className="carrier-pool-point-label is-pickup">
                                    <span className="carrier-pool-point-glyph">
                                      <i className="bi bi-box-seam"></i>
                                    </span>
                                    <span className="carrier-pool-point-text">Yükleme Noktası</span>
                                  </span>
                                </div>
                              </div>
                              <div className="carrier-pool-premium-journey">
                                <span>{durationLabel}</span>
                                <div className="carrier-pool-premium-line">
                                  <i className="bi bi-caret-right-fill"></i>
                                </div>
                                <em>{metaMode}</em>
                                <small className="carrier-pool-premium-journey-note">
                                  <i className="bi bi-geo-alt"></i>
                                  <span>{distanceText}</span>
                                </small>
                              </div>
                              <div>
                                <strong>{dropoffLabel}</strong>
                                <span className="carrier-pool-point-label is-dropoff">
                                  <span className="carrier-pool-point-glyph">
                                    <i className="bi bi-pin-map-fill"></i>
                                  </span>
                                  <span className="carrier-pool-point-text">Teslimat Noktası</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="carrier-pool-premium-main-right">
                          <div className="carrier-pool-offer-count-pill">
                            <i className="bi bi-chat-left-text"></i>
                            <span>{totalOfferCount} teklif</span>
                          </div>
                          <strong className="carrier-pool-load-metric">{loadMetric !== '-' ? loadMetric : 'Yük bilgisi yok'}</strong>
                          <Link to={`/hesabim/yuk/${shipment._id}`} className="carrier-pool-premium-cta carrier-pool-cta-modern">
                            Teklif Ver
                            <i className="bi bi-arrow-right ms-2"></i>
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {carrierTab === 'nearby_map' && !isCarrierPoolLockedByContract ? (
          <NearbyLoadsMapPanel
            loads={carrierPool}
            onOpenDetail={(shipmentId) => navigate(`/hesabim/yuk/${shipmentId}`)}
          />
        ) : null}

        {carrierTab === 'active_jobs' ? (
          <div className="panel-card p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="fw-bold mb-0">Aktif Taşımalar ({carrierActiveJobs.length})</h4>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void refreshCarrierJobs()}>
                Yenile
              </button>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Toplam Kabul</small><h4>{carrierJobs.summary.totalAccepted}</h4></div></div>
              <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Aktif</small><h4>{carrierJobs.summary.active}</h4></div></div>
              <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Planlı</small><h4>{carrierJobs.summary.upcoming}</h4></div></div>
              <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Geçmiş</small><h4>{carrierJobs.summary.past}</h4></div></div>
            </div>
            {carrierActiveJobs.length === 0 ? (
              <div className="text-secondary">Aktif kabul edilmiş taşıma bulunmuyor.</div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Yük</th>
                      <th>Rota</th>
                      <th>Araç</th>
                      <th>Tutar</th>
                      <th>Kabul Tarihi</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrierActiveJobs.map((job) => (
                      <tr key={job.offerId}>
                        <td>
                          {job.shipment?._id ? (
                            <Link to={`/hesabim/yuk/${job.shipment._id}`} className="text-decoration-none fw-semibold">
                              {job.shipment?.title || '-'}
                            </Link>
                          ) : (
                            job.shipment?.title || '-'
                          )}
                        </td>
                        <td>
                          {job.shipment?.pickupCity || '-'} / {job.shipment?.pickupDistrict || '-'} {'>'} {job.shipment?.dropoffCity || '-'} / {job.shipment?.dropoffDistrict || '-'}
                        </td>
                        <td>
                          {(job.vehicle?.plateMasked || '-')} {job.vehicle?.brand || ''} {job.vehicle?.model || ''}
                        </td>
                        <td>{formatTryCurrency(job.price)}</td>
                        <td>{formatDate(job.acceptedAt)}</td>
                        <td>
                          <span className={`shipment-status-pill ${job.jobBucket === 'active' ? 'tone-success' : 'tone-info'}`}>
                            {job.jobBucket === 'active' ? 'Aktif' : 'Planlı'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {carrierTab === 'offered' ? (
          <div className="panel-card p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h4 className="fw-bold mb-1">Teklif Verdiğim İlanlar</h4>
                <p className="text-secondary mb-0">İlan bazlı görünüm: teklif verdiğin yüklerin güncel durumu.</p>
              </div>
              <span className="badge text-bg-light fs-6">{carrierOffered.length} kayıt</span>
            </div>
            {carrierOffered.length === 0 ? (
              <div className="text-secondary">Henüz teklif verdiğiniz yük yok.</div>
            ) : (
              <div className="carrier-offers-premium-list">
                {carrierOffered.map((item) => (
                  <article key={item._id} className="carrier-offers-premium-card">
                    <div className="carrier-offers-premium-main">
                      <div className="carrier-offers-premium-top">
                        <div>
                          <strong className="carrier-offers-premium-title">{item.title || '-'}</strong>
                          <div className="carrier-offers-premium-route">
                            {`${item.pickupCity || '-'} / ${item.dropoffCity || '-'}`}
                          </div>
                        </div>
                        <span className={`shipment-status-pill ${offerStatusPillTone(item.myOfferStatus)}`}>
                          {offerStatusLabel(item.myOfferStatus)}
                        </span>
                      </div>
                      <div className="carrier-offers-premium-meta">
                        <span>
                          <i className="bi bi-truck" /> {item.transportMode === 'intercity' ? 'Şehirler Arası' : 'Şehir İçi'}
                        </span>
                        <span>
                          <i className="bi bi-calendar3" /> {item.createdAt ? new Date(item.createdAt).toLocaleDateString('tr-TR') : '-'}
                        </span>
                      </div>
                    </div>
                    <div className="carrier-offers-premium-right">
                      <strong className="carrier-offers-price">{formatTryCurrency(item.myOfferPrice)}</strong>
                      <Link to={`/hesabim/yuk/${item._id}`} className="btn btn-sm btn-outline-primary">
                        İlan Detayı
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {carrierTab === 'offers' ? (
          <div className="panel-card p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h4 className="fw-bold mb-1">Teklif Kayıtlarım</h4>
                <p className="text-secondary mb-0">Teklif bazlı görünüm: araç, fiyat, durum ve tarih detayları.</p>
              </div>
              <span className="badge text-bg-light fs-6">{carrierOffers.length} kayıt</span>
            </div>
            {carrierOffers.length === 0 ? (
              <div className="text-secondary">Henüz teklif kaydı bulunmuyor.</div>
            ) : (
              <div className="carrier-offers-premium-list">
                {carrierOffers.map((offer) => (
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
                          <i className="bi bi-calendar3" /> {formatDate(offer.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="carrier-offers-premium-right">
                      <strong className="carrier-offers-price">{formatTryCurrency(offer.price)}</strong>
                      {offer.shipmentId?._id ? (
                        <Link to={`/hesabim/yuk/${offer.shipmentId._id}`} className="btn btn-sm btn-outline-primary">
                          İlan Detayı
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : null}

      </section>
    );
  }

  return (
    <section className="container py-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <h1 className="shipment-page-title mb-0">Gönderi Oluştur</h1>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/hesabim?panel=shipments&shipperTab=open_pool" className="btn btn-sm btn-outline-primary">
            Aktif İlanlar
          </Link>
          <Link to="/hesabim?panel=shipments&shipperTab=completed" className="btn btn-sm btn-outline-success">
            Tamamlanan İlanlar
          </Link>
          <Link to="/hesabim?panel=shipments&shipperTab=expired" className="btn btn-sm btn-outline-danger">
            Süresi Biten İlanlar
          </Link>
        </div>
      </div>
      {message ? <div className="alert alert-warning">{message}</div> : null}
      {registerContractPending.length > 0 ? (
        <div className="alert alert-warning d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong>Güncel sözleşme onayı gerekli.</strong>
            <div className="small">
              {registerContractPending.length} sözleşme güncellendi. Yük işlemlerine devam etmek için onaylayın.
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-warning"
              disabled={registerContractSaving}
              onClick={() => void handleResolveRegisterContracts()}
            >
              {registerContractSaving ? 'Kaydediliyor...' : 'Sözleşmeleri Onayla'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={registerContractChecking}
              onClick={() => void refreshRegisterContractCompliance(profile?.role)}
            >
              {registerContractChecking ? 'Kontrol ediliyor...' : 'Yenile'}
            </button>
          </div>
        </div>
      ) : null}

      {registerContractPending.length === 0 ? (
        <div className="shipment-create-shell">
          <div className="panel-card p-4">
            <h3 className="shipment-section-title">Oluşturma Tipi</h3>
            <div className="shipment-load-scope-switch shipment-mode-switch mt-1">
              <button
                type="button"
                className={`shipment-mode-btn shipment-mode-btn--quick shipment-mode-btn--xl ${creationMode === 'quick' ? 'is-active' : ''}`}
                onClick={() => setCreationMode('quick')}
              >
                Hızlı Yük Oluştur
              </button>
              <button
                type="button"
                className={`shipment-mode-btn shipment-mode-btn--detailed shipment-mode-btn--xl ${creationMode === 'detailed' ? 'is-active' : ''}`}
                onClick={() => setCreationMode('detailed')}
              >
                Detaylı Yük Oluştur
              </button>
            </div>
            <small className="text-secondary d-block mt-2">
              {!creationMode
                ? 'Önce oluşturma tipini seçin. Alt alanlar seçiminize göre açılır.'
                : creationMode === 'quick'
                  ? 'Hızlı modda temel bilgilerle ilan açılır, yük tipi ve araç tipi otomatik atanır.'
                  : 'Detaylı modda tüm alanları doldurarak daha hassas eşleşme alırsınız.'}
            </small>
            {creationMode === 'quick' ? (
              <div className="mt-3">
                <label className="form-label mb-2">Hızlı Yük Tipi (Belli Başlı)</label>
                <div className="shipment-preset-row">
                  {(quickLoadTypeOptions.length ? quickLoadTypeOptions : (formOptions?.cargoTypes || []).slice(0, 6)).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`shipment-preset-chip ${effectiveLoadTypeSlug === item.slug ? 'is-active' : ''}`}
                      onClick={() => setSelectedLoadTypeSlug(item.slug)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {creationMode ? (
            <>
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
          <h3 className="shipment-section-title">2. İlan Bilgileri</h3>
          <div className="row g-3">
            <div className="col-md-12">
              <label className="form-label">İlan Başlığı</label>
              <input
                className="form-control shipment-input"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value.replace(/\r?\n/g, ''))}
                placeholder={creationMode === 'quick' ? 'İsteğe bağlı (boş bırakılırsa otomatik oluşturulur)' : 'Tek satır başlık giriniz'}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">İlan Açıklaması</label>
              <textarea className="form-control shipment-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
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
              <h3 className="shipment-section-title">Çıkış Konumu</h3>
              <div className="row g-3">
                <div className="col-md-12">
                  {(originResolvedLocation || originAddress?.trim() || originManualEdit) ? (
                    <>
                      <label className="form-label">Çıkış konumu</label>
                      {originManualEdit ? (
                        <div className="shipment-location-input-wrap">
                          <input
                            className={`form-control shipment-input shipment-location-input ${originManualEdit ? 'is-editing' : ''}`}
                            value={originAddress}
                            readOnly={!originManualEdit}
                            onChange={(e) => setOriginAddress(e.target.value)}
                            placeholder="Google aramadan seçim yapınız"
                          />
                          <button
                            type="button"
                            className={`btn shipment-location-edit-btn ${originManualEdit ? 'is-active' : ''}`}
                            onClick={() => setOriginManualEdit(false)}
                            title="Düzenlemeyi kapat"
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="shipment-location-display">
                          <div className="shipment-location-display-label">
                            <i className="bi bi-info-circle"></i> Seçili çıkış konumu
                          </div>
                          <div className="shipment-location-display-main">
                            <span>{originAddress?.trim() ? originAddress : 'Henüz çıkış konumu seçilmedi. Altta Google arama ile seçebilirsiniz.'}</span>
                            <button
                              type="button"
                              className="btn shipment-location-edit-btn"
                              onClick={() => setOriginManualEdit(true)}
                              title="Konumu düzenle"
                            >
                              <i className="bi bi-pencil-square"></i>
                            </button>
                          </div>
                        </div>
                      )}
                      {originResolvedLocation ? (
                        <div className="shipment-resolved-location mt-2">
                          <div className="shipment-resolved-location-title">
                            <i className="bi bi-geo-alt-fill"></i> Google konum çözümü
                          </div>
                          <div className="shipment-resolved-location-meta">
                            <div className="shipment-resolved-location-row">
                              <span>İl:</span>
                              <strong>{originResolvedLocation.cityName || '-'}</strong>
                            </div>
                            <div className="shipment-resolved-location-row">
                              <span>İlçe:</span>
                              <strong>{originResolvedLocation.districtName || '-'}</strong>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary shipment-resolved-map-btn"
                              onClick={() => openLocationMapPreview(originResolvedLocation, 'Çıkış Konumu')}
                            >
                              <i className="bi bi-map me-1"></i>
                              Haritada Göster
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="form-check mt-2">
                        <input
                          id="origin-extra-note"
                          type="checkbox"
                          className="form-check-input"
                          checked={originExtraEnabled}
                          onChange={(e) => setOriginExtraEnabled(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="origin-extra-note">
                          Ekstra konum tarifi ekle
                        </label>
                      </div>
                      {originExtraEnabled ? (
                        <textarea
                          className="form-control shipment-input mt-2"
                          rows={2}
                          value={originExtraNote}
                          onChange={(e) => setOriginExtraNote(e.target.value)}
                          placeholder="Bina girişi, kapı no, güvenlik noktası, kat vb. ek bilgi"
                        />
                      ) : null}
                    </>
                  ) : null}
                  <div className="shipment-map-search mt-2">
                    <label className="form-label mb-1">Google Harita ile konum ara</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-search"></i></span>
                      <input
                        className="form-control shipment-input"
                        value={originSearchQuery}
                        onChange={(e) => setOriginSearchQuery(e.target.value)}
                        placeholder="Çıkış konumu ara (adres, otel, resmi kurum vb.)"
                        disabled={!GOOGLE_MAPS_API_KEY || !!mapsLoadError}
                      />
                    </div>
                    {!GOOGLE_MAPS_API_KEY || mapsLoadError ? (
                      <small className="text-secondary d-block mt-1">Google arama pasif. {mapsLoadError || 'VITE_GOOGLE_MAPS_API_KEY tanımlayın.'}</small>
                    ) : null}
                    {originSearchBusy ? <small className="text-secondary d-block mt-1">Adresler aranıyor...</small> : null}
                    {originSuggestions.length ? (
                      <div className="shipment-map-suggestion-list mt-2">
                        {originSuggestions.map((item) => (
                          <button
                            key={item.placeId}
                            type="button"
                            className="shipment-map-suggestion-item"
                            onClick={() => loadPlaceDetails('origin', item.placeId)}
                          >
                            <strong>{item.mainText}</strong>
                            {item.secondaryText ? <small>{item.secondaryText}</small> : <small>{item.description}</small>}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
              <h3 className="shipment-section-title">Varış Konumu</h3>
              <div className="row g-3">
                <div className="col-md-12">
                  {(destinationResolvedLocation || destinationAddress?.trim() || destinationManualEdit) ? (
                    <>
                      <label className="form-label">Varış konumu</label>
                      {destinationManualEdit ? (
                        <div className="shipment-location-input-wrap">
                          <input
                            className={`form-control shipment-input shipment-location-input ${destinationManualEdit ? 'is-editing' : ''}`}
                            value={destinationAddress}
                            readOnly={!destinationManualEdit}
                            onChange={(e) => setDestinationAddress(e.target.value)}
                            placeholder="Google aramadan seçim yapınız"
                          />
                          <button
                            type="button"
                            className={`btn shipment-location-edit-btn ${destinationManualEdit ? 'is-active' : ''}`}
                            onClick={() => setDestinationManualEdit(false)}
                            title="Düzenlemeyi kapat"
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="shipment-location-display">
                          <div className="shipment-location-display-label">
                            <i className="bi bi-info-circle"></i> Seçili varış konumu
                          </div>
                          <div className="shipment-location-display-main">
                            <span>{destinationAddress?.trim() ? destinationAddress : 'Henüz varış konumu seçilmedi. Altta Google arama ile seçebilirsiniz.'}</span>
                            <button
                              type="button"
                              className="btn shipment-location-edit-btn"
                              onClick={() => setDestinationManualEdit(true)}
                              title="Konumu düzenle"
                            >
                              <i className="bi bi-pencil-square"></i>
                            </button>
                          </div>
                        </div>
                      )}
                      {destinationResolvedLocation ? (
                        <div className="shipment-resolved-location mt-2">
                          <div className="shipment-resolved-location-title">
                            <i className="bi bi-geo-alt-fill"></i> Google konum çözümü
                          </div>
                          <div className="shipment-resolved-location-meta">
                            <div className="shipment-resolved-location-row">
                              <span>İl:</span>
                              <strong>{destinationResolvedLocation.cityName || '-'}</strong>
                            </div>
                            <div className="shipment-resolved-location-row">
                              <span>İlçe:</span>
                              <strong>{destinationResolvedLocation.districtName || '-'}</strong>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary shipment-resolved-map-btn"
                              onClick={() => openLocationMapPreview(destinationResolvedLocation, 'Varış Konumu')}
                            >
                              <i className="bi bi-map me-1"></i>
                              Haritada Göster
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="form-check mt-2">
                        <input
                          id="destination-extra-note"
                          type="checkbox"
                          className="form-check-input"
                          checked={destinationExtraEnabled}
                          onChange={(e) => setDestinationExtraEnabled(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="destination-extra-note">
                          Ekstra konum tarifi ekle
                        </label>
                      </div>
                      {destinationExtraEnabled ? (
                        <textarea
                          className="form-control shipment-input mt-2"
                          rows={2}
                          value={destinationExtraNote}
                          onChange={(e) => setDestinationExtraNote(e.target.value)}
                          placeholder="Teslimat kapısı, rampa, giriş kuralları vb. ek bilgi"
                        />
                      ) : null}
                    </>
                  ) : null}
                  <div className="shipment-map-search mt-2">
                    <label className="form-label mb-1">Google Harita ile konum ara</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-search"></i></span>
                      <input
                        className="form-control shipment-input"
                        value={destinationSearchQuery}
                        onChange={(e) => setDestinationSearchQuery(e.target.value)}
                        placeholder="Varış konumu ara (adres, otel, resmi kurum vb.)"
                        disabled={!GOOGLE_MAPS_API_KEY || !!mapsLoadError}
                      />
                    </div>
                    {!GOOGLE_MAPS_API_KEY || mapsLoadError ? (
                      <small className="text-secondary d-block mt-1">Google arama pasif. {mapsLoadError || 'VITE_GOOGLE_MAPS_API_KEY tanımlayın.'}</small>
                    ) : null}
                    {destinationSearchBusy ? <small className="text-secondary d-block mt-1">Adresler aranıyor...</small> : null}
                    {destinationSuggestions.length ? (
                      <div className="shipment-map-suggestion-list mt-2">
                        {destinationSuggestions.map((item) => (
                          <button
                            key={item.placeId}
                            type="button"
                            className="shipment-map-suggestion-item"
                            onClick={() => loadPlaceDetails('destination', item.placeId)}
                          >
                            <strong>{item.mainText}</strong>
                            {item.secondaryText ? <small>{item.secondaryText}</small> : <small>{item.description}</small>}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
                <div className="col-md-8">
                  <label className="form-label">Ölçü / Kapasite Değeri</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control shipment-input"
                    value={measurementValue}
                    onChange={(e) => setMeasurementValue(e.target.value)}
                    placeholder="Örn: 40"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Birim</label>
                  <select
                    className="form-select shipment-input"
                    value={measurementUnit}
                    onChange={(e) => setMeasurementUnit(e.target.value as 'kg' | 'ton' | 'm3' | 'adet')}
                  >
                    <option value="kg">kg</option>
                    <option value="ton">ton</option>
                    <option value="m3">m3</option>
                    <option value="adet">adet</option>
                  </select>
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
                {isTimedDelivery ? (
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
                ) : null}
              </div>

              <div className="row g-2 mt-2">
                {(creationMode === 'quick'
                  ? ['Kırılabilir', 'Hassas', 'Soğuk Zincir', 'Sıvı', 'Tehlikeli Madde']
                  : ['Kırılabilir', 'Hassas', 'Soğuk Zincir', 'Sıvı', 'Tehlikeli Madde', 'Saatli Teslimat', 'Vinç Gerekli', 'Forklift Gerekli']
                ).map((attr) => (
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

        {creationMode === 'detailed' ? (
        <div className="panel-card p-4">
          <h3 className="shipment-section-title">3. Gönderi Segmenti</h3>
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
        ) : null}

        {creationMode === 'detailed' ? (
        <div className="panel-card p-4">
          <h3 className="shipment-section-title">4. Yük Tipi</h3>
          {optionsLoading ? (
            <div className="text-secondary">Yük tipleri yükleniyor...</div>
          ) : (
            <div className="shipment-cargo-group shipment-cargo-group-horizontal">
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
        ) : null}

        {creationMode === 'detailed' ? (
        <div className="panel-card p-4">
          <h3 className="shipment-section-title">5. Araç Tipi</h3>
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
        ) : null}

        {creationMode === 'detailed' ? (
        <div className="panel-card p-4">
          <h3 className="shipment-section-title">Seçim Özeti</h3>
          <div className="row g-2">
            <div className="col-md-6 col-lg-3">
              <div className="border rounded-3 p-2 h-100">
                <small className="text-secondary d-block">Gönderi Segmenti</small>
                <strong>{segmentConfig.label}</strong>
              </div>
            </div>
            <div className="col-md-6 col-lg-3">
              <div className="border rounded-3 p-2 h-100">
                <small className="text-secondary d-block">Alt Kategori</small>
                <strong>{activeSubCategory?.label || '-'}</strong>
              </div>
            </div>
            <div className="col-md-6 col-lg-3">
              <div className="border rounded-3 p-2 h-100">
                <small className="text-secondary d-block">Yük Tipi</small>
                <strong>{selectedLoadTypeLabel}</strong>
              </div>
            </div>
            <div className="col-md-6 col-lg-3">
              <div className="border rounded-3 p-2 h-100">
                <small className="text-secondary d-block">Araç Tipi</small>
                <strong>{selectedVehicleTypeLabel}</strong>
              </div>
            </div>
          </div>
        </div>
        ) : null}





        {creationMode === 'detailed' && (optionsLoading || hasFieldRules) ? (
        <div className="panel-card p-4">
          <h3 className="shipment-section-title">6. Yük Tipine Özel Alanlar</h3>
          {optionsLoading ? <div className="text-secondary">Alanlar yükleniyor...</div> : null}
          {!optionsLoading && hasFieldRules ? (
            <div className="row g-3">
              {formOptions?.fieldRules?.map((rule) => (
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
        </div>
        ) : null}

        <div className="d-flex justify-content-end">
          <button type="button" className="btn shipment-submit-btn" onClick={openPreview} disabled={submitting}>
            <i className={`bi ${creationMode === 'quick' ? 'bi-lightning-charge' : 'bi-eye'} me-2`}></i>
            {submitting ? 'Kaydediliyor...' : creationMode === 'quick' ? 'Hızlı Yük Oluştur' : 'Önizle ve Yayınla'}
          </button>
        </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="panel-card p-4">
          <h3 className="shipment-section-title mb-2">Yük Oluşturma Geçici Olarak Beklemede</h3>
          <p className="text-secondary mb-0">
            Güncel sözleşme onayı tamamlanmadan yük oluşturma adımları görüntülenmez.
          </p>
        </div>
      )}

      {previewOpen ? (
        <div className="shipment-preview-backdrop" onClick={() => setPreviewOpen(false)}>
          <div className="shipment-preview-modal panel-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h3 className="shipment-section-title mb-1">İlan Önizleme</h3>
                <p className="text-secondary mb-0">Yayınlamadan önce detayları kontrol edin.</p>
              </div>
              <button type="button" className="btn btn-light" onClick={() => setPreviewOpen(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="row g-3">
              <div className="col-md-6"><strong>Başlık:</strong> {title || '-'}</div>
              <div className="col-md-6"><strong>Taşıma Modu:</strong> {MODE_LABEL[computedTransportMode]}</div>
              <div className="col-md-6"><strong>Yük Yapısı:</strong> {loadScope}</div>
              <div className="col-md-6"><strong>Gönderi Segmenti:</strong> {segmentConfig.label}</div>
              <div className="col-md-6"><strong>Alt Kategori:</strong> {activeSubCategory?.label || '-'}</div>
              <div className="col-md-6"><strong>Zaman:</strong> {scheduleMode === 'today' ? 'Bugün' : scheduleMode === 'tomorrow' ? 'Yarın' : 'Planlı Tarih'}</div>
              <div className="col-md-6"><strong>Ölçü / Kapasite:</strong> {measurementValue ? `${measurementValue} ${measurementUnit}` : '-'}</div>
              <div className="col-md-6"><strong>Teslim Tarihi:</strong> {isTimedDelivery ? (deadlineDate ? `${deadlineDate} ${deadlineTime || ''}`.trim() : '-') : 'Saatli değil'}</div>
              <div className="col-md-6"><strong>Yük Tipi:</strong> {selectedLoadTypeLabel}</div>
              <div className="col-md-6"><strong>Araç Tipi:</strong> {selectedVehicleTypeLabel}</div>
              <div className="col-md-6"><strong>Mesafe:</strong> {routeInfo ? `${routeInfo.distanceKm} km` : '-'}</div>
              <div className="col-md-6">
                <strong>Süre:</strong>{' '}
                {routeInfo
                  ? `${routeInfo.durationMin} dk${
                      (routeInfo.durationMultiplier || 1) > 1
                        ? ` (Araç katsayısı x${(routeInfo.durationMultiplier || 1).toFixed(2)})`
                        : ''
                    }`
                  : '-'}
              </div>
              <div className="col-md-6"><strong>Çıkış:</strong> {originCityName || '-'} / {originDistrict || '-'}</div>
              <div className="col-md-6"><strong>Varış:</strong> {destinationCityName || '-'} / {destinationDistrict || '-'}</div>
              <div className="col-md-6"><strong>Çıkış Tarifi:</strong> {originExtraEnabled ? (originExtraNote || '-') : '-'}</div>
              <div className="col-md-6"><strong>Varış Tarifi:</strong> {destinationExtraEnabled ? (destinationExtraNote || '-') : '-'}</div>
              <div className="col-md-12"><strong>Açıklama:</strong> {description || '-'}</div>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setPreviewOpen(false)}>Düzenlemeye Dön</button>
              <button type="button" className="btn shipment-submit-btn" onClick={submitShipment} disabled={submitting}>
                <i className="bi bi-rocket-takeoff me-2"></i>
                {submitting ? 'Kaydediliyor...' : 'İlanı Yayınla'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <MediaLightbox
        open={Boolean(mapPreviewUrl)}
        url={mapPreviewUrl}
        title={mapPreviewTitle || 'Konum Haritası'}
        onClose={() => setMapPreviewUrl('')}
      />
    </section>
  );
}

function parseDescriptionLine(raw: string | undefined, key: string): string {
  const lines = (raw || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const lowerKey = key.toLocaleLowerCase('tr-TR');
  const found = lines.find((line) => {
    const idx = line.indexOf(':');
    if (idx <= 0) return false;
    return line.slice(0, idx).trim().toLocaleLowerCase('tr-TR') === lowerKey;
  });
  if (!found) return '';
  const idx = found.indexOf(':');
  return idx >= 0 ? found.slice(idx + 1).trim() : '';
}











