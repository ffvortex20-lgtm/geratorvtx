# FileForge Catbox — versão corrigida

## Estrutura
- `index.html` — interface do gerador.
- `api/upload.js` — endpoint serverless que envia o arquivo para a API do Catbox.
- `package.json` — dependência `busboy`.
- `vercel.json` — configuração da função.

## Deploy na Vercel
1. Suba estes arquivos em um repositório GitHub.
2. Importe o repositório na Vercel.
3. Faça o deploy.
4. Abra o domínio da Vercel e teste o botão **Gerar Link Catbox**.

## Por que a versão antiga falhava?
O navegador tentava chamar `catbox.moe/user/api.php` diretamente e ainda dependia de vários proxies públicos. Isso é instável e pode ser bloqueado por CORS, proxy indisponível ou mudanças no serviço.
A nova versão chama `/api/upload` no próprio domínio e o servidor faz a chamada ao Catbox.

## Observação
A função serverless tem limite de tamanho da própria hospedagem. Esta versão limita o upload a 4 MB para evitar falhas típicas de plataformas serverless. Para arquivos maiores, use um backend dedicado (por exemplo, Render) com limite configurado para isso.
