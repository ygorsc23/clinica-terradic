# Tarefas — Kit de coleta de dados da clínica

**Feature:** `002-kit-coleta-dados`
**Base:** `spec.md` + `plan.md`
**Legenda:** `[L]` executável sem conteúdo do cliente · `[C]` depende de conteúdo/decisão da clínica · `[C*]` depende parcialmente (estrutura e teste livres; conteúdo não). `[x]` = implementado e verificado localmente; **não** significa aprovação final do QA.
**Regra:** nenhuma tarefa altera schema, build, templates ou gates do site. Nenhuma tarefa `[C]` fecha sem registro no log de importação e revisão do diff.
**Publicação:** o kit não publica. A promoção continua manual e o deploy continua exigindo `npm run build:go-live` verde.
**Nota:** os IDs `T001..T032` são desta feature; não confundir com `T001..T071` da 001.
**Estado em 2026-11-23:** T001–T025 e T027 implementadas; T016 (datas por entidade) e T021 (idempotência) estão em **correção em andamento, aguarda reteste final** após os achados do QA (FR-32/AC-16, AD-15/AD-15.1); T026 (UAT manual de Excel/impressão A4) e T028–T032 pendentes. Os passos humanos de Excel e impressão **não foram executados**. O QA ainda fará o reteste final depois da correção; nenhuma aprovação final foi concedida.

---

## Fase K0 — Aprovação e modelo

- [x] **T001 [L] Aprovar spec e plano e congelar o modelo `coleta-1`** — revisar cabeçalhos, tokens, bloco de confirmação, saída em `relatorios/coleta/` e regra de não promoção.
  *Pronto quando:* usuário aprova a spec e o plano; os cabeçalhos da §5 do plano estão fechados; nenhuma alteração de schema/gate foi pedida.
- [x] **T002 [L] Implementar `scripts/lib/csv.mjs`** — parse/serialize RFC 4180 com `;`, suporte a BOM, CRLF/LF, aspas, `""`, `;` interno e CR/LF dentro de aspas; erro com linha.
  *Pronto quando:* round-trip de acentos, aspas, `;`, multiline e BOM preserva o conteúdo; CSV malformado falha com linha; sem dependência.
- [x] **T003 [L] Definir constantes, cabeçalhos e mapeamentos em `scripts/lib/coleta.mjs`** — `MODELO_VERSAO`, `base_dados_em`, `tipo_registro`, colunas de cada arquivo e mapa coluna → caminho JSON.
  *Pronto quando:* os cabeçalhos batem exatamente com o plano; uma coluna nova/ausente é detectável; os mapeamentos são funções puras testáveis.
- [x] **T004 [L] Implementar pré-preenchimento, sentinela e tokens** — `A CONFIRMAR: `, `NAO_TEMOS`, `NAO_SABEMOS`, campos imutáveis, campos confirmados, anexo de telefones sem unidade.
  *Pronto quando:* os dados atuais geram as linhas esperadas; telefone do levantamento não aparece em unidade; valor confirmado não é reemitido para reconfirmação.

## Fase K1 — Gerador

- [x] **T005 [L] Implementar `montarModeloColeta`** — usar `carregarDados`, `carregarExemplosBriefing`, `validarDados`, `resolverPublicacao` e `gerarRelatorio`; mapear C-01..C-15 para seções/arquivos; falhar se faltar mapeamento.
  *Pronto quando:* dados atuais geram 7 unidades, 1 site, 0 convênios, 5 preparos e blocos pendentes de sobre/convênios/contato/privacidade; um C-xx pendente sem mapa derruba a geração.
- [x] **T006 [L] Implementar `scripts/coleta.mjs` + `npm run coleta`** — CLI, `--raiz` para teste, saída `relatorios/coleta/`, escrita determinística, sem rede, sem tocar `dados/`/`dist/`/`src/`.
  *Pronto quando:* duas execuções produzem os mesmos bytes; `git status` não mostra `dados/`/`dist/` alterados; o resumo lista arquivos e pendências.
- [x] **T007 [L] Implementar `scripts/lib/coleta-html.mjs`** — questionário autocontido, A4, sem formulário/script/externo, C-01..C-15, por unidade, exemplos, opções, bloco de confirmação, LGPD, anexo do levantamento.
  *Pronto quando:* o HTML abre sem rede, imprime em A4, não tem `<form>`/`<input>`/`<script>`/`iframe`/`@import`/link externo, escapa texto e cobre 100% das dependências.
- [x] **T008 [L] Gerar `LEIA-ME.txt` e documentar no README** — instruções de Excel, tokens, confirmação, LGPD, devolução, importação e promoção manual.
  *Pronto quando:* um leitor sem contexto consegue preencher e devolver; o README explica `coleta`, `importar:coleta`, `--sobrescrever` e o que continua manual.

## Fase K2 — Importador: entrada e mapeamento

- [x] **T009 [L] Implementar o esqueleto de `scripts/importar-coleta.mjs`** — flags `--pasta`, `--raiz`, `--sobrescrever`; exigir os cinco CSVs; detectar UTF-16/ANSI/BOM/separador; validar cabeçalho, versão e `tipo_registro`; formato de erro.
  *Pronto quando:* arquivo faltante, encoding errado, separador `,`, versão antiga, tipo errado e coluna desconhecida falham com `arquivo:campo:entidade` e nada é gravado.
- [x] **T010 [L] Implementar normalizadores de célula** — data `DD/MM/AAAA`/ISO, CEP com hífen, telefone com/sem `+`, decimal com vírgula, `sim/nao`, tokens, fórmula.
  *Pronto quando:* variações inequívocas passam; `(85) 3343-3739`, UTF-16, `31/02/2026`, latitude sem longitude e `=...` falham com detalhe.
- [x] **T011 [L] Mapear `unidades.csv`** — escalares, endereço, geo, até 3 telefones, WhatsApp, e-mail, horários, serviços, convênios, particular, comodidades, observações, redes e validação.
  *Pronto quando:* uma unidade de fixture importa; `status` fica `a-confirmar`, `validacao.status` fica `pendente`, telefones confirmados ficam `validado: true` e `validarDados` aprova o candidato.
- [x] **T012 [L] Mapear `site.csv`** — RT/CRM/UF/especialidade com `status: pendente`, contato institucional e redes; checar igualdade do telefone institucional com o principal da matriz.
  *Pronto quando:* site de fixture importa, RT continua pendente, divergência de telefone falha e o go-live continua vermelho.
- [x] **T013 [L] Mapear `convenios.csv`** — id/novo, nome, tipo, logo/autorização, aviso, vigência, unidades; união com o lado da unidade; conflito `NAO_TEMOS` × lista.
  *Pronto quando:* convênio novo + vínculo por unidade importa; duplicado, inexistente, logo sem autorização e conflito falham.
- [x] **T014 [L] Mapear `preparos.csv`** — textos, documentos, observações, alerta, RT/CRM/data, `revisao.status: pendente`; `id`/`slug`/`servico_id` imutáveis.
  *Pronto quando:* preparo de fixture importa com revisão pendente; mudança de serviço/slug falha; nenhum preparo fica aprovado.
- [x] **T015 [L] Mapear `textos.csv`** — localizador `pagina`/`bloco`/`tipo_bloco`, `texto`/`itens`, `status: pendente`; sem inserir bloco novo.
  *Pronto quando:* bloco pendente de fixture é atualizado; bloco aprovado exige `--sobrescrever`; tipo/localizador errado falha; nenhum bloco fica aprovado.

## Fase K3 — Importador: confirmação, proteção e transação

- [x] **T016 [L] Implementar bloco de confirmação e rastreabilidade** — exigir `confirmacao`, `confirmado_por`, `como_confirmou`, `fonte`, `data_confirmacao`; preencher `validacao.*`, `revisao.*`, RT e as datas por entidade.
  *Pronto quando:* linha com dado e bloco incompleto falha; bloco completo preenche os campos; `site.atualizadoEm` não é escrito e as datas por entidade (`unidades[].atualizadoEm`, `validacao.data`, `convenios.atualizadoEm`, `preparos[].revisao.data` e `paginas.atualizadoEm`, este quando o bloco editorial da página é importado) recebem a **maior** data entre a existente e a maior `data_confirmacao` da entidade (`max(existente, confirmação importada)`), sem regressão e sem relógio.
  *Estado:* **correção em andamento, aguarda reteste final** — a regra de maior data por entidade (`max`) está sendo ajustada no código junto com T021; a marcação `[x]` é verificação local anterior e não aprovação do QA.
- [x] **T017 [L] Implementar proteção de campo confirmado e `--sobrescrever`** — detectar unidade ativa/confirmada, serviço/preparo/bloco aprovado, RT confirmado, convênio existente e contato/redes preenchidos; sem flag falha; com flag rebaixa e loga.
  *Pronto quando:* alteração sem flag falha; com flag grava, rebaixa para pendente quando aplicável e lista a sobrescrita; campo imutável continua falhando.
- [x] **T018 [L] Implementar validação cruzada e `validarDados` no candidato** — refs de serviço/convênio, principal da matriz, telefone institucional, e-mail básico, nenhuma promoção, nenhum imutável alterado.
  *Pronto quando:* todos os erros saem de uma vez; o candidato inválido não é gravado; o candidato válido passa no validador do build.
- [x] **T019 [L] Implementar escrita tudo-ou-nada** — validar tudo antes; escrever só arquivos alterados em `.tmp` + `rename`; falha no meio não grava JSON.
  *Pronto quando:* hash de `dados/*.json` antes/depois é igual em qualquer erro; sucesso grava exatamente o esperado.
- [x] **T020 [L] Implementar log `importacao.md`/`.json`** — arquivos, linhas, campos gravados (incluindo datas por entidade), campos ignorados, tokens, sobrescritas, erros e promoções pendentes; determinístico, sem relógio.
  *Pronto quando:* o mesmo kit gera o mesmo log; o log lista o que falta promover; erro registra "nada foi gravado".
- [x] **T021 [L] Garantir idempotência** — aplicar o mesmo kit duas vezes; comparar bytes de JSON e log; `site.atualizadoEm` fixo como base (não elevado pela importação); datas por entidade estáveis.
  *Pronto quando:* os hashes são iguais nas duas execuções; nenhum campo muda por reexecução.
  *Estado:* **correção em andamento, aguarda reteste final.** O QA encontrou a elevação indevida de `site.atualizadoEm` na primeira execução (FR-32/AC-16, AD-15) e o reteste apontou que a proteção de kit antigo depende de manutenção manual da base (AD-15.1). A segunda execução do mesmo kit deve passar sem `--sobrescrever`, mas nada está aprovado até o reteste final do QA.

## Fase K4 — Testes, documentação e UAT

- [x] **T022 [L] Implementar a suíte negativa obrigatória** — CSV malformado, CEP, telefone E.164, valor do levantamento, confirmação ausente, tentativa de `ativo`, coluna desconhecida, versão antiga, UTF-16, separador `,`, data inválida, geo incompleta, fórmula, duplicidade, imutável, referência inexistente, matriz/telefone institucional.
  *Pronto quando:* cada caso falha pelo motivo certo, com código de saída 1 e nenhum JSON alterado.
- [x] **T023 [L] Implementar fixture de integração positivo** — kit completo com 1 unidade, site, 1 convênio, 1 preparo e 1 texto; importar em raiz temporária; rodar `validarDados` e conferir que nada publica.
  *Pronto quando:* o candidato passa no validador; `status`/`validacao`/`revisao`/bloco/RT continuam pendentes; a geração de páginas com o fixture não publica a unidade nem altera o build real.
- [x] **T024 [L] Isolar a suíte do repositório real** — copiar `dados/` para `mkdtemp`, usar `--raiz`/`pasta` temporários, limpar no `finally`, conferir hash dos arquivos reais antes/depois.
  *Pronto quando:* a suíte passa sem alterar `dados/` real; `git status` limpo após `npm test`.
- [x] **T025 [L] Integrar ao `npm test`** — `node --test scripts/testes.mjs scripts/testes-coleta.mjs`; rodar a suíte da 001 e a nova.
  *Pronto quando:* as duas suítes passam; nenhum teste novo depende de rede ou de ordem de execução.
- [ ] **T026 [L] UAT manual Windows/Excel + impressão A4** — abrir os CSVs no Excel pt-BR, editar acentos/telefone/CEP/data/decimal, salvar e importar em raiz temporária; imprimir o HTML e conferir quebra/legibilidade.
  *Pronto quando:* o round-trip não perde dado e o questionário imprime sem corte; evidência registrada (print ou checklist).
  *Estado:* **pendente** — os passos humanos de Excel e impressão **não foram executados**.
- [x] **T027 [L] Revisão final de escopo** — conferir que nenhum schema/gate/template/dependência mudou; `git diff` só nos arquivos previstos; README/LEIA-ME atualizados; determinismo revalidado.
  *Pronto quando:* diff revisado, `npm test` verde, `npm run coleta` determinístico e `npm run build:go-live` com o mesmo comportamento de antes.
  *Estado:* revisão feita; o **reteste final do QA** continua pendente depois da correção da idempotência (T021), e T026 não foi executada.

## Fase K5 — Uso com a clínica (bloqueada por conteúdo)

> **Não iniciada em 2026-11-23.** Depende da clínica, do RT e do jurídico; nenhuma etapa humana desta fase foi executada.

- [ ] **T028 [C] Gerar o kit real e enviar para a clínica** — rodar `npm run coleta`, revisar o HTML, definir quem preenche cada bloco, enviar a pasta por canal controlado.
  *Pronto quando:* kit gerado, interlocutor definido, prazo de devolução combinado e canal registrado.
- [ ] **T029 [C] Receber, importar e corrigir com a clínica** — rodar `npm run importar:coleta`, tratar os erros com a clínica, revisar o diff, remover exemplo do levantamento se um número confirmado for idêntico (R-07) e registrar no log.
  *Pronto quando:* importação válida, diff revisado, nenhuma promoção automática e log arquivado.
- [ ] **T030 [C] Promover manualmente o que estiver confirmado** — por dependência, promover unidade/serviço/preparo/bloco/RT conforme o aceite; rodar `npm run build`, `npm run check` e `npm run build:go-live`; comparar bloqueios restantes.
  *Pronto quando:* promoções registradas, build/check verdes e go-live listando apenas bloqueios reais remanescentes.
- [ ] **T031 [C*] Revisão do RT para preparos, CRM e textos clínicos** — RT preenche/assina `preparos.csv`, `site.csv` (CRM/UF/especialidade) e revisa textos clínicos; o importador mantém tudo pendente até a promoção.
  *Pronto quando:* `revisao.responsavel`, `revisao.crm`, `revisao.data` e RT completos; aceite registrado; nenhum texto clínico publicado sem revisão.
- [ ] **T032 [C*] Texto de privacidade e aceite jurídico** — jurídico/clínica fornece o texto de `textos.csv` (página `privacidade`); importar; promover bloco e `site.privacidade.politicaPublicada` só após aprovação.
  *Pronto quando:* texto aprovado, bloco promovido, política publicada apenas com aceite e go-live coerente.

---

## Dependências e ordem

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008
                                      │
                                      ▼
                    T009 → T010 → T011/T012/T013/T014/T015
                                      │
                                      ▼
                    T016 → T017 → T018 → T019 → T020 → T021
                                      │
                                      ▼
                    T022 → T023 → T024 → T025 → T026 → T027
                                      │
                                      ▼
                    T028 → T029 → T030   (T031/T032 em paralelo, conforme conteúdo)
```

**Paralelismo possível sem cliente:** T002–T008 (gerador) e T009–T027 (importador/testes) podem ser divididos entre duas pessoas depois de T003; T011–T015 são independentes entre si, mas dependem de T009/T010.

**Caminho crítico sem cliente:** T001–T027. Tudo é construído e testado com `dados-teste/` e fixtures. T028–T032 dependem da clínica/RT/jurídico.

**Estado:** T001–T025 e T027 implementadas; T016 e T021 em **correção em andamento, aguarda reteste final**; T026 e T028–T032 pendentes. O reteste final do QA não ocorreu.

**Ordem de bloqueio:** T006 (gerador) pode rodar antes do importador; T011–T015 precisam de T009/T010; T016–T021 precisam dos mapeamentos; T022–T027 fecham a qualidade. Nenhuma tarefa altera o site.

---

## Cobertura dos critérios de aceite

| Critério | Tarefas |
|---|---|
| AC-01 | T005, T006, T027 |
| AC-02 | T007 |
| AC-03 | T002, T006, T026 |
| AC-04 | T004, T007 |
| AC-05 | T005 |
| AC-06 | T011–T016, T023 |
| AC-07 | T002, T009, T022 |
| AC-08 | T010, T022 |
| AC-09 | T004, T018, T022, T029 |
| AC-10 | T016, T022 |
| AC-11 | T009, T017, T022 |
| AC-12 | T009, T022 |
| AC-13 | T011, T014, T018, T022 |
| AC-14 | T017, T022 |
| AC-15 | T004, T010, T022 |
| AC-16 | T016, T020, T021 |
| AC-17 | T012, T013, T018, T022 |
| AC-18 | T018, T019, T022 |
| AC-19 | T022–T025 |
| AC-20 | T023, T027, T030 |
| AC-21 | T007, T008, T022 |
| AC-22 | T006, T008, T024, T027 |
| AC-23 | T007, T010, T022 |
