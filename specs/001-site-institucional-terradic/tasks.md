# Tarefas — Site institucional Terradic

**Feature:** `001-site-institucional-terradic`
**Base:** `spec.md` + `plan.md`
**Legenda:** `[L]` executável sem conteúdo do cliente · `[C]` depende de conteúdo/aprovação da clínica · `[C*]` depende parcialmente (estrutura livre, dado não). Tarefas desdobradas usam sufixo (`T045a`/`T045b`) para separar a parte técnica da parte que depende do cliente.
**Regra:** nenhuma tarefa `[C]` fecha sem registro em `relatorios/pendencias.md` e aceite do RT quando aplicável.

---

## Fase 0 — Fundação e build

- [x] **T001 [L] Inicializar repositório e estrutura de pastas** — criar árvore de `plan.md §2`, `.gitignore` (`dist/`, `relatorios/`, `node_modules/`), `.nvmrc`, `README` inicial.
  *Pronto quando:* `git status` limpo e a árvore criada bate com o plano.
  *Estado:* **concluída em 2026-11-20** — histórico com `d056e8a` (baseline) e `393c73e` (permissões); `git status` limpo.
- [x] **T002 [L] Configurar `package.json` + Tailwind CLI** — scripts `dev`, `build`, `build:rascunho`, `build:go-live`, `check`; versão de Tailwind fixada; lockfile versionado.
  *Pronto quando:* `npm ci && npm run build` roda em ambiente limpo sem erro e `build:go-live` existe e falha com pendência bloqueante.
- [x] **T003 [L] Criar `dados/site.json` e `dados/exemplos-briefing.json`** — marca, CNPJ, `urlBase`, portal, RT vazio, `analytics: null`; exemplos do briefing isolados com aviso de "não usar".
  *Pronto quando:* arquivos validam e o build não lê `exemplos-briefing.json`.
- [x] **T004 [L] Implementar carregador + validador de dados** (`scripts/lib/dados.mjs`) — schema mínimo, refs, slug, E.164, CEP, horários, URLs permitidas.
  *Pronto quando:* cada tipo de erro conhecido produz mensagem `arquivo:campo:entidade` e exit code ≠ 0.
- [x] **T005 [L] Implementar renderizador de tokens, parciais e blocos** (`scripts/lib/render.mjs`) — substituição, escape de texto, injeção de fragmentos, renderização de `paginas.json.blocos` (tipos de `plan.md §3.6`), sem `innerHTML`.
  *Pronto quando:* layout renderiza com header/footer, blocos editoriais escapados e nenhum texto editorial fixo em template. Aplica a classificação vinculante de FR-48/RN-12: frase, título com conteúdo e chamada vão para `paginas.json`; rótulo de interface ("pular para o conteúdo", "abre em nova aba", "menu") pode ficar no template.
- [x] **T006 [L] Implementar orquestrador de build** (`scripts/build.mjs`) — etapas 1–10 do plano, três modos (`--rascunho`, produção tolerante, `--go-live`), `--check`, `--base-url`, home consumindo blocos, saída determinística.
  *Pronto quando:* duas execuções no mesmo ano geram o mesmo `dist/` (hash idêntico, exceto a virada de ano do rodapé); produção exclui e relata entidade não publicável; `--go-live` falha com qualquer bloqueio (AC-01/AC-09/AC-24), incluindo unidade publicável sem serviço aprovado, bloco pendente em página publicável, RT incompleto e convênio sem `atualizadoEm`.
- [x] **T007 [L] Implementar relatório de pendências** (`scripts/lib/relatorio.mjs`) — `relatorios/pendencias.md` + `.json`, agrupado por entidade, com "bloqueia go-live".
  *Pronto quando:* um campo `null` em unidade publicável aparece no relatório, é excluído do build de produção e derruba o build de go-live.
- [x] **T008 [L] Gate de placeholders, links, NAP e tokens** (`--check`) — bloquear `placeholder`/`TODO`/`lorem`/`[CONFIRMAR]`, links internos quebrados, `target="_blank"` sem `rel`, requisição externa no HTML **e no CSS compilado** (`@import`, `url(http…)`, `@font-face` externo), valor hex de cor fora dos arquivos de tema e claims proibidos ("resultados precisos" e similares). Comparar NAP por equivalência normalizada (CEP só dígitos, telefone E.164, texto visível × JSON-LD × canônico), **incluindo o rodapé de todas as páginas contra o endereço/telefone da matriz e o contato institucional** (AC-30). Gate de artefato (AC-34): `slugsTeste` em **todos os HTML e no `sitemap.xml`**; detecção de `noindex` independente da ordem dos atributos da `<meta>`; auditoria do `sitemap.xml` **já existente** no `dist/` (base permitida, URLs fictícias, slug de teste), não apenas do gerado em memória.
  *Pronto quando:* testes negativos para cada regra falham o comando e o log aponta o arquivo; um CSS com `@import`/fonte externa reprova (NFR-02/NFR-07/AC-05); um rodapé sem endereço/telefone da matriz ou divergente reprova (AC-30); `<meta content="noindex" name="robots">` (ordem invertida) e slug de teste no sitemap reprovam (AC-34); o gate roda sobre o `dist/` de produção e no `--go-live`.

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
- [~] **T013 [C*] Implementar rodapé** - razão social, CNPJ, endereço da matriz (nunca o da unidade), telefone institucional, e-mail, RT (nome + CRM/UF + especialidade), links legais, CTA. **Fonte única:** endereço e telefone institucionais vêm do registro `matriz: true` em `unidades.json`; `contatoInstitucional.telefoneE164`, se preenchido, precisa coincidir com ele (divergência = erro). É proibido o estado em que o rodapé sai sem endereço/telefone enquanto a página afirma exibir os dados da matriz: no build de produção tolerante a omissão é relatada e nenhuma página faz essa afirmação; no go-live o dado é obrigatório (AC-30). RT é renderizado de forma condicional ao conjunto completo, sem pontuação órfã (AC-33). Campos nulos são omitidos, sem placeholder: RT depende de C-08, telefone/endereço da matriz de C-03/C-02; até lá, o campo correspondente não aparece e AC-21/AC-30 ficam **parciais**.
  *Pronto quando:* razão social e CNPJ aparecem em 100% das páginas geradas; endereço/telefone do rodapé são os da matriz e equivalentes ao contato institucional; RT nunca sai com pontuação órfã; AC-21 e AC-30 só são verificáveis no build de go-live, após C-02/C-03/C-08.
  *Estado:* **concluída parcialmente na rodada 1, em revisão na rodada 3** — o rodapé está implementado e a omissão de campo nulo é a esperada; faltam a fonte única explícita para endereço/telefone e a especialidade do RT. AC-21 (RT no rodapé) e AC-30 (NAP do rodapé) **não** são verificáveis enquanto C-02/C-03/C-08 não existirem.
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
  *Pronto quando:* uma unidade de teste com dados fictícios locais renderiza todos os blocos; a seção de serviços nunca sai vazia (exige ≥ 1 serviço aprovado, coerente com `availableService` — AC-31); o build de produção exclui a mesma unidade `a-confirmar` (sem página, listada no relatório) e AC-04 continua valendo.
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

- [~] **T033 [L] Criar `dados/convenios.json`** e a matriz unidade×convênio derivada.
  *Pronto quando:* nomes em texto, `logoAutorizado: false` por padrão, ressalva obrigatória renderizada e `atualizadoEm` não nulo sempre que o catálogo tiver convênio (AC-29/AC-33).
  *Estado:* **em execução na rodada 3** — catálogo vazio é válido; a data só passa a ser exigida quando houver convênio. Conteúdo pendente mantém a página de convênios fora da produção e o go-live vermelho — esperado, não defeito.
- [~] **T034 [C] Confirmar convênios por unidade e formas de pagamento** (C-06, C-07).
  *Pronto quando:* nenhum convênio não confirmado aparece, a data de atualização (`atualizadoEm`) é visível e preenchida em todo convênio existente.
  *Estado:* **em execução na rodada 3** — bloqueada por conteúdo da clínica; a ausência mantém a página fora da produção e o go-live vermelho.
- [~] **T035 [L] Implementar `/convenios-e-particular/`** — explicação da diferença entre particular e convênio, lista por unidade, documentos e formas de pagamento somente se confirmados (FR-27), ressalva, data de atualização, links para unidades; texto editorial vindo de `paginas.convenios.blocos` (nada fixo no template).
  *Pronto quando:* AC-29 passa — a ressalva "cobertura sujeita a confirmação junto à operadora e à unidade" aparece visível em toda menção a convênio, nenhum convênio não confirmado é exibido, a data de atualização da lista é mostrada e nenhum texto afirma cobertura garantida; AC-22 mantido (zero formulário); bloco `pendente` não é renderizado (AC-32).
  *Estado:* **em execução na rodada 3** — estrutura pronta; sem convênios/blocos aprovados, a página não é publicável e o go-live permanece vermelho. Esperado.
- [~] **T036 [L] Implementar `/sobre/`** — blocos institucionais de `paginas.sobre.blocos`, abrangência, RT com nome/CRM/UF/especialidade, link para contato.
  *Pronto quando:* RT visível na página e no rodapé (quando C-08 existir), completo e sem pontuação órfã (AC-33); nenhum superlativo não comprovável; nenhum texto editorial fixo no template; sem bloco aprovado, a página não é publicada e o go-live falha (AC-32).
  *Estado:* **em execução na rodada 3** — depende dos blocos de `paginas.sobre` e de C-08; até lá, página fora da produção e go-live vermelho.
- [~] **T037 [L] Implementar `/contato/`** — telefones por unidade, e-mail institucional, endereço da matriz, mapa-fachada, zero formulário; texto editorial de `paginas.contato.blocos`.
  *Pronto quando:* AC-22 passa (nenhum `<form>`/`input` de dado pessoal), todos os `tel:` são válidos (AC-06) e o endereço da matriz exibido é o mesmo do rodapé, vindo do registro `matriz: true` (AC-30). Sem endereço/telefone institucional confirmados, a rota não é publicada e o go-live falha.
  *Estado:* **em execução na rodada 3** — a página afirma exibir o endereço da matriz; sem C-02/C-03 ela não entra na produção e o go-live fica vermelho. Esperado.
- [~] **T037a [L] Implementar `/politica-de-privacidade/` condicional** - renderiza `paginas.privacidade.blocos` somente quando `site.privacidade.politicaPublicada: true`; sem link no rodapé enquanto não publicada; entra no sitemap só quando publicada.
  *Pronto quando:* ausência da política não gera rota nem link; com texto aprovado (C-14), a página é gerada, linkada no rodapé e incluída no sitemap; bloco pendente não é renderizado (AC-32).
  *Estado:* **em execução na rodada 3** — sem C-14, permanece fora da produção; go-live vermelho é o esperado.

---

## Fase 5 — SEO local e dados estruturados

- [x] **T038 [L] Implementar gerador de metadados** (`scripts/lib/seo.mjs`) — title/description por tipo de página, canonical, OG/Twitter, `og:image`.
  *Pronto quando:* AC-12 passa em todas as rotas e nenhum title se repete.
  *Estado:* **concluída na rodada 4** — metadados por tipo em `scripts/lib/seo.mjs`; title/description únicos, canonical e OG/Twitter verificados por `R4-F5: metadados completos e únicos...` em `scripts/testes.mjs`.
- [x] **T039 [L] Implementar JSON-LD `Organization` + `MedicalClinic` por unidade** — `@id`, endereço, geo condicional (exige `precisao` `exata|aproximada` e `validacao.fontes[]`), telefone, horários, `availableService`, `parentOrganization`; sem `medicalSpecialty` fixo (alinhado ao plano §7.2).
  *Pronto quando:* AC-13 passa no Rich Results Test para 2 unidades distintas.
  *Estado:* **concluída na rodada 4** — `Organization` e `MedicalClinic` finais em `scripts/lib/seo.mjs` (endereço, telefone, `geo` condicional, horários, `availableService`, `parentOrganization`); `geo` só entra com `lat`/`lng` numéricos, `precisao` `exata|aproximada` e `fontes` não vazio, e coordenada numérica sem `precisao` válida é erro em `scripts/lib/dados.mjs`, coberto por `R4-QA: geo exige precisao e fontes para entrar no JSON-LD` em `scripts/testes.mjs`; a propriedade `medicalSpecialty` fixa foi removida do JSON-LD; `R4-F5` de Organization e de MedicalClinic/`geo` em `scripts/testes.mjs`.
- [x] **T040 [L] Implementar `BreadcrumbList` e `WebPage`/`MedicalWebPage`** — `isPartOf` correto, sem `SearchAction`.
  *Pronto quando:* Schema Validator sem erro em home, unidade, serviço e preparo.
  *Estado:* **concluída na rodada 4** — `BreadcrumbList` nas internas e `WebPage`/`MedicalWebPage` com `isPartOf`; `WebSite` só na home e sem `SearchAction`; `R4-F5: JSON-LD final...` em `scripts/testes.mjs`.
- [x] **T041 [L] Gerar `sitemap.xml` e `robots.txt`** a partir das rotas realmente escritas, `lastmod` de `atualizadoEm`.
  *Pronto quando:* AC-14 passa, incluindo ausência de URL de rascunho; o `sitemap.xml` (gerado e o já existente no diretório de saída) passa pelo gate de artefato — `slugsTeste`, URLs fictícias e URL fora da base reprovam (AC-34).
  *Estado:* **concluída na rodada 4** — `scripts/build.mjs` escreve `sitemap.xml`/`robots.txt` a partir das rotas, com `lastmod` de `atualizadoEm`; auditoria do sitemap existente no `--check`; o `--check` valida `<loc>` e `<lastmod>` no formato AAAA-MM-DD por URL, e o `atualizadoEm` no topo de unidades/serviços/preparos/páginas é obrigatório (presença e formato); testes de sitemap e `R4-F5: staging recebe noindex...` em `scripts/testes.mjs`.
- [x] **T042 [L] Implementar `og-image` por tipo de página** — 1200×630, sem texto que prometa resultado.
  *Pronto quando:* cada tipo de página tem imagem válida e peso < 200 KB.
  *Estado:* **concluída na rodada 4** — `og-{home,unidade,servico,preparo,institucional}.png` em `src/estatico/assets/`, 1200×630 e < 200 KB; `R4-F5: imagens OG...` em `scripts/testes.mjs`.
- [x] **T043 [L] Internal linking** — unidade↔serviço↔preparo, rodapé com todas as unidades, profundidade ≤ 2.
  *Pronto quando:* nenhuma página publicada está a mais de 2 cliques da home.
  *Estado:* **concluída na rodada 4** — rodapé com todas as unidades e links unidade↔serviço↔preparo; `R4-F5: internal linking...` percorre todas as rotas em ≤ 2 cliques.
- [ ] **T044 [C] Completar JSON-LD com `geo` (quando confirmado) e RT reais** (C-02, C-08).
  *Pronto quando:* o `geo` aparece nas unidades com coordenada confirmada e sua ausência, nas demais, não gera erro e está listada no relatório de pendências; `taxID`/RT conferidos.
- [x] **T045a [L] Preparar staging com `noindex` e conferir a marcação** — build de staging via `--base-url` (pode usar o build de produção tolerante), `meta robots: noindex` em todas as páginas, `robots.txt` de produção intacto; verificar que o build de produção e o go-live não emitem o meta.
  *Pronto quando:* todas as páginas servidas no staging têm `<meta name="robots" content="noindex">`, com detecção independente da ordem dos atributos (AC-34), o build de produção não tem esse meta e `robots.txt` de produção libera o site apontando o sitemap (AC-14).
  *Estado:* **concluída na rodada 4 (marcação)** — `--base-url` de staging emite `<meta name="robots" content="noindex, follow">` em todas as páginas e `robots.txt` com `Disallow: /`; produção segue com `Allow: /` e sem noindex (`R4-F5: staging recebe noindex e robots próprio; produção não`). O build de staging grava em `dist-staging/` (nunca em `dist/`), e o teste do diretório de saída em `scripts/testes.mjs` cobre `dist-staging` e `dist-rascunho`. O deploy em hospedagem real depende de Q-07/T064. O preview no GitHub Pages (project page, T071) é alternativa **não produtiva** e não substitui o staging em hospedagem de produção (Q-07/T064).
- [ ] **T045b [C] Verificar o domínio no Search Console/Bing e enviar o sitemap** — depende de acesso ao DNS/domínio definitivo (C-12): verificação por registro TXT ou arquivo, envio do `sitemap.xml`, conferência de cobertura e de erros.
  *Pronto quando:* propriedade verificada, sitemap aceito sem erros e nenhuma URL de rascunho reportada.

---

## Fase 6 — Acessibilidade, performance e responsividade

- [ ] **T046 [L] Auditoria axe nas 5 páginas-chave** — corrigir todas as violações críticas/sérias.
  *Pronto quando:* AC-16 = zero violações críticas/sérias.
  *Nota:* exige navegador/axe; fica para o pré-go-live.
  *Evidência parcial (rodada 4):* auditoria local via CDP (`scripts/auditoria.mjs`) — 36 medições de overflow (6 páginas × 320/360/768/1024/1280/1440) com zero overflow; foco inicial no skip link, menu e acordeão por teclado; sem JS o preparo mantém `<details>` e a unidade mantém o link do mapa; CSS 4,0 KB e JS 1,1 KB gzip. Não substitui axe nem leitor de tela.
- [ ] **T047 [L] Revisão de teclado e leitor de tela** — header, menu, acordeões, mapa, rodapé; medir o contraste do indicador de foco sobre superfície clara e escura (hero e rodapé).
  *Pronto quando:* AC-17 passa, com foco visível e ≥ 3:1 em todas as superfícies, e o fluxo é compreensível em NVDA ou VoiceOver.
  *Nota:* exige navegador e leitor de tela; fica para o pré-go-live.
- [ ] **T048 [L] Revisão responsiva 320–1440 px** — header, cards, horários, tabela de convênios, rodapé.
  *Pronto quando:* AC-02 passa em 6 larguras sem overflow.
  *Nota:* exige navegador; fica para o pré-go-live.
  *Evidência parcial (rodada 4):* auditoria local via CDP (`scripts/auditoria.mjs`) — 36 medições de overflow (6 páginas × 320/360/768/1024/1280/1440) com zero overflow; falta a inspeção manual de header, cards, horários, tabela de convênios e rodapé.
- [x] **T049 [L] Otimizar imagens e fontes** — WebP/AVIF, `srcset`, dimensões, `loading="lazy"`, woff2 self-host com `preload`.
  *Pronto quando:* nenhuma imagem > 250 KB e nenhuma fonte de terceiro.
  *Estado:* **concluída no estado atual (N/A)** — não há `<img>` de fotos (T024/C-11 pendente) e as fontes são a pilha do sistema; as únicas imagens raster são as OG, 1200×630 e < 200 KB (`R4-F5`). WebP/AVIF/`srcset`/`lazy` voltam quando C-11/T024 trouxer fotos.
- [x] **T050 [L] Orçamento de JS/CSS no `--check`** — falhar se JS > 10 KB ou CSS > 25 KB gzip.
  *Pronto quando:* AC-19 medido no build, não só no DevTools.
  *Estado:* **concluída na rodada 4** — regra `orcamento` em `scripts/lib/checagens.mjs` falha acima de 10 KB (JS) e 25 KB (CSS) gzip no `--check`; teste `orcamento falha quando o JS passa de 10 KB gzip` em `scripts/testes.mjs`.
- [ ] **T051 [L] Rodar Lighthouse mobile e registrar baseline** — Performance ≥ 90, A11y ≥ 95, SEO ≥ 95, BP ≥ 90.
  *Pronto quando:* AC-18 atingido nas 5 páginas-chave e resultado anexado ao PR.
  *Nota:* exige navegador/Lighthouse; fica para o pré-go-live.
  *Evidência parcial (rodada 4):* medição local via CDP (`scripts/auditoria.mjs`) — CSS 4,0 KB e JS 1,1 KB gzip; sem JS o preparo mantém `<details>` e a unidade mantém o link do mapa. CLS variou entre 0 e 0,419 em duas execuções CDP (home, 360 px, 4G), sem `sources` no relatório; investigar no pré-go-live junto com a estratégia do menu progressivo. Não substitui o Lighthouse.
- [x] **T052 [L] Verificar degradação sem JS** — conteúdo essencial e acordeões acessíveis.
  *Pronto quando:* página de preparo continua legível com JS desabilitado.
  *Estado:* **concluída na rodada 4** — `R4-F6: preparo e mapa funcionam sem JavaScript` confirma `<details>/<summary>` no preparo e o link da fachada do mapa sem script.

---

## Fase 7 — Conteúdo e conformidade (bloqueante para go-live)

- [ ] **T053 [C] Fechar C-01: unidades ativas** — atualizar `status` e publicar somente confirmadas.
- [ ] **T054 [C] Fechar C-02..C-04: endereço, `geo` (quando houver coordenada confirmada), telefones, horários** — `validacao.status: confirmado`.
- [ ] **T055 [C] Fechar C-05: serviços por unidade** — ajustar `unidades[].servicos`.
- [ ] **T056 [C] Fechar C-06/C-07: convênios, documentos, pagamento** — atualizar catálogo e matriz.
- [ ] **T057 [C] Fechar C-08: RT e CRM** — preencher `site.json.responsavelTecnico` com nome, CRM, UF **e especialidade** (os quatro campos são o conjunto mínimo; incompleto mantém o bloco omitido e o go-live vermelho — AC-33); replicar por unidade se Q-05 assim definir.
- [ ] **T058 [C] Fechar C-09: preparos aprovados pelo RT** — `revisao.status: aprovado` com data.
- [ ] **T059 [C] Fechar C-10: textos institucionais e da home** — blocos aprovados, sem promessa de resultado.
- [ ] **T060 [C] Fechar C-12/C-15: domínio, e-mail, redes oficiais** — `urlBase`, `sameAs`, contato.
- [ ] **T061 [C] Fechar C-14: política de privacidade/aviso legal** — publicar ou remover link do rodapé.
- [ ] **T062 [C] Aplicar checklist de publicidade médica página a página** — inclui confirmar que nenhum texto/foto/claim do flyer de campanha foi reaproveitado; assinatura do RT (AC-20).
- [ ] **T063 [C] Revisar `relatorios/pendencias.md` com a clínica** — zerar ou aceitar formalmente cada item (AC-23).

---

## Fase 8 — Go-live e operação

- [x] **T071 [L] Implementar o fluxo de pré-visualização não produtiva no GitHub Pages** — workflow `.github/workflows/pages-preview.yml` (`pages-preview`) em `push` para `master` e `workflow_dispatch`: `npm test`, build de rascunho com `--base-url` do project page (17 páginas, faixa "VERSÃO DE REVISÃO", `noindex` em todas as páginas e `robots.txt` com `Disallow: /`), prefixador `scripts/prefixar-base.mjs` reescrevendo `href`/`src` root-relative para `/<repo>` e conferindo os destinos, guard de artefato (exige `index.html` e `404.html`, recusa página sem `noindex`, URL de produção no artefato, `dist/` presente ou faixa de revisão ausente) e publicação apenas de `dist-rascunho` via `actions/deploy-pages`.
  *Pronto quando:* o workflow entrega `dist-rascunho` prefixado em `/<repo>`, o guard e os testes do prefixador (`R4-QA: prefixar base...`) passam e `dist/` nunca é publicado pelo Pages.
  *Estado:* **publicado e validado em 2026-11-23 (fluxo + publicação do preview)** — é preview **público e não produtivo** com `noindex` e **não fecha T064/T065**. Repositório público `ygorsc23/clinica-terradic` criado; Pages habilitado com `build_type: workflow`. Primeiro run do workflow `pages-preview`: `45197456403` — o build passou e o **deploy falhou** porque o environment `github-pages` aceitava apenas a branch `main`; adicionada a política de branch `master` via API e o rerun concluiu build+deploy em ~19s. URL publicada e validada: `https://ygorsc23.github.io/clinica-terradic/` — `/`, `/unidades/`, `/assets/estilo.css` e `/assets/app.js` com 200, rota inexistente com `404` próprio, faixa "VERSÃO DE REVISÃO" e `noindex` confirmados, nenhuma ocorrência de `https://terradic.com.br` no artefato. Natureza: preview público não produtivo, não indexável — o `robots.txt` do subcaminho é ignorado pelo Google (project page), então quem protege é o meta `noindex`; o Pages não permite headers de resposta, logo T064 (CSP, cache e segurança) **continua aberto** e o Pages não é o host de produção (T065 segue dependente de T064/`--go-live`).
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
| 1 | F0–F3 (parcial): fundação, build, layout, unidades, serviços e preparo | concluída; T013 entregue **parcial** (AC-21/AC-30 dependem de C-02/C-03/C-08); T010 (identidade oficial) e T030 (revisão do RT) seguem com o cliente |
| 2 | Correções do QA (T006/T008/T029, ajustes pontuais de T013 e artefatos), renderizador de blocos (T005/T006/T011a), git (T001) e versão HTML da proposta | concluída — T001 fechada em 2026-11-20 (`d056e8a` + `393c73e`, árvore limpa); gates do QA incorporados ao spec/plano |
| 3 | F4: T033–T037a (convênios, sobre/RT, contato, privacidade) | concluída na estrutura — T033–T037a implementadas; conteúdo aprovado pendente mantém as páginas fora da produção e o go-live vermelho (esperado); F5/F6 executadas na rodada 4 |
| 4 | F5: T038–T043, T045a; F6: T049–T052; infra de F8: T071 | F5 concluída; F6 parcial — T049/T050/T052 fechadas no estado atual, T046/T047/T048/T051 exigem navegador/ferramenta e ficam para o pré-go-live; T045a entregue na marcação, deploy de staging depende de Q-07/T064; T071 entregue, publicado e validado como preview não produtivo no Pages (F8) em 2026-11-23 |
| Pós-cliente | F7–F8: T053–T070 | dependente do cliente; T071 (preview) já entregue e fora desse bloqueio |

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

T071 (preview no Pages) é paralela a F8: não bloqueia T064/T065 e não substitui o staging.

**Caminho crítico sem cliente:** T001–T016 (exceto as partes dependentes de cliente em T010/T013), T019–T022, T027–T029, T031–T033, T035–T037a, T038–T043, T045a, T046–T052, T064–T065, T067–T068, T071 (fluxo de preview implementado e **publicado** em preview não produtivo no Pages; não fecha T064/T065). Tudo isso pode ser construído e revisado com dados de teste locais, enquanto C-01..C-15 são coletados. T013 fica **parcial** até C-02/C-03/C-08 (AC-21/AC-30); T029 é estrutural, mas AC-09 só fecha após C-09/T030. AC-21, AC-30, AC-31 e AC-33 só são verificáveis no go-live. F5 está **fechada** (T038–T043, T045a) e F6 está **parcial**: T049/T050/T052 fechadas no estado atual; T046/T047/T048/T051 exigem navegador/ferramenta e ficam para o pré-go-live. Enquanto F4/F7 não tiverem conteúdo aprovado, as páginas de convênios/sobre/contato/privacidade ficam fora da produção e o `--go-live` fica vermelho — é o comportamento correto do gate, não um defeito.

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
| AC-21 | T013 (parcial), T036, T057 |
| AC-22 | T035, T037 |
| AC-23 | T007, T063 |
| AC-24 | T006 |
| AC-25 | T006, T008 |
| AC-26 | T020, T023, T037, T039 |
| AC-27 | T008, T009, T046 |
| AC-28 | T009, T010, T020 |
| AC-29 | T033, T034, T035, T056 |
| AC-30 | T008, T013, T037, T041 |
| AC-31 | T018, T020, T021, T039 |
| AC-32 | T005, T006, T011a, T035, T036, T037a |
| AC-33 | T013, T033, T034, T036, T057 |
| AC-34 | T008, T041, T045a |
