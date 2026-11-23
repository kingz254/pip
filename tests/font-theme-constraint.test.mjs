import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const page = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261123180000_allow_all_font_themes.sql', import.meta.url), 'utf8');
const fontList = page.match(/var FONT_THEMES=\[([\s\S]*?)\n  \];/);
assert.ok(fontList, 'font picker list found');
const offered = [...fontList[1].matchAll(/\["([a-z-]+)"\s*,/g)].map(([, id]) => id);

test('sites accepts every font offered by the picker and still rejects unknown values', async () => {
  const db = new PGlite();
  await db.exec(`create table public.sites (font_theme text not null default 'inter' constraint sites_font_theme_check check (font_theme = any (array['inter','merriweather'])))`);
  await db.exec(migration);
  for (const font of offered) {
    await db.query('insert into public.sites(font_theme) values ($1)', [font]);
  }
  await assert.rejects(db.query("insert into public.sites(font_theme) values ('unknown-font')"));
  assert.equal((await db.query('select count(*)::int as count from public.sites')).rows[0].count, offered.length);
  await db.close();
});
