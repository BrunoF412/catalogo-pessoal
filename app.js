import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Config Firebase
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

// Atualiza o placeholder conforme a categoria
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

// Adiciona item ao catálogo
window.addItem = async function () {
  const titulo = document.getElementById("titulo").value.trim();
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

    document.getElementById("titulo").value = "";
    document.getElementById("categoria").value = "";
    document.getElementById("ano").value = "";
    document.getElementById("descricao").value = "";
    document.getElementById("extra").value = "";

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
        <button onclick="deletarItem('${item.id}')">🗑️</button>
      `;
      lista.appendChild(li);
    });
  }

  gerarMenuCategorias();
}

// Cria o menu de categorias
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

// Filtro por categoria
async function filtrarCategoria(categoria) {
  listarItens(categoria);
}

// Filtro por busca
window.buscarItens = function () {
  const termo = document.getElementById("busca").value;
  listarItens(termo);
};

// Excluir item com confirmação
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

// Inicializa a listagem ao carregar
listarItens();
