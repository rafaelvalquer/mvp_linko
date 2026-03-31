# LuminorPay Layout Density Guidelines

## Objetivo
Manter a area autenticada com leitura rapida, menos ruído visual e hierarquia previsivel entre paginas operacionais, analiticas e de configuracao.

## Superficies
- `surface-panel`: bloco principal da pagina ou container de maior peso.
- `surface-elevated`: destaque principal de uma area importante, como criacao manual ou comparacao de planos.
- `surface-secondary`: grupos internos que precisam destaque moderado, como previews, side actions e configuracoes compostas.
- `surface-quiet`: linha secundaria, mini card, alerta suave, metrica complementar e bloco de apoio.

## Densidade por tipo de pagina
- Operacional: `Dashboard`, `Propostas`, `Agenda`, `Automações`.
  Use ate 1 faixa de destaque principal por tela e prefira listas/cards compactos com acoes diretas.
- Analitica: `Relatórios`, `Satisfação`.
  Priorize graficos e KPIs. Evite gradientes fortes em cards secundarios.
- Setup: `Configurações`, `Billing`.
  Organize em passos ou grupos claros. Use mais respiro vertical e menos elementos competindo.

## Espacamento
- Pagina: `space-y-6` como ritmo base.
- Dentro de cards principais: `space-y-5` ou `space-y-6`.
- Formularios: gap de `4` entre campos e `6` entre grupos.
- Listas operacionais: cards/linhas com `p-3` ou `p-4`; nao subir para `p-6` sem necessidade.

## Hierarquia visual
- Maximo de 1 CTA primario por bloco.
- Maximo de 1 area com gradiente forte por pagina.
- Status de sistema usam `Badge`; nao criar pills locais se o badge resolver.
- Alertas usam cor semantica:
  `emerald` para sucesso, `amber` para atencao, `rose` para erro, `sky` para informacao.

## Controles
- Inputs e selects devem usar `app-field`.
- Filtros e tabs devem parecer controles de navegacao, nao mini-cards promocionais.
- Quando houver muito detalhe, preferir accordion ou resumo expandivel antes de aumentar a densidade da tela.

## Estados vazios e mensagens
- Estado vazio principal usa `EmptyState`.
- Alertas inline usam `surface-quiet` + borda semantica.
- Mensagens de apoio devem ficar em `text-slate-500` ou `text-slate-300` no dark, nunca competir com o titulo.

## Dark mode
- Evitar branco puro em superfícies e chips.
- Reservar contraste alto para titulo, valor numerico e CTA principal.
- Linhas, bordas e backgrounds devem usar os tokens de superficie em vez de cores raw.
