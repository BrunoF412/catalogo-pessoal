import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDDZRLnOgoA-ke9VX-Ky2iJu9WExFgd_Xk',
  authDomain: 'catalogo-pessoal-eda3c.firebaseapp.com',
  projectId: 'catalogo-pessoal-eda3c',
  storageBucket: 'catalogo-pessoal-eda3c.firebasestorage.app',
  messagingSenderId: '536487039136',
  appId: '1:536487039136:web:3e86b35121344adeb4f9c5'
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
let db;
try {
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch {
  db = getFirestore(firebaseApp);
}

const nomesColecoes = ['catalogo', 'perfumes', 'listas'];
let syncPausada = false;
let modoCadastro = false;

const elementos = {
  authScreen: document.getElementById('auth-screen'),
  appContainer: document.getElementById('app-container'),
  navigation: document.getElementById('app-navigation'),
  userMenu: document.getElementById('user-menu'),
  userEmail: document.getElementById('user-email'),
  form: document.getElementById('auth-form'),
  email: document.getElementById('auth-email'),
  password: document.getElementById('auth-password'),
  title: document.getElementById('auth-title'),
  subtitle: document.getElementById('auth-subtitle'),
  message: document.getElementById('auth-message'),
  submit: document.getElementById('auth-submit'),
  toggle: document.getElementById('auth-toggle'),
  reset: document.getElementById('auth-reset'),
  logout: document.getElementById('btn-logout')
};

function mensagem(texto = '', tipo = '') {
  elementos.message.textContent = texto;
  elementos.message.dataset.tipo = tipo;
}

function alternarModoAuth() {
  modoCadastro = !modoCadastro;
  elementos.title.textContent = modoCadastro ? 'Criar sua conta' : 'Entrar na sua coleção';
  elementos.subtitle.textContent = modoCadastro
    ? 'Crie uma conta para sincronizar seus dados.'
    : 'Use seu e-mail e senha para acessar seus dados.';
  elementos.submit.textContent = modoCadastro ? 'Criar conta' : 'Entrar';
  elementos.toggle.textContent = modoCadastro ? 'Já tenho uma conta' : 'Ainda não tenho uma conta';
  elementos.password.autocomplete = modoCadastro ? 'new-password' : 'current-password';
  mensagem();
}

function textoErro(error) {
  const mensagens = {
    'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
    'auth/invalid-credential': 'E-mail ou senha inválidos.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/operation-not-allowed': 'Ative o login por e-mail e senha no Firebase Authentication.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.'
  };
  return mensagens[error?.code] || error?.message || 'Não foi possível concluir a operação.';
}

async function carregarColecao(uid, nome) {
  const snapshot = await getDocs(collection(db, 'users', uid, nome));
  return snapshot.docs.map(item => ({ ...item.data(), id: item.data().id ?? item.id }));
}

async function carregarNuvem(uid) {
  const [catalogo, perfumes, listas] = await Promise.all(
    nomesColecoes.map(nome => carregarColecao(uid, nome))
  );
  return { catalogo, perfumes, listas };
}

async function salvarColecao(uid, nome, itens) {
  const referencia = collection(db, 'users', uid, nome);
  const existentes = await getDocs(referencia);
  const idsAtuais = new Set(itens.map(item => String(item.id)));
  const batch = writeBatch(db);

  existentes.forEach(item => {
    if (!idsAtuais.has(item.id)) batch.delete(item.ref);
  });
  itens.forEach(item => {
    batch.set(doc(referencia, String(item.id)), { ...item, id: item.id });
  });
  await batch.commit();
}

window.salvarRegistroNuvem = async function (nome, item) {
  const usuario = auth.currentUser;
  if (!usuario || syncPausada) return;
  try {
    await setDoc(doc(db, 'users', usuario.uid, nome, String(item.id)), { ...item, id: item.id });
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { ok: true } }));
  } catch (error) {
    console.error('Erro de sincronização:', error);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { ok: false, error } }));
  }
};

window.excluirRegistroNuvem = async function (nome, id) {
  const usuario = auth.currentUser;
  if (!usuario || syncPausada) return;
  try {
    await deleteDoc(doc(db, 'users', usuario.uid, nome, String(id)));
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { ok: true } }));
  } catch (error) {
    console.error('Erro de sincronização:', error);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { ok: false, error } }));
  }
};

window.substituirColecaoNuvem = async function (nome, itens) {
  const usuario = auth.currentUser;
  if (!usuario || syncPausada) return;
  await salvarColecao(usuario.uid, nome, itens);
};

async function prepararDadosUsuario(usuario) {
  const dadosNuvem = await carregarNuvem(usuario.uid);
  syncPausada = false;
  window.aplicarDadosNuvem(dadosNuvem);
}

elementos.form.addEventListener('submit', async event => {
  event.preventDefault();
  mensagem();
  elementos.submit.disabled = true;
  elementos.submit.textContent = modoCadastro ? 'Criando...' : 'Entrando...';
  try {
    if (modoCadastro) {
      await createUserWithEmailAndPassword(auth, elementos.email.value.trim(), elementos.password.value);
    } else {
      await signInWithEmailAndPassword(auth, elementos.email.value.trim(), elementos.password.value);
    }
  } catch (error) {
    mensagem(textoErro(error), 'erro');
  } finally {
    elementos.submit.disabled = false;
    elementos.submit.textContent = modoCadastro ? 'Criar conta' : 'Entrar';
  }
});

elementos.toggle.addEventListener('click', alternarModoAuth);
elementos.logout.addEventListener('click', () => signOut(auth));
elementos.reset.addEventListener('click', async () => {
  const email = elementos.email.value.trim();
  if (!email) return mensagem('Informe seu e-mail para recuperar a senha.', 'erro');
  try {
    await sendPasswordResetEmail(auth, email);
    mensagem('Enviamos as instruções de recuperação para seu e-mail.', 'sucesso');
  } catch (error) {
    mensagem(textoErro(error), 'erro');
  }
});

onAuthStateChanged(auth, async usuario => {
  if (!usuario) {
    window.limparSessaoLocal?.();
    elementos.authScreen.hidden = false;
    elementos.appContainer.hidden = true;
    elementos.navigation.hidden = true;
    elementos.userMenu.hidden = true;
    return;
  }

  elementos.authScreen.hidden = true;
  elementos.appContainer.hidden = true;
  elementos.navigation.hidden = true;
  elementos.userMenu.hidden = false;
  elementos.userEmail.textContent = usuario.email || 'Conta conectada';

  try {
    window.definirUsuarioAtivo(usuario.uid);
    await prepararDadosUsuario(usuario);
    elementos.appContainer.hidden = false;
    elementos.navigation.hidden = false;
  } catch (error) {
    console.error(error);
    alert('Não foi possível carregar os dados da nuvem. Confira o Firestore e as regras de segurança.');
  }
});
