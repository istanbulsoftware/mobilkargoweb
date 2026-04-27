import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

type VehicleDetailResponse = {
  vehicle: {
    _id: string;
    plateMasked?: string;
    brand?: string;
    model?: string;
    modelYear?: number;
    status?: string;
    serviceCities?: string[];
    serviceDistricts?: string[];
    supportedModes?: Array<'intracity' | 'intercity'>;
    vehicleTypeId?: { name?: string; slug?: string };
  };
  offers: Array<{
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
  }>;
  trips: Array<{
    _id: string;
    title?: string;
    status?: string;
    transportMode?: 'intracity' | 'intercity';
    pickupCity?: string;
    pickupDistrict?: string;
    dropoffCity?: string;
    dropoffDistrict?: string;
    scheduledPickupAt?: string;
    createdAt?: string;
  }>;
  summary: {
    totalOffers: number;
    acceptedOffers: number;
    activeTrips: number;
    completedTrips: number;
  };
};

type ReportBucket = {
  key: string;
  label: string;
  offers: number;
  accepted: number;
  completedTrips: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toInputDate = (date: Date) => {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const parseInputDateStart = (value: string) => {
  if (!value) return null;
  const ts = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const parseInputDateEnd = (value: string) => {
  if (!value) return null;
  const ts = new Date(`${value}T23:59:59`).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const shortDateLabel = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
};

export function VehicleDetailPage() {
  const { vehicleId } = useParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [data, setData] = useState<VehicleDetailResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'report' | 'detail' | 'offers' | 'trips'>('report');

  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toInputDate(d);
  });
  const [reportEndDate, setReportEndDate] = useState(() => toInputDate(new Date()));

  const modeLabel = (mode?: 'intracity' | 'intercity') => (mode === 'intercity' ? 'Sehirler Arasi' : 'Sehir Ici');
  const formatTryPrice = (value?: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '-';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0,
    }).format(value);
  };

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

  const statusTone = (status?: string) => {
    if (['accepted', 'completed', 'active', 'approved'].includes(status || '')) return 'tone-success';
    if (['rejected', 'cancelled', 'withdrawn', 'expired', 'suspended'].includes(status || '')) return 'tone-danger';
    if (['submitted', 'updated', 'pending', 'pending_review', 'offer_collecting', 'draft'].includes(status || '')) return 'tone-warning';
    return 'tone-neutral';
  };

  const reportStartTs = useMemo(() => parseInputDateStart(reportStartDate), [reportStartDate]);
  const reportEndTs = useMemo(() => parseInputDateEnd(reportEndDate), [reportEndDate]);
  const hasValidRange = Boolean(reportStartTs && reportEndTs && reportStartTs <= reportEndTs);

  const minDataDate = useMemo(() => {
    if (!data) return null;
    const points: number[] = [];
    data.offers.forEach((offer) => {
      const ts = offer.createdAt ? new Date(offer.createdAt).getTime() : NaN;
      if (Number.isFinite(ts)) points.push(ts);
    });
    data.trips.forEach((trip) => {
      const source = trip.scheduledPickupAt || trip.createdAt;
      const ts = source ? new Date(source).getTime() : NaN;
      if (Number.isFinite(ts)) points.push(ts);
    });
    if (!points.length) return null;
    return toInputDate(new Date(Math.min(...points)));
  }, [data]);

  const filteredOffersByRange = useMemo(() => {
    if (!data || !hasValidRange || !reportStartTs || !reportEndTs) return [];
    return data.offers.filter((offer) => {
      const ts = offer.createdAt ? new Date(offer.createdAt).getTime() : NaN;
      return Number.isFinite(ts) && ts >= reportStartTs && ts <= reportEndTs;
    });
  }, [data, hasValidRange, reportStartTs, reportEndTs]);

  const filteredTripsByRange = useMemo(() => {
    if (!data || !hasValidRange || !reportStartTs || !reportEndTs) return [];
    return data.trips.filter((trip) => {
      const source = trip.scheduledPickupAt || trip.createdAt;
      const ts = source ? new Date(source).getTime() : NaN;
      return Number.isFinite(ts) && ts >= reportStartTs && ts <= reportEndTs;
    });
  }, [data, hasValidRange, reportStartTs, reportEndTs]);

  const reportSeries = useMemo<ReportBucket[]>(() => {
    if (!hasValidRange || !reportStartTs || !reportEndTs) return [];

    const totalDays = Math.floor((reportEndTs - reportStartTs) / DAY_MS) + 1;
    const bucketDays = totalDays > 45 ? 7 : 1;

    const buckets: ReportBucket[] = [];
    for (let start = reportStartTs; start <= reportEndTs; start += bucketDays * DAY_MS) {
      const end = Math.min(reportEndTs, start + bucketDays * DAY_MS - 1);
      const label = bucketDays === 1 ? shortDateLabel(start) : `${shortDateLabel(start)} - ${shortDateLabel(end)}`;
      buckets.push({
        key: `${start}`,
        label,
        offers: 0,
        accepted: 0,
        completedTrips: 0,
      });
    }

    const indexForTs = (ts: number) => {
      const diffDays = Math.floor((ts - reportStartTs) / DAY_MS);
      const idx = Math.floor(diffDays / bucketDays);
      return Math.max(0, Math.min(buckets.length - 1, idx));
    };

    filteredOffersByRange.forEach((offer) => {
      const ts = offer.createdAt ? new Date(offer.createdAt).getTime() : NaN;
      if (!Number.isFinite(ts)) return;
      const idx = indexForTs(ts);
      buckets[idx].offers += 1;
      if (String(offer.status) === 'accepted') buckets[idx].accepted += 1;
    });

    filteredTripsByRange.forEach((trip) => {
      const source = trip.scheduledPickupAt || trip.createdAt;
      const ts = source ? new Date(source).getTime() : NaN;
      if (!Number.isFinite(ts)) return;
      const idx = indexForTs(ts);
      if (String(trip.status) === 'completed') buckets[idx].completedTrips += 1;
    });

    return buckets;
  }, [hasValidRange, reportStartTs, reportEndTs, filteredOffersByRange, filteredTripsByRange]);

  const reportTotals = useMemo(() => {
    const totalOffers = filteredOffersByRange.length;
    const acceptedOffers = filteredOffersByRange.filter((x) => String(x.status) === 'accepted').length;
    const completedTrips = filteredTripsByRange.filter((x) => String(x.status) === 'completed').length;
    const acceptanceRate = totalOffers > 0 ? Math.round((acceptedOffers / totalOffers) * 100) : 0;
    const completionRate = acceptedOffers > 0 ? Math.round((completedTrips / acceptedOffers) * 100) : 0;
    return { totalOffers, acceptedOffers, completedTrips, acceptanceRate, completionRate };
  }, [filteredOffersByRange, filteredTripsByRange]);

  const chartMax = useMemo(() => {
    let max = 1;
    reportSeries.forEach((item) => {
      max = Math.max(max, item.offers, item.accepted, item.completedTrips);
    });
    return max;
  }, [reportSeries]);

  useEffect(() => {
    const run = async () => {
      if (!vehicleId) {
        setMessage('Arac kaydi bulunamadi.');
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get<VehicleDetailResponse>(`/vehicles/${vehicleId}/detail`);
        setData(data);
      } catch (error: any) {
        setMessage(error?.response?.data?.message || 'Arac detayi alinamadi.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [vehicleId]);

  if (loading) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4 text-secondary">Arac detayi yukleniyor...</div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="container py-5">
        <div className="alert alert-warning">{message || 'Arac kaydi bulunamadi.'}</div>
      </section>
    );
  }

  return (
    <section className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="shipment-page-title mb-0">Arac Detayi</h1>
        <div className="d-flex gap-2">
          <Link
            to={`/hesabim?panel=vehicle_docs&vehicleId=${encodeURIComponent(data.vehicle._id)}`}
            className="btn btn-primary"
          >
            Bu Araca Belge Yukle
          </Link>
          <Link to={`/hesabim/arac/${data.vehicle._id}/duzenle`} className="btn btn-outline-secondary">Duzenle</Link>
          <Link to="/hesabim" className="btn btn-outline-primary">Hesabim</Link>
        </div>
      </div>
      {message ? <div className="alert alert-warning">{message}</div> : null}

      <div className="carrier-tabs mb-3">
        <button type="button" className={`carrier-tab-btn ${activeTab === 'report' ? 'is-active' : ''}`} onClick={() => setActiveTab('report')}>
          Rapor ve Istatistik
        </button>
        <button type="button" className={`carrier-tab-btn ${activeTab === 'detail' ? 'is-active' : ''}`} onClick={() => setActiveTab('detail')}>
          Detay ve Duzenle
        </button>
        <button type="button" className={`carrier-tab-btn ${activeTab === 'offers' ? 'is-active' : ''}`} onClick={() => setActiveTab('offers')}>
          Araca Ait Teklifler
        </button>
        <button type="button" className={`carrier-tab-btn ${activeTab === 'trips' ? 'is-active' : ''}`} onClick={() => setActiveTab('trips')}>
          Aracin Yaptigi Seferler
        </button>
      </div>

      {activeTab === 'report' ? (
        <>
          <div className="panel-card p-3 mb-3 vehicle-report-toolbar">
            <div className="vehicle-report-date-row">
              <div>
                <label className="form-label mb-1 small">Baslangic</label>
                <input type="date" className="form-control form-control-sm" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label mb-1 small">Bitis</label>
                <input type="date" className="form-control form-control-sm" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} />
              </div>
            </div>
            <div className="vehicle-report-quick-btns">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 6); setReportStartDate(toInputDate(d)); setReportEndDate(toInputDate(new Date())); }}>Son 7 Gun</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 29); setReportStartDate(toInputDate(d)); setReportEndDate(toInputDate(new Date())); }}>Son 30 Gun</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 89); setReportStartDate(toInputDate(d)); setReportEndDate(toInputDate(new Date())); }}>Son 90 Gun</button>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                disabled={!minDataDate}
                onClick={() => {
                  if (!minDataDate) return;
                  setReportStartDate(minDataDate);
                  setReportEndDate(toInputDate(new Date()));
                }}
              >
                Tum Veri
              </button>
            </div>
          </div>

          {!hasValidRange ? (
            <div className="alert alert-warning">Tarih araligi gecersiz. Baslangic tarihi, bitis tarihinden buyuk olamaz.</div>
          ) : (
            <>
              <div className="row g-3 mb-4">
                <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Araliktaki Teklif</small><h4>{reportTotals.totalOffers}</h4></div></div>
                <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Araliktaki Kabul</small><h4>{reportTotals.acceptedOffers}</h4></div></div>
                <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Tamamlanan Sefer</small><h4>{reportTotals.completedTrips}</h4></div></div>
                <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Kabul Orani</small><h4>%{reportTotals.acceptanceRate}</h4></div></div>
              </div>

              <div className="row g-3">
                <div className="col-xl-8">
                  <div className="panel-card p-4">
                    <h4 className="fw-bold mb-2">Teklif ve Kabul Trendi</h4>
                    <small className="text-secondary d-block mb-3">Secili tarih araligina gore zaman serisi</small>
                    {reportSeries.length === 0 ? (
                      <div className="text-secondary">Gosterilecek veri yok.</div>
                    ) : (
                      <div className="vehicle-mini-chart">
                        {reportSeries.map((item) => (
                          <div className="vehicle-mini-chart-col" key={item.key}>
                            <div className="vehicle-mini-chart-bars">
                              <span className="vehicle-mini-bar offer" style={{ height: `${Math.max(4, (item.offers / chartMax) * 100)}%` }} title={`Teklif: ${item.offers}`} />
                              <span className="vehicle-mini-bar accepted" style={{ height: `${Math.max(4, (item.accepted / chartMax) * 100)}%` }} title={`Kabul: ${item.accepted}`} />
                            </div>
                            <small>{item.label}</small>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="vehicle-mini-chart-legend mt-3">
                      <span><i className="bi bi-square-fill text-primary" /> Teklif</span>
                      <span><i className="bi bi-square-fill text-success" /> Kabul</span>
                    </div>
                  </div>
                </div>

                <div className="col-xl-4">
                  <div className="panel-card p-4 h-100">
                    <h4 className="fw-bold mb-2">Donusum Performansi</h4>
                    <small className="text-secondary d-block mb-3">Tekliften sonuca kadar ilerleme</small>
                    <div className="mb-3">
                      <div className="d-flex justify-content-between small mb-1">
                        <span>Teklif -&gt; Kabul</span>
                        <strong>%{reportTotals.acceptanceRate}</strong>
                      </div>
                      <div className="progress" style={{ height: 9 }}>
                        <div className="progress-bar bg-success" style={{ width: `${reportTotals.acceptanceRate}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="d-flex justify-content-between small mb-1">
                        <span>Kabul -&gt; Tamamlanan</span>
                        <strong>%{reportTotals.completionRate}</strong>
                      </div>
                      <div className="progress" style={{ height: 9 }}>
                        <div className="progress-bar bg-info" style={{ width: `${reportTotals.completionRate}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12">
                  <div className="panel-card p-4">
                    <h4 className="fw-bold mb-2">Tamamlanan Sefer Trendi</h4>
                    <small className="text-secondary d-block mb-3">Secili araliktaki tamamlanan sefer yogunlugu</small>
                    {reportSeries.length === 0 ? (
                      <div className="text-secondary">Gosterilecek veri yok.</div>
                    ) : (
                      <div className="vehicle-mini-chart single">
                        {reportSeries.map((item) => (
                          <div className="vehicle-mini-chart-col" key={`${item.key}-trip`}>
                            <div className="vehicle-mini-chart-bars single">
                              <span className="vehicle-mini-bar completed" style={{ height: `${Math.max(4, (item.completedTrips / chartMax) * 100)}%` }} title={`Tamamlanan: ${item.completedTrips}`} />
                            </div>
                            <small>{item.label}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      ) : null}

      {activeTab === 'detail' ? (
        <div className="panel-card p-4 mb-4">
          <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
            <h4 className="fw-bold mb-0">Arac Bilgileri</h4>
            <Link to={`/hesabim/arac/${data.vehicle._id}/duzenle`} className="btn btn-outline-secondary btn-sm">Duzenle</Link>
          </div>
          <div className="row g-3">
            <div className="col-md-3"><small className="text-secondary d-block">Arac Tipi</small><strong>{data.vehicle.vehicleTypeId?.name || '-'}</strong></div>
            <div className="col-md-2"><small className="text-secondary d-block">Plaka</small><strong>{data.vehicle.plateMasked || '-'}</strong></div>
            <div className="col-md-3"><small className="text-secondary d-block">Marka / Model</small><strong>{`${data.vehicle.brand || '-'} ${data.vehicle.model || ''}`.trim()}</strong></div>
            <div className="col-md-2"><small className="text-secondary d-block">Yil</small><strong>{data.vehicle.modelYear || '-'}</strong></div>
            <div className="col-md-2">
              <small className="text-secondary d-block">Durum</small>
              <span className={`shipment-status-pill ${statusTone(data.vehicle.status)}`}>{vehicleStatusLabel(data.vehicle.status)}</span>
            </div>
            <div className="col-md-6"><small className="text-secondary d-block">Hizmet Sehirleri</small><strong>{(data.vehicle.serviceCities || []).join(', ') || '-'}</strong></div>
            <div className="col-md-6"><small className="text-secondary d-block">Hizmet Ilceleri</small><strong>{(data.vehicle.serviceDistricts || []).join(', ') || '-'}</strong></div>
            <div className="col-md-6"><small className="text-secondary d-block">Tasima Modlari</small><strong>{(data.vehicle.supportedModes || []).map(modeLabel).join(', ') || '-'}</strong></div>
          </div>
        </div>
      ) : null}

      {activeTab === 'offers' ? (
        <div className="panel-card p-4 mb-4">
          <h4 className="fw-bold mb-3">Araca Ait Teklifler</h4>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Ilan</th>
                  <th>Rota</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {data.offers.length === 0 ? (
                  <tr><td colSpan={5} className="text-secondary">Bu araca ait teklif kaydi yok.</td></tr>
                ) : (
                  data.offers.map((offer) => (
                    <tr key={offer._id}>
                      <td>{offer.shipmentId?.title || '-'}</td>
                      <td>{`${offer.shipmentId?.pickupCity || '-'} / ${offer.shipmentId?.dropoffCity || '-'}`}</td>
                      <td>{formatTryPrice(offer.price)}</td>
                      <td><span className={`shipment-status-pill ${statusTone(offer.status)}`}>{offerStatusLabel(offer.status)}</span></td>
                      <td>{offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('tr-TR') : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'trips' ? (
        <div className="panel-card p-4">
          <h4 className="fw-bold mb-3">Aracin Yaptigi Seferler</h4>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Ilan</th>
                  <th>Rota</th>
                  <th>Mod</th>
                  <th>Durum</th>
                  <th>Yukleme</th>
                </tr>
              </thead>
              <tbody>
                {data.trips.length === 0 ? (
                  <tr><td colSpan={5} className="text-secondary">Bu araca ait sefer kaydi yok.</td></tr>
                ) : (
                  data.trips.map((trip) => (
                    <tr key={trip._id}>
                      <td>{trip.title || '-'}</td>
                      <td>{`${trip.pickupCity || '-'} / ${trip.dropoffCity || '-'}`}</td>
                      <td>{modeLabel(trip.transportMode)}</td>
                      <td><span className={`shipment-status-pill ${statusTone(trip.status)}`}>{shipmentStatusLabel(trip.status)}</span></td>
                      <td>{trip.scheduledPickupAt ? new Date(trip.scheduledPickupAt).toLocaleString('tr-TR') : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
