import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, apiOrigin } from '../lib/api';

type NotificationType =
  | 'otp'
  | 'document_missing'
  | 'revision_required'
  | 'membership_approved'
  | 'membership_passive'
  | 'new_shipment'
  | 'new_offer'
  | 'offer_updated'
  | 'offer_withdrawn'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'shipment_matched'
  | 'shipment_completed'
  | 'shipment_cancelled'
  | 'message_received'
  | 'review_received'
  | 'review_reply_requested'
  | 'complaint_created'
  | 'admin_broadcast';

type NotificationRow = {
  _id: string;
  type: NotificationType;
  channel: 'sms' | 'email' | 'push' | 'in_app';
  title: string;
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'read';
  createdAt: string;
  readAt?: string;
  payload?: {
    shipmentId?: string;
    conversationId?: string;
    [key: string]: unknown;
  };
};

type NotificationTab = 'all' | 'message' | 'offer' | 'shipment' | 'review' | 'system';

const typeLabelMap: Record<NotificationType, string> = {
  otp: 'OTP',
  document_missing: 'Eksik Belge',
  revision_required: 'Belge Revizyonu',
  membership_approved: 'Uyelik Onayi',
  membership_passive: 'Uyelik Pasif',
  new_shipment: 'Yeni Ilan',
  new_offer: 'Yeni Teklif',
  offer_updated: 'Teklif Guncellendi',
  offer_withdrawn: 'Teklif Geri Cekildi',
  offer_accepted: 'Teklif Kabul Edildi',
  offer_rejected: 'Teklif Reddedildi',
  shipment_matched: 'Eslesme Tamamlandi',
  shipment_completed: 'Tasima Tamamlandi',
  shipment_cancelled: 'Ilan Iptal',
  message_received: 'Yeni Mesaj',
  review_received: 'Yeni Yorum',
  review_reply_requested: 'Yorum Cevabi Bekleniyor',
  complaint_created: 'Ilan Sikayeti',
  admin_broadcast: 'Duyuru',
};

const typeIconMap: Record<NotificationType, string> = {
  otp: 'bi-shield-lock',
  document_missing: 'bi-file-earmark-exclamation',
  revision_required: 'bi-pencil-square',
  membership_approved: 'bi-patch-check',
  membership_passive: 'bi-pause-circle',
  new_shipment: 'bi-box-seam',
  new_offer: 'bi-currency-exchange',
  offer_updated: 'bi-arrow-repeat',
  offer_withdrawn: 'bi-arrow-left-circle',
  offer_accepted: 'bi-check2-circle',
  offer_rejected: 'bi-x-circle',
  shipment_matched: 'bi-link-45deg',
  shipment_completed: 'bi-check-circle-fill',
  shipment_cancelled: 'bi-slash-circle',
  message_received: 'bi-chat-left-dots',
  review_received: 'bi-star-fill',
  review_reply_requested: 'bi-chat-left-text',
  complaint_created: 'bi-exclamation-triangle',
  admin_broadcast: 'bi-megaphone',
};

const resolveTab = (type: NotificationType): NotificationTab => {
  if (type === 'message_received') return 'message';
  if (['new_offer', 'offer_updated', 'offer_withdrawn', 'offer_accepted', 'offer_rejected'].includes(type)) return 'offer';
  if (['new_shipment', 'shipment_matched', 'shipment_completed', 'shipment_cancelled', 'complaint_created'].includes(type)) return 'shipment';
  if (['review_received', 'review_reply_requested'].includes(type)) return 'review';
  return 'system';
};

const tabLabelMap: Record<NotificationTab, string> = {
  all: 'Tum Bildirimler',
  message: 'Mesajlar',
  offer: 'Teklifler',
  shipment: 'Yuk Durumlari',
  review: 'Yorumlar',
  system: 'Sistem',
};

const relativeTime = (value: string) => {
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'simdi';
  if (mins < 60) return `${mins} dk once`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa once`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gun once`;
  return new Date(value).toLocaleDateString('tr-TR');
};

export function NotificationsPage() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [query, setQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const token = localStorage.getItem('an_user_token');

  const loadRows = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await api.get<{ unreadCount?: number; rows?: NotificationRow[] }>('/notifications/my', {
        params: { limit: 100 },
      });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setUnreadCount(Number(data?.unreadCount || 0));
      setErrorMessage('');
    } catch {
      setRows([]);
      setUnreadCount(0);
      setErrorMessage('Bildirimler yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void loadRows();

    const socket = io(apiOrigin, {
      transports: ['websocket'],
      auth: { token },
    });
    socket.on('notifications:refresh', () => {
      void loadRows();
    });
    socket.on('connect', () => {
      void loadRows();
    });

    const intervalId = window.setInterval(() => {
      void loadRows();
    }, 30000);

    return () => {
      socket.disconnect();
      window.clearInterval(intervalId);
    };
  }, [loadRows, token]);

  const stats = useMemo(() => {
    const byTab: Record<NotificationTab, number> = {
      all: rows.length,
      message: 0,
      offer: 0,
      shipment: 0,
      review: 0,
      system: 0,
    };
    rows.forEach((row) => {
      byTab[resolveTab(row.type)] += 1;
    });
    return byTab;
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (onlyUnread) result = result.filter((row) => row.status !== 'read');
    if (activeTab !== 'all') result = result.filter((row) => resolveTab(row.type) === activeTab);
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (q) {
      result = result.filter((row) => {
        const haystack = `${row.title} ${row.body} ${typeLabelMap[row.type] || row.type}`.toLocaleLowerCase('tr-TR');
        return haystack.includes(q);
      });
    }
    return result;
  }, [activeTab, onlyUnread, query, rows]);

  const markOneRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    await loadRows();
    window.dispatchEvent(new CustomEvent('notifications:local-updated'));
  };

  const markAllRead = async () => {
    await api.patch('/notifications/my/read-all');
    await loadRows();
    window.dispatchEvent(new CustomEvent('notifications:local-updated'));
  };

  if (!token) {
    return (
      <section className="container py-5 notifications-page">
        <div className="card border-0 shadow-sm notifications-shell text-center p-4">
          <h2 className="fw-bold">Bildirimler</h2>
          <p className="text-secondary mb-3">Bildirimlerinizi gormek icin giris yapmaniz gerekiyor.</p>
          <div className="d-flex justify-content-center gap-2">
            <NavLink to="/login" className="btn btn-primary">Giris Yap</NavLink>
            <NavLink to="/register" className="btn btn-outline-primary">Kayit Ol</NavLink>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="container py-4 notifications-page">
      <div className="notifications-shell notifications-shell-premium">
        {errorMessage ? <div className="alert alert-warning m-3 mb-0">{errorMessage}</div> : null}
        <div className="notifications-hero">
          <div className="notifications-hero-main">
            <p className="notifications-kicker mb-1">Bildirim Merkezi</p>
            <h2 className="mb-1">Bildirimlerim</h2>
            <p className="mb-0">Tum operasyon, mesaj, teklif ve yorum hareketlerini tek ekranda takip et.</p>
          </div>
          <div className="notifications-hero-stats">
            <div className="notifications-stat">
              <span>Toplam</span>
              <strong>{rows.length}</strong>
            </div>
            <div className="notifications-stat is-accent">
              <span>Okunmamis</span>
              <strong>{unreadCount}</strong>
            </div>
          </div>
        </div>

        <div className="notifications-toolbar">
          <div className="notifications-tabs">
            {(Object.keys(tabLabelMap) as NotificationTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`notifications-tab-btn ${activeTab === tab ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <span>{tabLabelMap[tab]}</span>
                <em>{tab === 'all' ? stats.all : stats[tab]}</em>
              </button>
            ))}
          </div>

          <div className="notifications-toolbar-actions">
            <label className="notifications-search">
              <i className="bi bi-search" />
              <input
                type="text"
                placeholder="Bildirim ara..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={`btn btn-sm ${onlyUnread ? 'btn-warning' : 'btn-outline-secondary'}`}
              onClick={() => setOnlyUnread((prev) => !prev)}
            >
              {onlyUnread ? 'Tumunu Goster' : 'Sadece Okunmamis'}
            </button>
            <button type="button" className="btn btn-sm btn-success" onClick={() => void markAllRead()} disabled={unreadCount <= 0}>
              Tumunu Okundu Isaretle
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-3 text-secondary">Yukleniyor...</div>
        ) : filteredRows.length === 0 ? (
          <div className="notifications-empty">
            <i className="bi bi-bell-slash" />
            <p className="mb-0">Gosterilecek bildirim bulunmuyor.</p>
          </div>
        ) : (
          <div className="notifications-list">
            {filteredRows.map((row) => {
              const isUnread = row.status !== 'read';
              const shipmentId = String(row.payload?.shipmentId || '').trim();
              const conversationId = String(row.payload?.conversationId || '').trim();
              const targetHref = conversationId
                ? `/mesajlar/${conversationId}`
                : shipmentId
                  ? `/hesabim/yuk/${shipmentId}`
                  : null;

              return (
                <article key={row._id} className={`notifications-item notifications-item-premium ${isUnread ? 'is-unread' : ''}`}>
                  <div className="notifications-item-icon">
                    <i className={`bi ${typeIconMap[row.type] || 'bi-bell'}`} />
                  </div>
                  <div className="notifications-item-main">
                    <div className="notifications-item-top">
                      <span className="notifications-type-pill">{typeLabelMap[row.type] || row.type}</span>
                      <small>{new Date(row.createdAt).toLocaleString('tr-TR')} · {relativeTime(row.createdAt)}</small>
                    </div>
                    <h6>{row.title}</h6>
                    <p className="mb-0">{row.body}</p>
                  </div>
                  <div className="notifications-item-actions">
                    {targetHref ? (
                      <NavLink to={targetHref} className="btn btn-sm btn-outline-primary">
                        Detaya Git
                      </NavLink>
                    ) : null}
                    {isUnread ? (
                      <button type="button" className="btn btn-sm btn-outline-success" onClick={() => void markOneRead(row._id)}>
                        Okundu
                      </button>
                    ) : (
                      <span className="badge text-bg-success">Okundu</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
