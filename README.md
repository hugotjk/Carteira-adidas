# Carteira adidas

App para análise da carteira de pedidos adidas: dashboard, análise por material,
liberação/cancelamento com exportação para Excel e controle de logins por gestor, loja, grupo ou customer.

App no AI Studio: https://ai.studio/apps/cc1c3805-6f77-4a4b-9205-3ee4e610d6dc

## Como os dados chegam ao app

- **Planilha:** o servidor busca a planilha do Google Drive, guarda uma cópia por 5 minutos e envia
  compactada. Cada aparelho guarda os dados localmente e, ao abrir o app, só baixa de novo se a planilha mudou.
- **Colunas:** são lidas pelo **nome do cabeçalho** (não pela posição). O mapa fica em
  `src/services/sheetColumns.ts`. Se faltar uma coluna obrigatória (Material, Gestor, Loja,
  Qtde Confirmada, Valor NF), a sincronização avisa e mantém os dados anteriores.
- **Fotos:** arquivos `.png`/`.jpg` com o código do material, na raiz dos repositórios
  `hugotjk/adidas-fla` e `hugotjk/adidas` (sem limite de 1.000 arquivos).

## Rodar localmente

**Pré-requisito:** Node.js

1. Instalar dependências: `npm install`
2. Rodar: `npm run dev` (abre em http://localhost:3000)
3. Opcional: `GITHUB_TOKEN` no `.env.local` aumenta o limite de consultas ao GitHub para as fotos.
