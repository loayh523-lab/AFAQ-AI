'use client';

import { useEffect, useRef, useState } from 'react';
import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import { ArrowUp, Bot, ChevronDown, Code2, Cpu, ImagePlus, Menu, MessageSquarePlus, PanelRightClose, Settings2, Sparkles, X, Zap, Download, ShieldCheck } from 'lucide-react';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
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
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelMessage, setModelMessage] = useState('النموذج لم يتم تحميله بعد');
  const engineRef = useRef<MLCEngineInterface | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function loadModel() {
    if (modelLoading || modelReady) return;
    setError('');
    const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
    if (!gpu) {
      setError('هذا المتصفح لا يوفّر WebGPU. جرّب Chrome محدّثاً على جهاز يدعم WebGPU، أو افتح آفاق من حاسوب.');
      return;
    }
    setModelLoading(true);
    setModelProgress(0);
    setModelMessage('تهيئة محرك الذكاء الاصطناعي...');
    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
      const engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          setModelProgress(Math.max(0, Math.min(100, Math.round(report.progress * 100))));
          setModelMessage(report.text || 'جارٍ تجهيز النموذج...');
        },
      });
      engineRef.current = engine;
      setModelReady(true);
      setModelProgress(100);
      setModelMessage('النموذج جاهز ويعمل على جهازك');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تحميل النموذج. تحقق من اتصال الإنترنت ومساحة الجهاز ثم أعد المحاولة.');
      setModelMessage('تعذّر تحميل النموذج');
    } finally {
      setModelLoading(false);
    }
  }

  async function send(text = input) {
    const value = text.trim();
    if (!value || loading) return;
    if (!engineRef.current) {
      setError('حمّل النموذج المحلي أولاً من زر «تحميل نموذج الاختبار».');
      return;
    }
    const next: Message[] = [...messages, { id: crypto.randomUUID(), role: 'user', content: value }];
    const assistantId = crypto.randomUUID();
    setMessages([...next, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setError('');
    setLoading(true);
    try {
      const result = await engineRef.current.chat.completions.create({
        messages: [
          { role: 'system', content: 'أنت آفاق، مساعد ذكي يتحدث بالعربية الواضحة. أجب بدقة وباختصار مناسب. إذا طُلب منك كود، اكتب مثالاً صحيحاً واشرحه ببساطة. إذا لم تعرف فقل ذلك بوضوح.' },
          ...next.map(({ role, content }) => ({ role, content })),
        ],
        temperature: 0.7,
        max_tokens: 512,
      });
      const answer = result.choices?.[0]?.message?.content;
      const answerText = typeof answer === 'string' ? answer : 'لم يتمكن النموذج من إنشاء إجابة.';
      setMessages([...next, { id: assistantId, role: 'assistant', content: answerText }]);
    } catch (e) {
      setMessages(next);
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء توليد الإجابة. حاول مرة أخرى.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function newChat() { setMessages([]); setInput(''); setError(''); }

  return <main className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={20}/></div><div><strong>AFAQ<span> AI</span></strong><small>INTELLIGENCE, REIMAGINED</small></div><button className="icon-btn sidebar-toggle" onClick={() => setSidebarOpen(false)} aria-label="إغلاق القائمة"><PanelRightClose size={18}/></button></div>
      <button className="new-chat" onClick={newChat}><MessageSquarePlus size={18}/> محادثة جديدة <span>＋</span></button>
      <div className="side-label">مساحة العمل</div>
      <button className="side-link active"><MessageSquarePlus size={17}/> المحادثات</button>
      <button className="side-link" onClick={() => setSettingsOpen(true)}><Settings2 size={17}/> إعدادات النموذج</button>
      <div className="sidebar-bottom">
        <div className="plan-card"><div className="plan-icon"><Cpu size={16}/></div><div><b>تشغيل محلي</b><p>النموذج يعمل على جهازك دون مفتاح API.</p></div></div>
        <div className="profile"><div className="avatar">A</div><div><b>مساحة آفاق</b><small>نسخة الاختبار الأولى</small></div><button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="الإعدادات"><Settings2 size={17}/></button></div>
      </div>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div className="topbar-left">{!sidebarOpen && <button className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="فتح القائمة"><Menu size={19}/></button>}<span className="breadcrumb">مساحة العمل <span>/</span> <b>محادثة جديدة</b></span></div>
        <div className="top-actions"><div className="model-select"><span className={`model-dot ${modelReady ? '' : 'muted'}`}/>{modelReady ? 'Qwen محلي · جاهز' : 'Qwen 0.5B · محلي'}<ChevronDown size={15}/></div><span className="status-pill"><i className={modelReady ? 'ready' : ''}/>{modelReady ? 'يعمل على جهازك' : modelLoading ? 'جار التحميل' : 'بانتظار التحميل'}</span></div>
      </header>

      <div className="conversation">
        {messages.length === 0 ? <div className="welcome">
          <div className="welcome-orb"><div className="orb-core"><Sparkles size={29}/></div><span className="orb-ring ring-one"/><span className="orb-ring ring-two"/></div>
          <div className="eyebrow"><span/> YOUR SPACE TO THINK BIG</div>
          <h1>أهلاً بك في <em>آفاق</em></h1>
          <p className="welcome-copy">نسخة اختبار تعمل بنموذج ذكاء اصطناعي محلي.<br/>ابدأ بتحميل النموذج، ثم جرّب المحادثة.</p>
          <div className="local-model-card">
            <div className="local-model-head"><span className="local-model-icon"><Cpu size={19}/></span><div><b>Qwen 2.5 · 0.5B Instruct</b><small>نموذج مفتوح يعمل داخل المتصفح</small></div><span className="local-tag">LOCAL</span></div>
            <p>لا يحتاج مفتاح API. في أول مرة سيحمّل ملفات النموذج إلى جهازك، وبعدها يحتفظ المتصفح بنسخة مؤقتة لتسريع التشغيل.</p>
            {modelLoading && <div className="progress-wrap"><div className="progress-label"><span>{modelMessage}</span><b>{modelProgress}%</b></div><div className="progress-track"><span style={{width: modelProgress + '%'}}/></div></div>}
            {modelReady ? <div className="ready-note"><ShieldCheck size={17}/> {modelMessage}</div> : <button className="load-model-btn" onClick={loadModel} disabled={modelLoading}><Download size={17}/>{modelLoading ? 'جارٍ تجهيز النموذج...' : 'تحميل نموذج الاختبار'}</button>}
            <div className="model-requirements">يتطلب متصفحاً يدعم WebGPU وقرابة 1 GB من ذاكرة GPU المتاحة. أول تحميل قد يكون كبيراً ويحتاج اتصالاً مستقراً.</div>
          </div>
          <div className="starter-grid">{starters.map(item => <button className="starter-card" key={item.title} onClick={() => setInput(item.title)}><span className="starter-icon"><item.icon size={19}/></span><b>{item.title}</b><small>{item.detail}</small><span className="card-arrow">↗</span></button>)}</div>
        </div> : <div className="message-list">
          {messages.map(m => <article className={`message ${m.role}`} key={m.id}><div className="message-avatar">{m.role === 'assistant' ? <Sparkles size={17}/> : 'أ'}</div><div className="message-body"><div className="message-name">{m.role === 'assistant' ? 'آفاق AI · Qwen محلي' : 'أنت'}</div><div className="message-text">{m.content}</div></div></article>)}
          {loading && <article className="message assistant"><div className="message-avatar"><Sparkles size={17}/></div><div className="message-body"><div className="message-name">آفاق يفكر</div><div className="typing"><i/><i/><i/></div></div></article>}
          <div ref={endRef}/>
        </div>}
      </div>

      <div className="composer-area">
        {!modelReady && <div className="composer-lock"><Cpu size={15}/> حمّل النموذج أولاً حتى تبدأ المحادثة</div>}
        <div className="composer"><textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey){e.preventDefault();send()}}} placeholder={modelReady ? 'اكتب فكرتك أو اسأل آفاق...' : 'حمّل النموذج أولاً لبدء المحادثة'} rows={1} disabled={!modelReady || loading}/><div className="composer-tools"><div className="composer-hints"><span className="hint-divider"/><span>Shift + Enter لسطر جديد</span></div><button className="send-btn" onClick={() => send()} disabled={!modelReady || !input.trim() || loading} aria-label="إرسال"><ArrowUp size={19}/></button></div></div>
        {error && <div className="error-note">{error}</div>}
        <p className="disclaimer">النموذج صغير للتجربة الأولية وقد تكون إجاباته محدودة. لا ترسل معلومات شخصية أو سرية.</p>
      </div>
    </section>

    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">MODEL SETTINGS</span><h2>إعدادات نموذج آفاق</h2></div><button className="icon-btn" onClick={() => setSettingsOpen(false)}><X size={19}/></button></div><div className="setting-row"><div><b>النموذج الحالي</b><p>Qwen 2.5 · 0.5B Instruct</p></div><span className="local-tag">LOCAL</span></div><div className="setting-info"><ShieldCheck size={18}/><p>توليد الإجابات يتم داخل المتصفح على جهازك. لا نرسل نص المحادثة إلى خادم نموذج خارجي. تنزيل ملفات النموذج يتم من مستودع النموذج في أول تشغيل.</p></div><div className="setting-info"><Cpu size={18}/><p>يلزم دعم WebGPU وذاكرة GPU كافية. إذا لم يدعم هاتفك ذلك، جرّب من حاسوب متوافق.</p></div><button className="modal-done" onClick={() => setSettingsOpen(false)}>تم</button></section></div>}
  </main>;
}
