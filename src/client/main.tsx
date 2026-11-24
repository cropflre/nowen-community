import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Coffee,
  Compass,
  Github,
  LifeBuoy,
  Menu,
  MessageCircle,
  Moon,
  NotebookPen,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Video,
  X,
} from 'lucide-react';
import './styles.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AuthDialog,
  BookmarksDialog,
  ComposerDialog,
  MyTopicsDialog,
  TopicEngagement,
  useMember,
  type MyTopic,
} from './member';
import { AdminPanel } from './admin';
import { NotificationTray } from './notifications';
import { AccountDialog } from './account';

type Category = { id: string; name: string; description: string; icon: string };
type Topic = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  categoryId: string;
  categoryName: string;
  authorId?: string;
  authorName: string;
  replyCount: number;
  createdAt: number;
  pinned: boolean;
  solvedAt?: number | null;
  bestReplyId?: string | null;
  viewer?: { liked: boolean; bookmarked: boolean } | null;
};
type Feed = { items: Topic[]; nextPage: number | null };

const preset: Category[] = [
  {id:'note',name:'弄文笔记',description:'写作、同步与插件',icon:'note'},
  {id:'reader',name:'弄文阅读',description:'私人书库与阅读',icon:'reader'},
  {id:'video',name:'弄文影视',description:'媒体库与字幕',icon:'video'},
  {id:'showcase',name:'作品展示',description:'分享你的创作',icon:'showcase'},
  {id:'help',name:'问题求助',description:'一起找到答案',icon:'help'},
  {id:'chat',name:'茶话会',description:'技术与生活',icon:'chat'},
];

const boardIntros: Record<string, string> = {
  all: 'NAS 装好了可以来晒，装到一半卡住了也可以来问。',
  note: '聊弄文笔记的日常用法、多端同步、NAS 部署和插件折腾。',
  reader: '漫画、小说书库整理与 OPDS 阅读器配置都在这里。',
  video: '本地片库、字幕刮削和家庭影音搭建交流。',
  showcase: '晒晒你的知识库结构、主题配色、脚本插件或桌面布置。',
  help: '卡在哪一步？带上产品版本、设备和报错，大家好接着看。',
  chat: '不限产品，聊聊手头的软件、硬件和日常折腾。',
};

const glyphs: Record<string, React.ReactNode> = {
  note: <NotebookPen />,
  reader: <BookOpen />,
  video: <Video />,
  showcase: <Sparkles />,
  help: <LifeBuoy />,
  chat: <Coffee />,
};

async function api<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json() as Promise<T>;
}

function cleanExcerpt(raw = ''): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractShowcaseImage(raw = ''): string | null {
  const match = /!\[[^\]]*\]\(([^)\s]+)\)/.exec(raw);
  if (!match) return null;
  const src = match[1];
  if (src.startsWith('/api/v1/media/') || src.startsWith('https://')) return src;
  return null;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('zh-CN');
}

function Brand() {
  return (
    <a href="/" className="brand">
      <span className="brand-mark" aria-hidden="true">N</span>
      <span>
        <strong>弄文社区</strong>
        <small>NOWEN</small>
      </span>
    </a>
  );
}

function App() {
  const { member, setMember } = useMember();
  const [authOpen, setAuthOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [myOpen, setMyOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [editing, setEditing] = useState<MyTopic | null>(null);

  async function logout() {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
      setMember(null);
    } catch {
      alert('退出失败，请检查网络后重试');
    }
  }

  const [theme, setTheme] = useState(() => (localStorage.getItem('nowen-community-theme') === 'dark' ? 'dark' : 'light'));
  const [menu, setMenu] = useState(false);
  const [categories, setCategories] = useState<Category[]>(preset);
  const [category, setCategory] = useState(() => new URLSearchParams(location.search).get('category') || 'all');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [resolution, setResolution] = useState<'all' | 'unsolved' | 'solved'>('all');
  const [items, setItems] = useState<Topic[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Topic | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const slug = location.pathname.startsWith('/t/') ? decodeURIComponent(location.pathname.slice(3)) : null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('nowen-community-theme', theme);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#111318' : '#fafaf7';
  }, [theme]);

  useEffect(() => {
    api<{ items: Category[] }>('/api/v1/categories').then(d => setCategories(d.items)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 260);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    if (slug !== null) return;
    let live = true;
    setLoading(true);
    setError('');
    const p = new URLSearchParams({page:'1',sort});
    if (category !== 'all') p.set('category', category);
    if (query) p.set('q', query);
    if (resolution !== 'all') p.set('resolution', resolution);
    api<Feed>('/api/v1/topics?' + p)
      .then(d => {
        if (live) {
          setItems(d.items);
          setNext(d.nextPage);
        }
      })
      .catch(e => {
        if (live) setError(String(e.message));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [category, query, slug, sort, resolution]);

  useEffect(() => {
    if (slug === null) return;
    let live = true;
    setDetailLoading(true);
    setError('');
    api<{ item: Topic }>('/api/v1/topics/' + encodeURIComponent(slug))
      .then(d => {
        if (live) setDetail(d.item);
      })
      .catch(e => {
        if (live) setError(String(e.message));
      })
      .finally(() => {
        if (live) setDetailLoading(false);
      });
    return () => {
      live = false;
    };
  }, [slug]);

  async function more() {
    if (!next || loading) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({page:String(next),sort});
      if (category !== 'all') p.set('category', category);
      if (query) p.set('q', query);
      if (resolution !== 'all') p.set('resolution', resolution);
      const d = await api<Feed>('/api/v1/topics?' + p);
      setItems(s => [...s, ...d.items]);
      setNext(d.nextPage);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function select(id: string) {
    if (slug !== null) {
      location.href = id === 'all' ? '/' : '/?category=' + encodeURIComponent(id);
      return;
    }
    setCategory(id);
    if (id !== 'all' && id !== 'help') setResolution('all');
    setMenu(false);
  }

  function openCompose() {
    setEditing(null);
    if (member) setComposeOpen(true);
    else setAuthOpen(true);
  }

  const active = categories.find(c => c.id === category);
  const activeIdx = category === 'all' ? 0 : Math.max(0, categories.findIndex(c => c.id === category) + 1);
  const rows = items; // sorted and paginated consistently by the server
  const headingTitle = active ? active.name : '弄文社区';
  const headingIntro = boardIntros[category] || active?.description || boardIntros.all;

  if (location.pathname === '/admin') return <AdminPanel />;

  return (
    <div className="app">
      {menu && <button className="scrim" aria-label="关闭导航" onClick={() => setMenu(false)} />}
      <aside className={'sidebar ' + (menu ? 'open' : '')}>
        <Brand />
        <div className="rule" />
        <span className="navlabel">板块</span>
        <nav aria-label="社区板块" style={{ '--active-idx': activeIdx } as React.CSSProperties}>
          <span className="nav-indicator" aria-hidden="true" />
          <button
            className={'navitem ' + (category === 'all' && slug === null ? 'active' : '')}
            onClick={() => select('all')}
          >
            <Compass /> 社区广场
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              className={'navitem ' + (category === c.id && slug === null ? 'active' : '')}
              onClick={() => select(c.id)}
            >
              {glyphs[c.id] || <MessageCircle />}
              {c.name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <section className="invite">
            <div className="invite-head">
              <ShieldCheck />
              <span>开放注册 · 内容先审</span>
            </div>
            <p>注册即可参与讨论，发帖和回复审核通过后公开。</p>
          </section>
          <a
            className="source-link"
            href="https://nowen.cn/"
            target="_blank"
            rel="noopener noreferrer"
          >
            NOWEN 官网 <ArrowRight />
          </a>
          <a
            className="source-link"
            href="https://github.com/cropflre/nowen-community"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github /> GitHub 仓库 <ArrowRight />
          </a>
        </div>
      </aside>

      <div className="area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="small-icon menu-button" aria-label="打开导航" onClick={() => setMenu(true)}>
              <Menu />
            </button>
            <div className="breadcrumb">
              <a href="/">弄文社区</a>
              <ChevronRight />
              <b>{slug !== null ? detail?.categoryName || '帖子详情' : active?.name || '广场'}</b>
            </div>
          </div>
          <div className="top-actions">
            <button
              className="small-icon"
              aria-label="切换明暗主题"
              title="切换深浅色主题"
              onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </button>
            {member && <NotificationTray />}
            {member && (
              <button className="account-shortcut" onClick={() => setMyOpen(true)}>
                我的帖子
              </button>
            )}
            {member && (
              <button className="account-shortcut" onClick={() => setBookmarksOpen(true)}>
                我的收藏
              </button>
            )}
            {(member?.role === 'admin' || member?.role === 'moderator') && (
              <a className="admin-link" href="/admin">
                审核中心
              </a>
            )}
            <button className="login" onClick={() => (member ? setAccountOpen(true) : setAuthOpen(true))}>
              {member ? member.displayName + ' · 账号' : '登录 / 注册'}
            </button>
          </div>
        </header>

        <main className="content">
          {slug === null ? (
            <>
              <section className="board-header">
                <div className="board-header-copy">
                  <h1>{headingTitle}</h1>
                  <p>{headingIntro}</p>
                </div>
                <button className="compose-btn" onClick={openCompose}>
                  <PenLine /> 发帖
                </button>
              </section>

              <div className="mobile-board-bar" aria-label="快速切换板块">
                <button
                  type="button"
                  className={'mobile-board-chip ' + (category === 'all' ? 'active' : '')}
                  onClick={() => select('all')}
                >
                  全部
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className={'mobile-board-chip ' + (category === c.id ? 'active' : '')}
                    onClick={() => select(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="filters">
                <div className="filter-groups">
                  <div className="tabs" role="group" aria-label="排序方式">
                    <button className={sort === 'latest' ? 'selected' : ''} onClick={() => setSort('latest')}>
                      最新
                    </button>
                    <button className={sort === 'popular' ? 'selected' : ''} onClick={() => setSort('popular')}>
                      回复最多
                    </button>
                  </div>
                  {(category === 'all' || category === 'help') && (
                    <>
                      <span className="filter-divider" aria-hidden="true" />
                      <div className="tabs" role="group" aria-label="解决状态筛选">
                        <button
                          className={resolution === 'all' ? 'selected' : ''}
                          onClick={() => setResolution('all')}
                        >
                          全部
                        </button>
                        <button
                          className={resolution === 'unsolved' ? 'selected' : ''}
                          onClick={() => setResolution('unsolved')}
                        >
                          待解决
                        </button>
                        <button
                          className={resolution === 'solved' ? 'selected' : ''}
                          onClick={() => setResolution('solved')}
                        >
                          已解决
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <label className="search">
                  <Search />
                  <input
                    aria-label="搜索社区讨论"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="搜产品名或报错关键词…"
                  />
                  {input && (
                    <button type="button" aria-label="清空搜索" onClick={() => setInput('')}>
                      <X />
                    </button>
                  )}
                </label>
              </div>

              {error ? (
                <div className="empty">
                  <LifeBuoy />
                  <h3>暂时连不上社区</h3>
                  <p>{error} · 请刷新重试，或检查本地 D1 服务是否已启动。</p>
                  <div className="empty-actions">
                    <button className="retry" onClick={() => location.reload()}>
                      重新加载
                    </button>
                  </div>
                </div>
              ) : loading && !items.length ? (
                <div className="empty">
                  <div className="spinner" />
                  <p>正在加载最新帖子…</p>
                </div>
              ) : rows.length ? (
                <>
                  <div className="topic-list">
                    {rows.map(t => {
                      const summary = cleanExcerpt(t.excerpt);
                      const thumb = t.categoryId === 'showcase' ? extractShowcaseImage(t.excerpt) : null;
                      return (
                        <a
                          className={'topic-row' + (t.categoryId === 'help' ? ' is-help' : '')}
                          key={t.id}
                          href={'/t/' + encodeURIComponent(t.slug)}
                        >
                          <span className="topic-copy">
                            <span className="topic-title-line">
                              {t.pinned && <i className="pinned">置顶</i>}
                              {t.solvedAt != null && <i className="solved-tag">已解决</i>}
                              {t.categoryId === 'help' && t.solvedAt == null && <i className="open-tag">待解决</i>}
                              <strong>{t.title}</strong>
                            </span>
                            {thumb && (
                              <img className="topic-showcase-thumb" src={thumb} alt={t.title} loading="lazy" />
                            )}
                            {summary && <p>{summary}</p>}
                            <span className="topic-meta">
                              <span className="topic-board">{t.categoryName}</span>
                              <span>{t.authorName}</span>
                              <span>{formatDate(t.createdAt)}</span>
                            </span>
                          </span>
                          <span className="replies" aria-label={`${t.replyCount} 条回复`}>
                            <MessageCircle />
                            {t.replyCount}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                  {next && (
                    <button onClick={more} disabled={loading} className="more">
                      加载更多 <ArrowRight />
                    </button>
                  )}
                </>
              ) : (
                <div className="empty">
                  <MessageCircle />
                  <h3>
                    {query
                      ? '没搜到相关帖子'
                      : resolution === 'unsolved'
                        ? '当前没有待解决的问题'
                        : resolution === 'solved'
                          ? '还没有已解决的问题'
                          : '这个板块还没有帖子'}
                  </h3>
                  <p>
                    {query
                      ? '没搜到。试试产品名，或者把报错里最特别的几个字贴进来。'
                      : category === 'help'
                        ? '卡在哪一步？带上产品版本、设备和报错，大家好接着看。'
                        : '注册登录后就能发第一篇，审核通过后会在这里展示。'}
                  </p>
                  <div className="empty-actions">
                    {query && (
                      <button className="retry" onClick={() => setInput('')}>
                        清空搜索
                      </button>
                    )}
                    {!query && (
                      <button className="compose-btn" onClick={openCompose}>
                        <PenLine /> 发帖
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <a className="back" href="/">
                ← 返回社区广场
              </a>
              <article className="detail">
                {detailLoading ? (
                  <div className="empty">
                    <div className="spinner" />
                    <p>正在打开帖子…</p>
                  </div>
                ) : error ? (
                  <div className="empty">
                    <h3>打不开这篇帖子</h3>
                    <p>{error} · 可能已被删除或还在审核中。</p>
                    <div className="empty-actions">
                      <a className="retry" href="/">
                        回广场看看
                      </a>
                    </div>
                  </div>
                ) : detail ? (
                  <>
                    <div className="detail-meta-top">
                      <a className="detail-board-link" href={'/?category=' + encodeURIComponent(detail.categoryId)}>
                        {detail.categoryName}
                      </a>
                      <span>·</span>
                      <span>{formatDate(detail.createdAt)}</span>
                      {detail.solvedAt != null && <span className="solved-pill">✓ 已解决</span>}
                      {detail.categoryId === 'help' && detail.solvedAt == null && (
                        <span className="open-pill">待解决</span>
                      )}
                    </div>
                    <h1>{detail.title}</h1>
                    <div className="author">
                      <span>{detail.authorName}</span>
                      <span>·</span>
                      <span>{detail.replyCount} 条回复</span>
                    </div>
                    <div className="markdown-body article-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{detail.content}</ReactMarkdown>
                    </div>
                    <TopicEngagement
                      id={detail.id}
                      slug={detail.slug}
                      member={member}
                      onLogin={() => setAuthOpen(true)}
                      viewer={detail.viewer ?? null}
                      authorId={detail.authorId ?? ''}
                      categoryId={detail.categoryId}
                      solvedAt={detail.solvedAt ?? null}
                      bestReplyId={detail.bestReplyId ?? null}
                    />
                  </>
                ) : (
                  <div className="empty">
                    <h3>没找到这篇帖子</h3>
                    <p>链接可能有误，或这篇内容尚未公开。</p>
                  </div>
                )}
              </article>
            </>
          )}

          <footer>
            <span>弄文社区 · NOWEN 开源项目交流区</span>
            <span>
              <a href="https://nowen.cn/" target="_blank" rel="noopener noreferrer">
                nowen.cn
              </a>{' '}
              ·{' '}
              <a href="https://github.com/cropflre" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </span>
          </footer>
        </main>
      </div>

      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onAuthenticated={setMember} />}
      {accountOpen && member && (
        <AccountDialog
          member={member}
          onClose={() => setAccountOpen(false)}
          onUpdated={setMember}
          onLogout={() => {
            setAccountOpen(false);
            logout();
          }}
        />
      )}
      {myOpen && member && (
        <MyTopicsDialog
          onClose={() => setMyOpen(false)}
          onEdit={item => {
            setEditing(item);
            setMyOpen(false);
            setComposeOpen(true);
          }}
        />
      )}
      {bookmarksOpen && member && <BookmarksDialog onClose={() => setBookmarksOpen(false)} />}
      {composeOpen && member && (
        <ComposerDialog
          member={member}
          categories={categories}
          defaultCategory={category !== 'all' ? category : undefined}
          initialDraft={editing}
          onClose={() => {
            setComposeOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
