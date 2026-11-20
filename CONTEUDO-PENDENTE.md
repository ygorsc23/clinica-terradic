# Conteúdo pendente — Terradic

Checklist executivo das dependências de conteúdo que bloqueiam o go-live. Espelha
`relatorios/pendencias.md` (gerado pelo build), que é a fonte operacional com todos os campos
nulos. Este arquivo é para a reunião com a clínica.

> **Identidade visual provisória.** Paleta aproximada de flyer de campanha (Pacajus) e logo
> placeholder. Não é a marca oficial (C-11).
>
> **T013 (rodapé) — parcial.** Razão social e CNPJ são publicados; RT/CRM (C-08), contato
> institucional (C-15) e endereço da matriz (C-02) seguem condicionais e bloqueiam o go-live
> estrito (`npm run build:go-live`).

| # | Dependência | Responsável | Situação | Bloqueia go-live |
|---|---|---|---|---|
| C-01 | Confirmar quais unidades estão ativas (incluindo Quixeramobim) | Clínica | pendente — as 7 unidades estão `a-confirmar` | sim |
| C-02 | Endereço completo, CEP e coordenadas de cada unidade | Clínica | pendente — campos nulos | sim |
| C-03 | Telefones oficiais por unidade (e se existe WhatsApp oficial) | Clínica | pendente — lista vazia | sim |
| C-04 | Horários de funcionamento por unidade | Clínica | pendente — lista vazia | sim |
| C-05 | Serviços efetivamente realizados em cada unidade | Clínica | pendente — lista vazia | sim |
| C-06 | Convênios aceitos por unidade (lista nominal e vigência) | Clínica | pendente — catálogo vazio | sim |
| C-07 | Formas de pagamento, documentos exigidos e atendimento particular | Clínica | pendente — `atendimentoParticular` nulo | sim |
| C-08 | Responsável técnico: nome, CRM/UF e especialidade | Clínica | pendente — `responsavelTecnico.status: pendente` | sim |
| C-09 | Textos de preparo revisados e aprovados pelo RT | RT | pendente — 5 preparos `pendente` | sim |
| C-10 | Texto institucional, história e diferenciais verificáveis | Clínica | pendente — não há bloco editorial aprovado | sim |
| C-11 | Logotipo SVG, cores oficiais, tipografia, fotos reais e autorizações de imagem | Clínica | pendente — identidade provisória | sim |
| C-12 | Domínio definitivo e acesso ao DNS/hospedagem | Clínica | pendente — `terradic.com.br` não confirmado | sim |
| C-13 | Prazo médio de laudo (somente se decidir divulgar) | Clínica | pendente — opcional | não |
| C-14 | Política de privacidade / aviso legal aprovado | Clínica + jurídico | pendente — não publicada | sim |
| C-15 | E-mail institucional oficial e redes sociais oficiais | Clínica | pendente — campos nulos | sim |

## Observações

- Telefones e endereços do levantamento preliminar estão isolados em
  `dados/exemplos-briefing.json`, com aviso de não uso. O build não os utiliza; o validador recusa
  valores idênticos aos exemplos até que a clínica confirme.
- Os dados fictícios de `dados-teste/unidades.exemplo.json` servem apenas para revisar layout com
  `npm run build:rascunho` e nunca aparecem no build de produção (o `--check` verifica isso).
- Depois de cada resposta da clínica: atualizar o JSON correspondente, rodar `npm run build` e
  `npm run check`, e revisar `relatorios/pendencias.md`.
