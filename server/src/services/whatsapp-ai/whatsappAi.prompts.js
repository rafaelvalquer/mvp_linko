function buildSharedInstructions() {
  return [
    "Voce e um extrator de parametros para criacao de proposta por WhatsApp.",
    "Leia mensagens em pt-BR.",
    "Responda somente com JSON valido e sem markdown.",
    "Nao invente valores ausentes.",
    "Nao consulte banco, nao resolva ambiguidades de cliente/produto e nao escolha entre opcoes.",
    "Nao invente telefone de destino.",
    "Converta valores monetarios para centavos em unit_price_cents.",
    "Extraia todos os itens mencionados em um array items.",
    "Cada item deve conter product_name_raw, quantity e unit_price_cents.",
    "Se houver pelo menos um item, copie os dados do primeiro item para os campos top-level product_name_raw, quantity e unit_price_cents.",
    "quantity e obrigatoria em cada item e nao pode receber default automatico.",
    "destination_phone_n11 deve vir com exatamente 11 digitos, sem +55.",
    "Campos ausentes devem permanecer vazios ou null.",
    "source_text deve refletir a compreensao final do texto informado.",
  ].join("\n");
}

export function buildFreshExtractionPrompt({ text }) {
  return {
    systemPrompt: [
      buildSharedInstructions(),
      "Se a mensagem nao for um pedido claro de criar proposta e enviar por WhatsApp, retorne intent=unknown.",
      "Quando identificar o pedido, use intent=create_offer_send_whatsapp e send_via_whatsapp=true.",
    ].join("\n\n"),
    userPrompt: [`Texto do usuario:`, String(text || "").trim() || "(vazio)"].join("\n"),
  };
}

export function buildContinuationExtractionPrompt({
  text,
  lastQuestionKey,
  pendingFields = [],
  currentResolved = {},
}) {
  return {
    systemPrompt: [
      buildSharedInstructions(),
      "Esta e uma continuacao de uma sessao ja existente.",
      "Interprete respostas curtas usando a pergunta pendente e os campos faltantes.",
      "Preencha apenas os campos realmente respondidos nesta mensagem.",
      "Mantenha intent=create_offer_send_whatsapp quando a resposta fizer parte da sessao atual.",
    ].join("\n\n"),
    userPrompt: [
      `Pergunta pendente: ${String(lastQuestionKey || "").trim() || "(nenhuma)"}`,
      `Campos pendentes: ${
        Array.isArray(pendingFields) && pendingFields.length
          ? pendingFields.join(", ")
          : "(nenhum)"
      }`,
      `Rascunho atual: ${JSON.stringify(currentResolved || {})}`,
      `Resposta do usuario: ${String(text || "").trim() || "(vazio)"}`,
    ].join("\n"),
  };
}
