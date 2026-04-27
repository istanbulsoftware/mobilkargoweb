import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { api } from '../lib/api';

type ShipmentDetail = {
  _id: string;
  title: string;
  description?: string;
  status: string;
  offerStats?: {
    total?: number;
  };
  offers?: Array<{ _id?: string }>;
  transportMode: 'intracity' | 'intercity';
  pickupCity?: string;
  pickupDistrict?: string;
  dropoffCity?: string;
  dropoffDistrict?: string;
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
};

type CityOption = { id: string; name: string };
type DistrictOption = { id: string; name: string; cityId: string };

const toInputDateTime = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ShipmentEditPage() {
  const { shipmentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editLockedReason, setEditLockedReason] = useState('');

  const [cities, setCities] = useState<CityOption[]>([]);
  const [districtByCity, setDistrictByCity] = useState<Record<string, DistrictOption[]>>({});

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [originCityId, setOriginCityId] = useState('');
  const [originDistrict, setOriginDistrict] = useState('');
  const [destinationCityId, setDestinationCityId] = useState('');
  const [destinationDistrict, setDestinationDistrict] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [deliveryDeadlineAt, setDeliveryDeadlineAt] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [needsPackaging, setNeedsPackaging] = useState(false);
  const [needsAssembly, setNeedsAssembly] = useState(false);
  const [needsHelper, setNeedsHelper] = useState(false);
  const [needsElevator, setNeedsElevator] = useState(false);
  const [estimatedWeightKg, setEstimatedWeightKg] = useState('');
  const [estimatedVolumeM3, setEstimatedVolumeM3] = useState('');
  const [pieceCount, setPieceCount] = useState('');
  const [status, setStatus] = useState<ShipmentDetail['status']>('published');

  const originDistrictOptions = useMemo(() => districtByCity[originCityId] || [], [districtByCity, originCityId]);
  const destinationDistrictOptions = useMemo(() => districtByCity[destinationCityId] || [], [districtByCity, destinationCityId]);
  const originCityName = useMemo(() => cities.find((x) => x.id === originCityId)?.name || '', [cities, originCityId]);
  const destinationCityName = useMemo(() => cities.find((x) => x.id === destinationCityId)?.name || '', [cities, destinationCityId]);
  const computedTransportMode: 'intracity' | 'intercity' = useMemo(() => {
    if (!originCityName || !destinationCityName) return 'intracity';
    return originCityName === destinationCityName ? 'intracity' : 'intercity';
  }, [originCityName, destinationCityName]);
  const statusLabel = (value: ShipmentDetail['status']) => {
    const map: Record<ShipmentDetail['status'], string> = {
      draft: 'Taslak',
      published: 'Yayında',
      offer_collecting: 'Teklif Topluyor',
      matched: 'Eşleşti',
      cancelled: 'İptal',
      completed: 'Tamamlandı',
      suspended: 'Durduruldu',
    };
    return map[value] || value;
  };
  const modeLabel = (mode: 'intracity' | 'intercity') => (mode === 'intercity' ? 'Şehirler Arası' : 'Şehir İçi');
  const titleCharCount = title.length;

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
    const run = async () => {
      if (!shipmentId) {
        setMessage('Yük kaydı bulunamadı.');
        setLoading(false);
        return;
      }
      try {
        const [citiesRes, shipmentRes] = await Promise.all([
          api.get<CityOption[]>('/lookups/cities'),
          api.get<ShipmentDetail>(`/shipments/${shipmentId}`),
        ]);

        const cityList = Array.isArray(citiesRes.data) ? citiesRes.data : [];
        const shipment = shipmentRes.data;
        const hasOffer =
          Number(shipment?.offerStats?.total || 0) > 0 ||
          (Array.isArray(shipment?.offers) ? shipment.offers.length > 0 : false);
        const isOpenPool = ['published', 'offer_collecting'].includes(String(shipment?.status || ''));

        if (isOpenPool && hasOffer) {
          setEditLockedReason('Bu ilan teklif aldı. Artık düzenlenemez, sadece iptal edilip yeniden yayınlanabilir.');
          setStatus(shipment.status || 'published');
          setLoading(false);
          return;
        }

        setCities(cityList);
        setTitle(shipment.title || '');
        setDescription(shipment.description || '');

        const originCity = cityList.find((x) => x.name === (shipment.pickupCity || ''));
        const destinationCity = cityList.find((x) => x.name === (shipment.dropoffCity || ''));

        if (originCity) {
          setOriginCityId(originCity.id);
          await loadDistricts(originCity.id);
        }
        if (destinationCity) {
          setDestinationCityId(destinationCity.id);
          await loadDistricts(destinationCity.id);
        }

        setOriginDistrict(shipment.pickupDistrict || '');
        setDestinationDistrict(shipment.dropoffDistrict || '');
        setScheduledAt(toInputDateTime(shipment.scheduledPickupAt));
        setDeliveryDeadlineAt(toInputDateTime(shipment.deliveryDeadlineAt));
        setIsUrgent(Boolean(shipment.isUrgent));
        setNeedsPackaging(Boolean(shipment.needsPackaging));
        setNeedsAssembly(Boolean(shipment.needsAssembly));
        setNeedsHelper(Boolean(shipment.needsHelper));
        setNeedsElevator(Boolean(shipment.needsElevator));
        setEstimatedWeightKg(typeof shipment.estimatedWeightKg === 'number' ? String(shipment.estimatedWeightKg) : '');
        setEstimatedVolumeM3(typeof shipment.estimatedVolumeM3 === 'number' ? String(shipment.estimatedVolumeM3) : '');
        setPieceCount(typeof shipment.pieceCount === 'number' ? String(shipment.pieceCount) : '');
        setStatus(shipment.status || 'published');
      } catch (error: any) {
        setMessage(error?.response?.data?.message || 'Yük düzenleme verileri alınamadı.');
      } finally {
        setLoading(false);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

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

  const submit = async () => {
    if (!shipmentId) return;
    if (editLockedReason) return;

    const originCity = cities.find((x) => x.id === originCityId)?.name;
    const destinationCity = cities.find((x) => x.id === destinationCityId)?.name;

    if (!title.trim() || title.trim().length < 3) {
      setMessage('İlan başlığı en az 3 karakter olmalıdır.');
      return;
    }
    if (/[\r\n]/.test(title)) {
      setMessage('İlan başlığı tek satır olmalıdır.');
      return;
    }
    if (!originCity || !destinationCity) {
      setMessage('Çıkış ve varış şehirleri zorunludur.');
      return;
    }
    if (scheduledAt && deliveryDeadlineAt) {
      const start = new Date(scheduledAt).getTime();
      const end = new Date(deliveryDeadlineAt).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
        setMessage('Teslim son tarihi, yükleme tarihinden önce olamaz.');
        return;
      }
    }
    if (estimatedWeightKg && Number(estimatedWeightKg) < 0) {
      setMessage('Ağırlık negatif olamaz.');
      return;
    }
    if (estimatedVolumeM3 && Number(estimatedVolumeM3) < 0) {
      setMessage('Hacim negatif olamaz.');
      return;
    }
    if (pieceCount && Number(pieceCount) < 0) {
      setMessage('Parça sayısı negatif olamaz.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await api.patch(`/shipments/${shipmentId}`, {
        title: title.trim(),
        description: description.trim() || undefined,
        originCity,
        originDistrict: originDistrict || undefined,
        destinationCity,
        destinationDistrict: destinationDistrict || undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        deliveryDeadlineAt: deliveryDeadlineAt ? new Date(deliveryDeadlineAt).toISOString() : undefined,
        isUrgent,
        needsPackaging,
        needsAssembly,
        needsHelper,
        needsElevator,
        estimatedWeightKg: estimatedWeightKg ? Number(estimatedWeightKg) : undefined,
        estimatedVolumeM3: estimatedVolumeM3 ? Number(estimatedVolumeM3) : undefined,
        pieceCount: pieceCount ? Number(pieceCount) : undefined,
        status,
      });

      await Swal.fire({ icon: 'success', title: 'Yük güncellendi', timer: 1400, showConfirmButton: false });
      navigate(`/hesabim/yuk/${shipmentId}`);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Yük güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4 text-secondary">Yük düzenleme sayfası yükleniyor...</div>
      </section>
    );
  }

  return (
    <section className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
        <h1 className="shipment-page-title mb-0">Yük Düzenle</h1>
        <div className="d-flex gap-2">
          <Link to={shipmentId ? `/hesabim/yuk/${shipmentId}` : '/hesabim'} className="btn btn-outline-secondary">Detaya Dön</Link>
          <Link to="/hesabim" className="btn btn-outline-primary">Hesabım</Link>
        </div>
      </div>

      {message ? <div className="alert alert-warning">{message}</div> : null}
      {editLockedReason ? (
        <div className="panel-card p-4">
          <div className="alert alert-warning mb-3">{editLockedReason}</div>
          <div className="d-flex flex-wrap gap-2">
            <Link to={shipmentId ? `/hesabim/yuk/${shipmentId}` : '/hesabim'} className="btn btn-outline-primary">
              Ilan Detayina Git
            </Link>
            <Link to="/hesabim?panel=shipments" className="btn btn-outline-secondary">
              Olusturdugum Yuklere Don
            </Link>
          </div>
        </div>
      ) : null}

      {!editLockedReason ? (
      <div className="panel-card p-4">
        <div className="shipment-edit-summary mb-4">
          <div className="shipment-edit-summary-item">
            <small>Taşıma Modu</small>
            <strong>{modeLabel(computedTransportMode)}</strong>
          </div>
          <div className="shipment-edit-summary-item">
            <small>Durum</small>
            <strong>{statusLabel(status)}</strong>
          </div>
          <div className="shipment-edit-summary-item">
            <small>Başlık Karakter</small>
            <strong>{titleCharCount}/120</strong>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-md-8">
            <label className="form-label">İlan Başlığı *</label>
            <input className="form-control" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value.replace(/[\r\n]/g, ''))} />
            <small className="text-secondary">Net, kısa ve tek satır başlık kullanın.</small>
          </div>
          <div className="col-md-4">
            <label className="form-label">Durum</label>
            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as ShipmentDetail['status'])}>
              <option value="draft">Taslak</option>
              <option value="published">Yayında</option>
              <option value="offer_collecting">Teklif Topluyor</option>
              <option value="matched">Eşleşti</option>
              <option value="cancelled">İptal</option>
              <option value="completed">Tamamlandı</option>
              <option value="suspended">Durduruldu</option>
            </select>
          </div>

          <div className="col-12">
            <label className="form-label">İlan Açıklaması ve Notlar</label>
            <textarea className="form-control" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
            <small className="text-secondary">Yük detaylarını ve dikkat edilmesi gereken notları bu alanda güncelleyebilirsiniz.</small>
          </div>

          <div className="col-md-3">
            <label className="form-label">Çıkış Şehir *</label>
            <select className="form-select" value={originCityId} onChange={(e) => setOriginCityId(e.target.value)}>
              <option value="">Seçiniz</option>
              {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Çıkış İlçe</label>
            <select className="form-select" value={originDistrict} onChange={(e) => setOriginDistrict(e.target.value)} disabled={!originCityId}>
              <option value="">Seçiniz</option>
              {originDistrictOptions.map((d) => (<option key={d.id} value={d.name}>{d.name}</option>))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Varış Şehir *</label>
            <select className="form-select" value={destinationCityId} onChange={(e) => setDestinationCityId(e.target.value)}>
              <option value="">Seçiniz</option>
              {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Varış İlçe</label>
            <select className="form-select" value={destinationDistrict} onChange={(e) => setDestinationDistrict(e.target.value)} disabled={!destinationCityId}>
              <option value="">Seçiniz</option>
              {destinationDistrictOptions.map((d) => (<option key={d.id} value={d.name}>{d.name}</option>))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Yükleme Tarihi</label>
            <input className="form-control" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label">Teslim Son Tarih</label>
            <input className="form-control" type="datetime-local" value={deliveryDeadlineAt} onChange={(e) => setDeliveryDeadlineAt(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Ağırlık (kg)</label>
            <input className="form-control" type="number" min={0} value={estimatedWeightKg} onChange={(e) => setEstimatedWeightKg(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Hacim (m3)</label>
            <input className="form-control" type="number" min={0} step="0.1" value={estimatedVolumeM3} onChange={(e) => setEstimatedVolumeM3(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Parça Sayısı</label>
            <input className="form-control" type="number" min={0} value={pieceCount} onChange={(e) => setPieceCount(e.target.value)} />
          </div>

          <div className="col-12">
            <label className="form-label d-block">Hizmet Nitelikleri</label>
            <div className="d-flex flex-wrap gap-3">
              <label className="form-check"><input className="form-check-input" type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} /> <span className="form-check-label">Acil</span></label>
              <label className="form-check"><input className="form-check-input" type="checkbox" checked={needsPackaging} onChange={(e) => setNeedsPackaging(e.target.checked)} /> <span className="form-check-label">Paketleme</span></label>
              <label className="form-check"><input className="form-check-input" type="checkbox" checked={needsAssembly} onChange={(e) => setNeedsAssembly(e.target.checked)} /> <span className="form-check-label">Montaj</span></label>
              <label className="form-check"><input className="form-check-input" type="checkbox" checked={needsHelper} onChange={(e) => setNeedsHelper(e.target.checked)} /> <span className="form-check-label">Yardımcı Personel</span></label>
              <label className="form-check"><input className="form-check-input" type="checkbox" checked={needsElevator} onChange={(e) => setNeedsElevator(e.target.checked)} /> <span className="form-check-label">Asansör</span></label>
            </div>
          </div>

          <div className="col-12 d-flex gap-2">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void submit()}>
              {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
            <Link to={shipmentId ? `/hesabim/yuk/${shipmentId}` : '/hesabim'} className="btn btn-outline-secondary">Vazgeç</Link>
          </div>
        </div>
      </div>
      ) : null}
    </section>
  );
}
