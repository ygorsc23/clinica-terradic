# Plano técnico — Site institucional Terradic

**Feature:** `001-site-institucional-terradic`
**Base:** `spec.md` (implementação concluída nas fases técnicas; pendente de dados do cliente e de auditorias externas)
**Natureza:** projeto novo; implementação existente em `src/`, `scripts/` e `dados/`. Não há `.specify/` no repositório (Spec Kit indisponível — artefatos produzidos manualmente).
**Regra:** este documento registra as decisões técnicas e o estado real da implementação; não substitui o aceite do cliente nem autoriza deploy (FR-47).

---

## 1. Stack e decisões fechadas

| Item | Decisão |
|---|---|
| Marcação | HTML5 estático, sem framework, sem gerador de terceiros |
| Estilo | Tailwind CSS **compilado via CLI** (nunca CDN), build minificado em produção |
| JS | Vanilla, um único bundle pequeno (menu, acordeões, fachada de mapa) |
| Build | Node LTS fixado + `scripts/build.mjs` próprio, sem dependências além de Tailwind |
| Dados | JSON versionado em `dados/`; um único ponto de verdade por unidade |
| Deploy | Hospedagem estática com HTTPS, domínio próprio e 404 customizada; deploy de produção **somente** a partir de `npm run build:go-live` verde |
| SEO | Metadados por página + `sitemap.xml` + `robots.txt` + JSON-LD por unidade |
| Acessibilidade | WCAG 2.1 AA |
| Privacidade | Zero coleta de dado pessoal, zero cookie próprio, zero analytics com identificador |

### 1.1 Registro de decisões (ADRs resumidos)

- **AD-01 — Sem gerador estático de terceiros.** O domínio é pequeno (≈ 20–25 páginas) e o build precisa de regras de validação de conteúdo próprias. Um script de ~300 linhas cobre o caso, elimina dependência de plugin e mantém o gate de publicação sob nosso controle. *Rejeitado:* Eleventy/Astro (mais poder que o necessário, atualização e "mágica" de template), Jekyll (Ruby no ambiente).
- **AD-02 — Templates com substituição de tokens, não linguagem de template.** Cada tipo de página tem um HTML com marcadores (`{{conteudo}}`, `{{jsonLd}}`, `{{cardsUnidades}}`); o script injeta fragmentos já renderizados. *Rejeitado:* Handlebars/Nunjucks (dependência + curva), loops em template (dificulta validação).
- **AD-03 — Conteúdo editorial em JSON estruturado por blocos, não Markdown.** Blocos (`titulo`, `paragrafo`, `lista`, `destaque`, `aviso`) permitem validar placeholder e aplicar estilo consistente sem parser. *Rejeitado:* Markdown (parser próprio ou dependência; risco de HTML arbitrário). **Classificação editorial (vinculante):** texto que informa — frase, título com conteúdo, chamada, aviso redigido — é editorial e vive em `paginas.json`; rótulo que opera a interface — "pular para o conteúdo", "abre em nova aba", "menu", breadcrumb, rótulo de campo — pode ficar no template. Critério funcional, não de tamanho; dúvida se resolve com "isto muda se o cliente mudar o texto institucional?". É decisão registrada (FR-48/RN-12) e não deve ser reaberta em revisões futuras sem mudança de escopo.
- **AD-04 — `MedicalClinic` como tipo único por unidade.** `MedicalClinic` já é subtipo de `MedicalBusiness` → `LocalBusiness`; declarar os dois como nós separados duplicaria endereço/telefone e cria risco de inconsistência. Um nó `MedicalClinic` + `Organization` da marca (`parentOrganization`) satisfaz "MedicalClinic + LocalBusiness".
- **AD-05 — Mapa com fachada clicável.** Nenhum iframe/script de terceiro no carregamento inicial (performance, cookies, LGPD). O endereço textual é sempre visível; o mapa carrega após clique explícito, com link alternativo para o Google Maps.
- **AD-06 — Unidade não confirmada não é publicada.** `status` no JSON controla geração de página e sitemap. *Rejeitado:* publicar todas e corrigir depois (dano reputacional e risco de SEO).
- **AD-07 — Telefones em E.164 no dado, formatado na renderização.** Garante `tel:` correto e consistência de NAP sem depender de digitação.
- **AD-08 — Sem formulário de contato.** Evita coleta de dado pessoal, spam e obrigação de política de retenção. Contato = `tel:`, `mailto:` e WhatsApp oficial (externo).
- **AD-09 — `dist/` gerado e ignorado no git.** Fonte de verdade é `dados/` + `src/`; publicação é artefato de build.
- **AD-10 — Nenhum dado de exemplo entra na árvore de produção.** Exemplos do briefing ficam em `dados/exemplos-briefing.json` (documentação) e jamais são lidos pelo build.
- **AD-11 — Direção visual provisória derivada de flyer, formalizada em tokens.** A paleta é aproximada, vem de material de campanha e **não** é brandbook. Implementar como variáveis semânticas desde o início evita retrabalho quando o cliente entregar o SVG do logo e a paleta oficial (ver §1.2).
- **AD-12 — Três modos de build, não um.** A revisão de QA mostrou que "build de produção falha com qualquer pendência" é incompatível com o desenvolvimento (quase todo conteúdo nasce pendente) e que um build único tolerante não protege a publicação. Ficam três modos: `--rascunho` (`npm run build:rascunho`; tolerante, dados de teste, faixa de revisão, grava `dist-rascunho/` e emite `noindex, nofollow`), `build` de produção (`npm run build`; tolerante com entidades não publicáveis — exclui e relata —, estrito com tudo o que publica) e `--go-live` (`npm run build:go-live`; estrito, falha em qualquer bloqueio de publicação). *Rejeitado:* build estrito único (paralisa o desenvolvimento); build tolerante único (publica conteúdo incompleto). **Regras:** (a) o `dist/` do `npm run build` é **build tolerante de revisão e nunca publicável**; o deploy de produção ocorre **somente** a partir de `npm run build:go-live` verde; (b) staging é artefato separado em `dist-staging/` (`--base-url` de staging sem `--rascunho`), com `noindex, follow`, e nunca escreve em `dist/`.
- **AD-13 — Decisões da rodada 5 (gates de publicação).** Registradas para não reabrir discussão: (1) deploy só de `build:go-live` verde; `npm run build` é build tolerante de revisão, nunca publicável (FR-47/AD-12); (2) staging é artefato separado (`dist-staging/`, `noindex, follow`), distinto do rascunho local (`noindex, nofollow`); (3) `geo` só é emitido com `lat`/`lng` numéricos, `precisao` diferente de `aproximada` e origem em `validacao.fontes[]`; caso contrário, omitido e listado; (4) bloco `pendente` não é renderizado em produção nem por acesso direto a `id`/âncora de texto transversal, e aparece com selo no rascunho; (5) identidade visual: go-live aceita `status: "oficial"` **ou** `identidadeVisual.aceiteFormal` com `aceitoPor`, `data` e `documento` (RN-10/AC-28); (6) pendência apenas de `geo` (C-02) é listada e não bloqueia; C-12 continua dependência do cliente mesmo com `urlBase` preenchido; (7) a entrega da rodada incluiu migração editorial para `paginas.json`: nova entrada `paginas.unidade` (subtítulo e títulos de seção da página de unidade) e novo bloco `home.cta-aviso` (aviso de ambiente externo do CTA), com dois templates correspondentes — registro factual da entrega, sem criar requisito novo.

### 1.2 Direção visual (provisória)

> **Status: PROVISÓRIA.** O cliente ainda não foi contatado formalmente e não há brandbook. A referência é um **flyer de campanha da unidade Pacajus** obtido nas redes sociais da clínica. Cores são estimadas a partir de imagem raster e podem não corresponder à marca. Nada aqui deve ser tratado como identidade oficial, e o repositório precisa deixar isso explícito (ver "Como marcar a provisoriedade"; riscos R-07 a R-10 em §12).

**Tokens aprovados (hex aproximados):**

| Token semântico | Hex | Uso permitido |
|---|---|---|
| `--cor-primaria` (turquesa) | ~`#00A79B` | logo, ícones, preenchimentos, detalhes; **não** como texto sobre fundo claro |
| `--cor-primaria-texto` (turquesa escurecido) | ~`#00796F` (derivado, a validar) | links e texto turquesa sobre branco/off-white com AA |
| `--cor-secundaria` (verde-petróleo) | ~`#0E5C55` | barras, botões primários, rodapé, títulos de peso |
| `--cor-secundaria-escura` | ~`#164E4A` | hover/estado ativo, faixas de destaque |
| `--cor-acento` (dourado) | ~`#F5B700` | **somente** acento gráfico (ícone, filete, marcador); nunca texto sobre branco |
| `--cor-fundo` | ~`#F6F8F8` | fundo de página e seções alternadas |
| `--cor-texto` | ~`#1F2933` | corpo de texto e títulos sobre fundo claro |
| `--raio-card` | 16 px | cards e blocos arredondados |
| `--sombra-card` | leve (1 nível) | cards brancos sobre off-white |

**Pares de contraste (valores calculados, a reconferir no build):**

| Par | Uso | Aprox. | Situação |
|---|---|---|---|
| `#1F2933` / `#F6F8F8` | corpo | ~14:1 | OK |
| `#FFFFFF` / `#0E5C55` | texto de botão primário | ~7,8:1 | OK (AAA) |
| `#0E5C55` / `#FFFFFF` | título/barra sobre branco | ~7,8:1 | OK |
| `#1F2933` / `#00A79B` | texto escuro sobre turquesa | ~4,9:1 | OK (limite) |
| `#00A79B` / `#FFFFFF` | turquesa como texto ou ícone fino | ~3,0:1 | **só ícone/área grande**; proibido para corpo e links |
| `#FFFFFF` / `#00A79B` | texto branco em botão turquesa | ~3,0:1 | **reprovado** — botão turquesa sólido não é permitido |
| `#F5B700` / `#FFFFFF` | dourado como texto | ~1,8:1 | **proibido** |
| `#F5B700` / `#0E5C55` | dourado sobre petróleo | ~4,3:1 | apenas texto grande/ícone, nunca corpo |

Consequência prática: **botão primário é sempre verde-petróleo com texto branco**; turquesa aparece em ícones, círculos, filetes e no logo; dourado não carrega informação textual. O **indicador de foco** é um par próprio: ≥ 3:1 contra a superfície em que aparece, com variante clara para hero e rodapé escuros (NFR-01/AC-17) — o foco padrão sobre fundo escuro não atende.

**Regras de implementação:**

1. Tokens definidos uma única vez como variáveis CSS no tema Tailwind (`tailwind.config.js` + `@layer base`) e consumidos por classes/tokens semânticos. **Proibido hex solto em template/HTML/JS**; o `--check` falha se encontrar `#RRGGBB` fora dos arquivos de tema.
2. Contraste AA obrigatório em todo par efetivamente usado em texto; a matriz acima é o registro de referência e precisa ser revalidada após qualquer ajuste de tom.
3. **Logo:** usar um placeholder neutro (wordmark tipográfico simples) até o cliente enviar o arquivo. **Não recriar, vetorizar, redesenhar ou "limpar" a marca a partir do flyer raster** — isso produz marca não oficial e risco jurídico. A troca é por SVG fornecido (T010). O placeholder não deve imitar o logo real.
4. **Pill da unidade:** selo arredondado com o nome da unidade no padrão do flyer, presente no hero e/ou cabeçalho de **toda página de unidade**. O texto vem de `unidades[].nomeExibicao` — nunca hardcoded — e o componente é único (parcial reutilizada).
5. Cards brancos com raio 16 px e sombra leve; ícones de serviço em círculo turquesa com contraste interno validado.
6. Tipografia: sans geométrica pesada para títulos, sans neutra para corpo (self-host ou pilha do sistema, conforme §8). A **fonte caligráfica do flyer fica restrita a um único acento no hero** (por exemplo, uma palavra), nunca em navegação, texto informativo, preparo ou conteúdo clínico; precisa de fallback legível.
7. **Não reutilizar material de campanha:** nada de fotos de profissionais do flyer, nem seus textos, nem o layout do flyer como página. Fotos e textos vêm do cliente, com autorização de imagem (RN-08).
8. **Claims proibidos:** o flyer usa linguagem promocional ("resultados precisos" e similares). Nenhuma dessas frases entra no site; a comunicação usa linguagem verificável e aderente às normas de publicidade médica (RN-01). Aproveitar apenas elementos visuais, nunca copy.
9. Aplicar a direção visual **não** antecipa aprovação: a versão publicada continua sujeita ao aceite do RT (AC-20).

**Como marcar a provisoriedade no repositório:**

- `dados/site.json` recebe `identidadeVisual: { "status": "provisoria", "origem": "flyer de campanha — unidade Pacajus (redes sociais)", "brandbook": null, "logoOficial": null, "aceiteFormal": null, "substituidaEm": null }`; `aceiteFormal` é `{ "aceitoPor", "data", "documento" }` quando houver aceite escrito do cliente.
- Comentário no topo de `tailwind.config.js` e de `src/css/estilo.css`: paleta aproximada, não oficial, origem no flyer.
- Nota no `README.md` ("Identidade visual provisória") com o que falta e quem fornece.
- `relatorios/pendencias.md` lista "identidade visual provisória / logo placeholder" como **bloqueio de go-live** (C-11).
- Build de produção e go-live avisam no stdout enquanto `identidadeVisual.status != "oficial"` e `aceiteFormal` não estiver registrado; `--rascunho` mostra faixa "IDENTIDADE PROVISÓRIA".

**Critério para sair de provisório:** SVG do logo fornecido pelo cliente + paleta/tipografia oficiais (brandbook ou aprovação escrita) + licença da fonte caligráfica, se mantida. Nesse momento: trocar tokens, revalidar contraste, atualizar `identidadeVisual.status` e remover as marcações. **Alternativa aceita pelo gate:** manter `status: "provisoria"` e registrar `identidadeVisual.aceiteFormal` com `aceitoPor`, `data` e `documento` do aceite do cliente; sem `status: "oficial"` nem `aceiteFormal` válido, o go-live falha (RN-10/AC-28).

---

## 2. Estrutura de arquivos

```
clinica-terradic/
├─ dados/
│  ├─ site.json                 # marca, CNPJ, domínio, portal, RT, redes, e-mail
│  ├─ unidades.json             # fonte única por unidade
│  ├─ servicos.json             # catálogo de serviços
│  ├─ convenios.json            # catálogo de convênios (nomes em texto)
│  ├─ preparos.json             # preparos + status de revisão médica
│  ├─ paginas.json              # blocos de texto de home/sobre/convenios/contato/privacidade
│  └─ exemplos-briefing.json    # NÃO usado no build; só referência histórica
├─ src/
│  ├─ templates/
│  │  ├─ layout.html
│  │  ├─ parciais/  header.html, footer.html, cta-exames.html, aviso-externo.html,
│  │  │             card-unidade.html, card-servico.html, acordeao-preparo.html,
│  │  │             mapa-fachada.html, breadcrumb.html
│  │  ├─ home.html, unidades.html, unidade.html
│  │  ├─ servicos.html, servico.html
│  │  ├─ preparo.html, convenios.html, sobre.html, contato.html, privacidade.html
│  │  └─ 404.html
│  ├─ css/
│  │  └─ estilo.css             # entrada Tailwind + @layer components
│  ├─ js/
│  │  └─ app.js                 # menu, acordeões, mapa sob demanda (~3–5 KB)
│  └─ estatico/                 # favicon, og-image, logo-placeholder, imagens, fontes, robots.txt base
├─ scripts/
│  ├─ build.mjs                 # orquestra tudo; flags --rascunho, --go-live, --check
│  ├─ testes.mjs                # suite `node:test` (npm test)
│  ├─ servidor.mjs              # preview local (npm run dev)
│  ├─ auditoria.mjs             # medições locais via CDP
│  ├─ prefixar-base.mjs         # prefixo do preview no Pages
│  └─ lib/
│     ├─ dados.mjs              # leitura + validação de schema
│     ├─ render.mjs             # tokens, parciais, fragmentos, blocos de paginas.json
│     ├─ seo.mjs                # metadados, JSON-LD, sitemap, breadcrumbs
│     ├─ checagens.mjs          # gate de QA do artefato (--check)
│     ├─ golive.mjs             # gate estrito de publicação (--go-live)
│     └─ relatorio.mjs          # relatório de pendências (md + json)
├─ dist/                        # gerado; produção (ignorado no git)
├─ dist-staging/                # gerado; staging `noindex, follow` (ignorado)
├─ dist-rascunho/               # gerado; rascunho `noindex, nofollow` (ignorado)
├─ relatorios/                  # gerado; pendencias.md / pendencias.json (ignorado)
├─ specs/001-site-institucional-terradic/
├─ package.json  package-lock.json  .nvmrc  tailwind.config.js
├─ .gitignore  README.md  CONTEUDO-PENDENTE.md
```

`CONTEUDO-PENDENTE.md` é escrito à mão (checklist de C-01..C-15) e **espelhado** pelo relatório gerado; o gerado é a fonte operacional, o manual é o resumo executivo.

---

## 3. Modelo de dados

### 3.1 `dados/site.json`

```json
{
  "versao": 1,
  "atualizadoEm": "2026-11-20",
  "marca": { "nome": "Terradic", "nomeCompleto": "Terradic Telerradiologia",
             "razaoSocial": "Ed Wilson Custódio Francelino", "cnpj": "14.106.964/0001-23" },
  "urlBase": "https://terradic.com.br",
  "idioma": "pt-BR",
  "portalExames": { "url": "https://entregadeexames.com.br/", "operador": "Mobilemed",
                    "instrucoes": ["CPF", "protocolo e senha"], "ambienteExterno": true },
  "contatoInstitucional": { "email": null, "telefoneE164": null },
  "responsavelTecnico": { "nome": null, "crm": null, "crmUf": "CE",
                          "especialidade": null,
                          "status": "pendente" },
  "redesSociais": { "instagram": null, "facebook": null },
  "analytics": null,
  "identidadeVisual": { "status": "provisoria",
                        "origem": "flyer de campanha — unidade Pacajus (redes sociais)",
                        "brandbook": null, "logoOficial": null,
                        "aceiteFormal": null, "substituidaEm": null },
  "privacidade": { "politicaPublicada": false, "atualizadoEm": null }
}
```

Regras: `urlBase` sem barra final e sem `www`; `portalExames.url` é a **única** URL externa de exames aceita pelo validador. `contatoInstitucional` guarda e-mail e o telefone institucional — este último precisa espelhar o telefone da matriz, nunca ser uma segunda verdade. O **endereço e o telefone do rodapé** são resolvidos do registro com `matriz: true` em `unidades.json` (fonte única — publicável ou apenas confirmado), nunca duplicados em `site.json` nem tomados da unidade visitada (FR-02/FR-13/AC-30). Se `contatoInstitucional.telefoneE164` for preenchido, o validador exige igualdade com o telefone institucional da matriz; divergência é erro de build. `responsavelTecnico` só é considerado completo com `nome`, `crm`, `crmUf` e `especialidade` — a renderização é condicional ao conjunto, para não emitir pontuação órfã (FR-29/AC-33). `identidadeVisual.aceiteFormal` é `null` ou `{ aceitoPor, data, documento }`; no go-live, identidade `provisoria` sem `aceiteFormal` completo falha, e `status: "oficial"` dispensa o aceite (RN-10/AC-28).

### 3.2 `dados/unidades.json`

```json
{
  "versao": 1,
  "atualizadoEm": "2026-11-20",
  "unidades": [{
    "id": "caninde",
    "slug": "caninde",
    "nomeExibicao": "Terradic Canindé",
    "cidade": "Canindé",
    "uf": "CE",
    "cnpjFilial": "14.106.964/0001-23",
    "matriz": true,
    "status": "a-confirmar",
    "endereco": { "logradouro": null, "numero": null, "complemento": null,
                  "bairro": null, "cep": null, "referencia": null },
    "geo": { "lat": null, "lng": null, "precisao": null },
    "telefones": [
      { "rotulo": "Recepção", "e164": null, "tipo": "fixo", "validado": false }
    ],
    "whatsapp": { "e164": null, "validado": false },
    "email": null,
    "horarios": [
      { "dias": ["seg", "ter", "qua", "qui", "sex"],
        "abre": null, "fecha": null, "obs": null }
    ],
    "servicos": [],
    "convenios": [],
    "atendimentoParticular": true,
    "comodidades": { "estacionamento": null, "acessivel": null },
    "observacoesPublicas": null,
    "fotos": [],
    "redesSociais": { "instagram": null, "facebook": null },
    "responsavelTecnico": null,
    "validacao": { "status": "pendente", "confirmadoPor": null, "data": null,
                   "fontes": [] },
    "atualizadoEm": "2026-11-20"
  }]
}
```

Campos e semântica:

| Campo | Obrigatório para publicar | Observação |
|---|---|---|
| `id` / `slug` | sim | `slug` único, `[a-z0-9-]`, sem acento |
| `nomeExibicao`, `cidade`, `uf` | sim | usados em H1, title e JSON-LD |
| `cnpjFilial`, `matriz` | sim | exibido no rodapé/JSON-LD `taxID` (opcional) |
| `status` | sim | `ativo` publica; `a-confirmar`/`rascunho`/`inativo` não publicam |
| `endereco.*` (logradouro, numero, bairro, cep) | sim | `complemento`/`referencia` opcionais |
| `geo` | recomendado | ausente → JSON-LD sem `geo` (não inventar coordenada) e go-live não bloqueia; só entra com `lat`/`lng` numéricos, `precisao` diferente de `aproximada` e origem registrada em `validacao.fontes[]`; `aproximada` ou coordenada sem fonte → omitido; **nunca** derivar de CEP/endereço/centroide (AC-13) |
| `telefones[]` | ≥ 1 | `e164` obrigatório se `validado: true` |
| `horarios[]` | ≥ 1 | `dias` em `seg..dom`; `abre`/`fecha` em `HH:MM` |
| `servicos[]` | ≥ 1 **aprovado** | referências a `servicos.json`; ao menos um serviço `aprovado` é condição de publicação (FR-12/AC-31). Seção de serviços vazia e `availableService` ausente reprovam o gate — publicar unidade sem serviço é proibido |
| `responsavelTecnico` (unidade) | quando existir | exige o conjunto `nome` + `crm` + `crmUf` + `especialidade`; incompleto → bloco omitido e bloqueio no go-live (FR-29/AC-33) |
| `convenios[]` | pode ser vazio | referências a `convenios.json`; vazio → "confirmar com a unidade" |
| `fotos[]` | não | `{ "arquivo", "alt", "autorizacaoImagem": true }` |
| `validacao.status` | sim | `confirmado` exigido no go-live; unidade não confirmada é excluída do build de produção |

### 3.3 `dados/servicos.json`

```json
{ "servicos": [{
  "id": "tomografia",
  "slug": "tomografia",
  "nome": "Tomografia computadorizada",
  "nomeCurto": "Tomografia",
  "resumo": null,
  "descricao": ["bloco de parágrafo"],
  "indicacoes": [],
  "comoEfeito": [],
  "duracaoMedia": null,
  "exigePedidoMedico": true,
  "preparos": ["tomografia-sem-contraste", "tomografia-com-contraste"],
  "seo": { "titulo": null, "descricao": null },
  "status": "pendente"
}]}
```

Relação serviço↔unidade é **derivada** de `unidades[].servicos` (nunca duplicada aqui). Serviço com `status != "aprovado"` não publica.

### 3.4 `dados/convenios.json`

```json
{ "versao": 1,
  "atualizadoEm": "2026-11-20",
  "convenios": [
  { "id": "unimed", "nome": "Unimed", "tipo": "medicina-de-grupo",
    "exibirLogo": false, "logoAutorizado": false,
    "aviso": "Cobertura sujeita a confirmação junto à operadora e à unidade." }
]}
```

`atualizadoEm` no nível do catálogo é **obrigatório sempre que existir convênio** e é a data exibida na página; lista vazia dispensa a data. Convênio cadastrado sem `atualizadoEm` não nulo reprova o build (AC-29/AC-33). Somente nomes em texto por padrão; logotipo exige `logoAutorizado: true` (RN-03).

### 3.5 `dados/preparos.json`

```json
{ "preparos": [{
  "id": "tomografia-com-contraste",
  "slug": "tomografia-com-contraste",
  "exame": "Tomografia com contraste",
  "servicoId": "tomografia",
  "resumo": null,
  "jejum": null,
  "hidratacao": null,
  "medicamentos": null,
  "documentos": ["Documento com foto", "Pedido médico", "Exames anteriores"],
  "vestimenta": null,
  "duracao": null,
  "observacoes": [],
  "alerta": null,
  "revisao": { "status": "pendente", "responsavel": null, "crm": null, "data": null },
  "atualizadoEm": "2026-11-20"
}]}
```

`revisao.status` ∈ `pendente | aprovado | desatualizado`. O go-live exige `aprovado`; o build de produção tolerante exclui o preparo pendente e o relata. É o gate mais importante do ponto de vista clínico.

### 3.6 `dados/paginas.json`

Blocos por página, sem HTML cru:

```json
{ "paginas": {
  "home": { "titulo": null, "seo": { "titulo": null, "descricao": null },
            "blocos": [ { "tipo": "paragrafo", "texto": null, "status": "pendente" } ] },
  "sobre": { "…": "…" },
  "convenios": { "…": "…" },
  "contato": { "…": "…" },
  "privacidade": { "blocos": [] }
}}
```

Tipos de bloco permitidos: `titulo`, `subtitulo`, `paragrafo`, `lista`, `destaque`, `aviso`, `citacao`. O renderizador escapa texto (sem `innerHTML`) — conteúdo é texto, não marcação.

Na rodada 5, `paginas.json` recebeu a entrada `unidade` (subtítulo e títulos de seção da página de unidade) e o bloco `home.cta-aviso` (aviso de ambiente externo do CTA); o build também consome as entradas `unidades`, `servicos` e `preparo`.

**Decisão (AD-03 confirmada):** o renderizador de blocos é implementado nesta rodada. **Nenhum texto editorial pode ficar fixo em template** — home, sobre, convênios, contato e privacidade consomem `paginas.*.blocos`; o template contém apenas estrutura, marcadores e rótulos de interface (navegação, botões, breadcrumb, rótulos de campo). A home passa a consumir `paginas.home.blocos` nesta rodada.

**Classificação editorial (registro vinculante, FR-48/RN-12):** texto que **informa** — frase, título com conteúdo, chamada, aviso redigido — vai para `paginas.json` em blocos; rótulo que **opera a interface** — "pular para o conteúdo", "abre em nova aba", "menu", "Anterior/Próximo", nome de campo — pode permanecer no template. O critério é funcional, não de tamanho; na dúvida, "isto muda se o cliente mudar o texto institucional?" decide. Revisões futuras não reabrem a discussão sem mudança de escopo.

**`bloco.status`** ∈ `aprovado | pendente`. Bloco `pendente` **não** é renderizado no build de produção — nem pela página, nem por acesso direto à sua âncora/`id` ou a texto transversal referenciado por `id` —, entra no relatório de pendências, aparece com selo no `--rascunho` e, se pertencer a página publicável, **bloqueia o go-live** (FR-49/AC-32). Página editorial sem nenhum bloco aprovado não é publicável.

---

## 4. Rotas e geração de páginas

| Rota | Origem | Template |
|---|---|---|
| `/` | `paginas.home` + dados derivados | `home.html` |
| `/unidades/` | lista derivada | `unidades.html` |
| `/unidades/{slug}/` | 1 por unidade `ativo` | `unidade.html` |
| `/servicos/` | catálogo aprovado | `servicos.html` |
| `/servicos/{slug}/` | 1 por serviço aprovado | `servico.html` |
| `/preparo-de-exames/` | todos os preparos aprovados | `preparo.html` |
| `/convenios-e-particular/` | catálogo + matriz unidade×convênio | `convenios.html` |
| `/sobre/` | `paginas.sobre` + RT | `sobre.html` |
| `/contato/` | unidades + contato institucional | `contato.html` |
| `/politica-de-privacidade/` | condicional (`site.privacidade.politicaPublicada`) | `privacidade.html` |
| `/404.html` | fixo | `404.html` |

Saída: o diretório depende do modo — produção grava em `dist/`, staging (`--base-url` diferente de `https://terradic.com.br`, sem `--rascunho`) grava em `dist-staging/` e `--rascunho` grava em `dist-rascunho/`. Dentro do diretório efetivo: `<rota>/index.html` (diretório, trailing slash), `404.html`, `sitemap.xml`, `robots.txt`, `assets/estilo.css`, `assets/app.js`, estáticos copiados. Staging emite `<meta name="robots" content="noindex, follow">` em todas as páginas; rascunho emite `noindex, nofollow`. Staging e rascunho nunca escrevem em `dist/`.

**Sem paginação e sem índice de preparos por exame** nesta fase: uma página única com âncoras atende e concentra autoridade (decisão revisável se o conteúdo passar de ~15 preparos).

---

## 5. Pipeline de build

`npm run build` executa `node scripts/build.mjs` (flags: `--rascunho`, `--go-live`, `--check`, `--base-url=`). O diretório de saída é derivado das flags: `--rascunho` → `dist-rascunho/`; `--base-url` diferente de `https://terradic.com.br` sem `--rascunho` (staging) → `dist-staging/`; produção → `dist/`.

**Modos (AD-12):**

| Modo | Comando | Semântica |
|---|---|---|
| Rascunho | `npm run build:rascunho` | Tolerante; usa dados de teste; gera faixa de revisão; grava `dist-rascunho/` com `noindex, nofollow`; nunca produz artefato publicável. |
| Produção (tolerante) | `npm run build` | Build de revisão: tolerante com entidades não publicáveis (exclui e relata); **estrito com tudo o que publica**, mas **nunca publicável**. |
| Staging | `npm run build -- --base-url=https://staging.…` | Artefato separado em `dist-staging/`; `noindex, follow` em todas as páginas e `robots.txt` de bloqueio; não substitui produção. |
| Go-live (estrito) | `npm run build:go-live` | Falha com qualquer bloqueio: unidade ativa sem serviço aprovado, preparo não aprovado necessário a serviço publicável, unidade ativa sem telefone validado/`fontes`/`confirmadoPor`/`data`, RT não confirmado ou incompleto (nome/CRM/UF/especialidade), contato institucional ausente, endereço/telefone da matriz ausentes ou divergentes do rodapé, convênio sem `atualizadoEm`, bloco editorial pendente em página publicável, identidade visual provisória sem aceite formal, nenhuma unidade publicável, navegação vazia ou com menos de 2 itens, rota estrutural não gerada. |

**Regra de ouro:** o `dist/` do `npm run build` é build tolerante de revisão e **nunca** é publicado; deploy de produção só a partir de `npm run build:go-live` verde. Staging usa o build tolerante com `--base-url` de staging e `noindex, follow`, em `dist-staging/`.

1. **Carregar** todos os JSON de `dados/` e validar sintaxe.
2. **Validar schema e integridade:** campos obrigatórios por status, slugs únicos e normalizados, refs de `servicos`/`convenios`/`preparos` existentes, `e164` válido (`^\+55\d{10,11}$`), CEP (`^\d{8}$`), horários coerentes (`abre < fecha`), `urlBase` e `portalExames.url` exatamente as configuradas. Validar também: `contatoInstitucional.telefoneE164` idêntico ao telefone institucional da matriz (quando preenchido); RT completo (nome/CRM/UF/especialidade) ou `null`; `convenios.atualizadoEm` não nulo quando houver convênio; `bloco.status` ∈ `aprovado|pendente`. Erros acumulados com `arquivo:campo:unidade`.
3. **Aplicar gates de publicação:** unidade publicável (inclui ≥ 1 serviço aprovado), serviço aprovado, preparo aprovado. No build de produção, entidade não publicável é **excluída e relatada** sem derrubar o build; em `--go-live`, cada bloqueio derruba. Bloco editorial pendente é omitido e relatado — inclusive quando referenciado por `id` em texto transversal —, aparece com selo no rascunho; página editorial sem bloco aprovado não é publicável; bloco pendente em página publicável **bloqueia o go-live**. Em `--rascunho`, gates viram avisos e páginas ganham faixa "DADOS EM CONFIRMAÇÃO".
4. **Calcular derivados:** mapa serviço→unidades, convênio→unidades, próxima unidade que realiza serviço, horários formatados, `sameAs`, breadcrumbs.
5. **Renderizar parciais** (header, footer, CTA, avisos) e então cada página com injeção de fragmentos e metadados, incluindo os blocos de `paginas.json`.
6. **Gerar JSON-LD** por página (ver §7) e serializar dentro de `<script type="application/ld+json">` com escape de `</`.
7. **Compilar CSS** com Tailwind CLI (`-i src/css/estilo.css -o {saída}/assets/estilo.css --minify`), conteúdo escaneado em `src/templates` + `src/js` + fragmentos gerados.
8. **Copiar e otimizar estáticos** (imagens já pré-otimizadas no repositório; sem processamento de imagem no build).
9. **Gerar `sitemap.xml`** a partir do registro de rotas efetivamente escritas (inclui `/politica-de-privacidade/` só se publicada) e `robots.txt` com `Sitemap: {urlBase}/sitemap.xml`.
10. **Relatório:** `relatorios/pendencias.md` e `.json` com todo campo nulo/pendente, agrupado por unidade/serviço/preparo, + resumo no stdout. Em produção tolerante, pendência de entidade não publicável vai ao relatório sem derrubar o build; em `--go-live`, qualquer bloqueio derruba (AC-15/AC-23/FR-47).

**Determinismo:** nenhum timestamp gerado em runtime; `lastmod` vem de `atualizadoEm`; saída ordenada por `slug`; `.nvmrc` e `package-lock.json` versionados; build não acessa rede. **Exceção declarada:** o ano do rodapé (FR-02) vem do relógio do build; duas execuções consecutivas no mesmo ano produzem o mesmo hash, e a virada de ano altera o hash — esperado e documentado no README e no relatório (AC-24).

**Gate de QA local (`--check`):** além do build, verifica links internos quebrados no diretório de saída, presença de `tel:`/`rel` corretos, ausência de `placeholder`/`[CONFIRMAR]`/`lorem`, NAP **equivalente após normalização** (CEP só dígitos; telefone em E.164; comparação do texto visível, não apenas de atributos) entre HTML, JSON-LD e dado canônico. O **rodapé entra na checagem em todas as páginas publicadas**, comparado ao registro da matriz (`matriz: true`) e ao contato institucional — nunca ao da unidade; ausência ou divergência reprova (AC-30). Varredura do CSS compilado por `@import`, `url(http…)` e `@font-face` externo.

**Gate de artefato (NFR-12/AC-34)** — opera sobre o diretório efetivamente escrito (`dist/`, `dist-staging/` ou `dist-rascunho/`, conforme a execução), não só sobre estruturas em memória. O `--check` também confere que uma execução de staging/rascunho não alterou `dist/`:
- `slugsTeste` (unidades de teste conhecidas) é procurado em **todos** os HTML **e no `sitemap.xml`**;
- `noindex` é detectado por presença de `robots` e `noindex` na `<meta>`, **independentemente da ordem dos atributos**; staging exige `noindex, follow`, rascunho exige `noindex, nofollow` e produção não pode tê-lo em página publicável;
- o `sitemap.xml` **existente** é auditado (base permitida, URLs fictícias, slug de teste), além do sitemap gerado na mesma execução;
- `<meta name="robots" content="noindex">` em página publicável do build de produção reprova, exceto `404.html`; a faixa "VERSÃO DE REVISÃO" nunca aparece na produção.

**Tempo de build esperado:** < 5 s (sem imagens), viabilizando deploy por push.

---

## 6. Estratégia de conteúdo e marcação de placeholders

Princípio: **ausência de informação é representada como ausência** (`null` + `status`), nunca como dado inventado com aparência de verdade.

1. **Dois níveis de status.** `validacao.status` da unidade (`pendente|parcial|confirmado`) e `status` por entidade (`servico`, `preparo`, `bloco`). Contatos têm `validado: boolean`.
2. **Exemplos do briefing isolados.** Telefones e endereços de exemplo do levantamento ficam em `dados/exemplos-briefing.json`, com cabeçalho de aviso. Nenhum script lê esse arquivo — só o validador, para recusar valores idênticos aos exemplos (proteção contra "copiar e esquecer").
3. **Visibilidade no repositório:** o build gera `relatorios/pendencias.md` (tabela: item → campo → o que falta → quem responde → bloqueia go-live?). `CONTEUDO-PENDENTE.md` é o resumo manual com C-01..C-15 e serve de checklist para a reunião com a clínica.
4. **Visibilidade em tela (só em `--rascunho`):** faixa fixa no topo "VERSÃO DE REVISÃO — DADOS NÃO CONFIRMADOS" e `badge` vermelho ao lado de qualquer bloco pendente. Build de produção não emite nada disso.
5. **Proibição de texto provisório publicado:** o gate de build rejeita `placeholder`, `lorem`, `TODO`, `XXX`, `CONFIRMAR`, `a definir`, `exemplo@` no HTML final.
6. **Rastreabilidade:** cada dado crítico aceita `fontes[]` (URL do CNES/CNPJ, print, e-mail) e `confirmadoPor` + `data`. Auditoria futura sabe de onde veio.
7. **Textos de preparo:** nunca escritos por nós a partir de "senso comum". Estrutura pronta (campos), conteúdo só entra após revisão do RT; enquanto isso, a página mostra apenas orientação genérica aprovada ("confirme o preparo com a unidade") ou não publica o exame.

---

## 7. SEO local e dados estruturados

### 7.1 Padrões de metadados

| Página | `title` | `description` |
|---|---|---|
| Home | `Terradic — Diagnóstico por imagem e telerradiologia no Ceará` | Serviços, unidades e portal de exames, sem promessa |
| Unidade | `{Nome da unidade} — Exames de imagem em {Cidade}/{UF}` | Endereço, telefone, horário e serviços reais da unidade |
| Serviço | `{Serviço} — Terradic \| Unidades no Ceará` | O que é, preparo e unidades que realizam |
| Preparo | `Preparo para {Exame} \| Terradic` | Jejum, documentos e orientações (sem dado clínico não aprovado) |
| Convênios | `Convênios e atendimento particular \| Terradic` | Lista por unidade + ressalva de confirmação |
| Sobre | `Sobre a Terradic e o responsável técnico \| Terradic` | História, abrangência e responsável técnico com nome e CRM |
| Contato | `Contato e endereços \| Terradic` | Telefones por unidade e endereço da matriz |

Regras: `title` ≤ 60 caracteres, `description` 120–160, um `<h1>` por página, H1 contendo cidade na página de unidade, canonical autorreferente, `og:image` 1200×630 por tipo de página, `og:locale pt_BR`, `twitter:card summary_large_image`. Não criar página "serviço × cidade" para as 5×7 combinações — isso geraria doorway pages; a combinação é coberta pela página de unidade (lista de serviços) e pela página de serviço (lista de unidades).

Preenchimento dos templates e limite de 60 caracteres:

1. **Unidade:** `{Nome da unidade}` = `unidades[].nomeExibicao`, que já começa com a marca ("Terradic Canindé"); por isso o título não repete "| Terradic". `{Cidade}`/`{UF}` vêm do mesmo registro. Maior caso atual: "Terradic Quixeramobim — Exames de imagem em Quixeramobim/CE" = 59 caracteres. Fallback se algum nome futuro estourar: `{Nome da unidade} — {Cidade}/{UF} | Terradic`.
2. **Serviço:** `{Serviço}` = `servicos[].nomeCurto` ("Tomografia", "Ultrassonografia"), nunca o nome completo e nunca a cidade. Maior caso atual: "Consultas ambulatoriais — Terradic | Unidades no Ceará" = 54 caracteres. Fallback: `{Serviço} | Terradic`.
3. **Gate:** o build falha se qualquer `title` gerado exceder 60 caracteres, repetir outro `title` ou se um título de serviço contiver nome de cidade. O título de serviço nunca promete disponibilidade local — quem informa "esta unidade faz este exame" é o corpo da página (FR-18) e a página da unidade (FR-13), coerente com FR-12 e com a proibição de doorways.

### 7.2 JSON-LD

Um grafo por página:

- `Organization` (global, `@id: {urlBase}/#organizacao`): nome, `legalName`, `taxID`, `url`, `logo`, `sameAs`.
- `MedicalClinic` (`@id: {urlBase}/unidades/{slug}/#clinica`): `name`, `url`, `telephone`, `address` (`PostalAddress` com `streetAddress`, `addressLocality`, `addressRegion`, `postalCode`, `addressCountry: BR`), `geo` (só se confirmado), `openingHoursSpecification`, `availableService` (`MedicalTest` com `name`, sempre com ao menos um item — unidade sem serviço aprovado não é publicada), `parentOrganization` → Organization, `areaServed` (`City`), `sameAs` (redes da unidade). **Sem `medicalSpecialty` fixo:** não é exigido por AC-13, `Radiology` não pertence à enumeração `MedicalSpecialty` do schema.org e uma especialidade fixa seria incorreta para uma clínica que também faz consultas; as especialidades vêm dos serviços (`availableService`).
- `MedicalWebPage`/`WebPage` para páginas de serviço e preparo, `isPartOf` → `WebSite`.
- `BreadcrumbList` em todas as páginas internas.
- `WebSite` apenas na home (`@id: {urlBase}/#site`), sem `SearchAction` (não há busca).

**Proibido:** `aggregateRating`, `review`, `priceRange`, `Offer`/`price`, `MedicalProcedure` com promessa de resultado, `FAQPage` com perguntas inventadas (só se houver FAQ real e aprovada).

**`geo` opcional (AC-13):** o bloco `geo` do `MedicalClinic` é emitido **somente** quando `unidades[].geo.lat` e `.lng` são numéricos, `geo.precisao` é diferente de `aproximada` (isto é, `exata`) e `validacao.fontes[]` não está vazio. `precisao: "aproximada"` ou ausência de fonte em `validacao.fontes[]`: bloco **omitido** e relatado, sem bloquear o go-live; valor de `precisao` fora do enum continua **erro de schema**. Coordenada nunca é derivada do CEP, do endereço ou do centroide da cidade.

### 7.3 Indexação e operação

- `robots.txt`: `User-agent: * / Allow: /` + `Sitemap:` absoluto. Nenhum `Disallow` em produção; staging (artefato em `dist-staging/`) usa `noindex, follow` via flag de build (`--base-url` de staging + meta robots) e `robots.txt` próprio com `Disallow: /`, nunca alterando `robots.txt` à mão; o rascunho local usa `noindex, nofollow`.
- `sitemap.xml` com `loc` absoluto, `lastmod` (data de atualização dos dados) e sem URLs de rascunho.
- NAP equivalente após normalização documentada (CEP só dígitos; telefone em E.164; texto visível comparado, não apenas atributos) entre página, JSON-LD, rodapé institucional e Google Business Profile; divergência é defeito de build (checagem no `--check`). O rodapé é comparado, em todas as páginas, ao endereço e ao telefone da matriz — nunca ao da unidade — e ao contato institucional; ausência é bloqueio de go-live (FR-02/AC-30).
- Links internos contextuais: unidade → serviços da unidade → preparo; serviço → unidades; preparo → serviço; home → 5 serviços + unidades; rodapé com link para todas as unidades (profundidade ≤ 2).
- Após go-live: Search Console (domínio + sitemap), Bing Webmaster, e reivindicação/atualização de GBP por unidade (fora do escopo de código, mas dependência de resultado).

---

## 8. Acessibilidade, performance e privacidade

**Acessibilidade (AA):** tokens de cor com contraste validado (texto normal ≥ 4,5:1; ícones ≥ 3:1), foco visível com `outline` de 2 px e offset, skip link, landmarks (`header/nav/main/footer`), `aria-current="page"` no menu, acordeões com `<button aria-expanded aria-controls>` + região, `<details>/<summary>` como base (funciona sem JS) e JS apenas aprimora, mapa como `<a>`/`<button>` com rótulo "Ver mapa de {unidade} (abre serviço externo)", imagens com `alt` descritivo (ou `alt=""` se decorativas), tabelas de horário como lista de definição (não tabela), sem `tabindex > 0`, sem autofocus. O **token de foco** precisa de contraste ≥ 3:1 contra a superfície em que aparece, com variante própria para superfícies escuras (hero e rodapé); a matriz de contraste registra o par de foco para fundo claro e escuro, medido — não presumido.

**Performance:** CSS único minificado (alvo < 25 KB gzip), JS < 10 KB gzip em arquivo único com `defer`, zero fonte de terceiro (self-host woff2 com `preload` de 1 peso ou pilha do sistema), imagens WebP/AVIF com `width`/`height` e `loading="lazy"` exceto hero, `og-image` estática, sem ícones em fonte (SVG inline esporádico), mapa pós-clique. O CSS compilado é autocontido: sem `@import`, sem `url(http…)` e sem `@font-face` externo; o `--check` varre o CSS compilado (NFR-02/NFR-07). Metas: Lighthouse mobile ≥ 90/95/95/90.

**Privacidade:** nenhum `<form>`, nenhum `localStorage` com dado pessoal (só preferência de menu, se necessário — ou nada), nenhum cookie, nenhum pixel. Se o cliente quiser medir cliques, a única opção compatível é analytics sem cookie e sem fingerprint (ex.: contagem agregada no servidor de hospedagem) — decisão Q-09; enquanto não decidido, `site.json.analytics = null`.

**Mapa e consentimento:** fachada evita que o embed carregue antes do consentimento; ao clicar, o iframe do Google Maps é injetado (o carregamento do mapa é ação do usuário). Alternativa permanente: link "Abrir no Google Maps". CSP deve permitir `frame-src https://www.google.com` apenas onde há mapa.

---

## 9. Deploy e operação

- **Alvo:** hospedagem estática (Netlify, Cloudflare Pages, Vercel, S3+CloudFront ou equivalente nacional). Requisitos: HTTPS gerenciado, diretórios com `index.html`, 404 customizada, headers configuráveis, deploy por CLI/push.
- **Domínio:** `terradic.com.br` (ou o escolhido em Q-06), apex canônico com redirect 301 de `www`; HSTS após validação; um único host canônico em `urlBase`.
- **Headers:** `Cache-Control: public, max-age=31536000, immutable` para `/assets/*` com hash no nome; `no-cache` para HTML; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; CSP compatível (self + frame do Maps sob clique).
- **Ambientes:** `staging` (subdomínio, `noindex, follow`, dados em rascunho) e `produção`. Staging (`--base-url` de staging, sem `--rascunho`) grava em `dist-staging/`; `--rascunho` grava em `dist-rascunho/` com `noindex, nofollow`. `dist/` é exclusivo da produção e nunca é tocado por staging ou rascunho. `dist-staging/` e `dist-rascunho/` nunca são publicados; deploy de produção só a partir de `npm run build:go-live` verde (AD-12), nunca do `dist/` gerado por `npm run build`.
- **Preview opcional no GitHub Pages (não produtivo):** project page pública em `https://<owner>.github.io/<repo>/`, alimentada pelo workflow `pages-preview` a partir do build de rascunho (`--rascunho` + `--base-url` de preview), 17 páginas com dados fictícios, faixa "VERSÃO DE REVISÃO", `noindex` em todas as páginas e `robots.txt` com `Disallow: /`. O artifact é prefixado para `/<repo>` por `scripts/prefixar-base.mjs` e só sai de `dist-rascunho` (guard recusa `dist/`, página sem `noindex` e URL de produção). Serve para revisão de layout/conteúdo sem hospedagem própria; **não é staging, não é produção e não substitui T045a/T064** (T071). Pages não permite headers de resposta, então CSP, cache e cabeçalhos de segurança exigem host de produção próprio: a produção continua condicionada a um host que atenda T064, e o Pages não atende.
- **Rollback:** hospedagem mantém deploys anteriores; rollback = promover build anterior.
- **Monitoramento:** uptime externo simples + alerta de expiração de domínio/certificado. Sem RUM/analytics por padrão.
- **README:** comandos (`npm ci`, `npm run dev`, `npm run build`), como adicionar unidade/serviço/preparo, como rodar o checklist de publicação, o que fazer ao trocar telefone.

---

## 10. Testes e verificação

| Camada | O que | Como | Quando |
|---|---|---|---|
| Dados | Schema, refs, formatos, gate de publicação, NAP normalizado (texto visível × JSON-LD × canônico) | `node scripts/build.mjs --check` | Cada build/PR |
| Rodapé | NAP do rodapé em **todas** as páginas: endereço/telefone × matriz × contato institucional; ausência e divergência | `--check` + build negativo com matriz incompleta | Cada build/PR |
| Editorial | `bloco.status`: pendente oculto na produção, presente no relatório e bloqueante no go-live de página publicável; sem texto editorial em template (classificação FR-48/RN-12) | Teste negativo + revisão de template | PR |
| Gate de artefato | `slugsTeste` em HTML **e** `sitemap.xml`, `noindex` fora de ordem de atributo, auditoria do sitemap existente | Testes negativos no `--check` | PR |
| Publicação | `npm run build` nunca publicável; deploy só de `build:go-live`; staging em `dist-staging/` com `noindex, follow`; rascunho com `noindex, nofollow` | Inspeção do artefato + testes de diretório de saída e de `noindex` | Pré-go-live |
| Identidade | go-live aceita `status: "oficial"` **ou** `identidadeVisual.aceiteFormal` (`aceitoPor`, `data`, `documento`) | Teste negativo do gate de identidade | PR + go-live |
| Build | Determinismo no mesmo ano, exceção do ano do rodapé, falha em dado ausente e go-live estrito (inclui unidade sem serviço aprovado, RT incompleto, convênio sem `atualizadoEm`) | 2 builds + hash; teste negativo com pendência em `build` e `--go-live` | PR |
| Links | Links internos e externos, `tel:`, `rel` | `--check` no diretório de saída | PR |
| SEO | Metadados únicos, canonical, sitemap, JSON-LD | `--check` + Rich Results Test + Schema Validator | PR + antes do go-live |
| A11y | axe, teclado, leitor de tela | axe DevTools (5 páginas), tabulação completa, NVDA/VoiceOver spot check | Pré-go-live e a cada mudança de layout |
| Responsivo | 320/360/768/1024/1280/1440 | Inspeção manual + device toolbar | Pré-go-live |
| Performance | Lighthouse mobile | Lighthouse CI ou manual registrado | Pré-go-live |
| Conteúdo | Checklist CFM + revisão do RT | Checklist assinado (AC-20) | Antes do go-live |
| Conteúdo | Gate de placeholders | `--check` + leitura de `relatorios/pendencias.md` | Antes do go-live |
| Produção | Smoke test pós-deploy | Abrir rotas, CTA externo, mapa, 404, sitemap | Go-live |

Sem testes de UI/e2e nesta fase: a cobertura vive em `scripts/testes.mjs` (`npm test`, `node:test`, testes negativos de validador, gates, blocos, SEO e artefato) e no checklist de pré-go-live. Extrair novos testes de `lib/` com `node:test` à medida que o build crescer.

---

## 11. Áreas/arquivos provavelmente afetados

Projeto novo: tudo é criado. Áreas com maior chance de retrabalho:

1. `dados/unidades.json` — volume de campos nulos até a clínica responder (C-01..C-07).
2. `src/templates/unidade.html` + `scripts/lib/seo.mjs` — dependem do endereço (e de `geo`, quando confirmado) para o JSON-LD completo; sem `geo` o grafo continua válido (AC-13).
3. `src/css/estilo.css` + `tailwind.config.js` — paleta provisória do flyer aplicada agora; retrabalho garantido quando o brandbook/SVG oficial chegar (C-11, §1.2).
4. `dados/preparos.json` + `src/templates/preparo.html` — dependem do RT (C-09).
5. `dados/site.json` — domínio, RT e portal; mudanças afetam canonical, sitemap e todos os links.
6. `src/js/app.js` — pequeno, mas qualquer crescimento ameaça o orçamento de 10 KB.
7. `src/templates/parciais/footer.html` + `scripts/lib/checagens.mjs` — rodapé com fonte única na matriz, NAP do rodapé em todas as páginas e gate de artefato (AC-30/AC-34).
8. `scripts/lib/golive.mjs` + `dados/site.json.identidadeVisual.aceiteFormal` — gate de identidade da rodada 5; `scripts/lib/seo.mjs` e `scripts/lib/dados.mjs` — regra endurecida de `geo` (AC-13).

---

## 12. Riscos e mitigações

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R-01 | Publicar telefone/endereço errado (dados de exemplo do briefing) | Alta | Alto | `status` + gate de build + AC-15 + conferência por telefone com a clínica |
| R-02 | Unidade possivelmente inativa (Quixeramobim) no ar | Média | Alto | `status: a-confirmar` até confirmação; não publica |
| R-03 | Texto de preparo incorreto | Média | Alto (clínico) | Revisão obrigatória do RT, gate `revisao.status` |
| R-04 | Convênio desatualizado gerando reclamação | Alta | Médio | Ressalva + data de atualização + revisão trimestral sugerida |
| R-05 | Publicidade médica inadequada | Média | Alto (CFM) | Checklist RN-01 + revisão do RT + vocabulário controlado nos textos |
| R-06 | Cliente espera integração com o portal de exames | Média | Médio | Aviso de ambiente externo em todo CTA + escopo assinado |
| R-07 | Identidade visual atrasa o layout final | Alta | Médio | Direção provisória do flyer aplicada em tokens + logo placeholder (§1.2); troca de tokens depois, sem tocar em template |
| R-08 | Identidade provisória "vira oficial" por inércia e vai ao ar como se fosse a marca | Média | Médio | `identidadeVisual.status` no JSON, `aceiteFormal` (`aceitoPor`/`data`/`documento`), comentários no tema, nota no README e bloqueio no relatório de pendências (C-11/AC-28) |
| R-09 | Marca recriada a partir do flyer raster (logo distorcido, marca não oficial) | Média | Alto (jurídico) | Proibição explícita de vetorizar/redesenhar (§1.2); placeholder neutro até SVG oficial |
| R-10 | Copy promocional do flyer ("resultados precisos") reaproveitado no site | Média | Alto (CFM) | RN-01 + RN-11; checklist AC-20 e gate de vocabulário no `--check` |
| R-11 | DNS/domínio atrasa go-live | Média | Médio | Staging em subdomínio com `noindex`; go-live independente de código |
| R-12 | Conteúdo genérico gera páginas fracas (doorway) | Média | Médio | Exigir conteúdo único por unidade (FR-14) e revisão editorial |
| R-13 | Growth de JS/CSS estoura orçamento | Baixa | Baixo | Verificação de tamanho no `--check` |
| R-14 | Dados de saúde vazarem por URL/parâmetro | Baixa | Alto (LGPD) | Nenhum parâmetro de exame em URL; portal só como link; revisão final |
| R-15 | Dependência de CDN/fonte de terceiro reintroduzida | Baixa | Médio | `--check` falha se houver requisição externa no HTML e no CSS compilado (`@import`, `url(http…)`, `@font-face` externo) |
| R-16 | `dist/` do build de produção tolerante ser publicado por engano, com entidade excluída ou conteúdo pendente | Média | Alto | Deploy só a partir de `--go-live` verde (AD-12); staging com `noindex`; README e checklist de publicação explícitos |
| R-17 | Rodapé e páginas divergirem sobre o contato institucional (duas fontes, ou rodapé vazio enquanto a página diz exibir a matriz) | Média | Alto (NAP/credibilidade) | Fonte única no registro `matriz: true`; telefone institucional de `site.json` precisa ser idêntico; NAP do rodapé em todas as páginas; go-live exige o dado (AC-30) |
| R-18 | Gate de artefato frágil: depender da ordem dos atributos de `<meta>`, ignorar o `sitemap.xml` ou auditar só o que está em memória | Média | Alto (artefato de teste vaza) | NFR-12/AC-34: regex independente de ordem, varredura de `slugsTeste` em HTML e sitemap, auditoria do `dist/` já escrito |

---

## 13. Fora do escopo deste plano

Backend, CMS, área do paciente, integração com Mobilemed, agendamento, pagamento, e-mail, blog, i18n, PWA/service worker, analytics com cookie, gestão de GBP, tráfego pago, identidade visual (criação), fotografia, tradução de laudos, acessibilidade AAA, suporte a navegadores legados (IE).

---

## 14. Fases e rodadas de entrega

**Estado das rodadas:**

| Rodada | Escopo | Estado |
|---|---|---|
| 1 | F0–F3 (parcial): fundação, build, CSS base, layout global, unidades, serviços e preparo | concluída; permanecem parciais T010 (identidade oficial, depende de C-11) e T013 (rodapé sem RT/contato institucional, AC-21 pendente de C-03/C-08); T030 (revisão do RT) segue com o cliente |
| 2 | Correções do QA (spec/plan/tasks), renderizador de blocos editoriais (home inclusa), git (T001) e versão HTML da proposta | concluída — T001 fechada em 2026-11-20 (commits `d056e8a` e `393c73e`, árvore limpa); os gates do QA da rodada 2 foram incorporados ao spec/plano/tarefas |
| 3 | F4 (sobre, convênios, contato, política de privacidade) | concluída na estrutura — T033–T037a implementadas; conteúdo pendente mantém as páginas fora da produção e o go-live vermelho (esperado, não defeito); QA de fechamento na rodada 3.5 |
| 3.5 | QA de fechamento de F4/F5 (suite `R35-*`) | concluída — NAP número/cidade/UF, `noindex` em googlebot/bingbot/NOINDEX, telefone principal da matriz no rodapé, ressalva de convênios sem lista, textos editoriais fora de template e cálculo de C-10/C-12/C-11/C-14 no relatório; sem mudança de escopo |
| 4 | F5 (SEO completo) + F6 (acessibilidade/performance) | F5 concluída (T038–T043, T045a); F6 parcial — T049/T050/T052 fechadas no estado atual; **axe não executado** (T046), revisão de teclado/leitor de tela não executada (T047), revisão responsiva manual não executada (T048) e **Lighthouse não executado** (T051) — ficam para o pré-go-live, quando houver navegador/ferramenta; T045a é a marcação de staging, o deploy real depende de Q-07/T064 |
| 5 | Fechamento dos gates de publicação (AD-13) + migração editorial para `paginas.json` | implementada e coberta por testes `R5-*` (`scripts/testes.mjs`): deploy só de `build:go-live` verde, `npm run build` nunca publicável, `dist-staging/` com `noindex, follow`, `geo` endurecido (`exata` + fonte), bloco pendente inacessível por `id`, identidade com `aceiteFormal` (`aceitoPor`/`data`/`documento`), C-02/C-12; inclui a entrada `paginas.unidade` e o bloco `home.cta-aviso`, com dois templates novos; não muda o estado de F6 (auditorias externas seguem pendentes) e não há registro de aprovação de QA da rodada nos artefatos |
| Pós-cliente | F7 (conteúdo final e aceite do RT) e F8 (go-live) | dependente do cliente |

**Fases:**

| Fase | Entrega | Rodada | Depende de cliente? |
|---|---|---|---|
| F0 | Repositório, estrutura, validador, build (três modos), CSS base, deploy de staging | 1 | Não |
| F1 | Layout global (header/footer/CTA), tokens, home estrutural | 1 | Não (visual final depois) |
| F2 | Unidades: JSON, índice, página por unidade, mapa-fachada | 1 | Parcial (dados reais) |
| F3 | Serviços + preparo com acordeões | 1 (parcial) | Parcial (textos/RT) |
| F4 | Convênios, sobre/RT, contato, política de privacidade — estrutura entregue | 3 | Parcial (conteúdo/RT) |
| F5 | SEO técnico completo (JSON-LD, sitemap, OG, metadados) — entregue; T044 (RT/`geo`) segue com o cliente | 4 | Parcial (RT; `geo` é opcional — AC-13) |
| F6 | A11y, performance, revisão responsiva — parcial; axe, Lighthouse, teclado/leitor de tela e revisão responsiva manual **não executados**, ficam para o pré-go-live | 4 (parcial) | Não |
| F7 | Conteúdo final, checklist CFM, aceite do RT | Pós-cliente | Sim (bloqueante) |
| F8 | Go-live: domínio, headers, Search Console, smoke test — deploy só de `npm run build:go-live` verde | Pós-cliente | Sim |

**Rastreabilidade fase interna → rodada → marco da proposta do cliente** (`proposta-tecnica.md §7`; os nomes de rodada e de fase são internos e não aparecem no documento do cliente):

| Fase | Rodada | Marco do cliente |
|---|---|---|
| F0 | 1 | 1 — Fundação |
| F1 | 1 | 1 — Fundação (a 404 de F1 antecipa parte do marco 3) |
| F2 | 1 (estrutura) / fechamento com o cliente (dados reais) | 2 — Unidades e exames |
| F3 | 1 (estrutura) / futuro (preparo revisado com o RT) | 2 — Unidades e exames (serviços) e 6 — Conteúdo final |
| F4 | 3 | 3 — Institucional e convênios |
| F5 | 4 (Search Console em F8) | 4 — Busca e dados estruturados |
| F6 | 4 (parcial) | 5 — Qualidade |
| F7 | Futuro (pós-cliente) | 6 — Conteúdo final e aprovação |
| F8 | Futuro (pós-cliente) | 7 — Publicação |

A rodada 2 não entregou fase nova: corrigiu pendências de QA dos artefatos, concluiu o renderizador de blocos editoriais, versionou o repositório (T001) e produziu a versão HTML da proposta. A rodada 3 entregou a estrutura de F4 (T033–T037a); enquanto o conteúdo da clínica não chegar, as páginas de F4 permanecem fora da produção (ou com blocos pendentes omitidos). A rodada 3.5 fechou o QA de F4/F5 (`R35-*`) sem mudar escopo. A rodada 4 concluiu F5 (T038–T043, T045a) e avançou F6: orçamento de JS/CSS no `--check` (T050) e degradação sem JS (T052) verificados; T049 está N/A no estado atual, sem fotos até C-11/T024. A rodada 5 endureceu os gates (AD-13): build de revisão nunca publicável, staging separado com `noindex, follow`, `geo` só com `exata` + fonte, bloco pendente inacessível por `id`, identidade aceita `aceiteFormal` com `aceitoPor`/`data`/`documento`, e pendência apenas de `geo` deixa de bloquear. A mesma rodada migrou textos editoriais para `paginas.json` (nova entrada `paginas.unidade` e bloco `home.cta-aviso`), com dois templates novos. A auditoria axe, a revisão de teclado/leitor de tela, o responsivo 320–1440 e o Lighthouse **não foram executados** porque exigem navegador/ferramenta e ficam para o pré-go-live. O deploy de staging real depende de Q-07/T064, e o go-live continua vermelho por dependência de conteúdo e aceite (F7) — comportamento esperado do gate, não regressão.

---

## 15. Questões abertas (para o coordenador decidir com a clínica)

| # | Questão | Por que importa | Default se não houver resposta |
|---|---|---|---|
| Q-01 | Quais unidades estão operando hoje? Quixeramobim está ativa? | Publicar unidade fechada é erro grave | Só Canindé publica até confirmação |
| Q-02 | Endereço/CEP oficiais de cada unidade; há coordenada confirmada (`geo`) e qual a fonte? | JSON-LD, mapa, NAP | Não publica a unidade sem endereço/CEP; `geo` ausente, aproximado ou sem fonte **não** bloqueia o go-live (AC-13), mas entra no relatório de pendências |
| Q-03 | Telefones oficiais (e WhatsApp é oficial?) | Contato e NAP | Não publica telefone não confirmado; unidade fica sem página? → ver Q-10 | 
| Q-04 | Serviço sem unidade ativa (ex.: consultas) publica com aviso ou não publica? | Evita frustração do paciente e página vazia | Não publica |
| Q-05 | RT é único para a rede ou por unidade? | Rodapé e conformidade | RT único no site + rodapé |
| Q-06 | Domínio definitivo: `terradic.com.br`? Com ou sem `www`? | Canonical, sitemap, DNS | Apex, sem `www`, 301 do `www` |
| Q-07 | Qual hospedagem estática será usada? | Headers, 404, deploy | Netlify/Cloudflare Pages |
| Q-08 | Prazo de laudo pode ser divulgado? Qual? | Expectativa do paciente e risco de promessa | Não divulgar |
| Q-09 | Haverá alguma medição de audiência? | LGPD/cookies | Nenhuma medição na v1 |
| Q-10 | Se uma unidade não tiver todos os dados, publicamos página parcial (sem telefone/mapa) ou ficamos fora? | Escopo do go-live | Fora do go-live até completar |
| Q-11 | Política de privacidade/aviso legal: página própria ou bloco no rodapé? | LGPD e credibilidade | Página curta, se texto aprovado |
| Q-12 | Logos de convênios: há autorização de uso? | Marca de terceiros | Somente nomes em texto |
| Q-13 | Fotos reais das unidades e autorização de imagem de pessoas? | RN-08 | Sem fotos; layout com blocos gráficos neutros |
| Q-14 | Preços de particular serão divulgados? | Regras de publicidade e concorrência | Não divulgar; "consulte a unidade" |
| Q-15 | Existe brandbook, SVG do logo e licença da fonte caligráfica? A paleta do flyer corresponde à marca? | Encerra a fase "identidade provisória" (§1.2) | Mantém tokens provisórios e logo placeholder; não publica |
| Q-16 | A clínica autoriza o uso da fonte caligráfica do flyer e de fotografias de profissionais? | Licenciamento e uso de imagem | Sem caligráfica; sem fotos de pessoas |
