# Site institucional Terradic

Site institucional estático e multiunidade da Terradic (rede de diagnóstico por imagem e
telerradiologia no Ceará). O site é gerado por um build próprio em Node: HTML5 + Tailwind CSS
compilado via CLI (nunca CDN) + um único bundle de JavaScript vanilla. Não há backend, banco de
dados, formulário, cookie próprio ou analytics.

Este repositório está na **quarta rodada de implementação**, com um **fluxo de pré-visualização no
GitHub Pages**: as Fases 0 a 4 do `specs/001-site-institucional-terradic/tasks.md` estão implementadas
(com as correções do QA das rodadas anteriores) e a Fase 5 (SEO técnico) foi concluída. A Fase 6 está
**parcial**: existe uma auditoria local via CDP para responsividade, foco e comportamento sem
JavaScript, mas a auditoria formal com axe, o teste de teclado/leitor de tela, a revisão responsiva
manual e o Lighthouse seguem pendentes. Deploy e go-live continuam bloqueados pelos dados do cliente
(C-01..C-15; T013 parcial).

## Requisitos

- Node.js LTS fixado em `.nvmrc` (`24.11.0`); `package.json` exige `>= 24.11.0`.
- npm (o lockfile é versionado).
- Nenhuma outra dependência além de `tailwindcss` (e seu CLI).

```powershell
npm ci
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Gera o site em modo `--rascunho`, sobe `http://localhost:4173/` e reconstrói ao alterar `src/`, `dados/`, `dados-teste/` ou `tailwind.config.js`. |
| `npm run build` | Build **tolerante de revisão/preview**: inclui no artefato apenas unidade `ativo` + validação `confirmado` + telefone validado, serviço `aprovado`, preparo `aprovado`. Grava `dist/`, mas **nunca é publicável sozinho**. |
| `npm run build:go-live` | **Único gate de publicação**: exige unidade publicável, menu com ao menos 2 itens, rotas estruturais, preparos aprovados, RT/CRM, contato institucional e endereço da matriz. Falha listando **todos** os bloqueios de uma vez. Hoje falha (dados pendentes) - comportamento esperado. |
| `npm run build:rascunho` | Build de revisão: inclui entidades pendentes, usa `dados-teste/unidades.exemplo.json` quando existir e adiciona a faixa "VERSÃO DE REVISÃO — DADOS NÃO CONFIRMADOS" + `noindex`. Grava `dist-rascunho/`. |
| `npm run check` | `--rascunho --check`: valida dados, gera o site de revisão em `dist-rascunho/` e roda **todas** as regras de QA sobre o rascunho e sobre uma produção real gerada em diretório temporário (links, `tel:`, `rel`, NAP visível, hex, claims, orçamento, requisição externa em HTML/JS/CSS, artefato de produção). Também confere que o `dist/` de produção não foi alterado. |
| `npm run coleta` | Gera o **kit de coleta** em `relatorios/coleta/` (questionário HTML, cinco CSVs e `LEIA-ME.txt`) a partir dos dados atuais. Não altera `dados/`, `dist/` nem `src/`. |
| `npm run importar:coleta` | Importa o kit devolvido de `relatorios/coleta/` (ou de `--pasta=`), valida tudo e grava `dados/*.json` somente se o conjunto inteiro estiver válido. Nunca promove status. |
| `npm test` | Testes negativos com `node:test` nas duas suítes: build/validador/check da 001 e kit de coleta (CSV, modelo, importador e isolamento). |

O build não acessa a rede. A única chamada externa é o Tailwind CLI local.

`npm run check` grava o artefato de revisão em `dist-rascunho/` (ignorado no git) e **não** sobrescreve `dist/`. Como o script já inclui `--rascunho`, `npm run check -- --base-url=...` também grava e audita em `dist-rascunho/`. Para gerar e auditar staging em `dist-staging/`, rode
`node scripts/build.mjs --check --base-url=...` **sem** `--rascunho`. Nos dois casos `dist/` não é tocado. O relatório em
`relatorios/` é sempre gerado a partir dos dados reais, inclusive quando o build é de rascunho.

**Deploy:** `npm run build` é apenas revisão/preview e **nunca** deve ser publicado. O único pré-requisito de publicação de produção é `npm run build:go-live` **verde**; o Pages é preview de rascunho e não é produção.

### Flags do build

```powershell
node scripts/build.mjs --rascunho
node scripts/build.mjs --go-live
node scripts/build.mjs --check
node scripts/build.mjs --check --base-url=https://staging.exemplo.com
```

`--go-live` implica produção + auditoria completa; ele não gera `dist/` se o gate falhar.
`--base-url` troca as URLs geradas (canonical, sitemap, robots) e coloca o build em modo staging:
todas as páginas recebem `noindex, follow` e o `robots.txt` sai com `Disallow: /`. A saída de staging
vai para `dist-staging/` (nunca para `dist/`); com `--rascunho`, a saída continua em `dist-rascunho/`.
O `dados/site.json` continua exigindo `https://terradic.com.br`; staging nunca escreve em `dist/`.

## Kit de coleta de dados

O go-live continua bloqueado pelas dependências de conteúdo C-01..C-15. O kit de coleta reduz a
transcrição manual: ele deriva um questionário imprimível e cinco planilhas CSV de `dados/*.json`,
`dados/exemplos-briefing.json` e das mesmas funções de validação e de relatório usadas pelo build.
**O kit não publica nada**, não altera schema e não substitui `relatorios/pendencias.md`.

### Gerar o kit

```powershell
npm run coleta
```

Saída em `relatorios/coleta/` (diretório ignorado no Git):

| Arquivo | Conteúdo |
|---|---|
| `questionario.html` | Questionário autocontido e imprimível em A4, sem formulário, script ou requisição externa. |
| `unidades.csv` | Uma linha por unidade: endereço, geo, telefones, WhatsApp, e-mail, horários, serviços, convênios, atendimento particular, comodidades, redes e bloco de confirmação. |
| `site.csv` | Uma linha: RT/CRM/UF/especialidade, contato institucional e redes. |
| `convenios.csv` | Uma linha por convênio e vigência; convênio novo pode ser acrescentado. |
| `preparos.csv` | Uma linha por preparo, com revisão do RT. |
| `textos.csv` | Uma linha por bloco editorial pendente. |
| `LEIA-ME.txt` | Instruções para a clínica: tokens, Excel, bloco de confirmação, LGPD e devolução. |

Os nomes e a versão do modelo são fixos (`coleta-1`). `base_dados_em` é a data de
`dados/site.json.atualizadoEm`, não a data da execução. A geração é determinística: duas execuções
com a mesma entrada produzem os mesmos bytes. Para testes, `node scripts/coleta.mjs --raiz=<dir>`
usa uma raiz temporária; o comando nunca escreve em `dados/`, `dist/`, `dist-rascunho/`,
`dist-staging/` ou `src/`.

### Fluxo

1. Rode `npm run coleta` com os dados atuais e revise o resumo (arquivos, linhas e dependências pendentes).
2. Imprima `questionario.html` para a reunião e envie a pasta com os cinco CSVs para a clínica preencher.
3. A clínica preenche os CSVs e devolve a pasta pelo canal combinado. O HTML é apoio; o preenchimento oficial é no CSV.
4. Rode `npm run importar:coleta -- --pasta=relatorios/coleta`. O importador valida as mesmas regras do build, lista todos os erros de uma vez e só grava `dados/*.json` se o kit inteiro estiver válido.
5. Revise o diff, as fontes e o log de importação.
6. Promova manualmente o que estiver confirmado e rode `npm run build`, `npm run check` e `npm run build:go-live`. O go-live segue sendo o único gate de publicação.

### Importar o kit devolvido

```powershell
npm run importar:coleta -- --pasta=relatorios/coleta
```

| Flag | Efeito |
|---|---|
| `--pasta=` | Pasta com os cinco CSVs (padrão `relatorios/coleta`, relativa à raiz). |
| `--raiz=` | Raiz do repositório; usado para testar em cópia temporária de `dados/`. |
| `--sobrescrever` | **Operação excepcional e auditada.** Permite alterar entidade já confirmada; rebaixa unidade/preparo/bloco/RT para pendente e registra no log os campos submetidos. Sem a flag, a importação falha e não grava nada. Use somente após revisar o motivo e o diff. |

O importador exige os cinco CSVs, valida encoding (UTF-8; recusa UTF-16/ANSI), separador `;`, cabeçalho, `modelo_versao` e `tipo_registro`, limites de tamanho/linhas/células, normaliza CEP/data/telefone/decimal e recusa célula iniciada por `=`/`@`/`-`/`+` fora de telefone/coordenada, além de caracteres de controle. Erros saem no formato `arquivo:campo:entidade`; em qualquer erro, nenhum JSON de `dados/` é escrito. O resultado fica em `relatorios/coleta/importacao.md` e `importacao.json` (linhas processadas, campos, tokens, sobrescritas, confirmações, vínculos, erros e promoções pendentes), com "nada foi gravado" quando falha.

Kit com `base_dados_em` anterior a `dados/site.json.atualizadoEm` é recusado para não sobrescrever dado mais novo; gere o kit de novo ou use `--sobrescrever` de forma auditada. `dados/site.json.atualizadoEm` é a base de geração do conjunto e **não é alterado pela importação**; como ele só muda por edição manual, a proteção de kit antigo só dispara se essa base for elevada manualmente na manutenção dos dados. O importador atualiza apenas a data das unidades, do catálogo de convênios, da revisão dos preparos e das páginas editoriais (`paginas.atualizadoEm`) com a maior confirmação importada. Telefone idêntico a `dados/exemplos-briefing.json` continua recusado pelo validador, mesmo com bloco de confirmação: remova manualmente o exemplo correspondente após registrar a confirmação e reimporte. O importador não altera esse arquivo. Reimportar o mesmo kit é idempotente; `atualizadoEm`, `validacao.data` e `revisao.data` usam a maior data de confirmação, nunca o relógio.

**Modelo de confiança:** a planilha é entrada de terceiro (clínica, RT e jurídico). A validação do importador é estrutural — formato, versão, referências, limites e invariantes de status — e não prova a veracidade do dado. O gate é a revisão humana do diff de `dados/*.json`, das fontes e do log antes da promoção manual.

### Testes do kit

`npm test` executa também `scripts/testes-coleta.mjs`. A suíte gera e importa kits em diretórios temporários (`mkdtemp`), cobre os casos negativos do CSV/importador, o contrato C-01..C-15, o isolamento e compara o hash de `dados/` real antes/depois. O que é verificável por script do UAT (BOM, CRLF, `;`, cabeçalhos, `@page` A4, ausência de elemento externo e largura de tabela) está coberto; abrir/editar no Excel pt-BR e imprimir o HTML continuam pendentes de verificação humana.

### O que é importado x o que é promoção manual

- **Importado (sempre pendente):** valores das células e a rastreabilidade declarada no bloco de confirmação (`confirmadoPor`, `data` e `fontes` na unidade; `revisao.responsavel`/`crm`/`data` no preparo; texto e status do bloco; RT; `atualizadoEm` do catálogo de convênios). A unidade importada continua `status: "a-confirmar"` e `validacao.status: "pendente"`.
- **Promoção manual:** `status: "ativo"`, `validacao.status: "confirmado"`, serviço e preparo `aprovado`, bloco `aprovado` e RT `confirmado`. Nenhuma coluna de status de publicação existe no modelo; tentar gravá-la é erro.
- **Sempre manual:** criar unidade ou preparo novo (slug e revisão continuam no fluxo do README), criar bloco editorial novo em `paginas.json`, exibir vigência de convênio por operadora no site (fora desta feature; a vigência é registrada em `aviso`/`atualizadoEm`) e remover um telefone de `dados/exemplos-briefing.json` depois de confirmado.
- **`--sobrescrever`:** operação excepcional e auditada. Alterar entidade já confirmada exige a flag explícita; sem ela, a importação falha e não grava nada. Com ela, a entidade alterada é rebaixada para pendente e o log registra os campos submetidos.

### Preenchimento e privacidade

- `A CONFIRMAR: ` marca valor pré-preenchido não confirmado e nunca é importado.
- `NAO_TEMOS` grava ausência (lista vazia ou valor ausente); `NAO_SABEMOS` registra desconhecimento e preserva o valor existente. Célula vazia não altera o JSON.
- Toda linha com dado respondido exige bloco de confirmação: quem (nome e função), como (e-mail, telefone, reunião, documento ou WhatsApp), fonte e data. Um "ok" genérico não é confirmação.
- Não inclua dados de paciente, exames, laudos ou CPF de paciente no kit. O CRM do RT é dado profissional e só é registrado com a identificação de quem confirmou.

O kit é sensível e **não é versionado**: `relatorios/` está no `.gitignore`. Compacte e envie a pasta por canal controlado; nunca faça commit de `relatorios/coleta/`.

## Estrutura

```
dados/            fonte de verdade (site, unidades, serviços, preparos, convênios, páginas)
dados-teste/      dados fictícios, usados apenas em --rascunho
dados/exemplos-briefing.json   exemplos do levantamento; fora do build (só o validador lê)
src/templates/    layout, páginas e parciais com tokens {{...}}
src/css/          entrada do Tailwind + tokens de tema (únicas cores literais do projeto)
src/js/           bundle único (menu, acordeões, fachada de mapa)
src/estatico/     favicon, marca provisória, imagens OG por tipo (og-*.png)
.github/workflows/ pages-preview.yml (preview de rascunho no GitHub Pages)
scripts/          build.mjs, coleta.mjs, importar-coleta.mjs, servidor.mjs, testes.mjs, prefixar-base.mjs, lib/*.mjs
dist/             saída de produção gerada (ignorada no git)
dist-rascunho/    saída de revisão do --rascunho/--check (ignorada no git)
dist-staging/     saída de pré-visualização com --base-url (ignorada no git)
relatorios/       pendencias.* e coleta/ (ignorados no git)
```

O build escreve `dist/<rota>/index.html` (ou `dist-rascunho/<rota>/index.html` em revisão e
`dist-staging/<rota>/index.html` em staging), `404.html`, `sitemap.xml`, `robots.txt`,
`assets/estilo.css`, `assets/app.js` e copia `src/estatico/` para a saída.

## Como editar conteúdo

### Trocar um telefone

1. Abra `dados/unidades.json`.
2. Localize a unidade pelo `slug` e edite `telefones[].e164` **apenas no formato E.164**
   (`+55` + DDD + número, ex.: `+558533433739`). O site formata para leitura, e o JSON-LD e o
   `tel:` usam o mesmo valor.
3. Marque `validado: true` somente depois de confirmar o número com a clínica.
4. Rode `npm run check` (ou `npm run build:rascunho`) e confira a página da unidade e o rodapé.
5. Rode `npm run build` para o artefato de revisão; para publicar, só com `npm run build:go-live` verde.

Nenhum template precisa ser alterado: página da unidade, índice, rodapé e JSON-LD são derivados do
JSON.

### Adicionar uma unidade

1. Copie um objeto de `dados/unidades.json` e preencha `id`, `slug` (minúsculas, sem acento,
   `[a-z0-9-]`), `nomeExibicao`, `cidade`, `uf`, `cnpjFilial`, `matriz`.
2. Enquanto os dados não estiverem confirmados, mantenha `status: "a-confirmar"` e
   `validacao.status: "pendente"`. A unidade **não** gera página nem entra no sitemap de produção.
3. Para publicar, preencha endereço completo + CEP, ao menos um telefone validado, horários,
   serviços, `atendimentoParticular`, `cnpjFilial`, `validacao.status: "confirmado"`,
   `confirmadoPor`, `data` e `fontes`, e mude `status` para `"ativo"`.
4. Rode `npm run check` e depois `npm run build` para o artefato de revisão. Um erro de dado sai no formato
   `arquivo:campo:entidade` (ex.: `unidades.json:endereco.cep:caninde`).

### Adicionar um serviço

1. Em `dados/servicos.json`, crie o serviço com `id`, `slug`, `nome`, `nomeCurto` e `status`.
2. Enquanto o texto não for aprovado, use `status: "pendente"`; o build de produção não publica.
3. Para publicar: `status: "aprovado"` exige `resumo` e ao menos um parágrafo em `descricao`.
4. Associe o serviço às unidades em `unidades[].servicos` (a relação é derivada; nunca duplique a
   lista no serviço).

### Adicionar um preparo

1. Em `dados/preparos.json`, preencha `id`, `slug`, `exame` e `servicoId` (referência existente).
2. O conteúdo clínico (jejum, medicação, documentos, vestimenta, alertas) só pode ser publicado
   após revisão do responsável técnico. Até lá, mantenha `revisao.status: "pendente"`.
3. Para publicar: `revisao.status: "aprovado"` **exige** `revisao.responsavel`, `revisao.crm` e
   `revisao.data`. O build de produção falha se faltar qualquer um.
4. Adicione o preparo ao serviço correspondente em `servicos[].preparos`.

### Adicionar ou editar um convênio

1. Em `dados/convenios.json`, crie o convênio com `id` e `nome` únicos. Quando a lista tiver ao
   menos um item, `atualizadoEm` passa a ser obrigatório no formato `AAAA-MM-DD`.
2. Associe o convênio às unidades em `unidades[].convenios` pelos `id`. A lista unidade × convênio
   é derivada no build; não duplique os nomes nas unidades.
3. Enquanto a cobertura não estiver confirmada com a operadora, mantenha o convênio fora da lista.
   A ressalva e a data de atualização vêm do bloco `convenios-ressalva` de `paginas.json` e de
   `convenios.atualizadoEm`, e aparecem na página da unidade e em `/convenios-e-particular/`.
4. `exibirLogo: true` exige `logoAutorizado: true`; sem autorização, use apenas o nome.
5. Rode `npm run check` e confira a página de convênios e as unidades associadas.

### Editar blocos editoriais de `paginas.json`

1. Cada página em `dados/paginas.json` tem `seo.titulo`/`seo.descricao` e uma lista `blocos`.
2. Cada bloco tem `tipo` (`titulo`, `subtitulo`, `paragrafo`, `lista`, `destaque`, `aviso` ou
   `citacao`), `status` (`pendente` ou `aprovado`) e `texto`; bloco do tipo `lista` usa `itens`.
   O `id` é obrigatório quando o template referencia o bloco (ex.: `marca-subtitulo`, `hero-*`,
   `servicos-*`, `unidades-*`, `portal-*`, `aviso-externo`, `mapa-aviso`, `convenios-ressalva`).
3. Bloco `pendente` aparece apenas no build de rascunho, é omitido da produção e entra no relatório
   de pendências; o go-live reprova a página enquanto houver bloco pendente.
4. Não escreva frase editorial direto no template: o teste `R35-M1` falha se houver texto longo fora
   de `{{...}}`. Rótulos de interface (menu, "Pular para o conteúdo", "abre em nova aba") podem
   permanecer no template.

## Regras aplicadas pelo build

- Campos obrigatórios por status, slug único e normalizado, referências existentes, telefone
  `^\+55\d{10,11}$`, CEP `^\d{8}$`, `abre < fecha`, `urlBase` e `portalExames.url` exatas.
- Unidade `ativo` exige validação `confirmado` com `confirmadoPor`, `data` e `fontes`, além de ao
  menos um telefone com `validado: true` em E.164. `validado` ausente ou não booleano é erro.
- Unidade publicável também exige ao menos um serviço `aprovado` entre os serviços informados.
- Blocos editoriais exigem `status` `pendente|aprovado`; blocos pendentes não entram na produção.
- `MedicalClinic.geo` só é emitido com latitude/longitude numéricas, `geo.precisao` diferente de
  `"aproximada"` e `validacao.fontes` não vazio. Sem isso, o bloco é omitido.
- Identidade provisória pode ir ao go-live apenas com `identidadeVisual.aceiteFormal` completo
  (`aceitoPor`, `data` e `documento`); `status: "oficial"` também libera.
- O telefone institucional da matriz é o marcado com `principal: true`; o go-live exige exatamente
  um principal validado. O cruzamento com `site.contatoInstitucional.telefoneE164` roda apenas em
  produção/go-live, nunca sobre o dataset de teste do rascunho.
- Erros acumulados no formato `arquivo:campo:entidade`, com saída diferente de zero.
- Gates: unidade publicável, serviço aprovado, preparo aprovado. Em `--rascunho` viram avisos e
  entram a faixa de revisão e o `noindex`.
- Derivados: serviço → unidades e convênio → unidades calculados no build; horários formatados;
  breadcrumbs visuais e em JSON-LD.
- Saída determinística: sem timestamp de runtime (o único valor de relógio é o ano do rodapé,
  exigido por FR-02); listas ordenadas por slug; `lastmod` vem de `atualizadoEm`.
- Relatório `relatorios/pendencias.md` + `.json` com todos os campos nulos/pendentes e os
  bloqueios C-01..C-15. C-01/C-03 usam o gate real (validação confirmada e telefone `validado`).

## Gate de go-live (`npm run build:go-live`)

O build de produção é tolerante para permitir revisão local. A publicação usa o gate estrito, que
falha com a lista completa de bloqueios (não para no primeiro):

- `preparos.json:revisao.status:<slug>` para preparo não aprovado exigido por serviço publicável;
- `preparos.json:aprovados:site` quando não há nenhum preparo aprovado (a rota de preparo só é
  exigida quando há preparo publicado);
- `servicos.json:aprovados:site` quando não há nenhum serviço aprovado;
- `unidades.json:servicos:<slug>` para unidade ativa sem serviço aprovado;
- `unidades.json:publicadas:site` quando não há nenhuma unidade publicável;
- `rotas:menu:site` quando o menu teria menos de 2 itens;
- `rotas:<rota>:site` para cada rota estrutural obrigatória ausente (unidades, serviços, preparo,
  convênios, sobre, contato, 404);
- `paginas.json:blocos:<pagina>` quando uma página publicável tem bloco pendente;
- `site.json:responsavelTecnico.*` e `site.json:contatoInstitucional.*` para identificação incompleta;
- `site.json:identidadeVisual.status:site` e `site.json:privacidade.politicaPublicada:site` para C-11/C-14;
- `unidades.json:endereco.*:<slug-da-matriz>` para endereço institucional incompleto;
- `unidades.json:matriz-confirmada:<slug>` quando a matriz não tem cadastro confirmado;
- `unidades.json:telefones:<slug>` quando a matriz não tem exatamente um telefone principal validado.

O rodapé mantém os blocos condicionais (não inventa dado), mas o go-live não passa sem RT/CRM,
especialidade, contato institucional e endereço/telefone da matriz. T013 está registrada como
**parcial** no relatório. Decisão da rodada 3: **o rodapé lê o registro da matriz confirmado
diretamente** (`validacao.status: confirmado`), mesmo quando a matriz não tem página publicada;
`site.contatoInstitucional.telefoneE164`, quando preenchido, precisa ser idêntico ao telefone
institucional da matriz. Assim não há duas fontes nem rodapé vazio enquanto uma página afirma
exibir a matriz. O build de produção não gera `/contato/` se o endereço/telefone da matriz não
estiverem confirmados.

## Normalização do NAP

A checagem `nap.divergencia` compara atributos ocultos (`data-nap-*`) **e** o texto visível:

- texto visível: entidades decodificadas, sem acentos, minúsculo, pontuação trocada por espaço e
  espaços colapsados (logradouro, número, bairro, cidade e UF);
- CEP: apenas dígitos (`60000-000` e `60000000` são iguais);
- telefone: apenas dígitos, descartando o prefixo `55` do E.164; o texto formatado de um `tel:`
  visível precisa corresponder ao telefone do JSON-LD.
- Todas as ocorrências de `data-nap-escopo` da página são percorridas (endereço da unidade, matriz
  no conteúdo/rodapé e telefone institucional), não só a primeira.

A página da unidade informa que o rodapé exibe o endereço institucional da matriz, não o da unidade.
O rodapé também tem `data-nap-*`: `data-nap-escopo="matriz"` no endereço e
`data-nap-escopo="institucional"` no telefone, comparados com a matriz confirmada e com
`site.contatoInstitucional`.

A checagem de `noindex` considera `<meta name="robots">`, `googlebot` e `bingbot`, em qualquer
ordem de atributos e sem diferenciar maiúsculas. O `sitemap.xml` do `dist/` existente também é
auditado, e `slugsTeste` é procurado no sitemap, não só no HTML.

## Texto editorial x rótulo de interface

A regra de classificação usada na migração para `paginas.json`:

- **Texto editorial** (frase, título com conteúdo, chamada, ressalva) vai para blocos em
  `paginas.json`, com `tipo` e `status`.
- **Rótulo de interface** (ex.: "Pular para o conteúdo", "Menu", "abre em nova aba", "Ver unidade")
  pode permanecer no template.

Na home, a marca, o hero, os títulos e textos das seções, o texto do portal, o aviso de ambiente
externo, a explicação do mapa, a ressalva de convênios, os avisos de particular/WhatsApp e a nota
da matriz vêm de blocos com `id`. O cabeçalho usa `marca-subtitulo`; as seções usam os ids
`servicos-*`, `unidades-*`, `portal-*` e correlatos. Os H1 de unidades/serviços/preparo, o
disclaimer de serviço e a copy do 404 também são blocos. Nenhuma frase editorial nova foi criada:
o conteúdo foi apenas movido dos templates.

O teste `npm test` varre os templates e falha se houver nó de texto longo fora de `{{...}}` que
não esteja na lista de rótulos de interface/revisão permitidos.

## SEO, imagens OG e JSON-LD

- Metadados por rota: `title` ≤ 60, `description` 120–160, canonical autorreferente, OG completo
  (`title`, `description`, `image`, `url`, `type`, `locale`) e `twitter:card`. O build **falha** se
  `title` passar de 60 ou `description` sair de 120–160; não trunca.
- Imagens OG estáticas 1200×630 em `src/estatico/assets/og-*.png` (home, unidade, serviço, preparo e
  institucional), ≤ 200 KB, geradas uma vez a partir dos tokens do tema, sem logo ou claim. O build
  apenas copia; não gera imagem em runtime.
- JSON-LD: `Organization` com `legalName`, `taxID` e `sameAs` quando houver; `MedicalClinic` por
  unidade com endereço completo, `geo` apenas quando há coordenadas com `precisao` (`exata` ou
  `aproximada`) e `validacao.fontes` registrada, telefone, horários, `availableService`,
  `parentOrganization` e `areaServed`; `MedicalWebPage` para serviço e preparo;
  `BreadcrumbList` em todas as páginas internas e 404; `WebSite` apenas na home.
- Sitemap e robots derivam das rotas geradas; cada `<url>` do sitemap exige `<lastmod>` em
  AAAA-MM-DD, alimentado por `atualizadoEm` (topo dos arquivos e por unidade). O `--check` audita o
  `dist/` existente e o `sitemap.xml` real.
- Internal linking: unidade ↔ serviço ↔ preparo, rodapé com todas as unidades publicáveis,
  profundidade ≤ 2 cliques a partir da home.

## Auditoria F6 local

```powershell
npm run build:rascunho
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new()
node scripts/auditoria.mjs | Out-File -Encoding utf8 relatorios/verificacao-rodada4.txt
```

Definir o console como UTF-8 antes do redirecionamento evita mojibake nos acentos do JSON.

O script sobe `dist-rascunho` em `127.0.0.1`, abre Chrome/Edge headless via CDP e mede overflow
horizontal em 320/360/768/1024/1280/1440 px nas páginas home, unidade, serviço, preparo, contato e
404, além de foco inicial, menu mobile, acordeões e checagens manuais de acessibilidade. Ele não
instala nada e não entra no runtime do site.

**Ferramentas ausentes:** `axe-core` e `lighthouse` não estão instalados no projeto e não foram
adicionados. A auditoria de acessibilidade é manual/scriptada (não axe) e a medição de performance é
via CDP/Performance API (não score Lighthouse). O script imprime o JSON no stdout; a revisão da
rodada 4 foi arquivada por redirecionamento em `relatorios/verificacao-rodada4.txt` (diretório
ignorado no git).

## Privacidade

- Nenhum `<form>`, campo de dado pessoal, cookie, pixel ou analytics (`site.json.analytics: null`).
- Nenhuma requisição externa no carregamento inicial. O mapa do Google só carrega após clique.
- O CTA "Baixar exames" aponta para `https://entregadeexames.com.br/` em nova aba, com
  `rel="noopener noreferrer"`, rótulo acessível e aviso visível de ambiente externo.
- Links de exames não recebem parâmetros e não há iframe, preload, prefetch ou redirect.

## Testes negativos (`npm test`)

Cada regra do `--check` e do validador tem um teste que comprova a falha:

| Regra / validação | Teste |
|---|---|
| `unidades.json` obrigatório, slug, E.164, CEP, horário, refs, validação | testes "unidade ativa sem CEP...", "slug duplicado...", "telefone fora do padrão...", "horário com abre >= fecha...", "referência de serviço inexistente..." |
| Telefone `validado` e rastreabilidade da unidade ativa | "B2: unidade ativa exige telefone com validado booleano e true", "B2: unidade ativa exige confirmadoPor, data e fontes" |
| Gate de go-live (preparo, RT, contato, matriz, menu, rotas) | "B1: go-live acusa preparo pendente...", "B3/B4: go-live lista RT, contato, matriz, unidades, menu e rotas de uma vez" |
| Metadados de unidade | "M1: título e descrição de todas as unidades respeitam os limites" |
| Convênios com lista | "M2: ressalva e data de atualização aparecem mesmo com convênio na lista" |
| Serviço pendente | "M3: serviço pendente não aparece em chips nem em availableService" |
| Selo de preparo | "M4: selo de preparo mostra responsável, CRM e data" |
| Foco em superfície escura | "M5: token de foco escuro tem contraste >= 3:1 contra a secundária" |
| Blocos editoriais | "M6: renderizador de blocos suporta os tipos e escapa HTML" |
| Relatório C-03 | "M7: relatório calcula C-03 pelo gate real de telefone validado" |
| NAP visível | "M8: NAP compara CEP visível normalizado além dos atributos ocultos" |
| Exemplo do levantamento recusado | "telefone idêntico a exemplo do levantamento é recusado" |
| `urlBase` / `portalExames.url` exatas | "portal de exames com URL diferente...", "urlBase com www..." |
| Serviço/preparo aprovados sem conteúdo mínimo | "serviço aprovado sem descrição...", "preparo aprovado sem responsável técnico..." |
| `links.interno` / âncoras | "links.interno acusa link para rota inexistente", "links.interno acusa âncora quebrada" |
| `links.rel` | "links.rel exige target e rel em link externo" |
| `links.tel` | "links.tel exige E.164" |
| `portal.url` | "portal.url aceita somente a URL exata" |
| `externo.requisicao` | "externo.requisicao acusa script externo", "...permite canonical e bloqueia preload externo", "A3: externo.requisicao varre @import..." |
| `conteudo.placeholder` | "conteudo.placeholder acusa texto provisório" |
| `conteudo.claim` | "conteudo.claim acusa promessa de resultado" |
| `conteudo.hex` | "conteudo.hex acusa cor literal fora do tema", "L2: conteudo.hex também acusa cor literal em SVG" |
| `nap.divergencia` | "nap.divergencia acusa nome diferente entre HTML e JSON-LD" |
| `artefato.producao` | "A1: artefato de produção recusa noindex, faixa e dados de teste", "A1: artefato.producao é ignorado no build de rascunho" |
| `orcamento` | "orcamento falha quando o JS passa de 10 KB gzip" |
| `saida.obrigatoria` | "saida.obrigatoria acusa arquivos ausentes" |
| `html.basico` / faixa de revisão | "html.basico acusa ausência de h1 único", "html.basico recusa faixa de revisão em produção" |
| `html.metaUnica` | "html.metaUnica acusa título repetido" |
| `sitemap` | "sitemap acusa URL que não foi gerada" |
| Rodapé/matriz | "R3-A1: com matriz confirmada...", "R3-A1: matriz não publicável..." |
| NAP do rodapé | "R3-A2: nap.divergencia acusa divergência no rodapé (CEP e telefone)" |
| Unidade sem serviço aprovado | "R3-A3: unidade ativa sem serviço aprovado não publica e bloqueia go-live" |
| Texto editorial em blocos | "R3-A4: marca e títulos de seção vêm de paginas.json" |
| Blocos pendentes | "R3-A5: bloco com status inválido...", "R3-A5: bloco pendente não publica F4..." |
| RT/especialidade | "R3-A6: go-live exige especialidade e rodapé não gera pontuação órfã" |
| Convênios atualizadoEm | "R3-A7: convênio exige atualizadoEm válido" |
| Robustez do artefato | "R3-A8: noindex é detectado...", "R3-A8: sitemap de produção..." |
| F4 | "R3-B: F4 gera sobre...", "R3-B: /contato/...", "R3-B: /convenios...", "R3-B: /sobre/...", "R3-B: privacidade..." |
| Rascunho x telefone institucional real | "R35-M3: cross-check do telefone institucional não roda no rascunho" |
| Preparo aprovado/rota | "R35-M4: catálogo sem preparo aprovado tem bloqueio dedicado e não exige rota" |
| Texto editorial em template | "R35-M1: templates não contêm texto editorial longo fora de blocos" |
| NAP número/cidade/UF | "R35-M2: NAP compara número, cidade e UF..." |
| Convênios sem lista | "R35-M5: ressalva de convênios sem lista não afirma data de atualização" |
| noindex googlebot/bingbot | "R35-B2: noindex é detectado em googlebot, bingbot e com NOINDEX" |
| Múltiplos data-nap | "R35-B3: nap.divergencia percorre todas as ocorrências de data-nap-escopo" |
| Relatório C-10/C-12/C-11/C-14 | "R35-B4: C-10/C-12 são calculados...", "R35-B4: C-11 e C-14 passam a bloquear o go-live" |
| Telefone principal | "R35-B5: rodapé usa o telefone principal explícito da matriz" |
| Metadados/OG | "R4-F5: metadados completos e únicos...", "R4-F5: imagens OG existem..." |
| JSON-LD | "R4-F5: JSON-LD final...", "R4-F5: Organization...", "R4-F5: MedicalClinic completa..." |
| Internal linking | "R4-F5: internal linking atinge todas as rotas em até 2 cliques" |
| Staging | "R4-F5: staging recebe noindex e robots próprio; produção não" |
| Sem JS | "R4-F6: preparo e mapa funcionam sem JavaScript" |
| Staging: validação de `--base-url` | "R5-M1: validação de --base-url" |
| Staging separado | "R5-M1: staging grava dist-staging e não toca dist; rascunho+baseurl grava dist-rascunho" |
| geo confirmado | "R5-M2: geo exige precisão não aproximada e fontes" |
| Bloco transversal pendente | "R5-M3: bloco transversal pendente não sai na produção..." |
| Aceite formal da identidade | "R5-M4: identidade provisória exige aceite formal completo" |
| Títulos editoriais da unidade | "R5-B1: títulos editoriais da unidade vêm de paginas.json" |
| C-02/C-12 no relatório | "R5-B2: C-02 não bloqueia por geo e C-12 continua dependência..." |
| CTA/FR-34 | "R5-B7: CTA do header/hero traz aviso externo..." |

## Identidade visual provisória

**Status: provisória (C-11 pendente).**

- A paleta em `src/css/estilo.css` e `tailwind.config.js` é uma **aproximação** derivada de um
  flyer de campanha da unidade Pacajus, obtido em redes sociais. Não é brandbook e não é a marca
  oficial. Os valores hexadecimais existem apenas no arquivo de tema; templates, JS e conteúdo usam
  apenas tokens semânticos, e o `--check` falha se encontrar `#RRGGBB` fora do tema.
- O logo publicado é um **placeholder neutro** (wordmark tipográfico simples em
  `src/estatico/assets/marca-provisoria.svg`). A marca **não** foi vetorizada, redesenhada ou
  reconstruída a partir de imagem raster. Não use o flyer como fonte de logo.
- A fonte caligráfica do flyer não é usada nesta rodada (não há arquivo licenciado disponível). O
  site usa a pilha de fontes do sistema.
- Matriz de contraste usada em texto está registrada no topo de `src/css/estilo.css` (todos os
  pares ≥ 4,5:1; turquesa e dourado não são usados como texto sobre fundo claro; botão primário é
  verde-petróleo com texto branco).
- Também falta: fotos reais com autorização, RT com CRM e definição de logo/fonte oficiais. Ver
  `CONTEUDO-PENDENTE.md`.

## Acessibilidade e JavaScript

- O menu mobile usa `aria-expanded`/`aria-controls`, fecha com `Esc`, devolve o foco ao botão e
  também fecha com clique fora. Sem JavaScript a navegação permanece visível (o botão só aparece
  quando o JS está ativo).
- Os acordeões de preparo são `<details>/<summary>` e funcionam sem JS. O JS apenas sincroniza
  `aria-expanded` no `summary` e `aria-controls` aponta para o painel; sem JS valem as semânticas
  nativas do elemento.
- O mapa é uma fachada: endereço textual e link "Abrir no Google Maps" sempre visíveis. O iframe do
  Google só é injetado após clique em "Carregar mapa nesta página" (botão revelado pelo JS). Sem JS,
  o link externo continua disponível.
- Foco visível global (`outline` de 2 px com offset), skip link como primeiro elemento focável,
  landmarks e `aria-current="page"` no menu e na trilha. Em superfícies escuras (hero e rodapé) o
  outline usa o token `--cor-foco-escuro` (branco), com 7,83:1 contra `#0E5C55`; o par está na
  matriz de contraste do tema.
- Fase 6 **parcial**: a auditoria local via CDP (`scripts/auditoria.mjs`) mede overflow e foco, mas a
  auditoria formal com axe, o teste manual de teclado/leitor de tela, a revisão responsiva manual e o
  Lighthouse seguem pendentes.

## Ambiente da evidência

A evidência da rodada 5 foi produzida em **Node v26.13.0** (`npm 11.20.0`), não na versão
`24.11.0` fixada em `.nvmrc`. Consequência para AC-24: o build foi reproduzido e os hashes de
`dist/` antes/depois do `check` coincidem nesta máquina, mas o determinismo **no Node LTS fixado**
não foi verificado nesta rodada. O CI deve usar `.nvmrc` para fechar AC-24.

## Limitações desta rodada

- Com os dados atuais, o build de produção gera apenas `/` e `/404.html`: as 7 unidades estão
  `a-confirmar`, os 5 serviços e os 5 preparos estão pendentes. Isso é intencional (AC-04/AC-09).
  Use `npm run build:rascunho` para revisar as **17 páginas** com dados fictícios, incluindo as
  novas rotas de F4.
- `npm run build:go-live` **falha hoje** e lista os bloqueios reais (unidades, menu, rotas F4,
  serviço/preparo, blocos pendentes, RT/especialidade, contato institucional, endereço/telefone da
  matriz, identidade provisória e privacidade). Isso é o comportamento esperado até a clínica fechar
  C-01..C-15.
- T013 (rodapé) está **parcial**: razão social e CNPJ são publicados; RT/CRM, especialidade,
  contato e endereço da matriz dependem de dados ainda não confirmados.
- F4 implementada como **estrutura**: `/sobre/`, `/convenios-e-particular/` e `/contato/` existem
  em rascunho com blocos `pendente`; não publicam em produção até os blocos serem aprovados.
  `/politica-de-privacidade/` só entra quando `site.privacidade.politicaPublicada` for `true` e os
  blocos estiverem aprovados. O menu deriva das rotas realmente geradas, sem link quebrado.
- Blocos editoriais de `paginas.json` são renderizados na home, em unidades, serviços, preparo e
  nas páginas de F4 (tipos `titulo`, `subtitulo`, `paragrafo`, `lista`, `destaque`, `aviso`,
  `citacao`; texto sempre escapado). Bloco `pendente` é omitido da produção e listado no relatório.
- F5 (SEO) está implementada: metadados/OG por tipo, JSON-LD, sitemap/robots com `lastmod`, staging
  via `--base-url` e internal linking. Rich Results Test e Schema Validator externos não foram
  executados.
- Relatório: C-02 bloqueia por endereço/CEP, não por `geo` (a ausência de geo é apenas listada);
  C-12 permanece dependência do cliente (DNS/hospedagem) mesmo com `urlBase` preenchido.
- F6 está **parcial**: axe e Lighthouse não foram instalados nem executados; a evidência é a
  auditoria local/CDP em `scripts/auditoria.mjs`, sem teste manual de teclado/leitor de tela nem
  revisão responsiva manual.
- Convênios: catálogo vazio (`dados/convenios.json`); a página e a matriz unidade×convênio são
  estruturais e só publicam com blocos aprovados. A ressalva e a data de atualização já aparecem
  na página da unidade e na página de convênios, inclusive quando houver lista.
- `npm run dev` é um servidor local simples para pré-visualizar o rascunho; não é o servidor de
  produção.

## Pré-visualização no GitHub Pages

O repositório público `ygorsc23/clinica-terradic` publica um **preview não produtivo** em
<https://ygorsc23.github.io/clinica-terradic/> (project page). O conteúdo é o build de rascunho:
17 páginas com dados fictícios, faixa "VERSÃO DE REVISÃO" e `noindex`. Não é o host de produção e
não substitui T064. O preview é aberto, sem senha de acesso.

O Pages está habilitado com origem **GitHub Actions** (`build_type: workflow`).

O GitHub Pages não permite headers HTTP personalizados (CSP, `X-Content-Type-Options`, `Cache-Control`);
o `noindex` do preview depende de `<meta robots>` e `robots.txt`, e T064 continua aberto. O
`robots.txt` do subcaminho é ignorado: rastreadores leem apenas o da raiz do domínio.

**Risco aceito e documentado:** o preview publica o build de rascunho, que inclui entidades pendentes. Depois de uma importação real, dados ainda não promovidos podem aparecer no preview aberto do GitHub Pages. O usuário aceitou conscientemente esse risco; o workflow e o build **não** foram alterados. O preview continua `noindex`, não é o host de produção e não substitui `npm run build:go-live`.

O workflow `.github/workflows/pages-preview.yml` roda em `push` para `master` e em
`workflow_dispatch`: executa `npm test`, gera o rascunho com
`npm run check -- --base-url="$BASE"`, prefixa a base do project page com
`node scripts/prefixar-base.mjs dist-rascunho /clinica-terradic` e publica **somente**
`dist-rascunho` com `actions/deploy-pages`. `dist/` nunca é publicado pelo Pages. O environment
`github-pages` tem política de branch para `master` (ajuste feito no GitHub, não versionado).

Deploy validado em 2026-11-23: home, `/unidades/`, CSS e JS responderam 200; o 404 é próprio;
`noindex` e faixa de revisão presentes; nenhuma URL de produção no artefato.

Para simular localmente:

```powershell
$BASE = "https://ygorsc23.github.io/clinica-terradic"
npm run build:rascunho -- --base-url=$BASE
npm run preview:prefixo
```

O `preview:prefixo` reescreve `href`/`src` internos de `dist-rascunho` para `/clinica-terradic`.
Sirva esse diretório sob o caminho `/clinica-terradic`; `npm run dev` serve na raiz e não simula o
subdiretório do Pages.

A base `/clinica-terradic` é derivada de `GITHUB_REPOSITORY#*/`; ajuste se o repositório for renomeado.
Se o repositório virar `ygorsc23.github.io`, não use a prefixação: o Pages serve o site na raiz.

## Deploy

- **Produção:** somente `dist/` gerado por `npm run build:go-live` **verde**. `npm run build` é build
  tolerante de revisão/preview e **nunca** autoriza publicação.
- **CI de produção:** deve executar `npm ci`, `npm test`, `npm run check` e **falhar** se
  `npm run build:go-live` não sair 0; só então publicar `dist/`.
- O GitHub Pages é apenas preview de rascunho e **não** é o host de produção.
- Nunca publique `dist-rascunho/` ou `dist-staging/` **em produção**. O Pages de preview é a exceção
  controlada e publica somente `dist-rascunho/`.
- `dist/`, `dist-rascunho/` e `dist-staging/` são ignorados no git; `relatorios/` também.
- O artefato de produção é conferido pelo `--check`: sem `noindex`, sem faixa "VERSÃO DE REVISÃO",
  sem unidades de teste e sem URL fictícia no `sitemap.xml`.
