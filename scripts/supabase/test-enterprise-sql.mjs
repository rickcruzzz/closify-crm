// PostgreSQL real (PGlite), em memória. Não conecta ao Supabase nem envia e-mails.
// Dependência de teste isolada: npm install --prefix ../.tools/sql-proof --no-save --no-package-lock @electric-sql/pglite@0.5.11
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const pglitePath =
  process.env.PGLITE_MODULE ??
  new URL(
    '../../../.tools/sql-proof/node_modules/@electric-sql/pglite/dist/index.js',
    import.meta.url,
  ).href
const { PGlite } = await import(pglitePath)
const db = new PGlite()
const migration = new URL(
  '../../supabase/migrations/20261022135807_enterprise_cinco_colaboradores_email_confirmado.sql',
  import.meta.url,
)
const rollback = new URL('./rollback-enterprise-cinco-colaboradores.sql', import.meta.url)
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
let checks = 0
async function check(name, fn) {
  await fn()
  checks += 1
  console.log(`PASS ${name}`)
}
async function asUser(n) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    n ? id(n) : '',
  ])
}
async function rejected(sql, params, message) {
  await assert.rejects(
    () => db.query(sql, params),
    (error) => error.message.includes(message),
  )
}
async function member(user, workspace = 100, role = 'membro') {
  return db.query('insert into public.workspace_members values ($1,$2,$3)', [
    id(workspace),
    id(user),
    role,
  ])
}
async function invite(user, token = user, workspace = 100, expires = '1 day') {
  return db.query(
    `insert into public.workspace_invites(workspace_id,email,token,expires_at)
    values ($1,$2,$3,now()+$4::interval)`,
    [id(workspace), `user${user}@example.test`, id(token), expires],
  )
}
async function scalar(sql, params = []) {
  const result = await db.query(sql, params)
  return Object.values(result.rows[0])[0]
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create type public.workspace_role as enum ('admin','membro');
    create type public.workspace_invite_status as enum ('pending','accepted','expired');
    create table public.workspaces(id uuid primary key,created_by uuid,name text,trial_ate timestamptz);
    create table public.workspace_members(
      workspace_id uuid references public.workspaces(id),user_id uuid references auth.users(id),
      role public.workspace_role default 'membro',primary key(workspace_id,user_id));
    create table public.workspace_invites(
      id uuid primary key default gen_random_uuid(),workspace_id uuid references public.workspaces(id),
      email text not null,token uuid unique not null,status public.workspace_invite_status default 'pending',
      expires_at timestamptz not null default now()+interval '7 days',
      role public.workspace_role default 'membro');
    create unique index workspace_invites_pending_email_idx
      on public.workspace_invites(workspace_id,email) where status='pending';
    create table public.subscriptions(workspace_id uuid,status text,current_period_end timestamptz,
      ultimo_billing_type text,plano text);
    create function public.dias_de_graca(text) returns int language sql as $$select 0$$;
    create function public.em_trial(uuid) returns boolean language sql as $$select false$$;
    create function public.is_workspace_member(target_workspace_id uuid)
      returns boolean language sql stable security definer set search_path to '' as $$
      select exists(select 1 from public.workspace_members
        where workspace_id=target_workspace_id and user_id=auth.uid())
    $$;
    create function public.is_workspace_admin(target_workspace_id uuid)
      returns boolean language sql stable security definer set search_path to '' as $$
      select exists(select 1 from public.workspace_members
        where workspace_id=target_workspace_id and user_id=auth.uid() and role='admin')
    $$;
    alter table public.workspace_invites enable row level security;
    create policy workspace_invites_select_admin on public.workspace_invites
      for select using ((select public.is_workspace_admin(workspace_id)));
    create policy workspace_invites_insert_admin on public.workspace_invites
      for insert with check ((select public.is_workspace_admin(workspace_id)));
    create policy workspace_invites_delete_admin on public.workspace_invites
      for delete using ((select public.is_workspace_admin(workspace_id)));
    grant all on public.workspace_invites to authenticated;
    grant usage on schema auth to authenticated;
  `)
  const enterprise = await readFile(
    new URL('../../supabase/migrations/0100_enterprise_eventos.sql', import.meta.url),
    'utf8',
  )
  await db.exec(enterprise.slice(0, enterprise.indexOf('-- O robô')))
  await db.exec(await readFile(rollback, 'utf8'))
  await db.exec(`create trigger validar_convite_de_workspace before insert on public.workspace_invites
    for each row execute function public.validar_convite_de_workspace()`)
  await db.exec(await readFile(migration, 'utf8'))
  await db.exec(await readFile(migration, 'utf8'))
  await check('migração pode ser reaplicada sem duplicar estruturas', async () => {
    assert.equal(
      await scalar(
        "select count(*)::int from pg_trigger where tgname='validar_limite_de_membros'",
      ),
      1,
    )
  })
  for (let n = 1; n <= 20; n++) {
    await db.query('insert into auth.users values ($1,$2,$3)', [
      id(n),
      `user${n}@example.test`,
      n === 9 ? null : new Date(),
    ])
  }
  await db.query('insert into workspaces values ($1,$2,$3,null)', [
    id(100),
    id(1),
    'Enterprise',
  ])
  await db.query('insert into enterprise_workspaces(workspace_id) values ($1)', [id(100)])
  await asUser(1)
  await member(1, 100, 'admin')
  await check('titular não ocupa uma das cinco vagas', async () => {
    for (let n = 2; n <= 6; n++) await invite(n)
    assert.equal(await scalar('select count(*)::int from workspace_invites'), 5)
  })
  await check('sexto convite direto ao banco é recusado', async () => {
    await rejected(
      'insert into workspace_invites(workspace_id,email,token) values ($1,$2,$3)',
      [id(100), 'user7@example.test', id(7)],
      'até 5 colaboradores',
    )
  })
  await check(
    'aceite troca reserva por membro sem contar a vaga duas vezes',
    async () => {
      await asUser(2)
      assert.equal(
        await scalar('select public.accept_workspace_invite($1)', [id(2)]),
        id(100),
      )
      assert.equal(
        await scalar(
          "select count(*)::int from workspace_invites where status='pending'",
        ),
        4,
      )
      assert.equal(await scalar('select count(*)::int from workspace_members'), 2)
    },
  )
  await check('colaborador herda Enterprise, Pro e Max da empresa', async () => {
    const result = await db.query(
      'select enterprise_vigente($1) as e,pro_vigente($1) as p,max_vigente($1) as m',
      [id(100)],
    )
    assert.deepEqual(result.rows[0], { e: true, p: true, m: true })
    await asUser(8)
    assert.equal(await scalar('select enterprise_vigente($1)', [id(100)]), false)
  })
  await check('convite usado não pode ser aceito duas vezes', async () => {
    await asUser(2)
    await rejected('select accept_workspace_invite($1)', [id(2)], 'já utilizado')
  })
  await check('reservas impedem inserção direta de um sexto colaborador', async () => {
    await asUser(1)
    await assert.rejects(() => member(7), /até 5 colaboradores/)
  })
  await check('administrador convidado também consome uma vaga', async () => {
    await db.query("update workspace_members set role='admin' where user_id=$1", [id(2)])
    await assert.rejects(() => invite(7), /até 5 colaboradores/)
  })
  await check(
    'cinco colaboradores podem aceitar; sexto membro continua bloqueado',
    async () => {
      for (let n = 3; n <= 6; n++) {
        await asUser(n)
        await db.query('select accept_workspace_invite($1)', [id(n)])
      }
      assert.equal(await scalar('select count(*)::int from workspace_members'), 6)
      await asUser(1)
      await assert.rejects(() => member(7), /até 5 colaboradores/)
    },
  )
  await check('inserção idempotente não acusa falsa falta de vaga', async () => {
    await db.query(
      'insert into workspace_members values ($1,$2,$3) on conflict do nothing',
      [id(100), id(2), 'admin'],
    )
  })
  await db.query('delete from workspace_members where user_id=$1', [id(6)])
  await check('convite expirado não reserva vaga, mas não pode ser aceito', async () => {
    await invite(7, 70, 100, '-1 day')
    await asUser(7)
    await rejected('select accept_workspace_invite($1)', [id(70)], 'expirado')
  })
  await check(
    'reconvite do mesmo e-mail encerra pending vencido antes do índice único',
    async () => {
      await asUser(1)
      await invite(7, 71)
      assert.equal(
        await scalar('select status from workspace_invites where token=$1', [id(70)]),
        'expired',
      )
      assert.equal(
        await scalar('select status from workspace_invites where token=$1', [id(71)]),
        'pending',
      )
      await db.query('delete from workspace_invites where token=$1', [id(71)])
      await invite(9)
    },
  )
  await check(
    'falha por lotação reverte também a limpeza do convite vencido',
    async () => {
      await invite(8, 80, 100, '-1 day')
      await assert.rejects(() => invite(8, 81), /até 5 colaboradores/)
      assert.equal(
        await scalar('select status from workspace_invites where token=$1', [id(80)]),
        'pending',
      )
    },
  )
  await check(
    'RLS impede admin de reativar ou alterar destino e validade diretamente',
    async () => {
      await db.exec('set role authenticated')
      try {
        assert.equal(
          await scalar(
            'select count(*)::int from public.workspace_invites where token=$1',
            [id(70)],
          ),
          1,
        )
        const result = await db.query(
          `update public.workspace_invites
        set status='pending',workspace_id=$1,email='other@example.test',expires_at=now()+interval '1 day'
        where token=$2 returning token`,
          [id(100), id(70)],
        )
        assert.equal(result.rows.length, 0)
      } finally {
        await db.exec('reset role')
      }
      assert.equal(
        await scalar('select status from workspace_invites where token=$1', [id(70)]),
        'expired',
      )
      assert.equal(
        await scalar(
          "select count(*)::int from pg_policies where tablename='workspace_invites' and cmd='UPDATE'",
        ),
        0,
      )
    },
  )
  await check(
    'conta sem confirmação de e-mail é recusada e mantém convite pendente',
    async () => {
      await asUser(9)
      await rejected('select accept_workspace_invite($1)', [id(9)], 'e-mail confirmado')
      assert.equal(
        await scalar('select status from workspace_invites where token=$1', [id(9)]),
        'pending',
      )
    },
  )
  await check('e-mail diferente do destinatário é recusado', async () => {
    await asUser(8)
    await rejected('select accept_workspace_invite($1)', [id(9)], 'outro e-mail')
  })
  await check('inserção direta não contorna confirmação de e-mail', async () => {
    await asUser(1)
    await db.query('delete from workspace_invites where token=$1', [id(9)])
    await assert.rejects(() => member(9), /e-mail confirmado/)
    await member(7)
  })
  await check(
    'troca de identidade de membro não contorna limite Enterprise',
    async () => {
      await db.query('insert into workspaces values ($1,$2,$3,null)', [
        id(101),
        id(8),
        'Outra',
      ])
      await member(8, 101, 'admin')
      await rejected(
        'update workspace_members set workspace_id=$1 where workspace_id=$2 and user_id=$3',
        [id(100), id(101), id(8)],
        'até 5 colaboradores',
      )
    },
  )
  await check('manutenção sem sessão também respeita teto Enterprise', async () => {
    await asUser(null)
    await assert.rejects(() => member(8), /até 5 colaboradores/)
  })
  await check(
    'Free mantém limite de dois e Pro pago mantém colaboradores ilimitados',
    async () => {
      await db.query('insert into workspaces values ($1,$2,$3,null)', [
        id(102),
        id(10),
        'Free',
      ])
      await asUser(10)
      await member(10, 102, 'admin')
      await member(11, 102)
      await assert.rejects(() => member(12, 102), /2 membros do plano Free/)
      await db.query(
        "insert into subscriptions values ($1,$2,now()+interval '1 day',null,$3)",
        [id(102), 'active', 'pro'],
      )
      for (let n = 12; n <= 19; n++) await member(n, 102)
      assert.equal(
        await scalar(
          'select count(*)::int from workspace_members where workspace_id=$1',
          [id(102)],
        ),
        10,
      )
    },
  )
  await check(
    'concessão Enterprise permanece sem privilégios para usuários da aplicação',
    async () => {
      assert.equal(
        await scalar(
          "select has_table_privilege('authenticated','public.enterprise_workspaces','INSERT')",
        ),
        false,
      )
      assert.equal(
        await scalar(
          "select has_function_privilege('anon','public.accept_workspace_invite(uuid)','EXECUTE')",
        ),
        false,
      )
    },
  )
  await check(
    'rollback restaura comportamento anterior sem apagar equipe ou convites',
    async () => {
      const before = await scalar('select count(*)::int from workspace_members')
      await db.exec(await readFile(rollback, 'utf8'))
      await asUser(1)
      await member(8)
      assert.equal(
        await scalar('select count(*)::int from workspace_members'),
        before + 1,
      )
      assert.equal(
        await scalar(
          "select count(*)::int from pg_trigger where tgname='validar_limite_de_membros' and (tgtype & 16)=16",
        ),
        0,
      )
    },
  )
  console.log(
    `${checks}/${checks} verificações SQL passaram; banco temporário em memória.`,
  )
} finally {
  await db.close()
}
