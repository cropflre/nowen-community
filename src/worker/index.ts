import { Hono } from 'hono';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { categories, topics, users } from '../db/schema';
import { seoTopicHtml } from './seo';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
};
const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
  c.header('Cache-Control', c.req.path.startsWith('/api/') ? 'no-store' : 'private, max-age=0');
});

app.get('/api/health', c => c.json({ ok: true, service: 'nowen-community', stage: 'foundation' }));

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
  const condition = and(
    eq(topics.status, 'published'),
    category ? eq(topics.categoryId, category) : undefined,
    query ? or(like(topics.title, '%' + query + '%'), like(topics.content, '%' + query + '%')) : undefined,
  );
  const rows = await db.select({
    id: topics.id, slug: topics.slug, title: topics.title, content: topics.content,
    createdAt: topics.createdAt, replyCount: topics.replyCount, pinned: topics.pinned,
    categoryId: topics.categoryId, categoryName: categories.name,
    authorName: users.displayName,
  }).from(topics)
    .innerJoin(categories, eq(topics.categoryId, categories.id))
    .innerJoin(users, eq(topics.authorId, users.id))
    .where(condition).orderBy(desc(topics.pinned), desc(topics.createdAt))
    .limit(21).offset((page - 1) * 20);
  return c.json({ items: rows.slice(0, 20).map(row => ({...row, excerpt: row.content.slice(0, 180), content: undefined})), nextPage: rows.length > 20 ? page + 1 : null });
});

async function getPublicTopic(db: ReturnType<typeof drizzle>, slug: string) {
  const rows = await db.select({
    id: topics.id, slug: topics.slug, title: topics.title, content: topics.content,
    createdAt: topics.createdAt, replyCount: topics.replyCount,
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
  return item ? c.json({ item }) : c.json({ error: 'not_found' }, 404);
});

// Server-generated semantic HTML: crawlers see the real topic title and body,
// while the React client replaces the same content after initialization.
app.get('/t/:slug', async c => {
  const item = await getPublicTopic(drizzle(c.env.DB), c.req.param('slug'));
  if (!item) return c.text('Topic not found', 404);
  const template = await c.env.ASSETS.fetch(new Request(new URL('/', c.req.url)));
  if (!template.ok) return c.text('Page unavailable', 503);
  return c.html(seoTopicHtml(await template.text(), item));
});

// Fail closed: visitor writes/auth/admin functions are not public in stage 1.
app.all('/api/*', c => c.json({ error: 'not_found' }, 404));

app.onError((error, c) => {
  console.error('community_request_failed', error instanceof Error ? error.name : 'unknown');
  return c.json({ error: 'internal_error' }, 500);
});

export default app;
