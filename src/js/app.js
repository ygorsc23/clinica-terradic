/**
 * Comportamento progressivo do site Terradic.
 * Sem dependencias, sem requisicoes de rede, sem armazenamento de dado pessoal.
 * Tudo aqui apenas melhora o que ja funciona sem JavaScript:
 * - menu mobile (o HTML sem JS mantem a navegacao visivel);
 * - acordeoes (<details>/<summary> funcionam nativamente);
 * - mapa como fachada (iframe do Google Maps so entra apos clique).
 */

const raiz = document.documentElement;
raiz.dataset.js = 'sim';

function configurarMenu() {
  const cabecalho = document.querySelector('[data-cabecalho]');
  const botao = document.querySelector('[data-menu-botao]');
  const painel = document.querySelector('[data-menu-painel]');
  if (!cabecalho || !botao || !painel) {
    return;
  }

  const aberto = () => botao.getAttribute('aria-expanded') === 'true';

  const definir = (valor) => {
    botao.setAttribute('aria-expanded', valor ? 'true' : 'false');
    painel.dataset.aberto = valor ? 'sim' : 'nao';
  };

  botao.addEventListener('click', () => {
    definir(!aberto());
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && aberto()) {
      definir(false);
      botao.focus();
    }
  });

  document.addEventListener('click', (evento) => {
    if (aberto() && !cabecalho.contains(evento.target)) {
      definir(false);
    }
  });
}

function configurarAcordeoes() {
  const acordeoes = document.querySelectorAll('details[data-acordeao]');
  acordeoes.forEach((detalhe) => {
    const resumo = detalhe.querySelector('summary');
    if (!resumo) {
      return;
    }
    const sincronizar = () => {
      resumo.setAttribute('aria-expanded', detalhe.open ? 'true' : 'false');
    };
    sincronizar();
    detalhe.addEventListener('toggle', sincronizar);
  });

  const abrirPeloHash = () => {
    const hash = decodeURIComponent(window.location.hash.replace('#', ''));
    if (!hash) {
      return;
    }
    const alvo = document.getElementById(hash);
    if (alvo && alvo.tagName === 'DETAILS' && alvo.hasAttribute('data-acordeao')) {
      alvo.open = true;
    }
  };

  abrirPeloHash();
  window.addEventListener('hashchange', abrirPeloHash);
}

function configurarMapas() {
  const fachadas = document.querySelectorAll('[data-mapa]');
  fachadas.forEach((fachada) => {
    const botao = fachada.querySelector('[data-mapa-carregar]');
    const moldura = fachada.querySelector('[data-mapa-moldura]');
    const fonte = fachada.getAttribute('data-mapa-fonte');
    if (!botao || !moldura || !fonte) {
      return;
    }

    botao.classList.remove('hidden');

    botao.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('src', fonte);
      iframe.setAttribute('title', fachada.getAttribute('data-mapa-titulo') || 'Mapa da unidade');
      iframe.setAttribute('loading', 'lazy');
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      iframe.setAttribute('tabindex', '0');
      moldura.replaceChildren(iframe);
      botao.classList.add('hidden');
      iframe.focus();
    });
  });
}

configurarMenu();
configurarAcordeoes();
configurarMapas();
