# Plano técnico — Kit de coleta de dados da clínica

**Feature:** `002-kit-coleta-dados`
**Base:** `spec.md` (implementada em parte; reteste do QA pendente)
**Natureza:** feature de operação interna sobre o repositório existente. Não há `.specify/`; os artefatos são manuais, como na 001.
**Regra:** este plano registra as decisões técnicas. A implementação ocorreu em parte (T002–T025 e T027); a revisão de 2026-11-23 reconcilia a idempotência (AD-15) e registra o risco aceito do preview (AD-16). Nenhum gate, schema ou template do site é alterado.
**Atualização 2026-11-23:** o reteste do QA expôs a contradição entre FR-32 e a proteção de kit antigo. As decisões de reconciliação estão em AD-15 e o risco aceito do preview em AD-16.
**Atualização 2026-11-23 (reteste):** o reteste apontou uma consequência de AD-15: com `site.atualizadoEm` só mudando por edição manual, a proteção contra kit antigo depende dessa manutenção. O alcance real está registrado em AD-15.1 e o R-14 foi ajustado. Nenhuma decisão de escopo mudou.

---

## 1. Stack e decisões fechadas

| Item | Decisão |
|---|---|
| Runtime | Node `>=24.11.0` (`.nvmrc`), módulos nativos apenas |
| Dependências | Nenhuma nova; sem parser de CSV, sem biblioteca de planilha, sem gerador de HTML |
| Linguagem | JavaScript ESM (`.mjs`), padrão do repositório |
| Rede | Nenhum acesso; geração e importação 100% locais |
| Entrada | `dados/*.json` + `dados/exemplos-briefing.json` + funções de `dados.mjs`, `relatorio.mjs`, `render.mjs` |
| Saída do kit | `relatorios/coleta/` (já ignorado no Git) |
| Destino da importação | `dados/*.json` (somente após validação integral) |
| Formato | CSV UTF-8 com BOM, `;`, CRLF, RFC 4180, decimal com vírgula |
| Versão do modelo | `coleta-1` |
| Testes | `node:test`, arquivo dedicado `scripts/testes-coleta.mjs`, sem escrever em `dados/` real |
| Publicação | Inalterada: `npm run build:go-live` continua sendo o único gate |

### 1.1 Registro de decisões (ADRs resumidos)

- **AD-01 — Kit como CLI Node, sem dependência.** O repositório já tem build próprio e recusa dependência nova. CSV é pequeno o bastante para um parser/serializador de ~150 linhas, testável e sem risco de licença. *Rejeitado:* `csv-parse`, `papaparse`, `exceljs`, `xlsx` (dependência, peso e/ou formato binário).
- **AD-02 — Saída em `relatorios/coleta/`.** O diretório `relatorios/` já é ignorado. O kit contém dados não confirmados e CRM; versionar seria risco de LGPD e de "pré-preenchimento virar verdade". O coordenador compacta e envia por canal controlado.
- **AD-03 — Vários CSVs, não um arquivo com blocos.** Um CSV por entidade (`unidades`, `site`, `convenios`, `preparos`, `textos`) mantém cabeçalho fixo, uma linha por registro e validação simples. Um único arquivo com seções heterogêneas quebra o Excel e a checagem de colunas. *Rejeitado:* arquivo único com `tipo_registro` misturando larguras; XLSX com múltiplas abas.
- **AD-04 — UTF-8 com BOM, `;`, CRLF, decimal com vírgula.** É o formato que o Excel em português abre sem assistente e sem mojibake. O importador aceita LF e BOM ausente, mas o gerador sempre emite o formato canônico.
- **AD-05 — Prefixo `A CONFIRMAR: ` para pré-preenchimento.** É detectável por máquina e por humano, sobrevive ao Excel e não depende de coluna extra por campo. Célula com o prefixo nunca é importada; a clínica remove o prefixo e altera/confirma o valor.
- **AD-06 — Bloco de confirmação de quatro campos por linha.** `confirmado_por`, `como_confirmou`, `fonte` e `data_confirmacao`. Um "ok" não passa. O canal é enumerado para evitar texto vazio; a fonte é livre para acomodar e-mail, ata, protocolo ou arquivo.
- **AD-07 — Importar pendente; promover é ato humano.** O importador grava rastreabilidade, mas nunca `ativo`, `confirmado`, `aprovado` ou `oficial`. A promoção continua sendo o fluxo já documentado no README e é protegida pelo `build:go-live`. *Rejeitado:* importador que "confirma" a unidade quando o bloco está preenchido (transformaria confirmação declarada em publicação).
- **AD-08 — Tudo ou nada e determinístico.** O importador monta um clone, valida o conjunto e só então grava. Sem `Date.now()`, `Math.random()` ou timestamp no conteúdo. As datas por entidade recebem a maior data entre a existente e a `data_confirmacao` importada para aquela entidade; `site.atualizadoEm` é base de geração e não é escrito pelo importador (AD-15). Duas execuções com a mesma entrada produzem os mesmos bytes.
- **AD-09 — Reutilizar o validador, não duplicar regra.** O importador chama `validarDados` de `scripts/lib/dados.mjs` sobre o candidato. Regras próprias da coleta (arquivo, coluna, versão, confirmação, imutabilidade) ficam em `scripts/lib/coleta.mjs` e são testadas separadamente. Nenhuma regra de publicação é reescrita.
- **AD-10 — Vigência de convênio como texto + data do catálogo.** O schema atual não tem vigência por convênio. O CSV coleta `vigencia_inicio`/`vigencia_fim`; o importador registra em `convenios[].aviso` e usa a maior data entre a existente e a confirmação importada como `atualizadoEm` do catálogo. Exibir vigência por operadora no site exigiria mudança de template/schema (fora do escopo; Q-01).
- **AD-11 — Convênio novo é permitido; unidade e preparo novos não.** O catálogo de convênios está vazio e a planilha é a via natural de cadastro. Unidade e preparo têm slug, rota e revisão clínica; criar por planilha geraria publicação sem revisão. Slug desconhecido nesses arquivos é erro.
- **AD-12 — Testes em arquivo próprio.** `scripts/testes.mjs` já é grande e cobre a 001. A coleta entra em `scripts/testes-coleta.mjs`, e `npm test` passa a rodar os dois com `node --test scripts/testes.mjs scripts/testes-coleta.mjs`. Sem framework novo.
- **AD-13 — `--sobrescrever` explícito.** Campo já confirmado não é alterado por acidente. A flag é opt-in, rebaixa a entidade para pendente quando aplicável, lista cada sobrescrita e não permite mudar campo imutável (`slug`, `id`, `matriz`, `servico_id`, localizador de bloco).
- **AD-14 — HTML autocontido.** O questionário não usa template do site nem `src/templates`; é gerado por `scripts/lib/coleta-html.mjs` com `escapar` de `render.mjs`. Sem requisição externa, sem `<form>`, sem JS; impressão A4.
- **AD-15 — `site.atualizadoEm` é base de geração, não data de conteúdo importado.** `dados/site.json:atualizadoEm` não é escrito pelo importador; ele representa a data-base do conjunto, é lido para `base_dados_em` do kit e só muda por edição manual deliberada. As datas derivadas de confirmação ficam nas entidades: `unidades[].atualizadoEm`, `unidades[].validacao.data`, `convenios.atualizadoEm`, `preparos[].revisao.data` e `paginas.atualizadoEm` (catálogo de páginas, quando o bloco editorial da página é importado), cada uma com a **maior** data entre a existente e a maior confirmação efetivamente importada para a entidade (`max`). *Motivo:* o QA mostrou que elevar `site.atualizadoEm` na primeira importação fazia a segunda execução do mesmo kit cair na proteção de kit antigo (base do kit anterior à base atual). Com a base fixa, o mesmo kit é idempotente (AC-16) e a proteção continua comparando a base do kit com `site.atualizadoEm`. *Rejeitado:* mover a proteção para outra data ou dispensar `--sobrescrever` — afrouxaria a proteção de kit antigo.
- **AD-15.1 — Alcance real da proteção de kit antigo (consequência de AD-15).** Como `site.atualizadoEm` é base de geração e só muda por edição manual deliberada, a comparação entre `base_dados_em` do kit e `site.atualizadoEm` só acusa kit antigo **depois** que essa base for atualizada à mão. Um kit gerado antes de uma importação continua tendo a mesma base do repositório mesmo após importações. A proteção existe, mas **depende de manutenção manual da base**; o risco R-14 fica **mais estreito, não eliminado**. A proteção principal contra sobrescrita passa a ser o conjunto: (a) a regra de entidade confirmada — campo confirmado não é alterado sem sinalização; (b) `--sobrescrever` explícito, que lista cada sobrescrita e rebaixa a entidade quando aplicável; e (c) a regra de maior data por entidade (`max(existente, confirmação importada)`), que impede regressão de data e alcança também `paginas.atualizadoEm` quando o bloco editorial da página é importado. *Consequência operacional:* atualizar `site.atualizadoEm` é ato consciente do coordenador quando o conjunto muda, não efeito da importação. *Rejeitado:* elevar a base na importação (quebraria AC-16) ou dispensar a comparação de base (perderia até essa proteção parcial, sem ganho).
- **AD-16 — Preview público com rascunho: risco aceito.** O usuário aceitou conscientemente que o preview no GitHub Pages publique o build de rascunho e, após uma importação real, inclua entidades pendentes de `dados/*.json`. Não há mudança de workflow, build, template, `noindex` ou schema nesta feature; o preview continua não produtivo e não substitui staging/produção. A mitigação é operacional: importar quando a exposição for aceitável e nunca tratar o preview como publicação aprovada. *Rejeitado:* bloquear o preview ou publicar só conteúdo aprovado (mudança de workflow fora do escopo desta feature).

---

## 2. Arquitetura da feature

```
dados/*.json ─┐
dados/exemplos-briefing.json ─┤
                              ├─> carregarDados / carregarExemplosBriefing
                              ├─> validarDados (falha se estrutura inválida)
                              ├─> resolverPublicacao + gerarRelatorio (pendências reais)
                              └─> montarModeloColeta
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
          serializarCsv (5 arquivos)             renderizarQuestionario
                    │                                       │
                    └──────────────> relatorios/coleta/ <────┘
                                             │
                                    clínica preenche
                                             │
                                    lerCsv + validarKit
                                             │
                              clone de dados/*.json (candidato)
                                             │
                         validarDados(candidato, { exemplos })
                                             │
                       erros? ──sim──> log + exit 1 (nada gravado)
                          │ não
                          ▼
                  gravar dados/*.json + log
                          │
                  revisão humana + promoção manual
                          │
                  npm run build / check / build:go-live
```

**Princípio:** o kit é uma projeção dos dados e das pendências, não um cadastro paralelo. A importação é uma escrita única, validada e reversível por Git.

---

## 3. Estrutura de arquivos

### 3.1 Criados

```
scripts/
├─ coleta.mjs                    # CLI do gerador (npm run coleta)
├─ importar-coleta.mjs           # CLI do importador (npm run importar:coleta)
├─ testes-coleta.mjs             # suite node:test da feature
└─ lib/
   ├─ csv.mjs                    # parse/serialize CSV RFC 4180 com ';'
   ├─ coleta.mjs                 # modelo, cabeçalhos, mapeamento, validação, aplicação
   └─ coleta-html.mjs            # questionário imprimível

relatorios/coleta/               # gerado; ignorado no Git
├─ questionario.html
├─ LEIA-ME.txt
├─ unidades.csv
├─ site.csv
├─ convenios.csv
├─ preparos.csv
├─ textos.csv
├─ importacao.md                 # gerado pelo importador
└─ importacao.json               # gerado pelo importador
```

### 3.2 Alterados

| Arquivo | Alteração |
|---|---|
| `package.json` | Scripts `coleta`, `importar:coleta`; `test` passa a incluir `scripts/testes-coleta.mjs` |
| `README.md` | Seção "Kit de coleta de dados": comandos, fluxo, o que é importado e o que é promoção manual |
| `dados/*.json` | Escrita em runtime pelo importador; nenhum schema novo |
| `dados/exemplos-briefing.json` | Remoção manual e deliberada de exemplo confirmado, documentada no log; o importador não altera |

### 3.3 Não alterados

`scripts/build.mjs`, `scripts/lib/dados.mjs`, `scripts/lib/golive.mjs`, `scripts/lib/relatorio.mjs`, `scripts/lib/checagens.mjs`, `src/templates/*`, `src/css/*`, `src/js/*`, `tailwind.config.js`, `.gitignore` (a saída já está coberta por `relatorios/`), `CONTEUDO-PENDENTE.md`, `docs/`.

---

## 4. Formato do kit

### 4.1 `LEIA-ME.txt`

Texto simples em UTF-8 com BOM, sem Markdown obrigatório, com:

1. O que é o kit e quem preenche o quê.
2. Como abrir no Excel sem quebrar acentos, telefones e CEP (formatar colunas de telefone/CEP como Texto; não remover o `+`; salvar como CSV mantendo o separador `;`; se o Excel só oferecer "CSV UTF-8 (delimitado por vírgula)", conferir a configuração regional do Windows com separador de listas `;` ou usar "CSV (delimitado por ponto e vírgula)" quando existir; não salvar como XLSX).
3. O que significam `A CONFIRMAR: `, `NAO_TEMOS` e `NAO_SABEMOS`.
4. Como preencher o bloco de confirmação (nome/função, canal, fonte, data).
5. Aviso de LGPD: não incluir dado de paciente.
6. Como devolver a pasta e o que acontece depois (importação, revisão, promoção).
7. Versão do modelo e data-base.

### 4.2 `questionario.html`

- Capa: título, versão, data-base, destinatário, como devolver.
- Resumo C-01..C-15: dependência, responsável, situação, onde responder, bloqueia go-live.
- Aviso de LGPD e de que o HTML é para reunião; o preenchimento oficial é no CSV.
- Por unidade: dados já conhecidos (marcados "a confirmar" ou "já confirmado"), perguntas por C-xx, exemplos de formato e caixas "não temos / não sabemos".
- Anexo de telefones do levantamento sem unidade definida.
- Seções: site/RT/contato/redes; convênios e vigência; preparos e revisão do RT; textos editoriais; identidade/fotos; domínio/DNS; privacidade.
- Folha de assinatura e checklist de devolução.
- CSS de impressão: A4, `@page`, `page-break-before` por unidade, tabelas sem cor como única informação, fonte de sistema, contraste AA.
- Sem `<form>`, `<input>`, `<script>`, `iframe`, `@import`, `url(http...)`, imagem ou link externo. `meta robots noindex`.

### 4.3 Conteúdo derivado das pendências

- `gerarRelatorio({ dados, publicacao })` fornece `bloqueios` (C-01..C-15, `pendente`, `bloqueia`) e `blocosPendentes`.
- `MAPA_DEPENDENCIAS` (constante em `scripts/lib/coleta.mjs`) liga cada C-xx a seções do HTML e arquivos/campos do CSV.
- Se um `bloqueio.pendente` não tiver mapeamento, `npm run coleta` falha com `coleta:mapeamento:C-xx` em vez de gerar um questionário incompleto.
- O texto de cada dependência vem do relatório; não há segunda lista de C-xx no código além do mapa de seções.

---

## 5. Formato exato dos CSVs

### 5.1 Convenções comuns

| Item | Regra |
|---|---|
| Encoding | UTF-8 com BOM (`EF BB BF`) na primeira posição |
| Separador | `;` (ponto e vírgula) |
| Quebra de linha | CRLF (`\r\n`) no arquivo gerado; o importador aceita LF |
| Aspas | RFC 4180: aspas duplas quando o valor contiver `;`, `"`, CR ou LF; `"` interno vira `""` |
| Decimal | Vírgula nos campos `geo_lat`/`geo_lng` (ex.: `-3,7319`); o importador aceita ponto |
| Datas de preenchimento | `DD/MM/AAAA`; o importador aceita `AAAA-MM-DD` e normaliza para ISO |
| `base_dados_em` | `AAAA-MM-DD` (metadado, não data de usuário) |
| Booleanos | `sim` / `nao` (maiúsculas/minúsculas aceitas; normalizadas) |
| Listas | `|` entre itens (ex.: `tomografia|mamografia`) |
| Horários | `dias:HH:MM-HH:MM[:observacao]`, faixas separadas por `|`; dias separados por `,` |
| Ausência explícita | `NAO_TEMOS` grava ausência; `NAO_SABEMOS` registra desconhecimento e preserva o valor existente, sem inventar valor |
| Pré-preenchimento | Prefixo `A CONFIRMAR: `; nunca importado |
| Versão | `coleta-1` em todas as linhas |
| Tipo | `unidade`, `site`, `convenio`, `preparo`, `texto` |

**Booleanos e tokens:** em campo booleano, `NAO_TEMOS` equivale a `nao` (ex.: não temos estacionamento, não exibimos logo); `NAO_SABEMOS` preserva o valor existente (ou deixa `null` se não houver) e registra a pendência; não limpa. Em campo imutável (`matriz`, `principal`), token é erro.

**Tokens em campo obrigatório:** `NAO_TEMOS`/`NAO_SABEMOS` só valem para campo opcional. Em `slug`, `id`, `nome_exibicao`, `cidade`, `uf`, `servico_id`, `bloco`, `tipo_bloco` e `texto` de bloco que não seja `lista`, o token é erro de campo obrigatório; para adiar um texto, deixe a célula vazia (preserva o conteúdo atual e o bloco continua pendente).

**Horários:** a parte antes do primeiro `:` são os dias; entre o primeiro e o segundo `:`, o intervalo `HH:MM-HH:MM`; o restante, se houver, é a observação (pode conter `:`, não pode conter `|`). Exemplo: `seg,ter,qua,qui,sex:08:00-18:00:Atendimento por ordem de chegada|sab:08:00-12:00`.

**Injeção de fórmula:** célula que começa com `=` ou `@`, ou com `+` fora de campo de telefone, é recusada. O gerador não emite esses caracteres no início de texto; o importador valida de novo.

### 5.2 `unidades.csv` — uma linha por unidade

Cabeçalho exato, nesta ordem (a ordem pode variar no retorno; o importador mapeia por nome):

```text
modelo_versao;base_dados_em;tipo_registro;slug;id;nome_exibicao;cidade;uf;cnpj_filial;matriz;endereco_logradouro;endereco_numero;endereco_complemento;endereco_bairro;endereco_cep;endereco_referencia;geo_lat;geo_lng;geo_precisao;telefone_1_rotulo;telefone_1_e164;telefone_1_tipo;telefone_1_principal;telefone_2_rotulo;telefone_2_e164;telefone_2_tipo;telefone_2_principal;telefone_3_rotulo;telefone_3_e164;telefone_3_tipo;telefone_3_principal;whatsapp_e164;email;horarios;servicos;convenios;atendimento_particular;comodidades_estacionamento;comodidades_acessivel;observacoes_publicas;redes_instagram;redes_facebook;confirmacao;confirmado_por;como_confirmou;fonte;data_confirmacao;observacoes_coleta
```

Mapeamento para `dados/unidades.json`:

| Coluna | Destino | Regra |
|---|---|---|
| `slug` | `unidades[].slug` | Chave; imutável; precisa existir |
| `id` | `unidades[].id` | Imutável; precisa ser igual ao atual |
| `nome_exibicao` | `nomeExibicao` | Texto |
| `cidade` / `uf` | `cidade` / `uf` | Texto; `uf` 2 letras |
| `cnpj_filial` | `cnpjFilial` | CNPJ formatado ou `NAO_TEMOS` |
| `matriz` | `matriz` | Imutável; `sim`/`nao` |
| `endereco_*` | `endereco.*` | CEP normalizado para 8 dígitos |
| `geo_*` | `geo.*` | Lat/lng juntas ou ambas vazias; `precisao` `exata`/`aproximada` |
| `telefone_N_*` | `telefones[]` | Até 3 slots; `validado` derivado da confirmação; `principal` no máximo um |
| `whatsapp_e164` | `whatsapp.e164` | `validado` derivado da confirmação |
| `email` | `email` | Formato básico ou `NAO_TEMOS` |
| `horarios` | `horarios[]` | Mini-formato da §5.1 |
| `servicos` | `servicos[]` | IDs de `servicos.json`; `NAO_TEMOS` = lista vazia |
| `convenios` | `convenios[]` | IDs de `convenios.json`; `NAO_TEMOS` = lista vazia |
| `atendimento_particular` | `atendimentoParticular` | `sim`/`nao`/`NAO_SABEMOS` |
| `comodidades_*` | `comodidades.*` | `sim`/`nao`/`NAO_SABEMOS` |
| `observacoes_publicas` | `observacoesPublicas` | Texto público |
| `redes_*` | `redesSociais.*` | URL ou `NAO_TEMOS` |
| bloco de confirmação | `validacao.confirmadoPor/.data/.fontes` | `status` e `validacao.status` não mudam |
| `observacoes_coleta` | — | Só log; não vai ao JSON |

**Slots de telefone:** um slot só existe se algum campo dele estiver preenchido. Slot com rótulo/tipo/principal e sem `e164` é erro; slot inteiro vazio ou com `NAO_TEMOS` no `e164` é ignorado/limpo. `tipo` é `fixo` ou `movel` quando há `e164`; `principal` no máximo um. `whatsapp_e164` segue a mesma regra.

**Fora do CSV:** `fotos`, `responsavelTecnico` por unidade, `status`, `validacao.status`. Fotos dependem de arquivo/autorização (C-11); RT por unidade continua fluxo manual (Q-05 da 001). Formas de pagamento e documentos por unidade também não têm campo no schema: o questionário coleta e o texto geral da página de convênios pode registrar (C-07); não se inventa coluna.

### 5.3 `site.csv` — uma linha

```text
modelo_versao;base_dados_em;tipo_registro;rt_nome;rt_crm;rt_crm_uf;rt_especialidade;email_institucional;telefone_institucional_e164;instagram;facebook;confirmacao;confirmado_por;como_confirmou;fonte;data_confirmacao;observacoes_coleta
```

| Coluna | Destino | Regra |
|---|---|---|
| `rt_*` | `site.responsavelTecnico.*` | `status` sempre `pendente`; `rt_crm_uf` com 2 letras |
| `email_institucional` | `site.contatoInstitucional.email` | E-mail ou `NAO_TEMOS` |
| `telefone_institucional_e164` | `site.contatoInstitucional.telefoneE164` | E.164; se a matriz tiver principal, precisa ser igual |
| `instagram` / `facebook` | `site.redesSociais.*` | URL ou `NAO_TEMOS` |
| bloco de confirmação | — | Obrigatório se qualquer campo for submetido |

`urlBase`, identidade visual, privacidade e analytics não entram no CSV. Domínio/DNS e identidade são perguntas do questionário; privacidade é texto em `textos.csv`.

### 5.4 `convenios.csv` — uma linha por convênio

```text
modelo_versao;base_dados_em;tipo_registro;id;nome;tipo_convenio;exibir_logo;logo_autorizado;aviso;vigencia_inicio;vigencia_fim;unidades;confirmacao;confirmado_por;como_confirmou;fonte;data_confirmacao;observacoes_coleta
```

| Coluna | Destino | Regra |
|---|---|---|
| `id` | `convenios[].id` | Slug `[a-z0-9-]`; novo permitido; duplicado recusado |
| `nome` | `convenios[].nome` | Texto |
| `tipo_convenio` | `convenios[].tipo` | Texto livre (sugestão: `medicina-de-grupo`, `seguradora`, `odonto`, `outro`) |
| `exibir_logo` / `logo_autorizado` | `exibirLogo` / `logoAutorizado` | `sim`/`nao`; `exibir_logo=sim` exige `logo_autorizado=sim` |
| `aviso` | `convenios[].aviso` | Texto; vazio recebe o padrão "Cobertura sujeita a confirmação junto à operadora e à unidade." |
| `vigencia_inicio` / `vigencia_fim` | `aviso` | Datas; anexadas ao final de `aviso` como "Vigência informada: ..." (sem campo novo e sem apagar o aviso existente) |
| `unidades` | `unidades[].convenios[]` | Slugs separados por `|`; união com o lado da unidade |
| bloco de confirmação | `convenios.atualizadoEm` | Maior data de confirmação |

**Conflito de lista:** se a unidade trouxer `convenios=NAO_TEMOS` e `convenios.csv.unidades` citar essa unidade, o importador falha com conflito explícito. Se a unidade estiver vazia/sentinela, a lista do convênio vale. Se ambos listarem, é união.

### 5.5 `preparos.csv` — uma linha por preparo

```text
modelo_versao;base_dados_em;tipo_registro;id;slug;exame;servico_id;resumo;jejum;hidratacao;medicamentos;documentos;vestimenta;duracao;observacoes;alerta;registro_profissional;confirmacao;confirmado_por;como_confirmou;fonte;data_confirmacao;observacoes_coleta
```

| Coluna | Destino | Regra |
|---|---|---|
| `id` / `slug` / `servico_id` | `preparos[]` | Imutáveis; precisam existir |
| `exame` | `exame` | Texto; imutável na prática (referência) |
| textos | `resumo`, `jejum`, `hidratacao`, `medicamentos`, `vestimenta`, `duracao`, `alerta` | Texto; vazio preserva |
| `documentos` / `observacoes` | listas | `|`; `NAO_TEMOS` = lista vazia |
| `registro_profissional` | `revisao.crm` | CRM/UF do RT que revisou |
| `confirmado_por` | `revisao.responsavel` | Nome do RT |
| `data_confirmacao` | `revisao.data` | ISO |
| `fonte` / `como_confirmou` | — | Só log (preparo não tem `fontes`) |
| `revisao.status` | — | Sempre `pendente`; sem coluna de status |

### 5.6 `textos.csv` — uma linha por bloco pendente

```text
modelo_versao;base_dados_em;tipo_registro;pagina;bloco;tipo_bloco;texto;itens;confirmacao;confirmado_por;como_confirmou;fonte;data_confirmacao;observacoes_coleta
```

| Coluna | Destino | Regra |
|---|---|---|
| `pagina` | chave de `paginas.paginas` | `sobre`, `convenios`, `contato`, `privacidade` e outras com bloco pendente |
| `bloco` | `paginas.paginas[pagina].blocos[]` | `id` quando existir; senão `#indice` |
| `tipo_bloco` | `blocos[].tipo` | Imutável; precisa bater com o bloco atual |
| `texto` | `blocos[].texto` | Texto; vazio preserva |
| `itens` | `blocos[].itens` | `|`; obrigatório para `lista` |
| `blocos[].status` | — | Sempre `pendente` |

O gerador só emite linhas para blocos com `status: "pendente"` (do relatório). Bloco já aprovado não é reaberto; se a clínica quiser corrigir, é fluxo manual com `--sobrescrever` e rebaixamento explícito. O importador **não insere bloco novo**: se o texto exigir mais seções do que os blocos pendentes existentes, o coordenador cria os blocos manualmente em `paginas.json` e gera o kit de novo. Isso mantém a ordem editorial sob revisão humana e evita conteúdo extra entrando por planilha.

---

## 6. Pré-preenchimento, sentinela e confirmação

### 6.1 O que é pré-preenchido

| Origem | Uso | Marca |
|---|---|---|
| `dados/unidades.json` campos não nulos e ainda não confirmados | `nome_exibicao`, `cidade`, `uf`, `cnpj_filial`, e-mail/redes já presentes | `A CONFIRMAR: <valor>` |
| `dados/site.json` campos não nulos e RT `pendente` | contato/redes/RT já presentes | `A CONFIRMAR: <valor>` |
| Identidade estrutural | `slug`, `id`, `matriz`, `servico_id`, localizador de bloco, versão, data-base | Sem marca; somente leitura |
| Campos vazios | Endereço, telefone, horário, convênio, preparo, texto | Vazio |
| Campos já confirmados | Entidade `confirmado`/`aprovado` | Vazio no CSV; mostrado no HTML como "já confirmado" |
| `dados/exemplos-briefing.json` | Telefones sem unidade | Anexo do HTML, `A CONFIRMAR: <valor original>` |
| `dados/exemplos-briefing.json.enderecos` | Hoje vazio | Nada a pré-preencher; o HTML informa que não havia endereço |
| `dados-teste/` | Nunca | Fora do kit |

**Regra:** um valor confirmado não é reemitido para reconfirmação. A planilha é para o que falta; o HTML mostra o que já está fechado para contexto.

### 6.2 Por que a sentinela combina com a trava existente

A trava atual (`validarTelefone`) recusa qualquer `e164` idêntico a `dados/exemplos-briefing.json`, mesmo que a clínica confirme. O kit não a contorna:

1. Telefone do levantamento só aparece no anexo do HTML, não na linha da unidade.
2. Se a clínica informar um número novo, ele passa normalmente.
3. Se a clínica confirmar exatamente um número do levantamento, o importador chama `validarDados` e o erro `unidades.json:telefones[n].e164:<slug>` aparece com o detalhe "exemplo do levantamento".
4. Para liberar, o coordenador remove **manualmente** a entrada correspondente de `dados/exemplos-briefing.json`, registra a fonte/data no bloco de confirmação e reimporta. O importador nunca remove o exemplo sozinho.
5. O log da importação registra a remoção como ato externo, se ela tiver ocorrido, para a auditoria não achar que o kit "resolveu sozinho".

Isso mantém a proteção contra "copiar e esquecer" e dá um caminho explícito para o número legítimo.

### 6.3 Bloco de confirmação

| Campo | Obrigatório | Valores | Destino |
|---|---|---|---|
| `confirmacao` | sim, se houver dado | `confirmo`, `corrijo` | Log; `corrijo` não substitui `--sobrescrever` |
| `confirmado_por` | sim | Nome e função, mínimo 3 caracteres | `validacao.confirmadoPor`, `revisao.responsavel` |
| `como_confirmou` | sim | `email`, `telefone`, `reuniao`, `documento`, `whatsapp` | `fontes` (texto "confirmacao via …") e log |
| `fonte` | sim | Texto, mínimo 3 caracteres (assunto, protocolo, arquivo, ata) | `validacao.fontes` |
| `data_confirmacao` | sim | `DD/MM/AAAA` ou `AAAA-MM-DD` | `validacao.data`, `revisao.data` e as datas por entidade (`unidades[].atualizadoEm`, `convenios.atualizadoEm`, `paginas.atualizadoEm`); nunca `site.atualizadoEm` |

**Linha sem dado:** se todas as células de dados estiverem vazias/sentinela, a linha é ignorada e listada como "não respondida"; não exige confirmação. **Linha com qualquer dado:** exige o bloco completo; senão é erro e nada é gravado. O bloco confirma apenas as células efetivamente submetidas; célula vazia ou com sentinela não é confirmada e continua como estava.

---

## 7. Pipeline do gerador (`npm run coleta`)

1. Resolver `RAIZ` a partir de `import.meta.url`; aceitar `--raiz=` apenas para testes.
2. `carregarDados(raiz, { rascunho: false })` e `carregarExemplosBriefing(raiz)`.
3. `validarDados(dados, { exemplos, rascunho: false })`. Se houver erro estrutural, imprimir todos e sair 1 sem gerar kit.
4. `resolverPublicacao(dados)` e `gerarRelatorio({ dados, publicacao })`.
5. `montarModeloColeta({ dados, exemplos, relatorio })`:
   - linhas de unidades na ordem atual de `dados.unidades.unidades`;
   - linha de site;
   - convênios ordenados por `id`;
   - preparos na ordem atual;
   - textos por página e ordem de bloco;
   - anexo de telefones do levantamento.
6. `serializarCsv` de cada arquivo; `renderizarQuestionario`; `LEIA-ME`.
7. Escrever em `raiz/relatorios/coleta/` (apagar apenas os arquivos conhecidos da execução anterior, não o diretório inteiro).
8. Imprimir resumo: arquivos, linhas, dependências pendentes, caminho.
9. Nenhuma chamada de rede; nenhum `Date.now()`; nenhum acesso a `dist/`.

**Falhas previstas:** dado estrutural inválido; C-xx pendente sem mapeamento; `dados.site.atualizadoEm` ausente/inválido; template HTML sem placeholder obrigatório (erro de programação).

---

## 8. Pipeline do importador (`npm run importar:coleta`)

### 8.1 Entrada e parsing

1. `--pasta=` (default `relatorios/coleta`), `--raiz=` (default repositório), `--sobrescrever` (default desligado).
2. Exigir os cinco CSVs; faltou um? Erro `coleta:arquivos:<nome>` e nada é gravado.
3. Ler cada arquivo como `Buffer`:
   - `FF FE`/`FE FF` → erro "UTF-16; salve como CSV UTF-8";
   - `EF BB BF` → remover BOM;
   - `\uFFFD` no texto → erro de encoding;
   - CRLF/LF normalizados para o parser.
4. Se a primeira linha não tiver `;` e tiver `,` → erro "separador esperado ;".
5. `lerCsv` com suporte a aspas, `;` interno, CR/LF dentro de aspas e `""`.
6. Validar cabeçalho: conjunto exato do modelo, sem faltantes/duplicadas/desconhecidas; ordem livre.
7. Validar `modelo_versao` (`coleta-1`) e `base_dados_em` (ISO). `base_dados_em` diferente do atual gera aviso, não erro (a clínica pode demorar).
8. Validar `tipo_registro` por arquivo (`unidade`, `site`, `convenio`, `preparo`, `texto`). `site.csv` exige exatamente uma linha de dados; zero ou mais de uma é erro.

### 8.2 Construção do candidato

1. `carregarDados(raiz, { rascunho: false })`; `carregarExemplosBriefing(raiz)`.
2. `validarDados(dados, { exemplos })` no estado atual. Se o repositório já estiver inválido, falhar antes de importar (não mascarar erro existente).
3. `structuredClone(dados)`; nunca mutar o objeto lido até a gravação.
4. Aplicar nesta ordem: `site` → `convenios` → `unidades` → `preparos` → `textos`. Convênios antes das unidades para resolver referências novas.
5. Para cada linha:
   - normalizar células (trim, BOM residual, `sim/nao`, data, CEP, telefone, decimal);
   - identificar sentinela/vazio/token;
   - pular linha sem dado;
   - exigir bloco de confirmação se houver dado;
   - validar imutáveis;
   - comparar com o valor atual e aplicar a regra de sobrescrita;
   - mapear para o objeto.
6. União de convênios: lado unidade + lado convênio; conflito `NAO_TEMOS` × lista explícita = erro.
7. Telefones: até três slots; `principal` no máximo um; `validado` conforme §8.3.
8. Datas: `dados/site.json:atualizadoEm` **não é escrito** (base de geração, só muda por edição manual) e a base do kit (`base_dados_em`) é lida antes da importação e permanece igual no candidato. As datas por entidade — `unidades[].atualizadoEm`, `unidades[].validacao.data`, `convenios.atualizadoEm`, `preparos[].revisao.data` e `paginas.atualizadoEm` (catálogo de páginas, quando o bloco editorial da página é importado) — recebem `max(existente, maior data_confirmacao da entidade)`, nunca o relógio.

### 8.3 Invariantes de status

O importador **nunca promove**. A pós-condição vale para a entidade efetivamente importada (linha com dado):

| Entidade | Pós-condição |
|---|---|
| Unidade | `status: "a-confirmar"`; `validacao.status: "pendente"` |
| Serviço | Não é importado; `status` inalterado |
| Preparo | `revisao.status: "pendente"` |
| Bloco editorial | `status: "pendente"` |
| RT | `responsavelTecnico.status: "pendente"` |
| Unidade/preparo novos | Não permitido |

Entidade já confirmada que não é tocada permanece como está. Se for alterada com `--sobrescrever`, é rebaixada conforme a lista abaixo.

`telefones[].validado` e `whatsapp.validado` podem ir a `true` somente quando a linha tem confirmação completa e o telefone foi submetido; isso é evidência declarada, não publicação. A unidade continua fora do build de produção enquanto `status`/`validacao.status` não forem promovidos manualmente.

Site, convênio e bloco editorial não têm `fontes` no schema: o bloco de confirmação completo (quem, canal, fonte e data) fica no log de importação e é a evidência auditável. O importador não cria campo novo para acomodar isso.

`--sobrescrever` em entidade confirmada rebaixa:
- unidade → `status: "a-confirmar"`, `validacao.status: "pendente"`; `confirmadoPor`/`data`/`fontes` substituídos pelos valores do novo bloco (bloco incompleto é erro);
- preparo → `revisao.status: "pendente"`;
- bloco → `status: "pendente"`;
- RT → `status: "pendente"`;
- convênio → apenas atualiza; não há status.

### 8.4 Validação final

1. Rodar `validarDados(candidato, { exemplos })` e acumular erros. O erro específico de telefone idêntico a exemplo do levantamento é reemitido com a instrução de remoção deliberada do exemplo (AC-09), sem alterar a regra do validador.
2. Validar regras próprias:
   - `slug` de unidade existe; `id` igual; `matriz` igual; `servico_id` de preparo existe e é igual; `pagina`/`bloco`/`tipo_bloco` existem e batem;
   - referências de serviço/convênio existem;
   - no máximo um telefone principal; matriz com exatamente um principal validado quando houver telefones;
   - `site.contatoInstitucional.telefoneE164` igual ao principal da matriz quando ambos existirem;
   - e-mail básico quando informado;
   - nenhuma entidade promovida;
   - nenhum campo imutável alterado;
   - nenhuma célula com injeção de fórmula.
   - Unidades, preparos e blocos existentes no JSON e ausentes do CSV são listados no log como "não respondidos"; não são erro e não mudam o dado.
3. Ordenar erros por arquivo, linha, campo, entidade e detalhe; imprimir todos.
4. Se houver erro: escrever/atualizar `importacao.md` e `.json` com "nada foi gravado"; sair 1.
5. Se não houver: escrever apenas os JSON alterados, em arquivo temporário + `rename` no mesmo diretório; escrever o log; sair 0.

### 8.5 Formato dos erros

| Situação | Código |
|---|---|
| CSV malformado | `unidades.csv:csv:linha-12` |
| Cabeçalho | `unidades.csv:colunas:unidades` (detalhe lista faltantes/sobrando) |
| Versão | `unidades.csv:modelo_versao:unidades` |
| Tipo | `unidades.csv:tipo_registro:unidades` |
| Célula | `unidades.csv:endereco_cep:caninde` |
| Confirmação | `unidades.csv:confirmacao:caninde` (ou o campo faltante) |
| Imutável | `unidades.csv:slug:caninde` |
| Conjunto candidato | `unidades.json:endereco.cep:caninde` (formato do build) |

O detalhe explica a correção em uma frase, sem stack trace. O código de saída é 1 em qualquer erro.

---

## 9. Determinismo, idempotência e gravação

- **Sem relógio:** nenhum `new Date()` para conteúdo; `data_confirmacao` vem do CSV; `base_dados_em` vem de `site.atualizadoEm` e não é alterado pela importação (AD-15).
- **Ordenação:** unidades/preparos preservam a ordem atual; convênios ordenam por `id`; textos por página e índice de bloco; erros por arquivo/linha/campo.
- **JSON:** `JSON.stringify(obj, null, 2) + "\n"`, LF, ordem de chaves preservada pela mutação; convênio novo com chaves na ordem do schema.
- **CSV:** BOM + cabeçalho + linhas em ordem determinística + CRLF; sem caminho absoluto no conteúdo.
- **Idempotência:** aplicar o mesmo kit duas vezes não muda os bytes de `dados/` nem do log. A segunda execução vê valores iguais, mantém status e datas e reescreve o mesmo log. Como `site.atualizadoEm` não sobe na primeira execução, a base do kit continua igual à base atual e a proteção de kit antigo não dispara `--sobrescrever` na segunda aplicação. Essa comparação de base depende de manutenção manual de `site.atualizadoEm` (AD-15.1) e não substitui a regra de entidade confirmada, a flag e a regra de maior data por entidade.
- **Escrita:** somente arquivos com conteúdo diferente; `writeFile` em `<arquivo>.tmp` e `rename`; se uma escrita falhar, os arquivos já renomeados ficam, mas o log registra a falha. O caso normal é atômico o suficiente para um repositório versionado; o rollback definitivo é `git checkout -- dados/`.
- **Sem backup com timestamp:** quebraria determinismo e poluiria o repositório. O Git é o backup.

---

## 10. Questionário HTML — implementação

- `scripts/lib/coleta-html.mjs` exporta `renderizarQuestionario(modelo)`.
- Usa `escapar` de `scripts/lib/render.mjs` para todo texto vindo de dados/clínica.
- Template em template string com placeholders explícitos; sem dependência de `src/templates`.
- CSS embutido, `@media print`, `@page { size: A4; margin: 18mm; }`, `page-break-before: always` nas unidades.
- Tabelas com `<thead>`, `<th scope="col">`, `<caption>`; listas de definição para horários.
- Sem `<form>`/`<input>`; as opções "não temos / não sabemos" são texto `[ ]` para marcar à mão.
- `meta charset="utf-8"`, `lang="pt-BR"`, `meta name="robots" content="noindex"`.
- Nenhum `http://`/`https://` no HTML, exceto texto de exemplo de e-mail? Evitar até isso; usar `nome@dominio` como exemplo.
- Rodapé com versão, data-base e "documento gerado; não editar à mão".

---

## 11. Estratégia de teste

### 11.1 Camadas

| Camada | O que | Como |
|---|---|---|
| Unidade | `lerCsv`/`serializarCsv` (aspas, `;`, CRLF, BOM, multiline), normalização de data/CEP/telefone/decimal, sentinela/tokens | `node:test` em `scripts/testes-coleta.mjs` |
| Modelo | Cabeçalhos exatos, linhas por unidade, pré-preenchimento, anexo do levantamento, C-xx sem mapeamento | Testes puros com dados de `dados-teste/` e fixtures |
| Importador | Mapeamento por entidade, confirmação, imutáveis, sobrescrita, referências, invariantes | Testes de integração em raiz temporária |
| CLI | `npm run coleta` e `npm run importar:coleta` | `spawnSync` com `--raiz` temporária; sem tocar no repo |
| Determinismo | Duas execuções → mesmos hashes | Teste de hash |
| Não regressão | `npm test` da 001 continua passando | Execução completa |
| Manual/UAT | Excel pt-BR, impressão A4, leitura por gestor | Checklist no README/LEIA-ME; tarefa `[C]` |

### 11.2 Casos negativos obrigatórios

1. CSV com aspas não fechadas / linha com número de colunas diferente do cabeçalho.
2. CEP com 7 dígitos ou letras.
3. Telefone `(85) 3343-3739`, `+55 85 3343-3739` ou sem DDD.
4. Telefone idêntico a `exemplos-briefing.json`.
5. Linha com dado e sem `confirmado_por`; sem `fonte`; sem `data_confirmacao`; `como_confirmou` fora do enum.
6. Coluna `status` (ou `validacao_status`, `aprovado`) com valor `ativo`/`confirmado`/`aprovado`.
7. Coluna desconhecida `foo`; coluna ausente; coluna duplicada.
8. `modelo_versao=coleta-0`; `tipo_registro=unidade` em `site.csv`.
9. Slug de unidade desconhecido; slug duplicado; `id` divergente; `matriz` alterada.
10. Serviço/convênio inexistente; convênio duplicado; conflito `NAO_TEMOS` × lista.
11. Matriz com dois principais; principal não validado; telefone institucional diferente da matriz.
12. Entidade confirmada alterada sem `--sobrescrever`; com a flag, rebaixamento e log.
13. UTF-16; separador `,`; acentos quebrados; célula começando com `=`.
14. Data `31/02/2026`; coordenada só com latitude; `geo_precisao` inválida.
15. Erro no meio do conjunto → nenhum JSON alterado.

### 11.3 Casos positivos

1. Kit gerado a partir dos dados atuais: 7 unidades, site, 0 convênios, 5 preparos, blocos pendentes de sobre/convenios/contato/privacidade.
2. Preenchimento de uma unidade de teste (nome, endereço, CEP, telefone novo, horário, serviço, particular) → JSON com `a-confirmar`/`pendente` e `validado: true` nos telefones.
3. Preenchimento de RT/contato/redes → `status: pendente`; go-live continua vermelho.
4. Preenchimento de preparo → `revisao.status: pendente`, responsável/CRM/data preenchidos.
5. Preenchimento de bloco → texto novo, `status: pendente`.
6. Convênio novo + vínculo por unidade → catálogo e unidade atualizados.
7. Duas importações → mesmos bytes; `site.atualizadoEm` e o log iguais, sem `--sobrescrever` na segunda; datas por entidade estáveis.
8. `NAO_TEMOS` em WhatsApp → `{ e164: null, validado: false }`; `NAO_SABEMOS` em comodidade → valor preservado e log.

### 11.4 Isolamento

- `criarRaizTemp()`: `mkdtemp`, copia `dados/` e `dados-teste/unidades.exemplo.json` para a raiz temporária; nunca usa a raiz real para escrita.
- Teste de segurança: hash de `dados/*.json` real antes/depois da suíte; deve ser igual.
- CLI com `--raiz=<temp>` e `--pasta=<temp>/relatorios/coleta`.
- Limpar o diretório temporário no `finally`.

---

## 12. Riscos e mitigações

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R-01 | Confirmação passiva ("só clicou em confirmar") | Alta | Alto (publicar dado errado) | Bloco de 4 campos, canal enumerado, fonte obrigatória, importação sem promoção, revisão do diff e `build:go-live` |
| R-02 | Planilha com dados de outra unidade | Média | Alto (NAP errado) | `slug`/`id` imutáveis, duplicidade recusada, `tipo_registro`, HTML por unidade, log por entidade |
| R-03 | Excel altera telefone/CEP/data/decimal/acentos | Alta | Médio | BOM/`;`/CRLF, normalização inequívoca, mensagens específicas, teste manual no Excel |
| R-04 | Dado de paciente em texto livre | Baixa | Alto (LGPD) | Nenhum campo para isso, aviso no HTML/LEIA-ME, revisão antes de enviar, kit ignorado no Git |
| R-05 | Divergência após duas importações | Média | Médio | Idempotência com `site.atualizadoEm` fixo como base (AD-15), datas por entidade pela maior data entre a existente e a confirmação importada, proteção de campo confirmado, `--sobrescrever` explícito e log (AD-15.1) |
| R-06 | Pré-preenchimento virar verdade | Média | Alto | Sentinela, trava de exemplo, status nunca promovido, pré-preenchimento só de pendente |
| R-07 | Telefone confirmado igual ao exemplo do briefing | Média | Médio | Processo deliberado de remoção do exemplo, documentado e testado; importador não remove sozinho |
| R-08 | Vigência de convênio sem exibição no site | Média | Baixo/Médio | Registrar em `aviso`/`atualizadoEm`; Q-01 para decidir se vira feature de template |
| R-09 | Kit commitado por engano | Baixa | Alto | Saída em `relatorios/` ignorado; `LEIA-ME`; AC-22 |
| R-10 | Importador afrouxar gate | Baixa | Alto | Invariantes de status, testes negativos, `validarDados` reutilizado, `build:go-live` inalterado |
| R-11 | Parser CSV próprio com bug | Média | Médio | Testes de aspas/multiline/BOM/CRLF; biblioteca pequena e isolada; sem regex frágil |
| R-12 | HTML grande demais para imprimir | Baixa | Baixo | Quebra por unidade, tabelas compactas, orientação paisagem quando necessário, teste de impressão |
| R-13 | Coordenador esquece de promover após importar | Média | Médio | Log lista "promoções pendentes"; relatório do build continua listando; README/LEIA-ME |
| R-14 | Planilha de rodada antiga reimportada | Média | Médio (mais estreito, não eliminado) | `base_dados_em` gera aviso; a proteção compara a base do kit com `site.atualizadoEm`, mas essa base só muda por edição manual — a proteção existe e depende dessa manutenção (AD-15.1). A proteção principal contra sobrescrita é a regra de entidade confirmada + `--sobrescrever` + a regra de maior data por entidade; o log mostra a data-base |
| R-15 | Novo C-xx sem mapeamento | Baixa | Médio | Geração falha com `coleta:mapeamento:C-xx`; teste |
| R-16 | **Preview público no GitHub Pages publica o rascunho com entidades pendentes após uma importação real** | Alta (inerente ao fluxo) | **Aceito conscientemente pelo usuário** | Risco documentado (AD-16/S-08). Sem mudança de workflow, build, template ou `noindex` nesta feature; a condução é operacional: importar quando a exposição for aceitável e nunca tratar o preview como produção/publicação aprovada. Bloquear ou filtrar o preview exigiria mudança de workflow fora desta feature |

---

## 13. Áreas/arquivos provavelmente afetados

1. `scripts/lib/csv.mjs` e `scripts/lib/coleta.mjs` — núcleo; maior chance de retrabalho se o modelo CSV mudar.
2. `scripts/lib/coleta-html.mjs` — layout de impressão e conteúdo; ajuste após a primeira reunião.
3. `scripts/coleta.mjs` e `scripts/importar-coleta.mjs` — orquestração, flags e mensagens.
4. `scripts/testes-coleta.mjs` — cobertura; cresce com os casos reais.
5. `package.json` — scripts; nenhuma dependência.
6. `README.md` — operação e promoção manual.
7. `dados/*.json` — destino; o importador grava, o desenvolvedor não edita à mão no fluxo normal.
8. `dados/exemplos-briefing.json` — remoção manual após confirmação (R-07).
9. `relatorios/coleta/` — saída; ignorada.
10. `specs/002-kit-coleta-dados/*` — esta documentação.

---

## 14. Fora do escopo deste plano

Backend, formulário, Google Forms, XLSX, nuvem, upload, e-mail, banco, login, painel; alteração de schema/gate/template; promoção automática; criação de unidade/preparo por planilha; exibição estruturada de vigência; assinatura eletrônica; OCR; parsing de `CONTEUDO-PENDENTE.md`; versionamento do kit; i18n; dependência nova; acesso à rede; mudança no workflow `pages-preview` ou no build de rascunho para bloquear a exposição do preview (risco aceito em AD-16).

---

## 15. Fases e ordem de implementação

| Fase | Entrega | Depende da clínica? |
|---|---|---|
| K0 | Aprovação da spec/plano; revisão do modelo CSV | Não |
| K1 | `csv.mjs` + testes de parse/serialize | Não |
| K2 | `coleta.mjs` (modelo, cabeçalhos, mapeamento, sentinela) + testes | Não |
| K3 | `coleta.mjs` CLI + `npm run coleta` + determinismo | Não |
| K4 | `coleta-html.mjs` + questionário imprimível + testes | Não |
| K5 | `importar-coleta.mjs` (parsing, cabeçalho, versão, erros) + testes | Não |
| K6 | Mapeamento de unidades/site/convênios/preparos/textos + testes | Não |
| K7 | Confirmação, sobrescrita, invariantes, referências, transação + testes | Não |
| K8 | Log, LEIA-ME, README, suíte completa, UAT Excel/impressão | Não (UAT com dados fictícios) |
| K9 | Uso real com a clínica: gerar, enviar, receber, importar, revisar, promover | Sim (C-01..C-15) |

**Caminho sem cliente:** K0–K8 completos com `dados-teste/` e fixtures. K9 é a única fase bloqueada pela clínica. Nenhuma fase altera o site.

**Estado da execução (2026-11-23):** K0 aprovado; K1–K7 implementados; K8 parcial — suíte, LEIA-ME e README prontos, UAT manual de Excel/impressão A4 **não executado**. O QA aprovou em parte, encontrou o defeito de idempotência (AD-15) e, no reteste, a consequência do alcance da proteção de kit antigo (AD-15.1); T016/T021 estão em correção e o reteste final do QA está pendente. K9 não iniciada.

---

## 16. Questões abertas

| # | Questão | Default |
|---|---|---|
| Q-01 | Vigência por convênio precisa ser exibida no site? | Não nesta feature; coletar e registrar em `aviso`/`atualizadoEm` |
| Q-02 | Quem confirma cada tipo de dado? | Gestor da clínica (unidade/contato/convênios), RT (preparo/CRM), jurídico (privacidade); o kit registra o nome |
| Q-03 | A saída ignorada em `relatorios/coleta/` atende ao envio? | Sim; compactar e enviar por canal controlado |

**Nota:** o preview público no GitHub Pages não abre questão nova. A exposição do rascunho com entidades pendentes após importação real é risco aceito pelo usuário (AD-16/R-16), não uma decisão pendente.
