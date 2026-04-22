import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type RegisterContract = {
  _id: string;
  title: string;
  slug: string;
  summary?: string;
  isRequiredOnRegister?: boolean;
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'shipper' | 'carrier'>('shipper');
  const [message, setMessage] = useState('');

  const [contracts, setContracts] = useState<RegisterContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [acceptedContractSlugs, setAcceptedContractSlugs] = useState<string[]>([]);

  const requiredContracts = useMemo(
    () => contracts.filter((item) => item.isRequiredOnRegister),
    [contracts],
  );

  const loadRegisterContracts = async (nextRole: 'shipper' | 'carrier') => {
    setContractsLoading(true);
    try {
      const { data } = await api.get<RegisterContract[]>('/content/register-contracts', {
        params: { role: nextRole },
      });
      const rows = Array.isArray(data) ? data : [];
      setContracts(rows);

      const validSlugs = new Set(rows.map((row) => row.slug));
      setAcceptedContractSlugs((prev) => prev.filter((slug) => validSlugs.has(slug)));
    } catch {
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  useEffect(() => {
    void loadRegisterContracts(role);
  }, [role]);

  const toggleContract = (slug: string, checked: boolean) => {
    setAcceptedContractSlugs((prev) => {
      if (checked) return [...new Set([...prev, slug])];
      return prev.filter((item) => item !== slug);
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');

    const missingRequired = requiredContracts.filter((contract) => !acceptedContractSlugs.includes(contract.slug));
    if (missingRequired.length) {
      setMessage('Kayıt için zorunlu sozlesmeleri onaylamalisiniz.');
      return;
    }

    try {
      await api.post('/auth/register', {
        fullName,
        phone,
        email,
        password,
        role,
        acceptedContractSlugs,
      });

      // Kayıt sonrasi otomatik giris: kullaniçiyi dogrulama adimina yonlendirir.
      const loginRes = await api.post('/auth/login', { phone, password });
      localStorage.setItem('an_user_token', loginRes.data?.token || '');
      if (loginRes.data?.user) {
        localStorage.setItem('an_user_profile', JSON.stringify(loginRes.data.user));
      }

      setMessage('Kayıt ve giris başarılı. Telefon dogrulama adimina yonlendiriliyorsunuz...');
      setTimeout(() => navigate('/app'), 350);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Kayıt başarısız.');
    }
  };

  return (
    <section className="auth-page-wrap">
      <div className="container">
        <div className="auth-shell-card">
          <div className="auth-form-col">
            <div className="auth-brand-row mb-3">
              <span className="auth-dot" />
              <strong>mobilkargo.com</strong>
            </div>

            <h2 className="auth-title">Hesap Oluştur</h2>
            <p className="auth-subtitle">Kisa kayit adimlariyla hesabini ac, dogrulama süreçini tamamla ve platformu aktif kullan.</p>

            <form className="auth-form-grid" onSubmit={submit}>
              <div>
                <label className="auth-label">Ad Soyad <span>*</span></label>
                <div className="auth-input-wrap">
                  <i className="bi bi-person" />
                  <input className="form-control auth-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="auth-label">Telefon <span>*</span></label>
                <div className="auth-input-wrap">
                  <i className="bi bi-telephone" />
                  <input className="form-control auth-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="auth-label">E-posta <span>*</span></label>
                <div className="auth-input-wrap">
                  <i className="bi bi-envelope" />
                  <input className="form-control auth-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="auth-label">Sifre <span>*</span></label>
                <div className="auth-input-wrap">
                  <i className="bi bi-lock" />
                  <input
                    className="form-control auth-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowPassword((v) => !v)}>
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                </div>
              </div>

              <div>
                <label className="auth-label">Hesap Turu</label>
                <select className="form-select auth-input" value={role} onChange={(e) => setRole(e.target.value as 'shipper' | 'carrier')}>
                  <option value="shipper">Yük Sahibi</option>
                  <option value="carrier">Tasiyiçi</option>
                </select>
              </div>

              <div>
                <label className="auth-label">Sozlesmeler <span>*</span></label>
                <div className="border rounded-3 p-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {contractsLoading ? (
                    <div className="text-secondary small">Sozlesmeler yükleniyor...</div>
                  ) : contracts.length === 0 ? (
                    <div className="text-secondary small">Kayıt sozlesmesi bulunamadi. Lutfen yonetiçinizle gorusun.</div>
                  ) : (
                    <div className="d-grid gap-2">
                      {contracts.map((contract) => {
                        const checked = acceptedContractSlugs.includes(contract.slug);
                        return (
                          <label key={contract._id} className="d-flex align-items-start gap-2 small">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleContract(contract.slug, e.target.checked)}
                            />
                            <span>
                              <strong>{contract.title}</strong>
                              {contract.isRequiredOnRegister ? ' *' : ''}
                              {contract.summary ? <><br />{contract.summary}</> : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <button className="btn btn-primary auth-submit-btn">Kayıt Ol</button>

              <p className="auth-bottom-text mb-0">
                Zaten hesabin var mi? <Link to="/login">Giriş yap</Link>
              </p>
            </form>

            {message && <div className="alert alert-info mt-3 mb-0">{message}</div>}
          </div>

          <div className="auth-info-col">
            <h3>Taşıma agina guvenli sekilde katil</h3>
            <p>
              Yük sahibi veya tasiyiçi olarak rolune uygun akisa gec; ilan, teklif, belge ve mesaj adimlarini panelden izle.
            </p>

            <ul className="auth-benefits">
              <li><i className="bi bi-check-circle" /> 120 saat uyelik süreç takibi</li>
              <li><i className="bi bi-check-circle" /> Belge bazli dogrulama sistemi</li>
              <li><i className="bi bi-check-circle" /> Araç ve yuk tipi uyumlu eşleşme</li>
            </ul>

            <div className="auth-device-chip">
              <span className="status-dot" />
              <div>
                <small>Üyelik durumunu panelden takip et</small>
                <strong>Belge, arac ve teklif adimlari</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


