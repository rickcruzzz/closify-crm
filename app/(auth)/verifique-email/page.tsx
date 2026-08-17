import { Card, CardHeader } from '@/components/ui/card'
import { VerifiqueEmailClient } from '@/components/auth/verifique-email-client'
import { lerEmailPendente } from '@/lib/auth/intencao'

/**
 * Tela de espera da confirmação de cadastro.
 *
 * Era um beco sem saída: não dizia para onde o e-mail tinha ido e não oferecia
 * nada além de "Entrar". E-mail que cai no spam, ou endereço digitado errado,
 * significava cadastro perdido sem recurso, e tentar de novo esbarra no
 * "e-mail já existe" do Supabase.
 *
 * O endereço vem do cookie gravado pela `signUp`, não da URL: em querystring
 * ele apareceria no histórico do navegador e no cabeçalho `Referer` de toda
 * requisição feita a partir daqui.
 */
export default async function VerifiqueEmailPage() {
  const email = await lerEmailPendente()

  return (
    <Card>
      <CardHeader className="items-center">
        <VerifiqueEmailClient email={email} />
      </CardHeader>
    </Card>
  )
}
