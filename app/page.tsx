'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, Bot, Check, ChevronDown, Code2, Copy, Download, FileText, History,
  Lightbulb, Menu, MessageSquarePlus, MoreHorizontal, Pencil, Plus, Search,
  Settings2, ShieldCheck, Sparkles, Trash2, WandSparkles, X, BookOpen, Upload,
  BrainCircuit, GraduationCap, BriefcaseBusiness, PanelRightClose
} from 'lucide-react';

type Message = { id: string; role: 'user' | 'assistant'; content: string; createdAt: number };
type ChatSession = { id: string; title: string; updatedAt: number; messages: Message[] };
type Settings = { theme: 'blue' | 'green' | 'light'; responseStyle: 'concise' | 'balanced' | 'detailed'; enterToSend: boolean; fontSize: number };
type Tab = 'chats' | 'tools';

const CHAT_KEY = 'afaq.chat-history.v2';
const SETTINGS_KEY = 'afaq.settings.v2';
const DEFAULT_SETTINGS: Settings = { theme: 'blue', responseStyle: 'balanced', enterToSend: true, fontSize: 14 };

const tools = [
  { icon: Code2, title: 'مساعد البرمجة', description: 'كتابة الكود، تصحيح الأخطاء، وبناء المشاريع.', prompt: 'أريدك أن تعمل كمساعد برمجي محترف. ساعدني في فهم طلبي ثم خطط للحل واكتب كوداً قابلاً للتشغيل مع شرح طريقة تجربته.' },
  { icon: BookOpen, title: 'الشرح والتعلّم', description: 'اشرح المفاهيم الصعبة ببساطة وأمثلة.', prompt: 'اشرح لي الموضوع التالي خطوة بخطوة، من الأساسيات إلى الفهم العميق، مع أمثلة وأسئلة قصيرة للتأكد من فهمي:' },
  { icon: FileText, title: 'الكتابة والتحرير', description: 'صياغة الرسائل والتقارير وتنظيم الأفكار.', prompt: 'ساعدني في كتابة نص واضح ومنظم. اسألني فقط عن التفاصيل الضرورية، وحافظ على أسلوبي:' },
  { icon: Lightbulb, title: 'العصف الذهني', description: 'حوّل الفكرة إلى خطة عملية.', prompt: 'ساعدني في تطوير هذه الفكرة إلى مشروع عملي. اذكر المتطلبات والخطوات والمخاطر والنسخة الأولى القابلة للتجربة:' },
  { icon: GraduationCap, title: 'مساعد الدراسة', description: 'خطط للمذاكرة واختبارات ومراجعة.', prompt: 'تصرف كمدرس مساعد. اشرح الدرس ثم اختبرني بأسئلة متنوعة، وصحح أخطائي مع بيان سببها:' },
  { icon: BriefcaseBusiness, title: 'تنظيم المشاريع', description: 'مهام ومراحل ومتابعة الإنجاز.', prompt: 'حوّل مشروعي إلى خطة تنفيذ منظمة بمراحل ومهام واضحة ومعايير تحقق:' },
];

function safeRead<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch { return fallback; }
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat('ar-IQ', { month: 'short', day: 'numeric' }).format(value);
}

function makeTitle(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > 38 ? normalized.slice(0, 38) + '…' : normalized || 'محادثة جديدة';
}

export default function Home() {
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('chats');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(safeRead<ChatSession[]>(CHAT_KEY, []));
    setSettings({ ...DEFAULT_SETTINGS, ...safeRead<Partial<Settings>>(SETTINGS_KEY, {}) });
    setHydrated(true);
  }, []);

  useEffect(() => {
    function handleShortcuts(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setActiveId(null);
        setTab('chats');
        setInput('');
        setError('');
        setSidebarOpen(false);
      }
      if (event.key === 'Escape') {
        setSettingsOpen(false);
        setSidebarOpen(false);
      }
    }
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(history));
    } catch {
      setError('مساحة تخزين المتصفح ممتلئة. صدّر سجل محادثاتك ثم احذف المحادثات القديمة.');
    }
  }, [history, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      setError('تعذّر حفظ الإعدادات في المتصفح.');
    }
    document.documentElement.dataset.theme = settings.theme;
  }, [settings, hydrated]);

  const activeChat = useMemo(() => history.find(chat => chat.id === activeId) ?? null, [history, activeId]);
  const visibleHistory = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('ar');
    return [...history].sort((a, b) => b.updatedAt - a.updatedAt).filter(chat => !term || chat.title.toLocaleLowerCase('ar').includes(term));
  }, [history, search]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [activeId, activeChat?.messages.length, loading]);

  function updateSession(id: string, updater: (chat: ChatSession) => ChatSession) {
    setHistory(prev => prev.map(chat => chat.id === id ? updater(chat) : chat).sort((a, b) => b.updatedAt - a.updatedAt));
  }

  function newChat() {
    setActiveId(null);
    setTab('chats');
    setInput('');
    setError('');
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  function renameChat(chat: ChatSession) {
    const title = window.prompt('اكتب اسماً جديداً للمحادثة', chat.title);
    if (title?.trim()) updateSession(chat.id, current => ({ ...current, title: title.trim().slice(0, 70) }));
  }

  function deleteChat(chat: ChatSession) {
    if (!window.confirm('تحذف هذه المحادثة نهائياً من هذا الجهاز؟')) return;
    setHistory(prev => prev.filter(item => item.id !== chat.id));
    if (activeId === chat.id) setActiveId(null);
  }

  function clearHistory() {
    if (!window.confirm('سيتم حذف جميع المحادثات المحفوظة على هذا الجهاز. هل تريد المتابعة؟')) return;
    setHistory([]);
    setActiveId(null);
  }

  function exportHistory() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), conversations: history }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'afaq-conversations.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importHistory(file?: File) {
    if (!file) return;
    if (file.size > 15_000_000) { setError('ملف السجل أكبر من الحد المسموح (15 MB).'); return; }
    try {
      const parsed = JSON.parse(await file.text()) as { conversations?: unknown };
      if (!Array.isArray(parsed.conversations)) throw new Error('صيغة ملف السجل غير صحيحة.');
      const restored: ChatSession[] = [];
      for (const item of parsed.conversations.slice(0, 500)) {
        if (!item || typeof item !== 'object') continue;
        const chat = item as Partial<ChatSession>;
        if (typeof chat.id !== 'string' || typeof chat.title !== 'string' || !Array.isArray(chat.messages)) continue;
        const messages: Message[] = chat.messages.flatMap((entry: unknown) => {
          if (!entry || typeof entry !== 'object') return [];
          const message = entry as Partial<Message>;
          if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') return [];
          return [{
            id: typeof message.id === 'string' ? message.id : crypto.randomUUID(),
            role: message.role,
            content: message.content.slice(0, 12000),
            createdAt: typeof message.createdAt === 'number' ? message.createdAt : Date.now(),
          }];
        });
        restored.push({
          id: chat.id,
          title: chat.title.slice(0, 70),
          updatedAt: typeof chat.updatedAt === 'number' ? chat.updatedAt : Date.now(),
          messages,
        });
      }
      if (!restored.length) throw new Error('لم نعثر على محادثات صالحة داخل الملف.');
      setHistory(prev => {
        const byId = new Map(prev.map(chat => [chat.id, chat]));
        restored.forEach(chat => { if (!byId.has(chat.id)) byId.set(chat.id, chat); });
        return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
      });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر استيراد سجل المحادثات.');
    } finally {
      if (historyImportRef.current) historyImportRef.current.value = '';
    }
  }

  async function copyText(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch { setError('لم يتمكن المتصفح من نسخ النص.'); }
  }

  function exportCurrentChat() {
    if (!activeChat) return;
    const markdown = '# ' + activeChat.title + '\n\n' + activeChat.messages.map(message => (message.role === 'user' ? '**أنت**' : '**آفاق**') + '\n\n' + message.content).join('\n\n---\n\n');
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = (activeChat.title || 'afaq-chat').replace(/[^\p{L}\p{N}-]+/gu, '-').slice(0, 45) + '.md';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function editMessage(chat: ChatSession, message: Message) {
    const index = chat.messages.findIndex(item => item.id === message.id);
    if (index < 0) return;
    updateSession(chat.id, current => ({ ...current, messages: current.messages.slice(0, index) }));
    setActiveId(chat.id);
    setTab('chats');
    setInput(message.content);
    setError('');
    inputRef.current?.focus();
  }

  async function regenerateAnswer(chat: ChatSession) {
    if (loading) return;
    let userIndex = -1;
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'user') { userIndex = i; break; }
    }
    if (userIndex < 0) return;
    const base = chat.messages.slice(0, userIndex + 1);
    const assistant: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', createdAt: Date.now() };
    updateSession(chat.id, current => ({ ...current, updatedAt: Date.now(), messages: [...base, assistant] }));
    setActiveId(chat.id);
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: base.slice(-20).map(({ role, content }) => ({ role, content })),
          preferences: { responseStyle: settings.responseStyle },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذّر إعادة إنشاء الإجابة.');
      if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('وصل رد غير صالح من الخدمة.');
      updateSession(chat.id, current => ({
        ...current,
        updatedAt: Date.now(),
        messages: current.messages.map(message => message.id === assistant.id ? { ...message, content: data.answer } : message),
      }));
    } catch (e) {
      updateSession(chat.id, current => ({ ...current, messages: current.messages.filter(message => message.id !== assistant.id) }));
      setError(e instanceof Error ? e.message : 'تعذّرت إعادة إنشاء الإجابة.');
    } finally {
      setLoading(false);
    }
  }

  async function send(raw = input) {
    const value = raw.trim();
    if (!value || loading) return;

    const chatId = activeId ?? crypto.randomUUID();
    const now = Date.now();
    const existing = history.find(chat => chat.id === chatId);
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: value, createdAt: now };
    const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', createdAt: now + 1 };
    const pending: ChatSession = existing
      ? { ...existing, updatedAt: now, messages: [...existing.messages, userMessage, assistantMessage] }
      : { id: chatId, title: makeTitle(value), updatedAt: now, messages: [userMessage, assistantMessage] };

    setActiveId(chatId);
    setTab('chats');
    setInput('');
    setError('');
    setLoading(true);
    setHistory(prev => [pending, ...prev.filter(chat => chat.id !== chatId)].sort((a, b) => b.updatedAt - a.updatedAt));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: pending.messages.filter(message => message.content.trim()).slice(-20).map(({ role, content }) => ({ role, content })),
          preferences: { responseStyle: settings.responseStyle },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذّر الحصول على إجابة.');
      if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('وصل رد غير صالح من الخدمة.');
      updateSession(chatId, chat => ({
        ...chat,
        updatedAt: Date.now(),
        messages: chat.messages.map(message => message.id === assistantMessage.id ? { ...message, content: data.answer } : message),
      }));
    } catch (e) {
      updateSession(chatId, chat => ({ ...chat, messages: chat.messages.filter(message => message.id !== assistantMessage.id) }));
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء الاتصال بآفاق.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function chooseTool(prompt: string) {
    setActiveId(null);
    setTab('chats');
    setInput(prompt);
    setSidebarOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  const activeTitle = activeChat?.title || (tab === 'tools' ? 'الأدوات والمساعدات' : 'محادثة جديدة');

  return (
    <main className="app-shell">
      {sidebarOpen && <button className="sidebar-scrim" aria-label="إغلاق القائمة" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="brand">
          <div className="brand-mark"><img src="/afaq-mark.svg" alt="AFAQ AI" /></div>
          <div className="brand-copy"><strong>AFAQ<span> AI</span></strong><small>THINK BEYOND. BUILD BEYOND.</small></div>
          <button className="icon-btn sidebar-toggle" onClick={() => setSidebarOpen(false)} aria-label="إغلاق القائمة"><PanelRightClose size={18} /></button>
        </div>

        <button className="new-chat" onClick={newChat}><Plus size={18} /> محادثة جديدة <span>⌘ K</span></button>

        <div className="side-section-label">مساحة العمل</div>
        <button className={`side-link ${tab === 'chats' ? 'active' : ''}`} onClick={() => { setTab('chats'); setSidebarOpen(false); }}><MessageSquarePlus size={17} /> المحادثات</button>
        <button className={`side-link ${tab === 'tools' ? 'active' : ''}`} onClick={() => { setTab('tools'); setSidebarOpen(false); }}><WandSparkles size={17} /> الأدوات والمساعدات</button>

        <div className="history-heading"><span>سجل المحادثات</span><span>{history.length}</span></div>
        <div className="history-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث في محادثاتك" aria-label="ابحث في المحادثات" /></div>
        <div className="history-list">
          {visibleHistory.length === 0 ? <div className="history-empty">{history.length ? 'لا توجد نتائج مطابقة' : 'ستظهر محادثاتك هنا بعد أول سؤال'}</div> : visibleHistory.map(chat => (
            <div key={chat.id} className={`history-item ${activeId === chat.id && tab === 'chats' ? 'selected' : ''}`}>
              <button className="history-open" onClick={() => { setActiveId(chat.id); setTab('chats'); setError(''); setSidebarOpen(false); }}>
                <History size={15} /><span>{chat.title}</span>
              </button>
              <div className="history-actions">
                <button className="tiny-action" onClick={() => renameChat(chat)} aria-label="إعادة تسمية"><Pencil size={13} /></button>
                <button className="tiny-action danger" onClick={() => deleteChat(chat)} aria-label="حذف المحادثة"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="side-link" onClick={exportHistory} disabled={!history.length}><Download size={16} /> تصدير سجل المحادثات</button>
          <button className="side-link" onClick={() => historyImportRef.current?.click()}><Upload size={16} /> استيراد نسخة احتياطية</button>
          <input ref={historyImportRef} type="file" accept="application/json,.json" hidden onChange={e => importHistory(e.target.files?.[0])} />
          <button className="side-link" onClick={() => setSettingsOpen(true)}><Settings2 size={16} /> الإعدادات</button>
          <div className="profile">
            <div className="avatar">A</div><div><b>AFAQ AI</b><small>مساعدك الذكي</small></div>
            <span className="profile-status">PREVIEW</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn menu-open" onClick={() => setSidebarOpen(true)} aria-label="فتح القائمة"><Menu size={20} /></button>
            <div className="breadcrumb"><span>AFAQ AI</span><b>/</b><strong>{activeTitle}</strong></div>
          </div>
          <div className="top-actions">
            {activeChat && <button className="top-icon-btn" onClick={exportCurrentChat} title="تصدير المحادثة"><Download size={17} /><span>تصدير</span></button>}
            <div className="model-select"><span className="model-dot" /> AI ASSISTANT</div>
            <button className="top-icon-btn" onClick={() => setSettingsOpen(true)} title="الإعدادات"><Settings2 size={18} /></button>
          </div>
        </header>

        <div className="conversation" key={tab + (activeId || 'empty')}>
          {tab === 'tools' ? (
            <div className="tools-page">
              <div className="page-eyebrow"><span /> AFAQ WORKSPACE</div>
              <h1>ماذا تريد أن <em>تنجز؟</em></h1>
              <p className="page-subtitle">اختر مساعداً متخصصاً ليبدأ آفاق معك من السياق المناسب.</p>
              <div className="tools-grid">{tools.map(tool => (
                <button key={tool.title} className="tool-card" onClick={() => chooseTool(tool.prompt)}>
                  <span className="tool-icon"><tool.icon size={21} /></span><b>{tool.title}</b><small>{tool.description}</small><span className="tool-arrow">↗</span>
                </button>
              ))}</div>
            </div>
          ) : activeChat ? (
            <div className="message-list">
              {activeChat.messages.map(message => (
                <article className={`message ${message.role}`} key={message.id}>
                  <div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={17} /> : 'أ'}</div>
                  <div className="message-body">
                    <div className="message-heading"><div className="message-name">{message.role === 'assistant' ? 'آفاق AI' : 'أنت'}</div><time>{formatDate(message.createdAt)}</time></div>
                    <div className="message-text" style={{ fontSize: settings.fontSize }}>{message.content || (loading && message.role === 'assistant' ? <span className="typing"><i /><i /><i /> آفاق يفكر</span> : '')}</div>
                    <div className="message-tools">
                      {message.role === 'assistant' && message.content && <button onClick={() => copyText(message.id, message.content)}><Copy size={13} /> {copiedId === message.id ? 'تم النسخ' : 'نسخ الإجابة'}</button>}
                      {message.role === 'user' && <button onClick={() => editMessage(activeChat, message)}><Pencil size={13} /> تعديل الطلب</button>}
                      {message.role === 'assistant' && message.content && message.id === activeChat.messages[activeChat.messages.length - 1]?.id && <button onClick={() => regenerateAnswer(activeChat)}><WandSparkles size={13} /> إعادة إنشاء الإجابة</button>}
                    </div>
                  </div>
                </article>
              ))}
              <div ref={endRef} />
            </div>
          ) : (
            <div className="welcome">
              <div className="welcome-orb"><div className="orb-core"><img src="/afaq-mark.svg" alt="" /></div><span className="orb-ring ring-one" /><span className="orb-ring ring-two" /></div>
              <div className="eyebrow"><span /> THINK BEYOND. BUILD BEYOND.</div>
              <h1>أهلاً بك في <em>آفاق</em></h1>
              <p className="welcome-copy">فكّر، تعلّم، اكتب الكود، وحوّل أفكارك إلى مشاريع.<br />ابدأ محادثة جديدة، وسنتولى نحن التفاصيل التقنية.</p>
              <div className="quick-tools">
                <button onClick={() => chooseTool(tools[0].prompt)}><Code2 size={17} /> برمجة</button>
                <button onClick={() => chooseTool(tools[1].prompt)}><BookOpen size={17} /> تعلّم</button>
                <button onClick={() => chooseTool(tools[3].prompt)}><Lightbulb size={17} /> أفكار</button>
              </div>
              <div className="welcome-foot"><ShieldCheck size={15} /> لا تحتاج إلى مفاتيح API أو تنزيل نماذج على جهازك</div>
            </div>
          )}
        </div>

        <div className="composer-area">
          {error && <div className="error-note">{error}</div>}
          <div className="composer">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {
              if (e.key === 'Enter' && settings.enterToSend && !e.shiftKey) { e.preventDefault(); send(); }
            }} placeholder="اكتب سؤالك أو فكرتك إلى آفاق..." rows={1} disabled={loading} aria-label="اكتب رسالتك" />
            <div className="composer-tools"><div className="composer-hints"><span className="hint-divider" /><span>{settings.enterToSend ? 'Enter للإرسال · Shift + Enter لسطر جديد' : 'Enter لسطر جديد'}</span></div><button className="send-btn" onClick={() => send()} disabled={!input.trim() || loading} aria-label="إرسال الرسالة">{loading ? <span className="send-spinner" /> : <ArrowUp size={19} />}</button></div>
          </div>
          <p className="disclaimer">قد يخطئ الذكاء الاصطناعي. لا ترسل كلمات المرور أو المعلومات السرية.</p>
        </div>
      </section>

      {settingsOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
        <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="modal-head"><div><span className="eyebrow">PERSONALIZE AFAQ</span><h2 id="settings-title">إعدادات آفاق</h2></div><button className="icon-btn" onClick={() => setSettingsOpen(false)} aria-label="إغلاق"><X size={19} /></button></div>
          <div className="settings-section"><h3>المظهر والألوان</h3><p>اختر لوحة الألوان التي تناسبك.</p><div className="theme-options">
            <button className={settings.theme === 'blue' ? 'chosen' : ''} onClick={() => setSettings(s => ({ ...s, theme: 'blue' }))}><span className="theme-swatch blue-swatch" /> أزرق ليلي</button>
            <button className={settings.theme === 'green' ? 'chosen' : ''} onClick={() => setSettings(s => ({ ...s, theme: 'green' }))}><span className="theme-swatch green-swatch" /> أخضر ليلي</button>
            <button className={settings.theme === 'light' ? 'chosen' : ''} onClick={() => setSettings(s => ({ ...s, theme: 'light' }))}><span className="theme-swatch light-swatch" /> فاتح</button>
          </div></div>
          <div className="settings-section"><h3>أسلوب الإجابة</h3><p>يؤثر على طريقة صياغة ردود آفاق.</p><div className="segmented-options">
            <button className={settings.responseStyle === 'concise' ? 'chosen' : ''} onClick={() => setSettings(s => ({ ...s, responseStyle: 'concise' }))}>مختصر</button>
            <button className={settings.responseStyle === 'balanced' ? 'chosen' : ''} onClick={() => setSettings(s => ({ ...s, responseStyle: 'balanced' }))}>متوازن</button>
            <button className={settings.responseStyle === 'detailed' ? 'chosen' : ''} onClick={() => setSettings(s => ({ ...s, responseStyle: 'detailed' }))}>مفصل</button>
          </div></div>
          <div className="settings-section"><h3>حجم نص المحادثة</h3><div className="font-size-control"><span>أ</span><input type="range" min="12" max="18" value={settings.fontSize} onChange={e => setSettings(s => ({ ...s, fontSize: Number(e.target.value) }))} /><b>{settings.fontSize}px</b></div></div>
          <label className="toggle-row"><span><b>الإرسال بزر Enter</b><small>أوقفه لكتابة أسطر متعددة بزر Enter.</small></span><input type="checkbox" checked={settings.enterToSend} onChange={e => setSettings(s => ({ ...s, enterToSend: e.target.checked }))} /></label>
          <div className="settings-section privacy-section"><div className="privacy-title"><ShieldCheck size={17} /><b>الخصوصية والبيانات</b></div><p>سجل المحادثات محفوظ محلياً في هذا المتصفح. عند إرسال رسالة، يُرسل محتواها إلى خادم آفاق ثم إلى مزوّد النموذج لتوليد الإجابة. قد يحتفظ المزوّد بالطلبات وفق شروطه؛ لا ترسل معلومات حساسة.</p><div className="privacy-actions"><button onClick={exportHistory} disabled={!history.length}><Download size={14} /> تصدير بياناتي</button><button className="danger-text" onClick={clearHistory} disabled={!history.length}><Trash2 size={14} /> حذف كل المحادثات</button></div></div>
          <div className="settings-bottom"><span>AFAQ AI · VERSION 0.4.0</span><button className="modal-done" onClick={() => setSettingsOpen(false)}>حفظ وإغلاق</button></div>
        </section>
      </div>}
    </main>
  );
}
