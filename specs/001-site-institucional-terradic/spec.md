# Especificação — Site institucional Terradic (multiunidade)

**Feature:** `001-site-institucional-terradic`
**Status:** implementação concluída nas fases técnicas (F0–F6 e infraestrutura de F8); pendente de dados do cliente (F7) e de auditorias externas (axe, Lighthouse, teclado/leitor de tela e revisão responsiva manual) antes do go-live
**Última atualização:** 2026-11-23
**Autor:** analista/arquiteto

> **Estado real (2026-11-23):** o que é código está implementado e coberto por testes negativos (`npm test`); o site **não** é publicável ainda porque depende de conteúdo da clínica (C-01..C-15) e de auditorias externas que exigem navegador/ferramenta. `npm run build:go-live` falha hoje listando os bloqueios reais — é o comportamento esperado do gate, não defeito. Deploy de produção só a partir de `build:go-live` verde (FR-47).

---

## 1. Contexto e problema

A Terradic é uma rede cearense de diagnóstico por imagem (telerradiologia e sedes próprias) com matriz em Canindé e filiais em Tauá, Crateús, Pacajus, Boa Viagem, Cascavel e Quixeramobim (esta última a confirmar). Hoje **não existe site**: os domínios não resolvem e a presença digital está pulverizada em perfis de Facebook/Instagram por unidade e em guias de terceiros com dados incompletos ou desatualizados.

Consequências: o paciente que busca "tomografia em Crateús" não encontra uma fonte oficial; telefones e endereços circulam errados; a empresa não controla a primeira impressão nem o NAP (nome/endereço/telefone) que alimenta o Google. O portal de exames (`entregadeexames.com.br`) existe, mas não é apresentado ao paciente.

**Objetivo:** criar um site institucional estático, multiunidade, rápido e indexável, que centralize informação oficial por unidade e serviço, cumpra as normas de publicidade médica e direcione o paciente ao portal de exames sem qualquer integração com ele.

### 1.1 Objetivos mensuráveis (12 semanas pós-publicação)

| Métrica | Meta | Como medir |
|---|---|---|
| Indexação | 100% das páginas publicadas no índice do Google | Search Console → Páginas |
| Cobertura local | 1 página por unidade ativa, com NAP equivalente (após normalização) ao Google Business Profile | Auditoria manual + Search Console |
| Desempenho | LCP < 2,5 s em 4G, CLS < 0,1, INP < 200 ms (mobile) | PageSpeed Insights / Lighthouse |
| Peso de JS | < 10 KB comprimido, total do site | Inspeção do build |
| Erros de acessibilidade | 0 violações críticas/sérias | axe DevTools + revisão manual |
| Contato | Cliques em `tel:` e no CTA "Baixar exames" mensuráveis | Relatório de eventos da hospedagem (sem cookies) ou ausência de medição — ver Q-09 |

Metas de tráfego orgânico ficam **fora** desta especificação (dependem de conteúdo, GBP e concorrência).

---

## 2. Pessoas e cenários

| Persona | Necessidade | Cenário principal |
|---|---|---|
| Paciente local | Saber se a unidade da sua cidade faz o exame e como chegar | Busca "mamografia Cascavel CE" → página da unidade → endereço, horário, telefone |
| Paciente com pedido médico | Entender preparo antes de ir | Busca "preparo tomografia com contraste" → página de preparo → acordeão do exame |
| Paciente que já fez exame | Baixar o laudo | Header/hero/rodapé → "Baixar exames" → portal externo Mobilemed |
| Acompanhante/cuidador | Confirmar convênio e atendimento particular | Página de convênios e particular → unidade |
| Médico solicitante | Confirmar que a unidade realiza o exame e a quem enviar | Página de serviço → unidades que realizam |
| Jornalista/parceiro | Dados institucionais e responsável técnico | Sobre + contato |
| Equipe da clínica | Corrigir dados rapidamente | Editar `dados/unidades.json` e rebuildar |

---

## 3. Escopo

### 3.1 Dentro do escopo

1. Site estático (HTML/CSS/JS), sem backend, sem banco de dados, sem login.
2. Páginas: home; índice de unidades; uma página por unidade ativa; índice de serviços; uma página por serviço (tomografia, raio-X, ultrassonografia geral e Doppler, mamografia, consultas ambulatoriais); preparo de exames (página única com acordeões e âncoras); convênios e particular; sobre + responsável técnico com CRM; contato; página 404.
3. CTA "Baixar exames" no header, no hero e no rodapé, apontando para `https://entregadeexames.com.br/`, em nova aba, com `rel="noopener noreferrer"` e aviso de ambiente externo.
4. Um único ponto de verdade por unidade: `dados/unidades.json`. Serviços, convênios, preparos e textos editoriais em arquivos próprios (`dados/paginas.json` em blocos), referenciados por `id`.
5. Build em Node com script próprio que gera as páginas de unidade, o índice de unidades, o `sitemap.xml` e os relatórios de pendência; CSS compilado com Tailwind CLI; JS vanilla mínimo.
6. SEO técnico e local: metadados por página, canonical, Open Graph, `robots.txt`, `sitemap.xml`, JSON-LD por unidade, breadcrumbs, HTML semântico.
7. Acessibilidade WCAG 2.1 AA, mobile-first, sem dependências de runtime e sem coleta de dados pessoais.
8. Documentação de build e deploy em hospedagem estática, com build reprodutível.
9. Direção visual **provisória** derivada de flyer de campanha da unidade Pacajus, formalizada em tokens de tema e logo placeholder; a identidade oficial (brandbook + SVG) substitui os tokens sem alterar templates. Detalhes em `plan.md §1.2`.

### 3.2 Fora do escopo (explícito)

- Área do paciente, visualização/entrega de laudos, upload de pedido médico, agendamento online, pagamento, formulários com dados pessoais.
- Integração, iframe, API ou redirecionamento automático com o portal Mobilemed.
- Backend, CMS, banco de dados, autenticação, e-mail transacional.
- Blog, área de notícias, newsletter, "trabalhe conosco", loja, cursos.
- E-commerce de exames, exibição de preços, cupons, promoções, pacotes.
- Avaliações de pacientes, depoimentos, antes/depois, contadores de "X exames realizados".
- Painel administrativo; edição de conteúdo pela clínica via interface (edição é via JSON + rebuild).
- Aplicativo mobile, PWA offline (o site é estático e não precisa de service worker nesta fase).
- Gestão de Google Business Profile, redes sociais e anúncios pagos (recomendado em paralelo, mas não é entregável deste projeto).
- i18n (somente `pt-BR`).
- Cookies, analytics de terceiros, pixels de rastreamento (ver Q-09).

---

## 4. Requisitos funcionais

Formato: `FR-xx` — requisito. Prioridade: **P1** (obrigatório para publicar), **P2** (desejável nesta fase).

### 4.1 Navegação e estrutura global

- **FR-01 (P1)** Header fixo com logo, navegação (Início, Unidades, Serviços, Preparo de exames, Convênios, Sobre, Contato) e CTA "Baixar exames". Em viewport < 768 px, navegação colapsa em menu acionado por botão com `aria-expanded`, fecha com `Esc` e com clique no fundo, e não bloqueia o scroll sem possibilidade de saída.
- **FR-02 (P1)** Rodapé com: razão social, CNPJ, endereço da matriz, telefone institucional, e-mail, link "Baixar exames", link para política de privacidade (se aprovada), identificação do responsável técnico (nome, CRM com UF e especialidade) e ano corrente. O rodapé é global: exibe sempre o endereço institucional da matriz, **nunca** o da unidade visitada (FR-13). **Fonte única:** endereço e telefone institucionais vêm sempre do registro da matriz em `unidades.json` (`matriz: true`) — seja a matriz publicável (página gerada), seja apenas o cadastro confirmado; o rodapé lê esse mesmo registro nos dois casos, sem cópia independente em `site.json` nem valor digitado no template. Quando `contatoInstitucional.telefoneE164` estiver preenchido, precisa ser idêntico ao telefone institucional da matriz (divergência é erro de build). É proibido o estado em que o rodapé sai sem endereço/telefone enquanto alguma página afirma exibir os dados da matriz: no build de produção tolerante a omissão é relatada e nenhuma página faz essa afirmação; o `--go-live` exige endereço e telefone institucionais confirmados e falha se o rodapé sair incompleto (AC-30). Campo nulo é omitido — nunca substituído por placeholder — e o ano corrente vem do relógio do build (exceção de determinismo registrada em AC-24). A completude de RT/contato só é verificável no build de go-live (AC-21).
- **FR-03 (P1)** Todas as páginas possuem breadcrumb visível e em JSON-LD, exceto a home.
- **FR-04 (P1)** Link "pular para o conteúdo" como primeiro elemento focável.
- **FR-05 (P2)** Página 404 própria, com links para home, unidades e contato, e código HTTP 404 real na hospedagem.

### 4.2 Home

- **FR-06 (P1)** Hero com proposta de valor da rede (diagnóstico por imagem e telerradiologia no Ceará), CTA primário "Baixar exames" (externo, com aviso) e CTA secundário "Encontrar minha unidade".
- **FR-07 (P1)** Bloco de serviços com os 5 serviços, cada um linkando para sua página.
- **FR-08 (P1)** Bloco de unidades com as unidades ativas (nome, cidade, telefone clicável, link para a página).
- **FR-09 (P1)** Bloco sobre o portal de exames: o que é, o que o paciente precisa em mãos (CPF e protocolo/senha) e aviso de que o download ocorre em ambiente externo de terceiro.
- **FR-10 (P2)** Bloco institucional curto com link para "Sobre" e identificação do responsável técnico.

### 4.3 Unidades

- **FR-11 (P1)** `/unidades/` lista todas as unidades publicadas, agrupadas por cidade, com busca/filtro client-side apenas se houver > 8 unidades (hoje não é necessário).
- **FR-12 (P1)** `/unidades/{slug}/` existe para cada unidade com `status: ativo` e dados mínimos confirmados (endereço, ao menos um telefone, horário e **ao menos um serviço aprovado**). Unidade ativa sem serviço aprovado não é publicável: não gera página, não entra no sitemap e, no go-live, falha o build (AC-31) — publicar página com seção de serviços vazia e sem `availableService` é proibido. Unidades em `rascunho` ou `a-confirmar` **não** geram página nem entrada no sitemap.
- **FR-13 (P1)** Página de unidade contém: nome, endereço completo com CEP, telefone(s) clicáveis (`tel:`), WhatsApp apenas se informado como oficial (link `wa.me` com aviso de ambiente externo), horário de funcionamento, serviços realizados naquela unidade, convênios aceitos naquela unidade, informação sobre atendimento particular, mapa (fachada clicável), e CTA "Baixar exames". A seção de serviços nunca é publicada vazia: exige ao menos um serviço aprovado, coerente com `availableService` no JSON-LD (FR-12/AC-31). O endereço exibido no corpo da página é o da unidade; o rodapé global permanece com o endereço da matriz (FR-02).
- **FR-14 (P1)** Cada página de unidade tem conteúdo único (endereço, bairro/referência, telefones, horários, serviços, convênios) — proibido gerar páginas duplicadas trocando apenas o nome da cidade.
- **FR-15 (P2)** Link "Como chegar" para Google Maps com o endereço em query string, abrindo em nova aba.
- **FR-16 (P2)** Aviso quando a unidade não realiza determinado serviço, com link para a unidade mais próxima que realiza.

### 4.4 Serviços

- **FR-17 (P1)** `/servicos/` lista os serviços com resumo de uma linha.
- **FR-18 (P1)** `/servicos/{slug}/` descreve o exame em linguagem leiga (o que é, para que serve, como é realizado, duração média quando confirmada, se exige preparo), lista as unidades que o realizam e linka para o preparo correspondente.
- **FR-19 (P1)** Serviço sem nenhuma unidade ativa associada não é publicado (ou é publicado com aviso explícito — decidir em Q-04).
- **FR-20 (P2)** Cada serviço declara explicitamente que não substitui consulta médica e que o pedido médico é necessário quando aplicável.

### 4.5 Preparo de exames

- **FR-21 (P1)** `/preparo-de-exames/` reúne todos os preparos em acordeões acessíveis, com âncoras estáveis (`#tomografia`, `#tomografia-com-contraste`, `#ultrassonografia-abdome`, etc.) e link direto copiável.
- **FR-22 (P1)** Cada preparo informa: o que trazer (documento com foto, pedido médico, exames anteriores), jejum, restrições de medicação, vestimenta, tempo estimado e observações.
- **FR-23 (P1)** Todo texto de preparo é marcado como **revisado pelo responsável técnico** ou **pendente de revisão**; nenhum preparo pendente é publicado em produção.
- **FR-24 (P2)** Aviso de que o preparo pode variar conforme a unidade e que o paciente deve confirmar por telefone.

### 4.6 Convênios e particular

- **FR-25 (P1)** `/convenios-e-particular/` explica a diferença entre atendimento particular e convênio, lista convênios por unidade e informa que a cobertura deve ser confirmada com a operadora e com a unidade.
- **FR-26 (P1)** Nenhum convênio é exibido sem confirmação da clínica e sem a ressalva de que a lista pode mudar; logotipos de operadoras somente com autorização (padrão: nomes em texto).
- **FR-27 (P2)** Página informa documentos necessários e formas de pagamento aceitas, apenas se confirmadas.

### 4.7 Sobre e responsável técnico

- **FR-28 (P1)** `/sobre/` apresenta história, posicionamento (pioneirismo em telerradiologia no Ceará), abrangência e diferenciais verificáveis. Sem adjetivos não comprováveis, sem promessa de resultado.
- **FR-29 (P1)** Responsável técnico identificado com nome completo, CRM (número e UF) e especialidade, visível na página "Sobre" e no rodapé de todas as páginas. A **especialidade é obrigatória junto de nome/CRM/UF**, e o bloco é renderizado de forma condicional: só aparece completo — se qualquer um dos quatro campos faltar, o bloco inteiro é omitido, sem rótulo, separador ou pontuação órfã (`CRM — ,` e similares são proibidos). No go-live, RT incompleto falha o build (AC-33). Se houver RT por unidade, exibir na página da unidade (Q-05).

### 4.8 Contato

- **FR-30 (P1)** `/contato/` com telefones por unidade, e-mail institucional e endereço da matriz. Sem formulário nesta fase. A página afirma exibir o endereço da matriz, logo só é gerada quando esse endereço (e o telefone institucional) estiverem confirmados e vierem do registro da matriz; caso contrário não é publicada e o go-live falha (FR-02/AC-30).
- **FR-31 (P1)** Telefones em formato `tel:+5585...` com rótulo legível; WhatsApp só se oficial, com aviso de ambiente externo.
- **FR-32 (P2)** Mapa da matriz com fachada clicável (sem carregar iframe de terceiros antes do clique).

### 4.9 Portal de exames (link externo)

- **FR-33 (P1)** Todos os CTAs "Baixar exames" apontam para `https://entregadeexames.com.br/` com `target="_blank"` e `rel="noopener noreferrer"`.
- **FR-34 (P1)** Todo CTA externo é acompanhado (ou precedido) de aviso textual de que o portal é ambiente externo de terceiro, que o site não coleta dados e que o acesso usa CPF e protocolo/senha.
- **FR-35 (P1)** O CTA tem rótulo acessível que inclui "abre em nova aba" (`aria-label` ou texto visível oculto).
- **FR-36 (P1)** Não há iframe, pré-carregamento, redirecionamento automático, nem envio de qualquer parâmetro do site para o portal.

### 4.10 Conteúdo, build e operação

- **FR-37 (P1)** `dados/unidades.json` é a única fonte de dados de unidade; páginas, listas, JSON-LD e sitemap são derivados dele no build.
- **FR-38 (P1)** No build de go-live, o build falha (exit code ≠ 0) em qualquer bloqueio de publicação: campo obrigatório vazio em unidade publicável, unidade publicável sem ao menos um serviço aprovado, slug duplicado, telefone em formato inválido, URL de portal diferente da permitida, preparo sem revisão necessário a serviço publicável, RT não confirmado ou incompleto (nome/CRM/UF/especialidade), contato institucional ausente, endereço/telefone da matriz ausentes ou divergentes do rodapé, convênio sem `atualizadoEm`, bloco editorial `pendente` em página publicável, identidade visual não oficial e sem `aceiteFormal` registrado, nenhuma unidade publicável, navegação vazia ou com menos de 2 itens e rota estrutural não gerada. No build de produção tolerante, a entidade não publicável — ou o bloco pendente — é excluída e relatada, mas tudo o que é publicado passa pelos mesmos validadores (FR-47).
- **FR-39 (P1)** O build gera um relatório de pendências de conteúdo (JSON + Markdown) listando todo campo `placeholder`/`a-confirmar`, sem publicá-lo no site.
- **FR-40 (P1)** Build reprodutível: `npm ci && npm run build` em Node LTS fixado produz saída determinística, sem acesso à rede além das dependências instaladas. A única exceção é o ano corrente do rodapé, lido do relógio (FR-02): duas execuções consecutivas no mesmo ano são idênticas; a virada de ano altera o hash e isso é esperado (AC-24).
- **FR-41 (P2)** Modo `--rascunho`: tolerante, usa dados de teste, gera páginas de unidades `a-confirmar` com marca visual "dados em confirmação" e faixa de revisão em todas as páginas; nunca produz artefato publicável.
- **FR-47 (P1)** O build tem três modos com semânticas distintas: (a) `--rascunho` (`npm run build:rascunho`) — tolerante, usa dados de teste, grava em `dist-rascunho/` e emite `noindex, nofollow` com faixa de revisão; (b) `build` de produção tolerante (`npm run build`) — tolerante com entidades não publicáveis (exclui e relata), mas estrito com tudo o que publica; (c) `--go-live` (`npm run build:go-live`) — estrito, falha se qualquer bloqueio de publicação existir. **Publicação:** o `dist/` produzido por `npm run build` é **build tolerante de revisão e nunca é publicável**; o deploy de produção ocorre **somente** a partir de `npm run build:go-live` verde. **Staging:** é artefato separado, gravado em `dist-staging/` (`--base-url` de staging sem `--rascunho`), com `<meta name="robots" content="noindex, follow">` em todas as páginas e `robots.txt` próprio de bloqueio; o rascunho local continua `noindex, nofollow`. Staging e rascunho nunca escrevem em `dist/`.
- **FR-48 (P1)** Todo texto editorial vem de `dados/paginas.json` (`blocos`) e é renderizado por um renderizador único; nenhum texto editorial fica fixo em template. Inclusive a home, que consome `paginas.home.blocos`. Templates contêm apenas estrutura e rótulos de interface (navegação, botões, breadcrumb, rótulos de campo). **Classificação editorial (vinculante):** texto editorial — frase, título com conteúdo, chamada, aviso redigido — vai para `paginas.json` em blocos; rótulo de interface — "pular para o conteúdo", "abre em nova aba", "menu", "Anterior/Próximo", nome de campo — pode permanecer no template. O critério é funcional (informar × operar a interface), não o tamanho do texto; na dúvida, aplica-se o teste "isto muda se o cliente mudar o texto institucional?". Este parágrafo é o registro da decisão: revisão futura não reabre a discussão sem mudança de escopo (RN-12, AD-03).
- **FR-49 (P1)** Bloco editorial tem `status` próprio (`aprovado|pendente`). Bloco `pendente` **não** é renderizado no build de produção — não pela página, nem por acesso direto à sua âncora ou a um texto transversal referenciado por `id` —, é listado no relatório de pendências e, se pertencer a página publicável, **bloqueia o go-live**. No `--rascunho`, o bloco pendente aparece com selo de pendência. Página editorial sem nenhum bloco aprovado não é publicável (AC-32).

### 4.11 Identidade visual (provisória)

- **FR-42 (P1)** Toda cor, raio e sombra usada no site vem de tokens semânticos definidos em um único ponto do tema; é proibido valor de cor literal em template, JS ou conteúdo. Trocar a paleta oficial deve ser uma alteração de tokens, sem tocar em páginas.
- **FR-43 (P1)** Cada página de unidade exibe um selo ("pill") com o nome da unidade no padrão visual do flyer, gerado a partir de `unidades[].nomeExibicao` — nunca escrito à mão na página.
- **FR-44 (P1)** O logo é um placeholder neutro até o cliente fornecer o arquivo oficial; a marca **não** é vetorizada, redesenhada ou reconstruída a partir de imagem de campanha.
- **FR-45 (P2)** A fonte caligráfica do flyer, se usada, aparece em um único acento no hero, com fallback legível, e nunca em navegação, conteúdo informativo, preparo ou texto clínico.
- **FR-46 (P1)** Nenhum texto, foto de profissional ou claim do flyer de campanha é reutilizado no site; a comunicação usa linguagem verificável (ver RN-01, RN-11).

---

## 5. Regras de negócio e de conteúdo

- **RN-01 Publicidade médica.** Nenhum texto pode prometer resultado, garantir diagnóstico, usar sensacionalismo, superlativos não comprováveis ("melhor da região"), antes/depois, imagens de pacientes, depoimentos ou comparações com concorrentes. Base: normas do CFM sobre publicidade médica (Res. CFM nº 1.974/2011 e normas supervenientes — **confirmar vigência** na revisão final).
- **RN-02 Identificação.** Nome empresarial, CNPJ e responsável técnico com CRM devem estar acessíveis em todas as páginas (rodapé), conforme exigência de identificação em sítios de serviços médicos.
- **RN-03 Convênios.** Só é listado convênio confirmado pela clínica para aquela unidade, sempre com ressalva de verificação junto à operadora. Lista desatualizada é risco jurídico e reputacional.
- **RN-04 Preparo.** Instrução de preparo é conteúdo clínico: publica somente após revisão do responsável técnico, com data de revisão registrada.
- **RN-05 LGPD.** O site não coleta, armazena nem transmite dado pessoal ou dado de saúde. Sem formulários, cookies de rastreamento, analytics com identificadores ou parâmetros de saúde em URL. O portal de exames é controlador independente; o site apenas informa e linka.
- **RN-06 Ambiente externo.** Toda saída para domínio de terceiro (portal, WhatsApp, mapas) é sinalizada como externa e abre em nova aba, exceto links de mapa "como chegar" (P2, mesma regra).
- **RN-07 Dados não validados.** Nenhum dado de telefone/endereço/horário entra em produção sem confirmação registrada (`fontes` + `confirmadoPor` + `data`). Dados de exemplo do briefing são placeholders, não verdade.
- **RN-08 Fotos.** Somente fotos reais das unidades, com autorização de uso de imagem de pessoas identificáveis. Proibido banco de imagens representando a clínica.
- **RN-09 Slugs.** Estáveis, em minúsculas, sem acento, com hífen; mudança de slug exige redirect 301 na hospedagem.
- **RN-10 Identidade visual provisória.** A paleta, a tipografia e o logo são **provisórios**, derivados de um flyer de campanha da unidade Pacajus obtido em redes sociais. Não constituem marca oficial; a provisoriedade deve estar registrada em `dados/site.json` (`identidadeVisual.status`), no tema (`tailwind.config.js`), no `README.md` e no relatório de pendências. Go-live com identidade provisória exige aceite explícito do cliente, registrado em `identidadeVisual.aceiteFormal` com `{ aceitoPor, data, documento }`; o gate aceita **`status: "oficial"` ou `aceiteFormal` válido** — sem um dos dois, o go-live falha (AC-28).
- **RN-11 Material de campanha não é conteúdo do site.** Textos, fotos de profissionais, claims ("resultados precisos" e equivalentes) e layout do flyer não são reutilizados. Do flyer aproveitam-se apenas referências visuais (cor, forma, selo da unidade), nunca copy.
- **RN-12 Classificação editorial.** Texto que informa (frase, título com conteúdo, chamada, aviso redigido) é conteúdo editorial e mora em `paginas.json`; rótulo que opera a interface (skip link, "abre em nova aba", "menu", breadcrumb, rótulo de campo) pode ficar no template. O critério é funcional e vinculante para revisão e QA — registrado para não reabrir a discussão a cada rodada (FR-48/AD-03).

---

## 6. Requisitos não funcionais

- **NFR-01 Acessibilidade:** WCAG 2.1 nível AA. Contraste ≥ 4,5:1 em texto normal; foco visível; HTML semântico; `lang="pt-BR"`; acordeões e menu operáveis por teclado; mapa com alternativa textual; sem armadilha de foco. O **token de foco** precisa de contraste ≥ 3:1 contra a superfície em que aparece, com variante própria para superfícies escuras (hero e rodapé) — um indicador claro padrão sobre fundo escuro reprova. Regras de cor: dourado nunca como texto sobre fundo claro (aprox. 1,8:1); turquesa `#00A79B` não é usado como texto sobre branco/off-white (aprox. 3,0:1) — para texto usa-se variante escurecida validada; botão turquesa sólido com texto branco é proibido (aprox. 3,0:1); botão primário é verde-petróleo com texto branco.
- **NFR-02 Performance:** HTML/CSS crítico leve; JS total < 10 KB comprimido; sem dependências de runtime; fontes self-hosted (woff2, `font-display: swap`) ou pilha de fontes do sistema; imagens em WebP/AVIF com `srcset` e dimensões declaradas; mapa carregado apenas após clique. O CSS é autocontido: o CSS compilado não pode conter `@import`, `url(http…)` nem `@font-face` apontando para domínio externo; o gate varre o CSS compilado.
- **NFR-03 Mobile-first:** layout correto de 320 px a 1440 px; alvos de toque ≥ 44×44 px; telefone clicável em destaque.
- **NFR-04 SEO técnico:** URL canônica única (sem `www` e com `https`, a definir em Q-06); trailing slash consistente; `title` único ≤ 60 caracteres; `meta description` 120–160; um `<h1>` por página; canonical autorreferente; `sitemap.xml` apenas com URLs 200; `robots.txt` liberando o site e apontando o sitemap.
- **NFR-05 SEO local:** NAP equivalente após normalização documentada (CEP só dígitos; telefone em E.164; texto visível comparado, não apenas atributos) entre página, JSON-LD e Google Business Profile. O **rodapé entra na checagem em todas as páginas publicadas**: endereço e telefone são comparados ao registro da matriz (`matriz: true`) e ao contato institucional, nunca ao da unidade visitada; ausência ou divergência reprova o gate (AC-30). `MedicalClinic` por unidade com endereço, telefone, horários e serviços, e `geo` apenas quando houver coordenada numérica com `precisao` diferente de `aproximada` e origem registrada em `validacao.fontes[]`; caso contrário o bloco é omitido (AC-13); `BreadcrumbList`; `Organization` com `sameAs` das redes oficiais.
- **NFR-06 Semântica de dados:** JSON-LD válido no Rich Results Test, sem `aggregateRating`, `review`, `priceRange` inventado ou propriedades não suportadas.
- **NFR-07 Segurança:** site sem coleta de dados; `rel="noopener noreferrer"` em todos os links externos com `target="_blank"`; HTTPS; headers de segurança básicos na hospedagem (`X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy` compatível com o mapa sob demanda). O gate de requisição externa cobre HTML **e CSS compilado**: `@import`, `url(http…)` e `@font-face` de domínio externo reprovam o build.
- **NFR-08 Manutenibilidade:** alteração de telefone/horário = editar 1 arquivo JSON + rebuild; nenhum dado de unidade hardcoded em template.
- **NFR-09 Rastreabilidade de conteúdo:** todo campo sensível carrega `status` e `fontes`; o build reporta pendências de forma legível. `bloco.status` e `responsavelTecnico`/`convenios.atualizadoEm` são rastreados individualmente, com o efeito de bloqueio explicitado no relatório (AC-23/AC-32/AC-33).
- **NFR-12 Gate de artefato independente de ordem de atributo:** as checagens do `dist/` não podem depender da ordem de atributos HTML. `noindex` é detectado pela presença de `robots` + `noindex` na `<meta>`, em qualquer ordem; o staging deve emitir `noindex, follow` e o rascunho, `noindex, nofollow`; `slugsTeste` é procurado em **todos** os arquivos de texto do artefato, incluindo `sitemap.xml`; o `sitemap.xml` já existente no `dist/` é auditado, não apenas o gerado em memória (AC-34).
- **NFR-10 Compatibilidade:** últimas 2 versões de Chrome, Edge, Firefox, Safari (desktop e mobile); degradação sem JS (conteúdo essencial visível, acordeões abertos por padrão quando JS falha ou como `<details>`).
- **NFR-11 Tokens de tema:** cores, raios e sombras existem apenas como variáveis do tema; o gate de build rejeita valor hexadecimal literal em template/JS fora dos arquivos de tema e exige que a matriz de contraste dos pares usados esteja registrada.

---

## 7. Critérios de aceite

Critérios verificáveis por inspeção, script de build ou ferramenta externa. **AC-01 a AC-12, AC-20 a AC-23 e AC-27 a AC-34 são bloqueantes para publicação.**

### Estrutura e navegação
- **AC-01** No build de go-live, todas as rotas estruturais do escopo são geradas e respondem 200, e todas as páginas publicadas estão no `sitemap.xml`; nenhuma URL do sitemap retorna 404. *Verificação:* crawl local do `dist/` gerado por `--go-live` + validação do XML.
- **AC-02** Em 360 px, 768 px e 1280 px, header, hero, cards de unidade, blocos de horário, matriz de convênios e rodapé não apresentam overflow horizontal (`document.documentElement.scrollWidth <= innerWidth`). *Verificação:* inspeção manual nos 3 breakpoints.
- **AC-03** Menu mobile abre por teclado (`Enter`/`Espaço`), fecha com `Esc`, retorna foco ao botão e expõe `aria-expanded` correto. *Verificação:* teste manual de teclado + leitor de tela.

### Unidades
- **AC-04** Existe exatamente uma página por unidade com `status: ativo`; unidades `a-confirmar`/`rascunho` não geram página nem entram no sitemap. *Verificação:* contagem no `dist/` versus JSON.
- **AC-05** Nome, endereço, CEP, telefone e horário da unidade são **equivalentes após normalização documentada** ao dado canônico e ao JSON-LD daquela unidade — a checagem compara o **texto visível** da página, não apenas atributos ocultos (`tel:`, `href`, JSON-LD). Normalização: CEP reduzido a 8 dígitos; telefone reduzido a dígitos e comparado em E.164 (`+55DDNNNNNNNN`); nome/endereço com espaços colapsados e caixa normalizada. O rodapé é conferido em **todas** as páginas publicadas, contra o endereço e o telefone institucionais da matriz (registro `matriz: true`) e o contato institucional — nunca contra o endereço da unidade (FR-02/AC-30). *Verificação:* script de checagem de NAP no build.
- **AC-06** Todo telefone visível é `tel:` válido no padrão E.164 (`+55DDNNNNNNNN`) e disca corretamente em celular. *Verificação:* inspeção + teste real em 2 aparelhos.

### Serviços e preparo
- **AC-07** Cada página de serviço lista apenas unidades cujo JSON inclui aquele serviço; nenhuma unidade é citada por engano. *Verificação:* comparação automatizada cruzada.
- **AC-08** Cada acordeão de preparo abre e fecha por teclado, tem `aria-expanded`/`aria-controls` corretos, permanece legível sem JS e o conteúdo é alcançável por âncora direta. *Verificação:* teste de teclado + abrir URL com `#ancora`.
- **AC-09** Nenhum preparo com `revisao.status != "aprovado"` aparece em `dist/`; no build de produção ele é excluído e relatado, e no build de go-live a existência de preparo pendente necessário a serviço publicável faz o build falhar. *Verificação:* execução dos dois builds com dado pendente.

### Portal de exames
- **AC-10** Todos os CTAs "Baixar exames" apontam exatamente para `https://entregadeexames.com.br/`, com `target="_blank"` e `rel` contendo `noopener` e `noreferrer`; não existe iframe, `preload`, `prefetch`, meta refresh ou redirect para esse domínio. *Verificação:* grep no `dist/` + inspeção de rede no DevTools.
- **AC-11** Cada ocorrência do CTA tem aviso textual de ambiente externo visível (não apenas tooltip) em um raio de leitura próximo. *Verificação:* inspeção visual nas 3 posições (header, hero, rodapé).

### SEO e dados estruturados
- **AC-12** Cada página tem `title` único e com até 60 caracteres, `meta description` entre 120 e 160, `canonical` autorreferente, `og:title`, `og:description`, `og:image`, `og:url` e `og:type`. *Verificação:* script de build + inspeção.
- **AC-13** JSON-LD de cada página de unidade passa no Rich Results Test sem erros e contém `MedicalClinic` com `name`, `address` (`PostalAddress` completo), `telephone`, `openingHoursSpecification` e `availableService`. `geo` é **recomendado, não obrigatório** (`plan.md §3.2`): entra no JSON-LD somente quando `geo.lat`/`geo.lng` são numéricos, `geo.precisao` é diferente de `aproximada` (na prática, `exata`) **e** há origem registrada em `validacao.fontes[]`. Precisão `aproximada`, coordenada sem fonte ou coordenada derivada de CEP/endereço/centroide: bloco **omitido**, sem erro. A ausência do bloco `geo` **não** bloqueia o go-live, desde que nenhuma coordenada seja inventada; a unidade é listada no relatório de pendências (AC-23). *Verificação:* Rich Results Test + Schema Markup Validator + conferência do relatório de pendências.
- **AC-14** `robots.txt` referencia o `sitemap.xml` absoluto; `sitemap.xml` contém apenas URLs publicadas, com `lastmod` coerente com a data de atualização dos dados. *Verificação:* inspeção + validação de XML.
- **AC-15** Nenhuma página publicada contém texto `placeholder`, `[CONFIRMAR]`, `lorem`, `TODO` ou telefone de exemplo. *Verificação:* grep no `dist/` como gate de build.

### Acessibilidade e performance
- **AC-16** axe DevTools: zero violações críticas e sérias em home, unidade, serviço, preparo e contato. *Verificação:* execução manual nas 5 páginas.
- **AC-17** Navegação completa por teclado do header ao rodapé, com foco sempre visível, ordem lógica e contraste do indicador de foco ≥ 3:1 contra a superfície em que aparece — inclusive sobre superfícies escuras (hero e rodapé), com variante de foco própria. *Verificação:* teste manual + medição de contraste do token de foco em cada superfície (NFR-01).
- **AC-18** Lighthouse mobile ≥ 90 em Performance, ≥ 95 em Acessibilidade, ≥ 95 em SEO, ≥ 90 em Boas práticas (build de go-live, 4G simulado). *Verificação:* Lighthouse CI ou execução manual registrada.
- **AC-19** JS total do site < 10 KB comprimido; nenhuma requisição a CDN, Google Fonts ou script de terceiro no carregamento inicial. *Verificação:* aba Network + soma dos arquivos.

### Conteúdo e conformidade
- **AC-20** Checklist de publicidade médica aplicado página a página (sem promessa de resultado, sem superlativo não comprovável, sem antes/depois, sem depoimento), com aceite registrado do responsável técnico. *Verificação:* checklist assinado.
- **AC-21** Nome do responsável técnico, CRM (número e UF) e especialidade aparecem juntos no rodapé de todas as páginas publicadas e na página "Sobre", sem pontuação ou rótulo órfão quando o bloco é omitido. Enquanto C-08 não estiver resolvido, o rodapé omite o bloco de RT (sem placeholder) e o critério **não é verificável**: só pode ser aceito no build de go-live, quando C-03 (contato institucional) e C-08 existirem — RT com um dos quatro campos vazio falha o go-live (AC-33). *Verificação:* inspeção de todas as páginas geradas por `--go-live`.
- **AC-22** Nenhuma página coleta dados: zero `<form>`, zero `input` de dados pessoais, zero cookie definido pelo site, zero parâmetro de URL com dado de saúde. *Verificação:* inspeção + DevTools Application.
- **AC-23** O relatório de pendências do build lista 100% dos campos `placeholder`/`a-confirmar`, e todos os itens da seção "Dependências de conteúdo" estão resolvidos ou explicitamente aceitos pela clínica antes do go-live. Exceção declarada: a ausência ou omissão de `geo` (incluindo `precisao: aproximada` ou falta de fonte) é listada no relatório, mas **não** bloqueia o go-live (AC-13). *Verificação:* leitura do relatório + aceite.

### Build e operação
- **AC-24** `npm ci && npm run build` em ambiente limpo (Node LTS fixado) gera `dist/` completo sem erro; duas execuções consecutivas **no mesmo ano** produzem o mesmo conjunto de arquivos e o mesmo hash. Exceção declarada: o ano do rodapé (FR-02) vem do relógio do build; a virada de ano altera o hash e isso é esperado e documentado. *Verificação:* hash do `dist/` em duas execuções no mesmo ano.
- **AC-25** No build de go-live, dado obrigatório ausente falha com mensagem apontando arquivo, campo e unidade; no build de produção, a entidade não publicável é excluída e listada no relatório. *Verificação:* teste negativo documentado nos dois modos.
- **AC-26** Alterar o telefone de uma unidade em `dados/unidades.json` e rebuildar atualiza página, índice, contato e JSON-LD — sem edição em nenhum outro arquivo. O telefone do rodapé é o institucional da matriz (fonte única em `unidades.json`), não o da unidade visitada: ele só muda quando o registro da matriz ou o contato institucional muda (FR-02). *Verificação:* teste de regressão manual.

### Identidade visual
- **AC-27** Nenhum valor hexadecimal de cor aparece em template, JS ou conteúdo: todas as cores vêm de tokens do tema, e a matriz de contraste dos pares efetivamente usados está registrada e aprovada (todos os pares de texto ≥ 4,5:1; dourado ausente de texto sobre fundo claro). *Verificação:* `--check` (grep de hex) + inspeção da matriz + axe.
- **AC-28** O logo publicado é o placeholder neutro (ou o SVG oficial, se já fornecido) e **não** é uma reprodução do flyer; a marca não foi vetorizada a partir de raster. Cada página de unidade exibe o "pill" com o nome vindo do JSON. A provisoriedade está marcada no repositório e no relatório de pendências. No go-live, identidade `provisoria` exige `identidadeVisual.aceiteFormal` com `aceitoPor`, `data` e `documento`; sem `status: "oficial"` nem aceite formal válido, o gate falha. *Verificação:* inspeção + leitura de `dados/site.json`/README/relatório + teste negativo do gate de identidade.

### Convênios
- **AC-29** Toda página que menciona convênio exibe, visível e próxima da lista, a ressalva de que a cobertura deve ser confirmada junto à operadora e à unidade, além da data de atualização da lista; nenhum convênio aparece sem confirmação registrada para aquela unidade (`fontes` + `data`); nenhum texto afirma cobertura garantida. `convenios.atualizadoEm` é **obrigatório sempre que existir convênio** e é a data exibida; convênio cadastrado sem essa data reprova o build (AC-33). *Verificação:* inspeção da página + comparação com o relatório de pendências + teste negativo no build (convênio não confirmado ou sem `atualizadoEm` derruba o build de go-live, coerente com AC-25/RN-03).

### Consistência de NAP e gates de publicação

- **AC-30** Em 100% das páginas do build de go-live, o rodapé exibe endereço e telefone institucionais equivalentes, após normalização, ao registro da matriz (`matriz: true`, dados confirmados) e ao contato institucional — nunca ao endereço da unidade visitada. A matriz pode ter página publicada ou apenas o cadastro confirmado; em ambos os casos o rodapé lê o **mesmo** registro, sem segunda fonte. Não existe estado em que o rodapé saia sem endereço/telefone enquanto alguma página afirme exibir os dados da matriz: se o dado da matriz não estiver confirmado, o build de produção não gera página que faça essa afirmação (incluindo `/contato/`) e o go-live falha. *Verificação:* script de NAP do rodapé em todas as páginas + build negativo com matriz incompleta.
- **AC-31** Nenhuma unidade publicada tem seção de serviços vazia: toda unidade publicável referencia ao menos um serviço `aprovado`, e o JSON-LD emite `availableService` correspondente. *Verificação:* contagem no `dist/` × JSON + build negativo (unidade ativa sem serviço aprovado derruba o go-live).
- **AC-32** Bloco editorial com `status: pendente` não aparece no `dist/` de produção — nem pela página, nem por acesso direto à sua âncora/`id` ou a texto transversal referenciado por `id` — é listado no relatório de pendências e, se pertencer a página publicável, falha o `--go-live`; no rascunho, aparece com selo de pendência; página editorial sem nenhum bloco aprovado não é publicada. *Verificação:* teste negativo com bloco pendente em `home`/`sobre` e de texto transversal acessado por `id`.
- **AC-33** RT e convênios: nome, CRM, UF e especialidade aparecem juntos (bloco omitido por inteiro se faltar um campo, sem pontuação órfã) e RT incompleto falha o go-live; todo convênio existente tem `atualizadoEm` não nulo, exibido como data de atualização, e a ausência falha o build. *Verificação:* inspeção do rodapé/Sobre + dois testes negativos no build.

### Gate de artefato

- **AC-34** O gate do `dist/` não depende de ordem de atributo nem de arquivo: (a) `slugsTeste` reprova ocorrência em qualquer HTML **e** no `sitemap.xml`; (b) a detecção de `noindex` reconhece `robots`/`noindex` em qualquer ordem de atributos da `<meta>` e distingue staging (`noindex, follow`) de rascunho (`noindex, nofollow`); (c) o `sitemap.xml` **já existente** no `dist/` é auditado (base permitida, URLs fictícias, URL de unidade de teste), não apenas o gerado em memória. *Verificação:* testes negativos em `--check` para cada alínea.

---

## 8. Premissas e suposições registradas

| # | Suposição | Impacto se falsa |
|---|---|---|
| S-01 | Hospedagem estática com suporte a diretórios (`/unidades/x/index.html`), HTTPS e página 404 customizada | Exigiria ajuste de URLs ou provedor diferente |
| S-02 | Node LTS disponível no ambiente de build (local/CI) | Build precisaria de container |
| S-03 | Volume de conteúdo é pequeno (< 30 páginas), sem necessidade de gerador estático de terceiros | Reavaliar pipeline |
| S-04 | Site em português único, sem i18n | Retrabalho de estrutura |
| S-05 | Sete unidades é o teto inicial; novas unidades entram só por JSON | Escala de listagem/filtro |
| S-06 | Não haverá área logada nem dado de paciente nesta fase | Mudança de arquitetura e LGPD |
| S-07 | Cliente fornecerá fotos reais e identidade visual oficial; até lá, usar a direção visual provisória derivada do flyer de Pacajus (`plan.md §1.2`) | Atraso de go-live, não de build; paleta pode estar errada |
| S-08 | A paleta do flyer é aproximação aceitável para validação interna, não para publicação definitiva | Retrabalho de tokens e revalidação de contraste |
| S-09 | O cliente autoriza o uso da fonte caligráfica e de imagens de profissionais | Trocar por alternativa licenciada / remover acento |

---

## 9. Dependências de conteúdo (bloqueiam publicação, não o desenvolvimento)

| # | Dependência | Responsável | Bloqueia |
|---|---|---|---|
| C-01 | Confirmar quais unidades estão **ativas** (incl. Quixeramobim) | Clínica | Páginas de unidade |
| C-02 | Endereço completo + CEP de cada unidade; endereço da matriz alimenta o rodapé (AC-30). `geo` é **recomendado e não bloqueia**: só é emitido com coordenada numérica, `precisao` diferente de `aproximada` e fonte em `validacao.fontes`; pendência exclusivamente de `geo` é listada no relatório, não derruba o go-live (AC-13/AC-23) | Clínica | Página da unidade, rodapé, mapa, JSON-LD (pendência de `geo` não bloqueia) |
| C-03 | Telefones oficiais por unidade (e se há WhatsApp oficial); telefone institucional da matriz, com o mesmo valor conferido em `contatoInstitucional` | Clínica | Contato, CTA, rodapé (AC-30) |
| C-04 | Horários de funcionamento por unidade e por serviço | Clínica | Página de unidade |
| C-05 | Serviços efetivamente realizados em cada unidade | Clínica | Serviços, cruzamento |
| C-06 | Convênios aceitos por unidade (lista nominal e vigência), com `atualizadoEm` obrigatório sempre que houver convênio (AC-29) | Clínica | Convênios |
| C-07 | Formas de pagamento e documentos exigidos | Clínica | Convênios |
| C-08 | Responsável técnico: nome, CRM/UF, especialidade; RT por unidade? | Clínica | Rodapé, Sobre, conformidade |
| C-09 | Textos de preparo revisados e aprovados pelo RT | RT | Preparo |
| C-10 | Texto institucional, história e diferenciais verificáveis | Clínica | Sobre/Home |
| C-11 | Logotipo em SVG, cores oficiais, tipografia, fotos reais, autorizações de imagem | Clínica | Identidade definitiva (a provisória vem do flyer) |
| C-12 | Domínio definitivo + acesso ao DNS/hospedagem — permanece dependência do cliente **mesmo com `urlBase` já preenchido** no repositório; preencher o `urlBase` não conclui a dependência | Clínica | Go-live, canonical, Search Console |
| C-13 | Prazo médio de laudo (se for divulgar) | Clínica | Serviços/Home |
| C-14 | Texto de política de privacidade / aviso legal | Clínica + jurídico | Rodapé |
| C-15 | E-mail institucional oficial e redes sociais oficiais | Clínica | Contato, `sameAs` |

---

## 10. Riscos (resumo; detalhamento no `plan.md`)

1. **Dados não confirmados virarem "verdade" pública** (telefones de exemplo do briefing, unidade possivelmente inativa). Mitigação: `status` por campo + gate de build + AC-15.
2. **Publicidade médica inadequada** em textos escritos por não médicos. Mitigação: checklist + revisão do RT (RN-01, AC-20).
3. **Convênios desatualizados** gerando reclamação e exposição jurídica. Mitigação: ressalva obrigatória + data de atualização visível.
4. **Expectativa de integração com o portal de exames.** Mitigação: aviso explícito de ambiente externo e alinhamento de expectativa no aceite.
5. **Conteúdo clínico de preparo incorreto** causando exame cancelado. Mitigação: RN-04/AC-09.
6. **Duplicação de páginas por cidade** (doorway pages). Mitigação: FR-14 e exigência de conteúdo único.
7. **Domínio/DNS atrasando o go-live.** Mitigação: build com `urlBase` configurável; publicar em subdomínio provisório com `noindex` até o DNS.
8. **Identidade provisória do flyer tratada como marca oficial.** Mitigação: RN-10/RN-11, marcação explícita no JSON/tema/README e bloqueio no relatório de pendências (AC-28); nunca vetorizar a marca a partir do raster.
9. **Copy promocional do flyer reaproveitado** ("resultados precisos"). Mitigação: FR-46 + checklist AC-20 e revisão do RT.
10. **Rodapé e página divergirem sobre o endereço/telefone institucional** (duas fontes, ou rodapé vazio enquanto a página diz exibir a matriz). Mitigação: fonte única no registro da matriz + NAP do rodapé em todas as páginas + AC-30.
11. **Gate de artefato frágil** (depender da ordem dos atributos, ignorar o sitemap ou auditar só o gerado em memória). Mitigação: NFR-12/AC-34 e testes negativos no `--check`.
