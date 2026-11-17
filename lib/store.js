import { neon } from '@neondatabase/serverless';

let connection, setupPromise;
export function sql(){
  if(!process.env.DATABASE_URL)throw Error('DATABASE_URL missing. Add Neon via Vercel Storage Marketplace.');
  if(!connection)connection=neon(process.env.DATABASE_URL);
  return connection;
}
export async function query(statement, params=[]){return sql().query(statement,params);}
export function setup(){
  if(!setupPromise)setupPromise=(async()=>{
    await query(`CREATE TABLE IF NOT EXISTS bm_tripo_licenses (
      id UUID PRIMARY KEY, key_hash CHAR(64) UNIQUE NOT NULL, key_tail VARCHAR(5) NOT NULL,
      customer VARCHAR(100) NOT NULL, plan VARCHAR(20) NOT NULL DEFAULT 'Personal',
      status VARCHAR(10) NOT NULL DEFAULT 'active', device_id VARCHAR(50), last_name VARCHAR(80),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ, activated_at TIMESTAMPTZ, last_seen_at TIMESTAMPTZ,
      check_count INTEGER NOT NULL DEFAULT 0)`);
    await query(`CREATE TABLE IF NOT EXISTS bm_tripo_events (
      id BIGSERIAL PRIMARY KEY, license_id UUID REFERENCES bm_tripo_licenses(id) ON DELETE SET NULL,
      type VARCHAR(30) NOT NULL, display_name VARCHAR(80), device_id VARCHAR(50),
      key_tail VARCHAR(5), description VARCHAR(160), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await query('CREATE INDEX IF NOT EXISTS bm_tripo_events_latest ON bm_tripo_events(created_at DESC)');
    await query('CREATE INDEX IF NOT EXISTS bm_tripo_events_license ON bm_tripo_events(license_id,created_at DESC)');
    await query("ALTER TABLE bm_tripo_licenses ADD COLUMN IF NOT EXISTS tool_slug VARCHAR(36) NOT NULL DEFAULT 'tripo'");
    await query("ALTER TABLE bm_tripo_events ADD COLUMN IF NOT EXISTS tool_slug VARCHAR(36)");
    await query('CREATE INDEX IF NOT EXISTS bm_licenses_tool ON bm_tripo_licenses(tool_slug,created_at DESC)');
    await query(`CREATE TABLE IF NOT EXISTS bm_store_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id=1),
      discord_url TEXT NOT NULL DEFAULT '',
      whatsapp_number VARCHAR(24) NOT NULL DEFAULT '',
      contact_note VARCHAR(160) NOT NULL DEFAULT '',
      prices JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query("INSERT INTO bm_store_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING");
    await query(`CREATE TABLE IF NOT EXISTS bm_tripo_admin_attempts (
      ip_hash CHAR(64) PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0,
      window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(), locked_until TIMESTAMPTZ)`);
  })().catch(e=>{setupPromise=null;throw e;});
  return setupPromise;
}
export async function audit({licenseId=null,type,displayName=null,deviceId=null,keyTail=null,description=null,toolSlug=null}){
  await query(`INSERT INTO bm_tripo_events(license_id,type,display_name,device_id,key_tail,description,tool_slug)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,[licenseId,type,displayName,deviceId,keyTail,description,toolSlug]);
}
