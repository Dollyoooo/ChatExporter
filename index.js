import { extension_settings, saveSettingsDebounced } from '../../../extensions.js';

const EXT_NAME = 'memory-world-book';
const EXT_DISPLAY = '记忆世界书';

let currentEditId = null;
let batchMode = false;
let selectedIds = new Set();
let particleTimer = null;
let confirmCallback = null;

/* ========== 中文数字 ========== */
function toChineseNum(n) {
    const digits = ['零','一','二','三','四','五','六','七','八','九'];
    if (n <= 0) return '零';
    if (n < 10) return digits[n];
    if (n === 10) return '十';
    if (n < 20) return '十' + digits[n % 10];
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    if (ones === 0) return digits[tens] + '十';
    return digits[tens] + '十' + digits[ones];
}

/* ========== 数据操作 ========== */
function getStorageKey() {
    try {
        const ctx = SillyTavern.getContext();
        if (!ctx || !ctx.characterId) return null;
        const chatId = ctx.chatId || ctx.getCurrentChatId?.() || 'default';
        return ctx.characterId + '_' + chatId;
    } catch (e) {
        return null;
    }
}

function getMemories() {
    const key = getStorageKey();
    if (!key) return [];
    if (!extension_settings[EXT_NAME].memories) extension_settings[EXT_NAME].memories = {};
    return extension_settings[EXT_NAME].memories[key] || [];
}

function saveMemories(list) {
    const key = getStorageKey();
    if (!key) return;
    if (!extension_settings[EXT_NAME].memories) extension_settings[EXT_NAME].memories = {};
    extension_settings[EXT_NAME].memories[key] = list;
    saveSettingsDebounced();
    injectPrompt();
}

/* ========== 注入提示词 ========== */
function injectPrompt() {
    try {
        const ctx = SillyTavern.getContext();
        if (!ctx || typeof ctx.setExtensionPrompt !== 'function') return;
        const mems = getMemories();

        let validMems = [];
        for (let i = 0; i < mems.length; i++) {
            if (mems[i].content && mems[i].content.trim()) {
                validMems.push(mems[i].name + '\n' + mems[i].content.trim());
            }
        }

        if (validMems.length === 0) {
            ctx.setExtensionPrompt(EXT_NAME, '', 1, 999, false, null);
            return;
        }

        const startPrompt = extension_settings[EXT_NAME].promptStart ?? '<{{char}}的记忆>';
        const endPrompt = extension_settings[EXT_NAME].promptEnd ?? '</{{char}}的记忆>';

        let parts = [];
        if (startPrompt) parts.push(startPrompt);
        parts = parts.concat(validMems);
        if (endPrompt) parts.push(endPrompt);

        const text = parts.join('\n\n');
        ctx.setExtensionPrompt(EXT_NAME, text, 1, 999, false, null);
    } catch (e) {
        console.log('[MWB] inject error:', e);
    }
}

/* ========== 转义HTML ========== */
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
              .replace(/"/g, '"').replace(/'/g, ''');
}

/* ========== 构建UI ========== */
function buildUI() {
    if (document.getElementById('mwb-overlay')) return;

    /* 1. 挂载到顶部的拼图扩展菜单 */
    const settingsHtml = `
    <div id="mwb-settings-panel" class="extension_container">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>${EXT_DISPLAY}</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <button class="mwb-open-btn">${EXT_DISPLAY}</button>
            </div>
        </div>
    </div>`;
    const target = document.getElementById('extensions_settings') || document.getElementById('extensions_settings2');
    if (target) target.insertAdjacentHTML('beforeend', settingsHtml);

    /* 2. 强制挂载到输入框旁边的魔法棒(Wand)菜单 */
    const wandPopup = document.getElementById('wand_popup');
    if (wandPopup) {
        wandPopup.insertAdjacentHTML('beforeend', `<button class="mwb-open-btn">${EXT_DISPLAY}</button>`);
    }

    /* 主面板 */
    const overlayHtml = `
    <div id="mwb-overlay">
        <div id="mwb-particles"></div>
        <div id="mwb-panel">
            <div id="mwb-bunny-deco">
                <div class="mwb-ear mwb-ear-left"></div>
                <div class="mwb-ear mwb-ear-right"></div>
            </div>
            <div id="mwb-header">
                <button id="mwb-close-btn" title="关闭">✕</button>
                <div id="mwb-title">${EXT_DISPLAY}</div>
                <button id="mwb-menu-trigger" title="菜单">
                    <span></span><span></span><span></span>
                </button>
                <div id="mwb-dropdown">
                    <div class="mwb-dropdown-item" data-action="add">添加记忆</div>
                    <div class="mwb-dropdown-item" data-action="prompt">提示词设置</div>
                    <div class="mwb-dropdown-item" data-action="batch">多选删除</div>
                    <div class="mwb-dropdown-item" data-action="clear">清空全部</div>
                </div>
            </div>
            <div id="mwb-content"></div>
            <div id="mwb-batch-bar">
                <button class="mwb-batch-btn" id="mwb-batch-confirm">确认删除</button>
                <button class="mwb-batch-btn" id="mwb-batch-cancel">取消</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', overlayHtml);

    /* 编辑弹窗 */
    const editHtml = `
    <div id="mwb-edit-overlay" class="mwb-modal-overlay">
        <div class="mwb-modal-panel">
            <div class="mwb-modal-header">
                <div id="mwb-edit-title-display" class="mwb-modal-title"></div>
                <button id="mwb-edit-close" class="mwb-modal-close">✕</button>
            </div>
            <div class="mwb-modal-body">
                <label class="mwb-input-label">名称</label>
                <input type="text" id="mwb-edit-name" class="mwb-input-text" autocomplete="off" />
                <label class="mwb-input-label">内容</label>
                <textarea id="mwb-edit-content" class="mwb-input-textarea"></textarea>
            </div>
            <div class="mwb-modal-footer">
                <button class="mwb-batch-btn mwb-btn-exit" id="mwb-edit-exit">退出</button>
                <button class="mwb-batch-btn mwb-btn-save" id="mwb-edit-save">保存</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', editHtml);

    /* 提示词弹窗 */
    const promptHtml = `
    <div id="mwb-prompt-overlay" class="mwb-modal-overlay">
        <div class="mwb-modal-panel">
            <div class="mwb-modal-header">
                <div class="mwb-modal-title">提示词设置</div>
                <button id="mwb-prompt-close" class="mwb-modal-close">✕</button>
            </div>
            <div class="mwb-modal-body">
                <label class="mwb-input-label">记忆开始</label>
                <input type="text" id="mwb-prompt-start" class="mwb-input-text" autocomplete="off" />
                <label class="mwb-input-label">记忆结束</label>
                <input type="text" id="mwb-prompt-end" class="mwb-input-text" autocomplete="off" />
            </div>
            <div class="mwb-modal-footer">
                <button class="mwb-batch-btn mwb-btn-exit" id="mwb-prompt-exit">退出</button>
                <button class="mwb-batch-btn mwb-btn-save" id="mwb-prompt-save">保存</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', promptHtml);

    /* 确认对话框 */
    const confirmHtml = `
    <div id="mwb-confirm-overlay">
        <div id="mwb-confirm-box">
            <div id="mwb-confirm-msg"></div>
            <div id="mwb-confirm-actions">
                <button id="mwb-confirm-yes">确认</button>
                <button id="mwb-confirm-no">取消</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', confirmHtml);
}

/* ========== 渲染记忆列表 ========== */
function renderCards() {
    const container = document.getElementById('mwb-content');
    if (!container) return;
    const mems = getMemories();
    if (mems.length === 0) {
        container.innerHTML = '<div class="mwb-empty">还没有记忆<br>点击右上角菜单添加</div>';
        return;
    }
    let html = '';
    for (let i = 0; i < mems.length; i++) {
        const m = mems[i];
        const preview = m.content ? m.content.substring(0, 50) : '暂无内容';
        html += `
        <div class="mwb-card" data-id="${escapeHtml(m.id)}">
            <input type="checkbox" class="mwb-card-checkbox" data-id="${escapeHtml(m.id)}" />
            <div class="mwb-card-title">${escapeHtml(m.name)}</div>
            <div class="mwb-card-preview">${escapeHtml(preview)}</div>
            <button class="mwb-card-delete" data-id="${escapeHtml(m.id)}" title="删除">✕</button>
        </div>`;
    }
    container.innerHTML = html;
}

/* ========== 面板控制 ========== */
function openPanel() {
    const key = getStorageKey();
    if (!key) {
        try { toastr.info('请先选择角色并开始对话'); } catch(e) { alert('请先选择角色并开始对话'); }
        return;
    }
    exitBatchMode();
    renderCards();
    const overlay = document.getElementById('mwb-overlay');
    if (overlay) overlay.classList.add('mwb-active');
    startParticles();
}

function closePanel() {
    const overlay = document.getElementById('mwb-overlay');
    if (overlay) overlay.classList.remove('mwb-active');
    closeDropdown();
    exitBatchMode();
    stopParticles();
}

function closeDropdown() {
    const dd = document.getElementById('mwb-dropdown');
    if (dd) dd.classList.remove('mwb-show');
}

function toggleDropdown() {
    const dd = document.getElementById('mwb-dropdown');
    if (dd) dd.classList.toggle('mwb-show');
}

/* ========== 添加记忆 ========== */
function addMemory() {
    const mems = getMemories();
    const num = mems.length + 1;
    const newMem = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        name: '记忆' + toChineseNum(num),
        content: ''
    };
    mems.push(newMem);
    saveMemories(mems);
    renderCards();
}

/* ========== 单条删除 ========== */
function deleteSingle(id) {
    showConfirm('确定删除这条记忆吗？', function() {
        let mems = getMemories();
        mems = mems.filter(function(m) { return m.id !== id; });
        saveMemories(mems);
        renderCards();
    });
}

/* ========== 批量删除 ========== */
function enterBatchMode() {
    batchMode = true;
    selectedIds.clear();
    const content = document.getElementById('mwb-content');
    if (content) content.classList.add('mwb-batch-mode');
    const bar = document.getElementById('mwb-batch-bar');
    if (bar) bar.classList.add('mwb-show');
    const checkboxes = document.querySelectorAll('.mwb-card-checkbox');
    checkboxes.forEach(function(cb) { cb.checked = false; });
}

function exitBatchMode() {
    batchMode = false;
    selectedIds.clear();
    const content = document.getElementById('mwb-content');
    if (content) content.classList.remove('mwb-batch-mode');
    const bar = document.getElementById('mwb-batch-bar');
    if (bar) bar.classList.remove('mwb-show');
}

function confirmBatchDelete() {
    if (selectedIds.size === 0) {
        try { toastr.warning('请先勾选要删除的记忆'); } catch(e) { alert('请先勾选要删除的记忆'); }
        return;
    }
    showConfirm('确定删除选中的 ' + selectedIds.size + ' 条记忆吗？', function() {
        let mems = getMemories();
        mems = mems.filter(function(m) { return !selectedIds.has(m.id); });
        saveMemories(mems);
        exitBatchMode();
        renderCards();
    });
}

/* ========== 清空全部 ========== */
function clearAll() {
    const mems = getMemories();
    if (mems.length === 0) {
        try { toastr.info('当前没有记忆'); } catch(e) { alert('当前没有记忆'); }
        return;
    }
    showConfirm('确定清空全部记忆吗？此操作不可撤销', function() {
        saveMemories([]);
        exitBatchMode();
        renderCards();
    });
}

/* ========== 编辑弹窗 ========== */
function openEdit(id) {
    const mems = getMemories();
    const mem = mems.find(function(m) { return m.id === id; });
    if (!mem) return;
    currentEditId = id;
    document.getElementById('mwb-edit-title-display').textContent = mem.name;
    document.getElementById('mwb-edit-name').value = mem.name;
    document.getElementById('mwb-edit-content').value = mem.content || '';
    document.getElementById('mwb-edit-overlay').classList.add('mwb-active');
}

function closeEdit() {
    document.getElementById('mwb-edit-overlay').classList.remove('mwb-active');
    currentEditId = null;
}

function saveEdit() {
    if (!currentEditId) return;
    const mems = getMemories();
    const mem = mems.find(function(m) { return m.id === currentEditId; });
    if (!mem) return;
    const nameInput = document.getElementById('mwb-edit-name');
    const contentInput = document.getElementById('mwb-edit-content');
    mem.name = nameInput.value.trim() || mem.name;
    mem.content = contentInput.value;
    saveMemories(mems);
    renderCards();
    closeEdit();
}

/* ========== 提示词设置弹窗 ========== */
function openPromptSettings() {
    const startInput = document.getElementById('mwb-prompt-start');
    const endInput = document.getElementById('mwb-prompt-end');
    startInput.value = extension_settings[EXT_NAME].promptStart ?? '<{{char}}的记忆>';
    endInput.value = extension_settings[EXT_NAME].promptEnd ?? '</{{char}}的记忆>';
    document.getElementById('mwb-prompt-overlay').classList.add('mwb-active');
}

function closePromptSettings() {
    document.getElementById('mwb-prompt-overlay').classList.remove('mwb-active');
}

function savePromptSettings() {
    const startInput = document.getElementById('mwb-prompt-start').value;
    const endInput = document.getElementById('mwb-prompt-end').value;
    extension_settings[EXT_NAME].promptStart = startInput;
    extension_settings[EXT_NAME].promptEnd = endInput;
    saveSettingsDebounced();
    injectPrompt();
    closePromptSettings();
    try { toastr.success('提示词已保存'); } catch(e) {}
}

/* ========== 确认对话框 ========== */
function showConfirm(msg, callback) {
    document.getElementById('mwb-confirm-msg').textContent = msg;
    document.getElementById('mwb-confirm-overlay').classList.add('mwb-active');
    confirmCallback = callback;
}

function hideConfirm() {
    document.getElementById('mwb-confirm-overlay').classList.remove('mwb-active');
    confirmCallback = null;
}

/* ========== 粒子特效 ========== */
function startParticles() {
    stopParticles();
    particleTimer = setInterval(function() {
        const container = document.getElementById('mwb-particles');
        if (!container) return;
        if (container.children.length > 15) return;
        createParticle(container);
    }, 1200);
}

function stopParticles() {
    if (particleTimer) {
        clearInterval(particleTimer);
        particleTimer = null;
    }
    const container = document.getElementById('mwb-particles');
    if (container) container.innerHTML = '';
}

function createParticle(container) {
    const types = ['heart', 'star', 'bunny'];
    const type = types[Math.floor(Math.random() * types.length)];
    const colors = [
        'rgba(255, 182, 193, 0.7)',
        'rgba(255, 200, 210, 0.6)',
        'rgba(248, 187, 208, 0.65)',
        'rgba(255, 220, 230, 0.7)',
        'rgba(230, 180, 210, 0.5)',
        'rgba(220, 190, 220, 0.5)'
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 10 + Math.random() * 16;
    const left = 5 + Math.random() * 90;
    const drift = -40 + Math.random() * 80;
    const duration = 6 + Math.random() * 6;
    const scale = 0.6 + Math.random() * 0.6;

    const wrap = document.createElement('div');
    wrap.className = 'mwb-particle-wrap';
    wrap.style.cssText = `
        left: ${left}%;
        bottom: -30px;
        width: ${size}px;
        height: ${size}px;
        --mwb-drift: ${drift}px;
        --mwb-duration: ${duration}s;
        --mwb-scale: ${scale};
    `;

    let inner = '';
    if (type === 'heart') {
        inner = `<div class="mwb-particle-heart" style="background:${color}"></div>`;
    } else if (type === 'star') {
        inner = `<div class="mwb-particle-star" style="background:${color}"></div>`;
    } else {
        inner = `<div class="mwb-particle-bunny">
            <div class="mwb-particle-bunny-ear-l" style="background:${color}"></div>
            <div class="mwb-particle-bunny-ear-r" style="background:${color}"></div>
            <div class="mwb-particle-bunny-head" style="background:${color}"></div>
        </div>`;
    }

    wrap.innerHTML = inner;
    container.appendChild(wrap);

    setTimeout(function() {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, duration * 1000 + 200);
}

/* ========== 绑定事件 ========== */
function bindEvents() {
    /* 打开面板 (支持所有带有 mwb-open-btn 类的按钮) */
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('mwb-open-btn')) {
            openPanel();
        }
    });

    /* 关闭面板 */
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'mwb-close-btn') {
            closePanel();
        }
    });

    /* 点击遮罩关闭主面板 */
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'mwb-overlay') {
            closePanel();
        }
    });

    /* 菜单触发 */
    document.addEventListener('click', function(e) {
        const trigger = e.target.closest('#mwb-menu-trigger');
        if (trigger) {
            e.stopPropagation();
            toggleDropdown();
            return;
        }
        if (!e.target.closest('#mwb-dropdown')) {
            closeDropdown();
        }
    });

    /* 菜单操作 */
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('mwb-dropdown-item')) {
            const action = e.target.getAttribute('data-action');
            closeDropdown();
            if (action === 'add') addMemory();
            else if (action === 'prompt') openPromptSettings();
            else if (action === 'batch') enterBatchMode();
            else if (action === 'clear') clearAll();
        }
    });

    /* 卡片点击 */
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('mwb-card-checkbox')) {
            const id = e.target.getAttribute('data-id');
            if (e.target.checked) selectedIds.add(id);
            else selectedIds.delete(id);
            return;
        }
        if (e.target && e.target.classList.contains('mwb-card-delete')) {
            e.stopPropagation();
            const id = e.target.getAttribute('data-id');
            deleteSingle(id);
            return;
        }
        const card = e.target.closest('.mwb-card');
        if (card && !batchMode) {
            const id = card.getAttribute('data-id');
            openEdit(id);
        }
    });

    /* 批量删除按钮 */
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'mwb-batch-confirm') confirmBatchDelete();
        if (e.target && e.target.id === 'mwb-batch-cancel') exitBatchMode();
    });

    /* 编辑弹窗按钮 */
    document.addEventListener('click', function(e) {
        if (e.target && (e.target.id === 'mwb-edit-close' || e.target.id === 'mwb-edit-exit')) closeEdit();
        if (e.target && e.target.id === 'mwb-edit-save') saveEdit();
        if (e.target && e.target.id === 'mwb-edit-overlay') closeEdit();
    });

    /* 提示词弹窗按钮 */
    document.addEventListener('click', function(e) {
        if (e.target && (e.target.id === 'mwb-prompt-close' || e.target.id === 'mwb-prompt-exit')) closePromptSettings();
        if (e.target && e.target.id === 'mwb-prompt-save') savePromptSettings();
        if (e.target && e.target.id === 'mwb-prompt-overlay') closePromptSettings();
    });

    /* 确认对话框 */
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'mwb-confirm-yes') {
            if (typeof confirmCallback === 'function') confirmCallback();
            hideConfirm();
        }
        if (e.target && e.target.id === 'mwb-confirm-no') hideConfirm();
    });
}

/* ========== 监听聊天切换 ========== */
function listenChatChange() {
    try {
        const ctx = SillyTavern.getContext();
        if (ctx && ctx.eventSource && ctx.eventTypes) {
            ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, function() {
                closeEdit();
                closePromptSettings();
                hideConfirm();
                exitBatchMode();
                const overlay = document.getElementById('mwb-overlay');
                if (overlay && overlay.classList.contains('mwb-active')) {
                    renderCards();
                }
                injectPrompt();
            });
        }
    } catch (e) {
        console.log('[MWB] event bindind skipped:', e);
    }
}

/* ========== 初始化 ========== */
jQuery(async () => {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { memories: {}, promptStart: '<{{char}}的记忆>', promptEnd: '</{{char}}的记忆>' };
    }

    buildUI();
    bindEvents();
    listenChatChange();

    setTimeout(function() {
        injectPrompt();
    }, 2000);

    console.log('[MWB] 记忆世界书已加载');
});
