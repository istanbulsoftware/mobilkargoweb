import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Swal from 'sweetalert2';

type OfferLite = {
  _id: string;
  status: string;
  price?: number;
  serviceNotes?: string;
  createdAt?: string;
  carrierUserId?: { fullName?: string; phone?: string; status?: string };
  vehicleId?: { _id?: string; plateMasked?: string; brand?: string; model?: string };
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
  isUrgent?: boolean;
  createdAt: string;
  canViewOffers?: boolean;
  offers?: OfferLite[];
  myOffer?: OfferLite | null;
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
  role?: 'shipper' | 'carrier' | 'admin';
};

export function ShipmentDetailPage() {
  const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const { shipmentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [viewerRole, setViewerRole] = useState<ViewerProfile['role']>();
  const [activeTab, setActiveTab] = useState<'detail' | 'map' | 'offers'>('detail');
  const [carrierVehicles, setCarrierVehicles] = useState<Array<{ _id: string; plateMasked?: string; brand?: string; model?: string; status?: string; vehicleTypeId?: string | { _id?: string } }>>([]);
  const [carrierOfferDraft, setCarrierOfferDraft] = useState<{ vehicleId: string; amount: string; note: string }>({
    vehicleId: '',
    amount: '',
    note: '',
  });
  const [carrierOfferLoading, setCarrierOfferLoading] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number; summary: string } | null>(null);

  const routeMapContainerRef = useRef<HTMLDivElement | null>(null);
  const routeMapRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);

  const modeLabel = (mode?: 'intracity' | 'intercity') => (mode === 'intercity' ? 'Şehirler Arası' : 'Şehir İçi');

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
      } catch {
        setViewerRole(undefined);
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
  const viewMode = useMemo<'shipper' | 'carrier' | 'readonly'>(() => {
    if (viewerRole === 'carrier') return 'carrier';
    if (shipment?.canViewOffers) return 'shipper';
    return 'readonly';
  }, [viewerRole, shipment?.canViewOffers]);
  const canViewOffers = viewMode === 'shipper';
  const isCarrierViewer = viewMode === 'carrier';
  const canViewMap = canViewOffers || isCarrierViewer;
  const desc = useMemo(() => parseDescription(shipment?.description), [shipment?.description]);
  const sentOffers = useMemo(() => {
    if (canViewOffers) return [] as OfferLite[];
    if (offers.length) return offers;
    return shipment?.myOffer ? [shipment.myOffer] : [];
  }, [canViewOffers, offers, shipment?.myOffer]);
  const offerTabCount = useMemo(() => {
    if (canViewOffers) return offers.length;
    if (isCarrierViewer) return sentOffers.length;
    return offers.length;
  }, [canViewOffers, isCarrierViewer, offers.length, sentOffers.length]);

  useEffect(() => {
    if (!isCarrierViewer || activeTab !== 'offers') return;
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
    if (!isCarrierViewer) return;
    const my = shipment?.myOffer || null;
    const recommendedIds = new Set((shipment?.recommendedVehicleTypes || []).map((x) => String(x._id || '')).filter(Boolean));

    let preferredVehicleId = '';
    if (my?.vehicleId?._id) preferredVehicleId = String(my.vehicleId._id);

    if (!preferredVehicleId && recommendedIds.size > 0) {
      const matched = carrierVehicles.find((v) => {
        const typeId = typeof v.vehicleTypeId === 'string' ? v.vehicleTypeId : v.vehicleTypeId?._id;
        return typeId ? recommendedIds.has(String(typeId)) : false;
      });
      if (matched?._id) preferredVehicleId = matched._id;
    }

    if (!preferredVehicleId && carrierVehicles[0]?._id) preferredVehicleId = carrierVehicles[0]._id;

    setCarrierOfferDraft({
      vehicleId: preferredVehicleId,
      amount: my?.price ? String(my.price) : '',
      note: my?.serviceNotes || '',
    });
  }, [isCarrierViewer, shipment?.myOffer, shipment?.recommendedVehicleTypes, carrierVehicles]);

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
      await api.patch(`/offers/${offerId}/${action}`);
      await load({ silent: true });
      setMessage(action === 'accept' ? 'Teklif kabul edildi.' : 'Teklif reddedildi.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Teklif işlemi başarısız.');
    } finally {
      setActionLoadingId('');
    }
  };

  const handleCarrierOfferSubmit = async () => {
    if (!shipmentId) return;
    if (!carrierOfferDraft.vehicleId || !carrierOfferDraft.amount) {
      setMessage('Teklif için araç ve tutar zorunludur.');
      await Swal.fire({ icon: 'warning', title: 'Uyarı', text: 'Teklif için araç ve tutar zorunludur.', confirmButtonText: 'Tamam' });
      return;
    }
    const amount = Number(carrierOfferDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Teklif tutarı geçerli bir sayı olmalıdır.');
      await Swal.fire({ icon: 'warning', title: 'Uyarı', text: 'Teklif tutarı geçerli bir sayı olmalıdır.', confirmButtonText: 'Tamam' });
      return;
    }

    setCarrierOfferLoading(true);
    try {
      const successText = sentOffers.length ? 'Teklif başarıyla güncellendi.' : 'Teklif başarıyla kaydedildi.';
      await api.post('/offers', {
        shipmentId,
        vehicleId: carrierOfferDraft.vehicleId,
        amount,
        note: carrierOfferDraft.note || undefined,
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

              <div className="shipment-route-card">
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

              <div className="row g-3 mt-1">
                <div className="col-md-4">
                  <div className="shipment-mini-meta">
                    <small>Yükleme Tarihi</small>
                    <strong>{shipment.scheduledPickupAt ? new Date(shipment.scheduledPickupAt).toLocaleString('tr-TR') : '-'}</strong>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="shipment-mini-meta">
                    <small>Oluşturma Tarihi</small>
                    <strong>{new Date(shipment.createdAt).toLocaleString('tr-TR')}</strong>
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
                <small>Açıklama ve Notlar</small>
                <div className="row g-3 mt-1">
                  {desc.summary ? (
                    <div className="col-md-12">
                      <div className="border rounded-3 p-3 bg-white">
                        <strong className="d-block mb-1">Açıklama</strong>
                        <p className="mb-0">{desc.summary}</p>
                      </div>
                    </div>
                  ) : null}
                  {desc.note ? (
                    <div className="col-md-12">
                      <div className="border rounded-3 p-3 bg-white">
                        <strong className="d-block mb-1">Dikkat Edilmesi Gerekenler</strong>
                        <p className="mb-0">{desc.note}</p>
                      </div>
                    </div>
                  ) : null}
                  <div className="col-md-6">
                    <div className="border rounded-3 p-3 bg-white h-100">
                      <strong className="d-block mb-2">Operasyon Detayları</strong>
                      <div className="small text-secondary">Yük Yapısı: <span className="text-dark">{desc.loadType || '-'}</span></div>
                      <div className="small text-secondary">Yükleme Tarihi: <span className="text-dark">{desc.loadDate || '-'}</span></div>
                      <div className="small text-secondary">Teslim Son Tarih: <span className="text-dark">{desc.deadline || '-'}</span></div>
                      <div className="small text-secondary">Bütçe Aralığı: <span className="text-dark">{desc.budget || '-'}</span></div>
                      <div className="small text-secondary">Yük Niteliği: <span className="text-dark">{desc.attributes || '-'}</span></div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="border rounded-3 p-3 bg-white h-100">
                      <strong className="d-block mb-2">Adres ve Ek Bilgiler</strong>
                      <div className="small text-secondary">Çıkış Adresi: <span className="text-dark">{desc.pickupAddress || shipment.pickupAddressText || '-'}</span></div>
                      <div className="small text-secondary">Varış Adresi: <span className="text-dark">{desc.dropoffAddress || shipment.dropoffAddressText || '-'}</span></div>
                      <div className="small text-secondary">Ek Alanlar: <span className="text-dark">{desc.extra || '-'}</span></div>
                    </div>
                  </div>
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
              <h4 className="fw-bold mb-3">Gelen Teklifler</h4>
              <div className="table-responsive shipment-offers-table">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Taşımacı</th>
                      <th>Araç</th>
                      <th>Tutar</th>
                      <th>Durum</th>
                      <th>Tarih</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.length === 0 ? (
                      <tr><td colSpan={6} className="text-secondary">Bu yük için henüz teklif bulunmuyor.</td></tr>
                    ) : (
                      offers.map((offer) => (
                        <tr key={offer._id}>
                          <td>
                            <div className="offer-carrier">
                              <strong>{offer.carrierUserId?.fullName || '-'}</strong>
                              <small>{offer.carrierUserId?.phone || '-'}</small>
                            </div>
                          </td>
                          <td>{`${offer.vehicleId?.brand || ''} ${offer.vehicleId?.model || ''} ${offer.vehicleId?.plateMasked || ''}`.trim() || '-'}</td>
                          <td>{typeof offer.price === 'number' ? `₺${offer.price}` : '-'}</td>
                          <td><span className={`shipment-status-pill tone-${statusTone(offer.status)}`}>{statusLabel(offer.status)}</span></td>
                          <td>{offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('tr-TR') : '-'}</td>
                          <td className="text-end">
                            {['submitted', 'updated'].includes(offer.status) ? (
                              <div className="d-flex gap-2 justify-content-end">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-success"
                                  disabled={Boolean(actionLoadingId)}
                                  onClick={() => void handleOfferAction(offer._id, 'accept')}
                                >
                                  {actionLoadingId === offer._id ? 'İşleniyor...' : 'Kabul'}
                                </button>
                              </div>
                            ) : (
                              <span className="text-secondary small">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === 'offers' && isCarrierViewer ? (
            <div className="panel-card p-4 mb-3 offer-editor-premium">
              <div className="offer-editor-head d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
                <div>
                  <strong>{sentOffers.length ? 'Teklifini Güncelle' : 'Bu Yüke Teklif Ver'}</strong>
                  <small>Taşıyıcı olarak bu yüke teklif verebilir, istersen güncelleyebilirsin.</small>
                </div>
              </div>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Araç</label>
                  <select
                    className="form-select"
                    value={carrierOfferDraft.vehicleId}
                    onChange={(e) => setCarrierOfferDraft((prev) => ({ ...prev, vehicleId: e.target.value }))}
                  >
                    <option value="">Araç seçin</option>
                    {carrierVehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {`${v.plateMasked || '-'} ${v.brand || ''} ${v.model || ''}`.trim()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Teklif Tutarı (₺)</label>
                  <input
                    className="form-control"
                    type="number"
                    min={1}
                    value={carrierOfferDraft.amount}
                    onChange={(e) => setCarrierOfferDraft((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="Örn: 4500"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Not (Opsiyonel)</label>
                  <input
                    className="form-control"
                    value={carrierOfferDraft.note}
                    onChange={(e) => setCarrierOfferDraft((prev) => ({ ...prev, note: e.target.value }))}
                    placeholder="Kısa açıklama"
                  />
                </div>
              </div>
              <div className="d-flex gap-2 mt-3">
                <button type="button" className="btn btn-primary" disabled={carrierOfferLoading} onClick={() => void handleCarrierOfferSubmit()}>
                  {carrierOfferLoading ? 'Kaydediliyor...' : sentOffers.length ? 'Teklifi Güncelle' : 'Teklif Ver'}
                </button>
                {sentOffers[0] && ['submitted', 'updated'].includes(sentOffers[0].status) ? (
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    disabled={carrierOfferLoading}
                    onClick={() => void handleCarrierWithdraw(sentOffers[0]._id)}
                  >
                    Teklifi Geri Çek
                  </button>
                ) : null}
              </div>
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

