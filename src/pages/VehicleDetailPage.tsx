import { Link, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
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

export function VehicleDetailPage() {
  const { vehicleId } = useParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [data, setData] = useState<VehicleDetailResponse | null>(null);

  const modeLabel = (mode?: 'intracity' | 'intercity') => (mode === 'intercity' ? 'Şehirler Arası' : 'Şehir İçi');

  const activeOrOpenTrips = useMemo(
    () => data?.trips.filter((t) => ['published', 'offer_collecting', 'matched'].includes(String(t.status))) || [],
    [data?.trips],
  );

  useEffect(() => {
    const run = async () => {
      if (!vehicleId) {
        setMessage('Araç kaydı bulunamadı.');
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get<VehicleDetailResponse>(`/vehicles/${vehicleId}/detail`);
        setData(data);
      } catch (error: any) {
        setMessage(error?.response?.data?.message || 'Araç detayı alınamadı.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [vehicleId]);

  if (loading) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4 text-secondary">Araç detayı yükleniyor...</div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="container py-5">
        <div className="alert alert-warning">{message || 'Araç kaydı bulunamadı.'}</div>
      </section>
    );
  }

  return (
    <section className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="shipment-page-title mb-0">Araç Detayı</h1>
        <div className="d-flex gap-2">
          <Link to={`/hesabim/arac/${data.vehicle._id}/duzenle`} className="btn btn-outline-secondary">Düzenle</Link>
          <Link to="/hesabim" className="btn btn-outline-primary">Hesabım</Link>
        </div>
      </div>
      {message ? <div className="alert alert-warning">{message}</div> : null}

      <div className="panel-card p-4 mb-4">
        <div className="row g-3">
          <div className="col-md-3"><small className="text-secondary d-block">Araç Tipi</small><strong>{data.vehicle.vehicleTypeId?.name || '-'}</strong></div>
          <div className="col-md-2"><small className="text-secondary d-block">Plaka</small><strong>{data.vehicle.plateMasked || '-'}</strong></div>
          <div className="col-md-3"><small className="text-secondary d-block">Marka / Model</small><strong>{`${data.vehicle.brand || '-'} ${data.vehicle.model || ''}`.trim()}</strong></div>
          <div className="col-md-2"><small className="text-secondary d-block">Yıl</small><strong>{data.vehicle.modelYear || '-'}</strong></div>
          <div className="col-md-2"><small className="text-secondary d-block">Durum</small><strong>{data.vehicle.status || '-'}</strong></div>
          <div className="col-md-6"><small className="text-secondary d-block">Hizmet Şehirleri</small><strong>{(data.vehicle.serviceCities || []).join(', ') || '-'}</strong></div>
          <div className="col-md-6"><small className="text-secondary d-block">Hizmet İlçeleri</small><strong>{(data.vehicle.serviceDistricts || []).join(', ') || '-'}</strong></div>
          <div className="col-md-6"><small className="text-secondary d-block">Taşıma Modları</small><strong>{(data.vehicle.supportedModes || []).map(modeLabel).join(', ') || '-'}</strong></div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Toplam Teklif</small><h4>{data.summary.totalOffers}</h4></div></div>
        <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Kabul Edilen</small><h4>{data.summary.acceptedOffers}</h4></div></div>
        <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Aktif Sefer</small><h4>{activeOrOpenTrips.length}</h4></div></div>
        <div className="col-md-3"><div className="panel-card p-3 account-stat-card"><small>Tamamlanan Sefer</small><h4>{data.summary.completedTrips}</h4></div></div>
      </div>

      <div className="panel-card p-4 mb-4">
        <h4 className="fw-bold mb-3">Araca Ait Teklifler</h4>
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>İlan</th>
                <th>Rota</th>
                <th>Tutar</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {data.offers.length === 0 ? (
                <tr><td colSpan={5} className="text-secondary">Bu araca ait teklif kaydı yok.</td></tr>
              ) : (
                data.offers.map((offer) => (
                  <tr key={offer._id}>
                    <td>{offer.shipmentId?.title || '-'}</td>
                    <td>{`${offer.shipmentId?.pickupCity || '-'} / ${offer.shipmentId?.dropoffCity || '-'}`}</td>
                    <td>{typeof offer.price === 'number' ? `₺${offer.price}` : '-'}</td>
                    <td><span className="badge text-bg-light border">{offer.status}</span></td>
                    <td>{offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('tr-TR') : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-card p-4">
        <h4 className="fw-bold mb-3">Aracın Yaptığı Seferler</h4>
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>İlan</th>
                <th>Rota</th>
                <th>Mod</th>
                <th>Durum</th>
                <th>Yükleme</th>
              </tr>
            </thead>
            <tbody>
              {data.trips.length === 0 ? (
                <tr><td colSpan={5} className="text-secondary">Bu araca ait sefer kaydı yok.</td></tr>
              ) : (
                data.trips.map((trip) => (
                  <tr key={trip._id}>
                    <td>{trip.title || '-'}</td>
                    <td>{`${trip.pickupCity || '-'} / ${trip.dropoffCity || '-'}`}</td>
                    <td>{modeLabel(trip.transportMode)}</td>
                    <td><span className="badge text-bg-light border">{trip.status || '-'}</span></td>
                    <td>{trip.scheduledPickupAt ? new Date(trip.scheduledPickupAt).toLocaleString('tr-TR') : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
