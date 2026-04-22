import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type LoginMethod = 'password' | 'otp';

export function LoginPage() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<LoginMethod>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);

  const persistSessionHints = () => {
    if (rememberMe) {
      localStorage.setItem('an_last_identifier', identifier);
    } else {
      localStorage.removeItem('an_last_identifier');
    }
  };

  const submitPassword = async () => {
    const { data } = await api.post('/auth/login', { phone: identifier, password });
    localStorage.setItem('an_user_token', data?.token || '');
    if (data?.user) {
      localStorage.setItem('an_user_profile', JSON.stringify(data.user));
    }
    persistSessionHints();
    setMessage('Giriş başarılı.');
    navigate('/app');
  };

  const submitOtp = async () => {
    const { data } = await api.post('/auth/login-otp', { phone: identifier, code: otpCode });
    localStorage.setItem('an_user_token', data?.token || '');
    if (data?.user) {
      localStorage.setItem('an_user_profile', JSON.stringify(data.user));
    }
    persistSessionHints();
    setMessage('OTP ile giris başarılı.');
    navigate('/app');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (method === 'password') {
        await submitPassword();
      } else {
        await submitOtp();
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Giriş başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async () => {
    setOtpSending(true);
    setMessage('');
    try {
      const { data } = await api.post('/auth/request-login-otp', { phone: identifier });
      setOtpSent(true);
      const debug = data?.otpDebugCode ? ` (debug: ${data.otpDebugCode})` : '';
      setMessage(`OTP kodu gönderildi${debug}`);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'OTP gönderimi başarısız.');
    } finally {
      setOtpSending(false);
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

            <h2 className="auth-title">Hesabina Giriş Yap</h2>
            <p className="auth-subtitle">Yük ilanlarini, tekliflerini ve operasyon durumlarini tek panelden yonet.</p>

            <div className="auth-method-tabs">
              <button type="button" className={`tab-btn ${method === 'password' ? 'active' : ''}`} onClick={() => setMethod('password')}>
                Telefon / Sifre
              </button>
              <button type="button" className={`tab-btn ${method === 'otp' ? 'active' : ''}`} onClick={() => setMethod('otp')}>
                OTP ile giris
              </button>
            </div>

            <form onSubmit={submit} className="auth-form-grid">
              <div>
                <label className="auth-label">Telefon numarası <span>*</span></label>
                <div className="auth-input-wrap">
                  <i className="bi bi-person" />
                  <input
                    className="form-control auth-input"
                    placeholder="05xx xxx xx xx"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
              </div>

              {method === 'password' ? (
                <>
                  <div>
                    <label className="auth-label">Sifre <span>*</span></label>
                    <div className="auth-input-wrap">
                      <i className="bi bi-lock" />
                      <input
                        className="form-control auth-input"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="******"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button type="button" className="auth-eye-btn" onClick={() => setShowPassword((v) => !v)}>
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                      </button>
                    </div>
                  </div>

                  <div className="auth-row-between">
                    <label className="remember-check">
                      <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                      <span>Beni hatirla</span>
                    </label>
                    <a href="#" className="auth-link">Sifremi unuttüm</a>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="auth-label">OTP kodu <span>*</span></label>
                    <div className="auth-input-wrap">
                      <i className="bi bi-shield-lock" />
                      <input
                        className="form-control auth-input"
                        placeholder="6 haneli kod"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      />
                    </div>
                  </div>

                  <div className="auth-row-between">
                    <label className="remember-check">
                      <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                      <span>Beni hatirla</span>
                    </label>
                    <button
                      type="button"
                      className="btn auth-social-btn auth-otp-send-btn"
                      disabled={otpSending || !identifier}
                      onClick={() => void requestOtp()}
                    >
                      {otpSending ? 'Gönderiliyor...' : otpSent ? 'Kodu tekrar gönder' : 'OTP kodu gönder'}
                    </button>
                  </div>
                </>
              )}

              <button className="btn btn-primary auth-submit-btn" disabled={loading || (method === 'otp' && (!otpCode || otpCode.length < 6))}>
                {loading ? 'Giriş yapiliyor...' : method === 'otp' ? 'OTP ile Giriş Yap' : 'Giriş Yap'}
              </button>

              <div className="auth-divider"><span>VEYA</span></div>

              <button type="button" className="btn auth-social-btn">
                <i className="bi bi-google" /> Hizli giris (yakinda)
              </button>

              <p className="auth-bottom-text mb-0">
                Hesabin yok mu? <Link to="/register">Hemen uye ol</Link>
              </p>
            </form>

            {message && <div className="alert alert-info mt-3 mb-0">{message}</div>}
          </div>

          <div className="auth-info-col">
            <h3>Nakliye operasyonunu hizlandirmaya hazir misin?</h3>
            <p>
              Doğrulanmis tasiyiçi havuzu, hedefli teklif akisi ve canli durum takibi ile süreçi hizlandir.
            </p>

            <ul className="auth-benefits">
              <li><i className="bi bi-check-circle" /> Guvenli teklif ve iletisim</li>
              <li><i className="bi bi-check-circle" /> Aktif/pasif uyelik kontrolu</li>
              <li><i className="bi bi-check-circle" /> Şehir içi odakli hızlı eşleşme</li>
            </ul>

            <div className="auth-device-chip">
              <span className="status-dot" />
              <div>
                <small>Son aktif oturum</small>
                <strong>Chrome - Istanbul, TR</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}



