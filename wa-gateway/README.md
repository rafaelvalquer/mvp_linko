# wa-gateway (MVP)

Microservico local (sem Docker) para envio de notificacoes via WhatsApp usando `whatsapp-web.js`.

## Requisitos
- Node.js LTS
- Google Chrome instalado no Windows

## Instalacao
```bash
cd wa-gateway
npm i
copy .env.example .env
```

Edite `.env` e defina pelo menos:
- `WA_API_KEY` para proteger `/status` e `/send`
- `WA_PORT` (default `3010`)
- `WA_SESSION_PATH` com caminho absoluto estavel
- `WA_CHROME_PATH` apontando para o Chrome instalado
- `WA_CLIENT_ID` para fixar o perfil do `LocalAuth`

## Executar
```bash
npm start
```

Ao iniciar:
- O QR Code aparece no console.
- Escaneie no WhatsApp em **Dispositivos conectados**.
- Apos conectar, voce vera `WhatsApp READY: <numero>`.

## Testar status
```bash
curl -H "x-api-key: change-me" http://localhost:3010/status
```

## Enviar mensagem
```bash
curl -X POST http://localhost:3010/send \
  -H "content-type: application/json" \
  -H "x-api-key: change-me" \
  -d '{ "to":"11999999999", "message":"Pagamento confirmado" }'
```

## Observacoes
- A sessao e persistida em `WA_SESSION_PATH` via `LocalAuth`.
- No Windows, prefira um diretorio fora do repositorio, por exemplo `C:\LuminorPay\wa-session`.
- Apos mudar o `WA_SESSION_PATH`, faca um novo pareamento lendo o QR uma unica vez.
- Use sempre o mesmo diretorio de execucao do `wa-gateway`.
- Nao exponha esse servico publicamente.
- Se houver erro do Puppeteer, confira `WA_CHROME_PATH` e evite limpar ou sincronizar a pasta da sessao.
