import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { api, apiOrigin } from '../lib/api';
import { requireOfferContractConsent } from '../lib/offerContracts';
import Swal from 'sweetalert2';

type OfferLite = {
  _id: string;
  status: string;
  price?: number;
  serviceNotes?: string;
  createdAt?: string;
  carrierUserId?: { fullName?: string; phone?: string; status?: string };
  vehicleId?: { _id?: string; plateMasked?: string; brand?: string; model?: string };
  carrierReview?: { avg?: number; count?: number };
  carrierContractConsent?: {
    isAccepted?: boolean;
    contentSlug?: string;
    contentTitle?: string;
    acceptedAt?: string;
    snapshotHtml?: string;
  };
  shipperContractConsent?: {
    isAccepted?: boolean;
    contentSlug?: string;
    contentTitle?: string;
    acceptedAt?: string;
    snapshotHtml?: string;
  };
};

type ShipmentDetail = {
  _id: string;
  title: string;
  description?: string;
  status: string;
  transportMode: 'intracity' | 'intercity';
  pickupCity?: string;
  pickupDistrict?: string;
  dropoffCity?: string;
  dropoffDistrict?: string;
  pickupAddressText?: string;
  dropoffAddressText?: string;
  pickupGeo?: { type?: string; coordinates?: number[] };
  dropoffGeo?: { type?: string; coordinates?: number[] };
  routeDistanceKm?: number;
  routeDurationMin?: number;
  routeSummary?: string;
  scheduledPickupAt?: string;
  deliveryDeadlineAt?: string;
  isUrgent?: boolean;
  needsPackaging?: boolean;
  needsAssembly?: boolean;
  needsHelper?: boolean;
  needsElevator?: boolean;
  estimatedWeightKg?: number;
  estimatedVolumeM3?: number;
  pieceCount?: number;
  createdAt: string;
  canViewOffers?: boolean;
  offers?: OfferLite[];
  myOffer?: OfferLite | null;
  listingOwner?: {
    id?: string;
    fullName?: string;
    phone?: string;
    companyName?: string;
    companyTitle?: string;
    accountType?: string;
    reviewSummary?: { count?: number; avg?: number };
  } | null;
  recommendedVehicleTypes?: Array<{ _id?: string; name?: string; slug?: string }>;
  offerStats?: {
    total: number;
    submitted: number;
    accepted: number;
    rejected: number;
    withdrawn: number;
  };
};

type ShipmentsDetailedResponse = {
  rows: ShipmentDetail[];
};

type ViewerProfile = {
  id?: string;
  fullName?: string;
  role?: 'shipper' | 'carrier' | 'admin';
  phone?: string;
  email?: string;
  city?: string;
  district?: string;
};

type ConversationMessage = {
  _id: string;
  conversationId?: string;
  senderUserId?: string | { _id?: string; fullName?: string };
  messageType?: 'text' | 'image' | 'system' | 'offer_event' | string;
  text?: string;
  attachments?: string[];
  createdAt?: string;
};

type ShipmentReviewRow = {
  _id: string;
  rating?: number;
  comment?: string;
  createdAt?: string;
  reviewerUserId?: { _id?: string; fullName?: string; role?: string } | string;
  reviewedUserId?: { _id?: string; fullName?: string; role?: string } | string;
};

type ShipmentReviewResponse = {
  shipmentId?: string;
  status?: string;
  canReview?: boolean;
  myReview?: ShipmentReviewRow | null;
  reviewTarget?: { userId?: string; fullName?: string; role?: string } | null;
  reviews?: ShipmentReviewRow[];
};

type OfferContractRequirementLite = {
  required?: boolean;
  contract?: {
    slug?: string;
    title?: string;
    checkboxLabel?: string;
    body?: string;
    snapshotHtml?: string;
    contractUrl?: string;
  };
};

export function ShipmentDetailPage() {
  const navigate = useNavigate();
  const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const { shipmentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [viewerRole, setViewerRole] = useState<ViewerProfile['role']>();
  const [viewerUserId, setViewerUserId] = useState('');
  const [viewerFullName, setViewerFullName] = useState('');
  const [viewerPhone, setViewerPhone] = useState('');
  const [viewerEmail, setViewerEmail] = useState('');
  const [viewerCity, setViewerCity] = useState('');
  const [viewerDistrict, setViewerDistrict] = useState('');
  const [activeTab, setActiveTab] = useState<'detail' | 'map' | 'offers'>('detail');
  const [shipperOfferSort, setShipperOfferSort] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'rating_desc' | 'comments_desc'>('newest');
  const [carrierVehicles, setCarrierVehicles] = useState<Array<{ _id: string; plateMasked?: string; brand?: string; model?: string; status?: string; vehicleTypeId?: string | { _id?: string } }>>([]);
  const [carrierOfferDraft, setCarrierOfferDraft] = useState<{ vehicleId: string; amount: string; note: string }>({
    vehicleId: '',
    amount: '',
    note: '',
  });
  const [carrierOfferLoading, setCarrierOfferLoading] = useState(false);
  const [carrierOfferContractRequired, setCarrierOfferContractRequired] = useState(false);
  const [carrierOfferContractSlug, setCarrierOfferContractSlug] = useState('');
  const [carrierOfferContractTitle, setCarrierOfferContractTitle] = useState('Teklif Sözleşmesi');
  const [carrierOfferContractCheckboxLabel, setCarrierOfferContractCheckboxLabel] = useState(
    'Okudum, anladım ve kabul ediyorum.',
  );
  const [carrierOfferContractHtml, setCarrierOfferContractHtml] = useState('');
  const [carrierOfferContractUrl, setCarrierOfferContractUrl] = useState('');
  const [carrierOfferContractAccepted, setCarrierOfferContractAccepted] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number; summary: string } | null>(null);
  const [chatOpen] = useState(false);
  const [conversationId] = useState('');
  const [chatMessages, setChatMessages] = useState<ConversationMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatConnecting, setChatConnecting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewData, setReviewData] = useState<ShipmentReviewResponse | null>(null);
  const [reviewDraft, setReviewDraft] = useState<{ rating: number; comment: string }>({ rating: 0, comment: '' });

  const routeMapContainerRef = useRef<HTMLDivElement | null>(null);
  const routeMapRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);

  const modeLabel = (mode?: 'intracity' | 'intercity') => (mode === 'intercity' ? 'Şehirler Arası' : 'Şehir İçi');
  const maskName = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return 'K*** T***';
    return raw
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => `${part.charAt(0).toLocaleUpperCase('tr-TR')}***`)
      .join(' ');
  };
  const getInitials = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return 'KT';
    const parts = raw.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'KT';
    if (parts.length === 1) return parts[0].slice(0, 1).toLocaleUpperCase('tr-TR');
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toLocaleUpperCase('tr-TR');
  };
  const escapeHtml = (value?: string) =>
    String(value || '-')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const statusLabel = (status?: string) => {
    const map: Record<string, string> = {
      draft: 'Taslak',
      published: 'Yayında',
      offer_collecting: 'Teklif Topluyor',
      matched: 'Eşleşti',
      cancelled: 'İptal',
      completed: 'Tamamlandı',
      suspended: 'Durduruldu',
      submitted: 'Verildi',
      updated: 'Güncellendi',
      withdrawn: 'Geri Çekildi',
      accepted: 'Kabul',
      rejected: 'Reddedildi',
      expired: 'Süresi Doldu',
    };
    return map[status || ''] || status || '-';
  };

  const statusTone = (status?: string) => {
    if (['completed', 'accepted'].includes(status || '')) return 'success';
    if (['rejected', 'cancelled', 'withdrawn', 'suspended'].includes(status || '')) return 'danger';
    if (['offer_collecting', 'submitted', 'updated', 'draft'].includes(status || '')) return 'warning';
    return 'info';
  };

  const formatDateTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };
  const formatCurrencyInput = (raw?: string | number) => {
    const digits = String(raw ?? '')
      .replace(/[^\d]/g, '')
      .replace(/^0+(?=\d)/, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('tr-TR');
  };
  const parseCurrencyInput = (raw?: string) => {
    const digits = String(raw || '').replace(/[^\d]/g, '');
    if (!digits) return 0;
    const num = Number(digits);
    return Number.isFinite(num) ? num : 0;
  };

  const load = async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) setLoading(true);
    if (!shipmentId) {
      setMessage('Yük ID bulunamadı.');
      if (!silent) setLoading(false);
      return;
    }
    try {
      try {
        const { data: me } = await api.get<ViewerProfile>('/users/me/profile');
        setViewerRole(me?.role);
        setViewerUserId(String(me?.id || ''));
        setViewerFullName(String(me?.fullName || ''));
        setViewerPhone(String(me?.phone || ''));
        setViewerEmail(String(me?.email || ''));
        setViewerCity(String(me?.city || ''));
        setViewerDistrict(String(me?.district || ''));
      } catch {
        setViewerRole(undefined);
        setViewerUserId('');
        setViewerFullName('');
        setViewerPhone('');
        setViewerEmail('');
        setViewerCity('');
        setViewerDistrict('');
      }

      try {
        const { data } = await api.get<ShipmentsDetailedResponse>('/shipments/my/detailed');
        const found = (data?.rows || []).find((row) => row._id === shipmentId) || null;
        if (found) {
          setShipment(found);
          setMessage('');
          return;
        }
      } catch {
        // Shipper dışı kullanıcılar bu endpointte 403 alabilir.
      }

      const fallback = await api.get<ShipmentDetail>(`/shipments/${shipmentId}`);
      if (fallback.data?._id) {
        setShipment(fallback.data);
        setMessage('');
        return;
      }

      setShipment(null);
      setMessage('Yük kaydı bulunamadı veya bu kayda erişim yetkiniz yok.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Yük detayı yüklenemedi.');
      setShipment(null);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  const offers = useMemo(() => shipment?.offers || [], [shipment?.offers]);
  const shipperSortedOffers = useMemo(() => {
    const rows = [...offers];
    if (shipperOfferSort === 'oldest') {
      rows.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      return rows;
    }
    if (shipperOfferSort === 'price_asc') {
      rows.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      return rows;
    }
    if (shipperOfferSort === 'price_desc') {
      rows.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
      return rows;
    }
    if (shipperOfferSort === 'rating_desc') {
      rows.sort((a, b) => Number(b.carrierReview?.avg || 0) - Number(a.carrierReview?.avg || 0));
      return rows;
    }
    if (shipperOfferSort === 'comments_desc') {
      rows.sort((a, b) => Number(b.carrierReview?.count || 0) - Number(a.carrierReview?.count || 0));
      return rows;
    }
    rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return rows;
  }, [offers, shipperOfferSort]);
  const viewMode = useMemo<'shipper' | 'carrier' | 'readonly'>(() => {
    if (viewerRole === 'carrier') return 'carrier';
    if (shipment?.canViewOffers) return 'shipper';
    return 'readonly';
  }, [viewerRole, shipment?.canViewOffers]);
  const canViewOffers = viewMode === 'shipper';
  const isCarrierViewer = viewMode === 'carrier';
  const canViewMap = canViewOffers || isCarrierViewer;
  const desc = useMemo(() => parseDescription(shipment?.description), [shipment?.description]);
  const recommendedVehicles = useMemo(
    () => (shipment?.recommendedVehicleTypes || []).filter((item) => item?.name || item?.slug),
    [shipment?.recommendedVehicleTypes],
  );
  const recommendedVehicleTypeIds = useMemo(
    () => new Set((shipment?.recommendedVehicleTypes || []).map((x) => String(x._id || '')).filter(Boolean)),
    [shipment?.recommendedVehicleTypes],
  );
  const suitableCarrierVehicles = useMemo(() => {
    if (!carrierVehicles.length) return [] as typeof carrierVehicles;
    if (!recommendedVehicleTypeIds.size) return carrierVehicles;
    return carrierVehicles.filter((v) => {
      const typeId = typeof v.vehicleTypeId === 'string' ? v.vehicleTypeId : v.vehicleTypeId?._id;
      return typeId ? recommendedVehicleTypeIds.has(String(typeId)) : false;
    });
  }, [carrierVehicles, recommendedVehicleTypeIds]);
  const singleSuitableVehicle = suitableCarrierVehicles.length === 1 ? suitableCarrierVehicles[0] : null;
  const sentOffers = useMemo(() => {
    if (canViewOffers) return [] as OfferLite[];
    if (offers.length) return offers;
    return shipment?.myOffer ? [shipment.myOffer] : [];
  }, [canViewOffers, offers, shipment?.myOffer]);
  const activeCarrierOffer = isCarrierViewer ? sentOffers[0] || null : null;
  const carrierMutableStatuses = new Set(['submitted', 'updated']);
  const isShipmentOfferableForCarrier = ['published', 'offer_collecting'].includes(String(shipment?.status || ''));
  const carrierOfferLockReason = useMemo(() => {
    if (!isCarrierViewer) return '';
    if (!shipment) return 'Yük bilgisi bulunamadı.';
    if (!isShipmentOfferableForCarrier) {
      return `Bu ilan ${statusLabel(shipment.status)} durumunda olduğu için teklif işlemleri kapalı.`;
    }
    if (activeCarrierOffer && !carrierMutableStatuses.has(String(activeCarrierOffer.status || ''))) {
      const statusMap: Record<string, string> = {
        accepted: 'Teklifiniz kabul edildiği için artık güncelleyemez veya geri çekemezsiniz.',
        rejected: 'Teklifiniz reddedildiği için artık güncelleyemez veya geri çekemezsiniz.',
        withdrawn: 'Teklifinizi geri çektiğiniz için yeniden düzenleyemezsiniz.',
        expired: 'Teklifinizin süresi dolduğu için güncelleme kapalı.',
        cancelled: 'Teklif kaydı iptal edildiği için güncelleme kapalı.',
      };
      return statusMap[String(activeCarrierOffer.status || '')] || 'Teklifinizin mevcut durumu güncellemeye uygun değil.';
    }
    return '';
  }, [isCarrierViewer, shipment, isShipmentOfferableForCarrier, activeCarrierOffer]);
  const canCarrierEditOffer = Boolean(isCarrierViewer && !carrierOfferLockReason);
  const canCarrierWithdrawOffer = Boolean(
    canCarrierEditOffer && activeCarrierOffer && carrierMutableStatuses.has(String(activeCarrierOffer.status || '')),
  );
  const offerTabCount = useMemo(() => {
    if (canViewOffers) return offers.length;
    if (isCarrierViewer) return sentOffers.length;
    return offers.length;
  }, [canViewOffers, isCarrierViewer, offers.length, sentOffers.length]);
  const acceptedOfferForConversation = useMemo(() => {
    if (isCarrierViewer) {
      if (shipment?.myOffer && shipment.myOffer.status === 'accepted') return shipment.myOffer;
      return null;
    }
    if (canViewOffers) return offers.find((offer) => offer.status === 'accepted') || null;
    return null;
  }, [isCarrierViewer, shipment?.myOffer, canViewOffers, offers]);
  const acceptedContractDocs = useMemo(() => {
    const offer = acceptedOfferForConversation;
    if (!offer) return [] as Array<{
      key: string;
      roleLabel: string;
      title: string;
      acceptedAt?: string;
      slug?: string;
      snapshotHtml: string;
    }>;
    const rows: Array<{
      key: string;
      roleLabel: string;
      title: string;
      acceptedAt?: string;
      slug?: string;
      snapshotHtml: string;
    }> = [];
    if (offer.carrierContractConsent?.isAccepted && offer.carrierContractConsent?.snapshotHtml) {
      rows.push({
        key: 'carrier',
        roleLabel: 'Taşıyıcı Onayı',
        title: offer.carrierContractConsent.contentTitle || 'Taşıyıcı Teklif Sözleşmesi',
        acceptedAt: offer.carrierContractConsent.acceptedAt,
        slug: offer.carrierContractConsent.contentSlug,
        snapshotHtml: offer.carrierContractConsent.snapshotHtml,
      });
    }
    if (offer.shipperContractConsent?.isAccepted && offer.shipperContractConsent?.snapshotHtml) {
      rows.push({
        key: 'shipper',
        roleLabel: 'Gönderici Onayı',
        title: offer.shipperContractConsent.contentTitle || 'Gönderici Teklif Kabul Sözleşmesi',
        acceptedAt: offer.shipperContractConsent.acceptedAt,
        slug: offer.shipperContractConsent.contentSlug,
        snapshotHtml: offer.shipperContractConsent.snapshotHtml,
      });
    }
    return rows;
  }, [acceptedOfferForConversation]);
  const canStartConversation = Boolean(
    shipmentId &&
      shipment?.status === 'matched' &&
      acceptedOfferForConversation?._id,
  );
  const canCompleteShipment = Boolean(
    shipmentId &&
      shipment?.status === 'matched' &&
      (canViewOffers || (isCarrierViewer && acceptedOfferForConversation?._id)),
  );
  const canViewAddressDetails = Boolean(
    shipment?.status === 'matched' &&
      (canViewOffers || (isCarrierViewer && acceptedOfferForConversation?._id)),
  );
  const shouldLoadReviews = Boolean(
    shipmentId &&
      shipment?.status === 'completed' &&
      (canViewOffers || isCarrierViewer),
  );
  const showConversationCard = Boolean((isCarrierViewer || canViewOffers) && canStartConversation);
  const shouldShowOfferPromptCard = Boolean(isCarrierViewer && sentOffers.length === 0);
  const counterpartyReview = useMemo(() => {
    const rows = reviewData?.reviews || [];
    if (!viewerUserId || rows.length === 0) return null;
    return (
      rows.find((row) => {
        const reviewerId = typeof row.reviewerUserId === 'string' ? row.reviewerUserId : String(row.reviewerUserId?._id || '');
        const reviewedId = typeof row.reviewedUserId === 'string' ? row.reviewedUserId : String(row.reviewedUserId?._id || '');
        return reviewedId === viewerUserId && reviewerId !== viewerUserId;
      }) || null
    );
  }, [reviewData?.reviews, viewerUserId]);
  const counterpartyReviewerName = useMemo(() => {
    if (!counterpartyReview) return '';
    return typeof counterpartyReview.reviewerUserId === 'string'
      ? ''
      : String(counterpartyReview.reviewerUserId?.fullName || '');
  }, [counterpartyReview]);
  const shouldShowReciprocalReviewPrompt = Boolean(reviewData?.canReview && !reviewData?.myReview && counterpartyReview);
  const canViewMutualReviews = Boolean(reviewData?.myReview && counterpartyReview);
  const conversationPeer = useMemo(() => {
    if (!showConversationCard || !shipment) return { title: 'Mesajlaşma', name: '-', phone: '-' };
    if (isCarrierViewer) {
      return {
        title: 'İlan Sahibi Bilgileri',
        name: shipment.listingOwner?.fullName || 'Yük Sahibi',
        phone: shipment.listingOwner?.phone || '-',
      };
    }
    return {
      title: 'Taşıyıcı Bilgileri',
      name: acceptedOfferForConversation?.carrierUserId?.fullName || 'Taşıyıcı',
      phone: acceptedOfferForConversation?.carrierUserId?.phone || '-',
    };
  }, [showConversationCard, shipment, isCarrierViewer, acceptedOfferForConversation]);
  const maskedOwnerDisplayName = useMemo(() => {
    const raw = String(shipment?.listingOwner?.fullName || '').trim();
    if (!raw) return 'Y*** S***';
    return raw
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => `${part.charAt(0).toLocaleUpperCase('tr-TR')}***`)
      .join(' ');
  }, [shipment?.listingOwner?.fullName]);
  const ownerInitials = useMemo(() => {
    const raw = String(shipment?.listingOwner?.fullName || '').trim();
    if (!raw) return 'YS';
    const parts = raw.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'YS';
    if (parts.length === 1) return parts[0].slice(0, 1).toLocaleUpperCase('tr-TR');
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toLocaleUpperCase('tr-TR');
  }, [shipment?.listingOwner?.fullName]);
  const acceptedCarrierDisplay = useMemo(() => {
    const raw = String(acceptedOfferForConversation?.carrierUserId?.fullName || '').trim();
    if (!raw) return { maskedName: 'T***', initials: 'T' };
    const parts = raw.split(/\s+/).filter(Boolean);
    const maskedName = parts
      .slice(0, 3)
      .map((part) => `${part.charAt(0).toLocaleUpperCase('tr-TR')}***`)
      .join(' ');
    const initials =
      parts.length === 1
        ? parts[0].slice(0, 1).toLocaleUpperCase('tr-TR')
        : `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toLocaleUpperCase('tr-TR');
    return { maskedName, initials };
  }, [acceptedOfferForConversation?.carrierUserId?.fullName]);
  const maskedOwnerCompanyDisplay = useMemo(() => {
    const raw = String(shipment?.listingOwner?.companyTitle || shipment?.listingOwner?.companyName || '').trim();
    if (!raw) return '';
    return raw
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .map((part) => `${part.charAt(0).toLocaleUpperCase('tr-TR')}***`)
      .join(' ');
  }, [shipment?.listingOwner?.companyTitle, shipment?.listingOwner?.companyName]);
  const ownerReviewSummary = useMemo(() => {
    const summaryCount = Number(shipment?.listingOwner?.reviewSummary?.count || 0);
    const summaryAvg = Number(shipment?.listingOwner?.reviewSummary?.avg || 0);
    if (summaryCount > 0) {
      return {
        count: summaryCount,
        avg: Number(summaryAvg.toFixed(1)),
      };
    }
    const ownerId = String(shipment?.listingOwner?.id || '').trim();
    const rows = reviewData?.reviews || [];
    if (!ownerId || !rows.length) return { count: 0, avg: 0 };
    const ownerRows = rows.filter((row) => {
      const reviewedId = typeof row.reviewedUserId === 'string' ? row.reviewedUserId : String(row.reviewedUserId?._id || '');
      return reviewedId === ownerId;
    });
    if (!ownerRows.length) return { count: 0, avg: 0 };
    const total = ownerRows.reduce((sum, row) => sum + Number(row.rating || 0), 0);
    return {
      count: ownerRows.length,
      avg: Number((total / ownerRows.length).toFixed(1)),
    };
  }, [shipment?.listingOwner?.reviewSummary?.count, shipment?.listingOwner?.reviewSummary?.avg, shipment?.listingOwner?.id, reviewData?.reviews]);
  const conversationPeerReviewSummary = useMemo(() => {
    const rows = reviewData?.reviews || [];
    const reviewTargetId = String(reviewData?.reviewTarget?.userId || '').trim();
    const shipmentSpecificSummary = (() => {
      if (!rows.length || !reviewTargetId) return null;
      const targetRows = rows.filter((row) => {
        const reviewedId = typeof row.reviewedUserId === 'string' ? row.reviewedUserId : String(row.reviewedUserId?._id || '');
        return reviewedId === reviewTargetId;
      });
      if (!targetRows.length) return null;
      const total = targetRows.reduce((sum, row) => sum + Number(row.rating || 0), 0);
      return {
        count: targetRows.length,
        avg: Number((total / targetRows.length).toFixed(1)),
      };
    })();

    if (isCarrierViewer) {
      return {
        count: Number(ownerReviewSummary.count || 0),
        avg: Number(ownerReviewSummary.avg || 0),
      };
    }
    if (shipmentSpecificSummary) {
      return shipmentSpecificSummary;
    }
    return {
      count: Number(acceptedOfferForConversation?.carrierReview?.count || 0),
      avg: Number(acceptedOfferForConversation?.carrierReview?.avg || 0),
    };
  }, [
    reviewData?.reviews,
    reviewData?.reviewTarget?.userId,
    isCarrierViewer,
    ownerReviewSummary.count,
    ownerReviewSummary.avg,
    acceptedOfferForConversation?.carrierReview?.count,
    acceptedOfferForConversation?.carrierReview?.avg,
  ]);
  const summaryPersonCard = useMemo(() => {
    if (!shipment) {
      return { title: 'İlan Sahibi', name: 'Y*** S***', initials: 'YS', company: '', review: { count: 0, avg: 0 } };
    }
    if (!isCarrierViewer && canViewOffers && acceptedOfferForConversation) {
      return {
        title: 'Taşıyıcı',
        name: acceptedCarrierDisplay.maskedName,
        initials: acceptedCarrierDisplay.initials,
        company: '',
        review: {
          count: Number(conversationPeerReviewSummary.count || 0),
          avg: Number(conversationPeerReviewSummary.avg || 0),
        },
      };
    }
    return {
      title: 'İlan Sahibi',
      name: maskedOwnerDisplayName,
      initials: ownerInitials,
      company: maskedOwnerCompanyDisplay,
      review: {
        count: Number(ownerReviewSummary.count || 0),
        avg: Number(ownerReviewSummary.avg || 0),
      },
    };
  }, [
    shipment,
    isCarrierViewer,
    canViewOffers,
    acceptedOfferForConversation,
    acceptedCarrierDisplay.maskedName,
    acceptedCarrierDisplay.initials,
    conversationPeerReviewSummary.count,
    conversationPeerReviewSummary.avg,
    maskedOwnerDisplayName,
    ownerInitials,
    maskedOwnerCompanyDisplay,
    ownerReviewSummary.count,
    ownerReviewSummary.avg,
  ]);
  const operationDetails = useMemo(
    () => [
      { label: 'Yük Tipi', value: desc.cargoType || '-' },
      { label: 'Yük Yapısı', value: desc.loadType || '-' },
      { label: 'Yükleme Tarihi', value: desc.loadDate || formatDateTime(shipment?.scheduledPickupAt) },
      { label: 'Teslim Son Tarihi', value: desc.deadline || formatDateTime(shipment?.deliveryDeadlineAt) },
      { label: 'Bütçe Aralığı', value: desc.budget || '-' },
      { label: 'Yük Niteliği', value: desc.attributes || '-' },
      {
        label: 'Ölçü / Miktar',
        value:
          typeof shipment?.estimatedWeightKg === 'number' && shipment.estimatedWeightKg > 0
            ? `${shipment.estimatedWeightKg} kg`
            : typeof shipment?.estimatedVolumeM3 === 'number' && shipment.estimatedVolumeM3 > 0
              ? `${shipment.estimatedVolumeM3} m3`
              : typeof shipment?.pieceCount === 'number' && shipment.pieceCount > 0
                ? `${shipment.pieceCount} adet`
                : '-',
      },
      {
        label: 'Ek Hizmetler',
        value:
          [
            shipment?.needsPackaging ? 'Paketleme' : '',
            shipment?.needsAssembly ? 'Montaj' : '',
            shipment?.needsHelper ? 'Yardımcı Personel' : '',
            shipment?.needsElevator ? 'Asansör' : '',
          ]
            .filter(Boolean)
            .join(' • ') || '-',
      },
    ],
    [
      desc.cargoType,
      desc.loadType,
      desc.loadDate,
      desc.deadline,
      desc.budget,
      desc.attributes,
      shipment?.scheduledPickupAt,
      shipment?.deliveryDeadlineAt,
      shipment?.estimatedWeightKg,
      shipment?.estimatedVolumeM3,
      shipment?.pieceCount,
      shipment?.needsPackaging,
      shipment?.needsAssembly,
      shipment?.needsHelper,
      shipment?.needsElevator,
    ],
  );
  const addressDetails = useMemo(
    () => [
      { label: 'Çıkış Adresi', value: desc.pickupAddress || shipment?.pickupAddressText || '-' },
      { label: 'Varış Adresi', value: desc.dropoffAddress || shipment?.dropoffAddressText || '-' },
      { label: 'Ek Alanlar', value: desc.extra || '-' },
    ],
    [desc.pickupAddress, desc.dropoffAddress, desc.extra, shipment?.pickupAddressText, shipment?.dropoffAddressText],
  );

  useEffect(() => {
    if (!isCarrierViewer || !['offers', 'detail'].includes(activeTab)) return;
    let mounted = true;
    const loadVehicles = async () => {
      try {
        const { data } = await api.get<Array<{ _id: string; plateMasked?: string; brand?: string; model?: string; status?: string; vehicleTypeId?: string | { _id?: string } }>>('/vehicles/my');
        if (!mounted) return;
        const rows = Array.isArray(data) ? data : [];
        const activeRows = rows.filter((x) => x.status === 'active');
        setCarrierVehicles(activeRows);
      } catch {
        if (!mounted) return;
        setCarrierVehicles([]);
      }
    };
    void loadVehicles();
    return () => {
      mounted = false;
    };
  }, [isCarrierViewer, activeTab]);

  useEffect(() => {
    if (!isCarrierViewer || !['offers', 'detail'].includes(activeTab) || !shipmentId) return;
    let mounted = true;
    const loadCarrierOfferContractRequirement = async () => {
      try {
        const { data } = await api.get<OfferContractRequirementLite>('/offers/contract-requirements', {
          params: { shipmentId, action: 'carrier_offer' },
        });
        if (!mounted) return;
        const required = Boolean(data?.required);
        setCarrierOfferContractRequired(required);
        setCarrierOfferContractSlug(String(data?.contract?.slug || ''));
        setCarrierOfferContractTitle(String(data?.contract?.title || 'Teklif Sözleşmesi'));
        const backendCheckboxLabel = String(data?.contract?.checkboxLabel || '').trim();
        setCarrierOfferContractCheckboxLabel(
          backendCheckboxLabel
            ? backendCheckboxLabel.replace(/okudum,?\s*anlad[ıi]m?.*kabul ediyorum\.?/i, 'Sözleşmeyi okudum ve kabul ediyorum.')
            : 'Sözleşmeyi okudum ve kabul ediyorum.',
        );
        setCarrierOfferContractHtml(String(data?.contract?.snapshotHtml || data?.contract?.body || ''));
        setCarrierOfferContractUrl(String(data?.contract?.contractUrl || ''));
        setCarrierOfferContractAccepted(!required);
      } catch {
        if (!mounted) return;
        setCarrierOfferContractRequired(false);
        setCarrierOfferContractSlug('');
        setCarrierOfferContractTitle('Teklif Sözleşmesi');
        setCarrierOfferContractCheckboxLabel('Sözleşmeyi okudum ve kabul ediyorum.');
        setCarrierOfferContractHtml('');
        setCarrierOfferContractUrl('');
        setCarrierOfferContractAccepted(false);
      }
    };
    void loadCarrierOfferContractRequirement();
    return () => {
      mounted = false;
    };
  }, [isCarrierViewer, activeTab, shipmentId]);

  useEffect(() => {
    if (!isCarrierViewer) return;
    const my = shipment?.myOffer || null;

    let preferredVehicleId = '';
    if (my?.vehicleId?._id) preferredVehicleId = String(my.vehicleId._id);

    if (!preferredVehicleId && suitableCarrierVehicles[0]?._id) {
      preferredVehicleId = suitableCarrierVehicles[0]._id;
    }

    if (!preferredVehicleId && carrierVehicles[0]?._id) preferredVehicleId = carrierVehicles[0]._id;

    setCarrierOfferDraft({
      vehicleId: preferredVehicleId,
      amount: my?.price ? formatCurrencyInput(my.price) : '',
      note: my?.serviceNotes || '',
    });
  }, [isCarrierViewer, shipment?.myOffer, carrierVehicles, suitableCarrierVehicles]);

  const pickupCoords = useMemo(() => {
    const coords = shipment?.pickupGeo?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const [lng, lat] = coords;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return { lat, lng };
  }, [shipment?.pickupGeo?.coordinates]);

  const dropoffCoords = useMemo(() => {
    const coords = shipment?.dropoffGeo?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const [lng, lat] = coords;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return { lat, lng };
  }, [shipment?.dropoffGeo?.coordinates]);

  const originAddress = useMemo(
    () => [shipment?.pickupAddressText, shipment?.pickupDistrict, shipment?.pickupCity, 'Türkiye'].filter(Boolean).join(', '),
    [shipment?.pickupAddressText, shipment?.pickupDistrict, shipment?.pickupCity],
  );

  const destinationAddress = useMemo(
    () => [shipment?.dropoffAddressText, shipment?.dropoffDistrict, shipment?.dropoffCity, 'Türkiye'].filter(Boolean).join(', '),
    [shipment?.dropoffAddressText, shipment?.dropoffDistrict, shipment?.dropoffCity],
  );

  const mapEmbedUrl = useMemo(() => {
    const from = [shipment?.pickupAddressText, shipment?.pickupDistrict, shipment?.pickupCity].filter(Boolean).join(', ');
    const to = [shipment?.dropoffAddressText, shipment?.dropoffDistrict, shipment?.dropoffCity].filter(Boolean).join(', ');
    if (!from && !to) return '';
    const q = to || from;
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  }, [shipment?.pickupAddressText, shipment?.pickupDistrict, shipment?.pickupCity, shipment?.dropoffAddressText, shipment?.dropoffDistrict, shipment?.dropoffCity]);

  useEffect(() => {
    if (activeTab !== 'map') return;
    if (!GOOGLE_MAPS_API_KEY) {
      setMapError('Google Maps API key tanımlı değil.');
      return;
    }

    const scriptId = 'google-maps-sdk-shipment-detail';
    const googleObj = (window as any).google;
    if (googleObj?.maps) {
      setMapsReady(true);
      setMapError('');
      return;
    }

    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => setMapsReady(true), { once: true });
      existing.addEventListener('error', () => setMapError('Google Maps yüklenemedi.'), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&language=tr&region=TR`;
    script.onload = () => {
      setMapsReady(true);
      setMapError('');
    };
    script.onerror = () => setMapError('Google Maps yüklenemedi.');
    document.head.appendChild(script);
  }, [activeTab, GOOGLE_MAPS_API_KEY]);

  useEffect(() => {
    if (activeTab === 'map') return;
    try {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
    } catch {
      // no-op
    }
    routeMapRef.current = null;
    directionsRendererRef.current = null;
    directionsServiceRef.current = null;
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'map' || !mapsReady || !shipment || !routeMapContainerRef.current) return;
    const googleObj = (window as any).google;
    if (!googleObj?.maps?.DirectionsService) return;

    const existingMapDiv =
      routeMapRef.current && typeof routeMapRef.current.getDiv === 'function'
        ? routeMapRef.current.getDiv()
        : null;
    if (existingMapDiv && existingMapDiv !== routeMapContainerRef.current) {
      try {
        if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);
      } catch {
        // no-op
      }
      routeMapRef.current = null;
      directionsRendererRef.current = null;
      directionsServiceRef.current = null;
    }

    if (!routeMapRef.current) {
      routeMapRef.current = new googleObj.maps.Map(routeMapContainerRef.current, {
        center: pickupCoords || { lat: 39.1, lng: 35.2 },
        zoom: 6,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
    }

    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new googleObj.maps.DirectionsService();
    }

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new googleObj.maps.DirectionsRenderer({
        suppressMarkers: false,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: '#3E2C78',
          strokeOpacity: 0.95,
          strokeWeight: 6,
        },
      });
      directionsRendererRef.current.setMap(routeMapRef.current);
    }

    const origin = pickupCoords || originAddress;
    const destination = dropoffCoords || destinationAddress;
    if (!origin || !destination) {
      setMapError('Rota için çıkış/varış bilgisi eksik.');
      return;
    }

    directionsServiceRef.current.route(
      {
        origin,
        destination,
        travelMode: googleObj.maps.TravelMode.DRIVING,
        region: 'TR',
        provideRouteAlternatives: false,
      },
      (result: any, status: string) => {
        if (status !== 'OK' || !result?.routes?.length) {
          setMapError('Rota çizilemedi. Adres bilgilerini kontrol edin.');
          return;
        }

        setMapError('');
        directionsRendererRef.current.setDirections(result);

        const leg = result.routes?.[0]?.legs?.[0];
        const meters = Number(leg?.distance?.value || 0);
        const seconds = Number(leg?.duration?.value || 0);
        const distanceKm = Number((meters / 1000).toFixed(1));
        const durationMin = Math.max(1, Math.round(seconds / 60));
        const summary = String(result.routes?.[0]?.summary || shipment.routeSummary || '');
        setRouteInfo({ distanceKm, durationMin, summary });

        window.setTimeout(() => {
          try {
            googleObj.maps.event.trigger(routeMapRef.current, 'resize');
            const bounds = result.routes?.[0]?.bounds;
            if (bounds) routeMapRef.current.fitBounds(bounds);
          } catch {
            // no-op
          }
        }, 140);
      },
    );
  }, [activeTab, mapsReady, shipment, pickupCoords, dropoffCoords, originAddress, destinationAddress]);

  const handleOfferAction = async (offerId: string, action: 'accept' | 'reject') => {
    setActionLoadingId(offerId);
    setMessage('');
    try {
      if (action === 'accept') {
        if (!shipmentId) {
          setActionLoadingId('');
          return;
        }
        const contractConsent = await requireOfferContractConsent({
          shipmentId,
          offerId,
          action: 'shipper_accept',
          partiesIntroHtml: buildShipperAcceptContractPartiesHtml(offerId),
        });
        if (contractConsent === null) {
          setActionLoadingId('');
          return;
        }
        await api.patch(`/offers/${offerId}/${action}`, { contractConsent });
      } else {
        await api.patch(`/offers/${offerId}/${action}`);
      }
      await load({ silent: true });
      setMessage(action === 'accept' ? 'Teklif kabul edildi.' : 'Teklif reddedildi.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Teklif işlemi başarısız.');
    } finally {
      setActionLoadingId('');
    }
  };

  const buildShipperAcceptContractPartiesHtml = (offerId: string) => {
    const todayLabel = new Date().toLocaleDateString('tr-TR');
    const selectedOffer = offers.find((item) => item._id === offerId);

    const shipperName = viewerFullName || shipment?.listingOwner?.fullName || 'Yük Sahibi';
    const shipperPhone = viewerPhone || shipment?.listingOwner?.phone || '-';
    const shipperAddress = [viewerDistrict, viewerCity].filter(Boolean).join(' / ') || [shipment?.pickupDistrict, shipment?.pickupCity].filter(Boolean).join(' / ') || '-';
    const shipperEmail = viewerEmail || '-';

    const carrierName = selectedOffer?.carrierUserId?.fullName || 'Taşıyıcı';
    const carrierPhone = selectedOffer?.carrierUserId?.phone || '-';

    return `
      <div style="margin-bottom:14px; border:1px solid #e5e7eb; border-radius:10px; padding:12px; background:#f8fafc;">
        <h4 style="margin:0 0 8px; font-size:16px;">1. TARAFLAR</h4>
        <p style="margin:0 0 8px;">
          İşbu Taşıma Hizmet Sözleşmesi (“Sözleşme”), aşağıda bilgileri yer alan:
        </p>
        <p style="margin:0 0 6px;"><strong>1.1. YÜK / GÖNDERİ SAHİBİ (“Taşıtan”)</strong></p>
        <p style="margin:0;">
          Ad / Ticaret Unvanı: ${escapeHtml(shipperName)}<br/>
          T.C. Kimlik No / Vergi No: -<br/>
          Adres: ${escapeHtml(shipperAddress)}<br/>
          Telefon: ${escapeHtml(shipperPhone)}<br/>
          E-posta: ${escapeHtml(shipperEmail)}<br/>
        </p>
        <p style="margin:10px 0 6px;"><strong>1.2. TAŞIMACI (“Taşıyıcı”)</strong></p>
        <p style="margin:0;">
          Ad / Ticaret Unvanı: ${escapeHtml(carrierName)}<br/>
          T.C. Kimlik No / Vergi No: -<br/>
          Yetki Belge No: -<br/>
          Adres: -<br/>
          Telefon: ${escapeHtml(carrierPhone)}<br/>
          E-posta: -<br/>
        </p>
        <p style="margin:10px 0 0;">
          Kargomobil dijital nakliye platformu üzerinden bir taşıma hizmeti için eşleşmeleri üzerine elektronik ortamda akdedilmiştir.
          Taşıtan ve Taşıyıcı birlikte “Taraflar” olarak anılacaktır.<br/>
          Tarih: ${escapeHtml(todayLabel)}
        </p>
      </div>
    `;
  };

  const buildCarrierOfferContractDocumentHtml = () => {
    const todayLabel = new Date().toLocaleDateString('tr-TR');
    const shipperName = shipment?.listingOwner?.fullName || 'Yük Sahibi';
    const shipperPhone = shipment?.listingOwner?.phone || '-';
    const shipperAddress = [shipment?.pickupDistrict, shipment?.pickupCity].filter(Boolean).join(' / ') || '-';
    const carrierName = viewerFullName || shipment?.myOffer?.carrierUserId?.fullName || '-';
    const carrierPhone = shipment?.myOffer?.carrierUserId?.phone || viewerPhone || '-';
    const carrierAddress = [viewerDistrict, viewerCity].filter(Boolean).join(' / ') || '-';
    const carrierEmail = viewerEmail || '-';
    const partiesIntroHtml = `
      <div style="margin-bottom:14px; border:1px solid #e5e7eb; border-radius:10px; padding:12px; background:#f8fafc;">
        <h4 style="margin:0 0 8px; font-size:16px;">1. TARAFLAR</h4>
        <p style="margin:0 0 8px;">
          İşbu Taşıma Hizmet Sözleşmesi (“Sözleşme”), aşağıda bilgileri yer alan:
        </p>
        <p style="margin:0 0 6px;"><strong>1.1. YÜK / GÖNDERİ SAHİBİ (“Taşıtan”)</strong></p>
        <p style="margin:0;">
          Ad / Ticaret Unvanı: ${escapeHtml(shipperName)}<br/>
          T.C. Kimlik No / Vergi No: -<br/>
          Adres: ${escapeHtml(shipperAddress)}<br/>
          Telefon: ${escapeHtml(shipperPhone)}<br/>
          E-posta: -<br/>
        </p>
        <p style="margin:10px 0 6px;"><strong>1.2. TAŞIMACI (“Taşıyıcı”)</strong></p>
        <p style="margin:0;">
          Ad / Ticaret Unvanı: ${escapeHtml(carrierName)}<br/>
          T.C. Kimlik No / Vergi No: -<br/>
          Yetki Belge No: -<br/>
          Adres: ${escapeHtml(carrierAddress)}<br/>
          Telefon: ${escapeHtml(carrierPhone)}<br/>
          E-posta: ${escapeHtml(carrierEmail)}<br/>
        </p>
        <p style="margin:10px 0 0;">
          Kargomobil dijital nakliye platformu üzerinden bir taşıma hizmeti için eşleşmeleri üzerine elektronik ortamda akdedilmiştir.
          Taşıtan ve Taşıyıcı birlikte “Taraflar” olarak anılacaktır.<br/>
          Tarih: ${escapeHtml(todayLabel)}
        </p>
      </div>
    `;

    const fullContractHtml = `${partiesIntroHtml}${carrierOfferContractHtml || '<p>Sözleşme metni bulunamadı.</p>'}`;
    return { partiesIntroHtml, fullContractHtml };
  };

  const downloadCarrierOfferContractPdf = () => {
    const { fullContractHtml } = buildCarrierOfferContractDocumentHtml();
    const win = window.open('', '_blank', 'width=980,height=800');
    if (!win) return;
    win.document.open();
    win.document.write(`
      <html>
        <head>
          <title>${escapeHtml(carrierOfferContractTitle || 'Teklif Sözleşmesi')}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 16mm; }
            body { font-family: Arial, sans-serif; margin: 0; color: #111827; line-height: 1.45; }
            h1, h2, h3, h4 { margin: 0 0 10px; }
            p { margin: 0 0 8px; }
          </style>
        </head>
        <body>${fullContractHtml}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    const triggerPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        // no-op
      }
    };
    win.onload = () => {
      window.setTimeout(triggerPrint, 120);
    };
    window.setTimeout(triggerPrint, 420);
  };

  const openCarrierOfferContractLightbox = async () => {
    if (!carrierOfferContractHtml && !carrierOfferContractUrl) {
      await Swal.fire({
        icon: 'info',
        title: 'Sözleşme Bulunamadı',
        text: 'Görüntülenecek sözleşme metni bulunamadı.',
        confirmButtonText: 'Tamam',
      });
      return;
    }
    const { partiesIntroHtml } = buildCarrierOfferContractDocumentHtml();

    await Swal.fire({
      title: carrierOfferContractTitle || 'Teklif Sözleşmesi',
      width: 980,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        const btn = document.getElementById('download-contract-pdf');
        if (btn) {
          btn.addEventListener('click', () => downloadCarrierOfferContractPdf());
        }
      },
      html: `
        <div style="text-align:left;">
          <div style="margin-bottom:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button id="download-contract-pdf" type="button" class="swal2-confirm swal2-styled" style="display:inline-flex;">PDF Olarak İndir</button>
          </div>
          <div style="max-height:62vh; overflow:auto; border:1px solid #e5e7eb; border-radius:10px; padding:12px; background:#fff;">
            ${partiesIntroHtml}
            ${carrierOfferContractHtml || '<p>Sözleşme metni bulunamadı.</p>'}
          </div>
        </div>
      `,
    });
  };

  const downloadAcceptedContractSnapshotPdf = (title: string, snapshotHtml: string) => {
    const win = window.open('', '_blank', 'width=980,height=800');
    if (!win) return;
    win.document.open();
    win.document.write(`
      <html>
        <head>
          <title>${escapeHtml(title || 'Sözleşme Snapshot')}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 16mm; }
            body { font-family: Arial, sans-serif; margin: 0; color: #111827; line-height: 1.45; }
            h1, h2, h3, h4 { margin: 0 0 10px; }
            p { margin: 0 0 8px; }
          </style>
        </head>
        <body>${snapshotHtml || '<p>Sözleşme metni bulunamadı.</p>'}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    const triggerPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        // no-op
      }
    };
    win.onload = () => {
      window.setTimeout(triggerPrint, 120);
    };
    window.setTimeout(triggerPrint, 420);
  };

  const openAcceptedContractSnapshotLightbox = async (title: string, snapshotHtml: string) => {
    if (!snapshotHtml) {
      await Swal.fire({
        icon: 'info',
        title: 'Sözleşme Bulunamadı',
        text: 'Görüntülenecek sözleşme metni bulunamadı.',
        confirmButtonText: 'Tamam',
      });
      return;
    }

    await Swal.fire({
      title: title || 'Kabul Edilen Sözleşme',
      width: 980,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        const btn = document.getElementById('download-accepted-contract-pdf');
        if (btn) {
          btn.addEventListener('click', () => downloadAcceptedContractSnapshotPdf(title, snapshotHtml));
        }
      },
      html: `
        <div style="text-align:left;">
          <div style="margin-bottom:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button id="download-accepted-contract-pdf" type="button" class="swal2-confirm swal2-styled" style="display:inline-flex;">PDF Olarak İndir</button>
          </div>
          <div style="max-height:62vh; overflow:auto; border:1px solid #e5e7eb; border-radius:10px; padding:12px; background:#fff;">
            ${snapshotHtml}
          </div>
        </div>
      `,
    });
  };

  const handleCarrierOfferSubmit = async () => {
    if (!shipmentId) return;
    if (carrierOfferLockReason) {
      setMessage(carrierOfferLockReason);
      await Swal.fire({ icon: 'warning', title: 'İşlem Kısıtlı', text: carrierOfferLockReason, confirmButtonText: 'Tamam' });
      return;
    }
    if (!carrierOfferDraft.vehicleId || !carrierOfferDraft.amount) {
      setMessage('Teklif için araç ve tutar zorunludur.');
      await Swal.fire({ icon: 'warning', title: 'Uyarı', text: 'Teklif için araç ve tutar zorunludur.', confirmButtonText: 'Tamam' });
      return;
    }
    const amount = parseCurrencyInput(carrierOfferDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Teklif tutarı geçerli bir sayı olmalıdır.');
      await Swal.fire({ icon: 'warning', title: 'Uyarı', text: 'Teklif tutarı geçerli bir sayı olmalıdır.', confirmButtonText: 'Tamam' });
      return;
    }
    if (carrierOfferContractRequired && !carrierOfferContractAccepted) {
      const warningText = 'Devam etmek için sözleşmeyi işaretlemeniz zorunludur.';
      setMessage(warningText);
      await Swal.fire({ icon: 'warning', title: 'Sözleşme Onayı Gerekli', text: warningText, confirmButtonText: 'Tamam' });
      return;
    }

    setCarrierOfferLoading(true);
    try {
      const successText = sentOffers.length ? 'Teklif başarıyla güncellendi.' : 'Teklif başarıyla kaydedildi.';
      const contractConsent = carrierOfferContractRequired
        ? { accepted: true, contractSlug: carrierOfferContractSlug || undefined }
        : await requireOfferContractConsent({
            shipmentId,
            action: 'carrier_offer',
          });
      if (contractConsent === null) {
        setCarrierOfferLoading(false);
        return;
      }
      await api.post('/offers', {
        shipmentId,
        vehicleId: carrierOfferDraft.vehicleId,
        amount,
        note: carrierOfferDraft.note || undefined,
        contractConsent,
      });
      setMessage(successText);
      await Swal.fire({ icon: 'success', title: 'Başarılı', text: successText, confirmButtonText: 'Tamam' });
      await load({ silent: true });
    } catch (error: any) {
      const errorText = error?.response?.data?.message || 'Teklif kaydedilemedi.';
      setMessage(errorText);
      await Swal.fire({ icon: 'error', title: 'Hata', text: errorText, confirmButtonText: 'Tamam' });
    } finally {
      setCarrierOfferLoading(false);
    }
  };

  const handleCarrierWithdraw = async (offerId: string) => {
    if (carrierOfferLockReason) {
      setMessage(carrierOfferLockReason);
      await Swal.fire({ icon: 'warning', title: 'İşlem Kısıtlı', text: carrierOfferLockReason, confirmButtonText: 'Tamam' });
      return;
    }
    setCarrierOfferLoading(true);
    try {
      await api.patch(`/offers/${offerId}/withdraw`);
      setMessage('Teklif geri çekildi.');
      await Swal.fire({ icon: 'success', title: 'Başarılı', text: 'Teklif geri çekildi.', confirmButtonText: 'Tamam' });
      await load({ silent: true });
    } catch (error: any) {
      const errorText = error?.response?.data?.message || 'Teklif geri çekilemedi.';
      setMessage(errorText);
      await Swal.fire({ icon: 'error', title: 'Hata', text: errorText, confirmButtonText: 'Tamam' });
    } finally {
      setCarrierOfferLoading(false);
    }
  };

  const startConversation = async () => {
    if (!shipmentId || !acceptedOfferForConversation?._id) {
      setMessage('Mesajlaşma için kabul edilmiş teklif bulunamadı.');
      return;
    }

    setChatLoading(true);
    try {
      const { data } = await api.post<{ _id?: string }>('/conversations', {
        shipmentId,
        offerId: acceptedOfferForConversation._id,
      });
      const nextConversationId = String(data?._id || '');
      if (!nextConversationId) throw new Error('Konuşma başlatılamadı.');

      navigate(`/mesajlar?conversationId=${encodeURIComponent(nextConversationId)}`);
    } catch (error: any) {
      setChatLoading(false);
      setMessage(error?.response?.data?.message || error?.message || 'Mesajlaşma başlatılamadı.');
    } finally {
      setChatLoading(false);
    }
  };

  const sendConversationMessage = async () => {
    const text = chatInput.trim();
    if (!conversationId || !text) return;

    setChatSending(true);
    try {
      const { data } = await api.post<ConversationMessage>(`/conversations/${conversationId}/messages`, {
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

  const loadReviews = async () => {
    if (!shipmentId || !shouldLoadReviews) {
      setReviewData(null);
      return;
    }
    setReviewLoading(true);
    try {
      const { data } = await api.get<ShipmentReviewResponse>(`/reviews/shipment/${shipmentId}`);
      setReviewData(data || null);
        if (data?.myReview) {
          setReviewDraft({
            rating: Number(data.myReview.rating || 5),
            comment: String(data.myReview.comment || ''),
          });
        } else {
          setReviewDraft({ rating: 0, comment: '' });
        }
    } catch (error: any) {
      setReviewData(null);
      setMessage(error?.response?.data?.message || 'Değerlendirme bilgileri yüklenemedi.');
    } finally {
      setReviewLoading(false);
    }
  };

  const completeShipment = async () => {
    if (!shipmentId || !canCompleteShipment) return;
    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Taşımayı Tamamla',
      text: 'Bu yükü tamamlandı olarak işaretlemek istiyor musunuz?',
      showCancelButton: true,
      confirmButtonText: 'Evet, tamamla',
      cancelButtonText: 'Vazgeç',
    });
    if (!confirm.isConfirmed) return;

    setCompleting(true);
    try {
      await api.patch(`/shipments/${shipmentId}/complete`);
      await Swal.fire({ icon: 'success', title: 'Tamamlandı', text: 'Yük tamamlandı olarak işaretlendi.', confirmButtonText: 'Tamam' });
      await load({ silent: true });
      await loadReviews();
    } catch (error: any) {
      const errorText = error?.response?.data?.message || 'Yük tamamlanamadı.';
      setMessage(errorText);
      await Swal.fire({ icon: 'error', title: 'Hata', text: errorText, confirmButtonText: 'Tamam' });
    } finally {
      setCompleting(false);
    }
  };

  const submitReview = async () => {
    if (!shipmentId || !reviewData?.canReview) {
      await Swal.fire({
        icon: 'warning',
        title: 'Uyarı',
        text: 'Bu ilan için şu anda yorum yapamazsınız.',
        confirmButtonText: 'Tamam',
      });
      return;
    }
    const rating = Number(reviewDraft.rating || 0);
    if (!rating || rating < 1 || rating > 5) {
      setMessage('Lütfen 1-5 arasında puan verin.');
      await Swal.fire({
        icon: 'warning',
        title: 'Uyarı',
        text: 'Lütfen 1-5 arasında puan verin.',
        confirmButtonText: 'Tamam',
      });
      return;
    }
    setReviewSubmitting(true);
    try {
      await api.post('/reviews', {
        shipmentId,
        rating,
        comment: reviewDraft.comment?.trim() || undefined,
      });
      await Swal.fire({ icon: 'success', title: 'Teşekkürler', text: 'Değerlendirmeniz kaydedildi.', confirmButtonText: 'Tamam' });
      await loadReviews();
    } catch (error: any) {
      const errorText = error?.response?.data?.message || 'Değerlendirme kaydedilemedi.';
      setMessage(errorText);
      await Swal.fire({ icon: 'error', title: 'Hata', text: errorText, confirmButtonText: 'Tamam' });
    } finally {
      setReviewSubmitting(false);
    }
  };

  useEffect(() => {
    if (!chatOpen || !conversationId) return;
    const token = localStorage.getItem('an_user_token');
    if (!token) return;

    setChatConnecting(true);
    const socket = io(apiOrigin, {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setChatConnecting(false);
      socket.emit('join:conversation', conversationId);
    });
    socket.on('disconnect', () => {
      setChatConnecting(true);
    });
    socket.on('conversation:message', (payload: ConversationMessage) => {
      if (String(payload?.conversationId || '') !== conversationId) return;
      setChatMessages((prev) => {
        const exists = prev.some((item) => item._id === payload?._id);
        if (exists) return prev;
        return [...prev, payload];
      });
      void api.patch(`/conversations/${conversationId}/read`).catch(() => undefined);
    });

    return () => {
      try {
        socket.emit('leave:conversation', conversationId);
      } catch {
        // no-op
      }
      socket.disconnect();
      socketRef.current = null;
      setChatConnecting(false);
    };
  }, [chatOpen, conversationId]);

  useEffect(() => {
    if (!shouldLoadReviews) {
      setReviewData(null);
      return;
    }
    void loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLoadReviews, shipmentId, viewerRole]);

  if (loading) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4"><div className="text-secondary">Yük detayı yükleniyor...</div></div>
      </section>
    );
  }

  return (
    <section className="container py-5">
      <div className="d-flex justify-content-between align-items-center gap-3 mb-4">
        <h1 className="shipment-page-title mb-0">Yük Detayı</h1>
        <Link to="/hesabim" className="btn btn-outline-primary">Hesabıma Dön</Link>
      </div>

      {message ? <div className="alert alert-warning">{message}</div> : null}
      {!shipment ? null : (
        <>
          <div className="carrier-tabs mb-3">
            <button type="button" className={`carrier-tab-btn ${activeTab === 'detail' ? 'is-active' : ''}`} onClick={() => setActiveTab('detail')}>
              Yük Detayı
            </button>
            {canViewMap ? (
              <button type="button" className={`carrier-tab-btn ${activeTab === 'map' ? 'is-active' : ''}`} onClick={() => setActiveTab('map')}>
                Harita
              </button>
            ) : null}
            <button type="button" className={`carrier-tab-btn ${activeTab === 'offers' ? 'is-active' : ''}`} onClick={() => setActiveTab('offers')}>
              {canViewOffers ? 'Yük Sahibi İçin Gelen Teklifler' : isCarrierViewer ? 'Verdiğim Teklif' : 'Teklifler'}
              <span className="carrier-tab-count">{offerTabCount}</span>
            </button>
          </div>

          {activeTab === 'detail' ? (
            <div className="panel-card p-4 shipment-detail-hero mb-4">
              <div className="shipment-detail-hero-top">
                <div>
                  <small className="shipment-detail-label">Yük Başlığı</small>
                  <h2 className="shipment-detail-title">{shipment.title}</h2>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <span className={`shipment-status-pill tone-${statusTone(shipment.status)}`}>{statusLabel(shipment.status)}</span>
                  <span className="shipment-status-pill tone-info">{modeLabel(shipment.transportMode)}</span>
                  <span className={`shipment-status-pill ${shipment.isUrgent ? 'tone-danger' : 'tone-neutral'}`}>
                    {shipment.isUrgent ? 'Acil' : 'Normal'}
                  </span>
                </div>
              </div>

              {shipment.status === 'completed' ? (
                <div className="panel-card p-3 mt-3 mb-4">
                  <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
                    <div>
                      <small className="text-secondary d-block">Puan & Yorum</small>
                      <strong>Tamamlanan İlan Değerlendirmeleri</strong>
                    </div>
                    {reviewData?.reviewTarget?.fullName ? (
                      <span className="badge text-bg-light border">
                        Değerlendirilecek: {reviewData.reviewTarget.fullName}
                      </span>
                    ) : null}
                  </div>

                  {!reviewLoading && !canViewMutualReviews && !reviewData?.myReview && Boolean(counterpartyReview) ? (
                    <div className="review-reciprocal-alert mb-3">
                      Karşı taraf yorum yaptı. Yorumu görmek için sen de yorum yap.
                    </div>
                  ) : null}

                  {reviewLoading ? (
                    <div className="text-secondary small">Değerlendirmeler yükleniyor...</div>
                  ) : (
                    <>
                      {reviewData?.canReview ? (
                        <div className="border rounded-3 p-3 mb-3">
                          {shouldShowReciprocalReviewPrompt ? (
                            <div className="alert alert-success border mb-2 py-2">
                              <strong>{counterpartyReviewerName || 'Karşı taraf'}</strong> size yorum yaptı. Siz de yorumunuzu bırakabilirsiniz.
                            </div>
                          ) : null}
                          <div className="d-flex align-items-center gap-2 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={`review-star-${star}`}
                                type="button"
                                className={`btn btn-sm ${reviewDraft.rating >= star ? 'btn-warning' : 'btn-outline-secondary'}`}
                                onClick={() => setReviewDraft((prev) => ({ ...prev, rating: star }))}
                              >
                                <i className="bi bi-star-fill"></i>
                              </button>
                            ))}
                          </div>
                          <textarea
                            className="form-control mb-2"
                            rows={3}
                            maxLength={1000}
                            placeholder="Yorumunuz (opsiyonel)"
                            value={reviewDraft.comment}
                            onChange={(e) => setReviewDraft((prev) => ({ ...prev, comment: e.target.value }))}
                          />
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={reviewSubmitting}
                            onClick={() => void submitReview()}
                          >
                            {reviewSubmitting ? 'Kaydediliyor...' : 'Yorum ve Puanı Kaydet'}
                          </button>
                        </div>
                      ) : (
                        <div className="alert alert-light border small mb-3">
                          {reviewData?.myReview
                            ? 'Bu ilan için değerlendirmeniz zaten kaydedilmiş.'
                            : 'Bu ilan için şu an değerlendirme yapma hakkınız bulunmuyor.'}
                        </div>
                      )}

                      {canViewMutualReviews ? (
                        <div className="d-grid gap-2">
                          {(reviewData?.reviews || []).map((row) => {
                            const reviewer = typeof row.reviewerUserId === 'string' ? '' : row.reviewerUserId?.fullName || 'Kullanıcı';
                            return (
                              <div key={row._id} className="border rounded-3 p-2">
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                  <strong className="small">{reviewer}</strong>
                                  <span className="small text-warning">
                                    {'★'.repeat(Math.max(0, Math.min(5, Number(row.rating || 0))))}
                                  </span>
                                </div>
                                <div className="small text-secondary">{row.comment || 'Yorum bırakılmadı.'}</div>
                                <div className="small text-secondary mt-1">{formatDateTime(row.createdAt)}</div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              {showConversationCard || canCompleteShipment ? (
                <div className="row g-3 mt-1">
                  {showConversationCard ? (
                    <div className={canCompleteShipment ? 'col-lg-6' : 'col-12'}>
                      <div className="panel-card p-3 h-100">
                        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
                          <div>
                            <small className="text-secondary d-block">{conversationPeer.title}</small>
                            <strong className="d-block">{conversationPeer.name}</strong>
                            <span className="text-secondary small">{conversationPeer.phone}</span>
                            {isCarrierViewer && maskedOwnerCompanyDisplay ? (
                              <div className="text-secondary small mt-1">Firma: {maskedOwnerCompanyDisplay}</div>
                            ) : null}
                            <div className="shipment-owner-badges mt-2">
                              <span className="shipment-owner-badge">
                                <i className="bi bi-chat-left-text"></i>
                                {conversationPeerReviewSummary.count} yorum
                              </span>
                              <span className="shipment-owner-badge is-score">
                                <i className="bi bi-star-fill"></i>
                                {conversationPeerReviewSummary.avg > 0 ? `${conversationPeerReviewSummary.avg.toFixed(1)} puan` : 'Puan yok'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!canStartConversation || chatLoading}
                            onClick={() => void startConversation()}
                          >
                            {chatLoading ? 'Hazırlanıyor...' : 'Mesajlaşmaya Başla'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {canCompleteShipment ? (
                    <div className={showConversationCard ? 'col-lg-6' : 'col-12'}>
                      <div className="panel-card p-3 h-100 border border-success-subtle">
                        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
                          <div>
                            <small className="text-secondary d-block">Yük Tamamlama</small>
                            <strong className="d-block">Bu taşıma tamamlandıysa işlemi kapatın</strong>
                            <span className="text-secondary small">Tamamlandıktan sonra taraflar birbirine puan ve yorum bırakabilir.</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-success"
                            disabled={!canCompleteShipment || completing}
                            onClick={() => void completeShipment()}
                          >
                            {completing ? 'Tamamlanıyor...' : 'Taşımayı Tamamla'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className={`shipment-route-card ${showConversationCard || canCompleteShipment ? 'mt-3' : ''}`}>
                <div className="shipment-route-point">
                  <span className="dot from"></span>
                  <div>
                    <small>Çıkış Noktası</small>
                    <strong>{`${shipment.pickupCity || '-'} / ${shipment.pickupDistrict || '-'}`}</strong>
                  </div>
                </div>
                <div className="shipment-route-line"></div>
                <div className="shipment-route-point">
                  <span className="dot to"></span>
                  <div>
                    <small>Varış Noktası</small>
                    <strong>{`${shipment.dropoffCity || '-'} / ${shipment.dropoffDistrict || '-'}`}</strong>
                  </div>
                </div>
              </div>

              {recommendedVehicles.length ? (
                <div className="shipment-recommended-strip mt-3">
                  <div className="shipment-recommended-strip-head">
                    <span className="shipment-recommended-strip-icon">
                      <i className="bi bi-truck"></i>
                    </span>
                    <div>
                      <small>İlan İçin Uygun Araçlar</small>
                      <strong>Bu yük için önerilen araç tipleri</strong>
                    </div>
                  </div>
                  <div className="shipment-recommended-list shipment-recommended-list-premium">
                    {recommendedVehicles.map((vehicle) => (
                      <span className="shipment-recommended-item shipment-recommended-item-premium" key={vehicle._id || vehicle.slug || vehicle.name}>
                        <i className="bi bi-check2-circle me-1"></i>
                        {vehicle.name || vehicle.slug}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {!showConversationCard ? (
                <div className="shipment-owner-teaser mt-3">
                  <div className="shipment-owner-avatar">{summaryPersonCard.initials}</div>
                  <div className="shipment-owner-meta">
                    <small>{summaryPersonCard.title}</small>
                    <strong>{summaryPersonCard.name}</strong>
                    {summaryPersonCard.company ? (
                      <div className="text-secondary small mt-1">Firma: {summaryPersonCard.company}</div>
                    ) : null}
                    <div className="shipment-owner-badges">
                      <span className="shipment-owner-badge">
                        <i className="bi bi-chat-left-text"></i>
                        {summaryPersonCard.review.count} yorum
                      </span>
                      <span className="shipment-owner-badge is-score">
                        <i className="bi bi-star-fill"></i>
                        {summaryPersonCard.review.avg > 0 ? `${summaryPersonCard.review.avg.toFixed(1)} puan` : 'Puan yok'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {shouldShowOfferPromptCard ? (
                <div className="shipment-offer-prompt-card mt-3">
                  <div className="shipment-offer-prompt-content">
                    <span className="shipment-offer-prompt-kicker">
                      <i className="bi bi-lightning-charge-fill me-1"></i>
                      Aksiyon Gerekli
                    </span>
                    <strong>Bu ilana henüz teklif vermedin</strong>
                    <small>Hemen teklif vererek yük sahibinin seni değerlendirmesini sağlayabilirsin.</small>
                  </div>
                  <button
                    type="button"
                    className="btn shipment-offer-prompt-btn"
                    onClick={() => setActiveTab('offers')}
                  >
                    Hemen Teklif Ver
                    <i className="bi bi-arrow-right ms-2"></i>
                  </button>
                </div>
              ) : null}

              {acceptedContractDocs.length > 0 ? (
                <div className="panel-card p-3 mt-3">
                  <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
                    <div>
                      <small className="text-secondary d-block">Sözleşme Arşivi</small>
                      <strong>Kabul Edilen Sözleşmeler (Dönemsel Snapshot)</strong>
                    </div>
                  </div>
                  <div className="d-grid gap-2">
                    {acceptedContractDocs.map((doc) => (
                      <div key={doc.key} className="border rounded-3 p-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <div>
                          <strong className="d-block">{doc.roleLabel}: {doc.title}</strong>
                          <small className="text-secondary">
                            Onay Tarihi: {formatDateTime(doc.acceptedAt)}
                            {doc.slug ? ` · /content/${doc.slug}` : ''}
                          </small>
                        </div>
                        <div className="d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => void openAcceptedContractSnapshotLightbox(doc.title, doc.snapshotHtml)}
                          >
                            Sözleşmeyi Gör
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => downloadAcceptedContractSnapshotPdf(doc.title, doc.snapshotHtml)}
                          >
                            PDF İndir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="row g-3 mt-1">
                <div className="col-md-4">
                  <div className="shipment-mini-meta">
                    <small>Yükleme Tarihi</small>
                    <strong>{formatDateTime(shipment.scheduledPickupAt)}</strong>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="shipment-mini-meta">
                    <small>Oluşturma Tarihi</small>
                    <strong>{formatDateTime(shipment.createdAt)}</strong>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="shipment-mini-meta">
                    <small>Teklif Durumu</small>
                    <strong>{shipment.offerStats?.total ? `${shipment.offerStats.total} teklif` : 'Teklif yok'}</strong>
                  </div>
                </div>
              </div>

              <div className="shipment-description-box mt-3">
                <small>Açıklama, Notlar ve Operasyon Bilgileri</small>
                <div className="row g-3 mt-1">
                  {desc.summary ? (
                    <div className="col-md-12">
                      <div className="shipment-note-card">
                        <strong className="d-block mb-1">Açıklama</strong>
                        <p className="mb-0">{desc.summary}</p>
                      </div>
                    </div>
                  ) : null}
                  {desc.note ? (
                    <div className="col-md-12">
                      <div className="shipment-note-card shipment-note-card-warn">
                        <strong className="d-block mb-1">Dikkat Edilmesi Gerekenler</strong>
                        <p className="mb-0">{desc.note}</p>
                      </div>
                    </div>
                  ) : null}
                  {canViewAddressDetails ? (
                    <div className="col-12">
                      <div className="shipment-subsection-card h-100">
                        <strong className="d-block mb-2">Adres ve Ek Bilgiler</strong>
                        <div className="shipment-detail-list">
                          {addressDetails.map((item) => (
                            <div className="shipment-detail-list-item" key={`address-${item.label}`}>
                              <span>{item.label}</span>
                              <strong>{item.value}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="col-12">
                    <div className="shipment-subsection-card shipment-subsection-card-operations h-100">
                      <div className="shipment-subsection-head">
                        <span className="shipment-subsection-head-icon">
                          <i className="bi bi-stars"></i>
                        </span>
                        <strong className="mb-0">Operasyon Detayları</strong>
                      </div>
                      <div className="shipment-detail-list shipment-detail-list-operations">
                        {operationDetails.map((item) => (
                          <div className="shipment-detail-list-item shipment-detail-list-item-operations" key={`op-${item.label}`}>
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {desc.rawLines.length > 1 ? (
                    <div className="col-12">
                      <div className="shipment-subsection-card">
                        <strong className="d-block mb-2">Ek Metin Satırları</strong>
                        <div className="shipment-recommended-list">
                          {desc.rawLines.slice(1).map((line, idx) => (
                            <span className="shipment-recommended-item" key={`raw-${idx}`}>
                              {line}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'map' && canViewMap ? (
            <div className="panel-card p-4 mb-4">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h4 className="fw-bold mb-1">Rota Önizleme</h4>
                  <div className="text-secondary small">Alış - varış mesafesi ve tahmini süre</div>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <span className="shipment-status-pill tone-info">
                    Mesafe: {routeInfo?.distanceKm ?? shipment.routeDistanceKm ?? '-'} {routeInfo || shipment.routeDistanceKm ? 'km' : ''}
                  </span>
                  <span className="shipment-status-pill tone-warning">
                    Süre: {routeInfo?.durationMin ?? shipment.routeDurationMin ?? '-'} {routeInfo || shipment.routeDurationMin ? 'dk' : ''}
                  </span>
                </div>
              </div>

              <div className="shipment-route-card mb-3">
                <div className="shipment-route-point">
                  <span className="dot from"></span>
                  <div>
                    <small>Çıkış</small>
                    <strong>{`${shipment.pickupCity || '-'} / ${shipment.pickupDistrict || '-'}`}</strong>
                    <div className="text-secondary small">{shipment.pickupAddressText || '-'}</div>
                  </div>
                </div>
                <div className="shipment-route-line"></div>
                <div className="shipment-route-point">
                  <span className="dot to"></span>
                  <div>
                    <small>Varış</small>
                    <strong>{`${shipment.dropoffCity || '-'} / ${shipment.dropoffDistrict || '-'}`}</strong>
                    <div className="text-secondary small">{shipment.dropoffAddressText || '-'}</div>
                  </div>
                </div>
              </div>

              {routeInfo?.summary || shipment.routeSummary ? (
                <div className="alert alert-light border mb-3">
                  <strong>Rota Özeti:</strong> {routeInfo?.summary || shipment.routeSummary}
                </div>
              ) : null}

              {mapError ? <div className="alert alert-warning mb-3">{mapError}</div> : null}

              <div
                ref={routeMapContainerRef}
                style={{ width: '100%', height: 460, borderRadius: 12, border: '1px solid rgba(62,44,120,0.18)', overflow: 'hidden' }}
              />

              {!mapsReady && mapEmbedUrl ? (
                <div className="mt-3">
                  <iframe
                    title="shipment-map-fallback"
                    src={mapEmbedUrl}
                    style={{ width: '100%', height: 320, border: 0, borderRadius: 12 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'offers' && canViewOffers ? (
            <div className="row g-3 mb-4">
              <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Toplam Teklif</small><h4>{shipment.offerStats?.total || 0}</h4></div></div>
              <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Bekleyen</small><h4>{shipment.offerStats?.submitted || 0}</h4></div></div>
              <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Kabul</small><h4>{shipment.offerStats?.accepted || 0}</h4></div></div>
              <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Reddedilen</small><h4>{shipment.offerStats?.rejected || 0}</h4></div></div>
            </div>
          ) : null}

          {activeTab === 'offers' && canViewOffers ? (
            <div className="panel-card p-4">
              <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3">
                <h4 className="fw-bold mb-0">Gelen Teklifler</h4>
                <select
                  className="form-select form-select-sm shipment-offers-sort"
                  value={shipperOfferSort}
                  onChange={(e) =>
                    setShipperOfferSort(
                      e.target.value as 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'rating_desc' | 'comments_desc',
                    )
                  }
                >
                  <option value="newest">Sıralama: En Yeni</option>
                  <option value="oldest">Sıralama: En Eski</option>
                  <option value="price_asc">Fiyat: Düşükten Yükseğe</option>
                  <option value="price_desc">Fiyat: Yüksekten Düşüğe</option>
                  <option value="rating_desc">Puan: Yüksekten Düşüğe</option>
                  <option value="comments_desc">Yorum: Çoktan Aza</option>
                </select>
              </div>

              {shipperSortedOffers.length === 0 ? (
                <div className="text-secondary">Bu yük için henüz teklif bulunmuyor.</div>
              ) : (
                <div className="shipment-offer-premium-list">
                  {shipperSortedOffers.map((offer) => {
                    const fullName = offer.carrierUserId?.fullName || '';
                    const masked = maskName(fullName);
                    const initials = getInitials(fullName);
                    const ratingAvg = Number(offer.carrierReview?.avg || 0);
                    const ratingCount = Number(offer.carrierReview?.count || 0);
                    return (
                      <article key={offer._id} className="shipment-offer-premium-card">
                        <div className="shipment-offer-premium-left">
                          <span className="shipment-offer-avatar">{initials}</span>
                          <div className="shipment-offer-meta">
                            <strong>{masked}</strong>
                            <small>{offer.carrierUserId?.phone || '-'}</small>
                            <div className="shipment-offer-review-row">
                              <span className="shipment-offer-review-pill">
                                <i className="bi bi-chat-left-text"></i>
                                {ratingCount} yorum
                              </span>
                              <span className="shipment-offer-review-pill is-score">
                                <i className="bi bi-star-fill"></i>
                                {ratingAvg > 0 ? `${ratingAvg.toFixed(1)} puan` : 'Puan yok'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="shipment-offer-premium-mid">
                          <span>{`${offer.vehicleId?.brand || ''} ${offer.vehicleId?.model || ''} ${offer.vehicleId?.plateMasked || ''}`.trim() || '-'}</span>
                          <strong>{typeof offer.price === 'number' ? `₺${Math.round(offer.price).toLocaleString('tr-TR')}` : '-'}</strong>
                          <small>{offer.createdAt ? formatDateTime(offer.createdAt) : '-'}</small>
                        </div>
                        <div className="shipment-offer-premium-right">
                          <span className={`shipment-status-pill tone-${statusTone(offer.status)}`}>{statusLabel(offer.status)}</span>
                          {['submitted', 'updated'].includes(offer.status) ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-success shipment-offer-accept-btn"
                              disabled={Boolean(actionLoadingId)}
                              onClick={() => void handleOfferAction(offer._id, 'accept')}
                            >
                              {actionLoadingId === offer._id ? 'İşleniyor...' : 'Kabul Et'}
                            </button>
                          ) : (
                            <span className="text-secondary small">İşlem yok</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'offers' && isCarrierViewer ? (
            <div className="panel-card p-4 mb-3 offer-editor-premium">
              <div className="offer-editor-head d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
                <div>
                  <span className="offer-editor-kicker">
                    <i className="bi bi-stars me-1"></i>
                    Teklif Paneli
                  </span>
                  <strong>{canCarrierEditOffer ? (sentOffers.length ? 'Teklifini Güncelle' : 'Bu Yüke Teklif Ver') : 'Teklif İşlemleri Kilitli'}</strong>
                  <small>
                    {canCarrierEditOffer
                      ? 'Taşıyıcı olarak bu yüke teklif verebilir, istersen güncelleyebilirsin.'
                      : 'Bu ilan durumunda teklif işlemleri geçici olarak kapalıdır.'}
                  </small>
                </div>
              </div>
              {carrierOfferLockReason ? (
                <div className="alert alert-warning border py-2 px-3 mb-3">
                  {carrierOfferLockReason}
                </div>
              ) : null}
              <div className="row g-3 offer-editor-grid">
                <div className="col-md-4">
                  <div className="offer-editor-field">
                    <label className="form-label"><i className="bi bi-truck me-1"></i>Araç</label>
                    <select
                      className="form-select"
                      value={carrierOfferDraft.vehicleId}
                      onChange={(e) => setCarrierOfferDraft((prev) => ({ ...prev, vehicleId: e.target.value }))}
                      disabled={!canCarrierEditOffer}
                    >
                      <option value="">Araç seçin</option>
                      {suitableCarrierVehicles.map((v) => (
                        <option key={v._id} value={v._id}>
                          {`${v.plateMasked || '-'} ${v.brand || ''} ${v.model || ''}`.trim()}
                        </option>
                      ))}
                    </select>
                    {singleSuitableVehicle ? (
                      <div className="offer-editor-vehicle-hint">
                        <i className="bi bi-check-circle-fill"></i>
                        <span>Uygun araç otomatik seçildi: <strong>{singleSuitableVehicle.plateMasked || '-'}</strong></span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="offer-editor-field">
                    <label className="form-label"><i className="bi bi-cash-coin me-1"></i>Teklif Tutarı (₺)</label>
                    <input
                      className="form-control"
                      type="text"
                      inputMode="numeric"
                      value={carrierOfferDraft.amount}
                      onChange={(e) =>
                        setCarrierOfferDraft((prev) => ({
                          ...prev,
                          amount: formatCurrencyInput(e.target.value),
                        }))
                      }
                      placeholder="Örn: 50.000"
                      disabled={!canCarrierEditOffer}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="offer-editor-field">
                    <label className="form-label"><i className="bi bi-pencil-square me-1"></i>Not (Opsiyonel)</label>
                    <input
                      className="form-control"
                      value={carrierOfferDraft.note}
                      onChange={(e) => setCarrierOfferDraft((prev) => ({ ...prev, note: e.target.value }))}
                      placeholder="Kısa açıklama"
                      disabled={!canCarrierEditOffer}
                    />
                  </div>
                </div>
              </div>
              {carrierOfferContractRequired && canCarrierEditOffer ? (
                <div className="mt-3 offer-editor-contract-row">
                  <label className="offer-editor-contract-check" htmlFor="carrier-offer-contract-ack">
                    <input
                      id="carrier-offer-contract-ack"
                      className="offer-editor-contract-input"
                      type="checkbox"
                      checked={carrierOfferContractAccepted}
                      onChange={(e) => setCarrierOfferContractAccepted(e.target.checked)}
                      disabled={!canCarrierEditOffer}
                    />
                    <span className="offer-editor-contract-label">{carrierOfferContractCheckboxLabel}</span>
                  </label>
                  <div className="offer-editor-contract-actions">
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={() => void openCarrierOfferContractLightbox()}>
                      Belgeyi Oku
                    </button>
                    {carrierOfferContractSlug ? (
                      <button type="button" className="btn btn-link btn-sm p-0 ms-2" onClick={() => downloadCarrierOfferContractPdf()}>
                        PDF Olarak İndir
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {canCarrierEditOffer ? (
                <div className="d-flex gap-2 mt-3 offer-editor-actions">
                  <button
                    type="button"
                    className="btn btn-primary offer-editor-submit-btn"
                    disabled={carrierOfferLoading || (carrierOfferContractRequired && !carrierOfferContractAccepted)}
                    onClick={() => void handleCarrierOfferSubmit()}
                  >
                    {carrierOfferLoading ? 'Kaydediliyor...' : sentOffers.length ? 'Teklifi Güncelle' : 'Teklif Ver'}
                  </button>
                  {canCarrierWithdrawOffer && activeCarrierOffer ? (
                    <button
                      type="button"
                      className="btn btn-outline-danger offer-editor-cancel-btn"
                      disabled={carrierOfferLoading}
                      onClick={() => void handleCarrierWithdraw(activeCarrierOffer._id)}
                    >
                      Teklifi Geri Çek
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'offers' && isCarrierViewer ? (
            <div className="panel-card p-4">
              <h4 className="fw-bold mb-3">Verdiğim Teklif</h4>
              <div className="table-responsive shipment-offers-table">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Araç</th>
                      <th>Tutar</th>
                      <th>Durum</th>
                      <th>Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentOffers.length === 0 ? (
                      <tr><td colSpan={4} className="text-secondary">Bu yüke henüz teklif vermediniz.</td></tr>
                    ) : (
                      sentOffers.map((offer) => (
                        <tr key={offer._id}>
                          <td>{`${offer.vehicleId?.brand || ''} ${offer.vehicleId?.model || ''} ${offer.vehicleId?.plateMasked || ''}`.trim() || '-'}</td>
                          <td>{typeof offer.price === 'number' ? `₺${offer.price}` : '-'}</td>
                          <td><span className={`shipment-status-pill tone-${statusTone(offer.status)}`}>{statusLabel(offer.status)}</span></td>
                          <td>{offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('tr-TR') : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {chatOpen ? (
            <div className="panel-card p-4 mt-3">
              <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                <h5 className="mb-0">Canlı Mesajlaşma</h5>
                <span className={`shipment-status-pill ${chatConnecting ? 'tone-warning' : 'tone-success'}`}>
                  {chatConnecting ? 'Bağlanıyor...' : 'Bağlandı'}
                </span>
              </div>

              <div className="border rounded-3 p-3 mb-3" style={{ maxHeight: 320, overflowY: 'auto', background: '#faf9fe' }}>
                {chatLoading ? (
                  <div className="text-secondary small">Mesajlar yükleniyor...</div>
                ) : chatMessages.length === 0 ? (
                  <div className="text-secondary small">Henüz mesaj yok. İlk mesajı sen gönder.</div>
                ) : (
                  chatMessages.map((item) => {
                    const senderId =
                      typeof item.senderUserId === 'string'
                        ? item.senderUserId
                        : String(item.senderUserId?._id || '');
                    const mine = Boolean(viewerUserId && senderId && viewerUserId === senderId);
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
                  className="form-control"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendConversationMessage();
                    }
                  }}
                  placeholder="Mesajını yaz..."
                />
                <button type="button" className="btn btn-primary" disabled={chatSending || !chatInput.trim()} onClick={() => void sendConversationMessage()}>
                  {chatSending ? 'Gönderiliyor...' : 'Gönder'}
                </button>
              </div>
            </div>
          ) : null}

        </>
      )}
      {activeTab === 'offers' && viewMode === 'readonly' ? (
        <div className="alert alert-warning">Bu yük için teklif ekranına erişim yetkiniz yok.</div>
      ) : null}
    </section>
  );
}

const parseDescription = (raw?: string) => {
  const lines = (raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const picked: Record<string, string> = {};
  const remaining: string[] = [];

  lines.forEach((line) => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (value) {
        picked[key] = value;
        return;
      }
    }
    remaining.push(line);
  });

  return {
    summary: picked['aciklama'] || remaining[0] || '',
    note: picked['not'] || '',
    cargoType: picked['yük tipi'] || picked['yuk tipi'] || '',
    loadType: picked['yük yapisi'] || picked['yuk yapisi'] || '',
    pickupAddress: picked['çıkış adresi'] || picked['cikis adresi'] || '',
    dropoffAddress: picked['varış adresi'] || picked['varis adresi'] || '',
    loadDate: picked['yükleme tarihi'] || picked['yukleme tarihi'] || '',
    deadline: picked['teslim son tarihi'] || '',
    budget: picked['bütçe aralığı'] || picked['butce araligi'] || '',
    attributes: picked['yük niteliği'] || picked['yuk niteligi'] || '',
    extra: picked['ek alanlar'] || '',
    rawLines: remaining,
  };
};

