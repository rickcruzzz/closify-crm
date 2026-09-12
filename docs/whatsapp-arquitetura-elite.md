# ARQUITETURA: WhatsApp Integrado como Feature Premium (Velo Funil)

**Data**: 2026-09-12  
**Status**: Pronto para implementação  
**Versão**: 1.0

---

## 🎯 OBJETIVO

Implementar WhatsApp integrado seguro, usando Evolution API, separando completamente:
1. **Chat Manual** (cliente controla tudo)
2. **Automação de Disparos** (email/SMS separado, nunca WhatsApp)
3. **Bot do Sistema** (número 71993309404 - empresa, nunca cliente)

---

## 📋 CONTEXTO DO PROJETO

### Ambiente Atual:
- **Tech**: Next.js 14, TypeScript, Supabase, Resend, Asaas
- **Database**: PostgreSQL com RLS isolado por workspace
- **Infraestrutura**: Vercel (frontend), VPS Hostinger (n8n + Evolution)
- **Autenticação**: Supabase Auth (Google + Email/Senha)
- **Números de Cliente Existente**: 27 nichos, PMEs de serviço no Brasil
- **Status Atual**: Evolution tá na VPS, conversas já existem, falta apenas implementar o transporte

### Dados Existentes:
- Tabela `conversas` (já existe, vazia de mensagens)
- `public.conversas` (id, workspace_id, contact_phone, last_message, assigned_to)
- Nenhuma tabela de mensagens = oportunidade pra migrar direto

### Número da Empresa (CONSTANTE, NÃO MUDA):
- **WhatsApp da Velo Funil**: +55 71 99330-9404
- **Uso**: Apenas como "sender" de notificações do sistema (não é chat)
- **Separação**: Nunca mistura com chats de clientes

---

## 🏗️ ARQUITETURA PROPOSTA

### LAYER 1: Database Schema (Migrations)

#### Tabela 1: `whatsapp_connections`

Armazena conexão do número de cada cliente.

```sql
CREATE TABLE whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Número conectado (cliente pode conectar o seu)
  phone_number text NOT NULL UNIQUE,
  
  -- Evolution identifiers
  evolution_instance_id text NOT NULL UNIQUE,
  evolution_token text NOT NULL, -- ENCRYPTED com AES-256-GCM
  
  -- Status & Health
  status text CHECK (status IN ('connected', 'disconnected', 'error', 'waiting_qrcode')),
  last_health_check_at timestamp,
  last_error_message text,
  error_count int DEFAULT 0,
  
  -- Rate limiting
  messages_sent_today int DEFAULT 0,
  messages_sent_this_hour int DEFAULT 0,
  last_message_sent_at timestamp,
  
  -- Metadata
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  
  -- Indexes
  INDEX idx_workspace_id (workspace_id),
  INDEX idx_phone_number (phone_number),
  INDEX idx_status (status)
);

-- Enable RLS
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their workspace connections"
  ON whatsapp_connections
  FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members 
    WHERE user_id = auth.uid()
  ));
```

#### Tabela 2: `whatsapp_conversations`

Redefine conversas para WhatsApp.

```sql
CREATE TABLE whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Participantes
  client_phone text NOT NULL,
  client_name text,
  client_profile_pic_url text,
  
  -- Contexto de negócio
  linked_deal_id uuid REFERENCES deals(id),
  linked_lead_id uuid REFERENCES leads(id),
  
  -- Atribuição
  assigned_to_member_id uuid REFERENCES workspace_members(id),
  
  -- Status da conversa
  status text CHECK (status IN ('active', 'archived', 'blocked')),
  
  -- Metadados
  last_message_text text,
  last_message_at timestamp,
  unread_count int DEFAULT 0,
  
  -- Marcas de tempo
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  
  -- Constraints
  UNIQUE(workspace_id, client_phone),
  INDEX idx_workspace_id (workspace_id),
  INDEX idx_client_phone (client_phone),
  INDEX idx_assigned_to (assigned_to_member_id),
  INDEX idx_status (status),
  INDEX idx_updated_at (updated_at DESC)
);

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access conversations in their workspace"
  ON whatsapp_conversations
  FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members 
    WHERE user_id = auth.uid()
  ));
```

#### Tabela 3: `whatsapp_messages`

Armazena mensagens.

```sql
CREATE TABLE whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id), -- Denormalized para performance
  
  -- Conteúdo
  message_text text,
  media_type text CHECK (media_type IN ('text', 'image', 'video', 'audio', 'document', 'location')),
  media_url text,
  media_size_bytes int,
  
  -- Direção
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_phone text NOT NULL,
  to_phone text NOT NULL,
  
  -- Status
  status text CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'pending')),
  failed_reason text,
  
  -- Evolution metadata
  evolution_message_id text UNIQUE,
  
  -- Timestamps
  sent_at timestamp,
  delivered_at timestamp,
  read_at timestamp,
  created_at timestamp DEFAULT now(),
  
  -- Indexes
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_workspace_id (workspace_id),
  INDEX idx_direction (direction),
  INDEX idx_status (status),
  INDEX idx_sent_at (sent_at DESC)
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access messages in their workspace"
  ON whatsapp_messages
  FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members 
    WHERE user_id = auth.uid()
  ));
```

#### Tabela 4: `whatsapp_rate_limits`

Rate limiting por workspace.

```sql
CREATE TABLE whatsapp_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id),
  
  -- Contadores
  messages_sent_today int DEFAULT 0,
  messages_sent_this_hour int DEFAULT 0,
  last_reset_at timestamp DEFAULT now(),
  
  -- Status
  is_rate_limited boolean DEFAULT false,
  rate_limit_reason text,
  rate_limit_until timestamp,
  
  -- Metadata
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Trigger para resetar contadores diariamente
CREATE OR REPLACE FUNCTION reset_daily_rate_limits()
RETURNS void AS $$
BEGIN
  UPDATE whatsapp_rate_limits
  SET messages_sent_today = 0,
      last_reset_at = now()
  WHERE last_reset_at < (now() - INTERVAL '1 day');
END;
$$ LANGUAGE plpgsql;
```

---

### LAYER 2: API Routes

#### 1. QR Code Generation
**`app/api/integrations/whatsapp/qrcode/route.ts`**

```
POST /api/integrations/whatsapp/qrcode

Request:
{
  workspace_id: string
}

Response (200):
{
  qrcode: string (base64),
  instance_id: string,
  expires_at: timestamp (30 segundos),
  instructions: "Escaneia com câmera do WhatsApp"
}

Response (409):
{
  error: "Already connected",
  phone: "+55 71 99330-9404"
}

Logic:
1. Valida que workspace não tem conexão ativa
2. Chama Evolution API: POST /qr-code/generate
3. Armazena instance_id em cache (Redis, 30s)
4. Retorna base64 do QR code
5. Frontend mostra QR code em modal
6. Cliente escaneia
7. Webhook recebe confirmação
```

#### 2. Webhook - Receber Mensagens
**`app/api/webhooks/whatsapp/route.ts`**

```
POST /api/webhooks/whatsapp

Request (do Evolution):
{
  event: "messages.upsert",
  data: {
    remoteJid: "5571987654321@s.whatsapp.net",
    message: {
      conversation: "Oi, qual o preço?",
      extendedTextMessage: { text: "..." }
    },
    status: "ACK",
    messageTimestamp: 1694534400
  }
}

Logic (CRÍTICO PARA SEGURANÇA):
1. Valida assinatura do webhook (HMAC-SHA256)
2. Se evento duplicado (via evolution_message_id): ignora
3. Extrai phone do remoteJid
4. Encontra workspace by phone
5. Encontra ou cria conversa
6. Salva mensagem no banco
7. Atualiza whatsapp_conversations.unread_count
8. Emite WebSocket: "new-message"
9. NUNCA responde automaticamente
10. Log tudo em error_logs (auditoria)
```

#### 3. Enviar Mensagem (Manual)
**`app/api/integrations/whatsapp/send/route.ts`**

```
POST /api/integrations/whatsapp/send

Request:
{
  conversation_id: string,
  message_text: string,
  media_url?: string,
  media_type?: "image" | "video" | "audio" | "document"
}

Response (200):
{
  message_id: string,
  status: "sent",
  sent_at: timestamp
}

Response (429):
{
  error: "Rate limit exceeded",
  retry_after_seconds: 60,
  messages_remaining_today: 95
}

Logic (RATE LIMIT CHECK):
1. Valida token/autenticação
2. Encontra conversa + workspace
3. Checa rate limit:
   - Max 5 msgs/min por conversa
   - Max 100 msgs/hora por workspace
   - Max 1000 msgs/dia por workspace
4. Se excedeu: retorna 429 (não envia)
5. Salva mensagem no banco (status: "pending")
6. Chama Evolution API: POST /send/text
7. Se sucesso: atualiza status para "sent"
8. Se falha: status "failed" + razão
9. Emite WebSocket: "message-sent"
```

#### 4. Desconectar
**`app/api/integrations/whatsapp/disconnect/route.ts`**

```
POST /api/integrations/whatsapp/disconnect

Logic:
1. Valida workspace
2. Encontra whatsapp_connection
3. Chama Evolution API: DELETE /logout
4. Deleta token criptografado do banco
5. Atualiza status para "disconnected"
6. Soft-delete conversas (não perde dados)
```

---

### LAYER 3: Server Actions (Lógica Pura)

#### `lib/whatsapp/rate-limiter.ts`

```typescript
export async function checkRateLimit(
  workspaceId: string,
  conversationId: string
): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
  // Checa limite POR CONVERSA (max 5/min)
  // Checa limite POR WORKSPACE (max 100/hora, 1000/dia)
  // Retorna decisão
}

export async function incrementMessageCount(
  workspaceId: string
): Promise<void> {
  // Incrementa contadores
  // Se excedeu, marca rate_limit como ativo
}
```

#### `lib/whatsapp/safe-connection.ts`

```typescript
export async function validateConnection(
  workspaceId: string
): Promise<{ valid: boolean; reason?: string; phone?: string }> {
  // Verifica se conexão tá ativa
  // Faz health check com Evolution
  // Se offline: marca como error + notifica
}

export async function encryptToken(
  plainToken: string
): Promise<string> {
  // AES-256-GCM
  // Chave do .env (NÃO é hardcoded)
}

export async function decryptToken(
  encryptedToken: string
): Promise<string> {
  // Descriptografa pra usar com Evolution
}
```

#### `lib/whatsapp/webhook-validator.ts`

```typescript
export async function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // HMAC-SHA256 validation
  // Crítico: se signature inválida, descarta
}

export async function deduplicateMessage(
  evolutionMessageId: string
): Promise<boolean> {
  // Checa se message_id já existe no banco
  // Se sim: return false (ignorar duplicado)
  // Se não: return true (processar)
}
```

---

### LAYER 4: Frontend Components

#### `components/conversas/whatsapp-qrcode-modal.tsx`

Modal que mostra QR code.

```typescript
// Modal que mostra:
// 1. "Clica pra gerar QR code"
// 2. Carregando...
// 3. Mostra QR code (base64 como imagem)
// 4. "Escaneia com câmera do WhatsApp"
// 5. Quando conecta: "✅ Conectado! +55 71 99330-9404"

export function WhatsAppQRCodeModal() {
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const generateQR = async () => {
    setLoading(true);
    const res = await fetch('/api/integrations/whatsapp/qrcode', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId })
    });
    const { qrcode } = await res.json();
    setQrcode(qrcode);
    setLoading(false);
  };

  return (
    <Dialog>
      <DialogTrigger>Conectar WhatsApp</DialogTrigger>
      <DialogContent>
        {!connected ? (
          <>
            <h2>Conecte seu WhatsApp</h2>
            {!qrcode && <Button onClick={generateQR}>Gerar QR Code</Button>}
            {qrcode && <img src={`data:image/png;base64,${qrcode}`} />}
            {loading && <Spinner />}
          </>
        ) : (
          <p>✅ Conectado com sucesso!</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

#### `components/conversas/messages-list.tsx`

Lista mensagens da conversa.

```typescript
// Lista mensagens:
// 1. Mostras de mais antiga até mais recente
// 2. Grupos por data (Today, Yesterday, etc)
// 3. Status de entrega (enviada, entregue, lida)
// 4. Nome + foto do cliente no topo
// 5. Carrega histórico quando scroller ao topo

export function MessagesList({ conversationId }: { conversationId: string }) {
  const { data: messages, isLoading } = useQuery(...);
  
  return (
    <div className="flex flex-col-reverse">
      {/* Inverted porque mais novo no bottom */}
      {messages?.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  );
}
```

#### `components/conversas/message-input.tsx`

Input para digitar mensagem.

```typescript
// Input que:
// 1. Digita mensagem
// 2. Mostra rate limit warning (se perto do limite)
// 3. Envia com Ctrl+Enter ou clique
// 4. Mostra "Enviando..." enquanto envia
// 5. Se erro: "Falha ao enviar. Tenta de novo?"

export function MessageInput({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setLoading(true);
    try {
      await fetch('/api/integrations/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: conversationId, message_text: text })
      });
      setText('');
    } catch (err: any) {
      if (err.status === 429) {
        setError(`Rate limit. Retry em ${err.retryAfter}s`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <textarea 
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
        placeholder="Digita aí..."
      />
      <button onClick={send} disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar'}
      </button>
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
}
```

#### `components/conversas/conversations-list.tsx`

Lista conversas ordenadas.

```typescript
// Lista conversas ORDENADAS POR:
// 1. Quem espera há mais tempo (last_message_at DESC)
// 2. Unread_count (não lidos primeiro)
// 3. Assigned_to (filtro opcional)
// 4. Status (ativas primeiro)

export function ConversationsList() {
  const { data: conversations } = useQuery(...);

  const sorted = conversations
    ?.sort((a, b) => {
      if (a.unread_count > 0 && b.unread_count === 0) return -1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  return (
    <div>
      {sorted?.map((conv) => (
        <ConversationItem key={conv.id} conversation={conv} />
      ))}
    </div>
  );
}
```

---

### LAYER 5: Real-time Updates (WebSocket)

```typescript
// `lib/whatsapp/websocket.ts`

// Cliente se conecta:
const ws = new WebSocket('wss://seu-dominio.com/api/ws');

// Servidor emite:
ws.send({
  type: 'new-message',
  conversation_id: 'xyz',
  message: { text: '...', sent_at: '...' }
});

// Cliente atualiza UI em tempo real
```

---

### LAYER 6: Cron Jobs (Health Checks)

```typescript
// `app/api/cron/whatsapp-health-check/route.ts`

// Roda a cada 5 minutos:
// 1. Encontra todas as conexões ativas
// 2. Faz POST /status na Evolution
// 3. Se offline: marca como error
// 4. Notifica workspace: "Sua conexão caiu"
// 5. Oferece reconectar

export async function GET(req: Request) {
  const connections = await db
    .from('whatsapp_connections')
    .select('*')
    .eq('status', 'connected');

  for (const conn of connections) {
    try {
      const status = await fetch(
        `${EVOLUTION_URL}/status`,
        { headers: { Authorization: `Bearer ${decryptToken(conn.token)}` } }
      );
      if (!status.ok) {
        await updateConnectionStatus(conn.id, 'error');
      }
    } catch (err) {
      await updateConnectionStatus(conn.id, 'error', err.message);
    }
  }

  return Response.json({ ok: true });
}
```

---

## 🛡️ SEGURANÇA & COMPLIANCE

### O QUE NUNCA FAZ:
- ❌ Envio automático de mensagem (SEM cliente apertar botão)
- ❌ Bot de resposta automática
- ❌ Broadcast/marketing via WhatsApp
- ❌ Compartilhar número entre clientes
- ❌ Reutilizar Evolution instance
- ❌ Armazenar token sem criptografia
- ❌ Ignorar rate limit (Meta detecta)
- ❌ Violar ToS da Meta

### O QUE SEMPRE FAZ:
- ✅ Cliente conecta seu próprio número (não o seu)
- ✅ Cada workspace = 1 número
- ✅ Token criptografado no banco (AES-256-GCM)
- ✅ Rate limit rigoroso (5/min, 100/h, 1000/dia)
- ✅ Webhook com validação de assinatura (HMAC)
- ✅ Logging completo em error_logs (auditoria)
- ✅ Fallback pra wa.me se Evolution falhar
- ✅ Health check a cada 5 minutos
- ✅ Documentação clara de ToS
- ✅ Cliente aceita risco: "Meta pode bloquear"

---

## 📊 DIFERENCIAÇÃO (O QUE VENDE)

| FEATURE | VOCÊ | AGENDOR | PIPEDRIVE |
|---------|------|---------|-----------|
| Chat WhatsApp integrado | ✅ | ❌ Pago | ❌ Pago |
| Ordenação por urgência | ✅ | ❌ | ❌ |
| Histórico de cliente antigo | ✅ | ❌ | ❌ |
| Google Calendar integrado | ✅ | ❌ Pago | ❌ Pago |
| Templates com autocomplete | ✅ | ⚠️ Básico | ❌ |
| Preço | R$97 | R$265 | R$300+ |

---

## 🚀 IMPLEMENTAÇÃO (ROADMAP)

### MVP (Semana 1):
- [ ] Tabelas database
- [ ] QR code generation
- [ ] Receber mensagens (webhook)
- [ ] Enviar mensagens (manual)
- [ ] UI básica (lista + input)
- [ ] Rate limiting
- [ ] Webhook validation

### Phase 1 (Semana 2):
- [ ] Status em tempo real (online/offline/digitando)
- [ ] Transferência automática
- [ ] Integração com deals
- [ ] Histórico de números antigos
- [ ] Health check cron

### Phase 2 (Semana 3):
- [ ] Google Calendar (agendar direto)
- [ ] Templates com variáveis
- [ ] Autocomplete
- [ ] Analytics (tempo resposta, msgs/dia)

---

## 📋 NÚMEROS DA EMPRESA (NEVER CHANGE)

```
WhatsApp Velo Funil: +55 71 99330-9404
Uso: Notificações do sistema APENAS
Separação: Nunca mistura com chats de clientes
Segurança: Token único, armazenado criptografado
```

---

## ✅ CHECKLIST DE LANÇAMENTO

- [ ] Documentação completa (como conectar, limitações, ToS)
- [ ] Modal de aviso: "Meta pode bloquear seu número"
- [ ] Botão de desconectar (limpa tudo)
- [ ] Testes com 5 clientes reais
- [ ] Monitoramento de erros 24/7
- [ ] SLA: "Se cair, enviamos email em 1h"
- [ ] Fallback automático pra wa.me
- [ ] Dashboard de saúde (admin view)

---

## 🎯 POSITIONING (Copy)

**Headline:**
"Chats do WhatsApp direto no seu CRM. Seu número, suas conversas, nenhuma automação."

**Benefits:**
- ✅ Responda do Velo (não abre WhatsApp)
- ✅ Seu número (Meta não bloqueia)
- ✅ Conversas organizadas por urgência
- ✅ Histórico de cliente integrado
- ✅ Agende reunião com 1 clique

**Diferencial:**
"Agendor cobra R$ 265/mês. Nós cobramos R$ 97 e oferecemos 3x mais."

---

## 💬 QUESTÕES RESPONDIDAS

**P: E se Meta bloquear meu número?**
A: Você continua recebendo via wa.me link (nunca falha). Reconecta quando Meta liberar.

**P: Meus dados são seguros?**
A: Sim. Dados isolados por RLS. Tokens criptografados. Confira nossa Política de Privacidade.

**P: Qual o limite de mensagens?**
A: Meta varia. Oferecemos rate limiting conservador (5/min, 100/h, 1000/dia) pra segurança.

**P: Posso usar pra marketing?**
A: Não. Apenas para chats 1:1. Marketing usa Brevo (email).

---

## 📝 COMO USAR ESSE DOCUMENTO

1. **Copie este arquivo**
2. **Passe pro Claude Code com o prompt**
3. **Diga:** "Arquitete isso pra mim. Cria os arquivos scaffolded (comentados, sem implementação ainda)"
4. **Claude Code vai:**
   - Criar estrutura de pastas
   - Gerar migrations SQL
   - Gerar routes (vazio/comentado)
   - Gerar components (vazio/comentado)
   - Gerar server actions
   - Criar documentação

5. **Depois você volta e diz:** "Agora implementa a Fase 1 (QR code + receber + enviar)"

---

## 🎯 O Que Esse Documento Garante:

- ✅ **Segurança**: Separação clara, rate limiting, encryption
- ✅ **Compliance**: Sem automação agressiva, ToS respeitado
- ✅ **Performance**: Índices no banco, WebSocket real-time
- ✅ **Escalabilidade**: Multi-tenant com RLS
- ✅ **Posicionamento**: Elite SaaS B2B, não spamware
- ✅ **Número separado**: 71993309404 nunca mistura com clientes
- ✅ **Dados prontos**: Já tem conversas, só migra

---

**Versão**: 1.0  
**Data**: 12/09/2026  
**Status**: ✅ Pronto para Claude Code
