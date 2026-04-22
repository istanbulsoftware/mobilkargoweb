import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

type CarrierPlan = {
  id: string;
  title: string;
  monthlyOfferLimit: number | null;
  isUnlimited: boolean;
  price: number;
  currency: string;
};

type UserProfile = {
  role: 'shipper' | 'carrier' | 'admin';
  fullName?: string;
};

export function SubscriptionCheckoutPage() {
  const navigate = useNavigate();
  const { planId = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<CarrierPlan | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState('');

  const [cardHolderName, setCardHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');

  const token = localStorage.getItem('an_user_token');
  const normalizedPlanId =
    planId === 'free'
      ? 'plan-1776496536900'
      : planId === 'pro'
      ? 'plan-1776496671427'
      : planId;

  useEffect(() => {
    const load = async () => {
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        setLoading(true);
        const [profileRes, plansRes] = await Promise.all([
          api.get<UserProfile>('/users/me/profile'),
          api.get<CarrierPlan[]>('/carrier-subscriptions/plans'),
        ]);
        setProfile(profileRes.data);

        const matchedPlan = (plansRes.data || []).find((p) => p.id === normalizedPlanId) || null;
        setPlan(matchedPlan);
        if (!matchedPlan) {
          setError('Secilen abonelik paketi bulunamadi.');
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Abonelik bilgileri yuklenemedi.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [navigate, normalizedPlanId, token]);

  const canPurchase = useMemo(() => profile?.role === 'carrier' && !!plan, [plan, profile?.role]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!plan || !canPurchase) return;

    try {
      setSubmitting(true);
      setResultMessage('');
      await api.post('/carrier-subscriptions/purchase', {
        planId: plan.id,
        cardHolderName,
        cardNumber,
        expiryMonth,
        expiryYear,
        cvv,
      });
      setResultMessage('Abonelik satin alma islemi basarili. Hesabim sayfasina yonlendiriliyorsunuz.');
      window.setTimeout(() => navigate('/hesabim'), 1200);
    } catch (err: any) {
      setResultMessage(err?.response?.data?.message || 'Odeme islemi basarisiz oldu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4 text-center">Yukleniyor...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4">
          <h2 className="h4 mb-3">Abonelik odeme sayfasi</h2>
          <p className="text-danger mb-3">{error}</p>
          <Link className="btn btn-outline-primary" to="/">Ana sayfaya don</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="container py-5">
      <div className="row g-4">
        <div className="col-lg-5">
          <article className="panel-card p-4 checkout-plan-card h-100">
            <div className="checkout-plan-badge">Secilen Paket</div>
            <h1 className="h3 fw-bold mb-1">{plan?.title}</h1>
            <p className="text-secondary mb-3">
              {plan?.isUnlimited
                ? 'Sinirsiz aylik teklif hakki'
                : `Aylik teklif limiti: ${plan?.monthlyOfferLimit ?? 0}`}
            </p>
            <div className="checkout-price mb-3">
              <strong>{plan?.currency === 'TRY' ? '₺' : '$'}{plan?.price}</strong>
              <span>/ aylik</span>
            </div>
            <ul className="list-unstyled d-grid gap-2 mb-0">
              <li><i className="bi bi-check2-circle me-2"></i>Dogrulanmis tasiyiciya ozel</li>
              <li><i className="bi bi-check2-circle me-2"></i>Plan aninda hesaba tanimlanir</li>
              <li><i className="bi bi-check2-circle me-2"></i>Admin panelde satin alma kaydi olusur</li>
            </ul>
          </article>
        </div>
        <div className="col-lg-7">
          <article className="panel-card p-4 checkout-form-card">
            <h2 className="h4 fw-bold mb-1">Premium odeme</h2>
            <p className="text-secondary mb-4">Demo kredi karti formu ile abonelik satin alin.</p>

            {profile?.role !== 'carrier' ? (
              <div className="alert alert-warning mb-0">
                Bu abonelik sadece tasiyici hesaplar icin satin alinabilir.
              </div>
            ) : (
              <form onSubmit={onSubmit} className="row g-3">
                <div className="col-12">
                  <label className="form-label">Kart sahibi</label>
                  <input className="form-control" value={cardHolderName} onChange={(e) => setCardHolderName(e.target.value)} required />
                </div>
                <div className="col-12">
                  <label className="form-label">Kart numarasi</label>
                  <input className="form-control" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4111111111111111" required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Ay</label>
                  <input className="form-control" value={expiryMonth} onChange={(e) => setExpiryMonth(e.target.value)} placeholder="12" required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Yil</label>
                  <input className="form-control" value={expiryYear} onChange={(e) => setExpiryYear(e.target.value)} placeholder="29" required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">CVV</label>
                  <input className="form-control" value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="123" required />
                </div>
                <div className="col-12 d-flex gap-2">
                  <button type="submit" className="btn btn-primary" disabled={!canPurchase || submitting}>
                    {submitting ? 'Islem yapiliyor...' : 'Aboneligi satin al'}
                  </button>
                  <Link className="btn btn-outline-secondary" to="/hesabim">Iptal</Link>
                </div>
                {resultMessage ? (
                  <div className="col-12">
                    <div className={`alert ${resultMessage.includes('basarili') ? 'alert-success' : 'alert-danger'} mb-0`}>
                      {resultMessage}
                    </div>
                  </div>
                ) : null}
              </form>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
