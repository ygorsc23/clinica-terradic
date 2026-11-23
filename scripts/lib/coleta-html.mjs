/**
 * Questionario imprimivel do kit de coleta.
 *
 * Regras do documento (FR-05..FR-11):
 * - HTML unico e autocontido, em pt-BR, com CSS embutido.
 * - Sem formulario, sem campo de entrada, sem script, sem frame, sem importacao
 *   de CSS, sem imagem e sem link/requisicao externa.
 * - Impressao A4, contraste adequado, quebra de pagina por unidade.
 * - Uma secao por unidade, perguntas agrupadas por C-xx, exemplos de formato,
 *   opcao explicita de "nao temos / nao sabemos" e bloco de confirmacao.
 * - Aviso de LGPD, anexo dos telefones do levantamento sem unidade e folha de
 *   assinatura.
 */

import { escapar } from './render.mjs';

const CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { font-size: 11pt; }
body {
  margin: 0 auto;
  max-width: 190mm;
  padding: 10mm 4mm 14mm;
  color: #111111;
  background: #ffffff;
  font-family: "Segoe UI", Arial, Helvetica, sans-serif;
  line-height: 1.45;
}
h1 { font-size: 20pt; line-height: 1.2; margin: 0 0 4mm; }
h2 { font-size: 15pt; line-height: 1.25; margin: 8mm 0 2mm; padding-bottom: 1mm; border-bottom: 1px solid #333333; }
h3 { font-size: 12.5pt; line-height: 1.3; margin: 5mm 0 2mm; }
h4 { font-size: 11.5pt; margin: 4mm 0 1.5mm; }
p, li, td, th { font-size: 10.5pt; }
p { margin: 0 0 2.5mm; }
ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
li { margin-bottom: 1mm; }
table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; }
caption { text-align: left; font-weight: 700; padding: 0 0 1.5mm; }
th, td { border: 1px solid #555555; padding: 1.5mm 2mm; text-align: left; vertical-align: top; }
thead th { background: #eeeeee; font-weight: 700; }
tbody th { background: #f7f7f7; font-weight: 600; }
.aviso { border: 2px solid #111111; padding: 3mm 3.5mm; margin: 3mm 0 4mm; }
.aviso h3 { margin-top: 0; }
.caixa { font-family: Consolas, "Courier New", monospace; overflow-wrap: anywhere; }
.slug { font-weight: 400; font-size: 11pt; }
.legenda { font-size: 9.5pt; color: #333333; }
.rodape { margin-top: 10mm; border-top: 1px solid #333333; padding-top: 2mm; font-size: 9.5pt; color: #222222; }
.quebra { page-break-before: always; break-before: page; }
.pagina-nova { page-break-before: always; break-before: page; }
.assinatura-linha { margin-top: 12mm; border-top: 1px solid #111111; width: 90mm; padding-top: 1.5mm; font-size: 9.5pt; }
@media print {
  body { max-width: none; padding: 0; margin: 0; }
  h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  caption { page-break-after: avoid; break-after: avoid; }
  .rodape { page-break-before: avoid; break-before: avoid; }
}
@page { size: A4; margin: 18mm; }
`;

const RESPOSTA_NAO_TEMOS = '[ ] informado nas planilhas   [ ] não temos   [ ] não sabemos';

function tabela({ legenda, colunas, linhas, classe = '' }) {
  const classeAtributo = classe ? ` class="${escapar(classe)}"` : '';
  const cabecalho = colunas.map((coluna) => `<th scope="col">${escapar(coluna)}</th>`).join('');
  const corpo = linhas
    .map((linha) => `<tr>${linha.map((celula) => `<td>${escapar(celula)}</td>`).join('')}</tr>`)
    .join('\n');
  return `<table${classeAtributo}>
<caption>${escapar(legenda)}</caption>
<thead><tr>${cabecalho}</tr></thead>
<tbody>
${corpo}
</tbody>
</table>`;
}

function dependencia(modelo, id) {
  return modelo.dependencias.find((item) => item.id === id) ?? {
    id,
    item: 'Dependência sem descrição no relatório.',
    responsavel: '-',
    pendente: true,
    bloqueia: false,
    ondeResponder: '-',
    secoes: []
  };
}

function linhaDependencia(modelo, id, comResposta = true) {
  const item = dependencia(modelo, id);
  const base = [item.id, item.item, item.ondeResponder];
  if (comResposta) {
    base.push(RESPOSTA_NAO_TEMOS);
  }
  return base;
}

function tabelaPerguntas(modelo, ids, legenda) {
  return tabela({
    legenda,
    colunas: ['Dependência', 'O que precisamos', 'Onde responder', 'Resposta'],
    linhas: ids.map((id) => linhaDependencia(modelo, id))
  });
}

function blocoConfirmacao(rotulo) {
  return tabela({
    legenda: `Bloco de confirmação — ${rotulo}`,
    colunas: ['Campo', 'Preenchimento'],
    linhas: [
      ['Confirmação', '[ ] confirmo   [ ] corrijo'],
      ['Quem confirmou', 'Nome e função (mínimo 3 caracteres)'],
      ['Como confirmou', '[ ] e-mail   [ ] telefone   [ ] reunião   [ ] documento   [ ] WhatsApp'],
      ['Fonte', 'Assunto, protocolo, arquivo ou ata que comprova (mínimo 3 caracteres)'],
      ['Data da confirmação', 'DD/MM/AAAA']
    ]
  });
}

function tabelaConhecidos(conhecidos, legenda) {
  if (conhecidos.length === 0) {
    return '<p>Nenhum valor registrado no levantamento para este bloco. A clínica informa nas planilhas.</p>';
  }
  return tabela({
    legenda,
    colunas: ['Campo', 'Valor conhecido', 'Situação'],
    linhas: conhecidos.map((item) => [item.rotulo, item.valor, item.situacao])
  });
}

function tabelaPendencias(pendencias) {
  if (pendencias.length === 0) {
    return '<p>Nenhuma pendência registrada no relatório para este bloco.</p>';
  }
  return tabela({
    legenda: 'Campos pendentes no relatório do build',
    colunas: ['Campo', 'Situação'],
    linhas: pendencias.map((item) => [item.campo, item.situacao])
  });
}

function secaoUnidade(modelo, unidade) {
  const partes = [];
  partes.push(`<section class="pagina-nova" id="unidade-${escapar(unidade.slug)}">`);
  partes.push(
    `<h2>Unidade: ${escapar(unidade.nome)} <span class="slug">(${escapar(unidade.slug)})</span></h2>`
  );
  partes.push(
    `<p>Status atual: ${escapar(unidade.status)} · validação: ${escapar(
      unidade.validacao
    )} · ${unidade.confirmada ? 'unidade já confirmada: os valores servem de referência e não serão reconfirmados no CSV.' : 'os valores marcados como "a confirmar" não foram confirmados pela clínica.'}</p>`
  );
  partes.push(
    tabela({
      legenda: 'Referência estrutural (não alterar)',
      colunas: ['Campo', 'Valor'],
      linhas: unidade.referencia.map((item) => [item.rotulo, item.valor])
    })
  );
  partes.push(tabelaConhecidos(unidade.conhecidos, 'Dados já conhecidos desta unidade'));
  partes.push(tabelaPendencias(unidade.pendencias));
  partes.push(
    tabelaPerguntas(
      modelo,
      ['C-01', 'C-02', 'C-03', 'C-04', 'C-05', 'C-06', 'C-07'],
      `Perguntas desta unidade — ${unidade.nome}`
    )
  );
  partes.push('<h3>Exemplos de formato</h3>');
  partes.push(`<ul>
<li>Telefone: <span class="caixa">+5585900000000</span> (E.164, com o sinal + e sem espaços).</li>
<li>CEP: <span class="caixa">60000000</span> (8 dígitos, sem hífen).</li>
<li>Data: <span class="caixa">20/11/2026</span>.</li>
<li>Coordenada: <span class="caixa">-3,7319</span> (vírgula decimal).</li>
<li>Horário: <span class="caixa">seg,ter,qua,qui,sex:08:00-18:00:Atendimento por ordem de chegada|sab:08:00-12:00</span>.</li>
<li>Lista de serviços ou convênios: <span class="caixa">tomografia|mamografia</span>.</li>
<li>Não temos: <span class="caixa">NAO_TEMOS</span>. Não sabemos: <span class="caixa">NAO_SABEMOS</span>.</li>
</ul>`);
  partes.push(blocoConfirmacao(`unidade ${unidade.nome}`));
  partes.push('</section>');
  return partes.join('\n');
}

function secaoAnexo(modelo) {
  const partes = [];
  partes.push('<section class="pagina-nova" id="anexo-telefones">');
  partes.push('<h2>Anexo: telefones do levantamento preliminar</h2>');
  partes.push(`<p>Estes telefones vieram do levantamento preliminar e <strong>não têm unidade definida</strong>.
Eles não foram atribuídos a nenhuma unidade por suposição e não estão pré-preenchidos em
<span class="caixa">unidades.csv</span>. Se algum for confirmado, informe a unidade, o setor e a fonte no bloco de
confirmação da unidade; o coordenador remove o exemplo do levantamento como ato deliberado.</p>`);
  partes.push(
    tabela({
      legenda: 'Telefones sem unidade — a confirmar',
      colunas: ['Valor no levantamento', 'Observação'],
      linhas: modelo.anexo.telefones.map((telefone) => [telefone.exibicao, telefone.observacao])
    })
  );
  if (modelo.anexo.enderecos.length === 0) {
    partes.push(
      '<p>O levantamento não trazia endereço completo. Nenhum endereço foi inventado nem atribuído a unidade.</p>'
    );
  } else {
    partes.push(
      tabela({
        legenda: 'Endereços do levantamento — a confirmar',
        colunas: ['Referência'],
        linhas: modelo.anexo.enderecos.map((endereco) => [String(endereco)])
      })
    );
  }
  partes.push(
    '<p class="legenda">Dependência atendida por este anexo: C-03 (telefones e WhatsApp oficial).</p>'
  );
  partes.push('</section>');
  return partes.join('\n');
}

function secaoSite(modelo) {
  const partes = [];
  partes.push('<section class="pagina-nova" id="site">');
  partes.push('<h2>Site, responsável técnico, contato e redes</h2>');
  partes.push(
    '<p>Responder em <span class="caixa">site.csv</span>. O CRM/UF do responsável técnico é dado profissional e só é registrado com o nome de quem confirmou.</p>'
  );
  partes.push(tabelaConhecidos(modelo.site.conhecidos, 'Dados institucionais já conhecidos'));
  partes.push(tabelaPendencias(modelo.site.pendencias));
  partes.push(tabelaPerguntas(modelo, ['C-08', 'C-15'], 'Perguntas de identificação e contato'));
  partes.push(`<h3>Exemplos de formato</h3>
<ul>
<li>CRM/UF: <span class="caixa">12345/CE</span>.</li>
<li>E-mail: <span class="caixa">contato@dominio</span> (sem link; apenas o endereço).</li>
<li>Telefone institucional: <span class="caixa">+5585900000000</span>; quando a matriz tiver telefone principal, os dois precisam ser iguais.</li>
<li>Instagram/Facebook: informe o endereço completo do perfil ou <span class="caixa">NAO_TEMOS</span>.</li>
</ul>`);
  partes.push(blocoConfirmacao('responsável técnico, contato e redes'));
  partes.push('</section>');
  return partes.join('\n');
}

function secaoServicos(modelo) {
  const partes = [];
  partes.push('<section class="pagina-nova" id="servicos">');
  partes.push('<h2>Serviços</h2>');
  partes.push(
    '<p>Os serviços existentes estão listados abaixo. O kit não cria serviço novo: para incluir um serviço, o coordenador ajusta o cadastro manualmente antes de gerar o kit novamente.</p>'
  );
  partes.push(
    tabela({
      legenda: 'Serviços cadastrados',
      colunas: ['ID', 'Nome', 'Status'],
      linhas: modelo.servicos.map((servico) => [servico.id, servico.nome, servico.status])
    })
  );
  partes.push(tabelaPerguntas(modelo, ['C-05', 'C-13'], 'Perguntas de serviços e prazo de laudo'));
  partes.push('</section>');
  return partes.join('\n');
}

function secaoConvenios(modelo) {
  const partes = [];
  partes.push('<section class="pagina-nova" id="convenios">');
  partes.push('<h2>Convênios e vigência</h2>');
  if (modelo.convenios.length === 0) {
    partes.push(
      '<p>O catálogo está vazio nesta rodada. Acrescente uma linha em <span class="caixa">convenios.csv</span> para cada convênio aceito e vincule as unidades na coluna <span class="caixa">unidades</span>.</p>'
    );
  } else {
    partes.push(
      tabela({
        legenda: 'Convênios já cadastrados',
        colunas: ['ID', 'Nome', 'Tipo'],
        linhas: modelo.convenios.map((convenio) => [convenio.id, convenio.nome, convenio.tipo])
      })
    );
  }
  partes.push(tabelaPerguntas(modelo, ['C-06'], 'Perguntas de convênios'));
  partes.push(`<p>A vigência informada é registrada como texto no aviso do convênio e na data de
atualização do catálogo. O site não exibe vigência por operadora nesta fase.</p>`);
  partes.push(`<h3>Exemplos de formato</h3>
<ul>
<li>ID do convênio: <span class="caixa">saude-caixa</span> (minúsculas, números e hífen).</li>
<li>Vigência: <span class="caixa">01/01/2026</span> até <span class="caixa">31/12/2026</span>.</li>
<li>Unidades: <span class="caixa">caninde|pacajus</span>; se não tivermos convênio: <span class="caixa">NAO_TEMOS</span>.</li>
</ul>`);
  partes.push(blocoConfirmacao('convênios'));
  partes.push('</section>');
  return partes.join('\n');
}

function secaoParticular(modelo) {
  const partes = [];
  partes.push('<section class="pagina-nova" id="particular">');
  partes.push('<h2>Atendimento particular, documentos e pagamento</h2>');
  partes.push(`<p>O atendimento particular é respondido por unidade em
<span class="caixa">unidades.csv</span>. Formas de pagamento e documentos exigidos não têm campo
próprio por unidade nesta fase: se a clínica aprovar, o conteúdo entra no texto da página de
convênios (<span class="caixa">textos.csv</span>).</p>`);
  partes.push(tabelaPerguntas(modelo, ['C-07'], 'Perguntas de atendimento particular'));
  partes.push(blocoConfirmacao('atendimento particular e documentos'));
  partes.push('</section>');
  return partes.join('\n');
}

function secaoPreparos(modelo) {
  const partes = [];
  partes.push('<section class="pagina-nova" id="preparos">');
  partes.push('<h2>Preparos e revisão do responsável técnico</h2>');
  partes.push(
    '<p>Responder em <span class="caixa">preparos.csv</span>. O kit não cria preparo novo e não aprova conteúdo clínico: a revisão do RT é registrada como pendente e a promoção continua manual.</p>'
  );
  partes.push(
    tabela({
      legenda: 'Preparos cadastrados',
      colunas: ['Exame', 'Serviço', 'Revisão'],
      linhas: modelo.preparos.map((preparo) => [preparo.exame, preparo.servicoId, preparo.status])
    })
  );
  partes.push(tabelaPerguntas(modelo, ['C-09'], 'Perguntas de preparo'));
  partes.push(`<h3>Exemplos de formato</h3>
<ul>
<li>Documentos: <span class="caixa">pedido medico|documento com foto</span>.</li>
<li>Itens sem conteúdo: <span class="caixa">NAO_TEMOS</span> grava lista vazia.</li>
<li>Revisão: nome do RT, CRM/UF e data no bloco de confirmação.</li>
</ul>`);
  partes.push(blocoConfirmacao('preparos — revisão do RT'));
  partes.push('</section>');
  return partes.join('\n');
}

function secaoTextos(modelo) {
  const partes = [];
  partes.push('<section class="pagina-nova" id="textos">');
  partes.push('<h2>Textos editoriais</h2>');
  partes.push(
    '<p>Responder em <span class="caixa">textos.csv</span>, um bloco por linha. Célula de texto vazia preserva o conteúdo atual e o bloco continua pendente. O kit não insere bloco novo: se faltar uma seção, o coordenador cria o bloco em <span class="caixa">paginas.json</span> e gera o kit de novo.</p>'
  );
  partes.push(
    tabela({
      legenda: 'Blocos editoriais pendentes',
      colunas: ['Página', 'Bloco', 'Tipo'],
      linhas: modelo.textos.map((texto) => [texto.pagina, texto.bloco, texto.tipo])
    })
  );
  partes.push(tabelaPerguntas(modelo, ['C-10'], 'Perguntas de texto institucional'));
  partes.push(blocoConfirmacao('textos editoriais'));
  partes.push('</section>');
  return partes.join('\n');
}

function secaoPrivacidade(modelo) {
  const partes = [];
  partes.push('<section class="pagina-nova" id="privacidade">');
  partes.push('<h2>Política de privacidade</h2>');
  partes.push(
    '<p>O texto da política é respondido no bloco <span class="caixa">privacidade</span> de <span class="caixa">textos.csv</span> e só é publicado após aprovação da clínica e do jurídico.</p>'
  );
  partes.push(tabelaPerguntas(modelo, ['C-14'], 'Perguntas de privacidade e aviso legal'));
  partes.push(blocoConfirmacao('política de privacidade — jurídico'));
  partes.push('</section>');
  return partes.join('\n');
}

function secaoIdentidade(modelo) {
  const partes = [];
  partes.push('<section class="pagina-nova" id="identidade">');
  partes.push('<h2>Identidade visual, fotos e autorizações</h2>');
  partes.push(tabelaPerguntas(modelo, ['C-11'], 'Perguntas de identidade visual'));
  partes.push(`<p>Os arquivos (logotipo em SVG, brandbook, tipografia licenciada e fotos com autorização)
são entregues por fora do kit, em pasta separada. Este questionário apenas registra o que existe e
quem autorizou.</p>`);
  partes.push(blocoConfirmacao('identidade visual e autorizações'));
  partes.push('</section>');
  return partes.join('\n');
}

function secaoDominio(modelo) {
  const partes = [];
  partes.push('<section class="pagina-nova" id="dominio">');
  partes.push('<h2>Domínio, DNS e hospedagem</h2>');
  partes.push(tabelaPerguntas(modelo, ['C-12'], 'Perguntas de domínio e hospedagem'));
  partes.push(
    '<p>Este item é operacional e não tem campo em <span class="caixa">dados/*.json</span>. Nunca envie senhas pelo kit; o acesso é combinado por canal seguro com o coordenador.</p>'
  );
  partes.push(blocoConfirmacao('domínio e hospedagem — responsável técnico da TI'));
  partes.push('</section>');
  return partes.join('\n');
}

function secaoLaudo(modelo) {
  const partes = [];
  partes.push('<section class="pagina-nova" id="laudo">');
  partes.push('<h2>Prazo médio de laudo (opcional)</h2>');
  partes.push(tabelaPerguntas(modelo, ['C-13'], 'Pergunta de prazo de laudo'));
  partes.push(
    '<p>Responda apenas se a clínica decidir divulgar o prazo. A ausência da resposta não bloqueia o go-live.</p>'
  );
  partes.push(blocoConfirmacao('prazo médio de laudo'));
  partes.push('</section>');
  return partes.join('\n');
}

function secaoAssinatura() {
  return `<section class="pagina-nova">
<h2>Folha de assinatura e checklist de devolução</h2>
<p>A assinatura é opcional; a prova de confirmação é o bloco preenchido em cada planilha. Use esta
folha para fechar a reunião e conferir a devolução.</p>
<table>
<caption>Identificação de quem fecha o kit</caption>
<thead><tr><th scope="col">Campo</th><th scope="col">Preenchimento</th></tr></thead>
<tbody>
<tr><td>Nome</td><td>&nbsp;</td></tr>
<tr><td>Função</td><td>&nbsp;</td></tr>
<tr><td>CRM/UF (quando aplicável)</td><td>&nbsp;</td></tr>
<tr><td>Data</td><td>DD/MM/AAAA</td></tr>
</tbody>
</table>
<p class="assinatura-linha">Assinatura</p>
<h3>Checklist de devolução</h3>
<ul>
<li><span class="caixa">[ ]</span> As cinco planilhas foram revisadas.</li>
<li><span class="caixa">[ ]</span> Toda linha com dado respondido tem o bloco de confirmação completo.</li>
<li><span class="caixa">[ ]</span> Nenhuma célula com dado de paciente, exame, laudo ou CPF de paciente.</li>
<li><span class="caixa">[ ]</span> O arquivo foi salvo como CSV UTF-8 com separador ponto e vírgula.</li>
<li><span class="caixa">[ ]</span> A pasta completa foi devolvida pelo canal combinado.</li>
</ul>
</section>`;
}

export function renderizarQuestionario(modelo) {
  const partes = [];
  partes.push('<!DOCTYPE html>');
  partes.push('<html lang="pt-BR">');
  partes.push(`<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Kit de coleta de dados — Terradic</title>
<style>${CSS}</style>
</head>`);
  partes.push('<body>');
  partes.push(`<header>
<h1>Kit de coleta de dados — Terradic</h1>
<p>Versão do modelo: <strong>${escapar(modelo.modeloVersao)}</strong>. Data-base dos dados:
<strong>${escapar(modelo.dataBaseLegivel)}</strong>.</p>
<p>Destinatário: gestor da clínica, responsável técnico (RT) e jurídico.</p>
<p>Este documento é para leitura e impressão. O preenchimento oficial é nas planilhas CSV
(<span class="caixa">unidades.csv</span>, <span class="caixa">site.csv</span>,
<span class="caixa">convenios.csv</span>, <span class="caixa">preparos.csv</span> e
<span class="caixa">textos.csv</span>). Devolva a pasta completa pelo canal combinado com o
coordenador; o preenchimento não publica nada no site.</p>
</header>`);

  partes.push(`<section class="aviso" id="lgpd">
<h3>Aviso de privacidade (LGPD)</h3>
<p>Não inclua dados de paciente, exames, laudos, CPF de paciente ou informação clínica individual
neste kit, em anexo ou em qualquer célula de texto livre. O CRM do responsável técnico é dado
profissional e só deve ser registrado junto com a identificação de quem confirmou. Se um dado de
paciente for digitado por engano, ele deve ser removido antes do envio e da importação.</p>
</section>`);

  partes.push(`<section id="resumo-dependencias">
<h2>Resumo das dependências C-01 a C-15</h2>
<p>Todas as dependências conhecidas estão listadas. "Pendente" significa que o relatório do build
ainda não considera o item fechado. O questionário e as planilhas são derivados dos mesmos dados;
não há uma segunda lista de pendências.</p>`);
  partes.push(
    tabela({
      legenda: 'Dependências de conteúdo e onde responder',
      colunas: ['Dependência', 'Item', 'Responsável', 'Situação', 'Onde responder', 'Bloqueia go-live'],
      linhas: modelo.dependencias.map((item) => [
        item.id,
        item.item,
        item.responsavel,
        item.pendente ? 'pendente' : 'resolvida',
        item.ondeResponder,
        item.bloqueia ? 'sim' : 'não'
      ])
    })
  );
  partes.push('</section>');

  partes.push(`<section id="como-responder">
<h2>Como responder</h2>
<ul>
<li><span class="caixa">A CONFIRMAR: </span> é um valor do levantamento ou do JSON que ainda não foi
confirmado. Apague o prefixo e ajuste o valor para confirmar; célula que ainda tem o prefixo nunca é
importada.</li>
<li><span class="caixa">NAO_TEMOS</span> é resposta explícita de ausência (lista vazia ou ausência de
valor). Não use em campo obrigatório.</li>
<li><span class="caixa">NAO_SABEMOS</span> registra que a informação não é conhecida agora; o valor
existente é preservado e a pendência fica registrada.</li>
<li>Célula vazia significa "não informado nesta rodada" e não altera o JSON.</li>
<li>Um "ok" genérico não vale. Cada linha com dado precisa do bloco de confirmação (quem, como,
fonte e data).</li>
</ul>
</section>`);

  partes.push(`<section id="unidades">
<h2>Unidades</h2>
<p>Uma seção por unidade. Os valores estruturais (slug, ID e matriz) são referência e não podem ser
alterados. Os telefones do levantamento sem unidade definida aparecem somente no anexo; nenhuma
unidade começa com telefone pré-preenchido por suposição.</p>
</section>`);
  for (const unidade of modelo.unidades) {
    partes.push(secaoUnidade(modelo, unidade));
  }

  partes.push(secaoSite(modelo));
  partes.push(secaoServicos(modelo));
  partes.push(secaoConvenios(modelo));
  partes.push(secaoParticular(modelo));
  partes.push(secaoPreparos(modelo));
  partes.push(secaoTextos(modelo));
  partes.push(secaoPrivacidade(modelo));
  partes.push(secaoIdentidade(modelo));
  partes.push(secaoDominio(modelo));
  partes.push(secaoLaudo(modelo));
  partes.push(secaoAnexo(modelo));
  partes.push(secaoAssinatura());

  partes.push(`<footer class="rodape">
<p>Modelo ${escapar(modelo.modeloVersao)} — data-base ${escapar(modelo.dataBaseLegivel)} —
documento gerado a partir de dados/*.json; não editar à mão. O kit é derivado dos dados e não é
fonte de verdade.</p>
</footer>`);
  partes.push('</body>');
  partes.push('</html>');
  return `${partes.join('\n')}\n`;
}
