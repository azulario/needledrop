function showScreen(screen) {
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('add').classList.add('hidden');
  document.getElementById('stock').classList.add('hidden');
  document.getElementById(screen).classList.remove('hidden');
  if (screen === 'stock') listarItens();
}

function salvarItem() {
  const nome = document.getElementById('nome').value;
  const quantidade = parseInt(document.getElementById('quantidade').value);
  const minimo = parseInt(document.getElementById('minimo').value);
  if (!nome || isNaN(quantidade) || isNaN(minimo)) return alert('Preencha todos os campos corretamente.');

  const item = { nome, quantidade, minimo };
  const dados = JSON.parse(localStorage.getItem('estoque') || '[]');
  dados.push(item);
  localStorage.setItem('estoque', JSON.stringify(dados));

  document.getElementById('nome').value = '';
  document.getElementById('quantidade').value = '';
  document.getElementById('minimo').value = '';
  showScreen('menu');
}

function listarItens() {
  const lista = document.getElementById('lista');
  lista.innerHTML = '';
  const dados = JSON.parse(localStorage.getItem('estoque') || '[]');
  dados.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `<strong>${item.nome}</strong><br>Quantidade: ${item.quantidade} ${item.quantidade <= item.minimo ? '<span class="low-stock"> (Estoque baixo)</span>' : ''}`;
    lista.appendChild(div);
  });
}
