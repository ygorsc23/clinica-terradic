# Pesquisa e decisões de base — Site institucional Terradic

Registro do que embasa `spec.md` e `plan.md`, do que foi descartado e do que ainda **precisa de verificação humana**. Não é implementação.

---

## 1. Ponto de partida verificado

| Fato | Situação | Consequência |
|---|---|---|
| Diretório do projeto vazio, sem git | confirmado nesta sessão | projeto novo; nada a preservar |
| Sem `.specify/` no repositório | confirmado nesta sessão | Spec Kit indisponível; artefatos escritos à mão em `specs/001-…` (reportado ao coordenador) |
| Domínios da marca não resolvem | levantamento do coordenador | não há site antigo, redirects ou conteúdo legado a migrar |
| Presença em redes por unidade + guias de terceiros | levantamento do coordenador | SEO local é o ganho principal; NAP inconsistente é o problema a resolver |
| Portal de exames é SPA Angular de terceiro (Mobilemed) | levantamento do coordenador | tratado como ambiente externo; nenhuma integração |

Consultas web feitas nesta sessão não retornaram resultados (integração de busca indisponível). Por isso, toda afirmação normativa abaixo está marcada como **a verificar** e não foi usada para fixar número de resolução, exigência legal ou comportamento de ferramenta.

---

## 2. Qualidade dos dados recebidos (por que o validador é obrigatório)

Os exemplos de contato do briefing já mostram o problema que o site precisa resolver:

- **Formatos inconsistentes:** `(85) 3343-3739` (fixo, 8 dígitos) vs. `(85) 9928-8990` (9 dígitos, provável celular — mas com 8 dígitos após o DDD não fecha o padrão brasileiro de 9) vs. `(85) 3348-7349 / 99970-4196` (dois números na mesma célula).
- **Granularidade variável:** uma unidade com dois telefones, outra com um, outra com celular apenas.
- **Natureza incerta:** não se sabe se algum número é WhatsApp oficial, secretaria, recepção ou radiologia.
- **Unidade duvidosa:** Quixeramobim consta em CNES, mas não no levantamento comercial — pode estar inativa.
- **Dados de guias de terceiros** podem estar errados e contaminar a decisão.

Decisão derivada: **nenhum dado de contato entra por "copia e cola"**. `e164` obrigatório, `validado` por contato, `fontes[]` e gate de build (plan §3.2, spec AC-06/AC-15). O `exemplos-briefing.json` existe justamente para o validador recusar valores idênticos aos exemplos.

---

## 3. Publicidade médica (CFM)

- Referência citada no plano: Res. CFM nº 1.974/2011 e normas supervenientes. **Verificar a norma vigente em 2026 e o texto aplicável a sítios eletrônicos** antes do aceite final. Não fixamos número de resolução como requisito normativo justamente por não ter sido possível confirmar.
- Práticas que a especificação já proíbe independentemente da redação exata da norma: promessa de resultado, sensacionalismo, superlativos não comprováveis, antes/depois, imagens de pacientes, depoimentos, preços promocionais, divulgação de técnicas não reconhecidas.
- Exigência de identificação: nome empresarial, CNPJ e responsável técnico com CRM acessíveis. Tratada como RN-02/AC-21 e no rodapé global.
- Consequência de arquitetura: **não há CMS** nesta fase — texto publicado passa por revisão humana e build, o que é uma vantagem de conformidade, não uma limitação.
- Consequência de conteúdo: o texto "pioneira em telemedicina no Ceará" é posicionamento do cliente e precisa ser comprovável ou suavizado ("desde 2011", "atuação em telerradiologia"). Registrado como item de revisão.

---

## 4. Dados estruturados (schema.org)

- `MedicalClinic` é subtipo de `MedicalBusiness` → `LocalBusiness`. Portanto **um nó `MedicalClinic` já é um LocalBusiness**; criar dois nós duplicaria NAP. Decisão AD-04.
- Para rede com várias sedes, o padrão útil é: `Organization` (marca, uma vez) + um nó por unidade com `parentOrganization` apontando para a marca + `@id` estável por URL. Isso permite que o Google entenda relação matriz/filial sem inventar dados.
- `openingHoursSpecification` aceita múltiplas faixas por dia — mapeia bem para horários por serviço/unidade.
- `availableService` com `MedicalTest` é o encaixe natural para "tomografia, raio-X, mamografia…" naquela unidade.
- **Não usar** `aggregateRating`, `review`, `Offer`, `FAQPage` sem conteúdo real — risco de penalização por marcação enganosa e conflito com publicidade médica.
- **A verificar:** validação final no Rich Results Test e Schema Markup Validator após o build (spec AC-13). Não é possível garantir de antemão que o Google exiba rich result para `MedicalClinic`; o objetivo é elegibilidade e consistência, não garantia de snippet.

---

## 5. Portal de exames (Mobilemed) — risco de escopo

- É um SPA Angular com autenticação por CPF/protocolo e senha, em domínio de terceiro. **Não é possível** (nem desejável) embutir, pré-autenticar ou redirecionar com dados do paciente.
- Riscos concretos: (a) expectativa do cliente de "botão que já abre o laudo"; (b) quebra do portal mudar a experiência do site; (c) alguém sugerir iframe/`postMessage`.
- Mitigação adotada: link puro + aviso de ambiente externo + instruções de acesso em texto + proibição explícita de iframe/preload/redirect (FR-36, AC-10) e checagem no `--check`.
- **A verificar:** se o portal aceita deep link estável ou exige sessão prévia; se há página de ajuda oficial que possamos citar; se o domínio tem certificado válido e política de privacidade pública (para o aviso de privacidade do site apontar corretamente).

---

## 6. LGPD e minimização

- Dado de saúde é dado sensível (art. 11 da LGPD). A estratégia mais segura é **não coletar nada**: sem formulário, sem login, sem cookie próprio, sem analytics com identificador, sem parâmetro de exame na URL.
- Consequência: contato por `tel:`/`mailto:`/WhatsApp oficial; nenhuma promessa de retorno por formulário.
- Consequência: mapa de terceiro só após clique (evita cookie de terceiro no carregamento inicial) — decisão AD-05.
- **A verificar com o cliente:** se ele quer algum tipo de medição. Se sim, a única opção compatível é contagem agregada server-side sem cookie; ainda assim exige aviso de privacidade. Q-09.

---

## 7. Stack estática — alternativas avaliadas

| Alternativa | Por que não |
|---|---|
| WordPress/CMS | backend, atualizações, superfície de ataque, custo de hospedagem; contraria "sem backend" |
| Astro/Eleventy/Hugo | resolvem problemas que não temos (coleções, i18n, componentes); trazem atualização, plugins e depuração de terceiros; o build próprio dá o gate de conteúdo que é o diferencial do projeto |
| Next.js/SSG | runtime Node ou export com peso desnecessário; JS acima do orçamento |
| Tailwind via CDN | proibido pelo escopo; pior performance e FOUC |
| Bootstrap | peso e identidade visual genérica |
| Markdown como fonte | exige parser/dependência e abre espaço para HTML arbitrário; JSON em blocos é validável (AD-03) |
| Banco/SQLite no build | over-engineering para 7 unidades |

Tailwind CLI é a única dependência de build: versão fixada no lockfile, sem plugins, `content` apontando para templates e fragmentos.

---

## 8. SEO local — o que realmente move o ponteiro

1. **NAP consistente** entre site, JSON-LD e Google Business Profile. Divergência é o erro mais comum e o mais caro.
2. **Uma página real por unidade**, com conteúdo único (endereço, referência, telefone, horários, serviços, convênios, como chegar). Páginas geradas em massa por cidade são doorway pages e tendem a ser ignoradas.
3. **Não criar 35 páginas "serviço × cidade"**. A cobertura vem de unidade (lista serviços) + serviço (lista unidades) + links contextuais.
4. **Títulos com intenção local** ("Mamografia em Cascavel") apenas onde há página com conteúdo que sustente a promessa.
5. **Sitemap + Search Console** desde o dia 1; sem isso, a descoberta depende de rastreamento orgânico.
6. **GBP por unidade** é metade do resultado e está fora do código — declarado como dependência, não como entregável (T069).

---

## 9. Decisões que ficaram em aberto (resumo)

Ver `plan.md §15` (Q-01..Q-16). As que mais afetam arquitetura:

- **Q-01/Q-10** — quantas unidades publicam e se aceitamos página parcial. Define o escopo real do go-live e o tamanho do sitemap.
- **Q-05** — RT único ou por unidade. O modelo suporta os dois (`site.json` + `unidades[].responsavelTecnico`), mas o rodapé muda.
- **Q-06** — domínio/`www`. Um erro aqui contamina canonical, sitemap e OG de todas as páginas.
- **Q-09** — medição de audiência. Muda o aviso de privacidade e o CSP.
- **Q-11** — política de privacidade como página ou bloco. Afeta o rodapé e o sitemap.

---

## 10. Itens que exigem verificação humana antes do aceite

1. Vigência e texto da norma de publicidade médica do CFM aplicável a sites (e eventual exigência de registro/RT por estabelecimento).
2. Situação cadastral e operacional de cada filial (CNES/CNPJ), em especial Quixeramobim.
3. Existência de autorização para uso de marcas de convênios.
4. Disponibilidade de fotos reais e autorizações de imagem.
5. Comportamento e política de privacidade do portal Mobilemed.
6. Requisitos da hospedagem escolhida (headers, 404, redirects).
7. Se o cliente já possui identidade visual formal (manual de marca) ou se precisamos de um tema neutro definitivo.
