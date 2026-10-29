import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowRight,BookOpen,ChevronRight,Coffee,Compass,Github,Heart,LifeBuoy,Menu,MessageCircle,Moon,NotebookPen,Search,ShieldCheck,Sparkles,Sun,Video,X} from 'lucide-react';
import './styles.css';
import {AuthDialog,ComposerDialog,TopicEngagement,useMember} from './member';
import {AdminPanel} from './admin';
import {NotificationTray} from './notifications';

type Category={id:string;name:string;description:string;icon:string};
type Topic={id:string;slug:string;title:string;excerpt:string;content?:string;categoryId:string;categoryName:string;authorName:string;replyCount:number;createdAt:number;pinned:boolean};
type Feed={items:Topic[];nextPage:number|null};
const preset:Category[]=[
{id:'note',name:'弄文笔记',description:'写作、同步与插件',icon:'note'},
{id:'reader',name:'弄文阅读',description:'私人书库与阅读',icon:'reader'},
{id:'video',name:'弄文视频',description:'媒体库与字幕',icon:'video'},
{id:'showcase',name:'作品展示',description:'分享你的创作',icon:'showcase'},
{id:'help',name:'问题求助',description:'一起找到答案',icon:'help'},
{id:'chat',name:'茶话会',description:'技术与生活',icon:'chat'}];
const glyphs:Record<string,React.ReactNode>={note:<NotebookPen/>,reader:<BookOpen/>,video:<Video/>,showcase:<Sparkles/>,help:<LifeBuoy/>,chat:<Coffee/>};
async function api<T>(path:string):Promise<T>{const r=await fetch(path,{headers:{Accept:'application/json'},credentials:'same-origin'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json() as Promise<T>;}
function Brand(){return <a href="/" className="brand"><span className="brand-mark">N</span><span><strong>弄文社区</strong><small>NOWEN COMMUNITY</small></span></a>;}
function App(){
 const {member,setMember}=useMember();
 const [authOpen,setAuthOpen]=useState(false);
 const [composeOpen,setComposeOpen]=useState(false);
 async function logout(){try{await fetch('/api/v1/auth/logout',{method:'POST',credentials:'same-origin'});setMember(null);}catch{alert('退出失败，请重试');}}
 const [theme,setTheme]=useState(()=>localStorage.getItem('nowen-community-theme')==='dark'?'dark':'light');
 const [menu,setMenu]=useState(false);
 const [categories,setCategories]=useState<Category[]>(preset);
 const [category,setCategory]=useState(()=>new URLSearchParams(location.search).get('category')||'all');
 const [input,setInput]=useState('');
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState<'latest'|'popular'>('latest');
 const [items,setItems]=useState<Topic[]>([]);
 const [next,setNext]=useState<number|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [detail,setDetail]=useState<Topic|null>(null);
 const [detailLoading,setDetailLoading]=useState(false);
 const slug=location.pathname.startsWith('/t/')?decodeURIComponent(location.pathname.slice(3)):null;
 useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('nowen-community-theme',theme);},[theme]);
 useEffect(()=>{api<{items:Category[]}>('/api/v1/categories').then(d=>setCategories(d.items)).catch(()=>{});},[]);
 useEffect(()=>{const t=setTimeout(()=>setQuery(input.trim()),260);return ()=>clearTimeout(t);},[input]);
 useEffect(()=>{
  if(slug!==null)return;
  let live=true;setLoading(true);setError('');
  const p=new URLSearchParams({page:'1'});if(category!=='all')p.set('category',category);if(query)p.set('q',query);
  api<Feed>('/api/v1/topics?'+p).then(d=>{if(live){setItems(d.items);setNext(d.nextPage);}}).catch(e=>{if(live)setError(String(e.message));}).finally(()=>{if(live)setLoading(false);});
  return ()=>{live=false;};
 },[category,query,slug]);
 useEffect(()=>{
  if(slug===null)return;let live=true;setDetailLoading(true);setError('');
  api<{item:Topic}>('/api/v1/topics/'+encodeURIComponent(slug)).then(d=>{if(live)setDetail(d.item);}).catch(e=>{if(live)setError(String(e.message));}).finally(()=>{if(live)setDetailLoading(false);});
  return ()=>{live=false;};
 },[slug]);
 async function more(){
  if(!next||loading)return;setLoading(true);try{const p=new URLSearchParams({page:String(next)});if(category!=='all')p.set('category',category);if(query)p.set('q',query);const d=await api<Feed>('/api/v1/topics?'+p);setItems(s=>[...s,...d.items]);setNext(d.nextPage);}catch(e){setError(String(e));}finally{setLoading(false);}
 }
 function select(id:string){if(slug!==null){location.href=id==='all'?'/':'/?category='+encodeURIComponent(id);return;}setCategory(id);setMenu(false);}
 const active=categories.find(c=>c.id===category);
 const rows=sort==='popular'?[...items].sort((a,b)=>b.replyCount-a.replyCount):items;
 if(location.pathname==='/admin')return <AdminPanel/>;
 return <div className="app">
  {menu&&<button className="scrim" aria-label="关闭导航" onClick={()=>setMenu(false)}/>}
  <aside className={'sidebar '+(menu?'open':'')}>
   <Brand/><div className="rule"/><span className="navlabel">探索社区</span>
   <nav aria-label="社区板块">
    <button className={'navitem '+(category==='all'?'active':'')} onClick={()=>select('all')}><Compass/> 社区广场 <ChevronRight className="chevron"/></button>
    {categories.map(c=><button key={c.id} className={'navitem '+(category===c.id?'active':'')} onClick={()=>select(c.id)}>{glyphs[c.id]||<MessageCircle/>}{c.name}<ChevronRight className="chevron"/></button>)}
   </nav>
   <div className="sidebar-bottom">
    <section className="invite"><ShieldCheck/><strong>开放注册 · 内容先审</strong><p>无需邀请码，注册后即可参与讨论；发帖与回复审核通过后展示。</p><small>OPEN REGISTRATION · 审核后公开</small></section>
    <a className="source-link" href="https://github.com/cropflre/nowen-community" target="_blank" rel="noopener noreferrer"><Github/> 参与开源建设 <ArrowRight/></a>
   </div>
  </aside>
  <div className="area">
   <header className="topbar">
    <button className="small-icon menu-button" aria-label="打开导航" onClick={()=>setMenu(true)}><Menu/></button>
    <div className="breadcrumb">NOWEN <ChevronRight/><b>{slug!==null?'主题讨论':active?.name||'社区广场'}</b></div>
    <div className="top-actions"><span className="beta"><i/> PRIVATE BETA</span><button className="small-icon" aria-label="切换明暗主题" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun/>:<Moon/>}</button>{member&&<NotificationTray/>}{(member?.role==='admin'||member?.role==='moderator')&&<a className="admin-link" href="/admin">审核中心</a>}<button className="login" onClick={()=>member?logout():setAuthOpen(true)}>{member?member.displayName+' · 退出':'登录 / 注册'} <ArrowRight/></button></div>
   </header>
   <main className="content">
    {slug===null?<>
     <section className="hero"><div className="hero-copy"><div className="eyebrow">WELCOME TO NOWEN COMMUNITY</div><h1>好的想法，<br/><em>从交流开始。</em></h1><p>与热爱创造的人一起分享经验、探索开源、解决问题。这里是弄文产品与创作者的共同空间。</p><div className="hero-actions"><button onClick={()=>member?setComposeOpen(true):setAuthOpen(true)}>开启一个话题 <ArrowRight/></button><a href="https://github.com/cropflre/nowen-note" target="_blank" rel="noopener noreferrer">了解 NOWEN <ArrowRight/></a></div></div><div className="hero-art" aria-hidden="true"><span className="orbit one"/><span className="orbit two"/><span className="orbit three"/><b>N</b></div></section>
     <div className="columns"><section className="primary">
       <div className="section-heading"><small>THE DISCUSSIONS</small><h2>{active?.name||'最新讨论'} <span>/ COMMUNITY</span></h2></div>
       <div className="panel"><div className="filters"><div className="tabs"><button className={sort==='latest'?'selected':''} onClick={()=>setSort('latest')}>最新发布</button><button className={sort==='popular'?'selected':''} onClick={()=>setSort('popular')}>回复最多</button></div><label className="search"><Search/><input aria-label="搜索社区讨论" value={input} onChange={e=>setInput(e.target.value)} placeholder="搜索社区讨论..."/>{input&&<button aria-label="清空搜索" onClick={()=>setInput('')}><X/></button>}</label></div>
        {error?<div className="empty"><LifeBuoy/><h3>暂时无法获取讨论</h3><p>{error} · 请确认 D1 数据库已初始化。</p><button className="retry" onClick={()=>location.reload()}>重新加载</button></div>:
         loading&&!items.length?<div className="empty"><div className="spinner"/><h3>正在连接社区</h3><p>获取最新讨论中…</p></div>:
         rows.length?<><div>{rows.map(t=><a className="topic-row" key={t.id} href={'/t/'+encodeURIComponent(t.slug)}><span className="avatar">{t.authorName.slice(0,1)}</span><span className="topic-copy"><strong>{t.pinned&&<i className="pinned">置顶</i>}{t.title}</strong><p>{t.excerpt}</p><small>{t.categoryName} · {t.authorName} · {new Date(t.createdAt*1000).toLocaleDateString('zh-CN')}</small></span><span className="replies"><MessageCircle/>{t.replyCount}</span></a>)}</div>{next&&<button onClick={more} disabled={loading} className="more">加载更多 <ArrowRight/></button>}</>:
         <div className="empty"><div className="empty-symbol"><MessageCircle/></div><h3>{query?'没有找到匹配的讨论':'这里，等待第一个好话题'}</h3><p>{query?'试试其他关键词或板块。':'社区已开放账号注册。登录后可发布话题并提交审核。'}</p>{query&&<button className="retry" onClick={()=>setInput('')}>清除搜索</button>}</div>}
       </div>
      </section><aside className="rail"><section className="rail-card"><h3><Sparkles/> 关于社区</h3><p>一群热爱开源、知识和创造的人，共同构建更自由的数字生活。</p><small>OPEN SOURCE. OPEN IDEAS.</small></section><section className="rail-card"><h3><Compass/> 探索板块</h3>{categories.slice(0,5).map(c=><button className="rail-category" key={c.id} onClick={()=>select(c.id)}>{glyphs[c.id]}<span>{c.name}</span><ChevronRight/></button>)}</section><div className="footnote">用代码连接想法，以开放赋予自由。<br/>Built with Cloudflare & open source.</div></aside></div>
    </>:<>
      <a className="back" href="/">← 返回社区广场</a>
      <article className="detail">{detailLoading?<div className="spinner"/>:error?<><h2>主题暂不可用</h2><p>{error}</p></>:detail?<><small>{detail.categoryName} · {new Date(detail.createdAt*1000).toLocaleDateString('zh-CN')}</small><h1>{detail.title}</h1><div className="author">由 {detail.authorName} 分享 · {detail.replyCount} 条回复</div><div className="article-body">{detail.content}</div><TopicEngagement id={detail.id} slug={detail.slug} member={member} onLogin={()=>setAuthOpen(true)}/></>:<h2>主题不存在</h2>}</article>
    </>}
    <footer>© 2026 NOWEN COMMUNITY · 为创造者而建 <span>开放 · 自由 · 连接</span></footer>
   </main>
  </div>
  {authOpen&&<AuthDialog onClose={()=>setAuthOpen(false)} onAuthenticated={setMember}/>}
  {composeOpen&&member&&<ComposerDialog member={member} categories={categories} onClose={()=>setComposeOpen(false)}/>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
