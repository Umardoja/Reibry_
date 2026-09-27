import { useState, useRef } from 'react'

/* ── TYPES ─────────────────────────────────────────────────── */
type Tab = 'today' | 'memories' | 'capture' | 'ask' | 'life'
type Screen = 'onboarding' | 'auth' | 'app'

interface Memory {
  id: number; title: string; description: string; summary: string
  type: 'youtube' | 'article' | 'note' | 'pdf'; source: string
  channel?: string; thumb?: string; duration?: string; category: string
  tags: string[]; savedAt: string; savedLabel: string; emoji: string
  whyNow?: string; lifeContext?: string; themes?: string[]
  ingredients?: string[]; intent?: string
  lifeEvent?: { title: string; description: string }
}

interface LifeEvent {
  id: number; title: string; description: string
  type: 'event' | 'deadline' | 'task' | 'goal'
  emoji: string; bgColor: string; when: string
  contextTag?: string; priority?: string
}

/* ── ASSETS ─────────────────────────────────────────────────── */
const A = {
  avatar:      '/assets/a7509.png',   // REIBRY R icon
  heroToday:   '/assets/a45f7.png',   // cream layer cake
  heroDetail:  '/assets/68348.png',   // red velvet cake
  memThumb:    '/assets/2c8c9.png',   // red velvet slice
  askThumb1:   '/assets/00bba.png',   // red velvet slices
  askThumb2:   '/assets/52491.png',   // elegant table setting
  onboardImg:  '/assets/8f04b.png',   // home office desk
}

/* ── SEED DATA ─────────────────────────────────────────────── */
const SEED_MEMORIES: Memory[] = [
  {
    id: 1, title: "Most People Learning Data Analytics Are Wasting Their Time (Here's Why)",
    description: 'Discussing common mistakes and inefficiencies in learning data analytics: avoiding tutorial paralysis, building real domain projects, and focusing on SQL…',
    summary: 'Common data analytics learning mistakes — tutorial paralysis, avoiding real projects, SQL prioritisation over flashy tools.',
    type: 'youtube', source: 'youtube.com', channel: 'Esther Chinenye Anagu',
    thumb: undefined, category: 'Education & Learning',
    tags: ['#DataAnalytics', '#Career'], savedAt: 'Sep 18', savedLabel: 'Sep 18', emoji: '📊',
  },
  {
    id: 2, title: 'Red Velvet Cake Tutorial recipe for birthday celebration',
    description: 'Detailed velvet sponge recipe emphasizing buttermilk acidity and…',
    summary: 'Detailed velvet sponge guide emphasizing buttermilk acidity, cocoa balance, and smooth cream cheese frosting crumb coat.',
    type: 'youtube', source: 'youtube.com', channel: "Sally's Baking",
    thumb: A.memThumb, duration: '14:20', category: 'Food & Cooking',
    tags: ['#Baking', '#Cake'], savedAt: 'Sep 12', savedLabel: '2 weeks ago', emoji: '🎂',
    whyNow: "Mum's birthday is Saturday", lifeContext: "Mum's Birthday Party",
    themes: ['#Baking', '#CakeDesign', '#FrostingTechnique', '#Celebration'],
    ingredients: ['Buttermilk', 'Dutch-process cocoa', 'Cream cheese', 'Red food gel'],
    intent: 'Identified as a celebration cake tutorial with steps and preparation checklist.',
    lifeEvent: { title: "Mum's Birthday Party", description: 'Scheduled for this Saturday · Resurfaced on Today as a recommended prep memory.' },
  },
  {
    id: 3, title: 'Distributed Consensus Algorithms & Raft Snapshot Notes',
    description: 'Leader election timeout calculations, log replication consistency guarantees, and snapshot compaction rules.',
    summary: 'Raft protocol deep-dive: leader election, log replication, and snapshot compaction rules for distributed systems.',
    type: 'note', source: 'Shared Note', category: 'Technology',
    tags: ['#Systems', '#Architecture'], savedAt: 'Sep 8', savedLabel: 'Sep 8', emoji: '⚙️',
  },
  {
    id: 4, title: 'Autonomous Agents in Healthcare Workflow Research Paper',
    description: '', summary: '', type: 'pdf', source: 'PDF Link',
    category: 'Work & Career', tags: [], savedAt: 'Sep 2', savedLabel: 'Sep 2', emoji: '📄',
  },
]

const SEED_LIFE: LifeEvent[] = [
  { id: 1, title: 'Software engineering pres…', description: 'Presentation and API walkthrough for team review', type: 'event', emoji: '🎤', bgColor: 'rgba(15,107,92,.12)', when: 'Thursday · 2:00 PM', contextTag: 'Core Engineering Pod' },
  { id: 2, title: "Mum's 60th Birthday Cele…", description: 'Dinner party at Riverside Pavilion with family', type: 'event', emoji: '🎂', bgColor: 'rgba(200,60,80,.08)', when: 'Saturday · 6:30 PM', contextTag: 'Riverside Pavilion' },
  { id: 3, title: 'Mathematics Final Exam', description: 'Calculus and linear algebra revision', type: 'deadline', emoji: '📐', bgColor: 'rgba(186,26,26,.07)', when: 'Friday · 9:00 AM', contextTag: 'Hall B · Academic Session 2025', priority: 'Priority 1' },
  { id: 4, title: 'Submit Hackathon Prototy…', description: 'Final code freeze, video presentation and pitch deck', type: 'deadline', emoji: '🚀', bgColor: 'rgba(186,26,26,.07)', when: 'Sunday · 11:59 PM', contextTag: 'Submission Portal v2' },
]

/* ── ICONS ─────────────────────────────────────────────────── */
const IC = {
  today:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" strokeWidth="1.5"/></svg>,
  memories: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  plus:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  ask:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  life:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" stroke="none"/></svg>,
  bell:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  search:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  send:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"/></svg>,
  arrowR:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  arrowL:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 5 5 12 12 19"/></svg>,
  check:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  clock:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  brain:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>,
  link:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  file:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  mic:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  dots:     <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>,
  filter:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>,
  cal:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  mail:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  lock:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  eye:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  lightbulb:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 21h6"/><path d="M12 3a6 6 0 0 1 6 6c0 2.22-1.21 4.16-3 5.2V17H9v-2.8A6 6 0 0 1 6 9a6 6 0 0 1 6-6z"/></svg>,
  info:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  shield:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  yt:       <svg viewBox="0 0 24 24" fill="#FF0000"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon fill="white" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>,
}

/* ── HEADER ────────────────────────────────────────────────── */
const PAGE_NAMES: Record<Tab, string> = {
  today: 'Today', memories: 'Memories', capture: 'Capture', ask: 'Ask', life: 'Life',
}

function Header({ tab }: { tab: Tab }) {
  return (
    <header className="app-header">
      <div className="header-logo-wrap">{IC.brain}</div>
      <div className="header-title-stack">
        <div className="header-brand">REIBRY</div>
        <div className="header-page">{PAGE_NAMES[tab]}</div>
      </div>
      <div className="header-actions">
        <button className="header-bell">{IC.bell}</button>
        <div className="header-avatar">
          <img src={A.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
        </div>
      </div>
    </header>
  )
}

/* ── BOTTOM NAV ────────────────────────────────────────────── */
function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <nav className="bottom-nav">
      {(['today', 'memories'] as Tab[]).map(t => (
        <button key={t} className={`nav-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
          {t === 'today' ? IC.today : IC.memories}
          <span>{PAGE_NAMES[t]}</span>
        </button>
      ))}
      <button className="nav-capture" onClick={() => setTab('capture')}>
        <div className="nav-capture-disc">{IC.plus}</div>
        <span>Capture</span>
      </button>
      {(['ask', 'life'] as Tab[]).map(t => (
        <button key={t} className={`nav-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
          {t === 'ask' ? IC.ask : IC.life}
          <span>{PAGE_NAMES[t]}</span>
        </button>
      ))}
    </nav>
  )
}

/* ── TODAY PAGE ────────────────────────────────────────────── */
function TodayPage({ memories, onOpenMemory }: { memories: Memory[]; onOpenMemory: (m: Memory) => void }) {
  const resurfaced = memories.filter(m => m.whyNow).slice(0, 3)
  const hero = resurfaced[0]
  const compact = resurfaced.slice(1)

  return (
    <div className="page-scroll">
      <div className="today-meta-row">
        <div className="section-label" style={{ marginBottom: 0 }}>Why now</div>
        <div className="today-date">Wednesday, Sep 24</div>
      </div>
      <div className="today-greeting">
        <div className="greeting-name">Good morning, Alex</div>
        <div className="greeting-h">Here's what matters today</div>
        <div className="greeting-hint">{resurfaced.length} memories connected to what's happening in your life right now.</div>
      </div>

      <div className="resurfaced-list">
        {hero && (
          <div className="hero-card" onClick={() => onOpenMemory(hero)} style={{ cursor: 'pointer' }}>
            <div className="hero-img-wrap">
              <img src={A.heroToday} className="hero-img" alt={hero.title} loading="lazy" />
              <div className="hero-source-bar">
                <div className="hero-source-text"><span style={{ fontSize: 10 }}>▶</span> YouTube · {hero.category}</div>
                <div className="hero-saved">Saved {hero.savedLabel}</div>
              </div>
            </div>
            <div className="hero-body">
              {hero.whyNow && <div style={{ marginBottom: 6 }}><span className="why-now-pill">⚡ Why now: {hero.whyNow}</span></div>}
              {hero.lifeContext && <div style={{ marginBottom: 8 }}><span className="life-pill">🗓 Life: {hero.lifeContext}</span></div>}
              <div className="hero-title">{hero.title}</div>
              <div className="hero-desc">Step-by-step moist sponge guide with cream cheese frosting technique and cocoa balance.</div>
              <div className="hero-actions">
                <button className="btn-primary">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18 2 4 4-10 10H8v-4L18 2z"/></svg>
                  Create shopping list
                </button>
                <div className="secondary-actions">
                  <button>Later</button>
                  <button>Dismiss</button>
                  <button style={{ marginLeft: 'auto' }}>Why this? ▾</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {compact.map((m, i) => (
          <div key={m.id} className="compact-card" onClick={() => onOpenMemory(m)} style={{ cursor: 'pointer' }}>
            <div className="compact-source-row">
              <div className="compact-source">
                <div className="compact-source-icon">{i === 0 ? '📰' : '📄'}</div>
                <span>{i === 0 ? 'Article · Education & Learning' : 'Note & PDF · Work & Career'}</span>
              </div>
              <span className="compact-saved">Saved {i === 0 ? '4d ago' : 'yesterday'}</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span className="why-now-pill" style={{ fontSize: 11 }}>
                Why now: {i === 0 ? 'Mathematics exam is this Friday at 9:00 AM' : 'Software Engineering presentation scheduled for Thursday at 2:00 PM'}
              </span>
            </div>
            <div className="compact-title">{i === 0 ? 'Software Engineering & Vector Mathematics Core Cheatsheet' : 'Engineering Architecture & Pitch Deck Outline'}</div>
            <div className="compact-desc">{i === 0 ? 'Matrix transformations, eigenvalue definitions, and fast review theorems.' : 'Key system diagram references, cloud deployment tradeoffs, and speaking cadence notes.'}</div>
            {i === 0 && (
              <>
                <div className="compact-progress-row"><span>Archived Flashcards</span><span style={{ fontWeight: 600, color: 'var(--primary-mid)' }}>18/24 mastered</span></div>
                <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: '75%' }} /></div>
              </>
            )}
            <button className="btn-primary">{i === 0 ? '▶ Start revision' : '📑 Open slides notes'}</button>
            <div className="secondary-actions" style={{ marginTop: 8 }}>
              <button>Later</button>
              <button>Dismiss</button>
            </div>
          </div>
        ))}

        {resurfaced.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--outline)' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🌱</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 6 }}>Nothing yet</div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>Save something and add a Life event — REIBRY will resurface what matters.</div>
          </div>
        )}
      </div>

      <div className="today-peaceful">
        <div className="peaceful-sync">
          <div className="peaceful-sync-dot" />
          Memory Archives Synchronized · Visual snapshot index updated today
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div className="peaceful-moon">✓</div>
        <div className="peaceful-text">
          All caught up.<br />
          Your memories are organized and ready whenever you need them.
        </div>
      </div>
    </div>
  )
}

/* ── MEMORIES PAGE ─────────────────────────────────────────── */
const CATS = ['All', 'Education & Learning', 'Technology', 'Food & Cooking', 'Work & Career']

function MemoriesPage({ memories, onOpenMemory }: { memories: Memory[]; onOpenMemory: (m: Memory) => void }) {
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const counts: Record<string, number> = { All: memories.length }
  memories.forEach(m => { counts[m.category] = (counts[m.category] ?? 0) + 1 })

  const shown = memories.filter(m =>
    (cat === 'All' || m.category === cat) &&
    (!q || m.title.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div className="page-scroll">
      <div className="px pt-page">
        <div className="page-h1">Memories</div>
        <div className="page-sub">· Everything you've saved, organized for you</div>
      </div>
      <div className="gap-sm" />
      <div className="px">
        <div className="search-row">
          {IC.search}
          <input placeholder="What do you remember?" value={q} onChange={e => setQ(e.target.value)} />
          <button className="search-filter-btn">{IC.filter}</button>
        </div>
      </div>
      <div className="chips-scroll">
        {CATS.map(c => (
          <button key={c} className={`chip${cat === c ? ' active' : ''}`} onClick={() => setCat(c)}>
            {c} {counts[c] ? <span className="chip-count">{counts[c]}</span> : null}
          </button>
        ))}
      </div>
      <div className="gap-sm" />
      <div className="px stack">
        {shown.map(m => <MemoryCardView key={m.id} memory={m} onClick={() => onOpenMemory(m)} />)}
        {shown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--outline)', fontSize: 14 }}>No memories found.</div>
        )}
      </div>
      {shown.length > 0 && (
        <div className="mem-load-more">
          <button>↓ Load More Memories</button>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--outline-var)' }}>Showing {shown.length} of {memories.length} memories</div>
        </div>
      )}
      <div className="gap-section" />
    </div>
  )
}

function MemoryCardView({ memory: m, onClick }: { memory: Memory; onClick: () => void }) {
  const sourceIcon = m.type === 'youtube' ? IC.yt : m.type === 'note' ? '📝' : '📄'
  return (
    <div className="mem-card" onClick={onClick}>
      <div className="mem-card-header">
        <div className="mem-source">
          <div className="mem-source-icon">{typeof sourceIcon === 'string' ? sourceIcon : <span style={{ display: 'flex' }}>{sourceIcon}</span>}</div>
          <span className="mem-source-text">{m.type === 'youtube' ? `YouTube · ${m.channel}` : m.source}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mem-date">{m.savedAt}</span>
          <button className="mem-three-dot">{IC.dots}</button>
        </div>
      </div>
      {m.type === 'pdf' && (
        <div className="mem-limited" style={{ marginBottom: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--outline)" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
          Saved link with summary preview
        </div>
      )}
      <div className="mem-card-body">
        <div className="mem-content">
          <div className="mem-title">{m.title}</div>
          {m.description && <div className="mem-desc">{m.description}</div>}
          <div className="mem-tags">
            <span className="mem-cat-tag">{m.category}</span>
            {m.tags.map(t => <span key={t} className="mem-hash-tag">{t}</span>)}
            {m.type === 'pdf' && <button style={{ fontSize: 12, color: 'var(--primary-mid)', fontWeight: 600, marginLeft: 4 }}>Re-analyze →</button>}
          </div>
        </div>
        {m.thumb && <img src={m.thumb} className="mem-thumb" alt={m.title} loading="lazy" />}
      </div>
    </div>
  )
}

/* ── MEMORY DETAIL ─────────────────────────────────────────── */
function MemoryDetailPage({ memory: m, onBack }: { memory: Memory; onBack: () => void }) {
  return (
    <div className="page-scroll">
      <div className="detail-back-row">
        <button className="detail-back" onClick={onBack}>{IC.arrowL} Memories</button>
        <div className="detail-source-badge">
          {m.type === 'youtube' ? <span style={{ color: '#FF0000', fontSize: 14 }}>▶</span> : '📰'}
          YouTube · {m.category}
        </div>
      </div>

      <div className="detail-hero-wrap">
        <img src={A.heroDetail} className="detail-hero-img" alt={m.title} loading="lazy" />
        {m.duration && <div className="detail-duration">{IC.clock} {m.duration}</div>}
      </div>

      <div className="detail-title-block">
        <div className="detail-title">{m.title}</div>
        <div className="detail-meta">
          <span>Saved {m.savedLabel}</span>
          {m.channel && <><span>·</span><span>{m.channel}</span></>}
          {m.source && <><span>·</span><span>{m.source}</span></>}
        </div>
        <button className="btn-primary" style={{ marginBottom: 4 }}>Open original ↗</button>
      </div>

      {m.summary && (
        <div className="detail-section">
          <div className="detail-section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' as const, letterSpacing: '.07em', fontSize: 10, fontWeight: 700, color: 'var(--outline)', marginBottom: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
              Summary
            </div>
            <div className="detail-summary">{m.summary}</div>
          </div>
        </div>
      )}

      {m.themes && (
        <div className="detail-section">
          <div className="detail-section-card">
            <div className="understood-header">
              <div className="section-label" style={{ margin: 0 }}>What REIBRY Understood</div>
              <span className="understood-badge">Archival Synthesis</span>
            </div>
            <div className="detail-theme-group">
              <div className="detail-theme-label">Core Themes &amp; Topics</div>
              <div className="detail-pills">{m.themes.map(t => <span key={t} className="detail-pill">{t}</span>)}</div>
            </div>
            {m.ingredients && (
              <div className="detail-theme-group">
                <div className="detail-theme-label">Identified Key Ingredients</div>
                <div className="detail-pills">
                  {m.ingredients.map(ing => <div key={ing} className="detail-check-pill">{IC.check} {ing}</div>)}
                </div>
              </div>
            )}
            {m.intent && (
              <div className="detail-intent-box">
                <div className="detail-intent-label">{IC.lightbulb} Intent &amp; Context</div>
                <div className="detail-intent-text">{m.intent}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {m.lifeEvent && (
        <div className="detail-section">
          <div className="detail-section-card" style={{ background: 'var(--surface-low)' }}>
            <div className="detail-life-card" style={{ padding: 0, background: 'transparent' }}>
              <div className="detail-life-icon">🗓</div>
              <div style={{ flex: 1 }}>
                <div className="detail-life-label">
                  Connected to your Life
                  <span className="detail-life-badge">Active Context</span>
                </div>
                <div className="detail-life-title">{m.lifeEvent.title}</div>
                <div className="detail-life-sub">{m.lifeEvent.description}</div>
                <button className="detail-life-link">View in Today {IC.arrowR}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="detail-footer-note">{IC.info} Understood from video transcript and description.</div>
      <div className="gap-section" />
    </div>
  )
}

/* ── CAPTURE PAGE ─────────────────────────────────────────── */
type CaptureState = 'idle' | 'url' | 'processing' | 'done'


function CapturePage({ onSave, recentMemories }: { onSave: (m: Memory) => void; recentMemories: Memory[] }) {
  const [text, setText] = useState('')
  const [state, setState] = useState<CaptureState>('idle')
  const [stepIdx, setStepIdx] = useState(-1)

  const isUrl = /https?:\/\/|youtube\.com|youtu\.be/.test(text)

  const handleChange = (v: string) => {
    setText(v)
    if (!state.match(/processing|done/)) {
      setState(v && /https?:\/\/|youtube\.com|youtu\.be/.test(v) ? 'url' : 'idle')
    }
  }

  const handleRemember = () => {
    if (!text.trim()) return
    setState('processing')
    setStepIdx(0)
    const tick = (i: number) => setTimeout(() => {
      setStepIdx(i + 1)
      if (i + 1 < 2) tick(i + 1)
      else setTimeout(() => {
        setState('done')
        onSave({
          id: Date.now(),
          title: isUrl ? 'Red Velvet Cake Tutorial' : text.slice(0, 60),
          description: text.slice(0, 120), summary: text.slice(0, 120),
          type: isUrl ? 'youtube' : 'note', source: isUrl ? 'youtube.com' : 'Personal note',
          channel: isUrl ? "Sally's Baking" : undefined,
          thumb: isUrl ? A.memThumb : undefined,
          category: isUrl ? 'Food & Cooking' : 'Personal',
          tags: ['captured'], savedAt: 'Just now', savedLabel: 'just now',
          emoji: isUrl ? '🎬' : '📝',
        })
      }, 700)
    }, 750)
    tick(0)
  }

  if (state === 'done') {
    return (
      <div className="page-scroll">
        <div className="remembered-wrap">
          <div className="remembered-check">✓</div>
          <div className="remembered-title">Remembered.</div>
          <div className="remembered-sub">You'll find it in Memories whenever you need it.</div>
          <button className="btn-primary" onClick={() => { setText(''); setState('idle'); setStepIdx(-1) }}>Save another</button>
        </div>
      </div>
    )
  }

  const steps = ['Reading source', 'Understanding', 'Connecting it to what matters']

  return (
    <div className="page-scroll">
      <div className="px pt-page">
        <div className="page-h1">Save a thought,<br />link, or plan.</div>
        <div className="page-sub">Paste a recipe, article, or note. REIBRY understands and connects it to your world.</div>
      </div>
      <div className="gap-sm" />

      <div className="px">
        <div className="capture-composer">
          <div className="composer-header">
            <div className="composer-header-label">Capture</div>
            <span className="composer-char-count">{text.length > 0 ? `${text.length} chars` : ''}</span>
          </div>
          <textarea
            className="capture-textarea"
            placeholder="Paste a link, type a thought, or share something you want to remember…"
            value={text}
            onChange={e => handleChange(e.target.value)}
            disabled={state === 'processing'}
          />
          {state === 'url' && (
            <div className="url-preview-card">
              <div className="url-icon">▶</div>
              <div className="url-preview-info">
                <div className="url-preview-title">Red Velvet Cake Tutorial</div>
                <div className="url-preview-src">youtube.com · Culinary Recipe</div>
              </div>
              <button className="url-dismiss" onClick={() => setState('idle')}>×</button>
            </div>
          )}
          <div className="composer-input-actions">
            <button className="composer-action-pill">{IC.link} Paste link</button>
            <button className="composer-action-pill">{IC.file} Add file</button>
            <button className="composer-action-pill">{IC.mic} Dictate</button>
          </div>
        </div>

        {state === 'processing' && (
          <>
            <div className="gap-sm" />
            <div className="processing-card">
              <div className="processing-label" style={{ marginBottom: 10 }}>Processing</div>
              <div className="processing-steps">
                {steps.map((s, i) => (
                  <div key={s} className={`proc-step ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : 'pending'}`}>
                    {i < stepIdx
                      ? <>{IC.check} {s}</>
                      : i === stepIdx
                        ? <><div className="proc-step-dot" style={{ background: 'var(--primary-mid)' }} /> {s}</>
                        : <><div className="proc-step-dot" style={{ background: 'var(--outline-var)' }} /> {s}</>
                    }
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <button
          className="btn-primary"
          style={{ marginTop: 12, boxShadow: '0 4px 16px rgba(15,107,92,.18)' }}
          onClick={handleRemember}
          disabled={!text.trim() || state === 'processing'}
        >
          {state === 'processing' ? 'Remembering…' : 'Remember this'} {state !== 'processing' && IC.arrowR}
        </button>
      </div>

      <div className="gap-section" />
      <div className="px">
        <div className="recent-row">
          <div className="recent-label">Recently remembered</div>
          <button className="recent-view-all">View all</button>
        </div>
        <div className="recent-item">
          <div className="recent-item-icon">📊</div>
          <div className="recent-item-info">
            <div className="recent-item-title">Data Analytics guide</div>
            <div className="recent-item-sub">Esther Chinenye Anagu · Today</div>
          </div>
          <div className="recent-item-arrow">{IC.arrowR}</div>
        </div>
        <div className="recent-item">
          <div className="recent-item-icon">🎁</div>
          <div className="recent-item-info">
            <div className="recent-item-title">Mum's birthday gift ideas</div>
            <div className="recent-item-sub">Curated wish list · Yesterday</div>
          </div>
          <div className="recent-item-arrow">{IC.arrowR}</div>
        </div>
      </div>
      <div className="gap-section" />
    </div>
  )
}

/* ── ASK PAGE ─────────────────────────────────────────────── */
const SUGGESTIONS = [
  { icon: '🎂', text: 'That cake recipe I saved' },
  { icon: '🐍', text: 'Show my Python resources' },
  { icon: '📐', text: 'What did I save for my maths exam?' },
]

function AskPage({ memories }: { memories: Memory[] }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Memory[] | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const search = (query = q) => {
    if (!query.trim()) return
    setLoading(true)
    setResults(null)
    setTimeout(() => {
      const lq = query.toLowerCase()
      setResults(memories.filter(m =>
        m.title.toLowerCase().includes(lq) || m.category.toLowerCase().includes(lq) ||
        m.tags.some(t => t.toLowerCase().includes(lq))
      ))
      setLoading(false)
    }, 900)
  }

  return (
    <div className="page-scroll">
      <div className="px pt-page">
        <div className="page-h1">Ask REIBRY</div>
        <div className="page-sub">Describe it however you remember it.</div>
      </div>
      <div className="gap-sm" />
      <div className="px">
        <div className="ask-search-bar">
          {IC.search}
          <input
            ref={ref}
            placeholder="What was that birthday cake…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          {q && <button className="ask-clear" onClick={() => { setQ(''); setResults(null) }}>×</button>}
          <button className="ask-submit" onClick={() => search()}>{IC.send}</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--outline)', marginTop: 7, paddingLeft: 2 }}>
          Searching your personal memories
        </div>
      </div>

      {!results && !loading && (
        <>
          <div className="gap-sm" />
          <div className="px">
            <div className="section-label" style={{ marginBottom: 10 }}>Thought prompts</div>
            <div className="thought-prompts">
              {SUGGESTIONS.map(s => (
                <button key={s.text} className="thought-pill" onClick={() => { setQ(s.text); search(s.text) }}>
                  <span>{s.icon}</span> {s.text}
                </button>
              ))}
            </div>
          </div>
          <div className="px">
            <div className="ask-empty-state">
              <div className="ask-empty-icon">🧠</div>
              <div className="ask-empty-title">Ask anything you've saved</div>
              <div className="ask-empty-sub">Describe it however you remember it — by what it looked like, where you saw it, or how it made you feel. REIBRY connects the dots.</div>
            </div>
          </div>
        </>
      )}

      {loading && (
        <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--outline)', fontSize: 14 }}>
          Looking through your memories…
        </div>
      )}

      {results !== null && (
        <div className="px" style={{ marginTop: 20 }}>
          {results.length > 0 && (
            <div className="why-box" style={{ marginBottom: 16 }}>
              <div className="why-box-title">{IC.lightbulb} Why these results?</div>
              <div className="why-box-text">REIBRY matched <strong>"{q}"</strong> and connected it to your upcoming Life event <strong>"Mum's Birthday"</strong>.</div>
            </div>
          )}

          <div className="results-header">
            <div className="section-label" style={{ margin: 0 }}>Top matches</div>
            <div className="results-count">{results.length} {results.length === 1 ? 'memory' : 'memories'}</div>
          </div>
          <div className="gap-sm" />

          {results.length === 0 ? (
            <div className="fallback-card">
              <div className="fallback-icon">{IC.lightbulb}</div>
              <div className="fallback-title">Can't find what you're looking for?</div>
              <div className="fallback-text">Describe where you saw it, what it looked like, or who shared it.</div>
              <div className="fallback-try">Try: "Something Sarah sent me last month" ↗</div>
            </div>
          ) : (
            <div className="stack">
              {results.map((m, i) => (
                <div key={m.id} className="result-card">
                  <div className="result-match-row">
                    <div className="result-match-icon">{m.emoji}</div>
                    <div className="result-match-label">
                      {i === 0 ? `Matched: '${q}' from YouTube` : 'Related idea'}
                    </div>
                    <span className="result-match-badge">Strong match</span>
                  </div>
                  <div className="result-body">
                    {m.thumb
                      ? <img src={A.askThumb1} className="result-thumb" alt={m.title} loading="lazy" />
                      : i === 1
                        ? <img src={A.askThumb2} className="result-thumb" alt="party" loading="lazy" />
                        : <div className="result-thumb-placeholder">{m.emoji}</div>
                    }
                    <div className="result-content">
                      <div className="result-title">{m.title}</div>
                      <div className="result-desc">"…{m.description.slice(0, 60)}…"</div>
                    </div>
                  </div>
                  <div className="result-tags-row">
                    <span className="result-cat">{m.type === 'youtube' ? '▶ YouTube' : m.type === 'note' ? '📝 Note' : '🔗 Web Link'}</span>
                    <span className="result-dot">·</span>
                    <span className="result-saved">Saved {m.savedLabel}</span>
                    {m.lifeContext && <span className="result-life-tag">🗓 {m.lifeContext}</span>}
                  </div>
                  <div className="result-footer">
                    <div className="result-why">You mentioned birthday cake and this was saved around your mum's birthday.</div>
                    <button style={{ background: 'var(--surface-low)', color: 'var(--primary)', border: '1px solid var(--border-focus)', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {i === 0 ? 'Open memory ↗' : 'Review note →'}
                    </button>
                  </div>
                </div>
              ))}
              <div className="fallback-card">
                <div className="fallback-icon">{IC.lightbulb}</div>
                <div className="fallback-title">Can't find what you're looking for?</div>
                <div className="fallback-text">REIBRY understands visual descriptors, timestamps, and emotional cues.</div>
                <div className="fallback-try">Try: "Something Sarah sent me last month" ↗</div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="gap-section" />
    </div>
  )
}

/* ── LIFE PAGE ────────────────────────────────────────────── */
const LIFE_CATS = ['All Categories', 'Events (2)', 'Deadlines (2)', 'Goals']

function LifePage({ life, onAdd }: { life: LifeEvent[]; onAdd: (text: string) => void }) {
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [showClarify, setShowClarify] = useState(false)
  const [lifeCat, setLifeCat] = useState('All Categories')

  const handleAdd = () => {
    if (!text.trim()) return
    setAdding(true)
    setTimeout(() => {
      if (/friday|saturday|thursday/i.test(text)) setShowClarify(true)
      else { onAdd(text.trim()); setText('') }
      setAdding(false)
    }, 400)
  }

  const confirm = () => {
    onAdd(text.trim())
    setText('')
    setShowClarify(false)
  }

  return (
    <div className="page-scroll">
      <div className="px pt-page">
        <div className="section-label">Life Chronology</div>
        <div className="page-h1">What's happening<br />in your world?</div>
        <div className="page-sub">Tell REIBRY what's coming up, changing, or important.</div>
      </div>
      <div className="gap-sm" />
      <div className="px">
        <div className="life-composer">
          <textarea
            className="life-textarea"
            placeholder="My exam is next Friday at 9 AM or Software engineering presentation Thursday at 2 PM…"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
          />
          <div className="life-composer-parse">
            <div className="life-parse-note">
              <svg width="7" height="7" viewBox="0 0 8 8" fill="var(--accent-mint)"><circle cx="4" cy="4" r="4"/></svg>
              Contextual engine parses time &amp; category
            </div>
            <span className="life-natural">NATURAL</span>
          </div>
          <div className="life-composer-footer">
            <button className="btn-ghost" style={{ flex: '0 0 auto', padding: '0 16px', minWidth: 72 }}>🎙 Voice</button>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleAdd}>
              {adding ? 'Adding…' : 'Add to Life'} {!adding && IC.arrowR}
            </button>
          </div>
        </div>
      </div>

      {showClarify && (
        <>
          <div className="gap-sm" />
          <div className="px">
            <div className="life-clarify-card">
              <button className="life-clarify-dismiss" onClick={() => setShowClarify(false)}>×</button>
              <div className="life-clarify-label">CONFIRM DETAILS</div>
              <div className="life-clarify-title">Did you mean: Friday, 25 September · 9:00 AM?</div>
              <div className="life-clarify-sub">We found a date and time in what you wrote. Confirm to add it to your Life context.</div>
              <div className="life-clarify-actions">
                <button className="btn-primary" style={{ flex: 1 }} onClick={confirm}>{IC.check} Confirm</button>
                <button className="btn-ghost" style={{ flex: 1 }}>Change date</button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="gap-section" />
      <div className="px">
        <div className="life-list-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="section-label" style={{ margin: 0 }}>Upcoming Life Context</div>
            <span className="life-count">{life.length} items</span>
          </div>
          <button className="life-filter-btn">{IC.filter} Filter</button>
        </div>
        <div className="chips-scroll" style={{ padding: '0 0 10px' }}>
          {LIFE_CATS.map(c => (
            <button key={c} className={`chip${lifeCat === c ? ' active' : ''}`} onClick={() => setLifeCat(c)}>{c}</button>
          ))}
        </div>
        <div className="stack">
          {life.map(e => <LifeEventCard key={e.id} event={e} />)}
        </div>
      </div>

      <div className="px" style={{ marginTop: 12 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-hair)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-low)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📅</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)', marginBottom: 2 }}>Connect calendar</div>
              <div style={{ fontSize: 13, color: 'var(--outline)' }}>Optional · Sync upcoming events</div>
            </div>
          </div>
          <button style={{ fontSize: 13, color: 'var(--primary-mid)', fontWeight: 600 }}>Connect →</button>
        </div>
      </div>
      <div className="gap-section" />
    </div>
  )
}

function LifeEventCard({ event: e }: { event: LifeEvent }) {
  return (
    <div className="life-event-card">
      <div className="life-event-icon" style={{ background: e.bgColor }}>{e.emoji}</div>
      <div className="life-event-body">
        <div className="life-type-row">
          <span className={`life-type-badge ${e.type}`}>{e.type.toUpperCase()}</span>
          <span className="life-event-when">{IC.cal} {e.when}</span>
        </div>
        <div className="life-event-title">{e.title}</div>
        <div className="life-event-desc">{e.description}</div>
        <div className="life-event-footer">
          <div style={{ display: 'flex', flex: 1, flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {e.contextTag && <span className="life-event-context">{IC.info} {e.contextTag}</span>}
            {e.priority && <span className="life-context-tag">{e.priority}</span>}
          </div>
          <button className="life-three-dot">{IC.dots}</button>
        </div>
      </div>
    </div>
  )
}

/* ── AUTH PAGE ────────────────────────────────────────────── */
function AuthPage({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [pw, setPw] = useState('••••••••••••')
  const [showPw, setShowPw] = useState(false)

  return (
    <div className="page-scroll">
      <div className="auth-wrap">
        <div className="auth-logo-ring">{IC.brain}</div>
        <div className="auth-brand">REIBRY</div>
        <div className="auth-tagline">Your personal AI memory engine. Remember what you discover, brought back when it matters.</div>

        <div className="auth-tabs">
          <button className={`auth-tab${mode === 'signin' ? ' active' : ''}`} onClick={() => setMode('signin')}>Sign In</button>
          <button className={`auth-tab${mode === 'signup' ? ' active' : ''}`} onClick={() => setMode('signup')}>Sign Up</button>
        </div>

        <div className="auth-form">
          <div className="auth-field">
            <label>Email address</label>
            <div className="auth-input-wrap">
              {IC.mail}
              <input type="email" defaultValue="alex@example.com" />
            </div>
          </div>
          <div className="auth-field" style={{ marginBottom: 20 }}>
            <label>Password</label>
            <div className="auth-input-wrap">
              {IC.lock}
              <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} />
              <button className="eye" onClick={() => setShowPw(p => !p)}>{IC.eye}</button>
            </div>
          </div>
          <button className="btn-primary" style={{ marginTop: 4 }} onClick={onAuth}>
            Sign in to REIBRY {IC.arrowR}
          </button>
        </div>

        <div className="auth-divider" style={{ marginTop: 20 }}>
          <div className="auth-divider-line" />
          <span className="auth-divider-text">or continue with</span>
          <div className="auth-divider-line" />
        </div>
        <div style={{ width: '100%', display: 'flex', gap: 8, marginBottom: 4 }}>
          <button className="auth-sso-btn" style={{ opacity: .55 }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.3 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10 0 19-7.2 19-20 0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.2 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.3C29.6 35.2 26.9 36 24 36c-5.2 0-9.6-2.7-11.2-7H6.5C9.9 39.6 16.4 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.4-4.2 5.9l6.2 5.3C40.3 36.1 44 30.5 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
            Google
          </button>
          <button className="auth-sso-btn" style={{ opacity: .55 }}>
            <svg width="16" height="18" viewBox="0 0 814 1000" fill="var(--on-surface)"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.8 0 271 0 210.3c0-109.3 71.4-162.7 136.7-162.7 46.7 0 88.8 32.1 120.4 32.1 29.4 0 76.8-34.9 131.5-34.9 36.7 0 114.9 1.3 166.4 81.7zm-189.4-91.9c12.9-38.9 44.6-113.7 151.1-113.7 5.4 0 10.8.6 14.1 1.3-2.6 37.9-34.3 112.7-134.2 116.3-1.9-.1-30.1-.1-31-3.9z"/></svg>
            Apple
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--outline-var)', textAlign: 'center', marginBottom: 4 }}>Google &amp; Apple sign-in coming soon</div>

        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--outline)' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={{ color: 'var(--primary-mid)', fontWeight: 600 }}>
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
      <div className="gap-section" />
    </div>
  )
}

/* ── ONBOARDING PAGE ──────────────────────────────────────── */
const ONBOARD_STEPS = ['Welcome', 'Your context', 'Privacy']
const ANCHOR_PILLS = ['📚 Learning', '💼 Work', '🍳 Cooking', '✈️ Travel', '💡 Ideas', '🏋️ Fitness']

function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [context, setContext] = useState('')
  const [anchors, setAnchors] = useState<string[]>([])

  const toggle = (p: string) => setAnchors(a => a.includes(p) ? a.filter(x => x !== p) : [...a, p])

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: '0 var(--gutter)', maxWidth: 430, margin: '0 auto' }}>
      {/* Progress */}
      <div style={{ paddingTop: 56, paddingBottom: 28 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {ONBOARD_STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? 'var(--primary-mid)' : 'var(--surface-dim)', transition: 'background .3s' }} />
          ))}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface-low)', border: '1px solid var(--border-focus)', borderRadius: 999, padding: '4px 12px', fontSize: 12, color: 'var(--primary-mid)', fontWeight: 600, marginBottom: 20 }}>
          {IC.brain} Step {step + 1} of {ONBOARD_STEPS.length}
        </div>

        {step === 0 && (
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--on-surface)', lineHeight: 1.2, marginBottom: 12 }}>Getting Started</div>
            <div style={{ fontSize: 15, color: 'var(--on-surface-var)', lineHeight: 1.6, marginBottom: 32 }}>REIBRY is your personal AI memory engine. Save anything — links, thoughts, recipes — and we'll bring them back when they matter.</div>
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border-hair)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
              <img src={A.onboardImg} alt="Private workspace" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: 'var(--primary-mid)' }}>{IC.shield}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)', marginBottom: 2 }}>Private &amp; Personal</div>
                  <div style={{ fontSize: 13, color: 'var(--outline)', lineHeight: 1.5 }}>Your memories stay yours. Nothing is shared or sold.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--on-surface)', lineHeight: 1.2, marginBottom: 8 }}>Tell us about yourself</div>
            <div style={{ fontSize: 15, color: 'var(--on-surface-var)', lineHeight: 1.6, marginBottom: 24 }}>REIBRY works better when it knows your context. Share what matters to you.</div>
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid rgba(22,33,31,.12)', boxShadow: 'var(--shadow-float)', marginBottom: 20 }}>
              <textarea
                style={{ width: '100%', border: 'none', outline: 'none', padding: '14px 16px', fontSize: 15, color: 'var(--on-surface)', background: 'transparent', resize: 'none', minHeight: 100, lineHeight: 1.6, fontFamily: 'inherit' }}
                placeholder="I'm a software engineer who loves cooking and learning new things…"
                value={context}
                onChange={e => setContext(e.target.value)}
              />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Anchor topics</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ANCHOR_PILLS.map(p => (
                <button key={p} onClick={() => toggle(p)} style={{ borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 500, border: '1px solid', borderColor: anchors.includes(p) ? 'var(--primary-mid)' : 'var(--border-hair)', background: anchors.includes(p) ? 'var(--surface-low)' : 'var(--surface)', color: anchors.includes(p) ? 'var(--primary)' : 'var(--on-surface-var)', transition: 'all .12s' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--on-surface)', lineHeight: 1.2, marginBottom: 8 }}>You're all set</div>
            <div style={{ fontSize: 15, color: 'var(--on-surface-var)', lineHeight: 1.6, marginBottom: 32 }}>Your REIBRY is ready. Start saving what matters and we'll surface it back at the right moment.</div>
            {[
              { icon: '🔒', title: 'End-to-end privacy', desc: 'Your data is encrypted and never shared.' },
              { icon: '🧠', title: 'Smart recall', desc: 'REIBRY connects memories to your life context.' },
              { icon: '⚡', title: 'Instant capture', desc: 'Paste a link or type a thought in seconds.' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-low)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)', marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--on-surface-var)', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingBottom: 48, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          className="btn-primary"
          style={{ fontSize: 16, minHeight: 52, borderRadius: 14 }}
          onClick={() => step < ONBOARD_STEPS.length - 1 ? setStep(s => s + 1) : onComplete()}
        >
          {step < ONBOARD_STEPS.length - 1 ? 'Continue' : 'Start using REIBRY'} {IC.arrowR}
        </button>
        {step < ONBOARD_STEPS.length - 1 && (
          <button onClick={() => setStep(ONBOARD_STEPS.length - 1)} style={{ fontSize: 14, color: 'var(--outline)', padding: '8px', textAlign: 'center' }}>Skip</button>
        )}
      </div>
    </div>
  )
}

/* ── APP ──────────────────────────────────────────────────── */
export default function App() {
  const [screen, setScreen] = useState<Screen>('onboarding')
  const [tab, setTab] = useState<Tab>('today')
  const [memories, setMemories] = useState<Memory[]>(SEED_MEMORIES)
  const [life, setLife] = useState<LifeEvent[]>(SEED_LIFE)
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)

  const addMemory = (m: Memory) => setMemories(p => [m, ...p])
  const addLife = (text: string) => setLife(p => [{
    id: Date.now(), title: text.length > 40 ? text.slice(0, 40) + '…' : text,
    description: text, type: 'event', emoji: '📅', bgColor: 'rgba(15,107,92,.1)', when: 'Upcoming',
  }, ...p])

  if (screen === 'onboarding') {
    return <OnboardingPage onComplete={() => setScreen('auth')} />
  }

  if (screen === 'auth') {
    return (
      <div className="app">
        <Header tab="today" />
        <AuthPage onAuth={() => setScreen('app')} />
        <BottomNav tab={tab} setTab={setTab} />
      </div>
    )
  }

  return (
    <div className="app">
      <Header tab={tab} />
      {selectedMemory ? (
        <MemoryDetailPage memory={selectedMemory} onBack={() => setSelectedMemory(null)} />
      ) : (
        <>
          {tab === 'today'    && <TodayPage memories={memories} onOpenMemory={setSelectedMemory} />}
          {tab === 'memories' && <MemoriesPage memories={memories} onOpenMemory={setSelectedMemory} />}
          {tab === 'capture'  && <CapturePage onSave={addMemory} recentMemories={memories.slice(0, 3)} />}
          {tab === 'ask'      && <AskPage memories={memories} />}
          {tab === 'life'     && <LifePage life={life} onAdd={addLife} />}
        </>
      )}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  )
}
