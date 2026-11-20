import { ITENS_NAV } from './paginas.mjs';
import {
  servicoAprovado,
  telefoneValidado,
  unidadeTemServicoAprovado
} from './dados.mjs';

export const ROTAS_ESTRUTURAIS_GO_LIVE = [
  { rota: '/', rotulo: 'pagina inicial' },
  { rota: '/unidades/', rotulo: 'indice de unidades' },
  { rota: '/servicos/', rotulo: 'indice de servicos' },
  { rota: '/preparo-de-exames/', rotulo: 'preparo de exames' },
  { rota: '/convenios-e-particular/', rotulo: 'convenios e atendimento particular' },
  { rota: '/sobre/', rotulo: 'sobre e responsavel tecnico' },
  { rota: '/contato/', rotulo: 'contato' },
  { rota: '/404.html', rotulo: 'pagina 404' }
];

function erro(erros, arquivo, campo, entidade, detalhe) {
  erros.push({
    codigo: `${arquivo}:${campo}:${entidade}`,
    arquivo,
    campo,
    entidade,
    detalhe
  });
}

/**
 * Gate estrito de go-live. Diferente do `npm run build` (tolerante), este modo
 * impede publicar um site vazio ou sem os dados obrigatorios de identificacao.
 * Acumula todos os motivos de uma vez para nao esconder bloqueios em serie.
 */
export function validarGoLive({ dados, publicacao, rotas }) {
  const erros = [];
  const site = dados.site ?? {};
  const rotasGeradas = new Set((rotas ?? []).map((item) => (typeof item === 'string' ? item : item?.rota)));

  // B4 — nao publicar um site vazio.
  if ((publicacao.unidades ?? []).length === 0) {
    erro(
      erros,
      'unidades.json',
      'publicadas',
      'site',
      'nenhuma unidade publicavel (status ativo, validacao confirmada, telefone validado e servico aprovado): o site iria ao ar vazio'
    );
  }

  const itensMenu = ITENS_NAV.filter((item) => rotasGeradas.has(item.rota));
  if (itensMenu.length < 2) {
    erro(
      erros,
      'rotas',
      'menu',
      'site',
      `menu principal com ${itensMenu.length} item(ns); go-live exige ao menos 2 rotas publicaveis`
    );
  }

  for (const rota of ROTAS_ESTRUTURAIS_GO_LIVE) {
    if (!rotasGeradas.has(rota.rota)) {
      erro(erros, 'rotas', rota.rota, 'site', `rota estrutural obrigatoria nao gerada: ${rota.rotulo}`);
    }
  }

  // Servico aprovado e unidade com servico publicavel.
  const servicos = dados.servicos?.servicos ?? [];
  const servicosAprovados = servicos.filter(servicoAprovado);
  if (servicosAprovados.length === 0) {
    erro(erros, 'servicos.json', 'aprovados', 'site', 'nenhum servico aprovado para publicar');
  }
  for (const unidade of dados.unidades?.unidades ?? []) {
    if (unidade?.status !== 'ativo') {
      continue;
    }
    const entidade = unidade.slug ?? unidade.id ?? 'sem-slug';
    if (!unidadeTemServicoAprovado(unidade, servicos)) {
      erro(
        erros,
        'unidades.json',
        'servicos',
        entidade,
        'unidade ativa sem nenhum servico aprovado entre os servicos informados'
      );
    }
  }

  // Blocos editoriais pendentes em paginas publicaveis.
  const paginasEditoriais = ['home', 'unidades', 'servicos', 'preparo', 'sobre', 'convenios', 'contato', 'privacidade'];
  for (const chave of paginasEditoriais) {
    if (chave === 'privacidade' && site.privacidade?.politicaPublicada !== true) {
      continue;
    }
    const blocos = dados.paginas?.paginas?.[chave]?.blocos ?? [];
    const pendentes = blocos.filter((bloco) => bloco?.status !== 'aprovado');
    if (pendentes.length > 0) {
      erro(
        erros,
        'paginas.json',
        'blocos',
        chave,
        `${pendentes.length} bloco(s) pendente(s) impedem publicar a pagina`
      );
    }
  }

  // B1 — preparo pendente exigido por servico publicavel.
  const servicosPublicados = publicacao.servicos ?? [];
  const idsServicos = new Set(servicosPublicados.map((servico) => servico.id));
  const preparosDoServico = new Set(
    servicosPublicados.flatMap((servico) => servico.preparos ?? []).filter(Boolean)
  );
  for (const preparo of dados.preparos?.preparos ?? []) {
    const necessario =
      idsServicos.has(preparo?.servicoId) || preparosDoServico.has(preparo?.id);
    if (necessario && preparo?.revisao?.status !== 'aprovado') {
      erro(
        erros,
        'preparos.json',
        'revisao.status',
        preparo?.slug ?? preparo?.id ?? 'sem-slug',
        'preparo necessario a servico publicavel sem revisao aprovada pelo responsavel tecnico'
      );
    }
  }

  // B3 — identificacao obrigatoria do rodape (RT/CRM, contato institucional e matriz).
  const rt = site.responsavelTecnico ?? {};
  if (rt.status !== 'confirmado') {
    erro(erros, 'site.json', 'responsavelTecnico.status', 'site', 'go-live exige status "confirmado"');
  }
  if (!rt.nome) {
    erro(erros, 'site.json', 'responsavelTecnico.nome', 'site', 'nome do responsavel tecnico ausente');
  }
  if (!rt.crm) {
    erro(erros, 'site.json', 'responsavelTecnico.crm', 'site', 'CRM do responsavel tecnico ausente');
  }
  if (!rt.crmUf) {
    erro(erros, 'site.json', 'responsavelTecnico.crmUf', 'site', 'UF do CRM ausente');
  }
  if (!rt.especialidade) {
    erro(
      erros,
      'site.json',
      'responsavelTecnico.especialidade',
      'site',
      'especialidade do responsavel tecnico ausente'
    );
  }

  if (!site.contatoInstitucional?.email) {
    erro(erros, 'site.json', 'contatoInstitucional.email', 'site', 'e-mail institucional ausente');
  }
  if (!site.contatoInstitucional?.telefoneE164) {
    erro(erros, 'site.json', 'contatoInstitucional.telefoneE164', 'site', 'telefone institucional ausente');
  } else if (!telefoneValidado({ e164: site.contatoInstitucional.telefoneE164, validado: true })) {
    erro(
      erros,
      'site.json',
      'contatoInstitucional.telefoneE164',
      'site',
      'telefone institucional deve estar em E.164 (+55DDNNNNNNNNN)'
    );
  }

  const matriz = (dados.unidades?.unidades ?? []).find((unidade) => unidade?.matriz === true);
  if (!matriz) {
    erro(erros, 'unidades.json', 'matriz', 'site', 'nenhuma unidade marcada como matriz');
  } else {
    const entidade = matriz.slug ?? matriz.id ?? 'matriz';
    for (const campo of ['logradouro', 'numero', 'bairro', 'cep']) {
      if (!matriz.endereco?.[campo]) {
        erro(
          erros,
          'unidades.json',
          `endereco.${campo}`,
          entidade,
          `endereco da matriz incompleto para o rodape (${campo})`
        );
      }
    }
    if (!matriz.cidade) {
      erro(erros, 'unidades.json', 'cidade', entidade, 'cidade da matriz ausente para o rodape');
    }
    if (!matriz.uf) {
      erro(erros, 'unidades.json', 'uf', entidade, 'UF da matriz ausente para o rodape');
    }
    const telefoneMatriz = (matriz.telefones ?? []).find(telefoneValidado)?.e164;
    if (matriz.validacao?.status !== 'confirmado') {
      erro(
        erros,
        'unidades.json',
        'matriz-confirmada',
        entidade,
        'a matriz precisa ter cadastro confirmado para o rodape institucional'
      );
    }
    if (!telefoneMatriz) {
      erro(
        erros,
        'unidades.json',
        'telefones',
        entidade,
        'a matriz precisa de ao menos um telefone validado para o rodape institucional'
      );
    }
    if (
      site.contatoInstitucional?.telefoneE164 &&
      telefoneMatriz &&
      site.contatoInstitucional.telefoneE164 !== telefoneMatriz
    ) {
      erro(
        erros,
        'site.json',
        'contatoInstitucional.telefoneE164',
        'site',
        'deve ser identico ao telefone institucional da matriz'
      );
    }
  }

  return erros;
}
