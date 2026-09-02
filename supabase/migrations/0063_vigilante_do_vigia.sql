-- Quem vigia o vigia: um job no Postgres, fora da Vercel.
--
-- ## O buraco que isto fecha
--
-- O vigia (`/api/cron/vigia`) só manda e-mail quando há algo, e esse silêncio
-- é o desenho: um "tudo certo" diário treina a pessoa a arquivar sem ler.
--
-- Só que quatro falhas diferentes produzem exatamente o MESMO silêncio:
--
--     o cron da Vercel nao dispara
--     a rota lanca antes de enviar
--     o Resend recusa o envio
--     o deploy quebrou a rota
--
-- Do lado de fora, "nenhum problema" e "o vigia parou" são indistinguíveis. E
-- o segundo é pior, porque some justamente quando mais se confia nele.
--
-- ## Por que no Postgres, e não em outro cron da Vercel
--
-- Um segundo cron na mesma plataforma cai junto: se a Vercel não dispara, ela
-- não dispara nenhum dos dois. **Vigiar o vigia só funciona de fora**, e o
-- Postgres é a única infraestrutura deste projeto que já está de pé e não
-- depende da Vercel para nada.
--
-- Isto inverte a lógica: o silêncio do vigia vira barulho aqui.
--
-- ## `pg_cron` deixa de ser "não temos"
--
-- Quatro migrations deste projeto (0014, 0015, 0027, 0051) dizem, em texto,
-- que `pg_cron` não está habilitado e por isso o trabalho é feito de outro
-- jeito. Isso passa a ser falso a partir daqui — e as decisões daquelas quatro
-- continuam válidas: nenhuma delas migra para cá. Trocar o que funciona por
-- gosto de arquitetura é como se quebra coisa que estava certa.
--
-- O que muda é só isto: existe agora um lugar para o único job que **precisa**
-- viver fora da Vercel.

-- ---------------------------------------------------------------------------
-- Quanto tempo de silêncio vira suspeita
-- ---------------------------------------------------------------------------
-- Três horas, e não uma. O vigia varre de hora em hora, então uma falha
-- isolada (rede, um deploy no meio, a Meta demorando) se resolve sozinha na
-- próxima passagem. Alertar na primeira ausência produziria alarme falso toda
-- vez que um deploy coincidisse com a hora cheia — e alarme falso é o que
-- ensina a ignorar o alerta verdadeiro.
--
-- Três passagens perdidas seguidas não são coincidência.

create or replace function public.vigiar_o_vigia()
returns text
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  ultima timestamptz;
  horas_de_silencio numeric;
  -- Nao se chama `chave`: a tabela tem uma coluna com esse nome, e o
  -- PL/pgSQL resolve o conflito lancando `42702 ambiguous` no `where` — nao
  -- escolhendo em silencio, que seria pior.
  chave_do_resend text;
  corpo jsonb;
  assunto text;
begin
  -- O carimbo que a rota grava em TODA varredura, inclusive nas que não
  -- mandam e-mail. É a diferença entre "rodou e estava tudo bem" e "não
  -- rodou", que sem ele não existe.
  select avisado_em into ultima
  from public.vigia_ultimo_aviso v
  where v.chave = '__ultima_varredura';

  if ultima is null then
    -- Sem carimbo nenhum: ou o vigia nunca rodou desde este deploy, ou alguém
    -- limpou a tabela. Nos dois casos não há o que comparar, e inventar um
    -- alerta aqui geraria ruído em toda implantação nova.
    return 'sem carimbo ainda, nada a comparar';
  end if;

  horas_de_silencio := extract(epoch from (now() - ultima)) / 3600.0;

  if horas_de_silencio < 3 then
    return format('o vigia rodou ha %s hora(s), tudo certo',
                  round(horas_de_silencio, 1));
  end if;

  -- ------------------------------------------------------------------ o aviso
  select decrypted_secret into chave_do_resend
  from vault.decrypted_secrets
  where name = 'resend_api_key';

  if chave_do_resend is null then
    -- Falhar alto aqui é de propósito: um vigilante que não consegue avisar e
    -- devolve sucesso é pior que vigilante nenhum, porque cria confiança falsa.
    raise exception 'o segredo resend_api_key nao esta no Vault';
  end if;

  assunto := format('Velo Funil: o vigia esta mudo ha %s horas',
                    round(horas_de_silencio, 1));

  corpo := jsonb_build_object(
    'from', 'Velo Funil <suporte@velofunil.com.br>',
    'to', jsonb_build_array('notificacaosistemavelofunil@gmail.com'),
    'subject', assunto,
    'html', format(
      '<p style="font:16px/1.5 system-ui,sans-serif">' ||
      'A ultima varredura do vigia foi em <strong>%s</strong> (horario de Brasilia), ' ||
      'ha %s horas. Ele varre de hora em hora, entao tres passagens perdidas ' ||
      'seguidas nao sao coincidencia.</p>' ||
      '<p style="font:16px/1.5 system-ui,sans-serif;color:#555">' ||
      'Isso quer dizer que o cron da Vercel parou, ou que a rota ' ||
      '<code>/api/cron/vigia</code> esta quebrada. Enquanto durar, voce NAO ' ||
      'esta sendo avisado de erro em producao, de avaliacao vencendo nem de ' ||
      'relato de suporte parado.</p>' ||
      '<p style="font:13px/1.5 system-ui,sans-serif;color:#888">' ||
      'Este aviso vem do Postgres, nao da Vercel — por isso ele chega mesmo ' ||
      'quando ela esta fora do ar.</p>',
      to_char(ultima at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      round(horas_de_silencio, 1)
    )
  );

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || chave_do_resend,
      'Content-Type', 'application/json'
    ),
    body := corpo
  );

  return format('AVISO ENVIADO: vigia mudo ha %s horas', round(horas_de_silencio, 1));
end;
$$;

comment on function public.vigiar_o_vigia is
  'Avisa por e-mail quando o vigia da Vercel para de carimbar. Roda no Postgres para nao cair junto com ele.';

-- Só o dono do banco executa. Esta função lê o Vault e dispara e-mail: nenhum
-- papel do PostgREST (`anon`, `authenticated`) tem o que fazer com ela.
revoke all on function public.vigiar_o_vigia from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- O agendamento
-- ---------------------------------------------------------------------------
-- De hora em hora, aos 30 minutos. O deslocamento é deliberado: o vigia roda
-- na hora cheia, e conferir no mesmo instante correria contra a execução dele.
-- Trinta minutos depois, a passagem da hora ou aconteceu ou não aconteceu.

select cron.unschedule('vigiar-o-vigia')
where exists (select 1 from cron.job where jobname = 'vigiar-o-vigia');

select cron.schedule('vigiar-o-vigia', '30 * * * *', $$select public.vigiar_o_vigia()$$);
