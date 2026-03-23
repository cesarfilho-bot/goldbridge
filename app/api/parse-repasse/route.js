export async function POST(req) {
  const { files } = await req.json();

  const prompt = `Você é um extrator de dados de extratos de repasse imobiliário brasileiro.

Extraia TODOS os campos deste extrato e retorne APENAS um JSON válido, sem texto antes ou depois.

Formato esperado:
{
  "numero_contrato": "string",
  "endereco_imovel": "string",
  "imobiliaria": "string",
  "cnpj_imobiliaria": "string",
  "locatario": "string",
  "cpf_locatario": "string",
  "competencia": "MM/AAAA",
  "data_pagamento": "DD/MM/AAAA",
  "data_repasse": "DD/MM/AAAA",
  "taxa_administracao_percentual": null,
  "itens": [
    {
      "descricao": "nome exato como aparece no documento",
      "valor": 0,
      "tipo": "credito",
      "observacao": null
    }
  ],
  "total_repasse": 0
}

Regras:
- Valores positivos no documento = credito
- Valores negativos no documento = debito
- Preservar a descrição EXATAMENTE como aparece no documento
- competencia no formato MM/AAAA (ex: "01/2026")
- Datas no formato DD/MM/AAAA
- Valores numéricos sem R$ e sem pontos de milhar (ex: 1397.21)
- Se um campo não existir no documento, usar null
- Incluir TODOS os itens da seção de repasse sem exceção`;

  const results = await Promise.all(
    files.map(async (f) => {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-opus-4-6",
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "document",
                    source: {
                      type: "base64",
                      media_type: "application/pdf",
                      data: f.base64,
                    },
                  },
                  { type: "text", text: prompt },
                ],
              },
            ],
          }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        const text = data.content?.[0]?.text || "";
        const clean = text.replace(/```json|```/g, "").trim();
        return { fileName: f.name, dados: JSON.parse(clean), error: null };
      } catch (e) {
        return { fileName: f.name, dados: null, error: e.message };
      }
    })
  );

  return Response.json({ results });
}
