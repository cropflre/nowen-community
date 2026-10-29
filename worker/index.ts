import {Hono} from 'hono';
import {secureHeaders} from 'hono/secure-headers';
import {drizzle} from 'drizzle-orm/d1';
import {and,desc,eq,lt} from 'drizzle-orm';
import {categories,topics,users} from './schema';
type Bindings={DB:D1Database;ASSETS:Fetcher};
export const app=new Hono<{Bindings:Bindings}>();
app.use('*',secureHeaders());
app.get('/api/health',c=>c.json({ok:true,service:'nowen-community',phase:'foundation'}));
app.get('/api/categories',async c=>{try{const db=drizzle(c.env.DB);const items=await db.select({slug:categories.slug,name:categories.name,description:categories.description}).from(categories).orderBy(categories.sortOrder).all();return c.json({items})}catch{return c.json({error:'SERVICE_UNAVAILABLE'},503)}});
app.get('/api/topics',async c=>{try{const db=drizzle(c.env.DB);const limit=Math.min(Math.max(Number.parseInt(c.req.query('limit')||'20',10)||20,1),30);const cursor=Number.parseInt(c.req.query('before')||'',10);const where=Number.isSafeInteger(cursor)&&cursor>0?and(eq(topics.status,'published'),lt(topics.createdAt,cursor)):eq(topics.status,'published');const items=await db.select({id:topics.id,slug:topics.slug,title:topics.title,createdAt:topics.createdAt,category:categories.name,categorySlug:categories.slug,author:users.displayName}).from(topics).innerJoin(categories,eq(topics.categoryId,categories.id)).innerJoin(users,eq(topics.authorId,users.id)).where(where).orderBy(desc(topics.createdAt),desc(topics.id)).limit(limit).all();return c.json({items,nextCursor:items.length===limit?items.at(-1)?.createdAt:null})}catch{return c.json({error:'SERVICE_UNAVAILABLE'},503)}});
app.get('/api/topics/:slug',async c=>{try{const db=drizzle(c.env.DB);const [item]=await db.select({slug:topics.slug,title:topics.title,body:topics.body,createdAt:topics.createdAt,author:users.displayName,category:categories.name}).from(topics).innerJoin(users,eq(topics.authorId,users.id)).innerJoin(categories,eq(topics.categoryId,categories.id)).where(and(eq(topics.slug,c.req.param('slug')),eq(topics.status,'published'))).limit(1);return item?c.json({item}):c.json({error:'NOT_FOUND'},404)}catch{return c.json({error:'SERVICE_UNAVAILABLE'},503)}});
// Phase one intentionally exposes no write endpoints or public registration.
app.all('/api/*',c=>c.json({error:'NOT_FOUND'},404));
export default app;
