import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { api } from '../lib/api';

type VehicleDetail = {
  _id: string;
  plateMasked?: string;
  brand?: string;
  model?: string;
  modelYear?: number;
  payloadCapacityKg?: number;
  volumeCapacityM3?: number;
  serviceCities?: string[];
  serviceDistricts?: string[];
  supportedModes?: Array<'intracity' | 'intercity'>;
  vehicleTypeId?: { name?: string; slug?: string; supportedModes?: Array<'intracity' | 'intercity'> };
  supportedCargoTypeIds?: Array<{ name?: string; slug?: string }>;
};

type CityOption = { id: string; name: string };
type DistrictOption = { id: string; name: string; cityId: string };
type LookupLoadType = { key: string; label: string };

export function VehicleEditPage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [cities, setCities] = useState<CityOption[]>([]);
  const [districtByCity, setDistrictByCity] = useState<Record<string, DistrictOption[]>>({});
  const [loadTypes, setLoadTypes] = useState<LookupLoadType[]>([]);

  const [vehicleTypeName, setVehicleTypeName] = useState('');
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [capacityKg, setCapacityKg] = useState('');
  const [volumeM3, setVolumeM3] = useState('');
  const [modes, setModes] = useState<Array<'intracity' | 'intercity'>>([]);
  const [allowedModes, setAllowedModes] = useState<Array<'intracity' | 'intercity'>>(['intracity', 'intercity']);
  const [serviceCityId, setServiceCityId] = useState('');
  const [serviceDistricts, setServiceDistricts] = useState<string[]>([]);
  const [supportedLoadTypeSlugs, setSupportedLoadTypeSlugs] = useState<string[]>([]);

  const districtOptions = useMemo(() => districtByCity[serviceCityId] || [], [districtByCity, serviceCityId]);

  const modeLabel = (mode?: 'intracity' | 'intercity') => (mode === 'intercity' ? 'Şehirler Arası' : 'Şehir İçi');

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
      if (!vehicleId) {
        setMessage('Araç kaydı bulunamadı.');
        setLoading(false);
        return;
      }
      try {
        const [vehicleRes, citiesRes, loadTypesRes] = await Promise.all([
          api.get<VehicleDetail>(`/vehicles/${vehicleId}`),
          api.get<CityOption[]>('/lookups/cities'),
          api.get<LookupLoadType[]>('/lookups/load-types'),
        ]);

        const v = vehicleRes.data;
        const cityList = Array.isArray(citiesRes.data) ? citiesRes.data : [];
        setCities(cityList);
        setLoadTypes(Array.isArray(loadTypesRes.data) ? loadTypesRes.data : []);

        setVehicleTypeName(v.vehicleTypeId?.name || '-');
        setPlate(v.plateMasked || '');
        setBrand(v.brand || '');
        setModel(v.model || '');
        setYear(typeof v.modelYear === 'number' ? String(v.modelYear) : '');
        setCapacityKg(typeof v.payloadCapacityKg === 'number' ? String(v.payloadCapacityKg) : '');
        setVolumeM3(typeof v.volumeCapacityM3 === 'number' ? String(v.volumeCapacityM3) : '');

        const nextAllowed = (v.vehicleTypeId?.supportedModes || ['intracity', 'intercity']) as Array<'intracity' | 'intercity'>;
        setAllowedModes(nextAllowed.length ? nextAllowed : ['intracity', 'intercity']);

        const nextModes = (v.supportedModes || []).filter((m) => nextAllowed.includes(m));
        setModes(nextModes.length ? nextModes : nextAllowed.slice(0, 1));

        const serviceCityName = (v.serviceCities || [])[0];
        const foundCity = cityList.find((c) => c.name === serviceCityName);
        if (foundCity) {
          setServiceCityId(foundCity.id);
          await loadDistricts(foundCity.id);
        }
        setServiceDistricts(v.serviceDistricts || []);

        setSupportedLoadTypeSlugs((v.supportedCargoTypeIds || []).map((x) => x.slug || '').filter(Boolean));
      } catch (error: any) {
        setMessage(error?.response?.data?.message || 'Araç düzenleme verileri alınamadı.');
      } finally {
        setLoading(false);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  useEffect(() => {
    if (!serviceCityId) {
      setServiceDistricts([]);
      return;
    }
    void loadDistricts(serviceCityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceCityId]);

  const submit = async () => {
    if (!vehicleId) return;

    const cityName = cities.find((x) => x.id === serviceCityId)?.name;
    if (!plate.trim()) {
      setMessage('Plaka zorunludur.');
      return;
    }
    if (!cityName) {
      setMessage('Hizmet şehri zorunludur.');
      return;
    }
    if (!modes.length) {
      setMessage('En az bir taşıma modu seçilmelidir.');
      return;
    }
    if (!supportedLoadTypeSlugs.length) {
      setMessage('En az bir desteklenen yük tipi seçilmelidir.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await api.patch(`/vehicles/${vehicleId}`, {
        plate: plate.trim().toUpperCase(),
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        year: year ? Number(year) : undefined,
        capacityKg: capacityKg ? Number(capacityKg) : undefined,
        volumeM3: volumeM3 ? Number(volumeM3) : undefined,
        modes,
        serviceCities: [cityName],
        serviceDistricts: serviceDistricts.length ? serviceDistricts : [],
        supportedLoadTypeSlugs,
      });

      await Swal.fire({ icon: 'success', title: 'Araç güncellendi', timer: 1400, showConfirmButton: false });
      navigate(`/hesabim/arac/${vehicleId}`);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Araç güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4 text-secondary">Araç düzenleme sayfası yükleniyor...</div>
      </section>
    );
  }

  return (
    <section className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
        <h1 className="shipment-page-title mb-0">Araç Düzenle</h1>
        <div className="d-flex gap-2">
          <Link to={vehicleId ? `/hesabim/arac/${vehicleId}` : '/hesabim'} className="btn btn-outline-secondary">Detaya Dön</Link>
          <Link to="/hesabim" className="btn btn-outline-primary">Hesabım</Link>
        </div>
      </div>

      {message ? <div className="alert alert-warning">{message}</div> : null}

      <div className="panel-card p-4">
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label">Araç Tipi</label>
            <input className="form-control" value={vehicleTypeName} disabled />
          </div>
          <div className="col-md-4">
            <label className="form-label">Plaka *</label>
            <input className="form-control" value={plate} onChange={(e) => setPlate(e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label">Yıl</label>
            <input className="form-control" type="number" min={1990} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
          </div>

          <div className="col-md-4">
            <label className="form-label">Marka</label>
            <input className="form-control" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label">Model</label>
            <input className="form-control" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Kapasite (kg)</label>
            <input className="form-control" type="number" min={0} value={capacityKg} onChange={(e) => setCapacityKg(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Hacim (m3)</label>
            <input className="form-control" type="number" min={0} step="0.1" value={volumeM3} onChange={(e) => setVolumeM3(e.target.value)} />
          </div>

          <div className="col-md-6">
            <label className="form-label d-block">Taşıma Modları</label>
            <div className="d-flex flex-wrap gap-3">
              {(['intracity', 'intercity'] as Array<'intracity' | 'intercity'>).map((mode) => {
                const allowed = allowedModes.includes(mode);
                const checked = modes.includes(mode);
                return (
                  <label key={mode} className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      disabled={!allowed}
                      checked={checked}
                      onChange={(e) => {
                        if (!allowed) return;
                        setModes((prev) => {
                          if (e.target.checked) return prev.includes(mode) ? prev : [...prev, mode];
                          return prev.filter((m) => m !== mode);
                        });
                      }}
                    />
                    <span className="form-check-label">{modeLabel(mode)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="col-md-3">
            <label className="form-label">Hizmet Şehri *</label>
            <select className="form-select" value={serviceCityId} onChange={(e) => setServiceCityId(e.target.value)}>
              <option value="">Seçiniz</option>
              {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Hizmet İlçeleri</label>
            <select
              multiple
              className="form-select"
              disabled={!serviceCityId}
              style={{ minHeight: 130 }}
              value={serviceDistricts}
              onChange={(e) => {
                const next = Array.from(e.target.selectedOptions).map((x) => x.value);
                setServiceDistricts(next);
              }}
            >
              {districtOptions.map((d) => (<option key={d.id} value={d.name}>{d.name}</option>))}
            </select>
          </div>

          <div className="col-12">
            <label className="form-label d-block">Desteklenen Yük Tipleri</label>
            <div className="d-flex flex-wrap gap-2">
              {loadTypes.map((loadType) => {
                const selected = supportedLoadTypeSlugs.includes(loadType.key);
                return (
                  <button
                    key={loadType.key}
                    type="button"
                    className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() =>
                      setSupportedLoadTypeSlugs((prev) =>
                        selected ? prev.filter((x) => x !== loadType.key) : [...prev, loadType.key],
                      )
                    }
                  >
                    {loadType.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="col-12 d-flex gap-2">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void submit()}>
              {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
            <Link to={vehicleId ? `/hesabim/arac/${vehicleId}` : '/hesabim'} className="btn btn-outline-secondary">Vazgeç</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
