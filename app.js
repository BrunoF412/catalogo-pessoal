import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDDZRLnOgoA-ke9VX-Ky2iJu9WExFgd_Xk",
  authDomain: "catalogo-pessoal-eda3c.firebaseapp.com",
  projectId: "catalogo-pessoal-eda3c",
  storageBucket: "catalogo-pessoal-eda3c.firebasestorage.app",
  messagingSenderId: "536487039136",
  appId: "1:536487039136:web:3e86b35121344adeb4f9c5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Atualiza placeholder conforme a categoria
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

// Adiciona novo item
window.addItem = async function () {
  const titulo = document.getElementById("titulo").value.trim().toUpperCase();
  const categoria = document.getElementById("categoria").value.trim();
  const ano = parseInt(document.getElementById("ano").value.trim());
  const descricao = document.getElementById("descricao").value.trim();
  const extra = document.getElementById("extra").value.trim();

  if (!titulo || !categoria || isNaN(ano)) {
    alert("Preencha corretamente os campos Título, Categoria e Ano.");
    return;
  }

  try {
    await addDoc(collection(db, "itens"), {
      titulo,
      categoria,
      ano,
      descricao,
      extra,
      criadoEm: new Date()
    });

    alert("Item adicionado com sucesso!");
    limparCampos();
    listarItens();
  } catch (e) {
    alert("Erro ao adicionar item: " + e.message);
  }
};

// Lista os itens
async function listarItens(filtro = "") {
  const lista = document.getElementById("itens-list");
  lista.innerHTML = "";

  const querySnapshot = await getDocs(collection(db, "itens"));
  const categorias = {};

  querySnapshot.forEach((docSnap) => {
    const item = docSnap.data();
    const id = docSnap.id;

    const termoBusca = filtro.toLowerCase();
    const textoCompleto = `${item.titulo} ${item.categoria} ${item.extra} ${item.ano} ${item.descricao}`.toLowerCase();
    if (!textoCompleto.includes(termoBusca)) return;

    if (!categorias[item.categoria]) {
      categorias[item.categoria] = [];
    }
    categorias[item.categoria].push({ id, ...item });
  });

  for (const categoria in categorias) {
    const tituloCat = document.createElement("h3");
    tituloCat.textContent = categoria.toUpperCase();
    lista.appendChild(tituloCat);

    categorias[categoria].forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div>
          <strong>${item.titulo}</strong><br/>
          ${item.extra ? `<em>${item.extra}</em><br/>` : ""}
          ${item.categoria} - ${item.ano}<br/>
          ${item.descricao}
        </div>
        <div class="acoes">
          <button onclick="editarItem('${item.id}', \`${item.titulo}\`, \`${item.categoria}\`, '${item.ano}', \`${item.extra}\`, \`${item.descricao}\`)">✏️</button>
          <button onclick="deletarItem('${item.id}')">🗑️</button>
        </div>
      `;
      lista.appendChild(li);
    });
  }

  gerarMenuCategorias();
}

// Editar item existente
window.editarItem = function (id, titulo, categoria, ano, extra, descricao) {
  document.getElementById("titulo").value = titulo;
  document.getElementById("categoria").value = categoria;
  document.getElementById("ano").value = ano;
  document.getElementById("extra").value = extra;
  document.getElementById("descricao").value = descricao;
  document.querySelector(".form-section").scrollIntoView({ behavior: "smooth" });


  const botaoSalvar = document.querySelector(".form-section button");
  botaoSalvar.textContent = "Atualizar Item";
  botaoSalvar.onclick = async function () {
    const novoTitulo = document.getElementById("titulo").value.trim().toUpperCase();
    const novaCategoria = document.getElementById("categoria").value.trim();
    const novoAno = parseInt(document.getElementById("ano").value.trim());
    const novoExtra = document.getElementById("extra").value.trim();
    const novaDescricao = document.getElementById("descricao").value.trim();

    if (!novoTitulo || !novaCategoria || isNaN(novoAno)) {
      alert("Preencha corretamente os campos Título, Categoria e Ano.");
      return;
    }

    try {
      const itemRef = doc(db, "itens", id);
      await updateDoc(itemRef, {
        titulo: novoTitulo,
        categoria: novaCategoria,
        ano: novoAno,
        extra: novoExtra,
        descricao: novaDescricao
      });

      alert("Item atualizado com sucesso!");
      botaoSalvar.textContent = "Salvar Item";
      botaoSalvar.onclick = addItem;
      limparCampos();
      listarItens();
    } catch (e) {
      alert("Erro ao atualizar item: " + e.message);
    }
  };
};

// Função para limpar os campos do formulário
function limparCampos() {
  document.getElementById("titulo").value = "";
  document.getElementById("categoria").value = "";
  document.getElementById("ano").value = "";
  document.getElementById("extra").value = "";
  document.getElementById("descricao").value = "";
}

// Cria os botões do menu de categorias
async function gerarMenuCategorias() {
  const menu = document.getElementById("menu-categorias");
  menu.innerHTML = "";

  const querySnapshot = await getDocs(collection(db, "itens"));
  const categorias = new Set();

  querySnapshot.forEach((docSnap) => {
    const item = docSnap.data();
    categorias.add(item.categoria);
  });

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

// Filtrar por categoria
async function filtrarCategoria(categoria) {
  listarItens(categoria);
}

// Buscar por termo
window.buscarItens = function () {
  const termo = document.getElementById("busca").value;
  listarItens(termo);
};

// Deletar item
window.deletarItem = async function (id) {
  const confirmacao = confirm("Tem certeza que deseja excluir este item?");
  if (!confirmacao) return;

  try {
    await deleteDoc(doc(db, "itens", id));
    listarItens();
  } catch (e) {
    alert("Erro ao deletar: " + e.message);
  }
};

// Inicializar
listarItens();
