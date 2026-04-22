import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

type OfferLite = {
  _id: string;
  status: string;
  price?: number;
  createdAt?: string;
  carrierUserId?: { fullName?: string; phone?: string; status?: string };
  vehicleId?: { plateMasked?: string; brand?: string; model?: string };
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
  scheduledPickupAt?: string;
  isUrgent?: boolean;
  createdAt: string;
  canViewOffers?: boolean;
  offers?: OfferLite[];
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

export function ShipmentDetailPage() {
  const { shipmentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);

  const modeLabel = (mode?: 'intracity' | 'intercity') =>
    mode === 'intercity' ? 'Şehirler Arasi' : 'Şehir Ici';

  const statusLabel = (status?: string) => {
    const map: Record<string, string> = {
      draft: 'Taslak',
      published: 'Yayinda',
      offer_collecting: 'Teklif Topluyor',
      matched: 'Eslesti',
      cancelled: 'Iptal',
      completed: 'Tamamlandi',
      suspended: 'Durduruldu',
      submitted: 'Verildi',
      updated: 'Güncellendi',
      withdrawn: 'Geri Cekildi',
      accepted: 'Kabul',
      rejected: 'Reddedildi',
      expired: 'Suresi Doldu',
    };
    return map[status || ''] || status || '-';
  };

  const statusTone = (status?: string) => {
    if (['completed', 'accepted'].includes(status || '')) return 'success';
    if (['rejected', 'cancelled', 'withdrawn', 'suspended'].includes(status || '')) return 'danger';
    if (['offer_collecting', 'submitted', 'updated', 'draft'].includes(status || '')) return 'warning';
    return 'info';
  };

  const load = async () => {
    setLoading(true);
    if (!shipmentId) {
      setMessage('Yük ID bulunamadi.');
      setLoading(false);
      return;
    }
    try {
      try {
        const { data } = await api.get<ShipmentsDetailedResponse>('/shipments/my/detailed');
        const found = (data?.rows || []).find((row) => row._id === shipmentId) || null;
        if (found) {
          setShipment(found);
          setMessage('');
          return;
        }
      } catch {
        // Shipper disi kullanicilar (ozellikle carrier) bu endpointte 403 alabilir.
      }

      // Tekliflerimden gelen tasiyici senaryosu dahil genel fallback.
      const fallback = await api.get<ShipmentDetail>(`/shipments/${shipmentId}`);
      if (fallback.data?._id) {
        setShipment(fallback.data);
        setMessage('');
        return;
      }

      setShipment(null);
      setMessage('Yük kaydi bulunamadi veya bu kayda erisim yetkiniz yok.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Yük detayi yüklenemedi.');
      setShipment(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  const offers = useMemo(() => shipment?.offers || [], [shipment?.offers]);
  const canViewOffers = Boolean(shipment?.canViewOffers);
  const desc = useMemo(() => parseDescription(shipment?.description), [shipment?.description]);

  const handleOfferAction = async (offerId: string, action: 'accept' | 'reject') => {
    setActionLoadingId(offerId);
    setMessage('');
    try {
      await api.patch(`/offers/${offerId}/${action}`);
      await load();
      setMessage(action === 'accept' ? 'Teklif kabul edildi.' : 'Teklif reddedildi.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Teklif islemi başarısız.');
    } finally {
      setActionLoadingId('');
    }
  };

  if (loading) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4"><div className="text-secondary">Yük detayi yükleniyor...</div></div>
      </section>
    );
  }

  return (
    <section className="container py-5">
      <div className="d-flex justify-content-between align-items-center gap-3 mb-4">
        <h1 className="shipment-page-title mb-0">Yük Detayi</h1>
        <Link to="/hesabim" className="btn btn-outline-primary">Hesabıma Don</Link>
      </div>

      {message ? <div className="alert alert-warning">{message}</div> : null}
      {!shipment ? null : (
        <>
          <div className="panel-card p-4 shipment-detail-hero mb-4">
            <div className="shipment-detail-hero-top">
              <div>
                <small className="shipment-detail-label">Yük Basligi</small>
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
                  <small>Çıkış Noktasi</small>
                  <strong>{`${shipment.pickupCity || '-'} / ${shipment.pickupDistrict || '-'}`}</strong>
                </div>
              </div>
              <div className="shipment-route-line"></div>
              <div className="shipment-route-point">
                <span className="dot to"></span>
                <div>
                  <small>Varış Noktasi</small>
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

            {shipment.description ? (
              <div className="shipment-description-box mt-3">
                <small>Aciklama ve Notlar</small>
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
                      <div className="small text-secondary">Çıkış Adresi: <span className="text-dark">{desc.pickupAddress || '-'}</span></div>
                      <div className="small text-secondary">Varış Adresi: <span className="text-dark">{desc.dropoffAddress || '-'}</span></div>
                      <div className="small text-secondary">Ek Alanlar: <span className="text-dark">{desc.extra || '-'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {canViewOffers ? (
          <div className="row g-3 mb-4">
            <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Toplam Teklif</small><h4>{shipment.offerStats?.total || 0}</h4></div></div>
            <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Bekleyen</small><h4>{shipment.offerStats?.submitted || 0}</h4></div></div>
            <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Kabul</small><h4>{shipment.offerStats?.accepted || 0}</h4></div></div>
            <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Reddedilen</small><h4>{shipment.offerStats?.rejected || 0}</h4></div></div>
          </div>
          ) : null}

          {canViewOffers ? (
          <div className="panel-card p-4">
            <h4 className="fw-bold mb-3">Gelen Teklifler</h4>
            <div className="table-responsive shipment-offers-table">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Taşımaci</th>
                    <th>Araç</th>
                    <th>Tutar</th>
                    <th>Durum</th>
                    <th>Tarih</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {offers.length === 0 ? (
                    <tr><td colSpan={6} className="text-secondary">Bu yuk için henuz teklif bulunmuyor.</td></tr>
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
                                {actionLoadingId === offer._id ? 'Isleniyor...' : 'Kabul'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                disabled={Boolean(actionLoadingId)}
                                onClick={() => void handleOfferAction(offer._id, 'reject')}
                              >
                                Reddet
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
          ) : (
            <div className="alert alert-info">Teklif listesi sadece bu yükün sahibi tarafından görüntülenebilir.</div>
          )}
        </>
      )}
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
