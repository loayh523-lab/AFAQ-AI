'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, Code2, ImagePlus, Menu, MessageSquarePlus, PanelRightClose, Settings2, Sparkles, X, ShieldCheck } from 'lucide-react';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
const starters = [
  { icon: Code2, title: 'اكتب لي صفحة ويب بسيطة', detail: 'HTML وCSS وJavaScript' },
  { icon: Sparkles, title: 'اشرح لي مفهوم الذكاء الاصطناعي', detail: 'بشرح واضح ومثال' },
  { icon: Bot, title: 'ساعدني في حل مسألة برمجية', detail: 'خطوة بخطوة' },
  { icon: ImagePlus, title: 'اقترح فكرة مشروع جديد', detail: 'فكرة قابلة للتنفيذ' },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function send(text = input) {
    const value = text.trim();
    if (!value || loading) return;
    const next: Message[] = [...messages, { id: crypto.randomUUID(), role: 'user', content: value }];
    const assistantId = crypto.randomUUID();
    setMessages([...next, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذّر الحصول على إجابة.');
      if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('وصل رد غير صالح من الخدمة.');
      setMessages([...next, { id: assistantId, role: 'assistant', content: data.answer }]);
    } catch (e) {
      setMessages(next);
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء الاتصال بآفاق.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function newChat() { setMessages([]); setInput(''); setError(''); }

  return <main className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={20}/></div><div><strong>AFAQ<span> AI</span></strong><small>INTELLIGENCE BEYOND LIMITS</small></div><button className="icon-btn sidebar-toggle" onClick={() => setSidebarOpen(false)} aria-label="إغلاق القائمة"><PanelRightClose size={18}/></button></div>
      <button className="new-chat" onClick={newChat}><MessageSquarePlus size={18}/> محادثة جديدة <span>＋</span></button>
      <div className="side-label">مساحة العمل</div>
      <button className="side-link active"><MessageSquarePlus size={17}/> المحادثات</button>
      <button className="side-link" onClick={() => setSettingsOpen(true)}><Settings2 size={17}/> حول آفاق</button>
      <div className="sidebar-bottom">
        <div className="plan-card"><div className="plan-icon"><ShieldCheck size={16}/></div><div><b>اتصال مركزي</b><p>آفاق يدير الاتصال بالنماذج نيابةً عنك.</p></div></div>
        <div className="profile"><div className="avatar">A</div><div><b>مساحة آفاق</b><small>نسخة تجريبية</small></div><button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="حول آفاق"><Settings2 size={17}/></button></div>
      </div>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div className="topbar-left">{!sidebarOpen && <button className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="فتح القائمة"><Menu size={19}/></button>}<span className="breadcrumb">مساحة العمل <span>/</span> <b>محادثة جديدة</b></span></div>
        <div className="top-actions"><div className="model-select"><span className="model-dot"/>آفاق AI <span className="local-tag">CLOUD</span></div><span className="status-pill"><i className="ready"/>مساعد ذكي</span></div>
      </header>

      <div className="conversation">
        {messages.length === 0 ? <div className="welcome">
          <div className="welcome-orb"><div className="orb-core"><Sparkles size={29}/></div><span className="orb-ring ring-one"/><span className="orb-ring ring-two"/></div>
          <div className="eyebrow"><span/> YOUR SPACE TO THINK BIG</div>
          <h1>أهلاً بك في <em>آفاق</em></h1>
          <p className="welcome-copy">اسأل، تعلّم، اكتب الكود، وابدأ ببناء أفكارك.<br/>آفاق يتولى الاتصال بالنموذج نيابةً عنك.</p>
          <div className="local-model-card">
            <div className="local-model-head"><span className="local-model-icon"><Sparkles size={19}/></span><div><b>مساعد آفاق الذكي</b><small>خدمة مركزية · لا تحتاج إعداد API</small></div><span className="local-tag">AI</span></div>
            <p>ما تحتاج تنزّل نموذج على جهازك أو تدخل مفاتيح تقنية. اكتب سؤالك وابدأ مباشرة.</p>
            <div className="ready-note"><ShieldCheck size={17}/> لا تشارك كلمات المرور أو المعلومات الخاصة.</div>
            <div className="model-requirements">قد تكون الخدمة غير متاحة إلى أن يكتمل إعداد الخادم المركزي.</div>
          </div>
          <div className="starter-grid">{starters.map(item => <button className="starter-card" key={item.title} onClick={() => { setInput(item.title); inputRef.current?.focus(); }}><span className="starter-icon"><item.icon size={19}/></span><b>{item.title}</b><small>{item.detail}</small><span className="card-arrow">↗</span></button>)}</div>
        </div> : <div className="message-list">
          {messages.map(m => <article className={`message ${m.role}`} key={m.id}><div className="message-avatar">{m.role === 'assistant' ? <Sparkles size={17}/> : 'أ'}</div><div className="message-body"><div className="message-name">{m.role === 'assistant' ? 'آفاق AI' : 'أنت'}</div><div className="message-text">{m.content}</div></div></article>)}
          {loading && <article className="message assistant"><div className="message-avatar"><Sparkles size={17}/></div><div className="message-body"><div className="message-name">آفاق يفكر</div><div className="typing"><i/><i/><i/></div></div></article>}
          <div ref={endRef}/>
        </div>}
      </div>

      <div className="composer-area">
        <div className="composer"><textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey){e.preventDefault();send()}}} placeholder="اكتب فكرتك أو اسأل آفاق..." rows={1} disabled={loading}/><div className="composer-tools"><div className="composer-hints"><span className="hint-divider"/><span>Shift + Enter لسطر جديد</span></div><button className="send-btn" onClick={() => send()} disabled={!input.trim() || loading} aria-label="إرسال"><ArrowUp size={19}/></button></div></div>
        {error && <div className="error-note">{error}</div>}
        <p className="disclaimer">قد تخطئ أنظمة الذكاء الاصطناعي. راجع المعلومات المهمة ولا ترسل بيانات سرية.</p>
      </div>
    </section>

    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">ABOUT AFAQ</span><h2>آفاق يتولى الإعدادات التقنية</h2></div><button className="icon-btn" onClick={() => setSettingsOpen(false)}><X size={19}/></button></div><div className="setting-info"><ShieldCheck size={18}/><p>مفاتيح مزوّدي النماذج تُحفظ في الخادم فقط ولا تظهر داخل التطبيق أو للمستخدم. لا تحتاج إدخال أي مفتاح API.</p></div><div className="setting-info"><Sparkles size={18}/><p>تُرسل رسائلك إلى خدمة الذكاء الاصطناعي لمعالجتها وإرجاع الإجابة. تجنّب مشاركة المعلومات الشخصية أو كلمات المرور.</p></div><button className="modal-done" onClick={() => setSettingsOpen(false)}>تم</button></section></div>}
  </main>;
}
