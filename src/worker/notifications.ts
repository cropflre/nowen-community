import {Hono} from 'hono';
import {getActor,seconds,type CommunityBindings} from './security';
const notifications=new Hono<{Bindings:CommunityBindings}>();
notifications.get('/notifications',async c=>{
 const user=await getActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 const {results}=await c.env.DB.prepare('SELECT id,kind,target_id AS targetId,read_at AS readAt,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').bind(user.id).all();
 return c.json({items:results});
});
notifications.post('/notifications/:id/read',async c=>{
 const user=await getActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 const r=await c.env.DB.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?').bind(seconds(),c.req.param('id'),user.id).run();
 return r.meta.changes?c.json({ok:true}):c.json({error:'NOT_FOUND'},404);
});
export default notifications;
