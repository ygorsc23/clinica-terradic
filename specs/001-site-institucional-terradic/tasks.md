# Tarefas — Site institucional Terradic

**Feature:** `001-site-institucional-terradic`
**Base:** `spec.md` + `plan.md`
**Legenda:** `[L]` executável sem conteúdo do cliente · `[C]` depende de conteúdo/aprovação da clínica · `[C*]` depende parcialmente (estrutura livre, dado não). Tarefas desdobradas usam sufixo (`T045a`/`T045b`) para separar a parte técnica da parte que depende do cliente.
**Regra:** nenhuma tarefa `[C]` fecha sem registro em `relatorios/pendencias.md` e aceite do RT quando aplicável.

---

## Fase 0 — Fundação e build

- [ ] **T001 [L] Inicializar repositório e estrutura de pastas** — criar árvore de `plan.md §2`, `.gitignore` (`dist/`, `relatorios/`, `node_modules/`), `.nvmrc`, `README` inicial.
  *Pronto quando:* `git status` limpo e a árvore criada bate com o plano.
  *Estado:* **em aberto** — a árvore de pastas existe, mas falta `git init` e o commit baseline; aguardando `git init` e commit baseline, em execução na rodada 2.
- [x] **T002 [L] Configurar `package.json` + Tailwind CLI** — scripts `dev`, `build`, `build:rascunho`, `build:go-live`, `check`; versão de Tailwind fixada; lockfile versionado.
  *Pronto quando:* `npm ci && npm run build` roda em ambiente limpo sem erro e `build:go-live` existe e falha com pendência bloqueante.
- [x] **T003 [L] Criar `dados/site.json` e `dados/exemplos-briefing.json`** — marca, CNPJ, `urlBase`, portal, RT vazio, `analytics: null`; exemplos do briefing isolados com aviso de "não usar".
  *Pronto quando:* arquivos validam e o build não lê `exemplos-briefing.json`.
- [x] **T004 [L] Implementar carregador + validador de dados** (`scripts/lib/dados.mjs`) — schema mínimo, refs, slug, E.164, CEP, horários, URLs permitidas.
  *Pronto quando:* cada tipo de erro conhecido produz mensagem `arquivo:campo:entidade` e exit code ≠ 0.
- [x] **T005 [L] Implementar renderizador de tokens, parciais e blocos** (`scripts/lib/render.mjs`) — substituição, escape de texto, injeção de fragmentos, renderização de `paginas.json.blocos` (tipos de `plan.md §3.6`), sem `innerHTML`.
  *Pronto quando:* layout renderiza com header/footer, blocos editoriais escapados e nenhum texto editorial fixo em template.
- [x] **T006 [L] Implementar orquestrador de build** (`scripts/build.mjs`) — etapas 1–10 do plano, três modos (`--rascunho`, produção tolerante, `--go-live`), `--check`, `--base-url`, home consumindo blocos, saída determinística.
  *Pronto quando:* duas execuções no mesmo ano geram o mesmo `dist/` (hash idêntico, exceto a virada de ano do rodapé); produção exclui e relata entidade não publicável; `--go-live` falha com qualquer bloqueio (AC-01/AC-09/AC-24).
- [x] **T007 [L] Implementar relatório de pendências** (`scripts/lib/relatorio.mjs`) — `relatorios/pendencias.md` + `.json`, agrupado por entidade, com "bloqueia go-live".
  *Pronto quando:* um campo `null` em unidade publicável aparece no relatório, é excluído do build de produção e derruba o build de go-live.
- [x] **T008 [L] Gate de placeholders, links, NAP e tokens** (`--check`) — bloquear `placeholder`/`TODO`/`lorem`/`[CONFIRMAR]`, links internos quebrados, `target="_blank"` sem `rel`, requisição externa no HTML **e no CSS compilado** (`@import`, `url(http…)`, `@font-face` externo), valor hex de cor fora dos arquivos de tema e claims proibidos ("resultados precisos" e similares). Comparar NAP por equivalência normalizada (CEP só dígitos, telefone E.164, texto visível × JSON-LD × canônico).
  *Pronto quando:* testes negativos para cada regra falham o comando e o log aponta o arquivo; um CSS com `@import`/fonte externa reprova (NFR-02/NFR-07/AC-05); o gate roda sobre o `dist/` de produção e no `--go-live`.

---

## Fase 1 — Layout, tema e navegação global

- [x] **T009 [L] Implementar a direção visual provisória em tokens** (`tailwind.config.js` + `estilo.css`) — paleta do flyer de Pacajus (#00A79B, #0E5C55/#164E4A, #F5B700, #F6F8F8, #1F2933) como variáveis semânticas; escala tipográfica (sans geométrica para títulos, sans neutra no corpo); raio de card 16 px; sombra leve; botões petróleo com texto branco; dourado só como acento; token de foco com contraste ≥ 3:1 contra cada superfície, incluindo variante para hero e rodapé escuros. Criar `logo-placeholder` neutro, **sem imitar nem vetorizar a marca**. Marcar provisoriedade em `site.json.identidadeVisual`, comentário no tema e nota no README.
  *Pronto quando:* nenhum hex solto em template; matriz de contraste dos pares usados registrada com todos os textos ≥ 4,5:1; pares de foco claro/escuro medidos e ≥ 3:1; turquesa/branco e dourado/branco ausentes de texto; CSS minificado < 25 KB gzip; `--check` aprova (AC-17/AC-27/AC-28).
- [ ] **T010 [C*] Substituir a identidade provisória pela oficial** — receber brandbook e SVG do logo (C-11), trocar tokens e arquivo do logo, revalidar contraste e atualizar `identidadeVisual.status` para `oficial`.
  *Pronto quando:* logo em SVG oficial instalado, favicon ajustado, matriz de contraste revalidada e marcações de provisoriedade removidas.
- [x] **T011 [L] Implementar `layout.html`** — skip link, `header`, `main`, `footer`, meta base, `lang="pt-BR"`, slots de metadados.
  *Pronto quando:* qualquer página renderizada tem landmarks e skip link como primeiro foco.
- [x] **T011a [L] Implementar `home.html` consumindo `paginas.home.blocos`** — hero, serviços, unidades e portal como estrutura; todo texto editorial vem dos blocos, sem copy fixa no template.
  *Pronto quando:* a home renderiza os blocos aprovados (pendentes omitidos) e o template não contém texto editorial próprio.
- [x] **T012 [L] Implementar header + menu mobile** — nav com 7 itens, CTA "Baixar exames", botão `aria-expanded`, fechamento por `Esc`, foco devolvido.
  *Pronto quando:* AC-03 passa em teclado e 360 px, sem overflow (AC-02).
- [~] **T013 [C*] Implementar rodapé** - razão social, CNPJ, endereço da matriz (nunca o da unidade), telefone institucional, e-mail, RT+CRM, links legais, CTA. Campos nulos são omitidos, sem placeholder: RT depende de C-08, telefone de C-03 e endereço da matriz de C-02; até lá, o campo correspondente não aparece e AC-21 fica **parcial**.
  *Pronto quando:* razão social e CNPJ aparecem em 100% das páginas geradas; o endereço é o da matriz; AC-21 só é verificável no build de go-live, após C-03/C-08.
  *Estado:* **concluída parcialmente na rodada 1** — o rodapé está implementado e a omissão de campo nulo é a esperada; AC-21 (RT + CRM no rodapé) **não** é verificável enquanto C-03 (contato institucional) e C-08 (RT) não existirem.
- [x] **T014 [L] Implementar componente de CTA "Baixar exames" + aviso de ambiente externo** (`cta-exames.html`, `aviso-externo.html`).
  *Pronto quando:* URL, `target`, `rel`, `aria-label` e aviso visível corretos nas 3 posições (AC-10/AC-11).
- [x] **T015 [L] Implementar breadcrumb** (visual + JSON-LD) e `aria-current` na navegação.
  *Pronto quando:* todas as páginas internas têm trilha coerente com a URL.
- [x] **T016 [L] Página 404** — mensagem, links úteis, sem indexação indevida.
  *Pronto quando:* `dist/404.html` existe e a hospedagem de staging a serve.

---

## Fase 2 — Unidades (núcleo do negócio)

- [x] **T017 [L] Criar `dados/unidades.json` com as 7 unidades em `status: a-confirmar`** — campos nulos, sem telefone/endereço inventado, `cnpjFilial` do levantamento.
  *Pronto quando:* validador aceita o arquivo e **nenhuma** página de unidade é publicada.
- [ ] **T018 [C] Confirmar operação e dados básicos por unidade** (C-01..C-03) — preencher endereço, CEP, telefones, `validacao.status`, `fontes` e `geo` apenas quando houver coordenada confirmada (recomendado, não bloqueante — AC-13).
  *Pronto quando:* cada unidade confirmada passa nos gates e a não confirmada permanece fora do sitemap (AC-04).
- [x] **T019 [L] Implementar `card-unidade` + índice `/unidades/`** — nome, cidade, telefone, serviços resumidos, link.
  *Pronto quando:* índice lista exatamente as unidades publicáveis e nada mais.
- [x] **T020 [L] Implementar template `unidade.html`** — H1 com cidade, pill da unidade (de `nomeExibicao`), endereço, telefones, WhatsApp condicional, horários, serviços, convênios, particular, CTA.
  *Pronto quando:* uma unidade de teste com dados fictícios locais renderiza todos os blocos; o build de produção exclui a mesma unidade `a-confirmar` (sem página, listada no relatório) e AC-04 continua valendo.
- [x] **T021 [L] Derivar mapa serviço→unidades e convênio→unidades** no build (sem duplicar dado).
  *Pronto quando:* AC-07 passa e adicionar serviço em 1 unidade altera as páginas correspondentes sem editar template.
- [x] **T022 [L] Implementar `mapa-fachada` sob clique** — endereço textual sempre visível, botão que injeta iframe, link "Abrir no Google Maps", aviso de externo.
  *Pronto quando:* carregamento inicial não faz requisição ao Google (AC-19) e o mapa funciona por teclado.
- [ ] **T023 [C] Revisar NAP de cada unidade contra CNES/CNPJ e telefone** — registrar fonte e data.
  *Pronto quando:* AC-05 passa e `fontes[]` está preenchido em todas as unidades publicadas.
- [ ] **T024 [C] Adicionar fotos reais com autorização** (C-11) — `fotos[]` com `alt` e `autorizacaoImagem`.
  *Pronto quando:* nenhuma imagem de banco é usada e cada foto tem autorização registrada.

---

## Fase 3 — Serviços e preparo de exames

- [x] **T025 [L] Criar `dados/servicos.json`** com os 5 serviços em `status: pendente`.
  *Pronto quando:* arquivo valida e nenhum serviço é publicado.
- [ ] **T026 [C] Escrever e aprovar textos de serviço** (C-05, C-13) — linguagem leiga, sem promessa de resultado, sem duração não confirmada.
  *Pronto quando:* checklist CFM aplicado e RT ciente; serviços passam a `aprovado`.
- [x] **T027 [L] Implementar `/servicos/`** — cards com resumo e link.
  *Pronto quando:* lista apenas serviços aprovados.
- [x] **T028 [L] Implementar `servico.html`** — o que é, como é feito, preparo relacionado, unidades que realizam, aviso de que não substitui consulta.
  *Pronto quando:* cada serviço lista só unidades reais e linka o preparo correto.
- [x] **T029 [L] Criar `dados/preparos.json`** com estrutura completa e `revisao.status: pendente`.
  *Pronto quando:* o build de produção exclui o preparo pendente e o relata; o build de go-live falha com preparo pendente necessário a serviço publicável (AC-09).
- [ ] **T030 [C] Redigir preparos e submeter ao RT** (C-09) — jejum, medicação, documentos, vestimenta, alertas.
  *Pronto quando:* `revisao` com nome, CRM e data em todos os preparos publicados.
- [x] **T031 [L] Implementar `/preparo-de-exames/` com acordeões** — `<details>/<summary>`, âncoras estáveis, link copiável, funciona sem JS.
  *Pronto quando:* AC-08 passa (teclado, `aria-expanded`, âncora direta, sem JS).
- [x] **T032 [L] Adicionar aviso de variação por unidade e orientação de confirmação por telefone** (FR-24).
  *Pronto quando:* aviso presente em todos os preparos aprovados.

---

## Fase 4 — Convênios, institucional, contato

- [ ] **T033 [L] Criar `dados/convenios.json`** e a matriz unidade×convênio derivada.
  *Pronto quando:* nomes em texto, `logoAutorizado: false` por padrão, ressalva obrigatória renderizada.
- [ ] **T034 [C] Confirmar convênios por unidade e formas de pagamento** (C-06, C-07).
  *Pronto quando:* nenhum convênio não confirmado aparece e a data de atualização é visível.
- [ ] **T035 [L] Implementar `/convenios-e-particular/`** — explicação da diferença entre particular e convênio, lista por unidade, documentos e formas de pagamento somente se confirmados (FR-27), ressalva, links para unidades; texto editorial vindo de `paginas.convenios.blocos` (nada fixo no template).
  *Pronto quando:* AC-29 passa — a ressalva "cobertura sujeita a confirmação junto à operadora e à unidade" aparece visível em toda menção a convênio, nenhum convênio não confirmado é exibido, a data de atualização da lista é mostrada e nenhum texto afirma cobertura garantida; AC-22 mantido (zero formulário).
- [ ] **T036 [L] Implementar `/sobre/`** — blocos institucionais de `paginas.sobre.blocos`, abrangência, RT com CRM, link para contato.
  *Pronto quando:* RT visível na página e no rodapé (quando C-08 existir); nenhum superlativo não comprovável; nenhum texto editorial fixo no template.
- [ ] **T037 [L] Implementar `/contato/`** — telefones por unidade, e-mail institucional, endereço da matriz, mapa-fachada, zero formulário; texto editorial de `paginas.contato.blocos`.
  *Pronto quando:* AC-22 passa (nenhum `<form>`/`input` de dado pessoal) e todos os `tel:` são válidos (AC-06).
- [ ] **T037a [L] Implementar `/politica-de-privacidade/` condicional** — renderiza `paginas.privacidade.blocos` somente quando `privacidade.publicada: true`; sem link no rodapé enquanto não publicada; entra no sitemap só quando publicada.
  *Pronto quando:* ausência da política não gera rota nem link; com texto aprovado (C-14), a página é gerada, linkada no rodapé e incluída no sitemap.

---

## Fase 5 — SEO local e dados estruturados

- [ ] **T038 [L] Implementar gerador de metadados** (`scripts/lib/seo.mjs`) — title/description por tipo de página, canonical, OG/Twitter, `og:image`.
  *Pronto quando:* AC-12 passa em todas as rotas e nenhum title se repete.
- [ ] **T039 [L] Implementar JSON-LD `Organization` + `MedicalClinic` por unidade** — `@id`, endereço, geo condicional, telefone, horários, `availableService`, `parentOrganization`.
  *Pronto quando:* AC-13 passa no Rich Results Test para 2 unidades distintas.
- [ ] **T040 [L] Implementar `BreadcrumbList` e `WebPage`/`MedicalWebPage`** — `isPartOf` correto, sem `SearchAction`.
  *Pronto quando:* Schema Validator sem erro em home, unidade, serviço e preparo.
- [ ] **T041 [L] Gerar `sitemap.xml` e `robots.txt`** a partir das rotas realmente escritas, `lastmod` de `atualizadoEm`.
  *Pronto quando:* AC-14 passa, incluindo ausência de URL de rascunho.
- [ ] **T042 [L] Implementar `og-image` por tipo de página** — 1200×630, sem texto que prometa resultado.
  *Pronto quando:* cada tipo de página tem imagem válida e peso < 200 KB.
- [ ] **T043 [L] Internal linking** — unidade↔serviço↔preparo, rodapé com todas as unidades, profundidade ≤ 2.
  *Pronto quando:* nenhuma página publicada está a mais de 2 cliques da home.
- [ ] **T044 [C] Completar JSON-LD com `geo` (quando confirmado) e RT reais** (C-02, C-08).
  *Pronto quando:* o `geo` aparece nas unidades com coordenada confirmada e sua ausência, nas demais, não gera erro e está listada no relatório de pendências; `taxID`/RT conferidos.
- [ ] **T045a [L] Preparar staging com `noindex` e conferir a marcação** — build de staging via `--base-url` (pode usar o build de produção tolerante), `meta robots: noindex` em todas as páginas, `robots.txt` de produção intacto; verificar que o build de produção e o go-live não emitem o meta.
  *Pronto quando:* todas as páginas servidas no staging têm `<meta name="robots" content="noindex">`, o build de produção não tem esse meta e `robots.txt` de produção libera o site apontando o sitemap (AC-14).
- [ ] **T045b [C] Verificar o domínio no Search Console/Bing e enviar o sitemap** — depende de acesso ao DNS/domínio definitivo (C-12): verificação por registro TXT ou arquivo, envio do `sitemap.xml`, conferência de cobertura e de erros.
  *Pronto quando:* propriedade verificada, sitemap aceito sem erros e nenhuma URL de rascunho reportada.

---

## Fase 6 — Acessibilidade, performance e responsividade

- [ ] **T046 [L] Auditoria axe nas 5 páginas-chave** — corrigir todas as violações críticas/sérias.
  *Pronto quando:* AC-16 = zero violações críticas/sérias.
- [ ] **T047 [L] Revisão de teclado e leitor de tela** — header, menu, acordeões, mapa, rodapé; medir o contraste do indicador de foco sobre superfície clara e escura (hero e rodapé).
  *Pronto quando:* AC-17 passa, com foco visível e ≥ 3:1 em todas as superfícies, e o fluxo é compreensível em NVDA ou VoiceOver.
- [ ] **T048 [L] Revisão responsiva 320–1440 px** — header, cards, horários, tabela de convênios, rodapé.
  *Pronto quando:* AC-02 passa em 6 larguras sem overflow.
- [ ] **T049 [L] Otimizar imagens e fontes** — WebP/AVIF, `srcset`, dimensões, `loading="lazy"`, woff2 self-host com `preload`.
  *Pronto quando:* nenhuma imagem > 250 KB e nenhuma fonte de terceiro.
- [ ] **T050 [L] Orçamento de JS/CSS no `--check`** — falhar se JS > 10 KB ou CSS > 25 KB gzip.
  *Pronto quando:* AC-19 medido no build, não só no DevTools.
- [ ] **T051 [L] Rodar Lighthouse mobile e registrar baseline** — Performance ≥ 90, A11y ≥ 95, SEO ≥ 95, BP ≥ 90.
  *Pronto quando:* AC-18 atingido nas 5 páginas-chave e resultado anexado ao PR.
- [ ] **T052 [L] Verificar degradação sem JS** — conteúdo essencial e acordeões acessíveis.
  *Pronto quando:* página de preparo continua legível com JS desabilitado.

---

## Fase 7 — Conteúdo e conformidade (bloqueante para go-live)

- [ ] **T053 [C] Fechar C-01: unidades ativas** — atualizar `status` e publicar somente confirmadas.
- [ ] **T054 [C] Fechar C-02..C-04: endereço, `geo` (quando houver coordenada confirmada), telefones, horários** — `validacao.status: confirmado`.
- [ ] **T055 [C] Fechar C-05: serviços por unidade** — ajustar `unidades[].servicos`.
- [ ] **T056 [C] Fechar C-06/C-07: convênios, documentos, pagamento** — atualizar catálogo e matriz.
- [ ] **T057 [C] Fechar C-08: RT e CRM** — preencher `site.json.responsavelTecnico` (e por unidade, se Q-05 assim definir).
- [ ] **T058 [C] Fechar C-09: preparos aprovados pelo RT** — `revisao.status: aprovado` com data.
- [ ] **T059 [C] Fechar C-10: textos institucionais e da home** — blocos aprovados, sem promessa de resultado.
- [ ] **T060 [C] Fechar C-12/C-15: domínio, e-mail, redes oficiais** — `urlBase`, `sameAs`, contato.
- [ ] **T061 [C] Fechar C-14: política de privacidade/aviso legal** — publicar ou remover link do rodapé.
- [ ] **T062 [C] Aplicar checklist de publicidade médica página a página** — inclui confirmar que nenhum texto/foto/claim do flyer de campanha foi reaproveitado; assinatura do RT (AC-20).
- [ ] **T063 [C] Revisar `relatorios/pendencias.md` com a clínica** — zerar ou aceitar formalmente cada item (AC-23).

---

## Fase 8 — Go-live e operação

- [ ] **T064 [L] Configurar hospedagem de produção** — HTTPS, 404, headers de cache/segurança, CSP com `frame-src` do Maps.
- [ ] **T065 [L] Deploy de produção + smoke test** — somente a partir de `--go-live` verde (AD-12); todas as rotas 200, CTA externo, mapa, 404, sitemap acessível.
  *Pronto quando:* AC-01/AC-10/AC-14 verificados na URL pública.
- [ ] **T066 [C] Apontar domínio e redirect `www` → apex** (Q-06) — canonical e sitemap coerentes com o host final.
- [ ] **T067 [L] Monitoramento e alertas** — uptime, expiração de domínio/certificado, backup das fontes.
- [ ] **T068 [L] Documentar operação no README** — adicionar unidade/serviço/preparo, rodar build, checklist de publicação, rollback.
- [ ] **T069 [C] Alinhar Google Business Profile por unidade** (fora do código, mas dependência de SEO local) — NAP equivalente ao do site após normalização (AC-05).
- [ ] **T070 [C] Aceite final do cliente** — termo de aprovação da especificação, do conteúdo e do go-live.

---

## Dependências e ordem

**Rodadas:**

| Rodada | Escopo | Estado |
|---|---|---|
| 1 | F0–F3 (parcial): fundação, build, layout, unidades, serviços e preparo | concluída; T013 entregue **parcial** (AC-21 depende de C-03/C-08); T010 (identidade oficial) e T030 (revisão do RT) seguem com o cliente; o versionamento git (T001) entra na rodada 2 |
| 2 | Correções do QA (T006/T008/T029, ajustes pontuais de T013 e artefatos), renderizador de blocos (T005/T006/T011a), git (T001) e versão HTML da proposta | em andamento |
| 3 | F4–F6: T033–T037a, T038–T052 | planejada |
| Pós-cliente | F7–F8: T053–T070 | dependente do cliente |

```
T001→T002→T003→T004→T005→T006→T007→T008
                              ↓
T009→T011→T011a→T012/T013/T014/T015→T016
                              ↓
T017→T019→T020→T021→T022        (T018 depois, em paralelo com T023)
                              ↓
T025→T027→T028   T029→T031→T032   T033→T035   T036→T037→T037a
                              ↓
T038→T039→T040→T041→T042→T043→T045a   (T045b só após T066 e C-12)
                              ↓
T046..T052 (podem rodar em paralelo entre si)
                              ↓
T053..T063 (bloqueiam go-live)
                              ↓
T064..T070 (T065 só a partir de `--go-live` verde)
```

**Caminho crítico sem cliente:** T001–T016 (exceto as partes dependentes de cliente em T010/T013), T019–T022, T027–T029, T031–T033, T035–T037a, T038–T043, T045a, T046–T052, T064–T065, T067–T068. Tudo isso pode ser construído e revisado com dados de teste locais, enquanto C-01..C-15 são coletados. T013 fica **parcial** até C-08; T029 é estrutural, mas AC-09 só fecha após C-09/T030. AC-21 só é verificável no go-live.

---

## Cobertura dos critérios de aceite

| Critério | Tarefas |
|---|---|
| AC-01 | T002, T006, T041, T065 |
| AC-02 | T012, T048 |
| AC-03 | T012, T047 |
| AC-04 | T017, T018, T019, T041, T053 |
| AC-05 | T008, T023, T039, T044 |
| AC-06 | T020, T037 |
| AC-07 | T021, T028 |
| AC-08 | T031, T052 |
| AC-09 | T006, T029, T030, T058 |
| AC-10 | T014 |
| AC-11 | T014 |
| AC-12 | T038 |
| AC-13 | T039, T044 |
| AC-14 | T041, T045a, T045b |
| AC-15 | T008, T063 |
| AC-16 | T046 |
| AC-17 | T009, T047 |
| AC-18 | T051 |
| AC-19 | T008, T022, T049, T050 |
| AC-20 | T062 |
| AC-21 | T013 (parcial), T057 |
| AC-22 | T035, T037 |
| AC-23 | T007, T063 |
| AC-24 | T006 |
| AC-25 | T006, T008 |
| AC-26 | T020, T023, T037, T039 |
| AC-27 | T008, T009, T046 |
| AC-28 | T009, T010, T020 |
| AC-29 | T033, T034, T035, T056 |
