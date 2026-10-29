#!/usr/bin/env node
// Run locally; do not commit or paste the generated invitation token into GitHub or chat.
import {randomBytes,randomUUID,createHash} from 'node:crypto';
const days=Number(process.argv[2]??7);
if(!Number.isInteger(days)||days<1||days>30)throw Error('Expiry must be 1-30 days');
const token=randomBytes(32).toString('base64url');
const codeHash=createHash('sha256').update(token).digest('hex');
const expiresAt=Math.floor(Date.now()/1000)+days*86400;
const id=randomUUID();
console.log('Private invitation (shown once, share privately):\n'+token);
console.log('\nInsert the following SQL into the ISOLATED nowen-community-db (never nowen-site-stats):');
console.log("INSERT INTO invitations(id,code_hash,expires_at) VALUES('"+id+"','"+codeHash+"',"+expiresAt+");");
console.log('\nThe raw invitation code is NOT stored in D1; save it only in your password manager.');
