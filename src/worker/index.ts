import { Hono } from 'hono';
import { and, desc, eq, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { categories, topics, users } from '../db/schema';
import { seoTopicHtml } from './seo';
import { getActor, type CommunityBindings } from './security';
import memberRoutes from './members';
import moderationRoutes from './moderation';
import notificationRoutes from './notifications';

const app = new Hono<{ Bindings: CommunityBindings }>();

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
  c.header('Cache-Control', c.req.path.startsWith('/api/') ? 'no-store' : c.req.path==='/sitemap.xml' ? 'public, max-age=300' : 'private, max-age=0');
});

app.get('/api/health', c => c.json({ ok: true, service: 'nowen-community', stage: 'foundation' }));

app.get('/robots.txt',c=>c.text('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: https://community.nowen.cn/sitemap.xml\n'));
app.get('/sitemap.xml',async c=>{
 const db=drizzle(c.env.DB);
 const items=await db.select({slug:topics.slug,updatedAt:topics.updatedAt}).from(topics)
  .where(eq(topics.status,'published')).orderBy(desc(topics.updatedAt)).limit(1000);
 const urls=items.map(item=>'<url><loc>https://community.nowen.cn/t/'+encodeURIComponent(item.slug)+'</loc><lastmod>'+new Date(item.updatedAt*1000).toISOString().slice(0,10)+'</lastmod></url>').join('');
 return c.body('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://community.nowen.cn/</loc></url>'+urls+'</urlset>',200,{'Content-Type':'application/xml; charset=utf-8'});
});

app.get('/api/v1/categories', async c => {
  const db = drizzle(c.env.DB);
  const items = await db.select({ id: categories.id, name: categories.name, description: categories.description, icon: categories.icon })
    .from(categories).orderBy(categories.sort);
  return c.json({ items });
});

app.get('/api/v1/topics', async c => {
  const db = drizzle(c.env.DB);
  const query = c.req.query('q')?.trim().slice(0, 80) || '';
  const category = c.req.query('category')?.slice(0, 60) || '';
  const page = Math.min(100, Math.max(1, Number.parseInt(c.req.query('page') || '1', 10) || 1));
  const sort = c.req.query('sort') === 'popular' ? 'popular' : 'latest';
  const resolutionParam = c.req.query('resolution');
  const resolution = resolutionParam === 'solved' || resolutionParam === 'unsolved' ? resolutionParam : 'all';
  const condition = and(
    eq(topics.status, 'published'),
    category ? eq(topics.categoryId, category) : undefined,
    query ? or(like(topics.title, '%' + query + '%'), like(topics.content, '%' + query + '%')) : undefined,
    // "待解决" only surfaces unanswered help questions; other boards stay discussion topics.
    resolution === 'solved' ? isNotNull(topics.solvedAt) : undefined,
    resolution === 'unsolved' ? and(eq(topics.categoryId, 'help'), isNull(topics.solvedAt)) : undefined,
  );
  const rows = await db.select({
    id: topics.id, slug: topics.slug, title: topics.title, content: topics.content,
    createdAt: topics.createdAt, replyCount: topics.replyCount, pinned: topics.pinned,
    solvedAt: topics.solvedAt,
    categoryId: topics.categoryId, categoryName: categories.name,
    authorName: users.displayName,
  }).from(topics)
    .innerJoin(categories, eq(topics.categoryId, categories.id))
    .innerJoin(users, eq(topics.authorId, users.id))
    .where(condition).orderBy(desc(topics.pinned), query ? sql`CASE WHEN ${topics.title} LIKE ${'%' + query + '%'} THEN 0 ELSE 1 END` : sql`CASE WHEN 1=1 THEN 0 ELSE 1 END`, sort === 'popular' ? desc(topics.replyCount) : desc(topics.createdAt), desc(topics.createdAt))
    .limit(21).offset((page - 1) * 20);
  return c.json({ items: rows.slice(0, 20).map(row => ({...row, excerpt: row.content.slice(0, 180), content: undefined})), nextPage: rows.length > 20 ? page + 1 : null });
});

async function getPublicTopic(db: ReturnType<typeof drizzle>, slug: string) {
  const rows = await db.select({
    id: topics.id, slug: topics.slug, title: topics.title, content: topics.content,
    createdAt: topics.createdAt, replyCount: topics.replyCount,
    authorId: topics.authorId, bestReplyId: topics.bestReplyId, solvedAt: topics.solvedAt,
    categoryId: topics.categoryId, categoryName: categories.name,
    authorName: users.displayName
  }).from(topics)
    .innerJoin(categories, eq(topics.categoryId, categories.id))
    .innerJoin(users, eq(topics.authorId, users.id))
    .where(and(eq(topics.status, 'published'), eq(topics.slug, slug)))
    .limit(1);
  return rows[0] || null;
}

app.get('/api/v1/topics/:slug', async c => {
  const item = await getPublicTopic(drizzle(c.env.DB), c.req.param('slug'));
  if (!item) return c.json({ error: 'not_found' }, 404);
  // Restore the signed-in reader's own like/bookmark state so a reload keeps the real UI state.
  const actor = await getActor(c);
  let viewer: { liked: boolean; bookmarked: boolean } | null = null;
  if (actor) {
    const engagement = await c.env.DB.prepare(
      'SELECT (SELECT 1 FROM topic_likes WHERE topic_id=? AND user_id=?) IS NOT NULL AS liked,' +
      ' (SELECT 1 FROM bookmarks WHERE topic_id=? AND user_id=?) IS NOT NULL AS bookmarked'
    ).bind(item.id, actor.id, item.id, actor.id).first<{ liked: number; bookmarked: number }>();
    viewer = { liked: Boolean(engagement?.liked), bookmarked: Boolean(engagement?.bookmarked) };
  }
  return c.json({ item: { ...item, viewer } });
});

// Server-generated semantic HTML: crawlers see the real topic title and body,
// while the React client replaces the same content after initialization.
app.get('/t/:slug', async c => {
  const item = await getPublicTopic(drizzle(c.env.DB), c.req.param('slug'));
  if (!item) return c.text('Topic not found', 404);
  // A missing static-assets binding must not turn every published topic into 500.
  // The staging deploy gate checks that the binding is present before ingress.
  if (!c.env.ASSETS) {
    console.error('community_assets_binding_missing');
    return c.text('Page unavailable', 503);
  }
  const template = await c.env.ASSETS.fetch(new Request(new URL('/', c.req.url)));
  if (!template.ok) return c.text('Page unavailable', 503);
  return c.html(seoTopicHtml(await template.text(), item));
});

// Phase 2: invitation-only member workflows. Every mutation validates Origin and session.
app.route('/api/v1',memberRoutes);
app.route('/api/v1',moderationRoutes);
app.route('/api/v1',notificationRoutes);

// Unimplemented admin/moderation routes fail closed.
app.all('/api/*', c => c.json({ error: 'not_found' }, 404));

app.onError((error, c) => {
  console.error('community_request_failed', error instanceof Error ? error.name : 'unknown');
  return c.json({ error: 'internal_error' }, 500);
});

export default app;
