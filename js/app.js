/**
 * app.js — Lógica de la aplicación "Flujo de Trabajo IA".
 * Sin frameworks. Todo el estado vive en localStorage bajo la
 * llave FLUJOIA_KEY y se re-renderiza a partir de un único
 * objeto `state`.
 */

(function () {
  'use strict';

  const FLUJOIA_KEY = 'flujoia_state_v1';
  const root = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  const stepModalEl = document.getElementById('stepModal');
  const masterModalEl = document.getElementById('masterModal');
  const imageModalEl = document.getElementById('imageModal');
  const globalActionsEl = document.querySelector('.global-actions');

  // -------------------------------------------------------
  // Estado
  // -------------------------------------------------------
  function defaultState() {
    return {
      screen: 'splash',       // splash | members | step0 | step1 | step2wait | step2paste | linklist | analysis | step3 | done
      memberId: null,
      step1Index: 0,
      links: [],              // { url, done }
      currentLinkIndex: 0,
      darkMode: false, // la app inicia siempre en modo claro por defecto
      soundOn: true,
      timerOn: false,
      timerStart: null,       // epoch ms cuando se reanudó
      timerElapsed: 0,        // ms acumulados mientras estaba pausado
      completed: { step0: false, step1: false }, // una vez marcados, esos pasos dejan de ser obligatorios
      step3Url: '',
      step3Generated: false,
    };
  }

  let state = loadState();
  let timerInterval = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(FLUJOIA_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      return defaultState();
    }
  }

  function save() {
    try {
      localStorage.setItem(FLUJOIA_KEY, JSON.stringify(state));
    } catch (e) {
      /* almacenamiento no disponible: la app sigue funcionando en memoria */
    }
  }

  function getMember() {
    return MEMBERS.find((m) => m.id === state.memberId) || null;
  }

  // -------------------------------------------------------
  // Utilidades: toast, sonido, confeti, portapapeles
  // -------------------------------------------------------
  let toastTimer = null;
  function showToast(msg, icon) {
    toastEl.innerHTML = `<span>${icon || '✅'}</span><span>${escapeHtml(msg)}</span>`;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // Calcula si un color de fondo necesita texto blanco o texto oscuro encima,
  // para que los nombres/etiquetas siempre se lean bien sin importar el tono.
  function textColorFor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#14171f' : '#ffffff';
  }

  function playBlip() {
    if (!state.soundOn) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.19);
      osc.onended = () => ctx.close();
    } catch (e) { /* audio no disponible, no pasa nada */ }
  }

  function launchConfetti() {
    const colors = ['#4F46E5', '#8B5CF6', '#10A37F', '#EAB308', '#0EA5E9', '#F97316'];
    const count = 70;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const left = Math.random() * 100;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const duration = 2200 + Math.random() * 1600;
      const delay = Math.random() * 400;
      const rotate = Math.random() * 360;
      const drift = (Math.random() - 0.5) * 160;
      piece.style.left = left + 'vw';
      piece.style.background = color;
      piece.style.transform = `rotate(${rotate}deg)`;
      piece.style.animation = `confettiFall ${duration}ms ease-in ${delay}ms forwards`;
      piece.style.setProperty('--drift', drift + 'px');
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), duration + delay + 100);
    }
  }

  // Inyecta el keyframe de caída una sola vez (usa variable --drift por pieza)
  (function injectConfettiKeyframes() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes confettiFall {
        from { top: -10px; opacity: 1; transform: translateX(0) rotate(0deg); }
        to { top: 105vh; opacity: 0.15; transform: translateX(var(--drift, 0px)) rotate(540deg); }
      }
    `;
    document.head.appendChild(style);
  })();

  // -------------------------------------------------------
  // Modal "¿En qué paso estás?"
  // -------------------------------------------------------
  function openStepModal() {
    const opt0 = stepModalEl.querySelector('[data-step="0"]');
    const opt1 = stepModalEl.querySelector('[data-step="1"]');
    opt0.classList.toggle('is-done', !!state.completed.step0);
    opt1.classList.toggle('is-done', !!state.completed.step1);
    const m = getMember();
    stepModalEl.querySelector('#modalTitle').textContent = m ? `Hola ${m.name.split(' / ')[0]}, ¿en qué paso estás?` : '¿En qué paso estás?';
    stepModalEl.hidden = false;
  }

  function closeStepModal() {
    stepModalEl.hidden = true;
  }

  stepModalEl.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action="pick-step"]');
    if (!el) return;
    const step = el.dataset.step;
    if (step === '0') {
      state.screen = 'step0';
    } else if (step === '1') {
      state.screen = 'step1';
      state.step1Index = 0;
    } else if (step === '2') {
      state.screen = state.links.length > 0 ? 'linklist' : 'step2wait';
    } else if (step === '3') {
      state.screen = 'step3';
    }
    closeStepModal();
    save();
    render();
    ensureTimerLoop();
  });

  // -------------------------------------------------------
  // Botones flotantes globales: Prompt maestro / Generar imagen
  // -------------------------------------------------------
  if (globalActionsEl) {
    globalActionsEl.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'open-master-modal') {
        document.getElementById('masterPromptBox').value = MASTER_PROMPT;
        masterModalEl.hidden = false;
      } else if (el.dataset.action === 'open-image-modal') {
        openImageModal();
      }
    });
  }

  function openImageModal() {
    const select = document.getElementById('imageAiSelect');
    if (select && !select.dataset.populated) {
      select.innerHTML = MEMBERS.map((m) => `<option value="${escapeHtml(m.ai)}">${escapeHtml(m.ai)}</option>`).join('');
      select.dataset.populated = '1';
    }
    const member = getMember();
    if (select && member) select.value = member.ai;
    document.getElementById('imageResultWrap').hidden = true;
    imageModalEl.hidden = false;
  }

  [masterModalEl, imageModalEl].forEach((modalNode) => {
    if (!modalNode) return;
    modalNode.addEventListener('click', (e) => {
      if (e.target === modalNode) { modalNode.hidden = true; return; } // clic en el fondo
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'close-generic-modal') {
        modalNode.hidden = true;
      } else if (el.dataset.action === 'copy-box') {
        const target = document.getElementById(el.dataset.target);
        if (target) copyText(target.value, el);
      } else if (el.dataset.action === 'generate-image-prompt') {
        const select = document.getElementById('imageAiSelect');
        const aiName = select ? select.value : '';
        const promptBox = document.getElementById('imagePromptBox');
        promptBox.value = IMAGE_PROMPT.replace('X', aiName);
        document.getElementById('imageResultWrap').hidden = false;
      }
    });
  });

  async function copyText(text, btn) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        ok = true;
      } catch (e2) { ok = false; }
    }
    if (ok) {
      playBlip();
      showToast('Copiado correctamente', '✅');
    } else {
      showToast('No se pudo copiar. Selecciona el texto manualmente.', '⚠️');
    }
  }

  // -------------------------------------------------------
  // Progreso
  // -------------------------------------------------------
  function computeProgress() {
    const fixedBefore = 1 /* step0 */ + STEP1_PROMPTS.length /* step1 */ + 2 /* step2wait + paste */;
    const linksCount = Math.max(state.links.length, 1);
    const analysisTotal = linksCount; // un paso combinado por link
    const total = fixedBefore + analysisTotal + 1 /* step3 */;

    let current = 0;
    switch (state.screen) {
      case 'step0': current = 1; break;
      case 'step1': current = 1 + (state.step1Index + 1); break;
      case 'step2wait': current = fixedBefore - 1; break;
      case 'step2paste': current = fixedBefore; break;
      case 'linklist': {
        const doneAnalysis = state.links.filter((l) => l.done).length;
        current = fixedBefore + doneAnalysis;
        break;
      }
      case 'analysis': {
        current = fixedBefore + state.currentLinkIndex + 1;
        break;
      }
      case 'step3': current = total; break;
      case 'done': current = total; break;
      default: current = 0;
    }
    return { current, total, pct: total ? Math.round((current / total) * 100) : 0 };
  }

  // -------------------------------------------------------
  // Plantillas de bloques reutilizables
  // -------------------------------------------------------
  function topbarHtml() {
    const m = getMember();
    if (!m) return '';
    const prog = computeProgress();
    return `
      <div class="topbar">
        <div class="topbar-member">
          <div class="avatar" style="background:${m.color}; color:${textColorFor(m.color)}">${m.icon}</div>
          <div class="topbar-text">
            <div class="name">${escapeHtml(m.name)}</div>
            <div class="ai">${escapeHtml(m.ai)}</div>
          </div>
        </div>
        <div class="topbar-actions">
          ${state.timerOn ? `<span class="timer-chip" id="timerChip">${formatTimer()}</span>` : ''}
          <button class="icon-btn" data-action="toggle-timer" title="Cronómetro" aria-label="Cronómetro">⏱</button>
          <button class="icon-btn" data-action="toggle-theme" title="Modo oscuro" aria-label="Modo oscuro">${state.darkMode ? '☀️' : '🌙'}</button>
          <button class="icon-btn" data-action="go-home" title="Inicio" aria-label="Inicio">⌂</button>
        </div>
      </div>
      <div class="wrap progress-block">
        <div class="progress-row"><span>Paso ${prog.current} de ${prog.total}</span><span>${prog.pct}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${prog.pct}%"></div></div>
      </div>
    `;
  }

  function screenToTabKey(screen) {
    if (screen === 'step0') return 'step0';
    if (screen === 'step1') return 'step1';
    if (screen === 'step2wait' || screen === 'step2paste' || screen === 'linklist' || screen === 'analysis') return 'step2';
    if (screen === 'step3') return 'step3';
    return null;
  }

  function tabsHtml() {
    const active = screenToTabKey(state.screen);
    const tabs = [
      { key: 'step0', label: 'Paso 0', done: state.completed.step0 },
      { key: 'step1', label: 'Paso 1', done: state.completed.step1 },
      { key: 'step2', label: 'Paso 2', done: false },
      { key: 'step3', label: 'Paso 3', done: false },
    ];
    const items = tabs.map((t) => `
      <button class="tab ${active === t.key ? 'active' : ''} ${t.done ? 'is-done' : ''}" data-action="goto-tab" data-tab="${t.key}">
        ${t.done ? '<span class="tab-check">✓</span>' : ''}${t.label}
      </button>
    `).join('');
    return `<div class="wrap tabs-bar" role="tablist" aria-label="Pasos del flujo">${items}</div>`;
  }

  function navButtons({ backAction, nextAction, nextLabel, nextDisabled }) {
    return `
      <div class="btn-row">
        ${backAction ? `<button class="btn btn-ghost" data-action="${backAction}">← Anterior</button>` : ''}
        <button class="btn btn-primary" data-action="${nextAction}" ${nextDisabled ? 'disabled' : ''}>${nextLabel || 'Siguiente →'}</button>
      </div>
    `;
  }

  // -------------------------------------------------------
  // Render por pantalla
  // -------------------------------------------------------
  function render() {
    document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
    let html = '';
    switch (state.screen) {
      case 'splash': html = renderSplash(); break;
      case 'members': html = renderMembers(); break;
      case 'step0': html = topbarHtml() + tabsHtml() + renderStep0(); break;
      case 'step1': html = topbarHtml() + tabsHtml() + renderStep1(); break;
      case 'step2wait': html = topbarHtml() + tabsHtml() + renderStep2Wait(); break;
      case 'step2paste': html = topbarHtml() + tabsHtml() + renderStep2Paste(); break;
      case 'linklist': html = topbarHtml() + tabsHtml() + renderLinkList(); break;
      case 'analysis': html = topbarHtml() + tabsHtml() + renderAnalysis(); break;
      case 'step3': html = topbarHtml() + tabsHtml() + renderStep3(); break;
      case 'done': html = topbarHtml() + renderDone(); break;
      default: html = renderSplash();
    }
    root.innerHTML = html;
    if (state.screen === 'done') launchConfetti();
    if (state.screen === 'linklist') {
      const target = root.querySelector(`.l-main[data-index="${state.currentLinkIndex}"]`);
      if (target) target.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }

  function renderSplash() {
    return `
      <div class="splash">
        <div class="splash-mark">✦</div>
        <h1>Flujo de Trabajo IA</h1>
        <p class="sub">Sistema de apoyo para análisis de información</p>
        <button class="btn btn-primary btn-huge" data-action="start">Comenzar</button>
      </div>
    `;
  }

  function renderMembers() {
    const cards = MEMBERS.map((m) => {
      const textColor = textColorFor(m.color);
      return `
      <button class="member-card" data-action="select-member" data-id="${m.id}" style="--member-color:${m.color}">
        <div class="avatar" style="background:${m.color}; color:${textColor}">${m.icon}</div>
        <div class="m-name">${escapeHtml(m.name)}</div>
        <span class="m-ai" style="background:${m.color}; color:${textColor}">${escapeHtml(m.ai)}</span>
      </button>
    `;
    }).join('');
    return `
      <div class="screen">
        <div class="wrap" style="text-align:center; margin-bottom:22px;">
          <h1 class="step-title">¿Quién eres?</h1>
          <p class="step-desc">Elige tu nombre para comenzar tu flujo con tu IA asignada.</p>
        </div>
        <div class="wrap member-grid">${cards}</div>
      </div>
    `;
  }

  function renderStep0() {
    return `
      <div class="screen">
        <div class="wrap">
          <div class="card">
            <span class="eyebrow">Paso 0 · Configurar la IA</span>
            ${state.completed.step0 ? '<p class="hint" style="margin:-6px 0 14px;">Ya completaste este paso. Puedes consultarlo cuando quieras, no es obligatorio repetirlo.</p>' : ''}
            <h2 class="step-title">Prepara tu IA antes de empezar</h2>
            <p class="step-desc">Copia este mensaje y pégalo como primera instrucción en ${escapeHtml(getMember()?.ai || 'tu IA')}. Así analizará todo con el mismo criterio.</p>
            <textarea class="prompt-box" id="promptBox" readonly>${escapeHtml(STEP0_PROMPT)}</textarea>
            <div class="copy-row">
              <button class="btn btn-primary" data-action="copy-box" data-target="promptBox">📋 Copiar</button>
            </div>
            ${navButtons({ backAction: 'go-members', nextAction: 'go-step1-start' })}
          </div>
        </div>
      </div>
    `;
  }

  function renderStep1() {
    const idx = state.step1Index;
    const total = STEP1_PROMPTS.length;
    const text = STEP1_PROMPTS[idx];
    return `
      <div class="screen">
        <div class="wrap">
          <div class="card">
            <span class="eyebrow">Paso 1 · Contextualización (${idx + 1}/${total})</span>
            ${state.completed.step1 ? '<p class="hint" style="margin:-6px 0 14px;">Ya completaste este paso. Puedes consultarlo cuando quieras, no es obligatorio repetirlo.</p>' : ''}
            <h2 class="step-title">Prompt ${idx + 1}</h2>
            <p class="step-desc">Copia este prompt y pégalo en ${escapeHtml(getMember()?.ai || 'tu IA')}. Espera la respuesta antes de continuar.</p>
            <textarea class="prompt-box" id="promptBox" readonly>${escapeHtml(text)}</textarea>
            <div class="copy-row">
              <button class="btn btn-primary" data-action="copy-box" data-target="promptBox">📋 Copiar</button>
            </div>
            ${navButtons({
              backAction: idx === 0 ? 'go-step0' : 'step1-prev',
              nextAction: idx === total - 1 ? 'step1-finish' : 'step1-next',
              nextLabel: idx === total - 1 ? 'Terminar contextualización →' : 'Siguiente →',
            })}
          </div>
        </div>
      </div>
    `;
  }

  function renderStep2Wait() {
    return `
      <div class="screen">
        <div class="wrap">
          <div class="card wait-screen">
            <span class="eyebrow">Paso 2 · Esperando enlaces</span>
            <div class="pulse-dot">🔗</div>
            <h2 class="step-title" style="margin-top:4px;">Contextualización completada</h2>
            <p class="step-desc">Espera a que Eva o Jovani Calvo compartan los enlaces de las notas a analizar.</p>
            <button class="btn btn-primary btn-block" data-action="go-step2paste">Ya tengo el link</button>
            <button class="link-btn" data-action="go-step1-last">← Volver a contextualización</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep2Paste() {
    return `
      <div class="screen">
        <div class="wrap">
          <div class="card">
            <span class="eyebrow">Paso 2 · Pegar enlaces</span>
            <h2 class="step-title">Pega la URL o URLs</h2>
            <p class="step-desc">Si te compartieron varios enlaces juntos, pégalos aquí uno por línea. La app los organizará para que los trabajes uno a uno.</p>
            <textarea class="big-input" id="urlInput" placeholder="https://...&#10;https://...&#10;https://..."></textarea>
            <p class="hint">Se aceptan varias URL separadas por saltos de línea, espacios o comas.</p>
            ${navButtons({ backAction: 'go-step2wait', nextAction: 'submit-links', nextLabel: 'Continuar →' })}
          </div>
        </div>
      </div>
    `;
  }

  function renderLinkList() {
    const items = state.links.map((l, i) => `
        <div class="link-item ${l.done ? 'done' : ''}">
          <button class="l-main" data-action="open-link" data-index="${i}">
            <span class="l-status">${l.done ? '✓' : i + 1}</span>
            <span class="l-url">${escapeHtml(l.url)}</span>
            <span class="l-progress">${l.done ? 'Analizada' : 'Pendiente'}</span>
          </button>
          <button class="l-delete" data-action="delete-link" data-index="${i}" title="Eliminar nota" aria-label="Eliminar nota">✕</button>
        </div>
      `).join('');
    const allDone = state.links.length > 0 && state.links.every((l) => l.done);
    return `
      <div class="screen">
        <div class="wrap">
          <div class="card">
            <span class="eyebrow">Paso 2 · Análisis · ${state.links.length} nota(s)</span>
            <h2 class="step-title">Elige una nota para analizar</h2>
            <p class="step-desc">Cada nota tiene un solo prompt combinado con las 10 preguntas de análisis. Puedes ir y volver entre notas cuando quieras.</p>
            <div class="link-list">${items}</div>
            <div class="btn-row">
              <button class="btn btn-ghost" data-action="add-more-links">+ Agregar más enlaces</button>
              <button class="btn btn-primary" data-action="go-step3" ${allDone ? '' : 'disabled'}>Ir a retroalimentación →</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAnalysis() {
    const link = state.links[state.currentLinkIndex];
    if (!link) { state.screen = 'linklist'; save(); return renderLinkList(); }
    const fullText = buildCombinedAnalysisPrompt(link.url);
    return `
      <div class="screen">
        <div class="wrap">
          <div class="card">
            <span class="eyebrow">Análisis combinado (10 preguntas) · Nota ${state.currentLinkIndex + 1}/${state.links.length}</span>
            <h2 class="step-title">Prompt de análisis</h2>
            <p class="step-desc" style="word-break:break-all;">Nota: ${escapeHtml(link.url)}</p>
            <textarea class="prompt-box" id="promptBox" style="min-height:280px;">${escapeHtml(fullText)}</textarea>
            <p class="hint">Puedes editar el texto (por ejemplo, el dato específico de la pregunta 6) antes de copiar.</p>
            <div class="copy-row">
              <button class="btn btn-primary" data-action="copy-box" data-target="promptBox">📋 Copiar</button>
            </div>
            <div class="btn-row">
              <button class="btn btn-ghost" data-action="back-to-linklist">← Lista</button>
              <button class="btn btn-primary" data-action="analysis-next-note">Siguiente →</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep3() {
    const fullText = state.step3Generated
      ? `${STEP3_PROMPT}\n\nURL:\n${state.step3Url}`
      : '';
    return `
      <div class="screen">
        <div class="wrap">
          <div class="card">
            <span class="eyebrow">Paso 3 · Retroalimentación para Eva</span>
            <h2 class="step-title">Prompt SEO</h2>
            <p class="step-desc">Copia este prompt para obtener palabras clave que ayuden a posicionar mejor las notas.</p>
            <input type="url" class="big-input" id="step3UrlInput" placeholder="Pega aquí el link de la nota" style="min-height:auto; padding:14px 16px;" value="${escapeHtml(state.step3Url || '')}">
            <div class="copy-row">
              <button class="btn btn-primary" data-action="generate-step3">Generar</button>
            </div>
            ${state.step3Generated ? `
              <textarea class="prompt-box" id="promptBox" style="margin-top:16px;">${escapeHtml(fullText)}</textarea>
              <div class="copy-row">
                <button class="btn btn-primary" data-action="copy-box" data-target="promptBox">📋 Copiar</button>
              </div>
            ` : ''}
            ${navButtons({ backAction: 'go-linklist', nextAction: 'finish-flow', nextLabel: 'Finalizar flujo →' })}
          </div>
        </div>
      </div>
    `;
  }

  function renderDone() {
    return `
      <div class="screen">
        <div class="wrap">
          <div class="card final-screen">
            <div class="final-emoji">🎉</div>
            <h2 class="step-title">Flujo terminado</h2>
            <div class="final-note">Recuerda enviar únicamente las observaciones útiles a Eva, indicando qué IA utilizaste.</div>
            <div class="btn-row">
              <button class="btn btn-ghost" data-action="go-linklist">Revisar notas</button>
              <button class="btn btn-primary" data-action="reset-confirm">Reiniciar todo</button>
            </div>
            <div class="util-row">
              <button class="link-btn" data-action="export-json">⬇ Exportar avance (JSON)</button>
              <button class="link-btn" data-action="import-json">⬆ Importar avance</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------
  // Timer
  // -------------------------------------------------------
  function formatTimer() {
    let ms = state.timerElapsed;
    if (state.timerOn && state.timerStart) ms += Date.now() - state.timerStart;
    const totalSec = Math.floor(ms / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function tickTimer() {
    const chip = document.getElementById('timerChip');
    if (chip) chip.textContent = formatTimer();
  }

  function ensureTimerLoop() {
    clearInterval(timerInterval);
    if (state.timerOn) {
      timerInterval = setInterval(tickTimer, 1000);
    }
  }

  // -------------------------------------------------------
  // Acciones
  // -------------------------------------------------------
  function parseUrls(raw) {
    // Extrae solo lo que parezca una URL, sin importar qué otro texto
    // venga pegado alrededor (mensajes, saludos, etc.).
    const matches = raw.match(/(https?:\/\/[^\s,;]+)|(www\.[^\s,;]+)/gi) || [];
    const cleaned = matches.map((u) => u.replace(/[),.;:'"!?]+$/g, ''));
    return cleaned.filter((u, i) => cleaned.indexOf(u) === i);
  }

  function handleAction(action, el) {
    switch (action) {
      case 'start':
        state.screen = 'members';
        break;
      case 'select-member':
        state.memberId = el.dataset.id;
        state.timerStart = state.timerOn ? Date.now() : null;
        save();
        render();
        ensureTimerLoop();
        openStepModal();
        return;
      case 'go-members':
        state.screen = 'members';
        break;
      case 'go-step0':
        state.screen = 'step0';
        break;
      case 'go-step1-start':
        state.completed.step0 = true;
        state.screen = 'step1';
        state.step1Index = 0;
        break;
      case 'go-step1-last':
        state.screen = 'step1';
        state.step1Index = STEP1_PROMPTS.length - 1;
        break;
      case 'step1-prev':
        state.step1Index = Math.max(0, state.step1Index - 1);
        break;
      case 'step1-next':
        state.step1Index = Math.min(STEP1_PROMPTS.length - 1, state.step1Index + 1);
        break;
      case 'step1-finish':
        state.completed.step1 = true;
        state.screen = state.links.length > 0 ? 'linklist' : 'step2wait';
        break;
      case 'goto-tab': {
        const tab = el.dataset.tab;
        if (tab === 'step0') state.screen = 'step0';
        else if (tab === 'step1') { state.screen = 'step1'; state.step1Index = 0; }
        else if (tab === 'step2') state.screen = state.links.length > 0 ? 'linklist' : 'step2wait';
        else if (tab === 'step3') state.screen = 'step3';
        break;
      }
      case 'go-step2paste':
        state.screen = 'step2paste';
        break;
      case 'go-step2wait':
        state.screen = 'step2wait';
        break;
      case 'submit-links': {
        const ta = document.getElementById('urlInput');
        const urls = parseUrls(ta ? ta.value : '');
        if (urls.length === 0) {
          showToast('Pega al menos una URL para continuar.', '⚠️');
          return;
        }
        const newLinks = urls.map((u) => ({ url: u, done: false }));
        state.links = state.links.concat(newLinks);
        state.currentLinkIndex = state.links.length - newLinks.length;
        state.screen = state.links.length > 1 || newLinks.length > 1 ? 'linklist' : 'analysis';
        break;
      }
      case 'add-more-links':
        state.screen = 'step2paste';
        break;
      case 'open-link':
        state.currentLinkIndex = parseInt(el.dataset.index, 10);
        state.screen = 'analysis';
        break;
      case 'back-to-linklist':
      case 'go-linklist':
        state.screen = 'linklist';
        break;
      case 'analysis-next-note': {
        const link = state.links[state.currentLinkIndex];
        link.done = true;
        const nextIdx = state.currentLinkIndex + 1;
        if (nextIdx < state.links.length) {
          state.currentLinkIndex = nextIdx;
          state.screen = 'analysis';
        } else {
          state.screen = 'linklist';
        }
        break;
      }
      case 'delete-link': {
        const idx = parseInt(el.dataset.index, 10);
        if (!window.confirm('¿Eliminar esta nota de la lista? No se puede deshacer.')) return;
        state.links.splice(idx, 1);
        if (state.currentLinkIndex >= state.links.length) {
          state.currentLinkIndex = Math.max(0, state.links.length - 1);
        }
        break;
      }
      case 'go-step3':
        state.screen = 'step3';
        break;
      case 'generate-step3': {
        const input = document.getElementById('step3UrlInput');
        const raw = input ? input.value.trim() : '';
        const found = parseUrls(raw);
        const url = found[0] || raw;
        if (!url) {
          showToast('Pega el link de la nota para generar el prompt.', '⚠️');
          return;
        }
        state.step3Url = url;
        state.step3Generated = true;
        break;
      }
      case 'finish-flow':
        state.screen = 'done';
        break;
      case 'go-home':
        state.screen = 'members';
        break;
      case 'toggle-theme':
        state.darkMode = !state.darkMode;
        break;
      case 'toggle-timer':
        state.timerOn = !state.timerOn;
        if (state.timerOn) {
          state.timerStart = Date.now();
        } else {
          state.timerElapsed += Date.now() - (state.timerStart || Date.now());
          state.timerStart = null;
        }
        ensureTimerLoop();
        break;
      case 'copy-box': {
        const target = document.getElementById(el.dataset.target);
        if (target) copyText(target.value, el);
        return; // no re-render needed
      }
      case 'reset-confirm':
        if (window.confirm('¿Seguro que quieres reiniciar todo el progreso? Esta acción no se puede deshacer.')) {
          state = defaultState();
          showToast('Progreso reiniciado', '🔄');
        } else {
          return;
        }
        break;
      case 'export-json': {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'flujo-ia-avance.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Avance exportado', '⬇');
        return;
      }
      case 'import-json': {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = () => {
          const file = input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(reader.result);
              state = Object.assign(defaultState(), parsed);
              save();
              ensureTimerLoop();
              render();
              showToast('Avance importado', '⬆');
            } catch (e) {
              showToast('El archivo no es válido.', '⚠️');
            }
          };
          reader.readAsText(file);
        };
        input.click();
        return;
      }
      default:
        return;
    }
    save();
    render();
    ensureTimerLoop();
  }

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    handleAction(el.dataset.action, el);
  });

  // -------------------------------------------------------
  // Arranque
  // -------------------------------------------------------
  ensureTimerLoop();
  render();
})();
