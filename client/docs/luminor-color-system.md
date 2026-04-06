# LuminorPay Color System

## Objetivo
Documentar a paleta real do painel da LuminorPay para consulta rapida por design, produto e marketing. A fonte de verdade continua sendo [globals.css](/C:/Projetos/mvp_linko/client/src/styles/globals.css).

## Paleta principal
- `canvas`: `rgb(244, 247, 251)` | `#F4F7FB`
  Fundo geral da area autenticada.
- `canvas-accent`: `rgb(236, 242, 250)` | `#ECF2FA`
  Variacao suave do fundo para gradientes de pagina.
- `surface`: `rgb(255, 255, 255)` | `#FFFFFF`
  Card principal, modal claro e area de leitura mais importante.
- `surface-elevated`: `rgb(250, 252, 255)` | `#FAFCFF`
  Bloco premium, destaque principal e comparacoes.
- `surface-subtle`: `rgb(241, 245, 249)` | `#F1F5F9`
  Superficie secundaria, agrupamentos internos e apoio.
- `border`: `rgb(226, 232, 240)` | `#E2E8F0`
  Bordas padrao, divisores e contorno de cards.
- `text-primary`: `rgb(15, 23, 42)` | `#0F172A`
  Titulos, numeros, labels principais e texto de alta prioridade.
- `text-secondary`: `rgb(71, 85, 105)` | `#475569`
  Texto de apoio, descricoes, hints e microcopy secundaria.
- `brand-primary`: `rgb(37, 99, 235)` | `#2563EB`
  Cor principal da marca, CTA principal e foco de navegacao.
- `brand-secondary`: `rgb(13, 148, 136)` | `#0D9488`
  Apoio de marca, gradientes e reforco visual da identidade.

## Paleta dark
- `canvas`: `rgb(7, 13, 24)` | `#070D18`
  Fundo geral do app no tema escuro.
- `canvas-accent`: `rgb(12, 20, 36)` | `#0C1424`
  Variacao do fundo para profundidade e gradientes.
- `surface`: `rgb(15, 23, 42)` | `#0F172A`
  Card principal e container base.
- `surface-elevated`: `rgb(18, 28, 48)` | `#121C30`
  Area de destaque com mais contraste.
- `surface-subtle`: `rgb(24, 35, 57)` | `#182339`
  Bloco secundario, accordion, preview e apoio.
- `border`: `rgb(31, 42, 68)` | `#1F2A44`
  Bordas padrao no dark.
- `text-primary`: `rgb(241, 245, 249)` | `#F1F5F9`
  Titulos e texto de maior contraste.
- `text-secondary`: `rgb(203, 213, 225)` | `#CBD5E1`
  Texto de apoio e descricoes.
- `brand-primary`: `rgb(56, 189, 248)` | `#38BDF8`
  Cor principal da marca no dark.
- `brand-secondary`: `rgb(45, 212, 191)` | `#2DD4BF`
  Apoio de marca no dark e gradientes secundarios.

## Cores de status
- `success`: `rgb(5, 150, 105)` | `#059669`
  Sucesso, confirmacao, pagamento aprovado e fluxo concluido.
- `warning`: `rgb(217, 119, 6)` | `#D97706`
  Atencao, pendencia, prazo curto e estados aguardando acao.
- `danger`: `rgb(225, 29, 72)` | `#E11D48`
  Erro, rejeicao, bloqueio e risco real.
- `info`: `rgb(2, 132, 199)` | `#0284C7`
  Informacao, orientacao, status intermediario e apoio contextual.

### Equivalentes dark
- `success`: `rgb(52, 211, 153)` | `#34D399`
- `warning`: `rgb(251, 191, 36)` | `#FBBF24`
- `danger`: `rgb(251, 113, 133)` | `#FB7185`
- `info`: `rgb(56, 189, 248)` | `#38BDF8`

## Onde usar cada cor no produto
- Fundo geral:
  Use `canvas` e `canvas-accent`. Nao use cor de marca como fundo dominante de pagina inteira.
- Cards e superficies:
  Use `surface`, `surface-elevated` e `surface-subtle` para criar hierarquia antes de recorrer a gradiente forte.
- Texto:
  Use `text-primary` para titulos, KPIs e labels principais. Use `text-secondary` para descricao, hints e apoio.
- CTA principal:
  Use `brand-primary` como base principal, com `brand-secondary` apenas como apoio ou gradiente.
- Badges e alertas:
  Use as cores semanticas de status. Nao use azul de marca para comunicar erro ou sucesso.
- Estados de sucesso:
  Use `success` para pagamento confirmado, envio concluido, validacao aprovada e feedback positivo.
- Estados de atencao:
  Use `warning` para pendencias, aguardando comprovante, prazos e itens que exigem acompanhamento.
- Estados de erro:
  Use `danger` para falha, rejeicao, cancelamento e indisponibilidade real.
- Estados de informacao:
  Use `info` para orientacoes, status intermediario, passos do fluxo e mensagens neutras.

## Regras rapidas
- A cor principal da marca e `brand-primary`.
- A identidade da LuminorPay trabalha com a dupla `brand-primary` + `brand-secondary`.
- Cor de marca comunica identidade e navegacao; cor semantica comunica estado.
- Se um bloco estiver dizendo "deu certo", "faltou algo" ou "houve erro", use `success`, `warning` ou `danger`, nunca a cor da marca so por estetica.
- Em telas operacionais, prefira superficies neutras e reserve gradiente forte para CTA principal ou destaque unico da pagina.
