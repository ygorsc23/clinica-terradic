# Site institucional Terradic

Site institucional estático e multiunidade da Terradic (rede de diagnóstico por imagem e
telerradiologia no Ceará). O site é gerado por um build próprio em Node: HTML5 + Tailwind CSS
compilado via CLI (nunca CDN) + um único bundle de JavaScript vanilla. Não há backend, banco de
dados, formulário, cookie próprio ou analytics.

Este repositório está na **segunda rodada de implementação** (Fases 0, 1, 2 e parte da Fase 3 do
`specs/001-site-institucional-terradic/tasks.md`), com as correções do QA da rodada 1: gate
estrito de go-live, telefone validado, identificação do rodapé, artefato de rascunho separado,
auditoria da produção real, blocos editoriais e ajustes de acessibilidade/conteúdo. Convênios,
Sobre/Contato, SEO completo e deploy ainda não foram implementados.

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
| `npm run build` | Build de produção tolerante: só publica unidade `ativo` + validação `confirmado` + telefone validado, serviço `aprovado`, preparo `aprovado`. Grava `dist/` e `relatorios/`. |
| `npm run build:go-live` | Gate estrito de publicação: exige unidade publicável, menu com ao menos 2 itens, rotas estruturais, preparos aprovados, RT/CRM, contato institucional e endereço da matriz. Falha listando **todos** os bloqueios de uma vez. Hoje falha (dados pendentes) — comportamento esperado. |
| `npm run build:rascunho` | Build de revisão: inclui entidades pendentes, usa `dados-teste/unidades.exemplo.json` quando existir e adiciona a faixa "VERSÃO DE REVISÃO — DADOS NÃO CONFIRMADOS" + `noindex`. Grava `dist-rascunho/`. |
| `npm run check` | `--rascunho --check`: valida dados, gera o site de revisão em `dist-rascunho/` e roda **todas** as regras de QA sobre o rascunho e sobre uma produção real gerada em diretório temporário (links, `tel:`, `rel`, NAP visível, hex, claims, orçamento, requisição externa em HTML/JS/CSS, artefato de produção). Também confere que o `dist/` de produção não foi alterado. |
| `npm test` | Testes negativos com `node:test` (validador de dados, regras do `--check`, go-live, blocos e metadados). |

O build não acessa a rede. A única chamada externa é o Tailwind CLI local.

`npm run check` grava o artefato de revisão em `dist-rascunho/` (ignorado no git) e **não** sobrescreve `dist/`. O relatório em
`relatorios/` é sempre gerado a partir dos dados reais, inclusive quando o build é de rascunho.
O deploy publica **apenas** a saída de `npm run build` (ou de `npm run build:go-live` quando ele passar).

### Flags do build

```powershell
node scripts/build.mjs --rascunho
node scripts/build.mjs --go-live
node scripts/build.mjs --check
node scripts/build.mjs --base-url=https://staging.exemplo.com
```

`--go-live` implica produção + auditoria completa; ele não gera `dist/` se o gate falhar.
`--base-url` troca as URLs geradas (canonical, sitemap, robots) e coloca o build em modo staging:
todas as páginas recebem `noindex, follow` e o `robots.txt` sai com `Disallow: /`. O `dados/site.json`
continua exigindo `https://terradic.com.br`; nada disso afeta o build de produção.

## Estrutura

```
dados/            fonte de verdade (site, unidades, serviços, preparos, convênios, páginas)
dados-teste/      dados fictícios, usados apenas em --rascunho
dados/exemplos-briefing.json   exemplos do levantamento; fora do build (só o validador lê)
src/templates/    layout, páginas e parciais com tokens {{...}}
src/css/          entrada do Tailwind + tokens de tema (únicas cores literais do projeto)
src/js/           bundle único (menu, acordeões, fachada de mapa)
src/estatico/     favicon, marca provisória, imagens OG por tipo (og-*.png)
scripts/          build.mjs, servidor.mjs, testes.mjs, lib/*.mjs
dist/             saída de produção gerada (ignorada no git)
dist-rascunho/    saída de revisão do --rascunho/--check (ignorada no git)
relatorios/       pendencias.md e pendencias.json (ignorados no git)
```

O build escreve `dist/<rota>/index.html` (ou `dist-rascunho/<rota>/index.html` em revisão),
`404.html`, `sitemap.xml`, `robots.txt`, `assets/estilo.css`, `assets/app.js` e copia
`src/estatico/` para a saída.

## Como editar conteúdo

### Trocar um telefone

1. Abra `dados/unidades.json`.
2. Localize a unidade pelo `slug` e edite `telefones[].e164` **apenas no formato E.164**
   (`+55` + DDD + número, ex.: `+558533433739`). O site formata para leitura, e o JSON-LD e o
   `tel:` usam o mesmo valor.
3. Marque `validado: true` somente depois de confirmar o número com a clínica.
4. Rode `npm run check` (ou `npm run build:rascunho`) e confira a página da unidade e o rodapé.
5. Rode `npm run build` para o artefato de produção.

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
4. Rode `npm run build` e depois `npm run check`. Um erro de dado sai no formato
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

## Regras aplicadas pelo build

- Campos obrigatórios por status, slug único e normalizado, referências existentes, telefone
  `^\+55\d{10,11}$`, CEP `^\d{8}$`, `abre < fecha`, `urlBase` e `portalExames.url` exatas.
- Unidade `ativo` exige validação `confirmado` com `confirmadoPor`, `data` e `fontes`, além de ao
  menos um telefone com `validado: true` em E.164. `validado` ausente ou não booleano é erro.
- Unidade publicável também exige ao menos um serviço `aprovado` entre os serviços informados.
- Blocos editoriais exigem `status` `pendente|aprovado`; blocos pendentes não entram na produção.
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
  (`title`, `description`, `image`, `url`, `type`, `locale`) e `twitter:card`.
- Imagens OG estáticas 1200×630 em `src/estatico/assets/og-*.png` (home, unidade, serviço, preparo e
  institucional), ≤ 200 KB, geradas uma vez a partir dos tokens do tema, sem logo ou claim. O build
  apenas copia; não gera imagem em runtime.
- JSON-LD: `Organization` com `legalName`, `taxID` e `sameAs` quando houver; `MedicalClinic` por
  unidade com endereço completo, `geo` só quando confirmado, telefone, horários,
  `availableService`, `parentOrganization` e `areaServed`; `MedicalWebPage` para serviço e preparo;
  `BreadcrumbList` em todas as páginas internas e 404; `WebSite` apenas na home.
- Sitemap e robots derivam das rotas geradas; `lastmod` vem de `atualizadoEm`. O `--check` audita o
  `dist/` existente e o `sitemap.xml` real.
- Internal linking: unidade ↔ serviço ↔ preparo, rodapé com todas as unidades publicáveis,
  profundidade ≤ 2 cliques a partir da home.

## Auditoria F6 local

```powershell
npm run build:rascunho
node scripts/auditoria.mjs
```

O script sobe `dist-rascunho` em `127.0.0.1`, abre Chrome/Edge headless via CDP e mede overflow
horizontal em 320/360/768/1024/1280/1440 px nas páginas home, unidade, serviço, preparo, contato e
404, além de foco inicial, menu mobile, acordeões e checagens manuais de acessibilidade. Ele não
instala nada e não entra no runtime do site.

**Ferramentas ausentes:** `axe-core` e `lighthouse` não estão instalados no projeto e não foram
adicionados. A auditoria de acessibilidade é manual/scriptada (não axe) e a medição de performance é
via CDP/Performance API (não score Lighthouse). Os números ficam em
`relatorios/verificacao-rodada4.txt`.

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
- Pendente para a Fase 6: auditoria formal com axe, teste de leitor de tela e revisão responsiva de
  320 a 1440 px.

## Limitações desta rodada

- Com os dados atuais, o build de produção gera apenas `/` e `/404.html`: as 7 unidades estão
  `a-confirmar`, os 5 serviços e os 5 preparos estão pendentes. Isso é intencional (AC-04/AC-09).
  Use `npm run build:rascunho` para revisar as **17 páginas** com dados fictícios, incluindo as
  novas rotas de F4.
- `npm run build:go-live` **falha hoje** e lista os bloqueios reais (unidades, menu, rotas F4,
  serviço aprovado, blocos pendentes, RT/CRM/especialidade, contato institucional e endereço da
  matriz). Isso é o comportamento esperado até a clínica fechar C-01..C-15.
- T013 (rodapé) está **parcial**: razão social e CNPJ são publicados; RT/CRM, especialidade,
  contato e endereço da matriz dependem de dados ainda não confirmados.
- F4 implementada como **estrutura**: `/sobre/`, `/convenios-e-particular/` e `/contato/` existem
  em rascunho com blocos `pendente`; não publicam em produção até os blocos serem aprovados.
  `/politica-de-privacidade/` só entra quando `site.privacidade.politicaPublicada` for `true` e os
  blocos estiverem aprovados. O menu deriva das rotas realmente geradas, sem link quebrado.
- Blocos editoriais de `paginas.json` são renderizados na home, em unidades, serviços, preparo e
  nas páginas de F4 (tipos `titulo`, `subtitulo`, `paragrafo`, `lista`, `destaque`, `aviso`,
  `citacao`; texto sempre escapado). Bloco `pendente` é omitido da produção e listado no relatório.
- JSON-LD cobre `Organization`, `WebSite`, `MedicalClinic`, `MedicalWebPage`, `BreadcrumbList` e
  `WebPage`; Rich Results Test externo não foi executado.
- Ferramentas de auditoria externas não foram instaladas: axe e Lighthouse ficam **não
  verificados**; a evidência é a auditoria manual/CDP em `scripts/auditoria.mjs`.
- Convênios: catálogo vazio (`dados/convenios.json`); a página e a matriz unidade×convênio são
  estruturais e só publicam com blocos aprovados. A ressalva e a data de atualização já aparecem
  na página da unidade e na página de convênios, inclusive quando houver lista.
- `npm run dev` é um servidor local simples para pré-visualizar o rascunho; não é o servidor de
  produção.

## Deploy

- O deploy publica **apenas** a saída de `npm run build` (ou de `npm run build:go-live` quando ele
  passar). Nunca publique `dist-rascunho/`, que contém faixa de revisão, `noindex` e dados fictícios.
- `dist/` e `dist-rascunho/` são ignorados no git; `relatorios/` também.
- O artefato de produção é conferido pelo `--check`: sem `noindex`, sem faixa "VERSÃO DE REVISÃO",
  sem unidades de teste e sem URL fictícia no `sitemap.xml`.
