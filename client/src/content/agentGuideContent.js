export const AGENT_PREREQUISITES = [
  {
    title: "WhatsApp da conta cadastrado",
    description:
      "Use o numero salvo em Configuracoes > Conta para o sistema reconhecer quem esta enviando o comando.",
  },
  {
    title: "Plano elegivel",
    description:
      "O agente fica liberado para os planos Pro, Business e Enterprise. No Start, o guia continua visivel, mas o uso fica bloqueado.",
  },
  {
    title: "Ambiente do WhatsApp ativo",
    description:
      "O gateway e o servidor precisam estar ativos para receber textos, audios e devolver respostas no mesmo chat.",
  },
];

export const AGENT_CAPABILITIES = [
  {
    id: "offers",
    title: "Propostas",
    description:
      "Crie propostas por texto ou audio, com um ou varios itens, usando nome ou codigo de produto.",
    chips: ["Pro+", "Envio ao cliente", "Pode exigir confirmacao"],
    notes: [
      "Quando voce usa o codigo do produto, o agente reaproveita o preco cadastrado.",
      "Se faltar telefone, quantidade ou valor, o agente pergunta so o que ainda estiver pendente.",
    ],
    examples: [
      "Criar proposta para Rafael com 2 televisoes codigo 101010.",
      "Fazer proposta para Joana com suporte premium quantidade 3.",
      "Criar proposta para Rafael com 2 itens: televisao 1 e suporte 2.",
    ],
  },
  {
    id: "agenda",
    title: "Agenda",
    description:
      "Consulte a agenda do dia, da semana e o proximo compromisso. Tambem da para reagendar ou cancelar com confirmacao.",
    chips: ["Pro+", "Agenda do workspace", "Requer confirmacao em mudancas"],
    notes: [
      "Consultas como agenda de hoje, amanha e da semana respondem no mesmo chat e encerram o fluxo.",
      "Reagendar e cancelar mostram o horario atual e pedem CONFIRMAR antes de alterar o booking.",
    ],
    examples: [
      "Qual e a minha agenda de hoje?",
      "Me mostra a agenda da semana.",
      "Reagendar o proximo compromisso para 14:00.",
    ],
  },
  {
    id: "billing",
    title: "Cobranca e vendas",
    description:
      "Veja propostas pendentes, cobre um cliente especifico e cancele propostas com o mesmo fluxo seguro do backoffice.",
    chips: ["Pro+", "Lembretes", "Requer confirmacao"],
    notes: [
      "Consultas de pendencia mostram um snapshot do que ainda esta aguardando pagamento.",
      "Cobrar e cancelar proposta pedem confirmacao antes de enviar o lembrete ou mudar o status.",
    ],
    examples: [
      "Quais propostas estao aguardando pagamento hoje?",
      "Cobrar Joao da proposta de ontem.",
      "Cancelar proposta do Rafael.",
    ],
  },
  {
    id: "backoffice",
    title: "Cadastro e busca rapida",
    description:
      "Cadastre clientes, crie produtos, atualize preco e consulte telefone de cliente ou produto por nome e codigo.",
    chips: ["Pro+", "Backoffice", "Busca rapida"],
    notes: [
      "Criacao e atualizacao de dados pedem confirmacao final antes de gravar no workspace.",
      "Consultas de telefone e produto respondem no mesmo chat, sem abrir um fluxo longo.",
    ],
    examples: [
      "Crie um cliente Joao Silva, telefone 11999998888.",
      "Cadastrar o produto banana, com codigo 101010, no valor de 10 reais.",
      "Qual e o produto de codigo 101010?",
    ],
  },
];

export const AGENT_FAQ = [
  {
    question: "Quais planos liberam o agente?",
    answer:
      "O uso operacional do agente fica disponivel nos planos Pro, Business e Enterprise. O plano Start ve o guia, mas nao consegue executar comandos.",
  },
  {
    question: "Posso mandar audio em vez de texto?",
    answer:
      "Sim. Quando o ambiente esta pronto, o audio entra no mesmo pipeline do agente, incluindo criacao de proposta e consultas operacionais.",
  },
  {
    question: "Quando o sistema pede CONFIRMAR?",
    answer:
      "Sempre que a acao vai mudar algo importante, como enviar uma proposta, cobrar um cliente, reagendar, cancelar booking ou cancelar proposta.",
  },
  {
    question: "O que acontece se houver mais de um cliente, produto ou proposta parecida?",
    answer:
      "O agente nao escolhe sozinho. Ele responde com uma lista numerada e espera voce indicar 1, 2, 3 ou CANCELAR.",
  },
  {
    question: "Posso usar codigo do produto nas propostas e consultas?",
    answer:
      "Sim. Quando o codigo existe no workspace, o agente usa esse cadastro como fonte de verdade, inclusive para reaproveitar o preco do produto.",
  },
  {
    question: "Como evitar erro de reconhecimento?",
    answer:
      "Mantenha o WhatsApp da conta atualizado, cite o nome do cliente ou o codigo do produto e evite misturar duas tarefas diferentes na mesma mensagem.",
  },
];

export const AGENT_BEST_PRACTICES = [
  "Envie uma tarefa por vez: proposta, agenda, cobranca ou cadastro.",
  "Quando existir codigo de produto, prefira citar o codigo para acelerar a resolucao.",
  "Se o agente responder com uma lista numerada, responda so com o numero ou com CONFIRMAR/CANCELAR.",
  "Use mensagens objetivas, com cliente, quantidade e horario sempre que possivel.",
];
