export async function POST(req) {
  const { conteudo } = await req.json();

  if (!conteudo || conteudo.trim().length < 5) {
    return Response.json({ error: { message: "Conteúdo vazio" } }, { status: 400 });
  }

  const prompt = `Você é um especialista em importação de dados imobiliários.

Analise esta planilha e extraia os dados de cada imóvel.
Retorne APENAS um JSON válido, sem texto antes ou depois.

Campos obrigatórios (tentar encontrar sempre):
- endereco: endereço completo do imóvel
- tipo: tipo do imóvel (use um destes: Apartamento, Casa, Casa de Condomínio, Sala Comercial, Industrial, Loja, Galpão, Salão Comercial, Terreno)
- aluguel: valor do aluguel mensal em reais (número)
- iptu: valor do IPTU anual em reais (número)
- status: "ocupado" ou "vago"

Campos opcionais (incluir se existirem):
- valor_compra: valor de aquisição do imóvel (número)
- condominio: valor do condomínio mensal (número)
- inquilino: nome do inquilino atual
- taxa_administracao: percentual da taxa de administração (número)
- area_m2: área em metros quadrados (número)

Formato de retorno:
{
  "total_encontrados": number,
  "campos_identificados": ["lista dos campos que encontrou"],
  "campos_nao_mapeados": ["colunas que não conseguiu identificar"],
  "imoveis": [
    {
      "endereco": "string",
      "tipo": "string",
      "aluguel": number ou null,
      "iptu": number ou null,
      "status": "ocupado" ou "vago",
      "valor_compra": number ou null,
      "condominio": number ou null,
      "inquilino": "string" ou null,
      "taxa_administracao": number ou null,
      "area_m2": number ou null
    }
  ],
  "avisos": ["lista de problemas ou inconsistências encontradas"]
}

Planilha:
${conteudo}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  return Response.json(data);
}
