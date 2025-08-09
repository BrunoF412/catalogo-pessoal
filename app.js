// ────────────────────────────────────────────────────────────────
// ESTADO
// ────────────────────────────────────────────────────────────────
let modoAtual = 'catalogo';
let catalogo = JSON.parse(localStorage.getItem('catalogo')) || [];
let listas = JSON.parse(localStorage.getItem('listas')) || [];
let idListaEditando = null;
let filtroCategoria = 'todas';

// migração de listas antigas (string -> objeto)
listas = listas.map(l => ({
  id: l.id,
  nome: l.nome,
  collapsed: !!l.collapsed,
  itens: (l.itens || []).map(it =>
    typeof it === 'string' ? { text: it, checked: false } : it
  )
}));

// Normalização de categoria
function canonCategoria(v) {
  const t = (v || '').toString().trim().toUpperCase();
  if (['CD','LIVRO','VINIL'].includes(t)) return t;
  if (['LP','RECORD'].includes(t)) return 'VINIL';
  return 'LIVRO';
}

// ────────────────────────────────────────────────────────────────
window.onload = function () {
  // bind dos inputs (nome do arquivo escolhido)
  const inputImagem = document.getElementById('imagem');
  const spanImg = document.getElementById('nome-imagem');
  if (inputImagem) {
    inputImagem.addEventListener('change', () => {
      spanImg.textContent = inputImagem.files.length ? inputImagem.files[0].name : 'Nenhuma imagem escolhida';
    });
  }
  const inputBackup = document.getElementById('input-backup');
  const spanBackup = document.getElementById('nome-backup');
  if (inputBackup) {
    inputBackup.addEventListener('change', (e) => {
      spanBackup.textContent = inputBackup.files.length ? inputBackup.files[0].name : 'Nenhum arquivo escolhido';
      importarBackup(e);
    });
  }
  // botão salvar (pode mudar para atualizar)
  const btn = document.getElementById('btnSalvar');
  if (btn) btn.onclick = addItem;

  exibirModo();
  construirMenuCategorias();
  listarCatalogo();
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
  document.getElementById('modo-catalogo').style.display = modoAtual === 'catalogo' ? 'block' : 'none';
  document.getElementById('modo-lista').style.display = modoAtual === 'lista' ? 'block' : 'none';
  document.getElementById('btnCatalogo').classList.toggle('modo-ativo', modoAtual === 'catalogo');
  document.getElementById('btnLista').classList.toggle('modo-ativo', modoAtual === 'lista');
}

// ────────────────────────────────────────────────────────────────
function salvarCatalogo() {
  localStorage.setItem('catalogo', JSON.stringify(catalogo));
  construirMenuCategorias();
}

function getBase64FromFile(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function limparForm() {
  ['titulo', 'categoria', 'ano', 'extra', 'descricao', 'imagem'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'categoria' ? 'LIVRO' : '';
  });
  const span = document.getElementById('nome-imagem');
  if (span) span.textContent = 'Nenhuma imagem escolhida';
  const btn = document.getElementById('btnSalvar');
  btn.textContent = 'Salvar Item';
  btn.onclick = addItem;
}

// ────────────────────────────────────────────────────────────────
// CATALOGO – CRUD
// ────────────────────────────────────────────────────────────────
window.addItem = function () {
  const titulo = document.getElementById('titulo').value.trim().toUpperCase();
  const categoria = canonCategoria(document.getElementById('categoria').value);
  const ano = document.getElementById('ano').value.trim();
  const extra = document.getElementById('extra').value.trim();
  const descricao = document.getElementById('descricao').value.trim();
  const inputImg = document.getElementById('imagem');

  if (!titulo || !categoria || !ano) return alert('Preencha Título, Categoria e Ano.');

  const file = inputImg.files[0];
  const imagemPromise = file ? getBase64FromFile(file) : Promise.resolve('');

  imagemPromise.then(base64 => {
    catalogo.push({
      id: Date.now(),
      titulo, categoria, ano, extra, descricao,
      imagem: base64,
      criadoEm: new Date().toISOString()
    });
    salvarCatalogo();
    limparForm();
    listarCatalogo();
  });
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
  btn.textContent = 'Atualizar Item';
  btn.onclick = function () { atualizarItem(id) };
  document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
};

function atualizarItem(id) {
  const titulo = document.getElementById('titulo').value.trim().toUpperCase();
  const categoria = canonCategoria(document.getElementById('categoria').value);
  const ano = document.getElementById('ano').value.trim();
  const extra = document.getElementById('extra').value.trim();
  const descricao = document.getElementById('descricao').value.trim();
  const inputImg = document.getElementById('imagem');

  const item = catalogo.find(i => i.id === id);
  if (!item) return;

  const file = inputImg.files[0];
  const imgPromise = file ? getBase64FromFile(file) : Promise.resolve(item.imagem);

  imgPromise.then(base64 => {
    Object.assign(item, { titulo, categoria, ano, extra, descricao, imagem: base64 });
    salvarCatalogo();
    limparForm();
    listarCatalogo();
  });
}

window.excluirItem = function (id) {
  if (!confirm('Excluir este item?')) return;
  catalogo = catalogo.filter(i => i.id !== id);
  salvarCatalogo();
  listarCatalogo();
};

window.buscarItens = function () {
  listarCatalogo(document.getElementById('busca').value);
};

// ────────────────────────────────────────────────────────────────
// CATALOGO – FILTROS, LISTAGEM EM GRID E LIGHTBOX
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
    { id: 'CD',    label: `CD (${counts.CD})` },
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

function listarCatalogo(filtroTexto = '') {
  const grid = document.getElementById('itens-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const ftxt = filtroTexto.toLowerCase();

  const lista = catalogo
    .filter(item => {
      const passText =
        item.titulo.toLowerCase().includes(ftxt) ||
        canonCategoria(item.categoria).toLowerCase().includes(ftxt) ||
        (item.extra||'').toLowerCase().includes(ftxt) ||
        (item.ano||'').toString().includes(ftxt) ||
        (item.descricao||'').toLowerCase().includes(ftxt);

      const passCat = filtroCategoria === 'todas' || canonCategoria(item.categoria) === filtroCategoria;
      return passText && passCat;
    })
    .sort((a,b) => new Date(b.criadoEm) - new Date(a.criadoEm));

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
    card.className = 'card';

    const cover = document.createElement('div');
    cover.className = 'cover';
    if (item.imagem) {
      const img = document.createElement('img');
      img.src = item.imagem;
      img.alt = item.titulo;
      img.style.cursor = 'zoom-in';
      img.onclick = () => abrirLightbox(item.imagem, item.titulo);
      cover.appendChild(img);
    }
    const badge = document.createElement('div');
    badge.className = 'badge';
    const cat = canonCategoria(item.categoria);
    badge.textContent = cat;
    badge.setAttribute('data-cat', cat);
    cover.appendChild(badge);

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
    actions.className = 'actions';
    const bEdit = document.createElement('button');
    bEdit.className = 'btn';
    bEdit.textContent = 'Editar';
    bEdit.onclick = () => editarItem(item.id);
    const bDel = document.createElement('button');
    bDel.className = 'btn del';
    bDel.textContent = 'Excluir';
    bDel.onclick = () => excluirItem(item.id);

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

function abrirLightbox(src, alt='') {
  const wrap = document.createElement('div');
  wrap.className = 'lb';
  wrap.onclick = () => document.body.removeChild(wrap);

  const img = document.createElement('img');
  img.src = src; img.alt = alt;

  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = 'Fechar (Esc)';
  close.onclick = (e) => { e.stopPropagation(); document.body.removeChild(wrap); };

  wrap.appendChild(img);
  wrap.appendChild(close);
  document.body.appendChild(wrap);

  const onEsc = (ev) => { if (ev.key === 'Escape') { document.body.removeChild(wrap); window.removeEventListener('keydown', onEsc); } };
  window.addEventListener('keydown', onEsc);
}

// ────────────────────────────────────────────────────────────────
// BACKUP
// ────────────────────────────────────────────────────────────────
window.exportarBackup = function () {
  const data = JSON.stringify(catalogo, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `catalogo_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

window.importarBackup = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const arr = JSON.parse(reader.result);
      if (!Array.isArray(arr)) throw new Error('Formato inválido');
      catalogo = arr;
      salvarCatalogo();
      listarCatalogo();
      alert('Backup importado!');
    } catch (err) {
      alert('Erro ao importar: ' + err.message);
    }
  };
  reader.readAsText(file);
};

// ────────────────────────────────────────────────────────────────
/* LISTAS PESSOAIS – mantidas */
// ────────────────────────────────────────────────────────────────
function salvarListas() { localStorage.setItem('listas', JSON.stringify(listas)); }

window.addLista = function () {
  const nome = document.getElementById('nome-lista').value.trim();
  if (!nome) return alert('Dê um nome à lista');
  const inputs = document.querySelectorAll('.item-lista');
  const itens = [];
  inputs.forEach(i => { if (i.value.trim()) itens.push({ text: i.value.trim(), checked: false }); });
  if (!itens.length) return alert('Adicione ao menos 1 item');

  if (idListaEditando) {
    const lista = listas.find(l => l.id === idListaEditando);
    if (lista) { lista.nome = nome; lista.itens = itens; }
    idListaEditando = null;
  } else {
    listas.push({ id: Date.now(), nome, itens, collapsed: false });
  }
  salvarListas();
  limparListaForm();
  listarListas();

  const btn = document.querySelector('#modo-lista .form-section button:last-of-type');
  btn.textContent = 'Salvar Lista';
};

function listarListas() {
  const ul = document.getElementById('listas-salvas');
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
  listas = listas.map(l => { if (l.id === id) l.collapsed = !l.collapsed; return l; });
  salvarListas();
  listarListas();
}
function toggleCheck(listId, idx) {
  const l = listas.find(x => x.id === listId);
  l.itens[idx].checked = !l.itens[idx].checked;
  salvarListas();
  listarListas();
}
window.excluirLista = function (id) {
  if (!confirm('Excluir esta lista?')) return;
  listas = listas.filter(l => l.id !== id);
  salvarListas();
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
  const fromIdx = +dragSrc.dataset.index;
  const toIdx = +tgt.dataset.index;
  const listId = +dragSrc.dataset.listId;
  const l = listas.find(x => x.id === listId);
  const [m] = l.itens.splice(fromIdx, 1);
  l.itens.splice(toIdx, 0, m);
  salvarListas();
  listarListas();
}
