import * as THREE from 'three';

const translations = {
  ru: {
    appTitle: 'VMF → BSP Компилятор',
    compiler: 'Компилятор',
    textures: 'Текстуры',
    plugins: 'Плагины',
    settings: 'Настройки',
    localTextures: 'Локальные текстуры',
    noTextures: 'Нет загруженных текстур',
    addFolder: 'Добавить папку',
    dropZoneTitle: 'Перетащите VMF файл сюда',
    dropZoneHint: 'или нажмите для выбора файла',
    compileOptions: 'Параметры компиляции',
    mode: 'Режим',
    modeFast: 'Быстрый (fast)',
    modeNormal: 'Нормальный',
    modeFull: 'Полный',
    gridSnap: 'Точность сетки',
    useTextures: 'Включить текстуры',
    optimize: 'Оптимизация',
    compileToBSP: 'Компилировать в BSP',
    compileLog: 'Лог компиляции',
    logEmpty: 'Ожидание компиляции...',
    localTexturesTitle: 'Локальные текстуры',
    addLocalFolder: 'Добавить папку',
    pluginsTitle: 'Плагины компилятора',
    addPlugin: 'Добавить плагин',
    noPlugins: 'Нет установленных плагинов',
    pluginStore: 'Магазин плагинов',
    install: 'Установить',
    settingsTitle: 'Настройки',
    paths: 'Пути',
    gmodPath: 'Путь к GMod',
    browse: 'Обзор',
    exportPath: 'Папка для экспорта BSP',
    defaultExportPath: 'По умолчанию: рядом с VMF',
    compilerSettings: 'Компилятор',
    logLevel: 'Уровень логирования',
    logMinimal: 'Минимальный',
    logNormal: 'Нормальный',
    logDetailed: 'Подробный',
    autoSaveLogs: 'Автосохранение логов',
    fileLoaded: 'Загружен файл',
    readyToCompile: 'Готов к компиляции',
    fileCleared: 'Файл очищен',
    startCompile: 'Начало компиляции...',
    parsingVMF: 'Парсинг VMF файла...',
    objectsProcessed: 'Обработано объектов',
    localTexturesUsed: 'Используется локальных текстур',
    exportBSP: 'Экспорт в BSP...',
    compileDone: 'Компиляция завершена!',
    bspSaved: 'BSP файл сохранён',
    compileError: 'Ошибка компиляции',
    noVMF: 'Ошибка: нет загруженного VMF файла',
    compiling: 'Компиляция...',
    textureFolderAdded: 'Добавлена папка текстур',
    textureFolderRemoved: 'Папка текстур удалена',
    pluginInstalled: 'Плагин установлен',
    pluginLoadError: 'Ошибка загрузки плагина',
    version: 'v1.0.0',
  },
  en: {
    appTitle: 'VMF → BSP Compiler',
    compiler: 'Compiler',
    textures: 'Textures',
    plugins: 'Plugins',
    settings: 'Settings',
    localTextures: 'Local Textures',
    noTextures: 'No loaded textures',
    addFolder: 'Add folder',
    dropZoneTitle: 'Drop VMF file here',
    dropZoneHint: 'or click to select file',
    compileOptions: 'Compile Options',
    mode: 'Mode',
    modeFast: 'Fast',
    modeNormal: 'Normal',
    modeFull: 'Full',
    gridSnap: 'Grid Snap',
    useTextures: 'Enable Textures',
    optimize: 'Optimize',
    compileToBSP: 'Compile to BSP',
    compileLog: 'Compile Log',
    logEmpty: 'Waiting for compilation...',
    localTexturesTitle: 'Local Textures',
    addLocalFolder: 'Add Folder',
    pluginsTitle: 'Compiler Plugins',
    addPlugin: 'Add Plugin',
    noPlugins: 'No plugins installed',
    pluginStore: 'Plugin Store',
    install: 'Install',
    settingsTitle: 'Settings',
    paths: 'Paths',
    gmodPath: 'GMod Path',
    browse: 'Browse',
    exportPath: 'BSP Export Path',
    defaultExportPath: 'Default: next to VMF',
    compilerSettings: 'Compiler',
    logLevel: 'Log Level',
    logMinimal: 'Minimal',
    logNormal: 'Normal',
    logDetailed: 'Detailed',
    autoSaveLogs: 'Auto-save logs',
    fileLoaded: 'File loaded',
    readyToCompile: 'Ready to compile',
    fileCleared: 'File cleared',
    startCompile: 'Starting compilation...',
    parsingVMF: 'Parsing VMF file...',
    objectsProcessed: 'Objects processed',
    localTexturesUsed: 'Local textures used',
    exportBSP: 'Exporting to BSP...',
    compileDone: 'Compilation complete!',
    bspSaved: 'BSP file saved',
    compileError: 'Compilation error',
    noVMF: 'Error: no VMF file loaded',
    compiling: 'Compiling...',
    textureFolderAdded: 'Texture folder added',
    textureFolderRemoved: 'Texture folder removed',
    pluginInstalled: 'Plugin installed',
    pluginLoadError: 'Plugin load error',
    version: 'v1.0.0',
  },
};

let currentLang = 'ru';

export function t(key) {
  return translations[currentLang]?.[key] || translations['ru'][key] || key;
}

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('hammer-omni-lang', lang);
    emit('languageChange', lang);
  }
}

export function getLanguage() {
  return currentLang;
}

export function initLanguage() {
  const saved = localStorage.getItem('hammer-omni-lang');
  if (saved && translations[saved]) {
    currentLang = saved;
  }
  emit('languageChange', currentLang);
  return currentLang;
}

export function updateI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = t(key);
    if (el.tagName === 'INPUT' && el.placeholder !== undefined) {
      el.placeholder = text;
    } else if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
      el.textContent = text;
    } else {
      el.innerHTML = text;
    }
  });
  
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    el.title = t(key);
  });
  
  document.title = t('appTitle');
}

export function importTranslations(lang, customTranslations) {
  if (!translations[lang]) translations[lang] = {};
  Object.assign(translations[lang], customTranslations);
  localStorage.setItem('hammer-omni-custom-translations', JSON.stringify(customTranslations));
  emit('languageChange', lang);
}

export function loadCustomTranslations() {
  try {
    const saved = localStorage.getItem('hammer-omni-custom-translations');
    if (saved) {
      const custom = JSON.parse(saved);
      const lang = currentLang;
      if (!translations[lang]) translations[lang] = {};
      Object.assign(translations[lang], custom);
    }
  } catch (e) {
    console.warn('Failed to load custom translations:', e);
  }
}

function uuid() {
  return crypto.randomUUID();
}

// ── Начальный таб ──────────────────────────────────────────────────────────────
const firstTabId = uuid();

export const state = {
  view: 'compiler',
  compiler: {
    loadedVMF: null,
    isCompiling: false,
    compileLog: [],
  },

  localTextures: [],
  objects: [],
  selected: null,
  selectedObjects: [],
  clipboard: null,
  groups: [],

  tabs: [{ id: firstTabId, name: 'Map_01', objects: [] }],
  activeTabId: firstTabId,

  history: [],
  historyIndex: -1,

  textures: [],
  prefabs: [],

  settings: {
    renderer: 'webgl',
    gridSize: 64,
    snapToGrid: true,
    faceSnap: true,
    softRadius: 3.0,
    language: 'ru',
    gmodPath: '',
    exportPath: '',
    logLevel: 'normal',
    autoSaveLogs: true,
    compileMode: 'normal',
    gridSnap: 1,
    useTextures: true,
    optimize: true,
    lighting: {
      ambient: { enabled: true, intensity: 0.4, color: '#404040' },
      directional: { enabled: true, intensity: 0.8, color: '#ffffff', position: { x: 100, y: 200, z: 100 } },
    },
    interface: {
      layout: 'default',
      panels: { left: true, right: true, textures: false, prefabs: false },
    },
  },

  recentMaps: [],
  currentProject: null,
  plugins: [],
};

export function getState() {
  return state;
}

const listeners = new Map();

export function subscribe(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

export function emit(event, data) {
  if (listeners.has(event)) {
    listeners.get(event).forEach(fn => fn(data));
  }
}

export function selectObject(obj) {
  state.selected = obj;
  if (obj) {
    state.selectedObjects = [obj];
  } else {
    state.selectedObjects = [];
  }
  emit('select', obj);
  emit('selectionChange', state.selected);
}

export function addToSelection(obj) {
  if (!obj) return;
  const already = state.selectedObjects.findIndex(o => o.id === obj.id) >= 0;
  if (!already) {
    state.selectedObjects.push(obj);
  } else {
    state.selectedObjects = state.selectedObjects.filter(o => o.id !== obj.id);
  }
  state.selected = state.selectedObjects[0] || null;
  emit('multiSelect', state.selectedObjects);
}

export function getSelectedObjects() {
  return state.selectedObjects;
}

export function addObject(obj) {
  const o = {
    id: uuid(),
    type: obj.type || 'mesh',
    name: obj.name || 'Object',
    mesh: obj.mesh,
    position: obj.position || new THREE.Vector3(),
    rotation: obj.rotation || new THREE.Euler(),
    scale: obj.scale || new THREE.Vector3(1, 1, 1),
    texture: obj.texture || 'dev/dev_measuregray01a',
    visible: true,
    locked: false,
    groupId: obj.groupId || null,
    ...obj,
  };
  state.objects.push(o);
  // Синхронизируем в таб
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (tab) tab.objects = state.objects;
  emit('objectAdd', o);
  saveHistory();
  return o;
}

export function removeObject(id) {
  const idx = state.objects.findIndex(o => o.id === id);
  if (idx !== -1) {
    const o = state.objects[idx];
    state.objects.splice(idx, 1);
    // Auto-deselect if this was the selected object
    if (state.selected?.id === id) {
      state.selected = null;
      state.selectedObjects = [];
      emit('selectionChange', null);
      emit('select', null);
    } else {
      state.selectedObjects = state.selectedObjects.filter(o => o.id !== id);
    }
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (tab) tab.objects = state.objects;
    emit('objectRemove', o);
    saveHistory();
  }
}

export function setTool(tool) {
  state.tool = tool;
  emit('toolChange', tool);
}

export function setView(view) {
  state.view = view;
  emit('viewChange', view);
}

export function saveHistory() {
  const snapshot = { objects: state.objects.map(o => ({ ...o })) };
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }
  state.history.push(snapshot);
  state.historyIndex = state.history.length - 1;
  emit('historyChange');
}

export function undo() {
  if (state.historyIndex > 0) {
    state.historyIndex--;
    state.objects = [...state.history[state.historyIndex].objects];
    emit('historyRestore');
  }
}

export function redo() {
  if (state.historyIndex < state.history.length - 1) {
    state.historyIndex++;
    state.objects = [...state.history[state.historyIndex].objects];
    emit('historyRestore');
  }
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
export function createNewTab() {
  // Сохраняем объекты текущего таба
  const curTab = state.tabs.find(t => t.id === state.activeTabId);
  if (curTab) curTab.objects = state.objects;

  const newTab = {
    id: uuid(),
    name: `Map_${String(state.tabs.length + 1).padStart(2, '0')}`,
    objects: [],
  };
  state.tabs.push(newTab);
  emit('tabCreate', newTab);

  switchToTab(newTab.id);
}

export function switchToTab(tabId) {
  // Сохраняем текущий таб
  const curTab = state.tabs.find(t => t.id === state.activeTabId);
  if (curTab) curTab.objects = state.objects;

  state.activeTabId = tabId;
  const tab = state.tabs.find(t => t.id === tabId);
  if (tab) {
    state.objects = tab.objects;
    selectObject(null);
    emit('sceneLoad', state.objects);
  }
  emit('tabSwitch', tabId);
}

export function closeTab(tabId) {
  if (state.tabs.length <= 1) return; // не закрываем последний
  const idx = state.tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;

  state.tabs.splice(idx, 1);

  if (state.activeTabId === tabId) {
    const next = state.tabs[Math.max(0, idx - 1)];
    switchToTab(next.id);
  }
  emit('tabClose', tabId);
}

export function renameTab(tabId, name) {
  const tab = state.tabs.find(t => t.id === tabId);
  if (tab) {
    tab.name = name;
    emit('tabRename', tabId);
  }
}

// ── Система карт/проектов ───────────────────────────────────────────────────
const MAPS_STORAGE_KEY = 'hammer-omni-maps';

export function addRecentMap(mapData) {
  const entry = {
    id: mapData.id || uuid(),
    name: mapData.name || `Map_${Date.now()}`,
    timestamp: Date.now(),
    objectCount: mapData.objectCount || 0,
  };

  // Удалить если уже есть с таким id
  state.recentMaps = state.recentMaps.filter(m => m.id !== entry.id);

  // Добавить в начало
  state.recentMaps.unshift(entry);

  // Ограничить 10 картами
  if (state.recentMaps.length > 10) {
    state.recentMaps.pop();
  }

  saveRecentMaps();
  emit('projectCreate', entry);
  return entry;
}

export function saveRecentMaps() {
  try {
    localStorage.setItem(MAPS_STORAGE_KEY, JSON.stringify(state.recentMaps));
  } catch (e) {
    console.warn('Failed to save recent maps:', e);
  }
}

export function loadRecentMaps() {
  try {
    const saved = localStorage.getItem(MAPS_STORAGE_KEY);
    if (saved) {
      state.recentMaps = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load recent maps:', e);
    state.recentMaps = [];
  }
  return state.recentMaps;
}

export function getRecentMaps() {
  return state.recentMaps;
}

export function removeRecentMap(id) {
  state.recentMaps = state.recentMaps.filter(m => m.id !== id);
  saveRecentMaps();
  emit('projectRemove', id);
}

export function setCurrentProject(project) {
  state.currentProject = project;
  emit('projectLoad', project);
}

export function getCurrentProject() {
  return state.currentProject;
}

export function saveMapData(mapId, data) {
  try {
    const mapStorageKey = `hammer-omni-map-${mapId}`;
    localStorage.setItem(mapStorageKey, JSON.stringify(data));

    // Обновить счётчик объектов в recentMaps
    const mapEntry = state.recentMaps.find(m => m.id === mapId);
    if (mapEntry) {
      mapEntry.objectCount = data.objects?.length || 0;
      saveRecentMaps();
    }
  } catch (e) {
    console.warn('Failed to save map data:', e);
  }
}

export function loadMapData(mapId) {
  try {
    const mapStorageKey = `hammer-omni-map-${mapId}`;
    const saved = localStorage.getItem(mapStorageKey);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load map data:', e);
  }
  return null;
}

// ── Система плагинов ───────────────────────────────────────────────────────
const PLUGINS_STORAGE_KEY = 'hammer-omni-plugins';

const PLUGIN_TYPES = {
  COMPILER: 'compiler',
  TEXTURE_LOADER: 'texture_loader',
  EXPORTER: 'exporter',
  TRANSFORMER: 'transformer',
  VALIDATOR: 'validator',
};

const PLUGIN_HOOKS = {
  PRE_COMPILE: 'pre_compile',
  POST_COMPILE: 'post_compile',
  PRE_PARSE_VMF: 'pre_parse_vmf',
  POST_PARSE_VMF: 'post_parse_vmf',
  PRE_EXPORT_BSP: 'pre_export_bsp',
  POST_EXPORT_BSP: 'post_export_bsp',
  ON_ERROR: 'on_error',
};

export const PluginSystem = {
  types: PLUGIN_TYPES,
  hooks: PLUGIN_HOOKS,
};

export function loadPlugins() {
  try {
    const saved = localStorage.getItem(PLUGINS_STORAGE_KEY);
    if (saved) {
      state.plugins = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load plugins:', e);
    state.plugins = [];
  }
  return state.plugins;
}

export function savePlugins() {
  try {
    localStorage.setItem(PLUGINS_STORAGE_KEY, JSON.stringify(state.plugins));
  } catch (e) {
    console.warn('Failed to save plugins:', e);
  }
}

export function addPlugin(plugin) {
  const existing = state.plugins.find(p => p.id === plugin.id);
  if (existing) return existing;

  const newPlugin = {
    id: plugin.id,
    name: plugin.name || 'Unnamed Plugin',
    description: plugin.description || '',
    version: plugin.version || '1.0.0',
    author: plugin.author || 'Unknown',
    type: plugin.type || PLUGIN_TYPES.COMPILER,
    enabled: plugin.enabled !== false,
    config: plugin.config || {},
    hooks: plugin.hooks || {},
    loadedAt: Date.now(),
    icon: plugin.icon || '🔌',
  };

  state.plugins.push(newPlugin);
  savePlugins();
  emit('pluginAdd', newPlugin);
  return newPlugin;
}

export function removePlugin(pluginId) {
  const plugin = state.plugins.find(p => p.id === pluginId);
  if (plugin?.cleanup && typeof plugin.cleanup === 'function') {
    plugin.cleanup();
  }
  state.plugins = state.plugins.filter(p => p.id !== pluginId);
  savePlugins();
  emit('pluginRemove', pluginId);
}

export function togglePlugin(pluginId) {
  const plugin = state.plugins.find(p => p.id === pluginId);
  if (plugin) {
    plugin.enabled = !plugin.enabled;
    
    if (plugin.enabled && plugin.init && typeof plugin.init === 'function') {
      try {
        plugin.init(plugin.config);
      } catch (err) {
        console.error(`Plugin ${plugin.name} init failed:`, err);
        plugin.enabled = false;
      }
    }
    
    savePlugins();
    emit('pluginToggle', plugin);
    return plugin.enabled;
  }
  return false;
}

export function getPlugins() {
  return state.plugins;
}

export function getEnabledPlugins() {
  return state.plugins.filter(p => p.enabled);
}

export function getPluginsByType(type) {
  return state.plugins.filter(p => p.type === type && p.enabled);
}

export function executeHook(hookName, data = {}) {
  const enabledPlugins = getEnabledPlugins();
  const results = [];
  
  for (const plugin of enabledPlugins) {
    if (plugin.hooks && plugin.hooks[hookName]) {
      try {
        const result = plugin.hooks[hookName](data);
        results.push({ plugin: plugin.name, result });
      } catch (err) {
        console.error(`Plugin ${plugin.name} hook ${hookName} failed:`, err);
        results.push({ plugin: plugin.name, error: err.message });
      }
    }
  }
  
  return results;
}

export function registerPluginHook(pluginId, hookName, callback) {
  const plugin = state.plugins.find(p => p.id === pluginId);
  if (plugin) {
    plugin.hooks = plugin.hooks || {};
    plugin.hooks[hookName] = callback;
    savePlugins();
    emit('pluginHookRegistered', { pluginId, hookName });
  }
}

// ── Локальные текстуры ─────────────────────────────────────────────────────
const LOCAL_TEXTURES_KEY = 'hammer-omni-local-textures';

export function loadLocalTextures() {
  try {
    const saved = localStorage.getItem(LOCAL_TEXTURES_KEY);
    if (saved) {
      state.localTextures = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load local textures:', e);
    state.localTextures = [];
  }
  return state.localTextures || [];
}

export function saveLocalTextures() {
  try {
    localStorage.setItem(LOCAL_TEXTURES_KEY, JSON.stringify(state.localTextures || []));
  } catch (e) {
    console.warn('Failed to save local textures:', e);
  }
}

export function addLocalTexturePath(path) {
  if (!state.localTextures) state.localTextures = [];
  
  const exists = state.localTextures.find(p => p.path === path);
  if (exists) return exists;
  
  const entry = {
    id: crypto.randomUUID(),
    path: path,
    name: path.split(/[\\/]/).pop(),
    addedAt: Date.now(),
    textureCount: 0,
  };
  
  state.localTextures.push(entry);
  saveLocalTextures();
  emit('localTextureAdded', entry);
  return entry;
}

export function removeLocalTexturePath(id) {
  if (!state.localTextures) return;
  state.localTextures = state.localTextures.filter(t => t.id !== id);
  saveLocalTextures();
  emit('localTextureRemoved', id);
}

export function getLocalTextures() {
  return state.localTextures || [];
}

// Инициализация при загрузке
loadRecentMaps();
loadPlugins();
loadLocalTextures();
loadCustomTranslations();
initLanguage();