// ==UserScript==
// @name         preencher dados dos passageiros
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Painel de notas fixo + botão copiar passageiros
// @author       Você
// @match        https://prod-guanabara-frontoffice-smartbus.smarttravelit.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ─── Estilos ───────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');

    /* ── Painel fixo ── */
    #tm-panel {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 999999;
      width: 240px;
      background: #111;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      overflow: hidden;
      font-family: 'DM Mono', monospace;
    }

    #tm-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #161616;
      border-bottom: 1px solid #222;
      cursor: default;
      user-select: none;
    }

    #tm-panel-label {
      font-size: 10px;
      letter-spacing: 0.1em;
      color: #444;
      text-transform: uppercase;
    }

    #tm-btn-min {
      background: none;
      border: none;
      color: #444;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0;
      transition: color 0.15s;
    }
    #tm-btn-min:hover { color: #aaa; }

    #tm-panel-body {
      padding: 10px;
    }

    #tm-textarea {
      width: 100%;
      height: 120px;
      resize: none;
      background: #0a0a0a;
      border: 1px solid #1e1e1e;
      border-radius: 8px;
      color: #ddd;
      font-family: 'DM Mono', monospace;
      font-size: 12px;
      line-height: 1.6;
      padding: 10px;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s;
    }
    #tm-textarea:focus { border-color: #383838; }
    #tm-textarea::placeholder { color: #2e2e2e; }

    /* ── Botão copiar passageiros ── */
    #tm-copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-left: 12px;
      padding: 4px 12px;
      background: #2a7a2a;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      vertical-align: middle;
      transition: background 0.2s;
    }
    #tm-copy-btn:hover { background: #218a21; }
    #tm-copy-btn.copied { background: #555; }

    /* ── Toast ── */
    #tm-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1000000;
      background: #222;
      color: #ccc;
      font-size: 13px;
      padding: 10px 18px;
      border-radius: 8px;
      opacity: 0;
      transform: translateY(6px);
      transition: all 0.2s ease;
      pointer-events: none;
      font-family: sans-serif;
    }
    #tm-toast.show { opacity: 1; transform: translateY(0); }

    /* ── Botão confirmar no painel ── */
    #tm-btn-confirm {
      width: 100%;
      margin-top: 8px;
      padding: 7px 0;
      background: #1a5ca8;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-family: 'DM Mono', monospace;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    #tm-btn-confirm:hover { background: #1a6fd4; }
    #tm-btn-confirm:disabled { background: #1e1e1e; color: #444; cursor: default; }
  `;
  document.head.appendChild(style);

  // ─── Toast (sempre presente) ──────────────────────────────────────────────
  document.body.insertAdjacentHTML('beforeend', `<div id="tm-toast"></div>`);

  // ─── Painel de notas (só quando .step-legend contém "passageiros") ─────────
  function isPaginaPassageiros() {
    const legends = document.querySelectorAll('.step-legend');
    return Array.from(legends).some(el =>
      el.innerText.trim().toLowerCase().includes('passageiros')
    );
  }

  function injectPanel() {
    if (document.getElementById('tm-panel')) return;
    if (!isPaginaPassageiros()) return;

    document.body.insertAdjacentHTML('beforeend', `
      <div id="tm-panel">
        <div id="tm-panel-header">
          <span id="tm-panel-label">notas</span>
          <button id="tm-btn-min" title="Minimizar">−</button>
        </div>
        <div id="tm-panel-body">
          <textarea id="tm-textarea" placeholder="Cole os passageiros aqui…" spellcheck="false"></textarea>
          <button id="tm-btn-confirm">⏎ Preencher campos</button>
        </div>
      </div>
    `);

    let minimized = false;
    document.getElementById('tm-btn-min').addEventListener('click', () => {
      minimized = !minimized;
      document.getElementById('tm-panel-body').style.display = minimized ? 'none' : '';
      document.getElementById('tm-btn-min').textContent = minimized ? '+' : '−';
    });
  }

  function removePanel() {
    const panel = document.getElementById('tm-panel');
    if (panel) panel.remove();
  }

  // ─── Toast ────────────────────────────────────────────────────────────────
  function showToast(msg) {
    const t = document.getElementById('tm-toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  // ─── Preencher campos com passageiros ────────────────────────────────────
  function setNativeValue(input, value) {
    // Dispara eventos que o Angular/Vue detecta
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillPassengers() {
    const raw = document.getElementById('tm-textarea').value.trim();
    if (!raw) { showToast('⚠ Textarea vazia.'); return; }

    // Formato: Nome \n Documento \n Telefone \n Tipo
    const blocks = raw.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);

    // Cada .card é um passageiro — busca o tipo pelo <b class="orange"> dentro do título
    const cards = Array.from(document.querySelectorAll('.card')).filter(card =>
      card.querySelector('.sales-passenger-title')
    );
    if (!cards.length) { showToast('⚠ Nenhum formulário encontrado.'); return; }

    // Agrupa os cards por tipo para preencher na ordem correta
    const cardsPorTipo = {};
    cards.forEach(card => {
      const b = card.querySelector('.sales-passenger-title b.orange');
      if (!b) return;
      const tipo = b.innerText.trim().replace(/^#\d+\s*/, '').toUpperCase().trim();
      if (!cardsPorTipo[tipo]) cardsPorTipo[tipo] = [];
      cardsPorTipo[tipo].push(card);
    });

    // Controla quantos de cada tipo já foram preenchidos
    const tipoUsado = {};
    let filled = 0;
    let skipped = 0;

    blocks.forEach((block) => {
      const lines = block.split('\n').map(l => l.trim());
      const nome = lines[0] || '';
      const doc  = lines[1] || '';
      const tel  = lines[2] || '';
      const tipo = (lines[3] || 'NORMAL').toUpperCase().trim();

      tipoUsado[tipo] = tipoUsado[tipo] || 0;
      const available = cardsPorTipo[tipo] || [];
      const card = available[tipoUsado[tipo]];

      if (!card) {
        console.log(`[TM] Sem card disponível para tipo "${tipo}" (ocorrência ${tipoUsado[tipo] + 1})`);
        skipped++;
        tipoUsado[tipo]++;
        return;
      }

      tipoUsado[tipo]++;

      // Pega inputs relativos a este card — cada tipo pode ter quantidade diferente
      const info = card.querySelector('.sales-passenger-info');
      if (!info) return;
      const inputs = info.querySelectorAll('input');

      // Mapeia campos pelo label do pai (busca o texto da label mais próxima)
      function findInputByLabel(keyword) {
        return Array.from(inputs).find(inp => {
          const label = inp.closest('[class]')?.previousElementSibling?.innerText?.toLowerCase() || '';
          const wrapper = inp.closest('.form-group, .input-group, div')?.innerText?.toLowerCase() || '';
          return label.includes(keyword) || wrapper.includes(keyword);
        });
      }

      // Índices relativos ao .sales-passenger-info (confirmados pelo usuário):
      // [1]=Nome [2]=Telefone [4]=Data nascimento [5]=RG
      // Para tipos com menos campos (ex: GRATUIDADE CRIANÇA sem CPF) os índices
      // ainda são os mesmos dentro do próprio card — sem contaminação entre cards
      if (inputs[1]) { setNativeValue(inputs[1], nome);         filled++; }
      if (inputs[2]) { setNativeValue(inputs[2], tel);                    }
      if (inputs[4]) { setNativeValue(inputs[4], '01/05/2026');           }
      if (inputs[5]) { setNativeValue(inputs[5], doc);                    }
    });

    const msg = skipped > 0
      ? `✓ ${filled} preenchido(s), ${skipped} ignorado(s) sem campo.`
      : `✓ ${filled} passageiro(s) preenchido(s)!`;
    showToast(msg);
  }

  // Listener do botão confirmar (delegado pois o painel pode ser reinjetado)
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'tm-btn-confirm') fillPassengers();
  });

  // ─── Botão copiar passageiros ─────────────────────────────────────────────
  function getPassengerText(table) {
    const rows = table.querySelectorAll('tbody tr');
    if (!rows.length) return null;

    const ths = Array.from(table.querySelectorAll('thead th'));
    let iNome = -1, iDoc = -1, iTel = -1;

    ths.forEach((th, i) => {
      const txt = th.innerText.trim().toLowerCase();
      if (txt.includes('passageiro'))                             iNome = i;
      else if (txt.includes('documento') || txt.includes('doc')) iDoc  = i;
      else if (txt.includes('telefone') || txt.includes('tel'))  iTel  = i;
    });

    // Fallback: [0]# [1]PASSAGEIRO [2]DOCUMENTO [3]TIPO [4]TELEFONE
    if (iNome < 0) iNome = 1;
    if (iDoc  < 0) iDoc  = 2;
    if (iTel  < 0) iTel  = 4;

    const lines = [];
    const nomesVistos = new Set();

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (!cells.length) return;

      const get = (idx) => (cells[idx] ? cells[idx].innerText.trim() : '');

      const nome = get(iNome).replace(/^#\d+\s*/, '');
      const doc  = get(iDoc).replace(/^(CPF|RG)\s*[-–]\s*/i, '').trim();
      const tel  = get(iTel);
      const tipo = cells[3] ? cells[3].innerText.trim() : 'NORMAL';

      if (!nome) return;

      // Ignora duplicatas pelo nome
      if (nomesVistos.has(nome.toLowerCase())) return;
      nomesVistos.add(nome.toLowerCase());

      lines.push(`${nome}\n${doc}\n${tel}\n${tipo}`);
    });

    return lines.join('\n\n');
  }

  function injectButton(table) {
    if (document.getElementById('tm-copy-btn')) return;

    const th = table.querySelector('thead tr th');
    if (!th) return;

    const btn = document.createElement('button');
    btn.id = 'tm-copy-btn';
    btn.innerHTML = '&#128203; Copiar';
    th.appendChild(btn);

    btn.addEventListener('click', () => {
      const text = getPassengerText(table);
      if (!text) { showToast('⚠ Nenhum passageiro encontrado.'); return; }

      navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '✓ Copiado';
        showToast('✓ Passageiros copiados!');
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = '&#128203; Copiar';
        }, 2000);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('✓ Passageiros copiados!');
      });
    });
  }

  // ─── Observer para SPA ────────────────────────────────────────────────────
  const observer = new MutationObserver(() => {
    if (isPaginaPassageiros()) {
      injectPanel();
    } else {
      removePanel();
    }
    const table = document.querySelector('.tbl-coupon-passengers');
    if (table) injectButton(table);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  injectPanel();
  const table = document.querySelector('.tbl-coupon-passengers');
  if (table) injectButton(table);

})();
