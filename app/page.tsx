'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, ChevronDown, Code2, ImagePlus, Menu, MessageSquarePlus, Paperclip, PanelRightClose, Settings2, Sparkles, X, Zap } from 'lucide-react';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
type Provider = 'gemini' | 'openai';
const starters = [
  { icon: Code2, title: 'ابنِ تطبيقاً من الصفر', detail: 'خطط واكتب الكود خطوة بخطوة' },
  { icon: Sparkles, title: 'اشرح لي فكرة معقدة', detail: 'بأسلوب واضح وأمثلة عملية' },
  { icon: Bot, title: 'حلّل مشروعاً برمجياً', detail: 'راجع البنية واكتشف الأخطاء' },
  { icon: ImagePlus, title: 'ساعدني في الإبداع', detail: 'أفكار وتصاميم ومحتوى جديد' },
];

export default function Home() {
  const [provider, setProvider] = useState<Provider>('gemini');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [providerMenu, setProviderMenu] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function send(text = input) {
    const value = text.trim();
    if (!value || loading) return;
    const next = [...messages, { id: crypto.randomUUID(), role: 'user' as const, content: value }];
    setMessages(next); setInput(''); setError(''); setLoading(true);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, messages: next.map(({ role, content }) => ({ role, content })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر إرسال الرسالة.');
      setMessages([...next, { id: crypto.randomUUID(), role: 'assistant', content: data.answer }]);
    } catch (e) { setError(e instanceof Error ? e.message : 'حدث خطأ. حاول مرة أخرى.'); }
    finally { setLoading(false); inputRef.current?.focus(); }
  }
  function newChat() { setMessages([]); setInput(''); setError(''); }

  return <main className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={20}/></div><div><strong>AFAQ<span> AI</span></strong><small>INTELLIGENCE, REIMAGINED</small></div><button className="icon-btn sidebar-toggle" onClick={() => setSidebarOpen(false)} aria-label="إغلاق القائمة"><PanelRightClose size={18}/></button></div>
      <button className="new-chat" onClick={newChat}><MessageSquarePlus size={18}/> محادثة جديدة <span>＋</span></button>
      <div className="side-label">مساحة العمل</div>
      <button className="side-link active"><MessageSquarePlus size={17}/> المحادثات</button>
      <button className="side-link" onClick={() => setSettingsOpen(true)}><Settings2 size={17}/> الإعدادات</button>
      <div className="sidebar-bottom"><div className="plan-card"><div className="plan-icon"><Zap size={16}/></div><div><b>آفاق في بدايته</b><p>نطوّر مساحة ذكية لصناعة الأفكار.</p></div></div><div className="profile"><div className="avatar">A</div><div><b>مساحة آفاق</b><small>الحساب الشخصي</small></div><button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="الإعدادات"><Settings2 size={17}/></button></div></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div className="topbar-left">{!sidebarOpen && <button className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="فتح القائمة"><Menu size={19}/></button>}<span className="breadcrumb">مساحة العمل <span>/</span> <b>محادثة جديدة</b></span></div><div className="top-actions">
        <div className="provider-wrap"><button className="model-select" onClick={() => setProviderMenu(!providerMenu)}><span className="model-dot"/>{provider === 'gemini' ? 'Gemini Flash' : 'OpenAI Compatible'}<ChevronDown size={15}/></button>{providerMenu && <div className="provider-menu"><button onClick={() => {setProvider('gemini');setProviderMenu(false)}}><span className="model-dot"/> Gemini Flash <small>سريع · يحتاج مفتاح API</small></button><button onClick={() => {setProvider('openai');setProviderMenu(false)}}><span className="model-dot muted"/> OpenAI Compatible <small>OpenAI أو مزود متوافق</small></button></div>}</div>
        <span className="status-pill"><i/> النظام جاهز</span></div></header>
      <div className="conversation">
        {messages.length === 0 ? <div className="welcome"><div className="welcome-orb"><div className="orb-core"><Sparkles size={29}/></div><span className="orb-ring ring-one"/><span className="orb-ring ring-two"/></div><div className="eyebrow"><span/> YOUR SPACE TO THINK BIG</div><h1>أهلاً بك في <em>آفاق</em></h1><p className="welcome-copy">مساحة واحدة تجمع التفكير والبرمجة والإبداع.<br/>ابدأ بفكرة، ودعنا نحولها إلى شيء حقيقي.</p><div className="starter-grid">{starters.map(item => <button className="starter-card" key={item.title} onClick={() => send(item.title)}><span className="starter-icon"><item.icon size={19}/></span><b>{item.title}</b><small>{item.detail}</small><span className="card-arrow">↗</span></button>)}</div></div> : <div className="message-list">{messages.map(m => <article className={`message ${m.role}`} key={m.id}><div className="message-avatar">{m.role === 'assistant' ? <Sparkles size={17}/> : 'أ'}</div><div className="message-body"><div className="message-name">{m.role === 'assistant' ? 'آفاق AI' : 'أنت'}</div><div className="message-text">{m.content}</div></div></article>)}{loading && <article className="message assistant"><div className="message-avatar"><Sparkles size={17}/></div><div className="message-body"><div className="message-name">آفاق يفكر</div><div className="typing"><i/><i/><i/></div></div></article>}<div ref={endRef}/></div>}
      </div>
      <div className="composer-area"><div className="composer"><textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey){e.preventDefault();send()}}} placeholder="اكتب فكرتك أو اسأل آفاق..." rows={1}/><div className="composer-tools"><div className="composer-hints"><button className="tool-btn" title="إرفاق ملف (قريباً)" disabled><Paperclip size={17}/></button><span className="hint-divider"/><span>Shift + Enter لسطر جديد</span></div><button className="send-btn" onClick={() => send()} disabled={!input.trim() || loading} aria-label="إرسال"><ArrowUp size={19}/></button></div></div>{error && <div className="error-note">{error}</div>}<p className="disclaimer">قد تخطئ النماذج أحياناً. راجع المعلومات المهمة دائماً.</p></div>
    </section>
    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PREFERENCES</span><h2>إعدادات آفاق</h2></div><button className="icon-btn" onClick={() => setSettingsOpen(false)}><X size={19}/></button></div><div className="setting-row"><div><b>مزود الذكاء الاصطناعي</b><p>اختر النموذج الذي تريد استخدامه.</p></div><select value={provider} onChange={e => setProvider(e.target.value as Provider)}><option value="gemini">Gemini Flash</option><option value="openai">OpenAI Compatible</option></select></div><div className="setting-info"><Zap size={18}/><p>مفاتيح API تحفظ على الخادم فقط. أضفها في إعدادات الاستضافة كمتغيرات بيئة، ولا تضعها داخل الواجهة أو المستودع.</p></div><button className="modal-done" onClick={() => setSettingsOpen(false)}>تم</button></section></div>}
  </main>;
}
