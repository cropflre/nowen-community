import {Hono} from 'hono';
import {denyCrossSite,getActor,seconds,type CommunityBindings} from './security';
const notifications=new Hono<{Bindings:CommunityBindings}>();
notifications.use('*',async(c,next)=>{
 if(!['GET','HEAD','OPTIONS'].includes(c.req.method)&&denyCrossSite(c))return c.json({error:'ORIGIN_DENIED'},403);
 await next();
});
notifications.get('/notifications',async c=>{
 const user=await getActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 const {results}=await c.env.DB.prepare('SELECT n.id,n.kind,n.target_id AS targetId,n.read_at AS readAt,n.created_at AS createdAt,t.slug AS slug FROM notifications n LEFT JOIN topics t ON t.id=n.target_id WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 50').bind(user.id).all();
 return c.json({items:results});
});
notifications.post('/notifications/read-all',async c=>{
 const user=await getActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 await c.env.DB.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').bind(seconds(),user.id).run();
 return c.json({ok:true});
});
notifications.post('/notifications/:id/read',async c=>{
 const user=await getActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 const r=await c.env.DB.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?').bind(seconds(),c.req.param('id'),user.id).run();
 return r.meta.changes?c.json({ok:true}):c.json({error:'NOT_FOUND'},404);
});
export default notifications;
