// ────────────────────────────────────────────────────────────────
// CLOUDINARY
// ────────────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = 'doyi4wowj';
const CLOUDINARY_UPLOAD_PRESET = 'catalogo_unsigned';

async function uploadImageToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao enviar imagem para o Cloudinary.');
  }

  return data.secure_url;
}

// ────────────────────────────────────────────────────────────────
// ESTADO
// ────────────────────────────────────────────────────────────────
let modoAtual = 'catalogo';
let catalogo = [];
let perfumes = [];
let listas = [];
let usuarioCacheAtual = null;
let idListaEditando = null;
let idPerfumeEditando = null;
let filtroCategoria = 'todas';
let notasPerfumeForm = { saida: [], coracao: [], fundo: [] };
let acordesPerfumeForm = [];

function lerArrayLocal(chave) {
  try {
    const valor = JSON.parse(localStorage.getItem(chave));
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

const chaveResetArmazenamento = 'reset-armazenamento-v1';
if (!localStorage.getItem(chaveResetArmazenamento)) {
  Object.keys(localStorage)
    .filter(chave =>
      ['catalogo', 'perfumes', 'listas', 'dados-legados-proprietario'].includes(chave) ||
      /^(catalogo|perfumes|listas|firebase-migrado):/.test(chave)
    )
    .forEach(chave => localStorage.removeItem(chave));
  localStorage.setItem(chaveResetArmazenamento, new Date().toISOString());
}

function normalizarPerfumes(itens) {
  return itens.map(perfume => ({
  ...perfume,
  notasSaida: Array.isArray(perfume.notasSaida) ? perfume.notasSaida : [],
  notasCoracao: Array.isArray(perfume.notasCoracao) ? perfume.notasCoracao : [],
  notasFundo: Array.isArray(perfume.notasFundo) ? perfume.notasFundo : [],
  acordes: Array.isArray(perfume.acordes) ? perfume.acordes : [],
  periodos: Array.isArray(perfume.periodos) ? perfume.periodos : [],
  estacoes: Array.isArray(perfume.estacoes) ? perfume.estacoes : [],
  notasLegado: perfume.notasLegado || perfume.notas || ''
  }));
}

function normalizarListas(itens) {
  return itens.map(lista => ({
    ...lista,
    collapsed: !!lista.collapsed,
    itens: (lista.itens || []).map(item => typeof item === 'string'
      ? { text: item, checked: false }
      : item)
  }));
}

function chaveCache(nome) {
  return usuarioCacheAtual ? `${nome}:${usuarioCacheAtual}` : null;
}

function salvarCache(nome, dados) {
  const chave = chaveCache(nome);
  if (chave) localStorage.setItem(chave, JSON.stringify(dados));
}

window.definirUsuarioAtivo = function (uid) {
  usuarioCacheAtual = uid;
  catalogo = lerArrayLocal(chaveCache('catalogo'));
  perfumes = normalizarPerfumes(lerArrayLocal(chaveCache('perfumes')));
  listas = normalizarListas(lerArrayLocal(chaveCache('listas')));
};

window.limparSessaoLocal = function () {
  usuarioCacheAtual = null;
  catalogo = [];
  perfumes = [];
  listas = [];
};

window.obterDadosLocais = function () {
  return {
    catalogo: structuredClone(catalogo),
    perfumes: structuredClone(perfumes),
    listas: structuredClone(listas)
  };
};

window.aplicarDadosNuvem = function (dados) {
  catalogo = Array.isArray(dados.catalogo) ? dados.catalogo : [];
  perfumes = normalizarPerfumes(Array.isArray(dados.perfumes) ? dados.perfumes : []);
  listas = normalizarListas(Array.isArray(dados.listas) ? dados.listas : []);

  salvarCache('catalogo', catalogo);
  salvarCache('perfumes', perfumes);
  salvarCache('listas', listas);
  construirMenuCategorias();
  listarCatalogo();
  listarPerfumes();
  listarListas();
};

// Normalização de categoria
function canonCategoria(v) {
  const t = (v || '').toString().trim().toUpperCase();
  if (['CD', 'LIVRO', 'VINIL'].includes(t)) return t;
  if (['LP', 'RECORD'].includes(t)) return 'VINIL';
  return 'LIVRO';
}

// Helper: obter o arquivo selecionado (galeria OU câmera)
function getSelectedImageFile() {
  const gal = document.getElementById('img-galeria');
  const cam = document.getElementById('img-camera');
  return (gal && gal.files[0]) || (cam && cam.files[0]) || null;
}

// ────────────────────────────────────────────────────────────────
window.onload = function () {
  // nome do arquivo (galeria e câmera)
  const gal = document.getElementById('img-galeria');
  const cam = document.getElementById('img-camera');
  const spanNome = document.getElementById('nome-imagem');
  if (gal) gal.addEventListener('change', () => {
    spanNome.textContent = gal.files.length ? gal.files[0].name : 'Nenhuma imagem escolhida';
  });
  if (cam) cam.addEventListener('change', () => {
    spanNome.textContent = cam.files.length ? cam.files[0].name : 'Nenhuma imagem escolhida';
  });

  // nome do arquivo de backup
  const inputBackup = document.getElementById('input-backup');
  const spanBackup = document.getElementById('nome-backup');
  if (inputBackup) {
    inputBackup.addEventListener('change', (e) => {
      spanBackup.textContent = inputBackup.files.length ? inputBackup.files[0].name : 'Nenhum arquivo escolhido';
      importarBackup(e);
    });
  }

  // botão salvar
  const btn = document.getElementById('btnSalvar');
  if (btn) btn.onclick = addItem;

  const imagemPerfume = document.getElementById('perfume-imagem');
  if (imagemPerfume) imagemPerfume.addEventListener('change', () => {
    document.getElementById('nome-imagem-perfume').textContent = imagemPerfume.files.length
      ? imagemPerfume.files[0].name
      : 'Nenhuma imagem escolhida';
  });

  document.getElementById('btnSalvarPerfume').onclick = salvarPerfume;
  document.getElementById('busca-perfumes').addEventListener('input', listarPerfumes);
  document.getElementById('filtro-concentracao').addEventListener('change', listarPerfumes);
  ['saida', 'coracao', 'fundo'].forEach(tipo => {
    document.getElementById(`nota-${tipo}-input`).addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        adicionarNota(tipo);
      }
    });
  });
  document.getElementById('acorde-nome-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      adicionarAcorde();
    }
  });

  exibirModo();
  construirMenuCategorias();
  listarCatalogo();
  listarPerfumes();
  listarListas();
};

// ────────────────────────────────────────────────────────────────
// CONTROLE DE MODO
// ────────────────────────────────────────────────────────────────
window.setModo = function (modo) {
  modoAtual = modo;
  exibirModo();
};

function exibirModo() {
  document.getElementById('modo-catalogo').style.display = modoAtual === 'catalogo' ? 'grid' : 'none';
  document.getElementById('modo-perfumes').style.display = modoAtual === 'perfumes' ? 'grid' : 'none';
  document.getElementById('modo-lista').style.display = modoAtual === 'lista' ? 'grid' : 'none';
  document.getElementById('btnCatalogo').classList.toggle('modo-ativo', modoAtual === 'catalogo');
  document.getElementById('btnPerfumes').classList.toggle('modo-ativo', modoAtual === 'perfumes');
  document.getElementById('btnLista').classList.toggle('modo-ativo', modoAtual === 'lista');
}

// ────────────────────────────────────────────────────────────────
function salvarCatalogo() {
  salvarCache('catalogo', catalogo);
  construirMenuCategorias();
}

window.abrirFormularioCatalogo = function () {
  document.getElementById('catalogo-drawer').classList.add('open');
  document.getElementById('catalogo-drawer-backdrop').classList.add('open');
  document.getElementById('catalogo-drawer').setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  setTimeout(() => document.getElementById('titulo').focus(), 100);
};

window.fecharFormularioCatalogo = function () {
  document.getElementById('catalogo-drawer').classList.remove('open');
  document.getElementById('catalogo-drawer-backdrop').classList.remove('open');
  document.getElementById('catalogo-drawer').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
  limparForm();
};

function limparForm() {
  ['titulo', 'categoria', 'ano', 'extra', 'descricao'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'categoria' ? 'LIVRO' : '';
  });
  const gal = document.getElementById('img-galeria');
  const cam = document.getElementById('img-camera');
  if (gal) gal.value = '';
  if (cam) cam.value = '';
  const span = document.getElementById('nome-imagem');
  if (span) span.textContent = 'Nenhuma imagem escolhida';

  const btn = document.getElementById('btnSalvar');
  document.getElementById('catalogo-form-titulo').textContent = 'Novo item';
  btn.textContent = 'Salvar item';
  btn.onclick = addItem;
}

// ────────────────────────────────────────────────────────────────
// CATALOGO – CRUD
// ────────────────────────────────────────────────────────────────
window.addItem = async function () {
  const titulo = document.getElementById('titulo').value.trim().toUpperCase();
  const categoria = canonCategoria(document.getElementById('categoria').value);
  const ano = document.getElementById('ano').value.trim();
  const extra = document.getElementById('extra').value.trim();
  const descricao = document.getElementById('descricao').value.trim();

  if (!titulo || !categoria || !ano) return alert('Preencha Título, Categoria e Ano.');

  const btn = document.getElementById('btnSalvar');
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Enviando imagem...';

  try {
    const file = getSelectedImageFile();
    const imagem = file ? await uploadImageToCloudinary(file) : '';

    const novoItem = {
      id: Date.now(),
      titulo, categoria, ano, extra, descricao,
      imagem,
      criadoEm: new Date().toISOString()
    };
    catalogo.push(novoItem);
    salvarCatalogo();
    window.salvarRegistroNuvem?.('catalogo', novoItem);
    fecharFormularioCatalogo();
    listarCatalogo();
  } catch (err) {
    alert(err.message || 'Erro ao salvar item.');
  } finally {
    btn.disabled = false;
    btn.textContent = btn.onclick === addItem ? 'Salvar item' : 'Atualizar item';
  }
};

window.editarItem = function (id) {
  const item = catalogo.find(i => i.id === id);
  if (!item) return;
  document.getElementById('titulo').value = item.titulo;
  document.getElementById('categoria').value = item.categoria;
  document.getElementById('ano').value = item.ano;
  document.getElementById('extra').value = item.extra || '';
  document.getElementById('descricao').value = item.descricao || '';

  const btn = document.getElementById('btnSalvar');
  document.getElementById('catalogo-form-titulo').textContent = 'Editar item';
  btn.textContent = 'Atualizar item';
  btn.onclick = function () { atualizarItem(id); };
  abrirFormularioCatalogo();
};

async function atualizarItem(id) {
  const titulo = document.getElementById('titulo').value.trim().toUpperCase();
  const categoria = canonCategoria(document.getElementById('categoria').value);
  const ano = document.getElementById('ano').value.trim();
  const extra = document.getElementById('extra').value.trim();
  const descricao = document.getElementById('descricao').value.trim();

  if (!titulo || !categoria || !ano) return alert('Preencha Título, Categoria e Ano.');

  const item = catalogo.find(i => i.id === id);
  if (!item) return;

  const btn = document.getElementById('btnSalvar');
  btn.disabled = true;
  btn.textContent = 'Atualizando...';

  try {
    const file = getSelectedImageFile();
    const imagem = file ? await uploadImageToCloudinary(file) : item.imagem;

    Object.assign(item, { titulo, categoria, ano, extra, descricao, imagem });
    salvarCatalogo();
    window.salvarRegistroNuvem?.('catalogo', item);
    fecharFormularioCatalogo();
    listarCatalogo();
  } catch (err) {
    alert(err.message || 'Erro ao atualizar item.');
  } finally {
    btn.disabled = false;
    btn.textContent = btn.onclick === addItem ? 'Salvar item' : 'Atualizar item';
  }
}

window.excluirItem = function (id) {
  if (!confirm('Excluir este item?')) return;
  catalogo = catalogo.filter(i => i.id !== id);
  salvarCatalogo();
  window.excluirRegistroNuvem?.('catalogo', id);
  listarCatalogo();
};

window.buscarItens = function () {
  listarCatalogo(document.getElementById('busca').value);
};

// ────────────────────────────────────────────────────────────────
// CATALOGO – FILTROS, GRID, LIGHTBOX e EXPANDIR CARD
// ────────────────────────────────────────────────────────────────
function construirMenuCategorias() {
  const el = document.getElementById('menu-categorias');
  if (!el) return;
  el.innerHTML = '';

  // contagens por categoria
  const counts = { CD: 0, LIVRO: 0, VINIL: 0 };
  catalogo.forEach(i => {
    const c = canonCategoria(i.categoria);
    if (counts[c] !== undefined) counts[c]++;
  });

  const chips = [
    { id: 'todas', label: `Todas (${catalogo.length})` },
    { id: 'CD', label: `CD (${counts.CD})` },
    { id: 'LIVRO', label: `LIVRO (${counts.LIVRO})` },
    { id: 'VINIL', label: `VINIL (${counts.VINIL})` },
  ];

  chips.forEach(ch => {
    const b = document.createElement('button');
    b.textContent = ch.label;
    if (filtroCategoria === ch.id) b.classList.add('active');
    b.onclick = () => { filtroCategoria = ch.id; construirMenuCategorias(); listarCatalogo(); };
    el.appendChild(b);
  });
}

function listarCatalogo(filtroTexto = document.getElementById('busca')?.value || '') {
  const grid = document.getElementById('itens-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const ftxt = filtroTexto.toLowerCase();

  const lista = catalogo
    .filter(item => {
      const passText =
        item.titulo.toLowerCase().includes(ftxt) ||
        canonCategoria(item.categoria).toLowerCase().includes(ftxt) ||
        (item.extra || '').toLowerCase().includes(ftxt) ||
        (item.ano || '').toString().includes(ftxt) ||
        (item.descricao || '').toLowerCase().includes(ftxt);

      const passCat = filtroCategoria === 'todas' || canonCategoria(item.categoria) === filtroCategoria;
      return passText && passCat;
    })
    .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

  if (lista.length === 0) {
    const vazio = document.createElement('div');
    vazio.style.textAlign = 'center';
    vazio.style.opacity = '.8';
    vazio.textContent = 'Nenhum item encontrado.';
    grid.appendChild(vazio);
    return;
  }

  lista.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card catalogo-card';
    card.addEventListener('click', () => abrirDetalhesCatalogo(item.id));

    // Capa
    const cover = document.createElement('div');
    cover.className = 'cover';
    if (item.imagem) {
      const img = document.createElement('img');
      img.src = item.imagem;
      img.alt = item.titulo;
      img.loading = 'lazy';
      img.style.cursor = 'zoom-in';
      img.onclick = (e) => {
        e.stopPropagation(); // não alterna expandido
        abrirLightbox(item.imagem, item.titulo);
      };
      cover.appendChild(img);
    }
    const badge = document.createElement('div');
    badge.className = 'badge';
    const cat = canonCategoria(item.categoria);
    badge.textContent = cat;
    badge.setAttribute('data-cat', cat);
    cover.appendChild(badge);

    // Conteúdo
    const content = document.createElement('div');
    content.className = 'content';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = item.titulo;

    const subtitle = document.createElement('div');
    subtitle.className = 'subtitle';
    const extra = item.extra ? `${item.extra} • ` : '';
    subtitle.textContent = `${extra}${item.ano}`;

    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = item.descricao || '';

    const actions = document.createElement('div');
    actions.className = 'actions catalogo-actions';

    const bEdit = document.createElement('button');
    bEdit.className = 'btn';
    bEdit.textContent = 'Editar';
    bEdit.onclick = (e) => { e.stopPropagation(); editarItem(item.id); };

    const bDel = document.createElement('button');
    bDel.className = 'btn del';
    bDel.textContent = 'Excluir';
    bDel.onclick = (e) => { e.stopPropagation(); excluirItem(item.id); };

    actions.appendChild(bEdit);
    actions.appendChild(bDel);

    content.appendChild(title);
    content.appendChild(subtitle);
    if (item.descricao) content.appendChild(desc);

    card.appendChild(cover);
    card.appendChild(content);
    card.appendChild(actions);

    grid.appendChild(card);
  });
}

window.abrirDetalhesCatalogo = function (id) {
  const item = catalogo.find(registro => registro.id === id);
  if (!item) return;

  const overlay = document.createElement('div');
  overlay.className = 'detalhe-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  const modal = document.createElement('section');
  modal.className = 'detalhe-modal';
  const close = document.createElement('button');
  close.className = 'icon-button detalhe-close';
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Fechar detalhes');
  close.onclick = () => overlay.remove();
  modal.appendChild(close);

  if (item.imagem) {
    const img = document.createElement('img');
    img.className = 'detalhe-imagem';
    img.src = item.imagem;
    img.alt = item.titulo;
    modal.appendChild(img);
  }

  const body = document.createElement('div');
  body.className = 'detalhe-body';
  const categoria = document.createElement('span');
  categoria.className = 'section-eyebrow';
  categoria.textContent = canonCategoria(item.categoria);
  const title = document.createElement('h2');
  title.textContent = item.titulo;
  const meta = document.createElement('p');
  meta.className = 'detalhe-meta';
  meta.textContent = [item.extra, item.ano].filter(Boolean).join(' • ');
  body.append(categoria, title, meta);
  if (item.descricao) {
    const descricao = document.createElement('p');
    descricao.className = 'detalhe-descricao';
    descricao.textContent = item.descricao;
    body.appendChild(descricao);
  }
  const edit = document.createElement('button');
  edit.className = 'btn-primary detalhe-edit';
  edit.type = 'button';
  edit.textContent = 'Editar item';
  edit.onclick = () => { overlay.remove(); editarItem(item.id); };
  body.appendChild(edit);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
};

function abrirLightbox(src, alt = '') {
  const wrap = document.createElement('div');
  wrap.className = 'lb';
  const fechar = () => {
    window.removeEventListener('keydown', onEsc);
    wrap.remove();
  };
  wrap.onclick = fechar;

  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;

  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = 'Fechar (Esc)';
  close.onclick = (e) => { e.stopPropagation(); fechar(); };

  wrap.appendChild(img);
  wrap.appendChild(close);
  document.body.appendChild(wrap);

  const onEsc = (ev) => {
    if (ev.key === 'Escape') fechar();
  };
  window.addEventListener('keydown', onEsc);
}

// ────────────────────────────────────────────────────────────────
// BACKUP
// ────────────────────────────────────────────────────────────────
function salvarPerfumes() {
  salvarCache('perfumes', perfumes);
}

window.abrirFormularioPerfume = function () {
  document.getElementById('perfume-drawer').classList.add('open');
  document.getElementById('perfume-drawer-backdrop').classList.add('open');
  document.getElementById('perfume-drawer').setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  setTimeout(() => document.getElementById('perfume-nome').focus(), 100);
};

window.fecharFormularioPerfume = function () {
  document.getElementById('perfume-drawer').classList.remove('open');
  document.getElementById('perfume-drawer-backdrop').classList.remove('open');
  document.getElementById('perfume-drawer').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
  limparFormularioPerfume();
};

function renderizarChipsNotas() {
  Object.entries(notasPerfumeForm).forEach(([tipo, notas]) => {
    const container = document.getElementById(`notas-${tipo}-chips`);
    container.innerHTML = '';
    notas.forEach((nota, indice) => {
      const chip = document.createElement('span');
      chip.className = 'nota-chip';
      chip.append(document.createTextNode(nota));
      const remover = document.createElement('button');
      remover.type = 'button';
      remover.textContent = '×';
      remover.setAttribute('aria-label', `Remover ${nota}`);
      remover.onclick = () => removerNota(tipo, indice);
      chip.appendChild(remover);
      container.appendChild(chip);
    });
  });
}

function renderizarAcordesForm() {
  const container = document.getElementById('acordes-form-lista');
  container.innerHTML = '';
  acordesPerfumeForm.forEach((acorde, indice) => {
    const linha = document.createElement('div');
    linha.className = 'acorde-form-item';
    const cor = document.createElement('span');
    cor.className = 'acorde-cor';
    cor.style.background = acorde.cor;
    const nome = document.createElement('strong');
    nome.textContent = acorde.nome;
    const intensidade = document.createElement('span');
    intensidade.textContent = `${acorde.intensidade}%`;
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.textContent = '×';
    remover.setAttribute('aria-label', `Remover ${acorde.nome}`);
    remover.onclick = () => removerAcorde(indice);
    linha.append(cor, nome, intensidade, remover);
    container.appendChild(linha);
  });
}

window.adicionarAcorde = function () {
  const nomeInput = document.getElementById('acorde-nome-input');
  const intensidadeInput = document.getElementById('acorde-intensidade-input');
  const corInput = document.getElementById('acorde-cor-input');
  const nome = nomeInput.value.trim();
  const intensidade = Math.min(100, Math.max(1, Number(intensidadeInput.value) || 1));
  if (!nome) return nomeInput.focus();

  const existente = acordesPerfumeForm.find(acorde => acorde.nome.toLowerCase() === nome.toLowerCase());
  if (existente) {
    Object.assign(existente, { intensidade, cor: corInput.value });
  } else {
    acordesPerfumeForm.push({ nome, intensidade, cor: corInput.value });
  }
  acordesPerfumeForm.sort((a, b) => b.intensidade - a.intensidade);
  nomeInput.value = '';
  intensidadeInput.value = '80';
  nomeInput.focus();
  renderizarAcordesForm();
};

window.removerAcorde = function (indice) {
  acordesPerfumeForm.splice(indice, 1);
  renderizarAcordesForm();
};

window.adicionarNota = function (tipo) {
  const input = document.getElementById(`nota-${tipo}-input`);
  const novasNotas = input.value.split(',').map(nota => nota.trim()).filter(Boolean);
  novasNotas.forEach(nota => {
    if (!notasPerfumeForm[tipo].some(existente => existente.toLowerCase() === nota.toLowerCase())) {
      notasPerfumeForm[tipo].push(nota);
    }
  });
  input.value = '';
  input.focus();
  renderizarChipsNotas();
};

window.removerNota = function (tipo, indice) {
  notasPerfumeForm[tipo].splice(indice, 1);
  renderizarChipsNotas();
};

function dadosFormularioPerfume() {
  return {
    nome: document.getElementById('perfume-nome').value.trim(),
    marca: document.getElementById('perfume-marca').value.trim(),
    concentracao: document.getElementById('perfume-concentracao').value,
    volume: document.getElementById('perfume-volume').value.trim(),
    ano: document.getElementById('perfume-ano').value.trim(),
    familia: document.getElementById('perfume-familia').value.trim(),
    notasSaida: [...notasPerfumeForm.saida],
    notasCoracao: [...notasPerfumeForm.coracao],
    notasFundo: [...notasPerfumeForm.fundo],
    acordes: acordesPerfumeForm.map(acorde => ({ ...acorde })),
    longevidade: document.getElementById('perfume-longevidade').value.trim(),
    projecao: document.getElementById('perfume-projecao').value,
    periodos: ['dia', 'noite'].filter(periodo => document.getElementById(`perfume-${periodo}`).checked),
    estacoes: ['verao', 'outono', 'inverno', 'primavera']
      .filter(estacao => document.getElementById(`estacao-${estacao}`).checked),
    avaliacao: document.getElementById('perfume-avaliacao').value.trim(),
    descricao: document.getElementById('perfume-descricao').value.trim()
  };
}

function limparFormularioPerfume() {
  ['perfume-nome', 'perfume-marca', 'perfume-volume', 'perfume-ano', 'perfume-familia',
    'perfume-avaliacao', 'perfume-longevidade', 'perfume-descricao'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('perfume-concentracao').value = 'EDP';
  document.getElementById('perfume-imagem').value = '';
  document.getElementById('nome-imagem-perfume').textContent = 'Nenhuma imagem escolhida';
  notasPerfumeForm = { saida: [], coracao: [], fundo: [] };
  acordesPerfumeForm = [];
  ['perfume-dia', 'perfume-noite', 'estacao-verao', 'estacao-outono', 'estacao-inverno', 'estacao-primavera']
    .forEach(id => { document.getElementById(id).checked = false; });
  document.getElementById('perfume-projecao').value = '';
  document.getElementById('acorde-nome-input').value = '';
  document.getElementById('acorde-intensidade-input').value = '80';
  renderizarChipsNotas();
  renderizarAcordesForm();
  document.getElementById('perfume-form-titulo').textContent = 'Novo perfume';
  document.getElementById('btnSalvarPerfume').textContent = 'Salvar perfume';
  idPerfumeEditando = null;
}

window.salvarPerfume = async function () {
  const dados = dadosFormularioPerfume();
  if (!dados.nome || !dados.marca) return alert('Preencha o nome e a marca do perfume.');
  if (dados.avaliacao && (+dados.avaliacao < 0 || +dados.avaliacao > 10)) {
    return alert('A avaliação deve estar entre 0 e 10.');
  }

  const btn = document.getElementById('btnSalvarPerfume');
  const perfumeAtual = perfumes.find(p => p.id === idPerfumeEditando);
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const file = document.getElementById('perfume-imagem').files[0];
    const imagem = file ? await uploadImageToCloudinary(file) : (perfumeAtual?.imagem || '');

    if (perfumeAtual) {
      Object.assign(perfumeAtual, dados, { imagem, atualizadoEm: new Date().toISOString() });
      window.salvarRegistroNuvem?.('perfumes', perfumeAtual);
    } else {
      const novoPerfume = { id: Date.now(), ...dados, imagem, criadoEm: new Date().toISOString() };
      perfumes.push(novoPerfume);
      window.salvarRegistroNuvem?.('perfumes', novoPerfume);
    }

    salvarPerfumes();
    fecharFormularioPerfume();
    listarPerfumes();
  } catch (err) {
    alert(err.message || 'Erro ao salvar perfume.');
    btn.textContent = perfumeAtual ? 'Atualizar Perfume' : 'Salvar Perfume';
  } finally {
    btn.disabled = false;
  }
};

window.editarPerfume = function (id) {
  const perfume = perfumes.find(p => p.id === id);
  if (!perfume) return;
  idPerfumeEditando = id;

  const campos = {
    'perfume-nome': perfume.nome,
    'perfume-marca': perfume.marca,
    'perfume-concentracao': perfume.concentracao || 'EDP',
    'perfume-volume': perfume.volume,
    'perfume-ano': perfume.ano,
    'perfume-familia': perfume.familia,
    'perfume-avaliacao': perfume.avaliacao,
    'perfume-longevidade': perfume.longevidade,
    'perfume-projecao': perfume.projecao,
    'perfume-descricao': perfume.descricao
  };
  Object.entries(campos).forEach(([idCampo, valor]) => {
    document.getElementById(idCampo).value = valor || '';
  });
  notasPerfumeForm = {
    saida: [...(perfume.notasSaida || [])],
    coracao: [...(perfume.notasCoracao || [])],
    fundo: [...(perfume.notasFundo || [])]
  };
  acordesPerfumeForm = (perfume.acordes || []).map(acorde => ({ ...acorde }));
  ['dia', 'noite'].forEach(periodo => {
    document.getElementById(`perfume-${periodo}`).checked = (perfume.periodos || []).includes(periodo);
  });
  ['verao', 'outono', 'inverno', 'primavera'].forEach(estacao => {
    document.getElementById(`estacao-${estacao}`).checked = (perfume.estacoes || []).includes(estacao);
  });
  renderizarChipsNotas();
  renderizarAcordesForm();
  document.getElementById('perfume-form-titulo').textContent = 'Editar Perfume';
  document.getElementById('btnSalvarPerfume').textContent = 'Atualizar Perfume';
  abrirFormularioPerfume();
};

window.excluirPerfume = function (id) {
  if (!confirm('Excluir este perfume?')) return;
  perfumes = perfumes.filter(p => p.id !== id);
  if (idPerfumeEditando === id) limparFormularioPerfume();
  salvarPerfumes();
  window.excluirRegistroNuvem?.('perfumes', id);
  listarPerfumes();
};

function listarPerfumes() {
  const grid = document.getElementById('perfumes-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const texto = document.getElementById('busca-perfumes').value.trim().toLowerCase();
  const concentracao = document.getElementById('filtro-concentracao').value;
  const lista = perfumes
    .filter(perfume => {
      const campos = [
        perfume.nome, perfume.marca, perfume.familia, perfume.notasLegado, perfume.descricao,
        ...(perfume.notasSaida || []), ...(perfume.notasCoracao || []), ...(perfume.notasFundo || []),
        ...(perfume.acordes || []).map(acorde => acorde.nome)
      ];
      const correspondeTexto = campos.some(valor => (valor || '').toLowerCase().includes(texto));
      const correspondeConcentracao = concentracao === 'todas' || perfume.concentracao === concentracao;
      return correspondeTexto && correspondeConcentracao;
    })
    .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));

  if (!lista.length) {
    const vazio = document.createElement('div');
    vazio.className = 'estado-vazio';
    vazio.textContent = perfumes.length ? 'Nenhum perfume encontrado.' : 'Sua coleção de perfumes está vazia.';
    grid.appendChild(vazio);
    return;
  }

  lista.forEach(perfume => {
    const card = document.createElement('article');
    card.className = 'card perfume-card';
    card.addEventListener('click', () => abrirDetalhesPerfume(perfume.id));

    const cover = document.createElement('div');
    cover.className = 'cover';
    if (perfume.imagem) {
      const img = document.createElement('img');
      img.src = perfume.imagem;
      img.alt = perfume.nome;
      img.loading = 'lazy';
      img.onclick = e => { e.stopPropagation(); abrirLightbox(perfume.imagem, perfume.nome); };
      cover.appendChild(img);
    }

    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.dataset.cat = 'PERFUME';
    badge.textContent = perfume.concentracao || 'PERFUME';
    cover.appendChild(badge);

    const content = document.createElement('div');
    content.className = 'content';
    const titulo = document.createElement('div');
    titulo.className = 'title';
    titulo.textContent = perfume.nome;
    const subtitulo = document.createElement('div');
    subtitulo.className = 'subtitle';
    subtitulo.textContent = [perfume.marca, perfume.volume && `${perfume.volume} ml`, perfume.ano]
      .filter(Boolean).join(' • ');
    content.append(titulo, subtitulo);

    const notasResumo = [
      ...(perfume.notasSaida || []), ...(perfume.notasCoracao || []), ...(perfume.notasFundo || [])
    ].slice(0, 3).join(', ') || perfume.notasLegado || '';
    if (perfume.familia || notasResumo) {
      const detalhes = document.createElement('div');
      detalhes.className = 'desc';
      detalhes.textContent = [perfume.familia, notasResumo].filter(Boolean).join(' — ');
      content.appendChild(detalhes);
    }
    if (perfume.avaliacao) {
      const avaliacao = document.createElement('div');
      avaliacao.className = 'perfume-rating';
      avaliacao.textContent = `Avaliação: ${perfume.avaliacao}/10`;
      content.appendChild(avaliacao);
    }

    const actions = document.createElement('div');
    actions.className = 'actions perfume-actions';
    const editar = document.createElement('button');
    editar.className = 'btn';
    editar.textContent = 'Editar';
    editar.onclick = e => { e.stopPropagation(); editarPerfume(perfume.id); };
    const excluir = document.createElement('button');
    excluir.className = 'btn del';
    excluir.textContent = 'Excluir';
    excluir.onclick = e => { e.stopPropagation(); excluirPerfume(perfume.id); };
    actions.append(editar, excluir);

    card.append(cover, content, actions);
    grid.appendChild(card);
  });
}

window.abrirDetalhesPerfume = function (id) {
  const perfume = perfumes.find(p => p.id === id);
  if (!perfume) return;

  const overlay = document.createElement('div');
  overlay.className = 'detalhe-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  const modal = document.createElement('section');
  modal.className = 'detalhe-modal';

  const close = document.createElement('button');
  close.className = 'icon-button detalhe-close';
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Fechar detalhes');
  close.onclick = () => overlay.remove();
  modal.appendChild(close);

  if (perfume.imagem) {
    const img = document.createElement('img');
    img.className = 'detalhe-imagem';
    img.src = perfume.imagem;
    img.alt = perfume.nome;
    modal.appendChild(img);
  }

  const body = document.createElement('div');
  body.className = 'detalhe-body';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'section-eyebrow';
  eyebrow.textContent = [perfume.marca, perfume.concentracao].filter(Boolean).join(' • ');
  const title = document.createElement('h2');
  title.textContent = perfume.nome;
  const meta = document.createElement('p');
  meta.className = 'detalhe-meta';
  meta.textContent = [perfume.familia, perfume.volume && `${perfume.volume} ml`, perfume.ano]
    .filter(Boolean).join(' • ');
  body.append(eyebrow, title, meta);

  if (perfume.acordes?.length) {
    const acordes = document.createElement('section');
    acordes.className = 'acordes-grafico';
    const heading = document.createElement('h3');
    heading.textContent = 'Principais acordes';
    acordes.appendChild(heading);
    [...perfume.acordes].sort((a, b) => b.intensidade - a.intensidade).forEach(acorde => {
      const item = document.createElement('div');
      item.className = 'acorde-barra-item';
      const label = document.createElement('div');
      label.className = 'acorde-barra-label';
      const nome = document.createElement('span');
      nome.textContent = acorde.nome;
      const valor = document.createElement('span');
      valor.textContent = `${acorde.intensidade}%`;
      label.append(nome, valor);
      const trilho = document.createElement('div');
      trilho.className = 'acorde-barra-trilho';
      const barra = document.createElement('div');
      barra.className = 'acorde-barra';
      barra.style.width = `${Math.min(100, Math.max(1, acorde.intensidade))}%`;
      barra.style.background = acorde.cor || '#2f9e8f';
      trilho.appendChild(barra);
      item.append(label, trilho);
      acordes.appendChild(item);
    });
    body.appendChild(acordes);
  }

  const perfilItens = [];
  if (perfume.longevidade) perfilItens.push(['⌛', `${perfume.longevidade} h`, 'Longevidade']);
  if (perfume.projecao) perfilItens.push(['≈', perfume.projecao, 'Projeção']);
  if (perfume.periodos?.length) {
    perfilItens.push([perfume.periodos.includes('dia') ? '☀️' : '🌙', perfume.periodos.map(p => p === 'dia' ? 'Dia' : 'Noite').join(' e '), 'Período']);
  }
  if (perfume.estacoes?.length) {
    const nomesEstacoes = { verao: 'Verão', outono: 'Outono', inverno: 'Inverno', primavera: 'Primavera' };
    perfilItens.push(['◫', perfume.estacoes.map(e => nomesEstacoes[e]).join(', '), 'Estações']);
  }
  if (perfilItens.length) {
    const perfil = document.createElement('section');
    perfil.className = 'perfil-grid';
    perfilItens.forEach(([icone, valor, rotulo]) => {
      const item = document.createElement('div');
      item.className = 'perfil-item';
      const icon = document.createElement('span');
      icon.textContent = icone;
      const value = document.createElement('strong');
      value.textContent = valor;
      const label = document.createElement('small');
      label.textContent = rotulo;
      item.append(icon, value, label);
      perfil.appendChild(item);
    });
    body.appendChild(perfil);
  }

  const piramide = document.createElement('div');
  piramide.className = 'piramide-detalhe';
  const grupos = [
    ['Saída', perfume.notasSaida], ['Coração', perfume.notasCoracao], ['Fundo', perfume.notasFundo]
  ];
  grupos.forEach(([rotulo, notas]) => {
    if (!notas?.length) return;
    const grupo = document.createElement('div');
    const label = document.createElement('strong');
    label.textContent = rotulo;
    const chips = document.createElement('div');
    chips.className = 'chips';
    notas.forEach(nota => {
      const chip = document.createElement('span');
      chip.className = 'nota-chip nota-chip-visual';
      chip.textContent = `${iconeNota(nota)} ${nota}`;
      chips.appendChild(chip);
    });
    grupo.append(label, chips);
    piramide.appendChild(grupo);
  });
  if (perfume.notasLegado) {
    const legado = document.createElement('p');
    legado.className = 'notas-legado';
    legado.textContent = `Notas não classificadas: ${perfume.notasLegado}`;
    piramide.appendChild(legado);
  }
  if (piramide.childElementCount) body.appendChild(piramide);

  if (perfume.descricao) {
    const descricao = document.createElement('p');
    descricao.className = 'detalhe-descricao';
    descricao.textContent = perfume.descricao;
    body.appendChild(descricao);
  }
  if (perfume.avaliacao) {
    const avaliacao = document.createElement('strong');
    avaliacao.className = 'perfume-rating';
    avaliacao.textContent = `Avaliação: ${perfume.avaliacao}/10`;
    body.appendChild(avaliacao);
  }

  const edit = document.createElement('button');
  edit.className = 'btn-primary detalhe-edit';
  edit.type = 'button';
  edit.textContent = 'Editar perfume';
  edit.onclick = () => { overlay.remove(); editarPerfume(perfume.id); };
  body.appendChild(edit);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
};

function iconeNota(nota) {
  const texto = (nota || '').toLowerCase();
  const icones = [
    [['limão', 'lima', 'bergamota', 'laranja', 'tangerina', 'cítrico'], '🍋'],
    [['lavanda'], '💜'], [['rosa'], '🌹'], [['jasmim', 'floral', 'flor'], '🌸'],
    [['baunilha'], '🍦'], [['café'], '☕'], [['cacau', 'chocolate'], '🍫'],
    [['maçã'], '🍎'], [['pera'], '🍐'], [['cereja'], '🍒'], [['coco'], '🥥'],
    [['cedro', 'pinho', 'pinheiro', 'madeira', 'amadeirado'], '🌲'],
    [['alecrim', 'manjericão', 'hortelã', 'menta', 'erva'], '🌿'],
    [['pimenta', 'especiado', 'canela', 'cravo'], '🌶️'],
    [['marinho', 'aquático', 'água', 'ozônico'], '🌊'],
    [['couro'], '🤎'], [['mel'], '🍯'], [['tabaco'], '🍂']
  ];
  return icones.find(([termos]) => termos.some(termo => texto.includes(termo)))?.[1] || '✦';
}

window.exportarBackup = function () {
  const data = JSON.stringify({ versao: 2, catalogo, perfumes, listas }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `catalogo_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

function validarItensBackup(itens, tipo) {
  if (!Array.isArray(itens)) throw new Error(`${tipo} precisa ser uma lista.`);
  itens.forEach((item, indice) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${tipo}: registro ${indice + 1} inválido.`);
    }
  });
}

window.importarBackup = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const backup = JSON.parse(reader.result);
      let novosCatalogo;
      let novosPerfumes = perfumes;
      let novasListas = listas;
      if (Array.isArray(backup)) {
        novosCatalogo = backup;
      } else if (backup && Array.isArray(backup.catalogo)) {
        novosCatalogo = backup.catalogo;
        novosPerfumes = Array.isArray(backup.perfumes) ? backup.perfumes : perfumes;
        novasListas = Array.isArray(backup.listas) ? backup.listas : listas;
      } else {
        throw new Error('Formato inválido');
      }
      validarItensBackup(novosCatalogo, 'Catálogo');
      validarItensBackup(novosPerfumes, 'Perfumes');
      validarItensBackup(novasListas, 'Listas');
      if (!novosCatalogo.every(item => typeof item.titulo === 'string')) throw new Error('Há itens sem título no catálogo.');
      if (!novosPerfumes.every(item => typeof item.nome === 'string')) throw new Error('Há perfumes sem nome.');
      if (!novasListas.every(item => typeof item.nome === 'string' && Array.isArray(item.itens))) throw new Error('Há listas inválidas.');
      if (!confirm('A importação substituirá os dados atuais desta conta. Continuar?')) return;

      const baseId = Date.now();
      catalogo = novosCatalogo.map((item, indice) => ({ ...item, id: item.id ?? baseId + indice }));
      perfumes = normalizarPerfumes(novosPerfumes.map((item, indice) => ({ ...item, id: item.id ?? baseId + 10000 + indice })));
      listas = normalizarListas(novasListas.map((item, indice) => ({ ...item, id: item.id ?? baseId + 20000 + indice })));
      salvarCatalogo();
      salvarPerfumes();
      salvarListas();
      if (window.substituirColecaoNuvem) {
        await Promise.all([
          window.substituirColecaoNuvem('catalogo', catalogo),
          window.substituirColecaoNuvem('perfumes', perfumes),
          window.substituirColecaoNuvem('listas', listas)
        ]);
      }
      listarCatalogo();
      listarPerfumes();
      listarListas();
      alert('Backup importado!');
    } catch (err) {
      alert('Erro ao importar: ' + err.message);
    }
  };
  reader.readAsText(file);
};

// ────────────────────────────────────────────────────────────────
// LISTAS PESSOAIS (mantidas)
// ────────────────────────────────────────────────────────────────
function salvarListas() {
  salvarCache('listas', listas);
}

window.addLista = function () {
  const nome = document.getElementById('nome-lista').value.trim();
  if (!nome) return alert('Dê um nome à lista');
  const inputs = document.querySelectorAll('.item-lista');
  const listaEmEdicao = idListaEditando ? listas.find(l => l.id === idListaEditando) : null;
  const itens = [];
  inputs.forEach((input, indice) => {
    if (input.value.trim()) {
      itens.push({ text: input.value.trim(), checked: !!listaEmEdicao?.itens[indice]?.checked });
    }
  });
  if (!itens.length) return alert('Adicione ao menos 1 item');

  let listaSalva;
  if (idListaEditando) {
    const lista = listas.find(l => l.id === idListaEditando);
    if (lista) {
      lista.nome = nome;
      lista.itens = itens;
      listaSalva = lista;
    }
    idListaEditando = null;
  } else {
    listaSalva = { id: Date.now(), nome, itens, collapsed: false };
    listas.push(listaSalva);
  }
  salvarListas();
  if (listaSalva) window.salvarRegistroNuvem?.('listas', listaSalva);
  limparListaForm();
  listarListas();

  const btn = document.querySelector('#modo-lista .form-section button:last-of-type');
  btn.textContent = 'Salvar Lista';
};

function listarListas() {
  const ul = document.getElementById('listas-salvas');
  if (!ul) return;
  ul.innerHTML = '';
  listas.forEach(lista => {
    const li = document.createElement('li');
    li.dataset.id = lista.id;
    lista.collapsed ? li.classList.add('collapsed') : li.classList.remove('collapsed');

    const header = document.createElement('div');
    header.className = 'lista-header';

    const done = lista.itens.filter(it => it.checked).length;
    const txt = document.createElement('span');
    txt.className = 'lista-nome';
    txt.textContent = `${lista.nome} (${done}/${lista.itens.length})`;
    header.appendChild(txt);

    const btnToggle = document.createElement('button');
    btnToggle.textContent = lista.collapsed ? '▶' : '▼';
    btnToggle.title = 'Mostrar/ocultar';
    btnToggle.onclick = () => toggleCollapse(lista.id);
    header.appendChild(btnToggle);

    const btnEdit = document.createElement('button');
    btnEdit.textContent = '✏️';
    btnEdit.title = 'Editar lista';
    btnEdit.onclick = () => editarLista(lista.id);
    header.appendChild(btnEdit);

    const btnDel = document.createElement('button');
    btnDel.innerHTML = '🗑️';
    btnDel.title = 'Excluir lista';
    btnDel.onclick = () => excluirLista(lista.id);
    header.appendChild(btnDel);

    li.appendChild(header);

    const container = document.createElement('div');
    container.className = 'itens-lista-dinamica';

    lista.itens.forEach((it, idx) => {
      const div = document.createElement('div');
      div.className = 'checklist-item';
      div.draggable = true;
      div.dataset.listId = lista.id;
      div.dataset.index = idx;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = it.checked;
      cb.onchange = () => toggleCheck(lista.id, idx);

      const label = document.createElement('label');
      label.textContent = it.text;

      if (it.checked) div.classList.add('checked');

      div.addEventListener('dragstart', dragStart);
      div.addEventListener('dragover', dragOver);
      div.addEventListener('drop', dropItem);

      div.appendChild(cb);
      div.appendChild(label);
      container.appendChild(div);
    });

    li.appendChild(container);
    ul.appendChild(li);
  });
}

function editarLista(id) {
  const lista = listas.find(l => l.id === id);
  if (!lista) return;

  idListaEditando = id;
  document.getElementById('nome-lista').value = lista.nome;

  const container = document.getElementById('itens-temp');
  container.innerHTML = '';
  lista.itens.forEach(item => {
    const input = document.createElement('input');
    input.className = 'item-lista';
    input.value = item.text;
    container.appendChild(input);
  });

  const btn = document.querySelector('#modo-lista .form-section button:last-of-type');
  btn.textContent = 'Atualizar Lista';
}

function toggleCollapse(id) {
  listas = listas.map(l => {
    if (l.id === id) l.collapsed = !l.collapsed;
    return l;
  });
  salvarListas();
  const lista = listas.find(l => l.id === id);
  if (lista) window.salvarRegistroNuvem?.('listas', lista);
  listarListas();
}
function toggleCheck(listId, idx) {
  const l = listas.find(x => x.id === listId);
  l.itens[idx].checked = !l.itens[idx].checked;
  salvarListas();
  window.salvarRegistroNuvem?.('listas', l);
  listarListas();
}
window.excluirLista = function (id) {
  if (!confirm('Excluir esta lista?')) return;
  listas = listas.filter(l => l.id !== id);
  salvarListas();
  window.excluirRegistroNuvem?.('listas', id);
  listarListas();
};
window.adicionarItemTemporario = function () {
  const c = document.getElementById('itens-temp');
  const inp = document.createElement('input');
  inp.className = 'item-lista';
  inp.placeholder = 'Novo item';
  c.appendChild(inp);
};
function limparListaForm() {
  document.getElementById('nome-lista').value = '';
  document.getElementById('itens-temp').innerHTML = '';
  idListaEditando = null;
}
// Drag & Drop
let dragSrc = null;
function dragStart(e) { dragSrc = e.currentTarget; e.dataTransfer.effectAllowed = 'move'; }
function dragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function dropItem(e) {
  e.preventDefault();
  const tgt = e.currentTarget;
  if (tgt === dragSrc) return;
  if (tgt.dataset.listId !== dragSrc.dataset.listId) return;
  const fromIdx = +dragSrc.dataset.index;
  const toIdx = +tgt.dataset.index;
  const listId = +dragSrc.dataset.listId;
  const l = listas.find(x => x.id === listId);
  const [m] = l.itens.splice(fromIdx, 1);
  l.itens.splice(toIdx, 0, m);
  salvarListas();
  window.salvarRegistroNuvem?.('listas', l);
  listarListas();
}
