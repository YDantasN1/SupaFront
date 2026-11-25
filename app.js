// ===================== CONFIGURAÇÃO =====================
// Endereço do back-end (precisa do http:// no início!)
const API_URL = 'http://34.224.21.37:3000';

// ===================== ELEMENTOS =====================
const $ = sel => document.querySelector(sel);

const productList   = $('#products');
const totalLabel    = $('#total');
const countLabel    = $('#count');
const scopeLabel    = $('#scope');
const filterInput   = $('#filter');
const form          = $('#product-form');
const formTitle     = $('#form-title');
const formSubtitle  = $('#form-subtitle');
const formNote      = $('#form-note');
const idField       = $('#product-id');
const nameField     = $('#name');
const priceField    = $('#price');
const nameAlert     = $('#name-alert');
const priceAlert    = $('#price-alert');
const descField     = $('#description');
const submitBtn     = $('#submit-btn');
const cancelBtn     = $('#cancel-btn');
const banner        = $('#editing-banner');
const editingId     = $('#editing-id');
const searchForm    = $('#search-form');
const searchIdInput = $('#search-id');
const searchResult  = $('#search-result');
const toastEl       = $('#toast');
const modal         = $('#modal');
const modalName     = $('#modal-name');
const modalId       = $('#modal-id');
const modalPrice    = $('#modal-price');
const modalCancel   = $('#modal-cancel');
const modalConfirm  = $('#modal-confirm');

let allProducts = [];

// ===================== UTILITÁRIOS =====================
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent evita XSS
  return node;
}

let toastTimer;
function toast(message, type = 'success') {
  toastEl.textContent = message;
  toastEl.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.className = ''), 3200);
}

// Faz a requisição e trata erros de forma única
async function api(path, options = {}) {
  const config = { ...options };
  if (config.body) config.headers = { 'Content-Type': 'application/json' };

  // se o servidor não responder em 6s, desiste (evita ficar "carregando" para sempre)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  config.signal = controller.signal;

  let response;
  try {
    response = await fetch(API_URL + path, config);
  } catch {
    const err = new Error('Não foi possível conectar ao servidor.');
    err.network = true;
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  const isErrorObject =
    body && typeof body === 'object' && !Array.isArray(body) && body.message && body.code;

  if (!response.ok || isErrorObject) {
    const msg = (body && body.message) || (typeof body === 'string' && body) || `Erro ${response.status}`;
    throw new Error(msg);
  }
  return body;
}

// ===================== MODO DEMONSTRAÇÃO =====================
// Se o back-end estiver fora do ar, a tela continua funcionando com dados
// guardados no próprio navegador. Ao clicar em "Atualizar lista", tenta o back de novo.
const DEMO_KEY = 'supa-demo-products';
const DEMO_SEED = [
  { id: 1, name: 'Camisa', description: 'Uma camisa confortável e elegante', price: 79.99 },
  { id: 2, name: 'Action figure Gojo', description: 'O mais Honrado', price: 499.99 },
  { id: 3, name: 'Bola', description: 'Uma bola', price: 50 }
];
let demoMode = false;
let demoData = (() => {
  try { const raw = localStorage.getItem(DEMO_KEY); if (raw) return JSON.parse(raw); } catch {}
  return DEMO_SEED.map(p => ({ ...p }));
})();

function demoSave() {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(demoData)); } catch {}
}
function demoFind(id) {
  const item = demoData.find(p => String(p.id) === String(id));
  if (!item) throw new Error('Produto não encontrado.');
  return item;
}
function setDemoMode(on) {
  demoMode = on;
  $('#status').classList.toggle('demo', on);
  $('#status-text').textContent = on ? 'Modo demonstração' : 'Painel de gestão';
}

// ===================== CHAMADAS À API (CRUD) =====================
const getProducts = () =>                                                                              // GET    todos
  demoMode ? Promise.resolve(demoData.map(p => ({ ...p }))) : api('/products');

const getProduct = id =>                                                                               // GET    por ID
  demoMode ? Promise.resolve(demoData.filter(p => String(p.id) === String(id))) : api(`/products/${id}`);

const createProduct = data => {                                                                        // POST
  if (!demoMode) return api('/products', { method: 'POST', body: JSON.stringify(data) });
  const id = demoData.reduce((max, p) => Math.max(max, p.id), 0) + 1;
  demoData.push({ id, ...data });
  demoSave();
  return Promise.resolve({ id, ...data });
};

const updateProduct = (id, data) => {                                                                  // PUT
  if (!demoMode) return api(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  try { Object.assign(demoFind(id), data); } catch (e) { return Promise.reject(e); }
  demoSave();
  return Promise.resolve({ id, ...data });
};

const removeProduct = id => {                                                                          // DELETE
  if (!demoMode) return api(`/products/${id}`, { method: 'DELETE' });
  try { demoFind(id); } catch (e) { return Promise.reject(e); }
  demoData = demoData.filter(p => String(p.id) !== String(id));
  demoSave();
  return Promise.resolve({ message: 'deleted', id });
};

// ===================== LISTAGEM (TABELA) =====================
function buildActions(product, withLabel = false) {
  const box = el('div', 'row-actions');

  const editBtn = el('button', 'btn-edit', 'Editar');
  editBtn.type = 'button';
  editBtn.addEventListener('click', () => startEdit(product));

  const delBtn = el('button', 'btn-del', withLabel ? 'Excluir' : '×');
  delBtn.type = 'button';
  delBtn.title = 'Excluir produto';
  delBtn.setAttribute('aria-label', `Excluir ${product.name}`);
  delBtn.addEventListener('click', () => handleDelete(product));

  box.append(editBtn, delBtn);
  return box;
}

function buildRow(product) {
  const tr = document.createElement('tr');

  const tdName = el('td');
  const nameEl = el('div', 'p-name', product.name);
  nameEl.title = product.name;
  tdName.append(nameEl);
  const desc = el('div', 'p-desc', product.description || 'Sem descrição');
  if (!product.description) desc.classList.add('empty');
  else desc.title = product.description; // texto completo ao passar o mouse
  tdName.append(desc);

  const tdId = el('td', 'col-id', `#${product.id}`);
  const tdPrice = el('td', 'col-price', money.format(Number(product.price) || 0));

  const tdActions = el('td', 'col-actions');
  tdActions.append(buildActions(product));

  tr.append(tdName, tdId, tdPrice, tdActions);
  return tr;
}

function stateRow(message, isError = false) {
  const tr = document.createElement('tr');
  const td = el('td', isError ? 'state-cell error' : 'state-cell', message);
  td.colSpan = 4;
  tr.append(td);
  return tr;
}

// remove acentos e ignora maiúsculas/minúsculas ("tenis" encontra "Tênis")
function normalize(text) {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Filtra por nome, descrição e ID. Digitar "#3" procura só pelo ID.
function matchesFilter(product, term) {
  if (!term) return true;
  if (term.startsWith('#')) return String(product.id).includes(term.slice(1));
  return normalize(`${product.id} ${product.name} ${product.description || ''}`).includes(term);
}

function renderProducts() {
  const term = normalize(filterInput.value.trim());
  const list = allProducts.filter(p => matchesFilter(p, term));

  totalLabel.textContent = String(allProducts.length).padStart(2, '0');
  countLabel.textContent = `Mostrando ${list.length} de ${allProducts.length} ${allProducts.length === 1 ? 'produto' : 'produtos'}`;
  scopeLabel.textContent = term ? 'Filtro aplicado' : 'Todos os produtos';

  productList.replaceChildren();
  if (!list.length) {
    productList.append(stateRow(term ? 'Nenhum produto encontrado para esse filtro.' : 'Nenhum produto cadastrado ainda. Use o formulário para adicionar o primeiro.'));
    return;
  }
  list.forEach(p => productList.append(buildRow(p)));
}

async function fetchProducts() {
  productList.replaceChildren(stateRow('Carregando produtos...'));
  try {
    const data = await getProducts();
    allProducts = Array.isArray(data) ? data.sort((a, b) => a.id - b.id) : [];
    renderProducts();
  } catch (err) {
    if (err.network && !demoMode) {
      // back-end fora do ar: segue em modo demonstração
      setDemoMode(true);
      toast('Back-end indisponível. Usando dados de demonstração neste navegador.', 'info');
      return fetchProducts();
    }
    totalLabel.textContent = '--';
    productList.replaceChildren(stateRow(err.message, true));
  }
}

// ===================== ALERTAS DE CAMPO OBRIGATÓRIO =====================
function setFieldError(input, alertEl, message) {
  if (message) {
    alertEl.textContent = message;
    alertEl.hidden = false;
    input.classList.add('invalid');
    input.setAttribute('aria-invalid', 'true');
    input.classList.remove('shake');
    void input.offsetWidth; // reinicia a animação
    input.classList.add('shake');
  } else {
    alertEl.textContent = '';
    alertEl.hidden = true;
    input.classList.remove('invalid', 'shake');
    input.removeAttribute('aria-invalid');
  }
}

function clearFieldErrors() {
  setFieldError(nameField, nameAlert, '');
  setFieldError(priceField, priceAlert, '');
}

// o alerta some assim que a pessoa começa a corrigir o campo
nameField.addEventListener('input', () => setFieldError(nameField, nameAlert, ''));
priceField.addEventListener('input', () => setFieldError(priceField, priceAlert, ''));

// ===================== CADASTRAR / ATUALIZAR =====================
function startEdit(product) {
  switchView('view-products');
  clearFieldErrors();
  idField.value = product.id;
  nameField.value = product.name;
  priceField.value = product.price;
  descField.value = product.description || '';

  formTitle.textContent = 'Atualizar produto';
  formSubtitle.textContent = 'Altere os dados e salve.';
  formNote.hidden = true;
  editingId.textContent = product.id;
  banner.hidden = false;
  submitBtn.textContent = 'Salvar alterações';
  cancelBtn.hidden = false;
  nameField.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  form.reset();
  clearFieldErrors();
  idField.value = '';
  formTitle.textContent = 'Novo produto';
  formSubtitle.textContent = 'Adicione um novo item ao seu catálogo.';
  formNote.hidden = false;
  banner.hidden = true;
  submitBtn.textContent = '+ Cadastrar produto';
  cancelBtn.hidden = true;
}

form.addEventListener('submit', async event => {
  event.preventDefault();

  const data = {
    name: nameField.value.trim(),
    price: Number(priceField.value),
    description: descField.value.trim()
  };

  const nameMsg = data.name ? '' : 'Preencha o nome';
  let priceMsg = '';
  if (priceField.value === '' || Number.isNaN(data.price)) priceMsg = 'Informe o preço';
  else if (data.price < 0) priceMsg = 'Preço não pode ser negativo';

  setFieldError(nameField, nameAlert, nameMsg);
  setFieldError(priceField, priceAlert, priceMsg);

  if (nameMsg || priceMsg) {
    (nameMsg ? nameField : priceField).focus(); // leva o cursor ao primeiro campo com problema
    return;
  }

  const id = idField.value;
  submitBtn.disabled = true;
  try {
    if (id) {
      await updateProduct(id, data);
      toast('Produto atualizado!');
    } else {
      await createProduct(data);
      toast('Produto cadastrado!');
    }
    resetForm();
    await fetchProducts();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

cancelBtn.addEventListener('click', resetForm);

// ===================== MODAL DE EXCLUSÃO =====================
let modalResolve = null;
let lastFocus = null;

function askDeleteConfirmation(product) {
  return new Promise(resolve => {
    modalResolve = resolve;
    lastFocus = document.activeElement;
    modalName.textContent = product.name;
    modalId.textContent = `ID #${product.id}`;
    modalPrice.textContent = money.format(Number(product.price) || 0);
    modal.hidden = false;
    document.body.classList.add('modal-open');
    modalCancel.focus(); // foco no "Cancelar": é a opção mais segura
  });
}

function closeModal(confirmed) {
  if (!modalResolve) return;
  const resolve = modalResolve;
  modalResolve = null;
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
  resolve(confirmed);
}

modalCancel.addEventListener('click', () => closeModal(false));
modalConfirm.addEventListener('click', () => closeModal(true));
modal.addEventListener('click', e => { if (e.target === modal) closeModal(false); });
document.addEventListener('keydown', e => {
  if (modal.hidden) return;
  if (e.key === 'Escape') closeModal(false);
  if (e.key === 'Tab') { // mantém o foco dentro do modal
    const first = modalCancel, last = modalConfirm;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// ===================== EXCLUIR =====================
async function handleDelete(product) {
  const confirmed = await askDeleteConfirmation(product);
  if (!confirmed) return;
  try {
    await removeProduct(product.id);
    toast('Produto excluído.');
    if (idField.value == product.id) resetForm();
    searchResult.replaceChildren();
    await fetchProducts();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ===================== CONSULTA POR ID =====================
function buildResultCard(product) {
  const card = el('article', 'result-card');

  const top = el('div', 'r-top');
  top.append(el('span', 'id-pill', `#${product.id}`), el('span', 'r-price', money.format(Number(product.price) || 0)));

  const desc = el('p', 'p-desc', product.description || 'Sem descrição');
  if (!product.description) desc.classList.add('empty');

  card.append(top, el('h3', null, product.name), desc, buildActions(product, true));
  return card;
}

searchForm.addEventListener('submit', async event => {
  event.preventDefault();
  const id = searchIdInput.value.trim();
  if (!id) return;

  searchResult.replaceChildren(el('div', 'result-msg', 'Buscando...'));
  try {
    const data = await getProduct(id);
    const product = Array.isArray(data) ? data[0] : data;

    if (!product || !product.id) {
      searchResult.replaceChildren(el('div', 'result-msg error', `Nenhum produto encontrado com o ID ${id}.`));
      return;
    }
    searchResult.replaceChildren(buildResultCard(product));
  } catch (err) {
    searchResult.replaceChildren(el('div', 'result-msg error', err.message));
  }
});

// ===================== NAVEGAÇÃO ENTRE TELAS =====================
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === viewId));
}
document.querySelectorAll('.tab').forEach(tab =>
  tab.addEventListener('click', () => switchView(tab.dataset.view))
);
$('#go-search').addEventListener('click', () => {
  switchView('view-search');
  searchIdInput.focus();
});

// ===================== INICIALIZAÇÃO =====================
filterInput.addEventListener('input', renderProducts);
$('#refresh-btn').addEventListener('click', () => {
  setDemoMode(false); // tenta o back-end de novo; se falhar, volta para a demonstração
  fetchProducts();
});
fetchProducts();
