import { modelo, template } from './render.mjs';
import { TIPOS_BLOCO } from './dados.mjs';

const PARCIAL_POR_TIPO = {
  titulo: 'parciais/bloco-titulo',
  subtitulo: 'parciais/bloco-subtitulo',
  paragrafo: 'parciais/bloco-paragrafo',
  lista: 'parciais/bloco-lista',
  destaque: 'parciais/bloco-destaque',
  aviso: 'parciais/aviso-simples',
  citacao: 'parciais/bloco-citacao'
};

/**
 * Renderiza `paginas.json.blocos`. O texto entra sempre escapado (nunca HTML cru);
 * `lista` recebe itens como texto e cada um e escapado separadamente.
 * Tipo desconhecido falha o build em vez de sumir silenciosamente.
 */
export function renderizarBlocos(blocos = [], templates) {
  return blocos
    .map((bloco) => {
      const parcial = PARCIAL_POR_TIPO[bloco?.tipo];
      if (!parcial) {
        throw new Error(
          `Tipo de bloco desconhecido: ${bloco?.tipo ?? '(vazio)'} — use um de: ${TIPOS_BLOCO.join(', ')}`
        );
      }
      if (bloco.tipo === 'lista') {
        const itens = (bloco.itens ?? [])
          .map((item) => modelo(template(templates, 'parciais/lista-simples-item'), { texto: { texto: item } }))
          .join('');
        const tituloBloco = bloco.titulo
          ? modelo(template(templates, 'parciais/bloco-subtitulo'), { texto: { texto: bloco.titulo } })
          : '';
        return modelo(template(templates, parcial), { fragmento: { itens, tituloBloco } });
      }
      return modelo(template(templates, parcial), { texto: { texto: bloco.texto } });
    })
    .join('');
}

export function separarBlocosHero(blocos = []) {
  const indiceTitulo = blocos.findIndex((bloco) => bloco?.tipo === 'titulo');
  const indiceParagrafo = blocos.findIndex((bloco) => bloco?.tipo === 'paragrafo');
  const titulo = indiceTitulo >= 0 ? blocos[indiceTitulo] : null;
  const paragrafo = indiceParagrafo >= 0 ? blocos[indiceParagrafo] : null;
  const restantes = blocos.filter((_, indice) => indice !== indiceTitulo && indice !== indiceParagrafo);
  return { titulo, paragrafo, restantes };
}
