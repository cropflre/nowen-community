import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { TurnstileField } from './turnstile';
import { friendlyError } from './errors';
import remarkGfm from 'remark-gfm';

type Member = { id: string; username: string; displayName: string; role: string };
type Category = { id: string; name: string };
export type MyTopic = {
  id: string;
  slug: string;
  title: string;
  content: string;
  categoryId: string;
  status: 'draft' | 'pending' | 'published' | 'hidden';
  updatedAt: number;
};

const request = async <T,>(path: string, method = 'GET', body?: unknown, requestKey?: string): Promise<T> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (requestKey) headers['Idempotency-Key'] = requestKey;
  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = (await response.json().catch(() => ({ error: 'NETWORK_ERROR' }))) as Record<string, unknown>;
  if (!response.ok) throw new Error(friendlyError(String(value.error || 'HTTP ' + response.status)));
  return value as T;
};

export function useMember() {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    request<{ user: Member | null }>('/api/v1/me')
      .then(d => {
        if (live) setMember(d.user);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  return { member, setMember, loading };
}

export function AuthDialog({
  onClose,
  onAuthenticated,
}: {
  onClose: () => void;
  onAuthenticated: (member: Member) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [revision, setRevision] = useState(0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await request<{ user: Member }>(
        '/api/v1/auth/' + (mode === 'login' ? 'login' : 'register'),
        'POST',
        mode === 'login'
          ? { username, password, turnstileToken: token }
          : { username, displayName, password, turnstileToken: token },
      );
      onAuthenticated(result.user);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败，请稍后重试');
      setRevision(x => x + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="member-dialog">
        <button className="member-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <h2 id="auth-title">{mode === 'login' ? '登录弄文社区' : '注册社区账号'}</h2>
        <p>开放注册，登录后即可发帖、回复和收藏；发帖与回复审核通过后公开。</p>
        <div className="auth-switch">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            免费注册
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            用户名
            <input
              required
              autoComplete="username"
              maxLength={24}
              minLength={3}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="英文字母、数字或下划线"
            />
          </label>
          {mode === 'register' && (
            <label>
              昵称
              <input
                required
                maxLength={32}
                minLength={2}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="在社区展示的名称"
              />
            </label>
          )}
          <label>
            密码
            <input
              required
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode==='login'?1:6}
              maxLength={128}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'login' ? '输入密码' : '至少 6 位密码'}
            />
          </label>
          <TurnstileField revision={revision} onToken={setToken} />
          {error && (
            <p className="member-error" role="alert">
              {error}
            </p>
          )}
          <button className="member-primary" disabled={busy} type="submit">
            {busy ? '正在处理…' : mode === 'login' ? '登录' : '创建账号'}
          </button>
        </form>
      </section>
    </div>
  );
}

const draftKey = (id: string) => 'nowen-community-draft:' + id;
const statusText: Record<MyTopic['status'], string> = {
  draft: '草稿',
  pending: '等待审核',
  published: '已发布',
  hidden: '未通过审核',
};

export function MyTopicsDialog({ onClose, onEdit }: { onClose: () => void; onEdit: (item: MyTopic) => void }) {
  const [items, setItems] = useState<MyTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await request<{ items: MyTopic[] }>('/api/v1/me/topics');
      setItems(data.items);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function remove(item: MyTopic) {
    if (!window.confirm('确定删除这篇草稿吗？删除后无法恢复。')) return;
    try {
      await request('/api/v1/me/topics/' + encodeURIComponent(item.id), 'DELETE');
      setItems(rows => rows.filter(x => x.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败，请重试');
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="member-dialog my-topics" role="dialog" aria-modal="true" aria-labelledby="my-topics-heading">
        <button className="member-close" aria-label="关闭" onClick={onClose}>
          ×
        </button>
        <h2 id="my-topics-heading">我的帖子</h2>
        <p>查看你的草稿、审核进度和已公开的帖子。</p>
        {error && (
          <p className="member-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="member-note">正在读取帖子…</p>
        ) : items.length === 0 ? (
          <p className="member-note">还没有帖子。回到广场点「发帖」就能开始写。</p>
        ) : (
          <div className="my-topic-list">
            {items.map(item => (
              <article className="my-topic" key={item.id}>
                <div>
                  <strong>{item.title || '未命名草稿'}</strong>
                  <small>
                    {statusText[item.status]} · {new Date(item.updatedAt * 1000).toLocaleString('zh-CN')}
                  </small>
                </div>
                <div className="my-topic-actions">
                  {item.status === 'draft' ? (
                    <>
                      <button onClick={() => onEdit(item)}>继续编辑</button>
                      <button className="danger-text" onClick={() => remove(item)}>
                        删除草稿
                      </button>
                    </>
                  ) : item.status === 'published' ? (
                    <a href={'/t/' + encodeURIComponent(item.slug)}>查看帖子</a>
                  ) : (
                    <small>{item.status === 'pending' ? '等待审核，通过后公开' : '未公开，如有疑问可联系管理员'}</small>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function ComposerDialog({
  member,
  categories,
  defaultCategory,
  onClose,
  initialDraft,
}: {
  member: Member;
  categories: Category[];
  defaultCategory?: string;
  onClose: () => void;
  initialDraft?: MyTopic | null;
}) {
  const stored =
    initialDraft ??
    (() => {
      try {
        const v = localStorage.getItem(draftKey(member.id));
        return v
          ? (JSON.parse(v) as { id?: string; key?: string; title?: string; content?: string; categoryId?: string })
          : null;
      } catch {
        return null;
      }
    })();

  const [title, setTitle] = useState(stored?.title || '');
  const [content, setContent] = useState(stored?.content || '');
  const [categoryId, setCategoryId] = useState(stored?.categoryId || defaultCategory || categories[0]?.id || '');
  const [id, setId] = useState(stored?.id || '');
  const [key] = useState((stored && 'key' in stored ? stored.key : undefined) || crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(false);
  const [token, setToken] = useState('');
  const [revision, setRevision] = useState(0);
  const [uploaded, setUploaded] = useState<string[]>([]);

  const productTemplates = [
    {
      name: 'Bug 反馈',
      content: '## 问题描述\n\n## 产品版本 / 设备 / 系统\n\n## 复现步骤\n1. \n2. \n\n## 预期结果与实际结果\n',
    },
    {
      name: '功能建议',
      content: '## 想解决什么问题\n\n## 希望如何使用\n\n## 参考截图或链接\n',
    },
    {
      name: '使用交流',
      content: '## 交流主题\n\n## 已尝试的方式\n\n## 希望大家讨论\n',
    },
  ];

  const [uploading, setUploading] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const serverId = useRef(stored?.id || '');
  const queue = useRef<Promise<string>>(Promise.resolve(serverId.current));
  const completed = useRef(false);

  useEffect(() => {
    if (!completed.current) {
      localStorage.setItem(draftKey(member.id), JSON.stringify({ id, key, title, content, categoryId }));
    }
  }, [member.id, id, key, title, content, categoryId]);

  // Serialize all writes: a slow autosave cannot overwrite a newer submit or edit.
  function persist() {
    const snapshot = { title, content, categoryId };
    if (!snapshot.categoryId) return Promise.resolve('');
    setSaving(true);
    const next = queue.current
      .catch(() => serverId.current)
      .then(async () => {
        if (!serverId.current) {
          const result = await request<{ item: { id: string } }>('/api/v1/topics', 'POST', snapshot, key);
          serverId.current = result.item.id;
          setId(result.item.id);
        } else {
          await request('/api/v1/topics/' + encodeURIComponent(serverId.current), 'PUT', snapshot);
        }
        return serverId.current;
      });
    queue.current = next;
    return next.finally(() => {
      if (queue.current === next) setSaving(false);
    });
  }

  useEffect(() => {
    if (!categoryId || completed.current) return;
    if (!title.trim() && !content.trim()) return;
    const timer = setTimeout(() => {
      persist()
        .then(() => setMessage('草稿已保存'))
        .catch(() => setMessage('自动保存失败，请检查网络'));
    }, 900);
    return () => clearTimeout(timer);
  }, [title, content, categoryId, id]);

  function insertMarkdown(before: string, after = '') {
    const el = textarea.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const selection = content.slice(start, end);
    setContent(value => value.slice(0, start) + before + selection + after + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + before.length, start + before.length + selection.length);
    });
  }

  async function submit() {
    if (title.trim().length < 5 || content.trim().length < 10) {
      setMessage('标题至少 5 个字，正文至少 10 个字');
      return;
    }
    setBusy(true);
    try {
      const current = await persist();
      if (!current) return;
      await request('/api/v1/topics/' + encodeURIComponent(current) + '/submit', 'POST', { turnstileToken: token });
      completed.current = true;
      localStorage.removeItem(draftKey(member.id));
      setMessage('已提交，等待审核');
      setTimeout(onClose, 1300);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '提交失败，请重试');
      setRevision(x => x + 1);
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setMessage('图片上传中…');
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('图片超过 2 MB，请压缩后再试');
      const result = await fetch('/api/v1/uploads', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': file.type, 'X-Turnstile-Token': token },
        body: file,
      });
      const data = (await result.json()) as { id?: string; error?: string };
      if (!result.ok || !data.id) throw new Error(friendlyError(data.error || '上传失败'));
      const img = '![图片](/api/v1/media/' + encodeURIComponent(data.id) + ')';
      setContent(old => old + (old.endsWith('\n') || old.length === 0 ? '\n' : '\n\n') + img + '\n');
      setUploaded(old => [...old, data.id!]);
      setMessage('图片已插入正文，审核通过后其他用户可见');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '图片上传失败，请重试');
    } finally {
      setUploading(false);
      setRevision(x => x + 1);
    }
  }

  const isHelp = categoryId === 'help';

  return (
    <div className="modal-backdrop" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="compose-title" className="member-dialog composer">
        <button className="member-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <h2 id="compose-title">发帖</h2>
        <p>支持 Markdown 与图片上传，输入停止后会自动保存草稿。</p>
        <label>
          板块
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            {categories.map(x => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        {isHelp && (
          <div className="composer-hint">卡在哪一步？带上产品版本、设备和报错，大家好接着看。</div>
        )}
        <label>
          标题
          <input
            maxLength={160}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={isHelp ? '一句话说清遇到了什么问题（至少 5 字）' : '用一句话描述你想讨论的事情'}
          />
        </label>
        {['note', 'reader', 'video', 'help'].includes(categoryId) && (
          <div className="feedback-templates">
            <small>套个模板：</small>
            {productTemplates.map(t => (
              <button
                key={t.name}
                type="button"
                onClick={() => setContent(old => (old.trim() ? old + '\n\n' + t.content : t.content))}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
        <label htmlFor="community-editor">正文</label>
        <div className="editor-toolbar" aria-label="Markdown 工具栏">
          <button type="button" onClick={() => insertMarkdown('**', '**')}>
            加粗
          </button>
          <button type="button" onClick={() => insertMarkdown('*', '*')}>
            斜体
          </button>
          <button type="button" onClick={() => insertMarkdown('- ')}>
            列表
          </button>
          <button type="button" onClick={() => insertMarkdown('\n```\n', '\n```\n')}>
            代码块
          </button>
          <button type="button" onClick={() => insertMarkdown('[文字](', ')')}>
            链接
          </button>
        </div>
        <textarea
          id="community-editor"
          aria-label="正文"
          ref={textarea}
          rows={9}
          maxLength={12000}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={
            isHelp
              ? '卡在哪一步？带上产品版本、设备和报错，大家好接着看。'
              : '分享你的想法，支持 Markdown 语法…'
          }
        />
        <label className="upload-field">
          上传图片（PNG / JPG / WebP，2 MB 内，自动插入正文）
          <input
            type="file"
            disabled={uploading}
            accept="image/png,image/jpeg,image/webp"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file);
              e.target.value = '';
            }}
          />
        </label>
        {uploaded.length > 0 && (
          <p className="member-note">已插入 {uploaded.length} 张图片，审核通过后其他用户可见。</p>
        )}
        <div className="compose-preview">
          <button type="button" onClick={() => setPreview(!preview)}>
            {preview ? '返回编辑' : '预览效果'}
          </button>
          {preview && (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
        <TurnstileField revision={revision} onToken={setToken} />
        <div className="composer-bottom">
          <div className="composer-bottom-meta">
            <small role="status">{saving ? '保存中…' : message || '停止输入后会自动保存草稿'}</small>
            <span className="review-note">发帖需审核，通过后公开展示</span>
          </div>
          <button className="member-primary" onClick={submit} disabled={busy || saving}>
            {busy ? '提交中…' : '发帖'}
          </button>
        </div>
      </section>
    </div>
  );
}

export function TopicEngagement({
  id,
  slug,
  member,
  onLogin,
  viewer,
  authorId,
  categoryId,
  solvedAt,
  bestReplyId,
}: {
  id: string;
  slug: string;
  member: Member | null;
  onLogin: () => void;
  viewer: { liked: boolean; bookmarked: boolean } | null;
  authorId: string;
  categoryId: string;
  solvedAt: number | null;
  bestReplyId: string | null;
}) {
  type Reply = { id: string; content: string; status: string; author: string; createdAt: number };
  const [replies, setReplies] = useState<Reply[]>([]);
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [liked, setLiked] = useState(Boolean(viewer?.liked));
  const [bookmarked, setBookmarked] = useState(Boolean(viewer?.bookmarked));
  const [token, setToken] = useState('');
  const [revision, setRevision] = useState(0);
  const [reportReason, setReportReason] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [bestId, setBestId] = useState<string | null>(bestReplyId);
  const [resolvedAt, setResolvedAt] = useState<number | null>(solvedAt);
  const [accepting, setAccepting] = useState(false);

  // One in-flight request per engagement type: rapid double clicks cannot desync the UI state.
  const pending = useRef<Record<string, boolean>>({});

  useEffect(() => {
    request<{ items: Reply[] }>('/api/v1/topics/' + encodeURIComponent(slug) + '/replies')
      .then(d => setReplies(d.items))
      .catch(() => {});
  }, [slug, member?.id]);

  async function reply() {
    if (!member) {
      onLogin();
      return;
    }
    setBusy(true);
    try {
      await request<{ item: { status: string } }>(
        '/api/v1/topics/' + encodeURIComponent(slug) + '/replies',
        'POST',
        { content, turnstileToken: token },
        crypto.randomUUID(),
      );
      setContent('');
      setMessage('已提交，等待审核');
      const d = await request<{ items: Reply[] }>('/api/v1/topics/' + encodeURIComponent(slug) + '/replies');
      setReplies(d.items);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '回复提交失败，请重试');
    } finally {
      setBusy(false);
      setRevision(x => x + 1);
    }
  }

  async function reaction(type: 'like' | 'bookmark', active: boolean) {
    if (!member) {
      onLogin();
      return;
    }
    if (pending.current[type]) return;
    pending.current[type] = true;
    try {
      await request('/api/v1/topics/' + encodeURIComponent(id) + '/' + type, active ? 'DELETE' : 'POST');
      if (type === 'like') setLiked(!active);
      else setBookmarked(!active);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '操作失败，请重试');
    } finally {
      pending.current[type] = false;
    }
  }

  async function report() {
    if (!member) {
      onLogin();
      return;
    }
    try {
      await request('/api/v1/reports', 'POST', { type: 'topic', targetId: id, reason: reportReason });
      setReportOpen(false);
      setReportReason('');
      setMessage('举报已提交，管理员会尽快核查');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '举报提交失败，请重试');
    }
  }

  const isQuestion = categoryId === 'help';
  const canAccept = Boolean(member && isQuestion && (member.id === authorId || ['admin', 'moderator'].includes(member.role)));

  async function accept(replyId: string | null) {
    if (!member) {
      onLogin();
      return;
    }
    if (accepting) return;
    setAccepting(true);
    try {
      const result = await request<{ item: { bestReplyId: string | null; solvedAt: number | null } }>(
        '/api/v1/topics/' + encodeURIComponent(id) + '/best-answer',
        'POST',
        { replyId },
      );
      setBestId(result.item.bestReplyId);
      setResolvedAt(result.item.solvedAt);
      setMessage(replyId ? '已采纳为最佳答案，问题已标为已解决' : '已取消采纳，问题重新标为待解决');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '操作失败，请重试');
    } finally {
      setAccepting(false);
    }
  }

  const best = replies.find(r => r.id === bestId && r.status === 'published') ?? null;
  const others = replies.filter(r => r.id !== bestId);

  return (
    <div className="engagement">
      <div className="engagement-actions">
        <button className={liked ? 'is-active' : ''} disabled={pending.current.like} onClick={() => reaction('like', liked)}>
          {liked ? '♥ 已点赞' : '♡ 点赞'}
        </button>
        <button
          className={bookmarked ? 'is-active' : ''}
          disabled={pending.current.bookmark}
          onClick={() => reaction('bookmark', bookmarked)}
        >
          {bookmarked ? '★ 已收藏' : '☆ 收藏'}
        </button>
        <button onClick={() => setReportOpen(x => !x)}>举报</button>
        {isQuestion && resolvedAt != null && <span className="solved-pill">✓ 已解决</span>}
        {isQuestion && resolvedAt == null && <span className="open-pill">待解决</span>}
      </div>

      {reportOpen && (
        <div className="report-box">
          <textarea
            aria-label="举报原因"
            rows={3}
            maxLength={500}
            placeholder="说明举报原因（至少 6 个字），管理员会核查处理"
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
          />
          <button disabled={reportReason.trim().length < 6} onClick={report}>
            提交举报
          </button>
        </div>
      )}

      <div className="engagement-heading">
        <h3>回复</h3>
        <span>{replies.length > 0 ? `共 ${replies.length} 条可见回复` : '暂时还没有回复'}</span>
      </div>

      {best && (
        <div className="reply best-reply">
          <div className="best-reply-head">
            <span className="best-answer-badge">✓ 最佳答案</span>
            {canAccept && (
              <button className="accept-button" disabled={accepting} onClick={() => accept(null)}>
                取消采纳
              </button>
            )}
          </div>
          <b className="best-reply-author">{best.author}</b>
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{best.content}</ReactMarkdown>
          </div>
        </div>
      )}

      {others.length ? (
        others.map(r => (
          <div className="reply" key={r.id}>
            <div className="reply-head">
              <b>{r.author}</b>
              <small className="reply-time">{new Date(r.createdAt * 1000).toLocaleDateString('zh-CN')}</small>
              {r.status !== 'published' && <small>等待审核</small>}
              {canAccept && r.status === 'published' && (
                <button className="accept-button" disabled={accepting} onClick={() => accept(r.id)}>
                  采纳为最佳答案
                </button>
              )}
            </div>
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.content}</ReactMarkdown>
            </div>
          </div>
        ))
      ) : (
        !best && (
          <p className="reply-empty">
            {isQuestion ? '你也遇到过？说说你用的版本，或贴个试过的办法。' : '还没有公开回复，来聊聊你的想法吧。'}
          </p>
        )
      )}

      <div className="reply-composer">
        <label className="member-reply">
          写下回复
          <textarea
            maxLength={3000}
            rows={4}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={
              member
                ? isQuestion
                  ? '说说你用的版本，或贴个试过的办法…'
                  : '写下你的回复，支持 Markdown…'
                : '登录后即可回复'
            }
          />
        </label>
        <TurnstileField revision={revision} onToken={setToken} />
        {message && (
          <p className={message.includes('已提交') || message.includes('已采纳') ? 'member-status-ok' : 'member-note'} role="status">
            {message}
          </p>
        )}
        <div className="reply-submit-row">
          <span className="reply-submit-hint">
            {member ? '回复需审核，通过后公开展示' : '需要登录后才能回复'}
          </span>
          <button className="member-primary" disabled={busy || content.trim().length < 2} onClick={reply}>
            {busy ? '提交中…' : '回复'}
          </button>
        </div>
      </div>
    </div>
  );
}

type BookmarkItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  replyCount: number;
  solvedAt: number | null;
  categoryName: string;
  authorName: string;
  createdAt: number;
  bookmarkedAt: number;
};

export function BookmarksDialog({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    request<{ items: BookmarkItem[] }>('/api/v1/me/bookmarks')
      .then(d => setItems(d.items))
      .catch(e => setError(e instanceof Error ? e.message : '加载失败，请稍后重试'))
      .finally(() => setLoading(false));
  }, []);

  async function unbookmark(item: BookmarkItem) {
    setBusy(true);
    try {
      await request('/api/v1/topics/' + encodeURIComponent(item.id) + '/bookmark', 'DELETE');
      setItems(rows => rows.filter(x => x.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '取消收藏失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="member-dialog my-topics" role="dialog" aria-modal="true" aria-labelledby="bookmarks-heading">
        <button className="member-close" aria-label="关闭" onClick={onClose}>
          ×
        </button>
        <h2 id="bookmarks-heading">我的收藏</h2>
        <p>收藏过的公开帖子，随时可以回看或取消收藏。</p>
        {error && (
          <p className="member-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="member-note">正在读取收藏…</p>
        ) : items.length === 0 ? (
          <p className="member-note">还没有收藏话题。在帖子下方点击「☆ 收藏」即可保存。</p>
        ) : (
          <div className="my-topic-list">
            {items.map(item => (
              <article className="my-topic" key={item.id}>
                <div>
                  <strong>
                    <a href={'/t/' + encodeURIComponent(item.slug)}>{item.title}</a>
                  </strong>
                  <small>
                    {item.categoryName} · {item.authorName} · {item.replyCount} 条回复
                    {item.solvedAt != null ? ' · 已解决' : ''} · 收藏于{' '}
                    {new Date(item.bookmarkedAt * 1000).toLocaleDateString('zh-CN')}
                  </small>
                </div>
                <div className="my-topic-actions">
                  <button disabled={busy} onClick={() => unbookmark(item)}>
                    取消收藏
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export type { Member };
