# Especificação — Kit de coleta de dados da clínica

**Feature:** `002-kit-coleta-dados`
**Status:** implementada em parte — T002–T025 e T027 implementadas; T016/T021 (datas por entidade e idempotência) em correção após achado do QA, aguardando reteste final; T026 (UAT humano) e T028–T032 pendentes; nenhuma aprovação final do QA
**Última atualização:** 2026-11-23
**Autor:** analista/arquiteto

> **Relação com a 001.** Esta feature não altera o site, o build, os gates de publicação nem o modelo de dados. Ela cria uma camada de coleta e importação para acelerar o fechamento de C-01..C-15, que hoje bloqueiam o go-live da 001. A fonte de verdade continua sendo `dados/*.json`; o gate de publicação continua sendo `npm run build:go-live`.

> **Estado real (2026-11-23).** O núcleo foi implementado e revisado em parte: existem `scripts/lib/csv.mjs`, `scripts/lib/coleta.mjs`, `scripts/lib/coleta-html.mjs`, os CLIs `coleta.mjs` e `importar-coleta.mjs`, a suíte `scripts/testes-coleta.mjs`, o `LEIA-ME`, o README e os scripts npm (T002–T025 e T027). O QA encontrou uma contradição de idempotência entre FR-32 e a proteção de kit antigo; a reconciliação está registrada em FR-32/AC-16 (AD-15 do plano) e foi repassada ao desenvolvedor, com reteste final pendente. O reteste apontou também que a proteção de kit antigo depende de manutenção manual de `site.atualizadoEm` — o alcance real está em AD-15.1 do plano e o R-14 foi ajustado; isso restringe a mitigação, não cria requisito novo. T026 (Excel/impressão A4) e T028–T032 (clínica/RT/jurídico) não foram executadas. Não há `.specify/`; os artefatos continuam manuais, como os da 001. Nenhuma dependência nova, backend, banco, formulário no site ou acesso à rede foi introduzido.

---

## 1. Contexto e problema

O site da Terradic está implementado nas fases técnicas, mas o go-live está bloqueado por dados que só a clínica pode confirmar (C-01..C-15). Hoje a coleta acontece por mensagens, ligações e planilhas livres. Isso produz quatro problemas recorrentes:

1. **Transcrição manual.** Cada resposta precisa ser convertida à mão para `dados/*.json`, com risco de erro de digitação, campo trocado e perda de rastro de quem confirmou.
2. **Confirmação passiva.** Um "ok" em uma mensagem ou um "confirmo" genérico não diz qual campo foi confirmado, por quem, com qual fonte e em que data. O build exige `confirmadoPor`, `data` e `fontes` para publicar; a coleta atual não os produz de forma estruturada.
3. **Formatação imprevisível.** Telefone com máscara, CEP com hífen, data em `DD/MM/AAAA`, coordenada com vírgula decimal e acentos quebrados pelo Excel são variações comuns. O validador do build é estrito e recusa o dado; sem um passo de importação, o erro só aparece no fim.
4. **Listas que envelhecem.** `CONTEUDO-PENDENTE.md` é um resumo manual e `relatorios/pendencias.*` é gerado pelo build. Criar uma terceira lista de perguntas sem ligação com os dados produziria mais uma versão da verdade.

**Objetivo:** entregar um kit de coleta com questionário em linguagem de negócio, planilhas CSV pré-preenchidas e um importador validado, gerado a partir das pendências reais do repositório, para que a resposta da clínica vire dado rastreável em `dados/*.json` sem digitação manual e sem publicar nada antes da hora.

### 1.1 Objetivos mensuráveis

| Métrica | Meta | Como medir |
|---|---|---|
| Cobertura das dependências | 100% de C-01..C-15 presentes no questionário e/ou nas planilhas, com responsável e onde responder | Inspeção do kit gerado + teste de mapeamento |
| Transcrição manual | 0 campo copiado à mão da planilha para o JSON no fluxo normal | Importação de um kit de teste e comparação do JSON resultante |
| Rastreabilidade | 100% das linhas importadas com `confirmado_por`, `como_confirmou`, `fonte` e `data_confirmacao` | Teste negativo + log de importação |
| Promoção indevida | 0 unidade importada como `ativo`, 0 validação `confirmado`, 0 preparo `aprovado`, 0 bloco `aprovado`, 0 RT `confirmado` | Teste de invariantes de status |
| Erros silenciosos | 100% dos erros listados de uma vez, no formato `arquivo:campo:entidade`, sem gravar nada | Testes negativos com planilha inválida |
| Determinismo | Duas execuções com a mesma entrada produzem os mesmos bytes | Hash dos arquivos gerados e dos JSON importados |
| Compatibilidade Excel pt-BR | CSV abre no Excel em português com acentos, `;`, UTF-8 com BOM e decimal com vírgula | Verificação manual no Windows + teste de bytes |

---

## 2. Pessoas e cenários

| Persona | Necessidade | Cenário principal |
|---|---|---|
| Coordenador do projeto | Coletar, validar e importar sem retrabalho | Roda `npm run coleta`, envia o kit, recebe, roda `npm run importar:coleta`, revisa o diff e promove o que estiver confirmado |
| Gestor da clínica | Responder em linguagem de negócio | Recebe o HTML impresso na reunião e as planilhas; preenche dados de unidades, contato, convênios e textos |
| Responsável técnico (RT) | Revisar conteúdo clínico e assumir CRM | Preenche/assina os preparos, o CRM/UF/especialidade e o aceite dos textos clínicos |
| Jurídico da clínica | Aprovar privacidade e uso de dados | Responde C-14 no questionário; o texto vai para `textos.csv` |
| Desenvolvedor | Manter o kit sem criar fluxo paralelo | Reusa o validador e o relatório existentes; não altera o build nem os gates |

**Cenário completo:**

1. O coordenador roda `npm run coleta` com os dados atuais.
2. O kit é gerado em `relatorios/coleta/` com o questionário, as planilhas e as instruções.
3. O HTML é impresso para a reunião; as planilhas são enviadas para a clínica preencher no Excel.
4. A clínica devolve a pasta com os CSVs editados.
5. O coordenador roda o importador. Erros são corrigidos com a clínica; nada é gravado enquanto houver erro.
6. Com o kit válido, o importador grava `dados/*.json` apenas com status pendentes e registra a confirmação declarada.
7. O coordenador revisa o diff, confere as fontes e promove manualmente o que estiver pronto (status `ativo`, `validacao.status: confirmado`, preparo `aprovado`, bloco `aprovado`, RT `confirmado`).
8. Roda `npm run build`, `npm run check` e `npm run build:go-live`, que continua sendo o único gate de publicação.
9. Rodadas seguintes repetem o ciclo apenas com o que ainda estiver pendente; reimportar o mesmo kit é idempotente.

---

## 3. Escopo

### 3.1 Dentro do escopo

1. Comando `npm run coleta` que gera o kit a partir de `dados/*.json`, `dados/exemplos-briefing.json` e das mesmas funções de relatório/validação do build.
2. Questionário HTML imprimível, em linguagem de negócio, organizado por unidade e agrupado por C-01..C-15, com exemplos de formato campo a campo, opção explícita "não temos / não sabemos" e bloco de confirmação.
3. Conjunto de planilhas CSV com colunas fixas, uma linha por unidade na planilha de unidades, mais blocos para site institucional, convênios com vigência, preparos e textos editoriais.
4. Pré-preenchimento a partir do estado atual dos JSON e do levantamento preliminar, sempre marcado como "a confirmar", sem valor que possa ser confundido com confirmação.
5. Importador `scripts/importar-coleta.mjs` (ou nome equivalente) que valida as mesmas regras do build, sem rede e sem dependência nova, grava em `dados/*.json` somente com status pendentes, preenche a rastreabilidade a partir do bloco de confirmação e falha listando todos os erros de uma vez.
6. Comando `npm run importar:coleta`, log de importação e instruções de uso.
7. Testes negativos com `node:test` para as regras novas.
8. Documentação de operação no README (seção do kit) e no `LEIA-ME` gerado.

### 3.2 Fora do escopo (explícito)

- Backend, banco, API, login, painel administrativo ou qualquer formulário no site.
- Google Forms, Microsoft Forms, XLSX, planilha em nuvem, upload, e-mail transacional ou armazenamento externo.
- Alterar `dados/*.json` schema, `scripts/build.mjs`, `scripts/lib/dados.mjs`, `scripts/lib/golive.mjs`, `scripts/lib/relatorio.mjs`, templates do site ou gates de publicação.
- Alterar o workflow `pages-preview`, o build de rascunho ou o `noindex` para tratar a exposição do rascunho. O risco do preview público é aceito e documentado (S-08/R-16); mudança de workflow fica fora desta feature.
- Promover automaticamente qualquer entidade a `ativo`, `confirmado`, `aprovado` ou `oficial`.
- Coletar, armazenar ou trafegar dado de paciente, exame, laudo, CPF de paciente ou dado de saúde.
- Receber e instalar arquivos de identidade visual (logo, brandbook, fotos) ou credenciais de DNS/hospedagem. O questionário pergunta por eles; o arquivo continua sendo entregue por fora.
- Interpretar ou editar `CONTEUDO-PENDENTE.md` automaticamente.
- Exibir vigência por convênio no site. O kit coleta e registra a vigência; a exibição estruturada no template é uma mudança de site fora desta feature.
- Criar unidade ou preparo novo por planilha. Unidades e preparos existentes são atualizados; a criação continua sendo o fluxo manual documentado no README.
- Assinatura eletrônica, certificado digital, OCR, transcrição automática de áudio ou leitura de documento.
- Versionar o kit gerado ou os dados pré-preenchidos no Git. A saída fica em `relatorios/`, que já é ignorado.
- Internacionalização (somente `pt-BR`).
- Substituir a revisão humana e o aceite do RT.

---

## 4. Requisitos funcionais

Formato: `FR-xx` — requisito. Prioridade: **P1** (obrigatório para a entrega), **P2** (desejável nesta fase).

### 4.1 Geração do kit

- **FR-01 (P1)** Deve existir `npm run coleta` (script Node, sem dependência nova) que gere o kit a partir dos dados reais. O comando não pode ler `dados-teste/`, não pode alterar `dados/`, `dist/`, `dist-rascunho/`, `dist-staging/` nem `src/`, e não pode acessar a rede.
- **FR-02 (P1)** A saída deve ficar em `relatorios/coleta/` (diretório já ignorado no Git) e conter, no mínimo: `questionario.html`, `LEIA-ME.txt`, `unidades.csv`, `site.csv`, `convenios.csv`, `preparos.csv` e `textos.csv`. Nomes e versão do modelo são fixos; uma execução limpa substitui a anterior.
- **FR-03 (P1)** Antes de gerar, o comando deve validar os dados com o mesmo `validarDados` do build. Dado estruturalmente inválido impede a geração e sai com os erros no formato `arquivo:campo:entidade`; pendência de conteúdo não é erro e deve aparecer no kit.
- **FR-04 (P1)** A geração deve ser determinística: mesma entrada (dados + exemplos) produz os mesmos bytes, sem timestamp de relógio, ordem aleatória ou caminho absoluto no conteúdo. A data de referência do kit é `dados.site.atualizadoEm`, não a data da execução; esse campo é a base de geração do conjunto e não é alterado pelo importador.

### 4.2 Questionário HTML

- **FR-05 (P1)** O questionário deve ser um HTML único, autocontido, em `pt-BR`, com CSS embutido, sem JavaScript, sem formulário, sem `input`, sem requisição externa (fonte, imagem, script, iframe ou `@import`) e com `meta robots noindex`.
- **FR-06 (P1)** O questionário deve ser imprimível em A4, com contraste adequado, quebras de página por unidade, tabelas legíveis em preto e branco e identificação de versão do modelo e data-base dos dados.
- **FR-07 (P1)** O conteúdo deve ser organizado por unidade e agrupado pelas dependências C-01..C-15, em linguagem de negócio, com exemplos de formato campo a campo (telefone, CEP, data, coordenada, horário, lista de serviços e convênios) e opção explícita "não temos / não sabemos".
- **FR-08 (P1)** Deve haver um bloco de confirmação obrigatório por unidade e por bloco temático, com: quem confirmou (nome e função), como confirmou (e-mail, telefone, reunião, documento ou WhatsApp), fonte (assunto, protocolo, arquivo ou URL interna) e data da confirmação. Um "ok" genérico não satisfaz o bloco.
- **FR-09 (P1)** O questionário deve listar 100% das dependências C-01..C-15, marcando quais estão pendentes e em qual planilha/seção cada uma é respondida. Dependência pendente sem mapeamento deve impedir a geração (falha explícita), para não existir item esquecido.
- **FR-10 (P1)** O questionário deve conter aviso de LGPD: não incluir dados de paciente, exames, laudos, CPF de paciente ou informação clínica individual; o CRM do responsável técnico é dado profissional e só é registrado com a identificação de quem confirmou.
- **FR-11 (P1)** O questionário deve incluir uma seção de anexo com os telefones do levantamento preliminar que não têm unidade definida, marcados como "a confirmar", sem atribuí-los a nenhuma unidade por suposição.
- **FR-12 (P2)** O questionário pode incluir uma folha de assinatura e um checklist de devolução, mas não pode depender dela para validação; a prova de confirmação é o bloco preenchido no CSV.

### 4.3 Planilhas CSV

- **FR-13 (P1)** As planilhas devem usar colunas fixas e espelhar o schema real: `unidades.csv` com uma linha por unidade (endereço, geo, telefones, WhatsApp, e-mail, horários, serviços, convênios, atendimento particular, comodidades, redes sociais e bloco de confirmação da validação); `site.csv` com uma linha para RT/CRM/UF/especialidade, contato institucional e redes; `convenios.csv` com uma linha por convênio e vigência; `preparos.csv` com uma linha por preparo e revisão do RT; `textos.csv` com uma linha por bloco editorial pendente.
- **FR-14 (P1)** Todo CSV deve começar com `modelo_versao` e `base_dados_em` e conter `tipo_registro`. A versão desta entrega é `coleta-1`; `base_dados_em` é a data de `dados.site.atualizadoEm` em `AAAA-MM-DD`. O importador não altera `dados.site.atualizadoEm`; a data-base do kit continua sendo a base de geração mesmo depois de uma importação.
- **FR-15 (P1)** O formato deve abrir corretamente no Excel em português: UTF-8 com BOM, separador `;`, quebra de linha CRLF, aspas no padrão RFC 4180 quando o valor contiver `;`, `"`, CR ou LF, decimal com vírgula nos campos de coordenada e datas de preenchimento em `DD/MM/AAAA`.
- **FR-16 (P1)** Valores booleanos devem usar `sim`/`nao`. Listas (serviços, convênios, documentos, itens editoriais, unidades de convênio) devem usar `|` como separador interno. Horários devem usar `dias:HH:MM-HH:MM[:observacao]`, com faixas separadas por `|` e dias separados por `,`.
- **FR-17 (P1)** Célula vazia significa "não informado nesta rodada" e não altera o JSON existente. Os tokens `NAO_TEMOS` e `NAO_SABEMOS` são respostas explícitas: `NAO_TEMOS` grava ausência (`null`/lista vazia) e `NAO_SABEMOS` registra a ignorância e preserva o valor existente, sem inventar valor. O prefixo `A CONFIRMAR: ` marca valor pré-preenchido não respondido e nunca é importado como dado.
- **FR-18 (P1)** Colunas fora do modelo, colunas ausentes, colunas duplicadas, `tipo_registro` errado, `modelo_versao` desconhecida ou arquivo de outra entidade devem ser recusados com erro explícito. A ordem das colunas pode variar; o mapeamento é por nome.
- **FR-19 (P1)** O importador deve aceitar variações inequívocas de formatação produzidas pelo Excel: BOM opcional, CRLF ou LF, CEP com hífen (normalizado para 8 dígitos), data `DD/MM/AAAA` (normalizada para `AAAA-MM-DD`), coordenada com vírgula ou ponto e telefone com 12/13 dígitos iniciados em `55` (recolocado o `+`). Qualquer outra variação é erro. UTF-16, ANSI ou separador `,` devem ser recusados com mensagem de como salvar em "CSV UTF-8" com `;`.

### 4.4 Pré-preenchimento

- **FR-20 (P1)** O pré-preenchimento deve vir do estado atual de `dados/*.json` e de `dados/exemplos-briefing.json`. Valores ainda não confirmados devem ser prefixados com `A CONFIRMAR: `; valores já confirmados não são emitidos para edição no CSV (aparecem apenas como referência no HTML) e não podem ser alterados pelo importador sem sinalização explícita.
- **FR-21 (P1)** Campos estruturais e imutáveis (`slug`, `id`, `matriz`, `tipo_registro`, `versao`, `base_dados_em`, `servico_id` de preparo, localizador de bloco) devem ser emitidos como referência e não podem ser alterados pela planilha. Mudança nesses campos é erro, mesmo com sinalização de sobrescrita.
- **FR-22 (P1)** Nenhum valor pré-preenchido pode ser tratado como confirmação: o importador deve ignorar células que ainda carregam `A CONFIRMAR: `, não deve gravar `confirmadoPor`/`fontes` a partir delas e deve listá-las como não respondidas no log.
- **FR-23 (P1)** O kit deve combinar o pré-preenchimento com a trava existente de `dados/exemplos-briefing.json`: telefone idêntico a exemplo do levantamento continua recusado pelo validador do build. Se a clínica confirmar um desses números, o coordenador deve registrar a confirmação e remover o exemplo correspondente de `dados/exemplos-briefing.json` como ato deliberado, documentado no log; o importador não faz essa remoção sozinho.
- **FR-24 (P1)** Telefones do levantamento sem unidade definida não podem ser distribuídos por suposição entre as unidades. Eles aparecem apenas no anexo do questionário; a planilha da unidade começa sem telefone pré-preenchido.

### 4.5 Importador

- **FR-25 (P1)** Deve existir `npm run importar:coleta -- --pasta=relatorios/coleta` (ou `--pasta` equivalente) que leia os cinco CSVs, valide tudo e grave `dados/*.json` somente depois de validar o conjunto inteiro. O comando não pode acessar a rede nem usar dependência nova.
- **FR-26 (P1)** O importador deve validar as mesmas regras do build (`scripts/lib/dados.mjs`) sobre o conjunto candidato e, antes de gravar, as regras próprias da coleta: arquivo/coluna/versão, confirmação obrigatória, imutabilidade, referências cruzadas, telefone principal da matriz, igualdade entre telefone institucional e telefone da matriz, formato de e-mail quando informado e ausência de promoção de status.
- **FR-27 (P1)** O importador não pode promover entidade. Toda entidade efetivamente importada é gravada em estado pendente: unidade com `status: "a-confirmar"` e `validacao.status: "pendente"`; preparo com `revisao.status: "pendente"`; bloco editorial com `status: "pendente"`; RT com `status: "pendente"`. Entidade já confirmada que não for tocada permanece como está; se for alterada com `--sobrescrever`, é rebaixada para pendente. Nenhuma coluna de status de publicação existe no modelo; uma coluna `status`, `validacao_status`, `aprovado` ou equivalente deve ser recusada como coluna desconhecida.
- **FR-28 (P1)** `telefones[].validado` e `whatsapp.validado` só podem ser gravados como `true` quando a linha tiver bloco de confirmação completo e o telefone tiver sido efetivamente submetido (não prefixado, não vazio, não token). Isso atesta a declaração da clínica, não a publicação; a unidade continua `a-confirmar` e fora do ar.
- **FR-29 (P1)** O importador deve preencher a rastreabilidade a partir do bloco de confirmação: na unidade, `validacao.confirmadoPor`, `validacao.data` e `validacao.fontes`; no preparo, `revisao.responsavel`, `revisao.crm` e `revisao.data`; no RT, `responsavelTecnico.*`; no convênio, `atualizadoEm`; no bloco editorial, o texto e a manutenção de `status: "pendente"`. Quando o schema não tiver campo equivalente (site, convênio, bloco editorial), o bloco completo fica registrado no log de importação, que é a evidência auditável.
- **FR-30 (P1)** O importador não pode alterar campo já confirmado sem sinalização explícita. Entidade confirmada é: unidade com `status: "ativo"` ou `validacao.status: "confirmado"`; serviço `aprovado`; preparo `aprovado`; bloco `aprovado`; RT `confirmado`; convênio já cadastrado; contato/redes institucionais já preenchidos. A sinalização é a flag `--sobrescrever`, que deve ser explícita na linha de comando, listar cada sobrescrita e rebaixar a entidade para pendente (`a-confirmar`/`pendente`) quando aplicável. Sem a flag, o importador falha e não grava nada.
- **FR-31 (P1)** O importador deve falhar listando todos os erros de uma vez, no formato `arquivo:campo:entidade`, com saída diferente de zero, e não pode gravar parcialmente. Em caso de erro, os JSON existentes permanecem byte a byte iguais; apenas o log de importação é atualizado com o resultado "nada foi gravado".
- **FR-32 (P1)** O importador deve ser idempotente: aplicar o mesmo kit duas vezes produz os mesmos bytes de `dados/*.json` e do log, sem usar o relógio da execução. `dados/site.json:atualizadoEm` é a **base de geração** do conjunto, não a data do conteúdo importado: o importador não o escreve, e ele só muda por edição manual deliberada; é esse valor que o kit grava em `base_dados_em` e que a proteção de kit antigo compara. As datas derivadas de confirmação são atualizadas por entidade — `unidades[].atualizadoEm`, `unidades[].validacao.data`, `convenios.atualizadoEm`, `preparos[].revisao.data` e `paginas.atualizadoEm` (catálogo de páginas, quando o bloco editorial da página é importado) — e cada uma recebe a **maior** data entre a existente e a maior `data_confirmacao` efetivamente importada para aquela entidade (`max(existente, confirmação importada)`). A data existente é preservada quando não houver data nova e nunca há regressão para uma data anterior. Consequência obrigatória: a primeira importação não eleva a base do kit e a segunda aplicação do mesmo kit continua válida, sem exigir `--sobrescrever`, reproduzindo os mesmos bytes e o mesmo log.
- **FR-33 (P1)** O importador deve gerar um log determinístico em `relatorios/coleta/importacao.md` e `.json` com: arquivos lidos, linhas importadas, campos gravados (incluindo as datas por entidade atualizadas: `unidades[].atualizadoEm`, `validacao.data`, `convenios.atualizadoEm`, `preparos[].revisao.data` e `paginas.atualizadoEm`), campos ignorados (vazios/sentinela), tokens `NAO_TEMOS`/`NAO_SABEMOS`, sobrescritas, erros e lista de promoções manuais pendentes. O log não é fonte de verdade e não é lido pelo build.
- **FR-34 (P1)** O importador pode criar convênio novo, porque o catálogo atual está vazio e a planilha é a via natural de cadastro. Não pode criar unidade nem preparo novo; slug desconhecido nesses arquivos é erro e deve ser tratado pelo fluxo manual do README.

### 4.6 Fontes de verdade e operação

- **FR-35 (P1)** `dados/*.json` é a fonte de verdade. `relatorios/pendencias.md` e `.json` são derivados do build. `CONTEUDO-PENDENTE.md` é resumo executivo manual, não é fonte de máquina e não deve ser parseado pelo kit. O kit é derivado dos dados e das mesmas funções de relatório/validação; não é uma terceira lista.
- **FR-36 (P1)** Se `CONTEUDO-PENDENTE.md` divergir do relatório gerado, vale o relatório; o kit deve falhar se uma dependência pendente do relatório não tiver mapeamento no questionário. A correção do MD é manual e fora do comando.
- **FR-37 (P1)** O kit não pode alterar o comportamento do site: `npm run build`, `npm run check`, `npm test` e `npm run build:go-live` continuam com as mesmas regras. Depois de um import válido, o build de produção deve continuar excluindo o que está pendente e o go-live deve continuar listando os bloqueios reais.
- **FR-38 (P1)** O kit deve ser tratado como dado sensível: não é versionado, fica em `relatorios/` (ignorado) e o `LEIA-ME` deve orientar o envio por canal controlado. Nenhum dado de paciente pode ser incluído; o CRM do RT é dado profissional e deve ter registro de quem confirmou.
- **FR-39 (P1)** O `LEIA-ME.txt` deve explicar, em linguagem simples, como preencher, o que significam `A CONFIRMAR: `, `NAO_TEMOS` e `NAO_SABEMOS`, como salvar no Excel sem quebrar acentos/telefones/CEP e como devolver a pasta.
- **FR-40 (P1)** Deve haver testes negativos com `node:test` cobrindo, no mínimo: CSV malformado, CEP inválido, telefone fora de E.164, valor igual ao levantamento, ausência de quem confirmou, tentativa de gravar unidade como `ativo`, coluna desconhecida e planilha de outra versão. A suíte deve rodar sem escrever em `dados/` real.

---

## 5. Regras de negócio e de conteúdo

- **RN-01 Fonte única.** Cada dado de unidade continua em `dados/unidades.json`; o kit não cria cópia paralela. O questionário e as planilhas são visões derivadas, não cadastros.
- **RN-02 Confirmação é evidência, não publicação.** O bloco de confirmação registra quem declarou o dado e com qual fonte. Publicar continua exigindo os gates da 001 (`status: ativo`, `validacao.status: confirmado`, telefone `validado`, serviço/preparo aprovado, bloco aprovado, RT completo).
- **RN-03 Pré-preenchimento não é verdade.** Todo valor vindo do levantamento ou de JSON ainda não confirmado é marcado e não pode ser promovido por inércia. O silêncio da clínica não confirma nada.
- **RN-04 Sem confirmação passiva.** Um "ok" genérico não vale. A confirmação exige nome/função, canal, fonte e data; o importador rejeita linha sem esse conjunto.
- **RN-05 LGPD.** Nenhum campo do kit é destinado a dado de paciente. O questionário alerta explicitamente; o importador não deve receber, armazenar ou publicar dado de saúde individual. O CRM do RT é dado profissional, tratado com registro de quem confirmou.
- **RN-06 Resiliência ao Excel.** O kit assume que o Excel em português vai alterar formatação. O formato é escolhido para minimizar perda (BOM, `;`, texto, vírgula decimal) e o importador normaliza apenas variações inequívocas; o resto é erro explicado, não adivinhação.
- **RN-07 Sem mudança de schema ou gate.** O importador escreve nos campos existentes. Vigência de convênio é registrada em `aviso`/`atualizadoEm`; exibição estruturada no site é outra feature. Nenhum gate é afrouxado.
- **RN-08 Dado sem dono não é atribuído.** Telefone do levantamento sem unidade definida não entra em nenhuma unidade por estimativa. Endereço ausente no levantamento não é inventado.
- **RN-09 Importação é reversível.** Como `dados/` é versionado, o diff do Git é a auditoria e o rollback. O importador não cria backup automático com timestamp (isso quebraria determinismo); o log e o diff bastam.
- **RN-10 Nada é promovido automaticamente.** A promoção é um ato humano posterior, com revisão do diff e das fontes, e continua sujeita ao `npm run build:go-live`.
- **RN-11 Novas entidades.** Convênio novo é permitido; unidade e preparo novos não. Criar unidade/preparo continua sendo o fluxo manual documentado no README, para não gerar slug/rota sem revisão.
- **RN-12 Kit não é publicado.** O kit e o log ficam em `relatorios/coleta/`, ignorado no Git; nada do kit entra em `dist/`, no sitemap ou no site.

---

## 6. Requisitos não funcionais

- **NFR-01 Sem dependência nova e sem rede.** Apenas módulos nativos do Node (`node:fs/promises`, `node:path`, `node:test`, `node:assert`). Nenhuma chamada HTTP, nenhum pacote de CSV, nenhum gerador de planilha.
- **NFR-02 Determinismo.** Sem `Date.now()`, `new Date()` para conteúdo, `Math.random()`, `randomUUID()` ou ordem de `Object.entries` não controlada. Ordenação explícita por chave; JSON com 2 espaços, LF e newline final; CSV com CRLF e BOM.
- **NFR-03 Compatibilidade.** Node `>=24.11.0` (`.nvmrc`); Windows é o ambiente de uso do Excel; caminhos relativos ao repositório; nada de shell específico.
- **NFR-04 Desempenho.** Gerar o kit e importar um kit completo em menos de 5 s em máquina comum, sem compilar Tailwind.
- **NFR-05 Acessibilidade e impressão.** HTML semântico, `lang="pt-BR"`, contraste AA, foco visível, tabelas com cabeçalho, texto redimensionável, impressão A4 sem corte de tabela larga (orientação paisagem quando necessário) e sem depender de cor.
- **NFR-06 Segurança.** Sem requisição externa; sem `<script>`; sem `innerHTML` com dado da clínica; escape de HTML; rejeição de célula que comece com `=`, `@` ou `+` fora de telefone (injeção de fórmula); nenhum segredo no kit.
- **NFR-07 Manutenibilidade.** Regras de coleta isoladas em `scripts/lib/coleta.mjs` e `scripts/lib/csv.mjs`, reutilizando `dados.mjs`/`relatorio.mjs`; os CLIs apenas orquestram. Nenhuma regra de publicação duplicada.
- **NFR-08 Testabilidade.** Funções puras para parse/serialize/mapeamento; APIs programáticas aceitam `raiz` e `pasta` para testes em diretório temporário; nenhum teste escreve em `dados/` real.
- **NFR-09 Observabilidade.** Erros acumulados, ordenados e legíveis; resumo no stdout; log em Markdown e JSON; código de saída 0/1.
- **NFR-10 Rastreabilidade.** Toda linha importada aponta para arquivo, linha, entidade e bloco de confirmação; o log permite reconstruir o que veio de onde sem abrir o CSV.

---

## 7. Critérios de aceite

Critérios verificáveis por script, inspeção ou execução manual documentada. **AC-01 a AC-23 são bloqueantes para a entrega da feature.**

### 7.1 Geração e entrega

- **AC-01** `npm run coleta` gera `relatorios/coleta/` com os sete arquivos previstos, sem alterar `dados/`, `dist/` ou `src/`, sem rede e sem dependência nova. Duas execuções com a mesma entrada produzem os mesmos bytes. *Verificação:* execução + hash dos arquivos + `git status`.
- **AC-02** O `questionario.html` abre sem rede, não contém `<form>`, `<input>`, `<script>`, `iframe`, `@import`, `url(http...)` nem link externo, imprime em A4 e contém 100% de C-01..C-15. *Verificação:* inspeção + grep + impressão no navegador.
- **AC-03** Os CSVs abrem no Excel em português com acentos corretos, `;` como separador, UTF-8 com BOM, CRLF e decimal com vírgula; os cabeçalhos batem exatamente com o modelo `coleta-1`. *Verificação:* abrir no Excel/Windows + teste de bytes.
- **AC-04** Todo valor de dado pré-preenchido não confirmado está marcado com `A CONFIRMAR: `; chaves estruturais (`slug`, `id`, `matriz`, versão, data-base, localizador) são referência sem marca; telefones do levantamento sem unidade não estão em nenhuma linha de unidade; o anexo do questionário os lista. *Verificação:* inspeção + teste automatizado do modelo.
- **AC-05** O questionário e as planilhas listam todas as dependências pendentes do relatório, e uma dependência pendente sem mapeamento faz a geração falhar. *Verificação:* teste com relatório injetado + inspeção.

### 7.2 Importação

- **AC-06** Um kit de teste válido é importado; `dados/*.json` recebe os valores; a unidade permanece `a-confirmar`/`pendente`, o preparo permanece `pendente`, o bloco permanece `pendente` e o RT permanece `pendente`. `npm run build` continua validando o resultado. *Verificação:* teste de integração em cópia temporária + `validarDados`.
- **AC-07** CSV malformado (aspas não fechadas, número de colunas inconsistente, cabeçalho ausente) falha com todos os erros listados, código de saída 1 e nenhum JSON alterado. *Verificação:* teste negativo.
- **AC-08** CEP inválido, telefone fora de E.164, data inválida, coordenada incompleta ou decimal inválido falham com `arquivo:campo:entidade` e detalhe legível. *Verificação:* testes negativos por campo.
- **AC-09** Telefone idêntico a exemplo de `dados/exemplos-briefing.json` continua recusado, mesmo com bloco de confirmação; a mensagem explica que o exemplo precisa ser removido após a confirmação. *Verificação:* teste negativo.
- **AC-10** Linha com dado e sem `confirmado_por`, `como_confirmou`, `fonte` ou `data_confirmacao` falha; linha só com sentinela/vazia é ignorada e listada. *Verificação:* testes negativos e de log.
- **AC-11** Tentativa de gravar unidade como `ativo`, validação como `confirmado`, preparo como `aprovado`, bloco como `aprovado` ou RT como `confirmado` é recusada (coluna desconhecida ou campo não importável) e não altera o JSON. *Verificação:* teste negativo + invariantes pós-importação.
- **AC-12** Coluna desconhecida, coluna ausente, coluna duplicada, `tipo_registro` errado e `modelo_versao` diferente de `coleta-1` falham com erro explícito; a ordem das colunas pode variar. *Verificação:* testes negativos.
- **AC-13** Slug de unidade desconhecido, slug duplicado, `id` divergente, mudança de `matriz` ou de `servico_id` de preparo falham; nenhuma entidade nova de unidade/preparo é criada. *Verificação:* testes negativos.
- **AC-14** Mudança em entidade já confirmada sem `--sobrescrever` falha; com a flag, grava, rebaixa para pendente quando aplicável e lista cada sobrescrita no log. *Verificação:* teste negativo + teste com flag.
- **AC-15** Célula vazia preserva o valor existente; `NAO_TEMOS` grava ausência; `NAO_SABEMOS` não inventa valor e é registrado; sentinela não é importada. *Verificação:* teste de matriz de estados.
- **AC-16** O importador é idempotente: o mesmo kit aplicado duas vezes produz os mesmos bytes de JSON e log e **não exige `--sobrescrever` na segunda execução**; `dados/site.json:atualizadoEm` permanece idêntico ao valor anterior à importação (base de geração, não data de conteúdo), e as datas por entidade (`unidades[].atualizadoEm`, `validacao.data`, `convenios.atualizadoEm`, `preparos[].revisao.data` e `paginas.atualizadoEm`, este quando o bloco editorial da página é importado) recebem a **maior** data entre a existente e a maior `data_confirmacao` do kit (`max`), nunca regridem e nunca usam o relógio. *Verificação:* hash em duas execuções + conferência da base e das datas por entidade.
- **AC-17** Telefone institucional preenchido precisa ser igual ao telefone principal da matriz; matriz precisa de exatamente um principal validado; referência a serviço/convênio inexistente falha. *Verificação:* testes negativos + uso do validador.
- **AC-18** Em qualquer erro, nenhum arquivo de `dados/` é escrito; o log registra "nada foi gravado". *Verificação:* hash antes/depois + teste de falha no meio da validação.
- **AC-19** A suíte `npm test` cobre todos os casos negativos desta spec e não escreve em `dados/` real; a suíte existente da 001 continua passando. *Verificação:* execução + inspeção dos testes.
- **AC-20** O gate de publicação não mudou: depois de um import válido, `npm run build:go-live` continua falhando e listando os bloqueios reais; `npm run build` continua excluindo o que está pendente; nenhum dado importado aparece em produção sem promoção manual. *Verificação:* execução antes/depois + inspeção do relatório.

### 7.3 Segurança e operação

- **AC-21** O kit não contém campo destinado a dado de paciente e exibe aviso de LGPD no HTML e no `LEIA-ME`; o log registra apenas os campos do modelo e não cria campo para paciente. Eventual dado de paciente digitado em texto livre é removido na revisão antes do envio/importação. *Verificação:* inspeção + grep + checklist de revisão.
- **AC-22** O kit gerado e o log estão sob `relatorios/`, ignorados pelo Git; nenhum valor pré-preenchido é commitado. *Verificação:* `git status` + `.gitignore`.
- **AC-23** Célula iniciada por `=`, `@` ou `+` fora de telefone é recusada como possível injeção de fórmula; o HTML escapa todo texto da clínica. *Verificação:* testes negativos + inspeção.

---

## 8. Relação entre fontes de verdade

| Artefato | Natureza | Quem atualiza | Papel no kit |
|---|---|---|---|
| `dados/*.json` | Fonte de verdade | Importador ou edição manual revisada | Origem dos valores e destino da importação |
| `dados/exemplos-briefing.json` | Levantamento não validado | Coordenador, apenas após confirmação | Anexo "a confirmar"; trava de valor idêntico |
| `relatorios/pendencias.md`/`.json` | Derivado do build | `npm run build`/`--check` | Fonte operacional das pendências; o kit usa as mesmas funções, não o arquivo velho |
| `CONTEUDO-PENDENTE.md` | Resumo executivo manual | Coordenador | Não é lido por script; se divergir, vale o relatório |
| `relatorios/coleta/*` | Derivado e sensível | `npm run coleta` e o importador | Entrega para a clínica; nunca versionado |
| `dados-teste/unidades.exemplo.json` | Fictício, só rascunho | Time técnico | Fora do kit; nunca pré-preenche dado real |

**Regra:** o kit não substitui o relatório nem o `CONTEUDO-PENDENTE.md`; ele é uma visão de coleta derivada dos mesmos dados. Se uma dependência nova for criada no relatório e não houver mapeamento no questionário, a geração falha — é melhor falhar do que coletar uma lista incompleta.

---

## 9. Premissas e suposições registradas

| # | Suposição | Impacto se falsa |
|---|---|---|
| S-01 | A clínica tem Excel no Windows e consegue editar CSV | Necessário oferecer outro formato (fora do escopo) |
| S-02 | Um único interlocutor devolve a pasta completa | Múltiplos retornos exigem mesclar planilhas; o importador ainda aceita, mas o processo fica manual |
| S-03 | O RT é o mesmo para a rede ou será indicado por unidade no questionário | Se houver RT por unidade, o campo `responsavelTecnico` da unidade continua manual (Q-05 da 001) |
| S-04 | A vigência de convênio pode ser registrada como texto em `aviso` e data de atualização do catálogo | Se o cliente exigir vigência estruturada por convênio no site, é mudança de schema/template fora desta feature |
| S-05 | O volume é pequeno (7 unidades, 5 serviços, 5 preparos, catálogo de convênios inicial) | Volume maior ainda funciona, mas a planilha de unidades fica larga |
| S-06 | A clínica aceita responder em CSV, não em formulário web | Sem formulário/Google Forms por decisão de escopo |
| S-07 | O coordenador revisa o diff antes de promover status | Sem revisão, o import vira confirmação passiva (risco R-01) |
| S-08 | O preview público no GitHub Pages publica o build de rascunho e, após uma importação real, inclui entidades ainda pendentes de `dados/*.json`. O usuário aceitou esse risco de forma consciente e documentada; não há mudança de workflow, build ou `noindex` nesta feature | Se o aceite for revisto, será preciso bloquear ou limpar o preview antes de importar dados reais — mudança de workflow fora desta feature (R-16) |

---

## 10. Dependências de conteúdo

O kit existe para coletar C-01..C-15. Ele não fecha nenhuma dependência sozinho; ele reduz o atrito e produz evidência. As dependências continuam sendo as da 001:

| # | Dependência | Quem responde | Onde no kit |
|---|---|---|---|
| C-01 | Unidades ativas (incl. Quixeramobim) | Clínica | Questionário + `unidades.csv` (referência) |
| C-02 | Endereço, CEP e coordenadas | Clínica | `unidades.csv` |
| C-03 | Telefones e WhatsApp oficial | Clínica | `unidades.csv` + anexo do levantamento |
| C-04 | Horários | Clínica | `unidades.csv` |
| C-05 | Serviços por unidade | Clínica | `unidades.csv` + questionário |
| C-06 | Convênios e vigência | Clínica | `convenios.csv` + `unidades.csv` |
| C-07 | Particular, documentos e pagamento | Clínica | `unidades.csv` (atendimento particular) + questionário; documentos/formas de pagamento, se aprovados, entram no texto da página de convênios (`textos.csv`) |
| C-08 | RT: nome, CRM/UF, especialidade | Clínica/RT | `site.csv` |
| C-09 | Preparos revisados pelo RT | RT | `preparos.csv` |
| C-10 | Texto institucional e diferenciais | Clínica | `textos.csv` |
| C-11 | Logo, cores, tipografia, fotos e autorizações | Clínica | Questionário (arquivo por fora) |
| C-12 | Domínio e acesso ao DNS/hospedagem | Clínica | Questionário (operacional, sem campo JSON) |
| C-13 | Prazo médio de laudo (opcional) | Clínica | Questionário |
| C-14 | Política de privacidade/aviso legal | Clínica + jurídico | `textos.csv` |
| C-15 | E-mail institucional e redes | Clínica | `site.csv` |

**Limitações de mapeamento.** C-07 (formas de pagamento e documentos por unidade), C-11 (arquivos de identidade/fotos), C-12 (DNS/hospedagem) e C-13 (prazo de laudo) não têm campo estruturado no schema atual. O kit os coleta no questionário; C-07 pode ser registrado como texto da página de convênios, mas não há campo por unidade. Exibir pagamento/documentos por unidade exigiria mudança de schema/template, fora desta feature.

---

## 11. Riscos (resumo; detalhamento e mitigação no `plan.md`)

1. **Confirmação passiva.** Alguém marca "confirmo" sem conferir. Mitigação: bloco com quatro campos, canal enumerado, fonte obrigatória, importação sem promoção e revisão humana do diff.
2. **Planilha com dados de outra unidade.** Linha copiada ou arrastada no Excel. Mitigação: `slug`/`id` imutáveis, `tipo_registro`, duplicidade recusada, questionário por unidade e log por entidade.
3. **Formatação alterada pelo Excel.** Telefone sem `+`, CEP sem zero, data convertida, decimal com vírgula, acentos quebrados. Mitigação: BOM/`;`/CRLF, colunas de texto, normalização inequívoca, mensagens de erro específicas e teste no Excel.
4. **LGPD e CRM.** Inclusão de dado de paciente em texto livre; CRM do RT sem registro de quem confirmou. Mitigação: aviso explícito, nenhum campo de paciente, confirmação nominal e fonte, kit ignorado no Git.
5. **Divergência depois de duas importações e kit de rodada antiga (R-05/R-14).** Reimportar um kit antigo pode sobrescrever dado mais novo. Mitigação: idempotência com `site.atualizadoEm` fixo como base de geração, datas por entidade pela maior data entre a existente e a confirmação importada, proteção de campo confirmado, `--sobrescrever` explícito e log. **Alcance real (R-14):** como `site.atualizadoEm` só muda por edição manual, a comparação de base só acusa kit antigo depois que alguém atualiza essa data à mão; o risco fica mais estreito, não eliminado. A proteção principal contra sobrescrita é a regra de entidade confirmada + `--sobrescrever` + a regra de maior data por entidade (AD-15/AD-15.1 no `plan.md`).
6. **Pré-preenchimento virar verdade.** Valor do levantamento ou do JSON pendente tratado como confirmado. Mitigação: prefixo `A CONFIRMAR: `, trava de exemplo do briefing, status nunca promovido.
7. **Telefone confirmado igual ao exemplo do briefing.** A trava existente recusa para sempre. Mitigação: processo deliberado de remoção do exemplo após confirmação, documentado e testado; o importador não remove sozinho.
8. **Vigência de convênio sem exibição.** O dado é coletado, mas o site hoje mostra apenas a data de atualização. Mitigação: registrar em `aviso`/`atualizadoEm` e registrar a limitação; exibição por convênio é feature separada.
9. **Kit commitado por engano.** Dados não confirmados no Git. Mitigação: saída em `relatorios/` ignorado e `LEIA-ME` explícito; AC-22.
10. **Gate afrouxado por engano.** O importador gravar `validado`/`confirmado` e o site publicar. Mitigação: invariantes de status, testes negativos, `npm run build:go-live` inalterado.
11. **Preview público expõe rascunho com entidades pendentes.** Após uma importação real, o preview do GitHub Pages publica o build de rascunho, que inclui o que ainda não foi promovido em `dados/*.json`. Risco **aceito conscientemente pelo usuário** e documentado (R-16/S-08); nesta feature não há mudança de workflow, build, template ou `noindex`. A condução é operacional e fora do escopo: importar apenas quando a exposição for aceitável e nunca tratar o preview como produção ou como publicação aprovada.

---

## 12. Questões abertas

| # | Questão | Por que importa | Default desta spec |
|---|---|---|---|
| Q-01 | A vigência por convênio precisa aparecer no site, ou basta coletar e registrar? | Hoje o site exibe a data de atualização da lista, não a vigência por operadora. Exibir exigiria mudança de schema/template. | Coletar e registrar em `aviso`/`atualizadoEm`; não alterar o site nesta feature |
| Q-02 | Quem é a autoridade de confirmação por tipo de dado? | O bloco exige nome/função; uma pessoa sem autonomia pode confirmar errado. | Gestor da clínica para unidade/contato/convênios; RT para preparo/CRM; jurídico para privacidade. O kit registra o nome, não valida a autoridade |
| Q-03 | A saída em `relatorios/coleta/` (ignorada) atende ao envio, ou o time quer uma pasta versionada? | Dados não confirmados no Git são risco de LGPD/versão. | Manter ignorada; o coordenador compacta e envia por canal controlado |

**Nota (2026-11-23):** não há questão aberta sobre o preview público. A exposição do rascunho no GitHub Pages após uma importação real é **risco aceito** pelo usuário e está registrada como premissa S-08 e risco R-16 (detalhado no `plan.md`), não como decisão pendente. Q-01..Q-03 permanecem como acima.
