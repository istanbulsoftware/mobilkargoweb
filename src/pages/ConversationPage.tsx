import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { api, apiOrigin } from '../lib/api';

type Presence = {
  userId: string;
  status: 'online' | 'offline' | 'busy';
  lastSeenAt?: string | null;
  isOnline?: boolean;
};

type ParticipantUser = {
  id: string;
  fullName?: string;
  phone?: string;
  presence?: Presence;
};

type ChatMessage = {
  _id: string;
  conversationId?: string;
  senderUserId?: string | { _id?: string; fullName?: string };
  text?: string;
  createdAt?: string;
  updatedAt?: string;
  editedAt?: string;
  deliveredAt?: string;
  isRead?: boolean;
  readAt?: string;
  isPinned?: boolean;
  replyToMessageId?: {
    _id?: string;
    text?: string;
    senderUserId?: string | { _id?: string; fullName?: string };
    createdAt?: string;
  } | null;
};

type ConversationDetailResponse = {
  conversation?: {
    _id?: string;
    shipmentId?: { _id?: string; title?: string };
    status?: string;
  };
  participantUsers?: ParticipantUser[];
  messages?: ChatMessage[];
};

type ViewerProfile = {
  id: string;
  fullName?: string;
};

const canEditWithinWindow = (msg?: ChatMessage) => {
  if (!msg?.createdAt) return false;
  const diffSec = (Date.now() - new Date(msg.createdAt).getTime()) / 1000;
  return diffSec >= 0 && diffSec <= 10;
};

const statusLabel = (msg: ChatMessage, isMine: boolean) => {
  if (!isMine) return '';
  if (msg.readAt || msg.isRead) return 'Okundu';
  if (msg.deliveredAt) return 'İletildi';
  return 'Gönderildi';
};

const presenceLabel = (presence?: Presence) => {
  if (!presence) return 'Offline';
  if (presence.status === 'busy') return 'Meşgul';
  if (presence.status === 'online') return 'Online';
  return 'Offline';
};

const presenceClass = (presence?: Presence) => {
  if (presence?.status === 'online') return 'is-online';
  if (presence?.status === 'busy') return 'is-busy';
  return 'is-offline';
};

const initials = (name?: string) => {
  const safe = String(name || '').trim();
  if (!safe) return 'K';
  const parts = safe.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toLocaleUpperCase('tr-TR')).join('');
};

export function ConversationPage() {
  const { conversationId = '' } = useParams();
  const token = localStorage.getItem('an_user_token');

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [me, setMe] = useState<ViewerProfile | null>(null);
  const [participants, setParticipants] = useState<ParticipantUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editingText, setEditingText] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [conversationTitle, setConversationTitle] = useState('');

  const typingTimerRef = useRef<number | null>(null);
  const typingClearRef = useRef<Record<string, number>>({});
  const socketRef = useRef<Socket | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const didInitialScrollRef = useRef(false);

  const otherParticipant = useMemo(() => {
    if (!me?.id) return participants[0] || null;
    return participants.find((p) => p.id !== me.id) || participants[0] || null;
  }, [participants, me?.id]);

  const pinnedMessages = useMemo(() => messages.filter((m) => m.isPinned), [messages]);

  const renderRows = useMemo(() => {
    if (!searchTerm.trim()) return messages;
    const q = searchTerm.trim();
    return messages.filter((m) => String(m.text || '').toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR')));
  }, [messages, searchTerm]);

  const patchMessageInState = (next: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((item) => item._id === next._id);
      if (idx < 0) return [...prev, next];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...next };
      return copy;
    });
  };

  const loadConversation = async (opts?: { search?: string }) => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const [{ data: meData }, { data }] = await Promise.all([
        api.get<ViewerProfile>('/users/me/profile'),
        opts?.search
          ? api.get<ChatMessage[]>(`/conversations/${conversationId}/messages`, { params: { limit: 100, query: opts.search } })
          : api.get<ConversationDetailResponse>(`/conversations/${conversationId}`),
      ]);

      setMe(meData || null);

      if (Array.isArray(data)) {
        setMessages(data);
      } else {
        const rows = Array.isArray(data?.messages) ? data.messages : [];
        const participantRows = Array.isArray(data?.participantUsers) ? data.participantUsers : [];
        setParticipants(participantRows);
        setMessages(rows);
        setConversationTitle(data?.conversation?.shipmentId?.title || 'Mesajlaşma');
      }

      await api.patch(`/conversations/${conversationId}/read`);
      setMessage('');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Konuşma yüklenemedi.');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const setDelivered = async (messageId: string) => {
    if (!conversationId || !messageId) return;
    try {
      await api.patch(`/conversations/${conversationId}/messages/${messageId}/delivered`);
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    if (!token || !conversationId) {
      setLoading(false);
      return;
    }
    didInitialScrollRef.current = false;
    void loadConversation();
  }, [token, conversationId]);

  useEffect(() => {
    if (!token || !conversationId) return;

    const socket = io(apiOrigin, {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join:conversation', conversationId);
    });

    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('conversation:message', (payload: ChatMessage) => {
      if (String(payload?.conversationId || '') !== conversationId) return;
      patchMessageInState(payload);
      const senderId = typeof payload?.senderUserId === 'string' ? payload.senderUserId : String(payload?.senderUserId?._id || '');
      if (senderId && senderId !== me?.id && payload?._id) {
        void setDelivered(payload._id);
      }
      void api.patch(`/conversations/${conversationId}/read`).catch(() => undefined);
    });

    socket.on('conversation:message_updated', (payload: any) => {
      if (payload?.message?._id) {
        patchMessageInState(payload.message as ChatMessage);
        return;
      }
      if (payload?.messageId && payload?.deliveredAt) {
        patchMessageInState({ _id: payload.messageId, deliveredAt: payload.deliveredAt });
      }
    });

    socket.on('conversation:typing', (payload: { conversationId?: string; userId?: string; isTyping?: boolean }) => {
      if (String(payload?.conversationId || '') !== conversationId) return;
      if (!payload?.userId || payload.userId === me?.id) return;
      const userId = payload.userId;
      if (payload.isTyping) {
        setTypingUsers((prev) => ({ ...prev, [userId]: 'yazıyor...' }));
        if (typingClearRef.current[userId]) window.clearTimeout(typingClearRef.current[userId]);
        typingClearRef.current[userId] = window.setTimeout(() => {
          setTypingUsers((prev) => {
            const copy = { ...prev };
            delete copy[userId];
            return copy;
          });
        }, 1800);
      } else {
        setTypingUsers((prev) => {
          const copy = { ...prev };
          delete copy[userId];
          return copy;
        });
      }
    });

    socket.on('user:presence', (payload: Presence) => {
      if (!payload?.userId) return;
      setParticipants((prev) => prev.map((row) => (row.id === payload.userId ? { ...row, presence: payload } : row)));
    });

    return () => {
      try {
        socket.emit('typing:conversation', { conversationId, isTyping: false });
        socket.emit('leave:conversation', conversationId);
      } catch {
        // no-op
      }
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [token, conversationId, me?.id]);

  const scrollToBottom = () => {
    if (!messageListRef.current) return;
    const el = messageListRef.current;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [renderRows.length]);

  useEffect(() => {
    if (loading || didInitialScrollRef.current) return;
    const timer = window.setTimeout(() => {
      scrollToBottom();
      didInitialScrollRef.current = true;
    }, 40);
    return () => window.clearTimeout(timer);
  }, [loading, conversationId]);

  useEffect(() => {
    if (!otherParticipant?.id) return;
    void api
      .get<Presence[]>('/conversations/presence', { params: { userIds: otherParticipant.id } })
      .then((res) => {
        const row = Array.isArray(res.data) ? res.data[0] : null;
        if (!row) return;
        setParticipants((prev) => prev.map((item) => (item.id === otherParticipant.id ? { ...item, presence: row } : item)));
      })
      .catch(() => undefined);
  }, [otherParticipant?.id]);

  const triggerTyping = () => {
    if (!socketRef.current || !conversationId) return;
    socketRef.current.emit('typing:conversation', { conversationId, isTyping: true });
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      socketRef.current?.emit('typing:conversation', { conversationId, isTyping: false });
    }, 1200);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!conversationId || !text) return;
    setSending(true);
    try {
      const { data } = await api.post<ChatMessage>(`/conversations/${conversationId}/messages`, {
        messageType: 'text',
        text,
        replyToMessageId: replyTarget?._id,
      });
      patchMessageInState(data);
      setInput('');
      setReplyTarget(null);
      socketRef.current?.emit('typing:conversation', { conversationId, isTyping: false });
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Mesaj gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  const handleEdit = async (msg: ChatMessage) => {
    if (!conversationId || !editingText.trim()) return;
    try {
      const { data } = await api.patch<ChatMessage>(`/conversations/${conversationId}/messages/${msg._id}`, {
        text: editingText.trim(),
      });
      patchMessageInState(data);
      setEditingMessageId('');
      setEditingText('');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Mesaj düzenlenemedi.');
    }
  };

  const handlePin = async (msg: ChatMessage, isPinned: boolean) => {
    if (!conversationId) return;
    try {
      const { data } = await api.patch<ChatMessage>(`/conversations/${conversationId}/messages/${msg._id}/pin`, { isPinned });
      patchMessageInState(data);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Mesaj sabitlenemedi.');
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      await loadConversation();
      return;
    }
    await loadConversation({ search: searchTerm.trim() });
  };

  if (!token) {
    return (
      <section className="container py-5">
        <div className="alert alert-warning">Mesajlaşma için giriş yapmalısınız.</div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4 text-secondary">Mesajlar yükleniyor...</div>
      </section>
    );
  }

  return (
    <section className="container py-5 conversation-premium-page">
      <div className="conversation-premium-head panel-card p-3 p-md-4 mb-3">
        <div className="conversation-premium-user">
          <div className="conversation-premium-avatar">{initials(otherParticipant?.fullName)}</div>
          <div>
            <h1 className="shipment-page-title mb-0">{otherParticipant?.fullName || 'Mesajlaşma'}</h1>
            <div className="small text-secondary mt-1">
              <span className={`presence-dot ${presenceClass(otherParticipant?.presence)}`}></span>
              {presenceLabel(otherParticipant?.presence)}
              {' · '}
              Son görülme: {otherParticipant?.presence?.lastSeenAt ? new Date(otherParticipant.presence.lastSeenAt).toLocaleString('tr-TR') : '-'}
            </div>
            <div className="small text-secondary">{conversationTitle || 'Konuşma detayı'}</div>
          </div>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <span className={`shipment-status-pill ${socketConnected ? 'tone-success' : 'tone-warning'}`}>
            {socketConnected ? 'Canlı' : 'Bağlanıyor'}
          </span>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => socketRef.current?.emit('set:presence', { status: 'online' })}>Online</button>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => socketRef.current?.emit('set:presence', { status: 'busy' })}>Meşgul</button>
          <Link to="/mesajlar" className="btn btn-outline-primary">Konuşmalar</Link>
        </div>
      </div>

      {message ? <div className="alert alert-warning">{message}</div> : null}

      <div className="panel-card p-3 p-md-4">
        {Object.keys(typingUsers).length > 0 ? (
          <div className="conversation-typing-banner mb-2">
            <i className="bi bi-pencil-square"></i> Kullanıcı yazıyor...
          </div>
        ) : null}

        {pinnedMessages.length > 0 ? (
          <div className="conversation-pinned-box mb-3">
            <div className="fw-semibold small mb-2">Sabitlenen Mesajlar</div>
            <div className="d-flex flex-wrap gap-2">
              {pinnedMessages.map((row) => (
                <span key={`pin-${row._id}`} className="badge text-bg-light border">{row.text || '-'}</span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="conversation-toolbar mb-2">
          <div className="conversation-premium-search">
            <i className="bi bi-search"></i>
            <input
              className="form-control"
              placeholder="Sohbet içinde ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-outline-primary" onClick={() => void handleSearch()}>Ara</button>
        </div>

        <div ref={messageListRef} className="conversation-thread mb-3">
          {renderRows.length === 0 ? (
            <div className="text-secondary small">Mesaj yok.</div>
          ) : (
            renderRows.map((msg) => {
              const senderId = typeof msg.senderUserId === 'string' ? msg.senderUserId : String(msg.senderUserId?._id || '');
              const mine = Boolean(me?.id && senderId === me.id);
              const inEdit = editingMessageId === msg._id;

              return (
                <div key={msg._id} className={`conversation-row ${mine ? 'is-mine' : 'is-theirs'}`}>
                  <div className="conversation-bubble-wrap">
                    {msg.replyToMessageId?.text ? (
                      <div className="conversation-reply-ref">Yanıt: {msg.replyToMessageId.text}</div>
                    ) : null}

                    <div className={`conversation-bubble ${mine ? 'mine' : 'theirs'}`}>
                      {inEdit ? (
                        <div className="d-flex gap-2">
                          <input className="form-control form-control-sm" value={editingText} onChange={(e) => setEditingText(e.target.value)} />
                          <button type="button" className="btn btn-light btn-sm" onClick={() => void handleEdit(msg)}>Kaydet</button>
                          <button type="button" className="btn btn-outline-light btn-sm" onClick={() => setEditingMessageId('')}>İptal</button>
                        </div>
                      ) : (
                        <div className="small">{msg.text || '-'}</div>
                      )}

                      <div className={`small mt-1 d-flex gap-2 flex-wrap ${mine ? 'text-white-50' : 'text-secondary'}`}>
                        <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        {msg.editedAt ? <span>(düzenlendi)</span> : null}
                        <span>{statusLabel(msg, mine)}</span>
                      </div>
                    </div>

                    <div className="conversation-actions">
                      <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => setReplyTarget(msg)}>Yanıtla</button>
                      <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => void handlePin(msg, !msg.isPinned)}>
                        {msg.isPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle'}
                      </button>
                      {mine && canEditWithinWindow(msg) ? (
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-decoration-none"
                          onClick={() => {
                            setEditingMessageId(msg._id);
                            setEditingText(msg.text || '');
                          }}
                        >
                          Düzenle
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {replyTarget ? (
          <div className="alert alert-light border py-2 px-3 mb-2 d-flex justify-content-between align-items-center">
            <div className="small">Yanıtlanan mesaj: {replyTarget.text || '-'}</div>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setReplyTarget(null)}>Temizle</button>
          </div>
        ) : null}

        <div className="conversation-compose">
          <input
            className="form-control"
            placeholder="Mesajınızı yazın..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              triggerTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <button type="button" className="btn btn-primary" disabled={sending || !input.trim()} onClick={() => void handleSend()}>
            {sending ? 'Gönderiliyor...' : 'Gönder'}
          </button>
        </div>
      </div>
    </section>
  );
}
