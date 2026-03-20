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

function buildIntentRoutingInstructions() {
  return [
    "Voce e um classificador de intencao para um agente de WhatsApp da Luminor Pay.",
    "Leia mensagens em pt-BR.",
    "Responda somente com JSON valido e sem markdown.",
    "Classifique se a mensagem e sobre criar proposta, consultar agenda diaria, consultar agenda semanal, consultar proximo compromisso, reagendar compromisso, cancelar agendamento, consultar propostas pendentes, cobrar cliente de uma proposta, cancelar proposta, ou se esta ambigua.",
    "Retorne ambiguous_offer_or_agenda quando houver duvida real entre os dois fluxos.",
    "Retorne ambiguous_booking_operation quando houver duvida real entre consultar agenda e operar um agendamento.",
    "Retorne ambiguous_offer_sales_operation quando houver duvida real entre consultar pendentes, cobrar cliente ou cancelar proposta.",
    "Retorne unknown quando a mensagem nao estiver relacionada a proposta nem agenda.",
    "source_text deve refletir a compreensao final do texto informado.",
  ].join("\n");
}

function buildAgendaInstructions() {
  return [
    "Voce e um extrator de data para consultas de agenda por WhatsApp.",
    "Leia mensagens em pt-BR.",
    "Responda somente com JSON valido e sem markdown.",
    "Extraia apenas a referencia de dia solicitada.",
    "Se a mensagem pedir hoje, retorne requested_day_kind=today.",
    "Se a mensagem pedir amanha, retorne requested_day_kind=tomorrow.",
    "Se houver uma data explicita, retorne requested_day_kind=explicit_date e preencha requested_date_iso em YYYY-MM-DD.",
    "Se nao houver dia claro, retorne requested_day_kind=unspecified e requested_date_iso vazio.",
    "Nao invente datas ausentes.",
    "source_text deve refletir a compreensao final do texto informado.",
  ].join("\n");
}

function buildBookingOperationInstructions() {
  return [
    "Voce e um extrator de parametros para operacoes de agenda por WhatsApp.",
    "Leia mensagens em pt-BR.",
    "Responda somente com JSON valido e sem markdown.",
    "Extraia apenas parametros operacionais de reagendamento, cancelamento ou consulta do proximo compromisso.",
    "Use target_reference=next quando a mensagem mencionar o proximo compromisso ou o proximo agendamento.",
    "Use target_reference=explicit quando houver cliente, data ou hora suficientes para apontar um compromisso especifico.",
    "Se nao houver referencia clara ao booking alvo, use target_reference=unspecified.",
    "target_time_hhmm e new_time_hhmm devem vir em HH:MM.",
    "new_date_iso e new_time_hhmm so devem ser preenchidos quando o usuario informar o novo horario.",
    "Nao invente data ou hora ausentes.",
    "source_text deve refletir a compreensao final do texto informado.",
  ].join("\n");
}

function buildOfferSalesOperationInstructions() {
  return [
    "Voce e um extrator de parametros para cobranca e vendas por WhatsApp.",
    "Leia mensagens em pt-BR.",
    "Responda somente com JSON valido e sem markdown.",
    "Extraia apenas parametros operacionais para consultar propostas pendentes, cobrar cliente de uma proposta ou cancelar proposta.",
    "target_customer_name deve ser preenchido apenas quando o usuario mencionar o cliente.",
    "Use target_created_day_kind=today, yesterday, last_week, explicit_date ou unspecified.",
    "Se houver uma data explicita, preencha target_created_date_iso em YYYY-MM-DD.",
    "Se nao houver referencia temporal clara, use target_created_day_kind=unspecified e target_created_date_iso vazio.",
    "Nao invente cliente nem data ausentes.",
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

export function buildIntentRoutingPrompt({ text }) {
  return {
    systemPrompt: buildIntentRoutingInstructions(),
    userPrompt: [`Texto do usuario:`, String(text || "").trim() || "(vazio)"].join("\n"),
  };
}

export function buildAgendaDateExtractionPrompt({
  text,
  todayDateIso,
  timeZone,
}) {
  return {
    systemPrompt: buildAgendaInstructions(),
    userPrompt: [
      `Timezone de referencia: ${String(timeZone || "America/Sao_Paulo").trim()}`,
      `Data de hoje na timezone: ${String(todayDateIso || "").trim() || "(desconhecida)"}`,
      `Mensagem do usuario: ${String(text || "").trim() || "(vazio)"}`,
    ].join("\n"),
  };
}

export function buildBookingOperationPrompt({
  text,
  todayDateIso,
  timeZone,
}) {
  return {
    systemPrompt: buildBookingOperationInstructions(),
    userPrompt: [
      `Timezone de referencia: ${String(timeZone || "America/Sao_Paulo").trim()}`,
      `Data de hoje na timezone: ${String(todayDateIso || "").trim() || "(desconhecida)"}`,
      `Mensagem do usuario: ${String(text || "").trim() || "(vazio)"}`,
    ].join("\n"),
  };
}

export function buildOfferSalesOperationPrompt({
  text,
  todayDateIso,
  timeZone,
}) {
  return {
    systemPrompt: buildOfferSalesOperationInstructions(),
    userPrompt: [
      `Timezone de referencia: ${String(timeZone || "America/Sao_Paulo").trim()}`,
      `Data de hoje na timezone: ${String(todayDateIso || "").trim() || "(desconhecida)"}`,
      `Mensagem do usuario: ${String(text || "").trim() || "(vazio)"}`,
    ].join("\n"),
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
