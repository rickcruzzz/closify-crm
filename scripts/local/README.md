# A Central sempre de pé, sem sair desta máquina

A Central do Dono (`/dono`) só existe em `localhost`, e isso é decisão de
segurança, não limitação técnica: `lib/dono/queries.ts` lê com
`createAdminClient()`, que **ignora RLS por completo** — nome, e-mail, telefone
e valor de negócio de todos os clientes. Publicá-la é vazamento de dado de
terceiro sob a LGPD, e o gate de duas condições (`lib/dono/ambiente.ts`) existe
para impedir isso mesmo por engano.

O que estes dois scripts fazem é garantir que, **enquanto esta máquina estiver
ligada**, o servidor esteja de pé — e que ele volte sozinho se cair.

```powershell
# uma vez, para subir junto com o Windows
powershell -ExecutionPolicy Bypass -File scripts\local\registrar-tarefa.ps1

# ou uma passagem avulsa, sem registrar nada
powershell -ExecutionPolicy Bypass -File scripts\local\manter-central-de-pe.ps1
```

Depois disso: <http://localhost:3000/dono>

---

## O que isto NÃO resolve, e é o mais importante

**"Nunca desligar" não existe numa máquina pessoal.** Windows Update reinicia,
energia cai, notebook fecha. Qualquer coisa que não pode cair não pode morar
aqui.

E não mora. O que de fato vigia o sistema já roda **fora** deste computador:

```
/api/cron/vigia    Vercel, de hora em hora   varre e manda e-mail quando MUDA
vigiar-o-vigia     pg_cron, aos 30           avisa se o proprio vigia parar
```

Os dois foram construídos em 01 e 02/09 exatamente porque a Central local não
podia ser a rede de segurança. **Estes scripts são conforto: a tela estar lá
quando você abrir.** A vigilância real é o e-mail.

---

## As três decisões que valem registro

### 1. Checa a RESPOSTA, não o processo

Um `next dev` travado mantém a porta aberta e para de servir. Um gerenciador de
processo comum (PM2) veria "vivo"; este script faz uma requisição de verdade e
só aceita 2xx ou 3xx.

Foi o que sobrou de melhor numa troca forçada: `npm i -g pm2` falhou por rede
nesta máquina, e a alternativa saiu mais precisa que a primeira escolha.

### 2. Pasta Inicializar, não Agendador de Tarefas

`Register-ScheduledTask` devolveu **"Acesso negado"** — registrar tarefa exige
administrador.

Dava para pedir elevação. Não se deve: este processo fica vivo para sempre e
serve uma tela que lê a base inteira sem RLS. Rodá-lo elevado daria a ele mais
poder sobre a máquina do que ele precisa para servir uma página em localhost.

A pasta Inicializar roda com a sua conta, sem elevação, e dá o mesmo efeito.

### 3. Silêncio quando está tudo certo

O log só escreve quando o estado **muda** — caiu, voltou, ou não consegui
levantar. Um "tudo certo" a cada cinco minutos vira ruído que ninguém lê, e no
dia em que houver problema o reflexo de ignorar já está formado. É a mesma
regra do vigia de 01/09.

Log em `.central-local\manter-de-pe.log` (fora do Git).

---

## O conflito que você precisa saber

**`npm run build` com o servidor de pé quebra o `.next`.** Os dois escrevem na
mesma pasta, e o build sobrescreve o mapa de chunks que o servidor está usando:
a partir daí toda rota morre com `MODULE_NOT_FOUND` em `webpack-runtime.js`,
sem nada estar errado no código. Está no `CLAUDE.md`, e já derrubou a Central
três vezes numa sessão só.

Com o vigilante ligado, o servidor está **sempre** de pé — então isso deixa de
ser eventual e vira certeza.

**Use `npm run build:check`**, que escreve em `.next-check` e é imune.
`npm run build` continua indo para `.next`, que é o que a Vercel espera, e só
deve ser usado com o vigilante desligado.

---

## Desligar

```powershell
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\VeloFunil - Central local.lnk"

Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -like '*manter-central-de-pe*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```
