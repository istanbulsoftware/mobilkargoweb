import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

type ConversationRow = {
  _id: string;
  status?: string;
  shipmentId?: { _id?: string; title?: string; status?: string };
  participantUsers?: ParticipantUser[];
  unreadCount?: number;
  lastMessage?: { text?: string; createdAt?: string } | null;
  lastMessageAt?: string;
};

type ViewerProfile = {
  id: string;
  role?: 'shipper' | 'carrier' | 'admin';
};

type ChatMessage = {
  _id: string;
  conversationId?: string;
  senderUserId?: string | { _id?: string; fullName?: string };
  text?: string;
  createdAt?: string;
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

type InboxFilter = 'all' | 'unread';

const initials = (name?: string) => {
  const safe = String(name || '').trim();
  if (!safe) return 'K';
  const parts = safe.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toLocaleUpperCase('tr-TR')).join('');
};

const compactTime = (value?: string) => {
  if (!value) return '--:--';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '--:--';
  return dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

const presenceClass = (presence?: Presence) => {
  if (presence?.status === 'online') return 'is-online';
  if (presence?.status === 'busy') return 'is-busy';
  return 'is-offline';
};

const messageStatusLabel = (msg: ChatMessage, isMine: boolean) => {
  if (!isMine) return '';
  if (msg.readAt || msg.isRead) return 'Okundu';
  if (msg.deliveredAt) return 'İletildi';
  return 'Gönderildi';
};

export function ConversationsPage() {
  const token = localStorage.getItem('an_user_token');
  const [searchParams] = useSearchParams();
  const queryConversationId = (searchParams.get('conversationId') || '').trim();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [me] = useState<ViewerProfile | null>(() => {
    try {
      const raw = localStorage.getItem('an_user_profile');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.id) return null;
      return { id: String(parsed.id), role: parsed.role } as ViewerProfile;
    } catch {
      return null;
    }
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');

  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatTitle, setChatTitle] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const selectedConversationIdRef = useRef('');
  const queryConversationIdRef = useRef('');
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messageNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const didInitialScrollRef = useRef(false);
  const typingTimerRef = useRef<number | null>(null);
  const typingClearRef = useRef<Record<string, number>>({});
  const joinedConversationRef = useRef('');

  const loadInbox = async () => {
    if (!token) {
      setRows([]);
      return;
    }
    const { data } = await api.get<ConversationRow[]>('/conversations/my');
    const nextRows = Array.isArray(data) ? data : [];
    setRows(nextRows);

    const queryConversationIdCurrent = queryConversationIdRef.current;
    const selectedConversationIdCurrent = selectedConversationIdRef.current;

    if (queryConversationIdCurrent && nextRows.some((row) => row._id === queryConversationIdCurrent)) {
      setSelectedConversationId(queryConversationIdCurrent);
      return;
    }

    if (selectedConversationIdCurrent && nextRows.some((row) => row._id === selectedConversationIdCurrent)) return;

    if (nextRows[0]?._id) {
      setSelectedConversationId(nextRows[0]._id);
    }
  };

  const loadConversationDetail = async (conversationId: string) => {
    if (!conversationId) return;
    setChatLoading(true);
    try {
      const { data } = await api.get<ConversationDetailResponse>(`/conversations/${conversationId}`);
      setChatMessages(Array.isArray(data?.messages) ? data.messages : []);
      setChatTitle(data?.conversation?.shipmentId?.title || 'Mesajlaşma');
      void api.patch(`/conversations/${conversationId}/read`).catch(() => undefined);
      didInitialScrollRef.current = false;
      setMessage('');
    } catch (error: any) {
      setChatMessages([]);
      setMessage(error?.response?.data?.message || 'Konuşma yüklenemedi.');
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    queryConversationIdRef.current = queryConversationId;
  }, [queryConversationId]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        await loadInbox();
        setMessage('');
      } catch (error: any) {
        setRows([]);
        setMessage(error?.response?.data?.message || 'Konuşmalar yüklenemedi.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [token, queryConversationId]);

  useEffect(() => {
    if (!token) return;

    const socket = io(apiOrigin, {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      const activeConversationId = selectedConversationIdRef.current;
      if (activeConversationId) {
        socket.emit('join:conversation', activeConversationId);
        joinedConversationRef.current = activeConversationId;
      }
    });
    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('conversations:refresh', () => {
      void loadInbox().catch(() => undefined);
    });

    socket.on('conversation:message', (payload: ChatMessage) => {
      const cid = String(payload?.conversationId || '');
      if (!cid) return;
      void loadInbox().catch(() => undefined);
      if (cid !== selectedConversationIdRef.current) return;

      setChatMessages((prev) => {
        const exists = prev.some((item) => item._id === payload._id);
        if (exists) return prev;
        return [...prev, payload];
      });

      const senderId = typeof payload?.senderUserId === 'string' ? payload.senderUserId : String(payload?.senderUserId?._id || '');
      if (senderId && senderId !== me?.id && payload?._id) {
        void api.patch(`/conversations/${cid}/messages/${payload._id}/delivered`).catch(() => undefined);
      }
      void api.patch(`/conversations/${cid}/read`).catch(() => undefined);
    });

    socket.on('conversation:message_updated', (payload: any) => {
      if (!selectedConversationIdRef.current) return;
      if (payload?.message?._id) {
        setChatMessages((prev) => {
          const idx = prev.findIndex((item) => item._id === payload.message._id);
          if (idx < 0) return prev;
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...payload.message };
          return copy;
        });
      }
      if (payload?.messageId && payload?.deliveredAt) {
        setChatMessages((prev) => prev.map((item) => (item._id === payload.messageId ? { ...item, deliveredAt: payload.deliveredAt } : item)));
      }
    });

    socket.on('conversation:typing', (payload: { conversationId?: string; userId?: string; isTyping?: boolean }) => {
      if (String(payload?.conversationId || '') !== selectedConversationId) return;
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
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          participantUsers: (row.participantUsers || []).map((u) => (u.id === payload.userId ? { ...u, presence: payload } : u)),
        })),
      );
    });

    return () => {
      if (joinedConversationRef.current) {
        try {
          socket.emit('leave:conversation', joinedConversationRef.current);
        } catch {
          // no-op
        }
      }
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      joinedConversationRef.current = '';
    };
  }, [token, me?.id]);

  useEffect(() => {
    if (socketRef.current) {
      try {
        if (joinedConversationRef.current && joinedConversationRef.current !== selectedConversationId) {
          socketRef.current.emit('leave:conversation', joinedConversationRef.current);
        }
        if (selectedConversationId) {
          socketRef.current.emit('join:conversation', selectedConversationId);
          joinedConversationRef.current = selectedConversationId;
        } else {
          joinedConversationRef.current = '';
        }
      } catch {
        // no-op
      }
    }
    if (!selectedConversationId) return;
    void loadConversationDetail(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!messageListRef.current) return;
    const el = messageListRef.current;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages.length]);

  useEffect(() => {
    if (chatLoading || didInitialScrollRef.current) return;
    const timer = window.setTimeout(() => {
      if (!messageListRef.current) return;
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
      didInitialScrollRef.current = true;
    }, 40);
    return () => window.clearTimeout(timer);
  }, [chatLoading, selectedConversationId]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    let base = rows;
    if (filter === 'unread') base = base.filter((row) => Number(row.unreadCount || 0) > 0);
    if (!q) return base;

    return base.filter((row) => {
      const participant = (row.participantUsers || [])[0];
      const hay = [
        row.shipmentId?.title || '',
        participant?.fullName || '',
        participant?.phone || '',
        row.lastMessage?.text || '',
      ]
        .join(' ')
        .toLocaleLowerCase('tr-TR');
      return hay.includes(q);
    });
  }, [rows, search, filter]);

  const selectedRow = useMemo(
    () => rows.find((row) => row._id === selectedConversationId) || null,
    [rows, selectedConversationId],
  );

  const selectedOther = useMemo(() => {
    if (!selectedRow) return null;
    return (selectedRow.participantUsers || []).find((u) => u.id !== me?.id) || selectedRow.participantUsers?.[0] || null;
  }, [selectedRow, me?.id]);

  const filteredChatMessages = useMemo(() => {
    const q = chatSearch.trim().toLocaleLowerCase('tr-TR');
    if (!q) return chatMessages;
    return chatMessages.filter((msg) => String(msg.text || '').toLocaleLowerCase('tr-TR').includes(q));
  }, [chatMessages, chatSearch]);

  const pinnedMessages = useMemo(() => chatMessages.filter((msg) => msg.isPinned), [chatMessages]);

  const handleSend = async () => {
    const text = chatInput.trim();
    if (!selectedConversationId || !text) return;

    setChatSending(true);
    try {
      const { data } = await api.post<ChatMessage>(`/conversations/${selectedConversationId}/messages`, {
        messageType: 'text',
        text,
        replyToMessageId: replyTarget?._id,
      });
      setChatMessages((prev) => {
        const exists = prev.some((item) => item._id === data?._id);
        if (exists) return prev;
        return [...prev, data];
      });
      setChatInput('');
      setReplyTarget(null);
      if (socketRef.current) {
        socketRef.current.emit('typing:conversation', { conversationId: selectedConversationId, isTyping: false });
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Mesaj gönderilemedi.');
    } finally {
      setChatSending(false);
    }
  };

  const handlePin = async (msg: ChatMessage, isPinned: boolean) => {
    if (!selectedConversationId) return;
    const previous = msg.isPinned;
    setChatMessages((prev) =>
      prev.map((item) => (item._id === msg._id ? { ...item, isPinned } : item)),
    );
    try {
      const { data } = await api.patch<ChatMessage>(`/conversations/${selectedConversationId}/messages/${msg._id}/pin`, { isPinned });
      setChatMessages((prev) => {
        const idx = prev.findIndex((item) => item._id === msg._id || item._id === data._id);
        if (idx < 0) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...data, isPinned };
        return copy;
      });
    } catch (error: any) {
      setChatMessages((prev) =>
        prev.map((item) => (item._id === msg._id ? { ...item, isPinned: previous } : item)),
      );
      setMessage(error?.response?.data?.message || 'Mesaj sabitlenemedi.');
    }
  };

  const triggerTyping = () => {
    if (!socketRef.current || !selectedConversationId) return;
    socketRef.current.emit('typing:conversation', { conversationId: selectedConversationId, isTyping: true });
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      socketRef.current?.emit('typing:conversation', { conversationId: selectedConversationId, isTyping: false });
    }, 1200);
  };

  const jumpToMessage = (messageId: string) => {
    const node = messageNodeRefs.current[messageId];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === messageId ? '' : prev));
    }, 1400);
  };

  if (!token) {
    return (
      <section className="container py-5">
        <div className="alert alert-warning">Mesajlar için giriş yapmalısınız.</div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="container py-5">
        <div className="panel-card p-4 text-secondary">Konuşmalar yükleniyor...</div>
      </section>
    );
  }

  return (
    <section className="container py-4 messages-hub-page">
      {message ? <div className="alert alert-warning">{message}</div> : null}

      <div className="messages-hub-shell">
        <aside className="messages-hub-sidebar">
          <div className="messages-hub-header">
            <h2 className="mb-0">Mesajlar</h2>
            <button type="button" className="btn btn-sm btn-light rounded-circle" aria-label="Ara">
              <i className="bi bi-search"></i>
            </button>
          </div>

          <div className="messages-hub-tabs">
            <button type="button" className={`messages-tab-btn ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
              Tüm Mesajlar
            </button>
            <button type="button" className={`messages-tab-btn ${filter === 'unread' ? 'is-active' : ''}`} onClick={() => setFilter('unread')}>
              Okunmamış
            </button>
          </div>

          <div className="messages-hub-search-wrap">
            <input
              className="form-control"
              placeholder="Konuşmalarda ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="messages-hub-list">
            {filteredRows.length === 0 ? <div className="text-secondary small p-3">Konuşma bulunamadı.</div> : null}
            {filteredRows.map((row) => {
              const participant = (row.participantUsers || [])[0];
              const unread = Number(row.unreadCount || 0);
              const isOnline = participant?.presence?.status === 'online';
              const isActive = selectedConversationId === row._id;
              return (
                <button
                  key={row._id}
                  type="button"
                  className={`messages-thread-item messages-thread-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => setSelectedConversationId(row._id)}
                >
                  <div className="messages-thread-avatar-wrap">
                    <div className="messages-thread-avatar">{initials(participant?.fullName)}</div>
                    {isOnline ? <span className="messages-thread-online-dot"></span> : null}
                  </div>
                  <div className="messages-thread-main">
                    <div className="messages-thread-row">
                      <strong>{participant?.fullName || 'Kullanıcı'}</strong>
                      <span>{compactTime(row.lastMessageAt)}</span>
                    </div>
                    <div className="messages-thread-preview">{row.lastMessage?.text || row.shipmentId?.title || 'Yeni mesaj yok'}</div>
                  </div>
                  {unread > 0 ? <span className="messages-thread-badge">{unread}</span> : null}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="messages-hub-chat-state">
          {!selectedConversationId ? (
            <div className="messages-hub-empty-inner">
              <div className="messages-hub-empty-icon">
                <i className="bi bi-chat-dots-fill"></i>
              </div>
              <h3>Konuşma seçilmedi</h3>
              <p>Soldan bir konuşma seçerek devam edebilirsiniz.</p>
            </div>
          ) : (
            <div className="messages-hub-chat">
              <div className="messages-hub-chat-head">
                <div className="d-flex align-items-center gap-2">
                  <div className="messages-thread-avatar">{initials(selectedOther?.fullName)}</div>
                  <div>
                    <strong>{selectedOther?.fullName || 'Kullanıcı'}</strong>
                    <div className="small text-secondary">
                      <span className={`presence-dot ${presenceClass(selectedOther?.presence)}`}></span>
                      {Object.keys(typingUsers).length > 0 ? 'Yazıyor...' : chatTitle || 'Mesajlaşma'}
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div className="messages-hub-chat-search">
                    <i className="bi bi-search"></i>
                    <input
                      className="form-control form-control-sm"
                      placeholder="Mesaj içinde ara..."
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                    />
                  </div>
                  <span className={`shipment-status-pill ${socketConnected ? 'tone-success' : 'tone-warning'}`}>
                    {socketConnected ? 'Canlı' : 'Bağlanıyor'}
                  </span>
                </div>
              </div>

              {pinnedMessages.length > 0 ? (
                <div className="messages-hub-pinned-strip">
                  <strong className="small">Sabitlenen:</strong>
                  <div className="messages-hub-pinned-list">
                    {pinnedMessages.slice(-3).map((msg) => (
                      <button
                        key={`pin-${msg._id}`}
                        type="button"
                        className="messages-hub-pinned-chip"
                        onClick={() => jumpToMessage(msg._id)}
                        title="Mesaja git"
                      >
                        {msg.text || '-'}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div ref={messageListRef} className="conversation-thread messages-hub-chat-thread">
                {chatLoading ? (
                  <div className="text-secondary small">Mesajlar yükleniyor...</div>
                ) : filteredChatMessages.length === 0 ? (
                  <div className="text-secondary small">Henüz mesaj yok.</div>
                ) : (
                  filteredChatMessages.map((msg) => {
                    const senderId = typeof msg.senderUserId === 'string' ? msg.senderUserId : String(msg.senderUserId?._id || '');
                    const mine = Boolean(me?.id && senderId === me.id);
                    return (
                      <div
                        key={msg._id}
                        ref={(el) => {
                          messageNodeRefs.current[msg._id] = el;
                        }}
                        className={`conversation-row ${mine ? 'is-mine' : 'is-theirs'} ${highlightedMessageId === msg._id ? 'is-highlighted' : ''}`}
                      >
                        <div className={`conversation-bubble-wrap ${msg.replyToMessageId?.text ? 'has-reply' : ''}`}>
                          {msg.replyToMessageId?.text ? <div className="conversation-reply-ref">Yanıt: {msg.replyToMessageId.text}</div> : null}
                          <div className={`conversation-bubble ${mine ? 'mine' : 'theirs'}`}>
                            <div className="small">{msg.text || '-'}</div>
                            <div className={`small mt-1 d-flex gap-2 ${mine ? 'text-white-50' : 'text-secondary'}`}>
                              <span>{compactTime(msg.createdAt)}</span>
                              <span>{messageStatusLabel(msg, mine)}</span>
                            </div>
                          </div>
                          <div className="conversation-actions mt-1">
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-decoration-none"
                              title="Cevapla"
                              aria-label="Cevapla"
                              onClick={() => setReplyTarget(msg)}
                            >
                              <i className="bi bi-reply"></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-decoration-none"
                              title={msg.isPinned ? 'Sabiti Kaldır' : 'Sabitle'}
                              aria-label={msg.isPinned ? 'Sabiti Kaldır' : 'Sabitle'}
                              onClick={() => void handlePin(msg, !msg.isPinned)}
                            >
                              <i className={`bi ${msg.isPinned ? 'bi-pin-angle-fill' : 'bi-pin-angle'}`}></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {replyTarget ? (
                <div className="messages-hub-reply-preview">
                  <div className="small">Yanıtlanan mesaj: {replyTarget.text || '-'}</div>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setReplyTarget(null)}>
                    Temizle
                  </button>
                </div>
              ) : null}

              <div className="conversation-compose messages-hub-chat-compose">
                <input
                  className="form-control"
                  placeholder="Mesajınızı yazın..."
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    triggerTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                <button type="button" className="btn btn-primary" disabled={chatSending || !chatInput.trim()} onClick={() => void handleSend()}>
                  {chatSending ? 'Gönderiliyor...' : 'Gönder'}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
