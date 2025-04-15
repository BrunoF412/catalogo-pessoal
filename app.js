// Versão com armazenamento local (localStorage) e suporte a imagem em base64 + exportação/backup

window.atualizarCampoExtra = function () {
  const categoria = document.getElementById("categoria").value.toLowerCase();
  const extra = document.getElementById("extra");

  if (categoria.includes("livro")) {
    extra.placeholder = "Autor";
  } else if (categoria.includes("cd")) {
    extra.placeholder = "Banda";
  } else if (categoria.includes("jogo")) {
    extra.placeholder = "Estúdio";
  } else {
    extra.placeholder = "Informação extra (ex: Autor ou Banda)";
  }
};

window.addItem = function () {
  const titulo = document.getElementById("titulo").value.trim().toUpperCase();
  const categoria = document.getElementById("categoria").value.trim();
  const ano = parseInt(document.getElementById("ano").value.trim());
  const descricao = document.getElementById("descricao").value.trim();
  const extra = document.getElementById("extra").value.trim();
  const imagemInput = document.getElementById("imagem");
  const file = imagemInput.files[0];

  if (!titulo || !categoria || isNaN(ano)) {
    alert("Preencha corretamente os campos Título, Categoria e Ano.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function () {
    const imagemBase64 = reader.result;
    const novoItem = {
      id: Date.now().toString(),
      titulo,
      categoria,
      ano,
      descricao,
      extra,
      imagem: imagemBase64 || "",
      criadoEm: new Date().toISOString()
    };

    const dados = JSON.parse(localStorage.getItem("itensCatalogo") || "[]");
    dados.push(novoItem);
    localStorage.setItem("itensCatalogo", JSON.stringify(dados));

    alert("Item adicionado com sucesso!");
    limparCampos();
    listarItens();
  };

  if (file) {
    reader.readAsDataURL(file);
  } else {
    reader.onload(); // chama direto se não tiver imagem
  }
};

window.exportarBackup = function () {
  const dados = localStorage.getItem("itensCatalogo") || "[]";
  const blob = new Blob([dados], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "catalogo_backup.json";
  a.click();

  URL.revokeObjectURL(url);
};

window.importarBackup = function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const dados = JSON.parse(e.target.result);
      if (!Array.isArray(dados)) throw new Error("Formato inválido");
      localStorage.setItem("itensCatalogo", JSON.stringify(dados));
      listarItens();
      alert("Backup importado com sucesso!");
    } catch (err) {
      alert("Erro ao importar backup: " + err.message);
    }
  };
  reader.readAsText(file);
};

function listarItens(filtro = "") {
  const lista = document.getElementById("itens-list");
  lista.innerHTML = "";

  const dados = JSON.parse(localStorage.getItem("itensCatalogo") || "[]");
  const categorias = {};

  dados.forEach((item) => {
    const termoBusca = filtro.toLowerCase();
    const textoCompleto = `${item.titulo} ${item.categoria} ${item.extra} ${item.ano} ${item.descricao}`.toLowerCase();
    if (!textoCompleto.includes(termoBusca)) return;

    if (!categorias[item.categoria]) categorias[item.categoria] = [];
    categorias[item.categoria].push(item);
  });

  for (const categoria in categorias) {
    const tituloCat = document.createElement("h3");
    tituloCat.textContent = categoria.toUpperCase();
    lista.appendChild(tituloCat);

    categorias[categoria].forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        ${item.imagem ? `<img src="${item.imagem}" alt="imagem">` : ""}
        <div>
          <strong>${item.titulo}</strong><br/>
          ${item.extra ? `<em>${item.extra}</em><br/>` : ""}
          ${item.categoria} - ${item.ano}<br/>
          ${item.descricao}
        </div>
        <div class="acoes">
          <button onclick="editarItem('${item.id}')">✏️</button>
          <button onclick="deletarItem('${item.id}')">🗑️</button>
        </div>
      `;
      lista.appendChild(li);
    });
  }

  gerarMenuCategorias();
}

window.editarItem = function (id) {
  const dados = JSON.parse(localStorage.getItem("itensCatalogo") || "[]");
  const item = dados.find((i) => i.id === id);
  if (!item) return;

  document.getElementById("titulo").value = item.titulo;
  document.getElementById("categoria").value = item.categoria;
  document.getElementById("ano").value = item.ano;
  document.getElementById("extra").value = item.extra;
  document.getElementById("descricao").value = item.descricao;
  document.querySelector(".form-section").scrollIntoView({ behavior: "smooth" });

  const botaoSalvar = document.querySelector(".form-section button");
  botaoSalvar.textContent = "Atualizar Item";
  botaoSalvar.onclick = function () {
    const novoTitulo = document.getElementById("titulo").value.trim().toUpperCase();
    const novaCategoria = document.getElementById("categoria").value.trim();
    const novoAno = parseInt(document.getElementById("ano").value.trim());
    const novoExtra = document.getElementById("extra").value.trim();
    const novaDescricao = document.getElementById("descricao").value.trim();

    if (!novoTitulo || !novaCategoria || isNaN(novoAno)) {
      alert("Preencha corretamente os campos Título, Categoria e Ano.");
      return;
    }

    const novaLista = dados.map((i) =>
      i.id === id ? { ...i, titulo: novoTitulo, categoria: novaCategoria, ano: novoAno, extra: novoExtra, descricao: novaDescricao } : i
    );

    localStorage.setItem("itensCatalogo", JSON.stringify(novaLista));
    botaoSalvar.textContent = "Salvar Item";
    botaoSalvar.onclick = addItem;
    limparCampos();
    listarItens();
  };
};

function limparCampos() {
  document.getElementById("titulo").value = "";
  document.getElementById("categoria").value = "";
  document.getElementById("ano").value = "";
  document.getElementById("extra").value = "";
  document.getElementById("descricao").value = "";
  document.getElementById("imagem").value = "";
}

function gerarMenuCategorias() {
  const menu = document.getElementById("menu-categorias");
  menu.innerHTML = "";

  const dados = JSON.parse(localStorage.getItem("itensCatalogo") || "[]");
  const categorias = new Set(dados.map((item) => item.categoria));

  categorias.forEach((cat) => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.onclick = () => filtrarCategoria(cat);
    menu.appendChild(btn);
  });

  const limpar = document.createElement("button");
  limpar.textContent = "Todos";
  limpar.onclick = () => listarItens();
  menu.appendChild(limpar);
}

function filtrarCategoria(categoria) {
  listarItens(categoria);
}

window.buscarItens = function () {
  const termo = document.getElementById("busca").value;
  listarItens(termo);
};

window.deletarItem = function (id) {
  if (!confirm("Tem certeza que deseja excluir este item?")) return;
  const dados = JSON.parse(localStorage.getItem("itensCatalogo") || "[]");
  const novaLista = dados.filter((item) => item.id !== id);
  localStorage.setItem("itensCatalogo", JSON.stringify(novaLista));
  listarItens();
};

listarItens();