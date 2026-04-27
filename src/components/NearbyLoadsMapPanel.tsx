import { useEffect, useMemo, useState } from 'react';
import { CircleF, GoogleMap, InfoWindow, MarkerF, useJsApiLoader } from '@react-google-maps/api';

type FeedLoad = {
  _id: string;
  title: string;
  pickupCity?: string;
  pickupDistrict?: string;
  dropoffCity?: string;
  dropoffDistrict?: string;
  pickupGeo?: { type?: string; coordinates?: [number, number] | number[] };
};

type NearbyLoadsMapPanelProps = {
  loads: FeedLoad[];
  onOpenDetail: (shipmentId: string) => void;
};

type LatLng = { lat: number; lng: number };

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

const haversineKm = (a: LatLng, b: LatLng) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return earthRadiusKm * c;
};

export function NearbyLoadsMapPanel({ loads, onOpenDetail }: NearbyLoadsMapPanelProps) {
  const [radiusKm, setRadiusKm] = useState(50);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [geoError, setGeoError] = useState('');
  const [activeMarkerShipmentId, setActiveMarkerShipmentId] = useState<string>('');

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'carrier-nearby-loads-google-map',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const pickupLoads = useMemo(() => {
    return (loads || [])
      .map((load) => {
        const coords = load.pickupGeo?.coordinates || [];
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const distanceKm = userLocation ? haversineKm(userLocation, { lat, lng }) : null;
        return { ...load, lat, lng, distanceKm };
      })
      .filter(Boolean) as Array<FeedLoad & { lat: number; lng: number; distanceKm: number | null }>;
  }, [loads, userLocation]);

  const nearbyLoads = useMemo(() => {
    const filtered = pickupLoads.filter((load) => {
      if (load.distanceKm == null) return true;
      return load.distanceKm <= radiusKm;
    });
    return filtered.sort((a, b) => {
      const ad = a.distanceKm ?? Number.MAX_SAFE_INTEGER;
      const bd = b.distanceKm ?? Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
  }, [pickupLoads, radiusKm]);

  const mapCenter = useMemo<LatLng>(() => {
    if (userLocation) return userLocation;
    if (nearbyLoads.length) return { lat: nearbyLoads[0].lat, lng: nearbyLoads[0].lng };
    return { lat: 39.0, lng: 35.0 };
  }, [nearbyLoads, userLocation]);

  const activeLoad = useMemo(
    () => nearbyLoads.find((row) => row._id === activeMarkerShipmentId) || null,
    [activeMarkerShipmentId, nearbyLoads],
  );

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      setGeoError('Tarayici konum ozelligini desteklemiyor.');
      return;
    }
    setGeoStatus('loading');
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('ready');
      },
      () => {
        setGeoStatus('error');
        setGeoError('Konum alinamadi. Tarayici iznini kontrol edin.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  return (
    <div className="panel-card p-4">
      <div className="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-3">
        <div>
          <h4 className="fw-bold mb-1">Yakinimdaki Yukler (Harita)</h4>
          <div className="text-secondary small">
            Pinler cikis noktasina gore gosterilir. Pine tiklayinca ilan detayina gidebilirsiniz.
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <label className="small text-secondary mb-0">Yaricap</label>
          <select
            className="form-select form-select-sm"
            style={{ width: 120 }}
            value={String(radiusKm)}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
          >
            <option value="10">10 km</option>
            <option value="25">25 km</option>
            <option value="50">50 km</option>
            <option value="100">100 km</option>
            <option value="250">250 km</option>
          </select>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={requestLocation}>
            Konumu Yenile
          </button>
        </div>
      </div>

      {geoStatus === 'loading' ? <div className="alert alert-info py-2">Konum aliniyor...</div> : null}
      {geoStatus === 'error' ? <div className="alert alert-warning py-2 mb-3">{geoError}</div> : null}
      {!GOOGLE_MAPS_API_KEY ? (
        <div className="alert alert-warning py-2 mb-3">
          Google Maps kapali: `VITE_GOOGLE_MAPS_API_KEY` tanimli degil.
        </div>
      ) : null}
      {loadError ? <div className="alert alert-danger py-2 mb-3">Google Maps yuklenemedi.</div> : null}

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <div style={{ height: 520, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
            {GOOGLE_MAPS_API_KEY && isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ height: '100%', width: '100%' }}
                center={mapCenter}
                zoom={userLocation ? 10 : 6}
                options={{
                  mapTypeControl: false,
                  fullscreenControl: false,
                  streetViewControl: false,
                }}
              >
                {userLocation ? (
                  <>
                    <CircleF
                      center={userLocation}
                      radius={radiusKm * 1000}
                      options={{
                        strokeColor: '#0d6efd',
                        strokeOpacity: 0.75,
                        strokeWeight: 2,
                        fillColor: '#0d6efd',
                        fillOpacity: 0.12,
                        clickable: false,
                      }}
                    />
                    <MarkerF
                      position={userLocation}
                      title="Sizin konumunuz"
                      icon={{
                        path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                        fillColor: '#0d6efd',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                        scale: 7,
                      }}
                      label={{ text: 'Ben', color: '#0d6efd', fontWeight: '700' }}
                    />
                  </>
                ) : null}

                {nearbyLoads.map((load) => (
                  <MarkerF
                    key={load._id}
                    position={{ lat: load.lat, lng: load.lng }}
                    title={load.title}
                    onClick={() => setActiveMarkerShipmentId(load._id)}
                  />
                ))}

                {activeLoad ? (
                  <InfoWindow
                    position={{ lat: activeLoad.lat, lng: activeLoad.lng }}
                    onCloseClick={() => setActiveMarkerShipmentId('')}
                  >
                    <div style={{ minWidth: 220 }}>
                      <div className="fw-semibold">{activeLoad.title}</div>
                      <div className="small text-secondary mb-2">
                        {activeLoad.pickupCity || '-'} / {activeLoad.dropoffCity || '-'}
                      </div>
                      <div className="small mb-2">
                        Cikis: {activeLoad.pickupDistrict || '-'} / {activeLoad.pickupCity || '-'}
                      </div>
                      <div className="small mb-2">
                        Mesafe: {activeLoad.distanceKm == null ? '-' : `${activeLoad.distanceKm.toFixed(1)} km`}
                      </div>
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => onOpenDetail(activeLoad._id)}>
                        Detay Sayfasina Git
                      </button>
                    </div>
                  </InfoWindow>
                ) : null}
              </GoogleMap>
            ) : (
              <div className="h-100 d-flex align-items-center justify-content-center text-secondary">
                Harita yukleniyor...
              </div>
            )}
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="border rounded-4 p-3" style={{ maxHeight: 520, overflowY: 'auto' }}>
            <div className="fw-semibold mb-2">Liste ({nearbyLoads.length})</div>
            {nearbyLoads.length === 0 ? (
              <div className="text-secondary small">
                Bu yaricapta koordinati olan ilan bulunamadi. Yaricapi artirabilir veya konumu yenileyebilirsiniz.
              </div>
            ) : (
              nearbyLoads.map((load) => (
                <button
                  key={load._id}
                  type="button"
                  className="btn btn-light border text-start w-100 mb-2"
                  onClick={() => onOpenDetail(load._id)}
                >
                  <div className="fw-semibold">{load.title}</div>
                  <div className="small text-secondary">
                    {load.pickupCity || '-'} / {load.dropoffCity || '-'} | {load.distanceKm == null ? '-' : `${load.distanceKm.toFixed(1)} km`}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
