let modoAtual = 'catalogo';
let catalogo = JSON.parse(localStorage.getItem('catalogo')) || [];
let listas = JSON.parse(localStorage.getItem('listas')) || [];
let idListaEditando = null;

listas = listas.map(l => ({
  id: l.id,
  nome: l.nome,
  collapsed: !!l.collapsed,
  itens: (l.itens || []).map(it =>
    typeof it === 'string' ? { text: it, checked: false } : it
  )
}));

window.onload = function () {
  exibirModo();
  listarCatalogo();
  listarListas();
};

// MODO
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

// CATALOGO
function salvarCatalogo() {
  localStorage.setItem('catalogo', JSON.stringify(catalogo));
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
    document.getElementById(id).value = '';
  });
  document.getElementById('nome-imagem').textContent = 'Nenhuma imagem escolhida';
  const btn = document.getElementById('btnSalvar');
  btn.textContent = 'Salvar Item';
  btn.onclick = addItem;
}

window.addItem = function () {
  const titulo = document.getElementById('titulo').value.trim().toUpperCase();
  const categoria = document.getElementById('categoria').value.trim();
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
      criadoEm: new Date()
    });
    salvarCatalogo();
    limparForm();
    listarCatalogo();
  });
};

function listarCatalogo(filtro = '') {
  const ul = document.getElementById('itens-list');
  ul.innerHTML = '';
  const grupos = {};

  catalogo
    .filter(item => {
      const bus = filtro.toLowerCase();
      return (
        item.titulo.toLowerCase().includes(bus) ||
        item.categoria.toLowerCase().includes(bus) ||
        item.extra.toLowerCase().includes(bus) ||
        item.ano.includes(bus) ||
        item.descricao.toLowerCase().includes(bus)
      );
    })
    .forEach(item => {
      grupos[item.categoria] = grupos[item.categoria] || [];
      grupos[item.categoria].push(item);
    });

  for (const cat in grupos) {
    const h3 = document.createElement('h3');
    h3.textContent = cat.toUpperCase();
    ul.appendChild(h3);

    grupos[cat].forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `
        ${item.imagem ? `<img src="${item.imagem}" alt="">` : ''}
        <div>
          <strong>${item.titulo}</strong><br>
          ${item.extra ? `<em>${item.extra}</em><br>` : ''}
          ${item.categoria} - ${item.ano}<br>
          ${item.descricao}
        </div>
        <div class="acoes">
          <button onclick="editarItem(${item.id})">✏️</button>
          <button onclick="excluirItem(${item.id})">🗑️</button>
        </div>
      `;
      ul.appendChild(li);
    });
  }
}

window.editarItem = function (id) {
  const item = catalogo.find(i => i.id === id);
  if (!item) return;
  document.getElementById('titulo').value = item.titulo;
  document.getElementById('categoria').value = item.categoria;
  document.getElementById('ano').value = item.ano;
  document.getElementById('extra').value = item.extra;
  document.getElementById('descricao').value = item.descricao;

  const btn = document.getElementById('btnSalvar');
  btn.textContent = 'Atualizar Item';
  btn.onclick = function () { atualizarItem(id) };
  document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
};

function atualizarItem(id) {
  const titulo = document.getElementById('titulo').value.trim().toUpperCase();
  const categoria = document.getElementById('categoria').value.trim();
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

// BACKUP
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

window.handleFileImport = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('nome-backup').textContent = file.name;
  importarBackup(e);
};

// LISTAS
function salvarListas() {
  localStorage.setItem('listas', JSON.stringify(listas));
}

window.addLista = function () {
  const nome = document.getElementById('nome-lista').value.trim();
  if (!nome) return alert('Dê um nome à lista');
  const inputs = document.querySelectorAll('.item-lista');
  const itens = [];
  inputs.forEach(i => {
    if (i.value.trim()) itens.push({ text: i.value.trim(), checked: false });
  });
  if (!itens.length) return alert('Adicione ao menos 1 item');

  if (idListaEditando) {
    const lista = listas.find(l => l.id === idListaEditando);
    if (lista) {
      lista.nome = nome;
      lista.itens = itens;
    }
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
  listas = listas.map(l => {
    if (l.id === id) l.collapsed = !l.collapsed;
    return l;
  });
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

// DRAG & DROP
let dragSrc = null;
function dragStart(e) {
  dragSrc = e.currentTarget;
  e.dataTransfer.effectAllowed = 'move';
}
function dragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
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
