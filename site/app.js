const grid = document.querySelector('#game-grid');

try {
  const response = await fetch('./games.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const games = await response.json();
  grid.innerHTML = games.map((game, index) => `
    <a class="game-card" href="./${encodeURIComponent(game.slug)}/" style="--card-accent:${game.accent || '#57f5d0'}">
      <small>${String(index + 1).padStart(2, '0')} / ${game.status || 'PLAYABLE'}</small>
      <h2>${escapeHtml(game.title)}</h2>
      <p>${escapeHtml(game.description)}</p>
      <strong>启动游戏 →</strong>
    </a>
  `).join('') || '<p class="loading">暂无公开构建。</p>';
} catch (error) {
  grid.innerHTML = `<p class="error">游戏索引载入失败：${escapeHtml(error.message)}</p>`;
}

function escapeHtml(value) {
  const node = document.createElement('span');
  node.textContent = String(value);
  return node.innerHTML;
}
