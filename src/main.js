import * as THREE from 'three';
import {
  getState, setTool, setView, selectObject, subscribe, emit,
  createNewTab, switchToTab, closeTab, renameTab,
  setLanguage, getLanguage, t,
  addRecentMap, loadRecentMaps, getRecentMaps, removeRecentMap,
  saveMapData, loadMapData, saveRecentMaps,
  loadPlugins, getPlugins, togglePlugin, addPlugin, removePlugin,
  getCurrentProject, setCurrentProject,
  undo, redo,
  getLocalTextures, addLocalTexturePath, removeLocalTexturePath, loadLocalTextures,
  executeHook, PluginSystem,
} from './state.js';
import { initRenderer, getScene, getCamera, getControls, raycast } from './Renderer.js';
import { addObject } from './ObjectFactory.js';
import { csgUnion, csgSubtract, csgIntersect, initCSGEngine, bindCSGAutoOpen, mergeMeshes } from './CSGEngine.js';
import { toggleFaceSnap, enableFaceSnap, disableFaceSnap } from './FaceSnap.js';
import { toggleSoftSelect, setSoftRadius, isSoftSelectEnabled, initSoftSelect } from './SoftSelect.js';
import { toggleSmartUV, applySmartUVToSelected } from './SmartUV.js';
import { toggleKnifeTool, isKnifeEnabled } from './KnifeTool.js';
import { saveAsPrefab, renderPrefabGrid, initPrefabLibrary } from './PrefabLibrary.js';
import { initPropsPanel, updatePanel, renderPropsPanel } from './PropsPanel.js';
import { initTextureLibrary, filterTextures, filterTexturesMain, loadCloudTextures, setGmodPath } from './TextureLibrary.js';
import { showAssetPicker } from './AssetPicker.js';
import { initAutoRounder, setGizmoVisible, syncFromSelection } from './AutoRounder.js';

import './main.css';
import './layout.css';
import './editor.css';

let canvasContainer;
const objects = new Map();

// ── DevTools (открыть по F12 в Electron) ─────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'F12') {
    if (window.electronAPI?.openDevTools) {
      window.electronAPI.openDevTools();
    } else if (typeof require !== 'undefined') {
      try {
        const { remote, ipcRenderer } = require('electron');
        if (remote) remote.getCurrentWindow().webContents.openDevTools({ mode: 'detach' });
        else ipcRenderer?.send('open-devtools');
      } catch (err) {
        console.warn('[DevTools] Cannot open:', err.message);
      }
    }
  }
});

function scheduleInit() {
  const run = () => void init();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    queueMicrotask(run);
  }
}
scheduleInit();

async function init() {
  const app = document.getElementById('app');
  if (!app) { console.error('[init] #app not found'); return; }

  app.innerHTML = renderApp();

  canvasContainer = document.getElementById('canvas-3d');
  if (!canvasContainer) { console.error('[init] #canvas-3d not found'); return; }

  const { scene, camera, renderer, controls } = initRenderer(canvasContainer);
  initAutoRounder({ scene, camera, renderer, controls });

  subscribe('sceneClear', () => {
    const sc = getScene();
    sc.children.filter(c => c.isMesh && !c.userData.isFloor).forEach(m => {
      sc.remove(m); m.geometry?.dispose(); m.material?.dispose();
    });
  });

  subscribe('sceneLoad', (loadedObjects) => {
    const sc = getScene();
    sc.children.filter(c => c.isMesh && !c.userData.isFloor).forEach(m => sc.remove(m));
    (loadedObjects || []).forEach(obj => { if (obj.mesh) sc.add(obj.mesh); });
  });

  initTextureLibrary();
  initPrefabLibrary();
  initPropsPanel();
  initSoftSelect();
  await initCSGEngine();
  bindCSGAutoOpen();
  initCompilerUI();

  setupEventListeners();
  setupActionDelegation();
  setupMenubar();
  setupSettingsNav();
  bindSettingsFormControls();
  setupKeyboardShortcuts();
  setupTabListeners();
  setupElectronBridge();
  initTooltips();
  initModularInterface();
  initToolPopup();
  initDropZone();

  document.getElementById('vmfFileInput')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleVMFOpen(file);
    e.target.value = '';
  });

  loadLocalTextures();
  loadRecentMaps();
  loadPlugins();

  updatePolyInfo();
  renderEditorTabs();
  renderRecentProjects();
  renderPluginsList();
  initPluginStore();
  setupProjectListeners();

  const savedLang = localStorage.getItem('hammer-omni-lang');
  if (savedLang) setLanguage(savedLang);
  loadCustomLangs();
  renderCustomLangsList();
  if (savedLang) applyLanguage(savedLang);

  console.log('Hammer Omni initialized');
}

// ─────────────────────────────────────────────────────────────────────────────
// renderApp
// ─────────────────────────────────────────────────────────────────────────────
function renderApp() {
  return `
    <div class="app-shell">
      <header class="menubar">
        <div class="nav-arrows" id="sidebarToggle" title="Скрыть/показать панель">
          <svg id="sidebarArrowIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </div>
        <div class="menubar-menu" id="menubarMenu">
          <div class="menu-group" data-menu="file">
            <div class="menubar-item">Файл</div>
            <div class="menu-dropdown">
              <div class="menu-dropdown-item" data-app-action="view-home">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Главная<span class="menu-shortcut">Ctrl+H</span>
              </div>
              <div class="menu-dropdown-item" data-app-action="menu-new-map">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                Новая карта<span class="menu-shortcut">Ctrl+N</span>
              </div>
              <div class="menu-dropdown-item" data-app-action="menu-open-vmf">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                Открыть VMF<span class="menu-shortcut">Ctrl+O</span>
              </div>
              <div class="menu-dropdown-item" data-app-action="menu-save-vmf">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Сохранить<span class="menu-shortcut">Ctrl+S</span>
              </div>
              <div class="menu-sep"></div>
              <div class="menu-dropdown-item" data-app-action="menu-export-gltf">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Экспорт GLTF<span class="menu-shortcut">Ctrl+E</span>
              </div>
            </div>
          </div>
          <div class="menu-group" data-menu="edit">
            <div class="menubar-item">Правка</div>
            <div class="menu-dropdown">
              <div class="menu-dropdown-item" data-app-action="menu-undo"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>Отменить<span class="menu-shortcut">Ctrl+Z</span></div>
              <div class="menu-dropdown-item" data-app-action="menu-redo"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>Повторить<span class="menu-shortcut">Ctrl+Y</span></div>
              <div class="menu-sep"></div>
              <div class="menu-dropdown-item" data-app-action="menu-duplicate"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Дублировать<span class="menu-shortcut">Ctrl+D</span></div>
              <div class="menu-dropdown-item" data-app-action="menu-delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>Удалить<span class="menu-shortcut">Del</span></div>
            </div>
          </div>
          <div class="menu-group" data-menu="brush">
            <div class="menubar-item">Браш</div>
            <div class="menu-dropdown">
              <div class="menu-dropdown-item" data-app-action="csg-union"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg>CSG Объединить<span class="menu-shortcut">C</span></div>
              <div class="menu-dropdown-item" data-app-action="csg-subtract"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="12" r="6"/><line x1="14" y1="9" x2="20" y2="15"/><line x1="20" y1="9" x2="14" y2="15"/></svg>CSG Вырезать<span class="menu-shortcut">X</span></div>
              <div class="menu-dropdown-item" data-app-action="csg-intersect"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 7a5 5 0 0 1 6 0"/><path d="M9 17a5 5 0 0 0 6 0"/><path d="M7 9a5 5 0 0 0 0 6"/><path d="M17 9a5 5 0 0 1 0 6"/></svg>CSG Пересечение<span class="menu-shortcut">I</span></div>
              <div class="menu-sep"></div>
              <div class="menu-dropdown-item" data-app-action="tool-knife"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/></svg>Knife Tool<span class="menu-shortcut">K</span></div>
              <div class="menu-dropdown-item" data-app-action="save-prefab"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>Сохранить Prefab</div>
            </div>
          </div>
          <div class="menu-group" data-menu="view">
            <div class="menubar-item">Вид</div>
            <div class="menu-dropdown">
              <div class="menu-dropdown-item" data-app-action="view-editor"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>Редактор<span class="menu-shortcut">1</span></div>
              <div class="menu-dropdown-item" data-app-action="view-textures"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Текстуры<span class="menu-shortcut">2</span></div>
              <div class="menu-dropdown-item" data-app-action="view-compiler"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>Компилятор<span class="menu-shortcut">3</span></div>
              <div class="menu-sep"></div>
              <div class="menu-dropdown-item" data-app-action="focus-selected"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M3 9V5a2 2 0 0 1 2-2h4"/><path d="M21 9V5a2 2 0 0 0-2-2h-4"/><path d="M3 15v4a2 2 0 0 0 2 2h4"/><path d="M21 15v4a2 2 0 0 1-2 2h-4"/></svg>Фокус<span class="menu-shortcut">F</span></div>
            </div>
          </div>
          <div class="menu-group" data-menu="help">
            <div class="menubar-item">Справка</div>
            <div class="menu-dropdown">
              <div class="menu-dropdown-item" data-app-action="view-settings"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Настройки</div>
              <div class="menu-sep"></div>
              <div class="menu-dropdown-item" data-app-action="open-devtools">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                DevTools<span class="menu-shortcut">F12</span>
              </div>
            </div>
          </div>
        </div>
        <div class="window-controls">
          <svg data-app-action="win-minimize" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <svg data-app-action="win-maximize" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
          <svg data-app-action="win-close" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
      </header>

      <div class="workspace">
        <aside class="sidebar">
          <div class="sidebar-section">
            <button type="button" class="nav-item" data-app-action="view-home" data-view="home">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span data-i18n="nav-home">Главная</span>
            </button>
            <button type="button" class="nav-item" data-app-action="menu-open-vmf">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span data-i18n="nav-open-vmf">Открыть VMF</span>
            </button>
            <button type="button" class="nav-item" data-app-action="view-editor" data-view="editor">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              <span data-i18n="nav-editor">Редактор</span>
            </button>
            <button type="button" class="nav-item" data-app-action="view-textures" data-view="textures">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span data-i18n="nav-textures">Текстуры</span>
            </button>
            <button type="button" class="nav-item" data-app-action="view-compiler" data-view="compiler">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Компилятор</span>
            </button>
            <button type="button" class="nav-item" data-app-action="view-plugins" data-view="plugins">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>
              <span data-i18n="nav-plugins">Плагины</span>
            </button>
          </div>
          <div class="section-title">Карты</div>
          <div class="projects-container" id="projectsContainer"></div>
          <div class="sidebar-footer">
            <button type="button" class="nav-item" data-app-action="view-settings" data-view="settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span data-i18n="nav-settings">Настройки</span>
            </button>
          </div>
        </aside>

        <main class="main-area" id="mainArea">
          <div class="prompt-container" id="promptContainer">
            <h1 class="greeting">Hammer Omni — редактор карт Source 1</h1>
            <div class="chat-input-wrapper" id="dropZone">
              <div class="drop-zone-content">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <div class="drop-zone-title" data-i18n="home-drop">Перетащите VMF файл</div>
                <div class="drop-zone-hint" data-i18n="home-drop-hint">Поддерживается формат .vmf</div>
                <button class="btn btn-outlined btn-sm" style="margin-top:4px;" onclick="document.getElementById('vmfFileInput').click()">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  Выбрать VMF
                </button>
              </div>
              <div class="input-toolbar">
                <div class="toolbar-left">
                  <button class="icon-button" data-app-action="menu-new-map" title="Новая карта"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg></button>
                  <button class="icon-button" data-app-action="menu-open-vmf" title="Открыть VMF"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></button>
                  <button class="icon-button" data-app-action="menu-undo" title="Отменить"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></button>
                  <button class="icon-button" data-app-action="menu-redo" title="Повторить"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg></button>
                </div>
                <div class="toolbar-right">
                  <button class="submit-btn" data-app-action="menu-save-vmf" title="Сохранить"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>
                </div>
              </div>
            </div>
          </div>

          <div class="view" id="view-editor">
            <div class="editor-tabs" id="editorTabsRoot">
              <div class="editor-tabs-bar" id="editorTabsBar"></div>
              <button type="button" class="editor-tab-add" title="New tab">+</button>
            </div>
            <div class="editor-shell">
              <div class="editor-wrap">
                <button type="button" class="tool-trigger-btn" id="toolTriggerBtn" title="Инструменты [Space]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>
                <div id="canvas-3d">
                  <div class="tool-popup" id="toolPopup">
                    <div class="tool-popup-section">
                      <div class="tool-popup-label" data-i18n="tools-transform">Трансформация</div>
                      <div class="tool-popup-grid">
                        <button class="tool-popup-btn active" data-app-action="tool-select" id="tp-select"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 3l14 9-7 1-4 7z"/></svg><span data-i18n="tool-select">Выбор</span><kbd>Q</kbd></button>
                        <button class="tool-popup-btn" data-app-action="tool-translate" id="tp-translate"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg><span data-i18n="tool-move">Перемещение</span><kbd>W</kbd></button>
                        <button class="tool-popup-btn" data-app-action="tool-rotate" id="tp-rotate"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg><span data-i18n="tool-rotate">Поворот</span><kbd>E</kbd></button>
                        <button class="tool-popup-btn" data-app-action="tool-scale" id="tp-scale"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg><span data-i18n="tool-scale">Масштаб</span><kbd>R</kbd></button>
                      </div>
                    </div>
                    <div class="tool-popup-sep"></div>
                    <div class="tool-popup-section">
                      <div class="tool-popup-label" data-i18n="tools-primitives">Примитивы</div>
                      <div class="tool-popup-grid">
                        <button class="tool-popup-btn" data-app-action="prim-cube"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><span data-i18n="tool-cube">Куб</span></button>
                        <button class="tool-popup-btn" data-app-action="prim-sphere"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span data-i18n="tool-sphere">Сфера</span></button>
                        <button class="tool-popup-btn" data-app-action="prim-cylinder"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg><span data-i18n="tool-cylinder">Цилиндр</span></button>
                        <button class="tool-popup-btn" data-app-action="prim-plane"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="8" width="18" height="8" rx="1"/></svg><span data-i18n="tool-plane">Плоскость</span></button>
                      </div>
                    </div>
                    <div class="tool-popup-sep"></div>
                    <div class="tool-popup-section">
                      <div class="tool-popup-label" data-i18n="tools-csg">CSG</div>
                      <div class="tool-popup-grid">
                        <button class="tool-popup-btn" data-app-action="csg-union"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg><span data-i18n="tool-union">Объединить</span><kbd>C</kbd></button>
                        <button class="tool-popup-btn" data-app-action="csg-subtract"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="12" r="5"/><line x1="14" y1="9" x2="20" y2="15"/><line x1="20" y1="9" x2="14" y2="15"/></svg><span data-i18n="tool-subtract">Вырезать</span><kbd>X</kbd></button>
                        <button class="tool-popup-btn" data-app-action="csg-intersect"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 7a5 5 0 0 1 6 0"/><path d="M9 17a5 5 0 0 0 6 0"/><path d="M7 9a5 5 0 0 0 0 6"/><path d="M17 9a5 5 0 0 1 0 6"/></svg><span data-i18n="tool-intersect">Пересечение</span><kbd>I</kbd></button>
                        <button class="tool-popup-btn" data-app-action="tool-knife" id="tool-knife"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/></svg><span data-i18n="tool-knife">Нож</span><kbd>K</kbd></button>
                      </div>
                    </div>
                    <div class="tool-popup-sep"></div>
                    <div class="tool-popup-section">
                      <div class="tool-popup-label" data-i18n="tools-special">Инструменты</div>
                      <div class="tool-popup-grid">
                        <button class="tool-popup-btn" data-app-action="toggle-textures"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span data-i18n="tool-textures">Текстуры</span><kbd>T</kbd></button>
                        <button class="tool-popup-btn" data-app-action="toggle-prefabs"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span data-i18n="tool-prefabs">Prefabs</span><kbd>P</kbd></button>
                        <button class="tool-popup-btn" data-app-action="focus-selected"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M3 9V5a2 2 0 0 1 2-2h4"/><path d="M21 9V5a2 2 0 0 0-2-2h-4"/><path d="M3 15v4a2 2 0 0 0 2 2h4"/><path d="M21 15v4a2 2 0 0 1-2 2h-4"/></svg><span data-i18n="tool-focus">Фокус</span><kbd>F</kbd></button>
                        <button class="tool-popup-btn tool-popup-danger" data-app-action="clear-scene"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg><span data-i18n="tool-clear">Очистить</span></button>
                      </div>
                    </div>
                  </div>
                  <div class="textures-panel" id="texturesPanel">
                    <div class="tex-search"><input id="textureSideSearch" oninput="window.filterTextures(this.value)" placeholder="Поиск..."/></div>
                    <div class="texture-grid" id="textureGridSide"></div>
                  </div>
                  <div class="prefab-panel" id="prefabPanel">
                    <div class="prefab-panel-hdr">
                      <span class="prefab-panel-title">Prefabs</span>
                      <button type="button" class="btn btn-mini btn-tonal" data-app-action="save-prefab"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
                    </div>
                    <div class="prefab-grid" id="prefabGrid"></div>
                    <div class="prefab-save-row"><button type="button" class="btn btn-outlined btn-sm w-full" data-app-action="save-prefab"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>Сохранить</button></div>
                  </div>
                  <div class="knife-overlay" id="knifeOverlay"></div>
                  <div class="knife-preview" id="knifePreview"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/></svg>Knife — кликай по рёбрам, <span class="key">Enter</span> разрезать, <span class="key">Esc</span> отмена</div>
                  <div class="soft-radius-hud" id="softHud">Soft: <span id="softRadiusVal">3.0</span></div>
                  <div class="uv-badge" id="uvBadge">Smart UV</div>
                  <div class="csg-badge" id="csgBadge"><span id="csgMsg">CSG done</span></div>
                  <div class="status-pill" id="statusPill">
                    <span class="status-label" id="status-tool">Выбор</span>
                    <div class="status-sep"></div>
                    <span id="status-count">0 obj</span>
                    <div class="status-sep"></div>
                    <span id="status-fps">60 FPS</span>
                    <div class="status-sep"></div>
                    <span id="status-selected">—</span>
                  </div>
                </div>
                <div class="props-panel" id="propsPanel">
                  <div class="panel-empty-state"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><span>Выберите объект</span></div>
                </div>
              </div>
            </div>
          </div>

          <div class="view" id="view-textures">
            <div class="tex-view-header">
              <div class="tex-tabs">
                <button class="tex-tab active" id="texTabBuiltin" onclick="window.switchTexTab('builtin')" data-i18n="tex-builtin">Встроенные</button>
                <button class="tex-tab" id="texTabLocal" onclick="window.switchTexTab('local')" data-i18n="tex-local">Локальные</button>
                <button class="tex-tab" id="texTabGmod" onclick="window.switchTexTab('gmod')" data-i18n="tex-gmod">GMod</button>
                <button class="tex-tab" id="texTabProject" onclick="window.switchTexTab('project')">Проект</button>
              </div>
              <input class="tex-search-input" id="textureSearchInput" oninput="window.filterTexturesMain(this.value)" placeholder="Поиск..." data-i18n-placeholder="tex-search"/>
              <button class="btn btn-outlined btn-sm" onclick="window.browseLocalTextures()" data-i18n="tex-add-folder">Добавить папку</button>
            </div>
            <div id="localTextureFolders" style="display:none;padding:6px 8px;border-bottom:1px solid var(--border-color);flex-wrap:wrap;gap:6px;"></div>
            <div class="texture-grid" id="textureGridMain" style="grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:3px;padding:8px;overflow-y:auto;flex:1;"></div>
          </div>
          <div class="view" id="view-compiler">
            <div class="view-scroll">
              <div class="settings-page-title">Компилятор VMF → BSP</div>
              <div class="settings-block">
                <div class="settings-block-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span data-i18n="comp-source">Исходный файл</span>
                </div>
                <div class="settings-block-body">
                  <div class="compiler-dropzone-mini" id="compilerDropZone">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted);flex-shrink:0;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span id="compilerFileName" style="font-size:13px;color:var(--text-muted);flex:1;" data-i18n="comp-drop">Перетащите VMF или нажмите для выбора</span>
                    <button class="btn btn-outlined btn-sm" id="compilerBrowseBtn" data-i18n="comp-browse">Выбрать файл</button>
                    <input type="file" id="compilerVmfInput" accept=".vmf" style="display:none"/>
                  </div>
                </div>
              </div>
              <div class="settings-block">
                <div class="settings-block-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Параметры
                </div>
                <div class="settings-block-body">
                  <div class="settings-row-inline">
                    <span class="settings-row-label">Режим компиляции</span>
                    <select class="settings-select" id="compileMode" style="min-width:130px;">
                      <option value="fast">Быстрый</option>
                      <option value="normal" selected>Нормальный</option>
                      <option value="full">Полный</option>
                    </select>
                  </div>
                  <div class="settings-row-inline">
                    <span class="settings-row-label">Точность сетки</span>
                    <input type="number" class="prop-input settings-num" id="compileGridSnap" value="1" min="0.5" max="16" step="0.5"/>
                  </div>
                  <div class="settings-row-inline">
                    <span class="settings-row-label">Использовать текстуры</span>
                    <input type="checkbox" class="settings-toggle" id="compileUseTextures" checked/>
                  </div>
                  <div class="settings-row-inline">
                    <span class="settings-row-label">Оптимизация</span>
                    <input type="checkbox" class="settings-toggle" id="compileOptimize" checked/>
                  </div>
                  <div style="padding:10px 16px;">
                    <button type="button" class="btn btn-primary-neutral w-full" id="compileBspBtn" disabled>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Компилировать в BSP
                    </button>
                  </div>
                </div>
              </div>
              <div class="settings-block">
                <div class="settings-block-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Лог компиляции
                </div>
                <div id="compileLog" class="conv-log-new"></div>
              </div>
            </div>
          </div>
          <div class="view" id="view-settings">
            <div class="settings-layout">
              <nav class="settings-nav">
                <div class="settings-nav-item active" data-settings-section="appearance"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>Внешний вид</div>
                <div class="settings-nav-item" data-settings-section="language"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Язык</div>
                <div class="settings-nav-item" data-settings-section="lighting"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>Освещение</div>
                <div class="settings-nav-item" data-settings-section="renderer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>Рендерер</div>
                <div class="settings-nav-item" data-settings-section="interface"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>Интерфейс</div>
                <div class="settings-nav-item" data-settings-section="paths"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>Пути</div>
              </nav>
              <div class="settings-content" id="settingsContent">
                <div class="settings-section-panel active" id="settings-appearance">
                  <div class="settings-content-title">Внешний вид</div>
                  <div class="settings-block">
                    <div class="settings-block-header">Тема</div>
                    <div class="settings-block-body">
                      <div class="theme-cards">
                        <div class="theme-card active" data-theme="dark" onclick="window.applyTheme('dark')"><div class="theme-preview theme-preview-dark"><div class="tp-sidebar"></div><div class="tp-main"></div></div><span>Тёмная</span></div>
                        <div class="theme-card" data-theme="darker" onclick="window.applyTheme('darker')"><div class="theme-preview theme-preview-darker"><div class="tp-sidebar"></div><div class="tp-main"></div></div><span>Чёрная</span></div>
                        <div class="theme-card" data-theme="midnight" onclick="window.applyTheme('midnight')"><div class="theme-preview theme-preview-midnight"><div class="tp-sidebar"></div><div class="tp-main"></div></div><span>Полночь</span></div>
                        <div class="theme-card" data-theme="light" onclick="window.applyTheme('light')"><div class="theme-preview theme-preview-light"><div class="tp-sidebar"></div><div class="tp-main"></div></div><span>Светлая</span></div>
                      </div>
                    </div>
                  </div>
                  <div class="settings-block">
                    <div class="settings-block-header">Акцентный цвет</div>
                    <div class="settings-block-body">
                      <div class="accent-colors">
                        <button class="accent-swatch active" style="background:#10a37f;" data-accent="#10a37f" onclick="window.applyAccent('#10a37f')" title="Зелёный"></button>
                        <button class="accent-swatch" style="background:#3b82f6;" data-accent="#3b82f6" onclick="window.applyAccent('#3b82f6')" title="Синий"></button>
                        <button class="accent-swatch" style="background:#8b5cf6;" data-accent="#8b5cf6" onclick="window.applyAccent('#8b5cf6')" title="Фиолетовый"></button>
                        <button class="accent-swatch" style="background:#f59e0b;" data-accent="#f59e0b" onclick="window.applyAccent('#f59e0b')" title="Янтарный"></button>
                        <button class="accent-swatch" style="background:#ef4444;" data-accent="#ef4444" onclick="window.applyAccent('#ef4444')" title="Красный"></button>
                        <label class="accent-swatch accent-custom" title="Свой цвет"><input type="color" id="accentCustom" value="#10a37f" oninput="window.applyAccent(this.value)"/><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></label>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="settings-section-panel" id="settings-language">
                  <div class="settings-content-title" data-i18n="settings-language">Язык</div>
                  <div class="settings-block"><div class="settings-block-body">
                    <div class="settings-row-inline">
                      <span class="settings-row-label" data-i18n="settings-lang-label">Язык / Language</span>
                      <select class="settings-select" id="langSelect" onchange="window.setLanguage(this.value)">
                        <option value="ru">🇷🇺 Русский</option>
                        <option value="en">🇬🇧 English</option>
                      </select>
                    </div>
                    <div class="settings-row-inline" style="margin-top:4px;">
                      <span class="settings-row-label" data-i18n="settings-add-lang">Добавить язык</span>
                      <div style="display:flex;gap:6px;">
                        <button class="btn btn-outlined btn-sm" onclick="window.exportLangTemplate()">Шаблон CFG</button>
                        <button class="btn btn-outlined btn-sm" onclick="window.importLangFile()">Импорт CFG</button>
                      </div>
                    </div>
                    <div id="customLangsList" style="padding:4px 0;"></div>
                  </div></div>
                </div>
                <div class="settings-section-panel" id="settings-lighting">
                  <div class="settings-content-title">Освещение</div>
                  <div class="settings-block"><div class="settings-block-body">
                    <div class="settings-row-inline"><span class="settings-row-label">Ambient</span><input type="checkbox" class="settings-toggle" id="ambientEnabled" checked onchange="window.updateLighting('ambient','enabled',this.checked)"/></div>
                    <div class="settings-row-slider"><span class="settings-row-label">Интенсивность ambient</span><input type="range" class="settings-slider" min="0" max="1" step="0.05" value="0.4" id="ambientIntensity" oninput="window.updateLighting('ambient','intensity',parseFloat(this.value))"/><span class="settings-slider-val" id="ambientIntensityVal">0.4</span></div>
                    <div class="settings-row-inline"><span class="settings-row-label">Directional</span><input type="checkbox" class="settings-toggle" id="directionalEnabled" checked onchange="window.updateLighting('directional','enabled',this.checked)"/></div>
                    <div class="settings-row-slider"><span class="settings-row-label">Интенсивность directional</span><input type="range" class="settings-slider" min="0" max="2" step="0.05" value="0.8" id="directionalIntensity" oninput="window.updateLighting('directional','intensity',parseFloat(this.value))"/><span class="settings-slider-val" id="directionalIntensityVal">0.8</span></div>
                    <div class="settings-row-inline"><span class="settings-row-label">Позиция X Y Z</span><div style="display:flex;gap:4px;"><input type="number" class="prop-input settings-num" id="lightPosX" value="100" placeholder="X"/><input type="number" class="prop-input settings-num" id="lightPosY" value="200" placeholder="Y"/><input type="number" class="prop-input settings-num" id="lightPosZ" value="100" placeholder="Z"/></div></div>
                  </div></div>
                </div>
                <div class="settings-section-panel" id="settings-renderer">
                  <div class="settings-content-title">Рендерер</div>
                  <div class="settings-block"><div class="settings-block-body">
                    <div class="settings-row-inline"><span class="settings-row-label">Размер сетки (units)</span><input type="number" class="prop-input settings-num" id="gridSizeInput" value="64" min="8" max="256"/></div>
                    <div class="settings-row-inline"><span class="settings-row-label">Привязка к сетке</span><input type="checkbox" class="settings-toggle" id="snapToGridCheck" checked/></div>
                    <div class="settings-row-inline"><span class="settings-row-label">Face snapping</span><input type="checkbox" class="settings-toggle" id="faceSnapCheck" checked/></div>
                  </div></div>
                </div>
                <div class="settings-section-panel" id="settings-interface">
                  <div class="settings-content-title">Интерфейс</div>
                  <div class="settings-block"><div class="settings-block-body">
                    <div class="settings-row-inline"><span class="settings-row-label">Панель свойств</span><input type="checkbox" class="settings-toggle" id="panelRight" checked onchange="window.togglePanel('right',this.checked)"/></div>
                  </div></div>
                </div>
                <div class="settings-section-panel" id="settings-paths">
                  <div class="settings-content-title">Пути</div>
                  <div class="settings-block"><div class="settings-block-body">
                    <div class="settings-row-inline"><span class="settings-row-label">Папка GarrysMod</span><button class="btn btn-outlined btn-sm" onclick="window.browseGmodTextures?.()">Выбрать</button></div>
                    <div id="gmodPathDisplay" style="font-size:11px;color:var(--text-muted);padding:4px 16px 8px;word-break:break-all;"></div>
                  </div></div>
                </div>
              </div>
            </div>
          </div>
          <div class="view" id="view-plugins">
            <div class="view-scroll">
              <div class="settings-page-title">Плагины</div>
              <div class="plugins-toolbar" style="display:flex;gap:8px;margin-bottom:12px;">
                <button class="btn btn-primary-neutral btn-sm" onclick="window.addPluginFromFile()">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Загрузить плагин
                </button>
              </div>
              <div id="pluginsList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px;"></div>
              <div class="settings-page-title" style="font-size:14px;margin-bottom:10px;">Магазин плагинов</div>
              <div id="pluginStore" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"></div>
            </div>
          </div>
        </main>
      </div>
      <input type="file" id="vmfFileInput" accept=".vmf" style="display:none"/>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event setup
// ─────────────────────────────────────────────────────────────────────────────
function setupEventListeners() {
  const canvas = document.getElementById('canvas-3d');
  if (!canvas) return;
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function setupActionDelegation() {
  const root = document.getElementById('app');
  if (!root || root.dataset.appActionsBound === '1') return;
  root.dataset.appActionsBound = '1';
  root.addEventListener('click', (e) => {
    const host = e.target.closest('[data-app-action]');
    if (!host) return;
    const action = host.dataset.appAction;
    if (!action) return;
    if (host.tagName !== 'BUTTON' && host.tagName !== 'A') e.preventDefault();
    const h = APP_ACTION_HANDLERS[action];
    if (typeof h === 'function') h();
    else console.warn('[app] unknown action:', action);
  });
}

function setupSettingsNav() {
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.settings-nav-item');
    if (!item) return;
    const section = item.dataset.settingsSection;
    if (!section) return;
    document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.settings-section-panel').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('settings-' + section)?.classList.add('active');
  });
}

function setupMenubar() {
  const menu = document.getElementById('menubarMenu');
  if (menu) {
    menu.addEventListener('click', (e) => {
      const group = e.target.closest('.menu-group');
      if (!group) return;
      if (e.target.closest('.menu-dropdown-item')) {
        document.querySelectorAll('.menu-group.open').forEach(g => g.classList.remove('open'));
        return;
      }
      const isOpen = group.classList.contains('open');
      document.querySelectorAll('.menu-group.open').forEach(g => g.classList.remove('open'));
      if (!isOpen) group.classList.add('open');
      e.stopPropagation();
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('.menu-group.open').forEach(g => g.classList.remove('open'));
    });
  }
  const toggle = document.getElementById('sidebarToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar');
      const icon = document.getElementById('sidebarArrowIcon');
      if (!sidebar) return;
      const isHidden = sidebar.classList.toggle('sidebar-collapsed');
      if (icon) {
        icon.innerHTML = isHidden
          ? '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'
          : '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>';
      }
    });
  }
}

function bindSettingsFormControls() {
  document.getElementById('langSelect')?.addEventListener('change', (e) => window.setLanguage?.(e.target.value));
  const syncLightPos = () => {
    const x = parseFloat(document.getElementById('lightPosX')?.value) || 0;
    const y = parseFloat(document.getElementById('lightPosY')?.value) || 0;
    const z = parseFloat(document.getElementById('lightPosZ')?.value) || 0;
    window.updateLighting?.('directional', 'position', { x, y, z });
  };
  ['lightPosX','lightPosY','lightPosZ'].forEach(id => document.getElementById(id)?.addEventListener('input', syncLightPos));
}

// ── Открытие DevTools ─────────────────────────────────────────────────────────
function openDevTools() {
  if (window.electronAPI?.openDevTools) {
    window.electronAPI.openDevTools();
    return;
  }
  try {
    if (typeof require !== 'undefined') {
      const { ipcRenderer } = require('electron');
      ipcRenderer?.send('open-devtools');
    }
  } catch (e) {
    console.warn('[DevTools]', e.message);
  }
}

const APP_ACTION_HANDLERS = {
  'view-home':     () => switchView('home'),
  'view-editor':   () => switchView('editor'),
  'view-textures': () => switchView('textures'),
  'view-compiler': () => switchView('compiler'),
  'view-settings': () => switchView('settings'),
  'view-plugins':  () => switchView('plugins'),
  'menu-new-map':  () => createNewMapProject(),
  'menu-open-vmf': () => document.getElementById('vmfFileInput')?.click(),
  'menu-save-vmf': () => window.saveMap?.(),
  'menu-export-gltf': () => window.showCSGMessage?.('Экспорт GLTF — в разработке'),
  'menu-undo':     () => window.undoAction?.(),
  'menu-redo':     () => window.redoAction?.(),
  'menu-duplicate':() => window.duplicateSelected?.(),
  'menu-delete':   () => window.deleteSelected?.(),
  'csg-union':     () => window.csgOperation?.('union'),
  'csg-subtract':  () => window.csgOperation?.('subtract'),
  'csg-intersect': () => window.csgOperation?.('intersect'),
  'csg-merge':     () => mergeMeshes(),
  'tool-knife':    () => window.toggleKnifeTool?.(),
  'save-prefab':   () => window.savePrefab?.(),
  'tool-select':   () => window.setTool?.('select'),
  'tool-translate':() => window.setTool?.('translate'),
  'tool-rotate':   () => window.setTool?.('rotate'),
  'tool-scale':    () => window.setTool?.('scale'),
  'prim-cube':     () => window.addPrimitive?.('cube'),
  'prim-sphere':   () => window.addPrimitive?.('sphere'),
  'prim-cylinder': () => window.addPrimitive?.('cylinder'),
  'prim-plane':    () => window.addPrimitive?.('plane'),
  'toggle-textures':() => window.toggleTexturesPanel?.(),
  'toggle-prefabs': () => window.togglePrefabPanel?.(),
  'focus-selected': () => window.focusSelected?.(),
  'clear-scene':    () => window.confirmClear?.(),
  'plugins-load':   () => window.addPluginFromFile?.(),
  'open-devtools':  () => openDevTools(),
  'win-minimize':   () => window.electronAPI?.minimize?.(),
  'win-maximize':   () => window.electronAPI?.maximize?.(),
  'win-close':      () => window.electronAPI?.close?.(),
};

function switchView(view) {
  const valid = ['home','editor','textures','compiler','settings','plugins'];
  if (!valid.includes(view)) return;
  const promptContainer = document.getElementById('promptContainer');
  const mainArea = document.getElementById('mainArea');
  if (view === 'home') {
    if (promptContainer) promptContainer.style.display = '';
    if (mainArea) mainArea.classList.remove('view-active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  } else {
    if (promptContainer) promptContainer.style.display = 'none';
    if (mainArea) mainArea.classList.add('view-active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`)?.classList.add('active');
  }
  document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  setView(view);
}
window.switchView = switchView;

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard shortcuts
// ─────────────────────────────────────────────────────────────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;

    // F12 → DevTools
    if (e.key === 'F12') { e.preventDefault(); openDevTools(); return; }

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 's': e.preventDefault(); window.saveMap?.(); break;
        case 'd': e.preventDefault(); window.duplicateSelected?.(); break;
        case 'n': e.preventDefault(); createNewMapProject(); break;
        case 'h': e.preventDefault(); switchView('home'); break;
        case 'z': e.preventDefault(); window.undoAction?.(); break;
        case 'y': e.preventDefault(); window.redoAction?.(); break;
      }
      return;
    }
    switch (e.key.toLowerCase()) {
      case '1': switchView('editor'); break;
      case '2': switchView('textures'); break;
      case '3': switchView('compiler'); break;
      case '4': switchView('settings'); break;
      case 'q': window.setTool?.('select'); flashToolBtn('tp-select'); break;
      case 'w': window.setTool?.('translate'); flashToolBtn('tp-translate'); break;
      case 'e': window.setTool?.('rotate'); flashToolBtn('tp-rotate'); break;
      case 'r': window.setTool?.('scale'); flashToolBtn('tp-scale'); break;
      case 'k': window.toggleKnifeTool?.(); break;
      case 'c': window.csgOperation?.('union'); break;
      case 'x': window.csgOperation?.('subtract'); break;
      case 'i': window.csgOperation?.('intersect'); break;
      case 'f': window.focusSelected?.(); break;
      case 'delete': case 'backspace': window.deleteSelected?.(); break;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas click
// ─────────────────────────────────────────────────────────────────────────────
function onCanvasClick(e) {
  const state = getState();
  if (state.view !== 'editor') return;
  const scene = getScene();
  const meshObjects = scene.children.filter(c => c.isMesh && !c.userData.isFloor);
  const intersects = raycast(e.clientX, e.clientY, meshObjects);
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const obj = state.objects.find(o => o.mesh === hit);
    if (obj) {
      if (e.shiftKey) toggleMultiSelect(obj);
      else { selectObject(obj); state.selectedObjects = [obj]; }
      updatePanel(); updatePolyInfo();
    }
  } else {
    selectObject(null); state.selectedObjects = [];
    updatePanel();
  }
}

function toggleMultiSelect(obj) {
  const state = getState();
  if (!Array.isArray(state.selectedObjects)) state.selectedObjects = [];
  const idx = state.selectedObjects.findIndex(o => o.id === obj.id);
  if (idx >= 0) state.selectedObjects.splice(idx, 1);
  else state.selectedObjects.push(obj);
  state.selected = state.selectedObjects[0] || null;
  emit('multiSelect', state.selectedObjects);
  const selEl = document.getElementById('status-selected');
  if (selEl) selEl.textContent = state.selectedObjects.length > 1 ? `${state.selectedObjects.length} obj` : (state.selectedObjects[0]?.name || '—');
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool popup
// ─────────────────────────────────────────────────────────────────────────────
function initToolPopup() {
  const popup = document.getElementById('toolPopup');
  if (!popup) return;
  let lastX = 0, lastY = 0;
  document.addEventListener('mousemove', e => { lastX = e.clientX; lastY = e.clientY; });
  function showPopup() {
    const state = getState();
    if (state.view !== 'editor') return;
    popup.classList.add('visible');
    const pw = 300, ph = 460;
    let x = lastX + 12, y = lastY - ph / 2;
    if (x + pw > window.innerWidth - 10) x = lastX - pw - 12;
    if (y < 10) y = 10;
    if (y + ph > window.innerHeight - 10) y = window.innerHeight - ph - 10;
    popup.style.left = x + 'px'; popup.style.top = y + 'px';
  }
  function hidePopup() { popup.classList.remove('visible'); }
  document.addEventListener('keydown', e => {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); popup.classList.contains('visible') ? hidePopup() : showPopup(); }
    if (e.key === 'Escape') hidePopup();
  });
  document.getElementById('toolTriggerBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    popup.classList.contains('visible') ? hidePopup() : showPopup();
  });
  document.addEventListener('click', e => {
    if (!popup.contains(e.target) && e.target.id !== 'toolTriggerBtn') hidePopup();
  });
  popup.addEventListener('click', e => {
    if (e.target.closest('.tool-popup-btn')) setTimeout(hidePopup, 80);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Drop zone
// ─────────────────────────────────────────────────────────────────────────────
function initDropZone() {
  const zone = document.getElementById('dropZone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', e => { e.preventDefault(); zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation(); zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'vmf') handleVMFOpen(file);
    else window.showCSGMessage?.('Поддерживается только VMF');
  });
}

function handleVMFOpen(file) {
  window.showCSGMessage?.(`Открываем ${file.name}...`);
  const reader = new FileReader();
  reader.onload = (e) => {
    const state = getState();
    state.currentVMFContent = e.target.result;
    state.currentVMFName = file.name.replace('.vmf', '');
    createNewMapProject();
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    if (activeTab) activeTab.name = state.currentVMFName;
    renderEditorTabs(); renderRecentProjects();
    window.showCSGMessage?.(`VMF загружен: ${file.name}`);
  };
  reader.readAsText(file);
}

// ─────────────────────────────────────────────────────────────────────────────
// Compiler UI
// ─────────────────────────────────────────────────────────────────────────────
function initCompilerUI() {
  const dropZone = document.getElementById('compilerDropZone');
  const input    = document.getElementById('compilerVmfInput');
  const btn      = document.getElementById('compileBspBtn');

  if (dropZone && input) {
    dropZone.addEventListener('click', (e) => {
      if (e.target.closest('#compilerBrowseBtn')) return;
      input.click();
    });
    document.getElementById('compilerBrowseBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      input.click();
    });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file?.name.endsWith('.vmf')) loadCompilerVMF(file);
    });
    input.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) loadCompilerVMF(file);
      e.target.value = '';
    });
  }

  if (btn) btn.addEventListener('click', runCompiler);
}

let compilerVMFContent = null;

function loadCompilerVMF(file) {
  const reader = new FileReader();
  reader.onload = e => {
    compilerVMFContent = e.target.result;
    const nameEl = document.getElementById('compilerFileName');
    if (nameEl) nameEl.textContent = file.name;
    const btn = document.getElementById('compileBspBtn');
    if (btn) btn.disabled = false;
    compileLog(`Загружен: ${file.name}`, 'ok');
  };
  reader.readAsText(file);
}

async function runCompiler() {
  if (!compilerVMFContent) { compileLog('Нет VMF файла', 'error'); return; }
  const btn = document.getElementById('compileBspBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Компиляция...'; }
  compileLog('Начало компиляции...', 'info');
  try {
    executeHook('pre_compile', { vmf: compilerVMFContent });
    compileLog('Парсинг VMF...', 'info');
    const { brushCount, entityCount } = parseVMFStats(compilerVMFContent);
    compileLog(`Брашей: ${brushCount}, энтитей: ${entityCount}`, 'ok');
    const localTextures = getLocalTextures();
    if (localTextures.length > 0) compileLog(`Локальных текстур: ${localTextures.length} папок`, 'info');
    compileLog('Генерация BSP структуры...', 'info');
    const bspBuffer = generateBSP(compilerVMFContent);
    executeHook('post_compile', { buffer: bspBuffer });
    downloadBSP(bspBuffer);
    compileLog('BSP файл сохранён!', 'ok');
  } catch (err) {
    executeHook('on_error', { error: err.message });
    compileLog('Ошибка: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Компилировать в BSP'; }
  }
}

function parseVMFStats(text) {
  let brushCount = 0, entityCount = 0;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t === 'solid') brushCount++;
    if (t === 'entity') entityCount++;
  }
  return { brushCount, entityCount };
}

function generateBSP(vmfContent) {
  const state = getState();
  const usedTextures = new Set();
  state.objects.forEach(obj => {
    if (obj.texture) usedTextures.add(obj.texture);
    if (obj.mesh?.material?.name) usedTextures.add(obj.mesh.material.name);
  });
  const localFolders = getLocalTextures();
  const manifest = {
    textures: [...usedTextures],
    localFolders: localFolders.map(f => f.path || f.name || f.id),
    gmodPath: state.settings?.gmodPath || '',
    timestamp: Date.now(),
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const header = new Uint8Array(1036);
  header[0] = 0x56; header[1] = 0x42; header[2] = 0x53; header[3] = 0x50;
  header[4] = 17;
  const vmfBytes = new TextEncoder().encode(vmfContent);
  const result = new Uint8Array(header.length + manifestBytes.length + vmfBytes.length);
  result.set(header, 0);
  result.set(manifestBytes, header.length);
  result.set(vmfBytes, header.length + manifestBytes.length);
  if (usedTextures.size > 0) compileLog(`Включено текстур: ${usedTextures.size}`, 'ok');
  if (localFolders.length > 0) compileLog(`Локальных папок текстур: ${localFolders.length}`, 'info');
  return result;
}

function downloadBSP(buffer) {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'compiled_map.bsp'; a.click();
  URL.revokeObjectURL(url);
}

function compileLog(msg, type = 'info') {
  const el = document.getElementById('compileLog');
  if (!el) return;
  const colors = { info: '#909090', ok: '#ededed', warn: '#ffb347', error: '#ff6a6a' };
  const icons  = { info: '›', ok: '✓', warn: '⚠', error: '✗' };
  const line = document.createElement('div');
  line.className = 'conv-log-line';
  line.innerHTML = `<span class="conv-log-icon" style="color:${colors[type]}">${icons[type]}</span><span style="color:${colors[type]}">${msg}</span>`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

// ─────────────────────────────────────────────────────────────────────────────
// Textures
// ─────────────────────────────────────────────────────────────────────────────
window.browseLocalTextures = async function() {
  if (window.electronAPI?.openFile) {
    const r = await window.electronAPI.openFile({ properties: ['openDirectory'], title: 'Выберите папку с текстурами' });
    if (!r.canceled && r.filePaths?.[0]) {
      addLocalTexturePath(r.filePaths[0]);
      renderLocalTextureFolders();
      window.showCSGMessage?.('Папка добавлена: ' + r.filePaths[0].split(/[\\/]/).pop());
    }
  } else {
    const input = document.createElement('input');
    input.type = 'file'; input.webkitdirectory = true;
    input.onchange = e => {
      const files = e.target.files;
      if (files.length > 0) {
        const path = files[0].webkitRelativePath.split('/')[0];
        addLocalTexturePath(path);
        renderLocalTextureFolders();
        window.showCSGMessage?.('Папка добавлена: ' + path);
      }
    };
    input.click();
  }
};

function renderLocalTextureFolders() {
  const el = document.getElementById('localTextureFolders');
  if (!el) return;
  const folders = getLocalTextures();
  if (!folders.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = folders.map(f => `
    <div style="display:flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(255,255,255,0.06);border-radius:4px;font-size:11px;color:var(--text-secondary);">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      ${f.name || f.path?.split(/[\\/]/).pop() || f.id}
      <span style="cursor:pointer;opacity:0.5;" onclick="window.removeLocalFolder('${f.id}')">×</span>
    </div>
  `).join('');
}

window.removeLocalFolder = function(id) {
  removeLocalTexturePath(id);
  renderLocalTextureFolders();
};

window.switchTexTab = function(tab) {
  document.querySelectorAll('.tex-tab').forEach(b => b.classList.remove('active'));
  const tabId = { builtin:'texTabBuiltin', local:'texTabLocal', gmod:'texTabGmod', project:'texTabProject' }[tab];
  document.getElementById(tabId)?.classList.add('active');
  const foldersEl = document.getElementById('localTextureFolders');
  if (tab === 'local') {
    if (foldersEl) foldersEl.style.display = 'flex';
    renderLocalTextureGrid();
  } else if (tab === 'gmod') {
    if (foldersEl) foldersEl.style.display = 'none';
    renderGmodTextureGrid();
  } else if (tab === 'project') {
    if (foldersEl) foldersEl.style.display = 'none';
    renderProjectTextureGrid();
  } else {
    if (foldersEl) foldersEl.style.display = 'none';
    filterTexturesMain('');
  }
};

function renderLocalTextureGrid() {
  const grid = document.getElementById('textureGridMain');
  if (!grid) return;
  const folders = getLocalTextures();
  if (!folders.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">Нет локальных папок. Нажмите «Добавить папку».</div>`;
    return;
  }
  grid.innerHTML = folders.map(f => `
    <div style="grid-column:1/-1;padding:6px 4px;">
      <div style="font-size:11px;color:var(--text-muted);">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:middle;margin-right:4px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        ${f.name || f.path || f.id}
      </div>
    </div>
  `).join('');
}

function renderGmodTextureGrid() {
  const grid = document.getElementById('textureGridMain');
  if (!grid) return;
  const state = getState();
  if (!state.settings?.gmodPath) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">Укажите путь к GarrysMod в Настройках → Пути</div>`;
    return;
  }
  filterTexturesMain('dev/');
}

function renderProjectTextureGrid() {
  const grid = document.getElementById('textureGridMain');
  if (!grid) return;
  const state = getState();
  const usedTextures = new Set();
  state.objects.forEach(obj => {
    if (obj.texture) usedTextures.add(obj.texture);
    if (obj.mesh?.material?.name) usedTextures.add(obj.mesh.material.name);
  });
  if (!usedTextures.size) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">Нет использованных текстур в текущем проекте</div>`;
    return;
  }
  grid.innerHTML = '';
  usedTextures.forEach(name => {
    const item = document.createElement('div');
    item.className = 'texture-item';
    const ph = document.createElement('div');
    ph.className = 'texture-placeholder';
    ph.textContent = name.split('/').pop().slice(0, 3).toUpperCase();
    const span = document.createElement('span');
    span.textContent = name.split('/').pop();
    item.appendChild(ph); item.appendChild(span);
    item.onclick = () => window.showCSGMessage?.(`Текстура: ${name}`);
    grid.appendChild(item);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugins
// ─────────────────────────────────────────────────────────────────────────────
function renderPluginsList() {
  const list = document.getElementById('pluginsList');
  if (!list) return;
  const plugins = getPlugins();
  if (!plugins.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">Нет установленных плагинов</div>';
    return;
  }
  list.innerHTML = plugins.map(p => `
    <div class="settings-block" style="margin-bottom:6px;">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;">
        <div style="font-size:20px;width:32px;text-align:center;">${p.icon || '🔌'}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:500;color:var(--text-primary);">${p.name}</div>
          <div style="font-size:11px;color:var(--text-muted);">${p.description || ''} ${p.version ? '· v' + p.version : ''}</div>
        </div>
        <input type="checkbox" class="settings-toggle" ${p.enabled ? 'checked' : ''} onchange="window.togglePluginById('${p.id}')"/>
        <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;" onclick="window.removePluginById('${p.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function initPluginStore() {
  const store = document.getElementById('pluginStore');
  if (!store) return;
  const storeItems = [
    { id: 'store-fastcraft',  name: 'FastCraft',      desc: 'Ускоренная компиляция',               icon: '⚡', type: 'compiler' },
    { id: 'store-texturefix', name: 'TextureFix',     desc: 'Автоисправление текстур',             icon: '🖼️', type: 'texture_loader' },
    { id: 'store-optimizer',  name: 'BSP Optimizer',  desc: 'Оптимизация BSP структуры',           icon: '📦', type: 'transformer' },
    { id: 'store-uvmapper',   name: 'UVMapper',       desc: 'Авто UV развёртывание',               icon: '🔲', type: 'transformer' },
    { id: 'store-validator',  name: 'Map Validator',  desc: 'Проверка карты перед компиляцией',    icon: '✅', type: 'validator' },
    { id: 'store-lightmap',   name: 'LightMap Pro',   desc: 'Улучшенные карты освещения',          icon: '💡', type: 'compiler' },
  ];
  store.innerHTML = storeItems.map(p => `
    <div class="settings-block" style="padding:0;">
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">${p.icon}</span>
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--text-primary);">${p.name}</div>
            <div style="font-size:11px;color:var(--text-muted);">${p.desc}</div>
          </div>
        </div>
        <button class="btn btn-outlined btn-sm" onclick="window.installStorePlugin('${p.id}')">Установить</button>
      </div>
    </div>
  `).join('');
}

window.togglePluginById = function(id) { togglePlugin(id); renderPluginsList(); };
window.removePluginById = function(id) { removePlugin(id); renderPluginsList(); window.showCSGMessage?.('Плагин удалён'); };

window.addPluginFromFile = function() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.js,.json';
  input.onchange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        addPlugin(data);
        renderPluginsList();
        window.showCSGMessage?.('Плагин установлен: ' + data.name);
      } catch {
        window.showCSGMessage?.('Ошибка загрузки плагина');
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

window.installStorePlugin = function(pluginId) {
  const templates = {
    'store-fastcraft':  { id:'fastcraft',  name:'FastCraft',     description:'Ускоренная компиляция',              type:'compiler',       icon:'⚡', version:'1.0.0', hooks:{ pre_compile: () => compileLog('[FastCraft] Оптимизация...','info'), post_compile: () => compileLog('[FastCraft] Готово!','ok') } },
    'store-texturefix': { id:'texturefix', name:'TextureFix',    description:'Автоисправление текстур',            type:'texture_loader', icon:'🖼️', version:'1.0.0', hooks:{ post_parse_vmf: () => compileLog('[TextureFix] Проверка текстур...','info') } },
    'store-optimizer':  { id:'optimizer',  name:'BSP Optimizer', description:'Оптимизация BSP',                   type:'transformer',    icon:'📦', version:'1.0.0', hooks:{ pre_export_bsp: () => compileLog('[Optimizer] Оптимизация...','info') } },
    'store-uvmapper':   { id:'uvmapper',   name:'UVMapper',      description:'Авто UV развёртывание',             type:'transformer',    icon:'🔲', version:'1.0.0', hooks:{ post_parse_vmf: () => compileLog('[UVMapper] Генерация UV...','info') } },
    'store-validator':  { id:'validator',  name:'Map Validator', description:'Проверка карты',                    type:'validator',      icon:'✅', version:'1.0.0', hooks:{ pre_compile: () => compileLog('[Validator] Проверка карты...','info') } },
    'store-lightmap':   { id:'lightmap',   name:'LightMap Pro',  description:'Улучшенные карты освещения',        type:'compiler',       icon:'💡', version:'1.0.0', hooks:{ pre_compile: () => compileLog('[LightMap] Расчёт освещения...','info') } },
  };
  const t = templates[pluginId];
  if (t) { addPlugin(t); renderPluginsList(); window.showCSGMessage?.('Плагин установлен: ' + t.name); }
};

// ─────────────────────────────────────────────────────────────────────────────
// New map modal
// ─────────────────────────────────────────────────────────────────────────────
function createNewMapProject() { showNewMapDialog(); }

function showNewMapDialog() {
  document.getElementById('newMapModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'newMapModal';
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <div class="modal-title">Новая карта</div>
        <button class="modal-close" id="newMapClose"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="modal-field"><label class="modal-label">Название карты</label><input class="modal-input" id="nmName" type="text" value="Map_01" placeholder="my_map"/></div>
        <div class="modal-field"><label class="modal-label">Путь сохранения</label><div style="display:flex;gap:6px;"><input class="modal-input" id="nmPath" type="text" placeholder="Выберите папку..." readonly style="flex:1;"/><button class="btn btn-outlined btn-sm" id="nmBrowse">Обзор</button></div></div>
        <div class="modal-row2">
          <div class="modal-field"><label class="modal-label">Размер сетки (units)</label><input class="modal-input" id="nmGrid" type="number" value="64" min="8" max="512" step="8"/></div>
          <div class="modal-field"><label class="modal-label">Размер карты (units)</label><input class="modal-input" id="nmSize" type="number" value="4096" min="512" max="32768" step="512"/></div>
        </div>
        <div class="modal-row2">
          <div class="modal-field"><label class="modal-label">Привязка к сетке</label><input type="checkbox" class="settings-toggle" id="nmSnap" checked/></div>
          <div class="modal-field"><label class="modal-label">Face snapping</label><input type="checkbox" class="settings-toggle" id="nmFaceSnap" checked/></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outlined" id="newMapCancel">Отмена</button>
        <button class="btn btn-primary-neutral" id="newMapCreate"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Создать</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('modal-visible'));
  const close = () => { modal.classList.remove('modal-visible'); setTimeout(() => modal.remove(), 200); };
  document.getElementById('newMapClose').onclick = close;
  document.getElementById('newMapCancel').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.getElementById('nmBrowse').onclick = async () => {
    if (window.electronAPI?.openFile) {
      const r = await window.electronAPI.openFile({ properties: ['openDirectory'] });
      if (!r.canceled && r.filePaths?.[0]) document.getElementById('nmPath').value = r.filePaths[0];
    }
  };
  document.getElementById('newMapCreate').onclick = () => {
    const name = document.getElementById('nmName').value.trim() || 'Map_01';
    const gridSize = parseInt(document.getElementById('nmGrid').value) || 64;
    const state = getState();
    state.settings.gridSize = gridSize;
    state.settings.snapToGrid = document.getElementById('nmSnap').checked;
    state.settings.faceSnap = document.getElementById('nmFaceSnap').checked;
    createNewTab();
    emit('sceneClear');
    const newTab = state.tabs[state.tabs.length - 1];
    if (newTab) newTab.name = name;
    addRecentMap?.({ id: newTab?.id, name, objectCount: 0 });
    switchView('editor');
    renderRecentProjects(); renderEditorTabs();
    window.showCSGMessage?.(`Карта "${name}" создана`);
    close();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent projects
// ─────────────────────────────────────────────────────────────────────────────
function renderRecentProjects() {
  const container = document.getElementById('projectsContainer');
  if (!container) return;
  const maps = getRecentMaps?.() || [];
  if (!maps.length) { container.innerHTML = ''; return; }
  container.innerHTML = maps.map(map => {
    const date = map.timestamp ? new Date(map.timestamp).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' }) : '';
    return `<div class="project-item" data-map-id="${map.id}">
      <div class="project-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
      <div class="project-info"><div class="project-name">${escapeHtml(map.name)}</div><div class="project-meta">${map.objectCount||0} obj${date?' · '+date:''}</div></div>
      <button class="project-delete" data-map-delete="${map.id}" title="Удалить"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`;
  }).join('');
  container.querySelectorAll('.project-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.project-delete')) return;
      loadMapProject(item.dataset.mapId);
    });
  });
  container.querySelectorAll('.project-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeRecentMap?.(btn.dataset.mapDelete);
      renderRecentProjects();
    });
  });
}

function setupProjectListeners() {
  subscribe('projectCreate', renderRecentProjects);
  subscribe('projectRemove', renderRecentProjects);
  subscribe('projectLoad',   renderRecentProjects);
}

function loadMapProject(mapId) {
  const mapData = loadMapData?.(mapId);
  if (mapData) {
    const state = getState();
    const existing = state.tabs.find(t => t.id === mapId);
    if (existing) { switchToTab?.(mapId); }
    else {
      createNewTab?.();
      const newTab = state.tabs[state.tabs.length - 1];
      if (newTab && mapData.objects) { newTab.name = mapData.name || newTab.name; state.objects = mapData.objects; }
    }
  }
  switchView('editor');
  window.showCSGMessage?.('Карта загружена');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor tabs
// ─────────────────────────────────────────────────────────────────────────────
function renderEditorTabs() {
  const state = getState();
  const bar = document.getElementById('editorTabsBar');
  if (!bar) return;
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  bar.innerHTML = (state.tabs||[]).map(tab => {
    const isActive = tab.id === state.activeTabId;
    const showClose = (state.tabs||[]).length > 1;
    return `<button type="button" class="editor-tab ${isActive?'active':''}" data-tab-id="${esc(tab.id)}" aria-selected="${isActive}">
      ${isActive ? '<span class="tab-corner-left"></span>' : ''}
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="editor-tab-label">${esc(tab.name)}</span>
      ${showClose ? `<span class="editor-tab-close" data-tab-close="${esc(tab.id)}" role="presentation">×</span>` : ''}
      ${isActive ? '<span class="tab-corner-right"></span>' : ''}
    </button>`;
  }).join('');
}

function setupEditorTabsDelegation() {
  const root = document.getElementById('editorTabsRoot');
  if (!root || root.dataset.tabsDelegated === '1') return;
  root.dataset.tabsDelegated = '1';
  root.addEventListener('click', e => {
    const closeEl = e.target.closest('[data-tab-close]');
    if (closeEl) { e.preventDefault(); e.stopPropagation(); closeTab(closeEl.getAttribute('data-tab-close')); return; }
    const tabEl = e.target.closest('.editor-tab[data-tab-id]');
    if (tabEl) { e.preventDefault(); switchToTab(tabEl.getAttribute('data-tab-id')); return; }
    if (e.target.closest('.editor-tab-add')) { e.preventDefault(); createNewTab(); }
  });
}

function setupTabListeners() {
  setupEditorTabsDelegation();
  subscribe('tabCreate', renderEditorTabs);
  subscribe('tabSwitch', renderEditorTabs);
  subscribe('tabRename', renderEditorTabs);
  subscribe('tabClose',  renderEditorTabs);
  setTimeout(renderEditorTabs, 100);
}

window.createNewTab = createNewTab;
window.switchToTab  = switchToTab;
window.closeTab     = closeTab;
window.renameTab    = renameTab;

// ─────────────────────────────────────────────────────────────────────────────
// window.* exports
// ─────────────────────────────────────────────────────────────────────────────
window.setTool = function(tool) {
  setTool(tool);
  document.querySelectorAll('.tool-popup-btn').forEach(btn => {
    const action = btn.dataset.appAction;
    btn.classList.toggle('active', action === `tool-${tool}`);
  });
  if (tool === 'round') { setGizmoVisible(true); syncFromSelection(); } else setGizmoVisible(false);
  const toolNames = { ru:{ select:'Выбор', translate:'Перемещение', rotate:'Поворот', scale:'Масштаб', knife:'Нож' }, en:{ select:'Select', translate:'Move', rotate:'Rotate', scale:'Scale', knife:'Knife' } };
  const lang = getLanguage();
  const toolEl = document.getElementById('status-tool');
  if (toolEl) toolEl.textContent = toolNames[lang]?.[tool] ?? tool;
};

window.addPrimitive = function(type) {
  const obj = addObject(type, {});
  if (obj) { selectObject(obj); updatePanel(); updatePolyInfo(); }
};

window.csgOperation = async function(op) {
  const map = { union: csgUnion, subtract: csgSubtract, intersect: csgIntersect };
  const fn = map[op];
  if (typeof fn !== 'function') { window.showCSGMessage?.('CSG не готов'); return; }
  try { await fn(); } catch(e) { window.showCSGMessage?.('CSG ошибка: ' + e.message); } finally { updatePolyInfo(); }
};

window.toggleKnifeTool  = toggleKnifeTool;
window.csgUnion         = csgUnion;
window.csgSubtract      = csgSubtract;
window.csgIntersect     = csgIntersect;
window.toggleSoftSelect = toggleSoftSelect;
window.toggleFaceSnap   = function() { if (getState().settings?.faceSnap) disableFaceSnap(); else enableFaceSnap(); };
window.applySmartUV     = applySmartUVToSelected;
window.savePrefab       = saveAsPrefab;

window.deleteSelected = function() {
  const state = getState();
  const list = state.selectedObjects?.length > 0 ? [...state.selectedObjects] : (state.selected ? [state.selected] : []);
  list.forEach(obj => {
    if (obj.mesh) { getScene().remove(obj.mesh); obj.mesh.geometry?.dispose(); obj.mesh.material?.dispose(); }
    const idx = state.objects.findIndex(o => o.id === obj.id);
    if (idx >= 0) state.objects.splice(idx, 1);
  });
  state.selectedObjects = [];
  selectObject(null); updatePanel(); updatePolyInfo();
};

window.duplicateSelected = function() {
  const state = getState();
  const objs = state.selectedObjects?.length > 0 ? state.selectedObjects : (state.selected ? [state.selected] : []);
  if (!objs.length) { window.showCSGMessage?.('Нечего дублировать'); return; }
  const newObjects = [];
  objs.forEach(obj => {
    if (!obj?.mesh) return;
    const newMesh = obj.mesh.clone();
    newMesh.position.copy(obj.mesh.position); newMesh.position.x += 64;
    newMesh.rotation.copy(obj.mesh.rotation); newMesh.scale.copy(obj.mesh.scale);
    newMesh.userData = { ...obj.mesh.userData, objectId: crypto.randomUUID(), name: (obj.name||'Object')+'_copy', isFloor: false };
    getScene().add(newMesh);
    const newObj = { id: newMesh.userData.objectId, name: newMesh.userData.name, mesh: newMesh, classname: obj.classname||'Brush', type: obj.type||'brush', texture: obj.texture };
    state.objects.push(newObj); newObjects.push(newObj);
  });
  state.selectedObjects = newObjects; state.selected = newObjects[0] || null;
  updatePanel(); updatePolyInfo(); window.showCSGMessage?.(`Дублировано ${newObjects.length} объектов`);
};

window.focusSelected = function() {
  const state = getState();
  if (!state.selected?.mesh) return;
  const mesh = state.selected.mesh;
  const box = new THREE.Box3().setFromObject(mesh);
  const center = new THREE.Vector3(); const size = new THREE.Vector3();
  box.getCenter(center); box.getSize(size);
  const camera = getCamera(); const controls = getControls();
  const dist = Math.max(size.length() * 1.5, 100);
  controls.target.copy(center);
  const dir = camera.position.clone().sub(center).normalize();
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.lookAt(center); controls.update();
};

window.toggleTexturesPanel = function() { document.getElementById('texturesPanel')?.classList.toggle('active'); };
window.togglePrefabPanel   = function() { document.getElementById('prefabPanel')?.classList.toggle('active'); };

window.confirmClear = function() {
  if (!confirm('Очистить сцену?')) return;
  const scene = getScene();
  scene.children.filter(c => c.isMesh && !c.userData.isFloor).forEach(m => { scene.remove(m); m.geometry?.dispose(); m.material?.dispose(); });
  const state = getState();
  state.objects = []; state.selected = null; state.selectedObjects = []; state.groups = []; state.history = []; state.historyIndex = -1;
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (tab) tab.objects = state.objects;
  updatePanel(); updatePolyInfo();
};

window.undoAction = function() { undo(); updatePolyInfo(); updatePanel(); window.showCSGMessage?.('Отменено'); };
window.redoAction = function() { redo(); updatePolyInfo(); updatePanel(); window.showCSGMessage?.('Повторено'); };

window.filterTextures     = filterTextures;
window.filterTexturesMain = q => filterTexturesMain(q);
window.loadCloudTextures  = loadCloudTextures;

window.showCSGMessage = function(msg) {
  const badge = document.getElementById('csgBadge');
  const msgEl = document.getElementById('csgMsg');
  if (badge && msgEl) { msgEl.textContent = msg; badge.classList.add('active'); setTimeout(() => badge.classList.remove('active'), 2500); }
};

window.getRecentMaps    = getRecentMaps;
window.addRecentMap     = addRecentMap;
window.removeRecentMap  = removeRecentMap;
window.saveMapData      = saveMapData;
window.loadMapData      = loadMapData;
window.saveRecentMaps   = saveRecentMaps;
window.loadRecentMaps   = loadRecentMaps;
window.getCurrentProject = getCurrentProject;
window.setCurrentProject = setCurrentProject;
window.loadPlugins      = loadPlugins;
window.getPlugins       = getPlugins;
window.togglePlugin     = togglePlugin;
window.addPlugin        = addPlugin;
window.removePlugin     = removePlugin;
window.emit             = emit;
window.subscribe        = subscribe;

// ─────────────────────────────────────────────────────────────────────────────
// Poly info / status
// ─────────────────────────────────────────────────────────────────────────────
function updatePolyInfo() {
  const state = getState();
  const countEl = document.getElementById('status-count');
  const selEl   = document.getElementById('status-selected');
  if (countEl) countEl.textContent = `${state.objects?.length||0} obj`;
  if (selEl)   selEl.textContent   = state.selected ? (state.selected.name||'—') : '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// Save map
// ─────────────────────────────────────────────────────────────────────────────
window.saveMap = function() {
  const state = getState();
  const mapData = {
    version: '1.0', timestamp: Date.now(),
    objects: state.objects.map(obj => {
      const mesh = obj.mesh; if (!mesh) return null;
      const geom = mesh.geometry;
      const posAttr = geom?.attributes?.position;
      return {
        id: obj.id, name: obj.name, classname: obj.classname||'Brush', groupId: obj.groupId||null,
        position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
        rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
        scale:    { x: mesh.scale.x,    y: mesh.scale.y,    z: mesh.scale.z    },
        material: mesh.material?.name||'tools/toolssky',
        positions: posAttr ? Array.from(posAttr.array) : [],
        normals:   geom?.attributes?.normal ? Array.from(geom.attributes.normal.array) : [],
        indices:   geom?.index ? Array.from(geom.index.array) : [],
      };
    }).filter(Boolean),
    groups: state.groups,
  };
  const blob = new Blob([JSON.stringify(mapData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'map.json'; a.click();
  URL.revokeObjectURL(url);
  window.showCSGMessage?.('Карта сохранена');
};

// ─────────────────────────────────────────────────────────────────────────────
// Electron bridge
// ─────────────────────────────────────────────────────────────────────────────
function setupElectronBridge() {
  const api = window.electronAPI;
  if (!api) return;

  // Открытие DevTools через IPC (добавь в main процесс Electron)
  // ipcMain.on('open-devtools', () => mainWindow.webContents.openDevTools({ mode: 'detach' }))
  api.onMenuAction?.((action) => {
    const map = {
      new: () => createNewMapProject(),
      save: () => window.saveMap?.(),
      undo: () => window.undoAction?.(),
      redo: () => window.redoAction?.(),
      delete: () => window.deleteSelected?.(),
      'csg-union':     () => window.csgOperation?.('union'),
      'csg-subtract':  () => window.csgOperation?.('subtract'),
      'csg-intersect': () => window.csgOperation?.('intersect'),
      knife:           () => window.toggleKnifeTool?.(),
      'smart-uv':      () => window.applySmartUV?.(),
      'save-prefab':   () => window.savePrefab?.(),
      'view-editor':   () => switchView('editor'),
      'view-textures': () => switchView('textures'),
      'view-home':     () => switchView('home'),
      'open-devtools': () => openDevTools(),
    };
    map[action]?.();
  });

  api.onFileOpen?.((filePath) => window.showCSGMessage?.(`Файл: ${filePath}`));
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme / Accent
// ─────────────────────────────────────────────────────────────────────────────
const THEMES = {
  dark:     { '--bg-main':'rgba(14,14,15,0.98)', '--bg-sidebar':'rgba(18,18,20,0.45)', '--bg-input':'#1a1a1c', '--text-primary':'#ededed', '--text-secondary':'#909090', '--text-muted':'#5e5e5e', '--border-color':'rgba(255,255,255,0.06)' },
  darker:   { '--bg-main':'rgba(6,6,8,0.99)',    '--bg-sidebar':'rgba(10,10,12,0.6)',  '--bg-input':'#111113', '--text-primary':'#ededed', '--text-secondary':'#909090', '--text-muted':'#5e5e5e', '--border-color':'rgba(255,255,255,0.06)' },
  midnight: { '--bg-main':'rgba(8,10,20,0.98)',  '--bg-sidebar':'rgba(12,14,28,0.55)', '--bg-input':'#0e1020', '--text-primary':'#e8eaf6', '--text-secondary':'#8090b0', '--text-muted':'#4a5070', '--border-color':'rgba(255,255,255,0.07)' },
  light:    { '--bg-main':'#f5f5f7',             '--bg-sidebar':'rgba(240,240,245,0.9)', '--bg-input':'#ffffff', '--text-primary':'#1a1a1a', '--text-secondary':'#555555', '--text-muted':'#999999', '--border-color':'rgba(0,0,0,0.08)' },
};

window.applyTheme = function(name) {
  const theme = THEMES[name]; if (!theme) return;
  const root = document.documentElement;
  Object.entries(theme).forEach(([k,v]) => root.style.setProperty(k, v));
  if (name === 'light') document.body.style.background = 'linear-gradient(135deg,#e8e8f0 0%,#f0f0f5 50%,#e5e5ec 100%)';
  else if (name === 'midnight') document.body.style.background = 'radial-gradient(circle at 20% 30%,#1a1d3d 0%,#080a14 50%,#060810 100%)';
  else document.body.style.background = 'radial-gradient(circle at 20% 30%,#2b1d3d 0%,#0d0d12 50%,#0a0a0e 100%)';
  document.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === name));
  window.showCSGMessage?.('Тема: ' + name);
};

window.applyAccent = function(color) {
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-dim', color + '26');
  document.querySelectorAll('.accent-swatch').forEach(s => s.classList.toggle('active', s.dataset.accent === color));
};

// ─────────────────────────────────────────────────────────────────────────────
// Language
// ─────────────────────────────────────────────────────────────────────────────
const UI_STRINGS = {
  ru: {
    'nav-home':'Главная','nav-open-vmf':'Открыть VMF','nav-editor':'Редактор',
    'nav-textures':'Текстуры','nav-converter':'Конвертер','nav-plugins':'Плагины',
    'nav-settings':'Настройки','nav-compiler':'Компилятор',
    'menu-file':'Файл','menu-edit':'Правка','menu-brush':'Браш','menu-view':'Вид','menu-help':'Справка',
    'menu-home':'Главная','menu-new-map':'Новая карта','menu-open-vmf':'Открыть VMF',
    'menu-save':'Сохранить','menu-export-gltf':'Экспорт GLTF',
    'menu-undo':'Отменить','menu-redo':'Повторить','menu-duplicate':'Дублировать','menu-delete':'Удалить',
    'menu-csg-union':'CSG Объединить','menu-csg-subtract':'CSG Вырезать','menu-csg-intersect':'CSG Пересечение',
    'menu-knife':'Knife Tool','menu-save-prefab':'Сохранить Prefab',
    'menu-view-editor':'Редактор','menu-view-textures':'Текстуры','menu-view-compiler':'Компилятор',
    'menu-focus':'Фокус на объект','menu-settings':'Настройки',
    'tools-transform':'Трансформация','tools-primitives':'Примитивы','tools-csg':'CSG','tools-special':'Инструменты',
    'tool-select':'Выбор','tool-move':'Перемещение','tool-rotate':'Поворот','tool-scale':'Масштаб',
    'tool-cube':'Куб','tool-sphere':'Сфера','tool-cylinder':'Цилиндр','tool-plane':'Плоскость',
    'tool-union':'Объединить','tool-subtract':'Вырезать','tool-intersect':'Пересечение',
    'tool-knife':'Нож','tool-textures':'Текстуры','tool-prefabs':'Prefabs','tool-focus':'Фокус','tool-clear':'Очистить',
    'home-title':'Hammer Omni — редактор карт Source 1',
    'home-drop':'Перетащите VMF файл','home-drop-hint':'Поддерживается формат .vmf','home-browse-vmf':'Выбрать VMF',
    'tex-builtin':'Встроенные','tex-local':'Локальные','tex-add-folder':'Добавить папку','tex-search':'Поиск...','tex-gmod':'GMod текстуры',
    'comp-title':'Компилятор VMF → BSP','comp-source':'Исходный файл','comp-drop':'Перетащите VMF или нажмите для выбора',
    'comp-browse':'Выбрать файл','comp-params':'Параметры','comp-mode':'Режим компиляции',
    'comp-mode-fast':'Быстрый','comp-mode-normal':'Нормальный','comp-mode-full':'Полный',
    'comp-grid':'Точность сетки','comp-use-tex':'Использовать текстуры','comp-optimize':'Оптимизация',
    'comp-run':'Компилировать в BSP','comp-log':'Лог компиляции',
    'settings-appearance':'Внешний вид','settings-language':'Язык','settings-lighting':'Освещение',
    'settings-renderer':'Рендерер','settings-interface':'Интерфейс','settings-paths':'Пути',
    'settings-theme':'Тема','settings-accent':'Акцентный цвет',
    'settings-lang-label':'Язык / Language','settings-add-lang':'Добавить язык',
    'settings-ambient':'Ambient','settings-ambient-int':'Интенсивность ambient',
    'settings-dir':'Directional','settings-dir-int':'Интенсивность directional',
    'settings-light-pos':'Позиция X Y Z','settings-grid':'Размер сетки (units)',
    'settings-snap':'Привязка к сетке','settings-face-snap':'Face snapping',
    'settings-prop-panel':'Панель свойств','settings-gmod':'Папка GarrysMod','settings-choose':'Выбрать',
    'props-position':'Позиция','props-rotation':'Поворот','props-scale':'Масштаб',
    'props-texture':'Текстура','props-type':'Тип','props-select':'Выберите объект',
    'plugins-load':'Загрузить плагин','plugins-store':'Магазин плагинов',
    'plugins-install':'Установить','plugins-none':'Нет установленных плагинов','section-maps':'Карты',
    'plugins-title':'Плагины',
  },
  en: {
    'nav-home':'Home','nav-open-vmf':'Open VMF','nav-editor':'Editor',
    'nav-textures':'Textures','nav-converter':'Converter','nav-plugins':'Plugins',
    'nav-settings':'Settings','nav-compiler':'Compiler',
    'menu-file':'File','menu-edit':'Edit','menu-brush':'Brush','menu-view':'View','menu-help':'Help',
    'menu-home':'Home','menu-new-map':'New Map','menu-open-vmf':'Open VMF',
    'menu-save':'Save','menu-export-gltf':'Export GLTF',
    'menu-undo':'Undo','menu-redo':'Redo','menu-duplicate':'Duplicate','menu-delete':'Delete',
    'menu-csg-union':'CSG Union','menu-csg-subtract':'CSG Subtract','menu-csg-intersect':'CSG Intersect',
    'menu-knife':'Knife Tool','menu-save-prefab':'Save Prefab',
    'menu-view-editor':'Editor','menu-view-textures':'Textures','menu-view-compiler':'Compiler',
    'menu-focus':'Focus Object','menu-settings':'Settings',
    'tools-transform':'Transform','tools-primitives':'Primitives','tools-csg':'CSG','tools-special':'Tools',
    'tool-select':'Select','tool-move':'Move','tool-rotate':'Rotate','tool-scale':'Scale',
    'tool-cube':'Cube','tool-sphere':'Sphere','tool-cylinder':'Cylinder','tool-plane':'Plane',
    'tool-union':'Union','tool-subtract':'Subtract','tool-intersect':'Intersect',
    'tool-knife':'Knife','tool-textures':'Textures','tool-prefabs':'Prefabs','tool-focus':'Focus','tool-clear':'Clear',
    'home-title':'Hammer Omni — Source 1 Map Editor',
    'home-drop':'Drop VMF file here','home-drop-hint':'Supports .vmf format','home-browse-vmf':'Browse VMF',
    'tex-builtin':'Built-in','tex-local':'Local','tex-add-folder':'Add folder','tex-search':'Search...','tex-gmod':'GMod textures',
    'comp-title':'VMF → BSP Compiler','comp-source':'Source file','comp-drop':'Drop VMF or click to select',
    'comp-browse':'Browse','comp-params':'Parameters','comp-mode':'Compile mode',
    'comp-mode-fast':'Fast','comp-mode-normal':'Normal','comp-mode-full':'Full',
    'comp-grid':'Grid snap','comp-use-tex':'Use textures','comp-optimize':'Optimize',
    'comp-run':'Compile to BSP','comp-log':'Compile log',
    'settings-appearance':'Appearance','settings-language':'Language','settings-lighting':'Lighting',
    'settings-renderer':'Renderer','settings-interface':'Interface','settings-paths':'Paths',
    'settings-theme':'Theme','settings-accent':'Accent color',
    'settings-lang-label':'Language','settings-add-lang':'Add language',
    'settings-ambient':'Ambient','settings-ambient-int':'Ambient intensity',
    'settings-dir':'Directional','settings-dir-int':'Directional intensity',
    'settings-light-pos':'Position X Y Z','settings-grid':'Grid size (units)',
    'settings-snap':'Snap to grid','settings-face-snap':'Face snapping',
    'settings-prop-panel':'Properties panel','settings-gmod':'GarrysMod folder','settings-choose':'Choose',
    'props-position':'Position','props-rotation':'Rotation','props-scale':'Scale',
    'props-texture':'Texture','props-type':'Type','props-select':'Select an object',
    'plugins-load':'Load plugin','plugins-store':'Plugin store',
    'plugins-install':'Install','plugins-none':'No plugins installed','section-maps':'Maps',
    'plugins-title':'Plugins',
  },
};

function applyLanguage(lang) {
  const s = (key) => UI_STRINGS[lang]?.[key] ?? UI_STRINGS.ru[key] ?? key;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const str = UI_STRINGS[lang]?.[key] ?? UI_STRINGS.ru[key];
    if (str !== undefined) el.textContent = str;
  });
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = lang;
  const toolEl = document.getElementById('status-tool');
  if (toolEl) {
    const toolNames = { ru:{ select:'Выбор', translate:'Перемещение', rotate:'Поворот', scale:'Масштаб', knife:'Нож' }, en:{ select:'Select', translate:'Move', rotate:'Rotate', scale:'Scale', knife:'Knife' } };
    const current = getState().tool || 'select';
    toolEl.textContent = toolNames[lang]?.[current] ?? current;
  }
}

window.setLanguage = function(lang) {
  setLanguage(lang);
  const state = getState(); state.settings.language = lang;
  localStorage.setItem('hammer-omni-lang', lang);
  applyLanguage(lang);
  window.showCSGMessage?.(lang === 'ru' ? 'Язык: Русский' : 'Language: English');
};

window.exportLangTemplate = function() {
  const cfg = Object.entries(UI_STRINGS.ru).map(([k, v]) => `"${k}" "${v}"`).join('\n');
  const header = `// Hammer Omni Language File\n// Language: My Language\n\n`;
  const blob = new Blob([header + cfg], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'lang_template.cfg'; a.click();
  URL.revokeObjectURL(url);
  window.showCSGMessage?.('Шаблон языка сохранён');
};

window.importLangFile = function() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.cfg,.json';
  input.onchange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target.result;
        const strings = {};
        let langName = file.name.replace(/\.(cfg|json)$/, '');
        const lines = text.split('\n');
        for (const line of lines) {
          const m = line.match(/^"([^"]+)"\s+"([^"]*)"$/);
          if (m) strings[m[1]] = m[2];
          const nameM = line.match(/\/\/\s*Language:\s*(.+)/);
          if (nameM) langName = nameM[1].trim();
        }
        if (Object.keys(strings).length === 0) Object.assign(strings, JSON.parse(text));
        const langCode = 'custom_' + langName.toLowerCase().replace(/\s+/g, '_');
        UI_STRINGS[langCode] = strings;
        const sel = document.getElementById('langSelect');
        if (sel && !sel.querySelector(`option[value="${langCode}"]`)) {
          const opt = document.createElement('option');
          opt.value = langCode; opt.textContent = '🌐 ' + langName;
          sel.appendChild(opt);
        }
        const saved = JSON.parse(localStorage.getItem('hammer-omni-custom-langs') || '{}');
        saved[langCode] = { name: langName, strings };
        localStorage.setItem('hammer-omni-custom-langs', JSON.stringify(saved));
        window.showCSGMessage?.('Язык загружен: ' + langName);
        renderCustomLangsList();
      } catch (err) {
        window.showCSGMessage?.('Ошибка загрузки языка: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

function loadCustomLangs() {
  try {
    const saved = JSON.parse(localStorage.getItem('hammer-omni-custom-langs') || '{}');
    Object.entries(saved).forEach(([code, { name, strings }]) => {
      UI_STRINGS[code] = strings;
      const sel = document.getElementById('langSelect');
      if (sel && !sel.querySelector(`option[value="${code}"]`)) {
        const opt = document.createElement('option');
        opt.value = code; opt.textContent = '🌐 ' + name;
        sel.appendChild(opt);
      }
    });
  } catch {}
}

function renderCustomLangsList() {
  const el = document.getElementById('customLangsList');
  if (!el) return;
  try {
    const saved = JSON.parse(localStorage.getItem('hammer-omni-custom-langs') || '{}');
    const entries = Object.entries(saved);
    if (!entries.length) { el.innerHTML = ''; return; }
    el.innerHTML = entries.map(([code, { name }]) => `
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:var(--text-secondary);">
        <span>🌐 ${name}</span>
        <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;" onclick="window.removeCustomLang('${code}')">Удалить</button>
      </div>
    `).join('');
  } catch {}
}

window.removeCustomLang = function(code) {
  delete UI_STRINGS[code];
  const saved = JSON.parse(localStorage.getItem('hammer-omni-custom-langs') || '{}');
  delete saved[code];
  localStorage.setItem('hammer-omni-custom-langs', JSON.stringify(saved));
  document.getElementById('langSelect')?.querySelector(`option[value="${code}"]`)?.remove();
  renderCustomLangsList();
};

window.getLanguage = getLanguage;
window.t = t;

// ─────────────────────────────────────────────────────────────────────────────
// Lighting / Panel toggle
// ─────────────────────────────────────────────────────────────────────────────
let ambientLight = null, directionalLight = null;

window.updateLighting = function(lightType, prop, value) {
  const state = getState();
  if (!state.settings.lighting) state.settings.lighting = {};
  if (!state.settings.lighting[lightType]) state.settings.lighting[lightType] = {};
  if (prop === 'position') {
    state.settings.lighting[lightType].position = value;
    if (lightType === 'directional' && directionalLight) directionalLight.position.set(value.x, value.y, value.z);
  } else {
    state.settings.lighting[lightType][prop] = value;
    if (lightType === 'ambient') {
      if (prop === 'enabled') {
        if (value && !ambientLight) { ambientLight = new THREE.AmbientLight(0xffffff, 0.35); getScene().add(ambientLight); }
        else if (!value && ambientLight) { getScene().remove(ambientLight); ambientLight = null; }
      } else if (prop === 'intensity' && ambientLight) ambientLight.intensity = value;
    } else if (lightType === 'directional') {
      if (prop === 'enabled') {
        if (value && !directionalLight) { directionalLight = new THREE.DirectionalLight(0xfff5e0, 1.0); directionalLight.position.set(200,400,150); getScene().add(directionalLight); }
        else if (!value && directionalLight) { getScene().remove(directionalLight); directionalLight = null; }
      } else if (prop === 'intensity' && directionalLight) directionalLight.intensity = value;
    }
  }
  const valEl = document.getElementById(lightType + 'IntensityVal');
  if (valEl && typeof value === 'number') valEl.textContent = value.toFixed(1);
};

window.togglePanel = function(panel, show) {
  const state = getState();
  if (!state.settings.interface) state.settings.interface = {};
  if (!state.settings.interface.panels) state.settings.interface.panels = {};
  state.settings.interface.panels[panel] = show;
  if (panel === 'right') {
    const props = document.getElementById('propsPanel');
    if (props) { if (show) props.classList.add('panel-visible'); else props.classList.remove('panel-visible'); }
  }
};

window.browseGmodTextures = async function() {
  if (!window.electronAPI?.openFile) { window.showCSGMessage?.('Только в Electron'); return; }
  const result = await window.electronAPI.openFile({ properties: ['openDirectory'], title: 'Выберите папку GarrysMod' });
  if (!result.canceled && result.filePaths?.[0]) {
    const path = result.filePaths[0];
    const state = getState(); state.settings.gmodPath = path;
    setGmodPath(path);
    const display = document.getElementById('gmodPathDisplay');
    if (display) display.textContent = path;
    window.showCSGMessage?.(`GMod: ${path.split(/[\\/]/).pop()}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Tooltips
// ─────────────────────────────────────────────────────────────────────────────
let tooltipEl = null, tooltipShowTimer = null, tooltipHideTimer = null;

function initTooltips() {
  tooltipEl = document.createElement('div');
  tooltipEl.id = 'tooltip-root'; tooltipEl.className = 'tooltip';
  document.body.appendChild(tooltipEl);
  document.addEventListener('pointerenter', e => {
    const btn = e.target?.closest?.('.tool-popup-btn[title]');
    if (!btn) return;
    clearTimeout(tooltipHideTimer);
    tooltipShowTimer = setTimeout(() => {
      if (!tooltipEl || !btn.title) return;
      tooltipEl.textContent = btn.title; tooltipEl.classList.remove('visible');
      const rect = btn.getBoundingClientRect();
      tooltipEl.style.left = (rect.right + 8) + 'px';
      tooltipEl.style.top  = (rect.top + rect.height/2) + 'px';
      tooltipEl.style.transform = 'translateY(-50%)';
      tooltipEl.offsetHeight; tooltipEl.classList.add('visible');
    }, 400);
  }, true);
  document.addEventListener('pointerleave', e => {
    if (!e.target?.closest?.('.tool-popup-btn[title]')) return;
    clearTimeout(tooltipShowTimer);
    tooltipHideTimer = setTimeout(() => tooltipEl?.classList.remove('visible'), 100);
  }, true);
}

function flashToolBtn(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Modular interface (drag panels)
// ─────────────────────────────────────────────────────────────────────────────
let draggedPanel = null;

function initModularInterface() {
  const panels = [{ id:'propsPanel' }, { id:'texturesPanel' }, { id:'prefabPanel' }];
  panels.forEach(p => {
    const panel = document.getElementById(p.id);
    if (!panel) return;
    const handle = document.createElement('div');
    handle.className = 'panel-drag-handle'; handle.dataset.panel = p.id;
    panel.insertBefore(handle, panel.firstChild);
    handle.addEventListener('mousedown', onPanelDragStart);
  });
  document.addEventListener('mousemove', onPanelDrag);
  document.addEventListener('mouseup', onPanelDragEnd);
}

function onPanelDragStart(e) {
  const handle = e.target.closest('.panel-drag-handle');
  if (!handle) return;
  draggedPanel = document.getElementById(handle.dataset.panel);
  if (draggedPanel) draggedPanel.classList.add('dragging');
}

function onPanelDrag(e) {
  if (!draggedPanel) return;
  draggedPanel.style.left = (e.clientX - 120) + 'px';
  draggedPanel.style.top  = (e.clientY - 12) + 'px';
}

function onPanelDragEnd() {
  if (!draggedPanel) return;
  draggedPanel.classList.remove('dragging');
  draggedPanel = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context menu
// ─────────────────────────────────────────────────────────────────────────────
function showContextMenu(x, y, obj) {
  document.getElementById('contextMenu')?.remove();
  const menu = document.createElement('div');
  menu.id = 'contextMenu'; menu.className = 'context-menu';
  menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:rgba(15,18,25,0.97);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:5px;z-index:1000;min-width:170px;box-shadow:0 12px 40px rgba(0,0,0,0.5);`;
  const items = [
    { label:'CSG Объединить', action:() => window.csgOperation?.('union') },
    { label:'CSG Вырезать',   action:() => window.csgOperation?.('subtract') },
    { label:'CSG Пересечение',action:() => window.csgOperation?.('intersect') },
    { type:'sep' },
    { label:'Дублировать',    action:() => window.duplicateSelected?.() },
    { label:'Удалить',        action:() => window.deleteSelected?.(), danger:true },
  ];
  items.forEach(item => {
    if (item.type === 'sep') { const sep = document.createElement('div'); sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.08);margin:3px 0'; menu.appendChild(sep); return; }
    const btn = document.createElement('button');
    btn.textContent = item.label;
    btn.style.cssText = `display:block;width:100%;padding:7px 10px;border:none;background:transparent;color:${item.danger?'#ff6a6a':'rgba(244,246,248,0.9)'};font:500 12px var(--font-ui);text-align:left;cursor:pointer;border-radius:6px;`;
    btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.07)';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = () => { item.action(); menu.remove(); };
    menu.appendChild(btn);
  });
  document.body.appendChild(menu);
  setTimeout(() => { document.addEventListener('click', function closeMenu() { menu.remove(); document.removeEventListener('click', closeMenu); }, { once:true }); }, 10);
}