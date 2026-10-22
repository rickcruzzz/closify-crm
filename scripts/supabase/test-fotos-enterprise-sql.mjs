// Executa SQL real em memória; nenhum acesso ao banco ou Storage de produção.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { PGlite } = await import(
  process.env.PGLITE_MODULE ??
    new URL(
      '../../../.tools/sql-proof/node_modules/@electric-sql/pglite/dist/index.js',
      import.meta.url,
    ).href
)
const db = new PGlite()
const readMigration = (file) =>
  readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8')
const migration = await readMigration(
  '20261022144429_fotos_enterprise_e_retentativas_whatsapp.sql',
)
const rollback = await readFile(
  new URL('./rollback-fotos-enterprise.sql', import.meta.url),
  'utf8',
)
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
let passed = 0
async function check(name, fn) {
  await fn()
  console.log(`PASS ${name}`)
  passed++
}
async function scalar(sql, params = []) {
  return Object.values((await db.query(sql, params)).rows[0])[0]
}
async function authenticated(user, fn) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id(user)])
  await db.exec('set role authenticated')
  try {
    await fn()
  } finally {
    await db.exec('reset role')
  }
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.workspaces(id uuid primary key,created_by uuid,trial_ate timestamptz);
    create table public.workspace_members(workspace_id uuid,user_id uuid,role text);
    create table public.subscriptions(workspace_id uuid,status text,current_period_end timestamptz,
      ultimo_billing_type text,plano text);
    create function public.dias_de_graca(text) returns int language sql as $$select 0$$;
    create function public.is_workspace_member(target_workspace_id uuid)
      returns boolean language sql stable security definer set search_path to '' as $$
      select exists(select 1 from public.workspace_members
        where workspace_id=target_workspace_id and user_id=auth.uid()) $$;
    create table public.leads(id uuid primary key,workspace_id uuid,name text,created_at timestamptz default now());
    alter table public.leads enable row level security;
    create policy leads_select on public.leads for select using ((select public.is_workspace_member(workspace_id)));
    create policy leads_update on public.leads for update using ((select public.is_workspace_member(workspace_id)))
      with check ((select public.is_workspace_member(workspace_id)));
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$
      select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
    grant usage on schema auth,storage to authenticated,service_role;
    grant all on public.leads,storage.objects to authenticated,service_role;
  `)
  const logos = await readMigration('0031_bucket_de_logos.sql')
  const parser = logos.match(
    /create or replace function public\.workspace_do_caminho[\s\S]+?\$\$;/,
  )
  assert.ok(parser)
  await db.exec(parser[0])
  await db.exec(await readMigration('0096_a_foto_de_quem_escreve.sql'))
  await db.exec(await readMigration('0100_enterprise_eventos.sql'))
  await db.exec(
    'grant select,insert,update on public.enterprise_eventos to authenticated',
  )
  await db.query('insert into workspaces values ($1,$2,null),($3,$4,null)', [
    id(100),
    id(1),
    id(200),
    id(2),
  ])
  await db.query("insert into workspace_members values ($1,$2,'admin'),($3,$4,'admin')", [
    id(100),
    id(1),
    id(200),
    id(2),
  ])
  await db.query('insert into enterprise_workspaces(workspace_id) values ($1)', [id(100)])
  await db.query(
    "insert into leads(id,workspace_id,name,foto_path) values ($1,$2,'Contato antigo',$3)",
    [id(10), id(100), `${id(100)}/lead.jpg`],
  )
  await db.query(
    `insert into enterprise_eventos(id,workspace_id,nome,data_inicio,cidade,fonte_url)
    values ($1,$2,'Evento preservado',current_date,'São Paulo','https://example.test/evento')`,
    [id(20), id(100)],
  )
  const policiesBefore = (
    await db.query(
      'select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies order by 1,2,3',
    )
  ).rows
  await db.exec(migration)
  await db.exec(migration)
  await check(
    'expansão idempotente preserva contatos, eventos e foto anterior',
    async () => {
      assert.equal(
        await scalar('select foto_path from leads where id=$1', [id(10)]),
        `${id(100)}/lead.jpg`,
      )
      assert.equal(
        await scalar('select foto_tentada_em from leads where id=$1', [id(10)]),
        null,
      )
      const event = (
        await db.query(
          'select nome,foto_path,foto_fonte_url,foto_verificada_em,foto_tentada_em from enterprise_eventos',
        )
      ).rows[0]
      assert.deepEqual(event, {
        nome: 'Evento preservado',
        foto_path: null,
        foto_fonte_url: null,
        foto_verificada_em: null,
        foto_tentada_em: null,
      })
    },
  )
  await check('índices duráveis de revezamento existem sem duplicação', async () => {
    for (const index of [
      'leads_empresa_foto_tentada_idx',
      'enterprise_eventos_empresa_foto_tentada_idx',
    ]) {
      assert.match(
        await scalar('select indexdef from pg_indexes where indexname=$1', [index]),
        /\(workspace_id, foto_tentada_em\)/,
      )
    }
  })
  await check('RLS e privilégios do bucket privado permanecem iguais', async () => {
    assert.deepEqual(
      (
        await db.query(
          'select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies order by 1,2,3',
        )
      ).rows,
      policiesBefore,
    )
    assert.equal(
      await scalar("select public from storage.buckets where id='avatares'"),
      false,
    )
  })
  await check(
    'membro Enterprise lê e atualiza os metadados da própria empresa',
    async () => {
      await authenticated(1, async () => {
        assert.equal(await scalar('select count(*)::int from enterprise_eventos'), 1)
        const update = await db.query(
          `update enterprise_eventos set foto_path=$1,foto_fonte_url=$2,
        foto_verificada_em=now(),foto_tentada_em=now() where id=$3 returning id`,
          [`${id(100)}/empresas/evento.jpg`, 'https://example.test/logo.jpg', id(20)],
        )
        assert.equal(update.rows.length, 1)
        await db.query('update leads set foto_tentada_em=now() where id=$1', [id(10)])
      })
    },
  )
  await check('membro de outra empresa não lê nem altera metadados alheios', async () => {
    await authenticated(2, async () => {
      assert.equal(await scalar('select count(*)::int from enterprise_eventos'), 0)
      assert.equal(
        (
          await db.query(
            'update enterprise_eventos set foto_path=null where id=$1 returning id',
            [id(20)],
          )
        ).rows.length,
        0,
      )
      assert.equal(
        (
          await db.query(
            'update leads set foto_tentada_em=now() where id=$1 returning id',
            [id(10)],
          )
        ).rows.length,
        0,
      )
    })
  })
  await db.query(
    "insert into storage.objects(bucket_id,name) values ('avatares',$1),('avatares',$2),('avatares','invalid/empresas/logo.jpg')",
    [`${id(100)}/empresas/evento.jpg`, `${id(200)}/empresas/outro.jpg`],
  )
  await check(
    'assinatura/leitura de imagem só encontra caminhos da própria empresa',
    async () => {
      await authenticated(1, async () => {
        const result = await db.query('select name from storage.objects')
        assert.deepEqual(result.rows, [{ name: `${id(100)}/empresas/evento.jpg` }])
        assert.equal(
          await scalar('select count(*)::int from storage.objects where name=$1', [
            `${id(200)}/empresas/outro.jpg`,
          ]),
          0,
        )
        await assert.rejects(
          () =>
            db.query(
              "insert into storage.objects(bucket_id,name) values ('avatares',$1)",
              [`${id(100)}/empresas/forjado.jpg`],
            ),
          /row-level security/,
        )
        assert.equal(
          (
            await db.query('update storage.objects set name=$1 returning id', [
              `${id(100)}/empresas/forjado.jpg`,
            ])
          ).rows.length,
          0,
        )
      })
    },
  )
  await check('rollback recusa perda de metadados e preserva arquivos', async () => {
    await assert.rejects(() => db.exec(rollback), /há metadados/)
    await db.exec('rollback')
    assert.equal(
      await scalar('select foto_fonte_url from enterprise_eventos where id=$1', [id(20)]),
      'https://example.test/logo.jpg',
    )
    assert.equal(await scalar('select count(*)::int from storage.objects'), 3)
  })
  await check(
    'rollback vazio remove somente a expansão, mantendo imagens anteriores',
    async () => {
      await db.exec(
        'update leads set foto_tentada_em=null; update enterprise_eventos set foto_path=null,foto_fonte_url=null,foto_verificada_em=null,foto_tentada_em=null',
      )
      await db.exec(rollback)
      assert.equal(
        await scalar(
          "select count(*)::int from information_schema.columns where table_schema='public' and column_name='foto_tentada_em'",
        ),
        0,
      )
      assert.equal(
        await scalar('select foto_path from leads where id=$1', [id(10)]),
        `${id(100)}/lead.jpg`,
      )
      assert.equal(await scalar('select count(*)::int from storage.objects'), 3)
    },
  )
  console.log(`${passed}/${passed} verificações SQL passaram; nenhuma escrita externa.`)
} finally {
  await db.close()
}
