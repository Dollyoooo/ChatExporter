import { getContext } from '../../../extensions.js';

// ================================================================
//  Chat Exporter v2.4 — 聊天记录导出器
// ================================================================

const state = {
    selectedMesIds: new Set(),
    style: 'default',
    format: 'img',
    bgColor: '#ffffff',
    textColor: '#000000',
    colorTarget: 'bg',
    selectMethod: 'manual',
    selectionMode: false,
    theme: 'light'
};

const PRESET_COLORS = [
    '#ffffff','#f5f5f5','#e0e0e0','#bdbdbd','#9e9e9e','#757575','#424242','#212121','#000000',
    '#ffcdd2','#ef9a9a','#e57373','#ef5350','#f44336','#e53935','#c62828','#b71c1c',
    '#f8bbd0','#f48fb1','#f06292','#ec407a','#e91e63','#d81b60','#ad1457','#880e4f',
    '#e1bee7','#ce93d8','#ba68c8','#ab47bc','#9c27b0','#8e24aa','#6a1b9a','#4a148c',
    '#c5cae9','#9fa8da','#7986cb','#5c6bc0','#3f51b5','#3949ab','#283593','#1a237e',
    '#bbdefb','#90caf9','#64b5f6','#42a5f5','#2196f3','#1e88e5','#1565c0','#0d47a1',
    '#b2ebf2','#80deea','#4dd0e1','#26c6da','#00bcd4','#00acc1','#00838f','#006064',
    '#c8e6c9','#a5d6a7','#81c784','#66bb6a','#4caf50','#43a047','#2e7d32','#1b5e20',
    '#fff9c4','#fff176','#ffee58','#ffeb3b','#fdd835','#f9a825','#f57f17','#e65100',
    '#ffe0b2','#ffcc80','#ffb74d','#ffa726','#ff9800','#fb8c00','#ef6c00','#d84315',
];

/* ===================== 工具函数 ===================== */

function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        if (window.html2canvas) return resolve();
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return { r: 0, g: 0, b: 0 };
    return {
        r: parseInt(hex.substring(0, 2), 16) || 0,
        g: parseInt(hex.substring(2, 4), 16) || 0,
        b: parseInt(hex.substring(4, 6), 16) || 0,
    };
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractMessageData(mes) {
    const nameEl = mes.querySelector('.ch_name');
    const textEl = mes.querySelector('.mes_text');
    if (!nameEl || !textEl) return null;
    return {
        name: nameEl.innerText.trim(),
        html: textEl.innerHTML
    };
}

/*
 * 标签过滤核心函数 (v2.4 彻底重写)
 *
 * 之前的版本分别对 innerText 和 innerHTML 做正则，但 innerText 里根本没有标签，
 * 导致过滤全部失效。
 *
 * 修复方案：
 *   1. 只处理 innerHTML（标签只存在于 HTML 中）
 *   2. 用 DOM 操作（getElementsByTagName）处理原生 HTML 标签
 *   3. 用正则处理 <tag> 转义形式
 *   4. 最后从过滤后的 HTML 派生纯文本
 */
function processContent(htmlContent, tagsInput, filterMode) {
    if (!tagsInput || !filterMode || filterMode === '0') return htmlContent;
    const tags = tagsInput.split(',').map(t => t.trim().replace(/^<\/?|\/?>$/g, '')).filter(Boolean);
    if (!tags.length) return htmlContent;

    if (filterMode === '1') {
        // ===== 去除模式：删掉匹配标签及其全部内容 =====

        // 第一步：DOM 操作，删除原生 HTML 元素（如 <thinking>...</thinking>）
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        tags.forEach(tag => {
            let els = tempDiv.getElementsByTagName(tag);
            while (els.length > 0) els[0].remove();
        });
        let result = tempDiv.innerHTML;

        // 第二步：正则删除转义形式 <thinking>...</thinking>
        tags.forEach(tag => {
            const esc = escapeRegex(tag);
            const re = new RegExp('<\\s*' + esc + '\\b[\\s\\S]*?>[\\s\\S]*?<\\s*/\\s*' + esc + '\\s*>', 'gi');
            result = result.replace(re, '');
        });

        return result;
    }

    if (filterMode === '2') {
        // ===== 仅保留模式：只提取匹配标签内部的内容 =====
        const kept = [];

        // 第一步：从 DOM 原生元素中提取
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        tags.forEach(tag => {
            const els = tempDiv.getElementsByTagName(tag);
            for (let i = 0; i < els.length; i++) {
                const inner = els[i].innerHTML.trim();
                if (inner) kept.push(inner);
            }
        });

        // 第二步：从转义形式中提取（用原始内容匹配）
        tags.forEach(tag => {
            const esc = escapeRegex(tag);
            const re = new RegExp('<\\s*' + esc + '\\b[\\s\\S]*?>([\\s\\S]*?)<\\s*/\\s*' + esc + '\\s*>', 'gi');
            let m;
            while ((m = re.exec(htmlContent)) !== null) {
                if (m[1].trim()) kept.push(m[1].trim());
            }
        });

        return kept.length ? kept.join('<br><br>') : '';
    }

    return htmlContent;
}

/* ===================== 样式注入 ===================== */

function injectStyles() {
    if (document.getElementById('ce-injected-styles')) return;
    const el = document.createElement('style');
    el.id = 'ce-injected-styles';
    el.textContent = `
/* ===== 遮罩 ===== */
#ce-overlay {
    position:fixed; top:0; left:0; width:100vw; height:100vh;
    background:rgba(0,0,0,0.6); z-index:2147483640;
    opacity:0; pointer-events:none; transition:opacity .2s ease;
}
#ce-overlay.open { opacity:1; pointer-events:auto; }

/* ===== 面板基础 ===== */
#ce-panel {
    position:fixed; top:5vh; left:50%;
    transform:translateX(-50%) scale(0.95);
    width:440px; max-width:94vw; max-height:90vh;
    border-radius:12px;
    z-index:2147483641; display:flex; flex-direction:column;
    overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.5);
    font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;
    font-size:13px;
    opacity:0; pointer-events:none;
    transition:opacity .2s ease, transform .2s ease;
}
#ce-panel.open {
    opacity:1; pointer-events:auto;
    transform:translateX(-50%) scale(1);
}

/* ===== 手机全屏适配 ===== */
@media (max-width:600px) {
    #ce-panel {
        top:0 !important; left:0 !important;
        width:100% !important; max-width:100% !important;
        height:100% !important; max-height:100% !important;
        border-radius:0 !important;
        transform:none !important;
    }
    #ce-panel.open { transform:none !important; }
    .ce-style-cards { display:grid !important; grid-template-columns:1fr 1fr !important; }
    .ce-color-row { flex-wrap:wrap !important; }
    .ce-checkbox { width:26px !important; height:26px !important; }
    #ce-confirm-select-btn { bottom:40px !important; padding:16px 50px !important; font-size:16px !important; }
}

/* ===== 平板适配 ===== */
@media (min-width:601px) and (max-width:1024px) {
    #ce-panel {
        width:80vw !important; max-width:80vw !important;
        top:2vh !important; max-height:96vh !important;
    }
}

/* ===== 日间主题 ===== */
#ce-panel.theme-light { background:#ffffff; color:#000000; border:1px solid #dddddd; }
#ce-panel.theme-light .ce-header { background:#f5f5f5; border-bottom:1px solid #dddddd; }
#ce-panel.theme-light .ce-close { color:#666; }
#ce-panel.theme-light .ce-close:hover { background:#e0e0e0; color:#000; }
#ce-panel.theme-light .ce-theme-btn { background:#e0e0e0; color:#000; border:1px solid #ccc; }
#ce-panel.theme-light .ce-section { background:#fafafa; border:1px solid #eeeeee; }
#ce-panel.theme-light .ce-section-title { color:#555555; }
#ce-panel.theme-light .ce-input,
#ce-panel.theme-light .ce-number-input,
#ce-panel.theme-light .ce-hex-input { background:#ffffff; border:1px solid #cccccc; color:#000000; }
#ce-panel.theme-light .ce-btn { background:#f0f0f0; border:1px solid #cccccc; color:#000000; }
#ce-panel.theme-light .ce-btn:hover { background:#e0e0e0; }
#ce-panel.theme-light .ce-btn-primary { background:#000000; color:#ffffff; border-color:#000000; }
#ce-panel.theme-light .ce-btn-primary:hover { background:#333333; }
#ce-panel.theme-light .ce-radio-group label { color:#000000; }
#ce-panel.theme-light .ce-style-card { background:#ffffff; border:2px solid #dddddd; }
#ce-panel.theme-light .ce-style-card.active { border-color:#000000; background:#f5f5f5; }
#ce-panel.theme-light .ce-target-btn { background:#f0f0f0; border:1px solid #cccccc; color:#000; }
#ce-panel.theme-light .ce-target-btn.active { background:#000000; color:#ffffff; }
#ce-panel.theme-light .ce-picker-tab { background:#f0f0f0; border:1px solid #cccccc; color:#000; }
#ce-panel.theme-light .ce-picker-tab.active { background:#dddddd; border-color:#999999; }
#ce-panel.theme-light .ce-export-row { background:#f5f5f5; border-top:1px solid #dddddd; }
#ce-panel.theme-light .ce-slider-val { color:#333; }

/* ===== 夜间主题 ===== */
#ce-panel.theme-dark { background:#000000; color:#ffffff; border:1px solid #333333; }
#ce-panel.theme-dark .ce-header { background:#111111; border-bottom:1px solid #333333; }
#ce-panel.theme-dark .ce-close { color:#aaaaaa; }
#ce-panel.theme-dark .ce-close:hover { background:#222222; color:#ffffff; }
#ce-panel.theme-dark .ce-theme-btn { background:#222222; color:#fff; border:1px solid #444; }
#ce-panel.theme-dark .ce-section { background:#0a0a0a; border:1px solid #222222; }
#ce-panel.theme-dark .ce-section-title { color:#aaaaaa; }
#ce-panel.theme-dark .ce-input,
#ce-panel.theme-dark .ce-number-input,
#ce-panel.theme-dark .ce-hex-input { background:#000000; border:1px solid #444444; color:#ffffff; }
#ce-panel.theme-dark .ce-btn { background:#111111; border:1px solid #444444; color:#ffffff; }
#ce-panel.theme-dark .ce-btn:hover { background:#222222; }
#ce-panel.theme-dark .ce-btn-primary { background:#ffffff; color:#000000; border-color:#ffffff; }
#ce-panel.theme-dark .ce-btn-primary:hover { background:#cccccc; }
#ce-panel.theme-dark .ce-radio-group label { color:#ffffff; }
#ce-panel.theme-dark .ce-style-card { background:#000000; border:2px solid #333333; }
#ce-panel.theme-dark .ce-style-card.active { border-color:#ffffff; background:#111111; }
#ce-panel.theme-dark .ce-target-btn { background:#111111; border:1px solid #444444; color:#fff; }
#ce-panel.theme-dark .ce-target-btn.active { background:#ffffff; color:#000000; }
#ce-panel.theme-dark .ce-picker-tab { background:#111111; border:1px solid #444444; color:#fff; }
#ce-panel.theme-dark .ce-picker-tab.active { background:#333333; border-color:#666666; }
#ce-panel.theme-dark .ce-export-row { background:#111111; border-top:1px solid #333333; }
#ce-panel.theme-dark .ce-slider-val { color:#ccc; }

/* ===== 通用组件 ===== */
.ce-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; font-size:15px; font-weight:600; flex-shrink:0; }
.ce-theme-btn { padding:4px 10px; border-radius:4px; font-size:12px; cursor:pointer; font-weight:normal; }
.ce-close { cursor:pointer; font-size:22px; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:6px; transition:all .15s; }
.ce-body { padding:16px 20px; overflow-y:auto; flex:1; -webkit-overflow-scrolling:touch; }
.ce-body::-webkit-scrollbar { width:6px; }
.ce-body::-webkit-scrollbar-track { background:transparent; }
.ce-body::-webkit-scrollbar-thumb { background:#888; border-radius:3px; }
.ce-section { margin-bottom:18px; padding:12px; border-radius:8px; }
.ce-section-title { font-size:12px; font-weight:700; margin-bottom:10px; }
.ce-radio-group { display:flex; gap:14px; flex-wrap:wrap; }
.ce-radio-group label { display:flex; align-items:center; gap:5px; cursor:pointer; font-size:13px; }
.ce-radio-group input[type="radio"] { margin:0; }
.ce-input { width:100%; padding:8px 12px; border-radius:6px; font-size:13px; outline:none; box-sizing:border-box; }
.ce-number-input { width:80px; padding:6px 8px; border-radius:6px; font-size:13px; outline:none; text-align:center; box-sizing:border-box; }
.ce-btn { padding:8px 16px; border-radius:6px; cursor:pointer; font-size:13px; transition:all .2s; user-select:none; }
.ce-btn-primary { font-weight:600; }
.ce-style-cards { display:flex; gap:10px; flex-wrap:wrap; }
.ce-style-card { flex:1; min-width:85px; padding:10px 8px; border-radius:8px; text-align:center; cursor:pointer; transition:all .2s; }
.ce-style-preview { width:100%; height:42px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:16px; margin-bottom:6px; border:1px solid #ccc; }
.ce-style-card span { font-size:11px; }
.ce-color-row { display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
.ce-hex-input { width:76px; padding:6px 8px; border-radius:6px; font-size:12px; font-family:monospace; outline:none; box-sizing:border-box; }
.ce-swatch { width:28px; height:28px; border-radius:6px; border:1px solid #888; cursor:pointer; flex-shrink:0; }
.ce-target-btns { display:flex; gap:8px; margin-bottom:12px; }
.ce-target-btn { flex:1; padding:8px; border-radius:6px; cursor:pointer; font-size:12px; text-align:center; transition:all .2s; }
.ce-picker-tabs { display:flex; gap:6px; margin-bottom:10px; }
.ce-picker-tab { flex:1; padding:6px; border-radius:6px; cursor:pointer; font-size:11px; text-align:center; transition:all .2s; }
.ce-picker-pane { display:none; }
.ce-picker-pane.active { display:block; }
.ce-color-grid { display:grid; grid-template-columns:repeat(8,1fr); gap:6px; }
.ce-grid-swatch { aspect-ratio:1; border-radius:4px; cursor:pointer; border:1px solid #888; transition:all .15s; box-sizing:border-box; }
.ce-grid-swatch:hover { transform:scale(1.1); }
#ce-spectrum { width:100%; height:150px; border-radius:6px; cursor:crosshair; border:1px solid #888; display:block; }
.ce-slider-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.ce-slider-row label { font-size:13px; font-weight:700; width:14px; text-align:center; }
.ce-slider-row input[type="range"] { flex:1; height:6px; }
.ce-slider-val { font-size:12px; font-family:monospace; width:30px; text-align:right; }
.ce-floor-range { display:flex; align-items:center; gap:8px; margin-top:8px; }
.ce-select-info { font-size:12px; }
.ce-export-row { padding:14px 20px; display:flex; justify-content:center; flex-shrink:0; }

#ce-confirm-select-btn {
    position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
    padding:14px 40px; border-radius:30px; font-size:15px; font-weight:600; cursor:pointer;
    z-index:2147483645; box-shadow:0 8px 24px rgba(0,0,0,0.4);
    transition:all .2s; user-select:none;
}
#ce-confirm-select-btn.theme-light { background:#000000; color:#ffffff; border:1px solid #333; }
#ce-confirm-select-btn.theme-dark { background:#ffffff; color:#000000; border:1px solid #ccc; }
#ce-confirm-select-btn:hover { transform:translateX(-50%) scale(1.05); }

.ce-checkbox {
    position:absolute !important; left:6px !important; top:10px !important;
    width:22px !important; height:22px !important; z-index:2147483635 !important;
    cursor:pointer !important; margin:0 !important;
}
.ce-checkbox.theme-light { accent-color:#000000 !important; }
.ce-checkbox.theme-dark { accent-color:#ffffff !important; }

#ce-render-container { position:absolute; top:-99999px; left:-99999px; width:800px; }

.ce-export-default { padding:28px; line-height:1.9; font-size:15px; font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif; }
.ce-export-default .ce-msg { margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid rgba(128,128,128,.3); }
.ce-export-default .ce-msg:last-child { border-bottom:none; margin-bottom:0; }
.ce-export-default .ce-msg-name { font-weight:700; margin-bottom:6px; font-size:14px; }

.ce-export-white-card { padding:24px; background:#f0f2f5; line-height:1.85; font-size:15px; font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif; color:#333; }
.ce-export-white-card .ce-msg { background:#fff; border-radius:12px; padding:18px 22px; margin-bottom:14px; box-shadow:0 1px 4px rgba(0,0,0,.08); }
.ce-export-white-card .ce-msg:last-child { margin-bottom:0; }
.ce-export-white-card .ce-msg-name { font-weight:700; color:#1a73e8; margin-bottom:8px; font-size:13px; letter-spacing:.5px; }

.ce-export-dark-minimal { padding:28px; background:#1a1a2e; line-height:1.85; font-size:15px; font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif; color:#e2e2e2; }
.ce-export-dark-minimal .ce-msg { padding-bottom:16px; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,.1); }
.ce-export-dark-minimal .ce-msg:last-child { border-bottom:none; margin-bottom:0; }
.ce-export-dark-minimal .ce-msg-name { font-weight:600; color:#8b92ff; margin-bottom:6px; font-size:13px; }

.ce-export-warm-note { padding:30px 34px; background:#faf6ee; line-height:2; font-size:15px; font-family:Georgia,'Noto Serif SC','Source Han Serif SC',serif; color:#4a3f2f; }
.ce-export-warm-note .ce-msg { padding-left:16px; margin-bottom:18px; border-left:3px solid #c9a96e; }
.ce-export-warm-note .ce-msg:last-child { margin-bottom:0; }
.ce-export-warm-note .ce-msg-name { font-weight:700; color:#8b6c2a; margin-bottom:6px; font-size:13px; }

#ce-ext-menu-item { cursor:pointer; }
#ce-ext-menu-item:hover { background:rgba(128,128,128,.1); }
    `;
    document.head.appendChild(el);
}

/* ===================== 面板 HTML ===================== */

function createPanel() {
    const html = `
    <div id="ce-overlay"></div>
    <div id="ce-panel" class="theme-light">
        <div class="ce-header">
            <div style="display:flex;align-items:center;gap:8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>聊天记录导出器</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <div class="ce-theme-btn" id="ce-theme-btn">切换夜间</div>
                <div class="ce-close" id="ce-close-btn">x</div>
            </div>
        </div>
        <div class="ce-body">
            <div class="ce-section" style="display:flex;align-items:center;gap:10px;">
                <span style="font-weight:600;">快速跳转</span>
                <input type="number" class="ce-number-input" id="ce-jump-input" placeholder="楼层" min="1">
                <button class="ce-btn" id="ce-jump-btn">跳转</button>
            </div>
            <div class="ce-section">
                <div class="ce-section-title">消息选择</div>
                <div class="ce-radio-group">
                    <label><input type="radio" name="ce-sel-method" value="manual" checked> 手动勾选</label>
                    <label><input type="radio" name="ce-sel-method" value="range"> 按楼层范围</label>
                    <label><input type="radio" name="ce-sel-method" value="all"> 全部导出</label>
                </div>
                <div id="ce-manual-area" style="margin-top:10px">
                    <div style="display:flex;align-items:center;gap:10px">
                        <button class="ce-btn" id="ce-sel-btn">开启选择模式</button>
                        <span class="ce-select-info" id="ce-sel-info">已选 0 条</span>
                    </div>
                </div>
                <div id="ce-range-area" style="display:none;margin-top:10px">
                    <div class="ce-floor-range">
                        <span style="font-size:12px">楼层</span>
                        <input type="number" class="ce-number-input" id="ce-floor-start" placeholder="起始" min="1">
                        <span>~</span>
                        <input type="number" class="ce-number-input" id="ce-floor-end" placeholder="结束" min="1">
                    </div>
                </div>
            </div>
            <div class="ce-section">
                <div class="ce-section-title">标签过滤</div>
                <input type="text" class="ce-input" id="ce-tags-input" placeholder="标签名，如 thinking, note（留空不过滤）">
                <div class="ce-radio-group" style="margin-top:10px">
                    <label><input type="radio" name="ce-filter" value="0" checked> 不过滤</label>
                    <label><input type="radio" name="ce-filter" value="1"> 去除标签</label>
                    <label><input type="radio" name="ce-filter" value="2"> 仅保留</label>
                </div>
            </div>
            <div class="ce-section">
                <div class="ce-section-title">导出格式</div>
                <div class="ce-radio-group">
                    <label><input type="radio" name="ce-format" value="txt"> TXT 文本文件</label>
                    <label><input type="radio" name="ce-format" value="img" checked> PNG 图片</label>
                </div>
            </div>
            <div class="ce-section" id="ce-style-section">
                <div class="ce-section-title">导出样式</div>
                <div class="ce-style-cards">
                    <div class="ce-style-card active" data-style="default">
                        <div class="ce-style-preview" style="background:#ffffff;color:#000">Aa</div>
                        <span>默认</span>
                    </div>
                    <div class="ce-style-card" data-style="white-card">
                        <div class="ce-style-preview" style="background:#f0f2f5;color:#333">
                            <div style="background:#fff;padding:2px 8px;border-radius:4px;font-size:13px;box-shadow:0 1px 2px rgba(0,0,0,.1)">Aa</div>
                        </div>
                        <span>简约白卡</span>
                    </div>
                    <div class="ce-style-card" data-style="dark-minimal">
                        <div class="ce-style-preview" style="background:#1a1a2e;color:#e2e2e2">Aa</div>
                        <span>深色极简</span>
                    </div>
                    <div class="ce-style-card" data-style="warm-note">
                        <div class="ce-style-preview" style="background:#faf6ee;color:#4a3f2f;border-left:3px solid #c9a96e;padding-left:8px;font-family:Georgia,serif">Aa</div>
                        <span>暖色便签</span>
                    </div>
                </div>
            </div>
            <div class="ce-section" id="ce-color-section">
                <div class="ce-section-title">默认颜色调节</div>
                <div class="ce-color-row">
                    <label>背景色</label>
                    <input type="text" class="ce-hex-input" id="ce-bg-hex" value="#ffffff">
                    <div class="ce-swatch" id="ce-bg-swatch" style="background:#ffffff"></div>
                    <div style="flex:1"></div>
                    <label>文字色</label>
                    <input type="text" class="ce-hex-input" id="ce-text-hex" value="#000000">
                    <div class="ce-swatch" id="ce-text-swatch" style="background:#000000"></div>
                </div>
                <div class="ce-target-btns">
                    <div class="ce-target-btn active" data-target="bg">编辑背景色</div>
                    <div class="ce-target-btn" data-target="text">编辑文字色</div>
                </div>
                <div class="ce-picker-tabs">
                    <div class="ce-picker-tab active" data-tab="grid">网格</div>
                    <div class="ce-picker-tab" data-tab="spectrum">光谱</div>
                    <div class="ce-picker-tab" data-tab="slider">滑块</div>
                </div>
                <div id="ce-picker-content">
                    <div class="ce-picker-pane active" data-tab="grid">
                        <div class="ce-color-grid" id="ce-color-grid"></div>
                    </div>
                    <div class="ce-picker-pane" data-tab="spectrum">
                        <canvas id="ce-spectrum"></canvas>
                    </div>
                    <div class="ce-picker-pane" data-tab="slider">
                        <div class="ce-slider-row">
                            <label style="color:#ff5252">R</label>
                            <input type="range" id="ce-r-slider" min="0" max="255" value="255">
                            <span class="ce-slider-val" id="ce-r-val">255</span>
                        </div>
                        <div class="ce-slider-row">
                            <label style="color:#69f0ae">G</label>
                            <input type="range" id="ce-g-slider" min="0" max="255" value="255">
                            <span class="ce-slider-val" id="ce-g-val">255</span>
                        </div>
                        <div class="ce-slider-row">
                            <label style="color:#448aff">B</label>
                            <input type="range" id="ce-b-slider" min="0" max="255" value="255">
                            <span class="ce-slider-val" id="ce-b-val">255</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="ce-export-row">
            <button class="ce-btn ce-btn-primary" id="ce-export-btn" style="width:180px;padding:12px;font-size:15px;border-radius:24px;">导 出</button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    setupPanelEvents();
}

/* ===================== 面板事件 ===================== */

function setupPanelEvents() {
    document.getElementById('ce-theme-btn').addEventListener('click', function () {
        const panel = document.getElementById('ce-panel');
        if (state.theme === 'light') {
            state.theme = 'dark';
            panel.classList.remove('theme-light');
            panel.classList.add('theme-dark');
            this.textContent = '切换日间';
        } else {
            state.theme = 'light';
            panel.classList.remove('theme-dark');
            panel.classList.add('theme-light');
            this.textContent = '切换夜间';
        }
    });

    document.getElementById('ce-close-btn').addEventListener('click', closePanel);
    document.getElementById('ce-overlay').addEventListener('click', closePanel);

    document.getElementById('ce-jump-btn').addEventListener('click', function () {
        const floor = parseInt(document.getElementById('ce-jump-input').value);
        if (!floor || floor < 1) return;
        const allMes = document.querySelectorAll('#chat .mes');
        if (floor <= allMes.length) {
            allMes[floor - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
            closePanel();
        } else {
            alert('楼层不存在，当前最大楼层为 ' + allMes.length);
        }
    });

    document.querySelectorAll('input[name="ce-sel-method"]').forEach(r => {
        r.addEventListener('change', function () {
            state.selectMethod = this.value;
            document.getElementById('ce-manual-area').style.display = this.value === 'manual' ? '' : 'none';
            document.getElementById('ce-range-area').style.display = this.value === 'range' ? '' : 'none';
        });
    });

    document.getElementById('ce-sel-btn').addEventListener('click', function () {
        enterSelectionMode();
    });

    document.querySelectorAll('input[name="ce-format"]').forEach(r => {
        r.addEventListener('change', function () {
            state.format = this.value;
            document.getElementById('ce-style-section').style.display = this.value === 'img' ? '' : 'none';
            updateColorSectionVisibility();
        });
    });

    document.querySelectorAll('.ce-style-card').forEach(card => {
        card.addEventListener('click', function () {
            document.querySelectorAll('.ce-style-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            state.style = this.dataset.style;
            updateColorSectionVisibility();
        });
    });

    document.querySelectorAll('.ce-target-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.ce-target-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            state.colorTarget = this.dataset.target;
            syncSlidersFromState();
        });
    });

    document.querySelectorAll('.ce-picker-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.ce-picker-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const tabName = this.dataset.tab;
            document.querySelectorAll('.ce-picker-pane').forEach(p => {
                p.classList.toggle('active', p.dataset.tab === tabName);
            });
            if (tabName === 'spectrum') setTimeout(drawSpectrum, 20);
        });
    });

    initColorGrid();

    const canvas = document.getElementById('ce-spectrum');
    let specDrag = false;
    canvas.addEventListener('mousedown', function (e) { specDrag = true; pickSpectrum(e); });
    canvas.addEventListener('mousemove', function (e) { if (specDrag) pickSpectrum(e); });
    canvas.addEventListener('touchstart', function (e) { specDrag = true; pickSpectrumTouch(e); }, { passive: false });
    canvas.addEventListener('touchmove', function (e) { if (specDrag) pickSpectrumTouch(e); }, { passive: false });
    document.addEventListener('mouseup', function () { specDrag = false; });
    document.addEventListener('touchend', function () { specDrag = false; });

    ['r', 'g', 'b'].forEach(ch => {
        document.getElementById('ce-' + ch + '-slider').addEventListener('input', function () {
            document.getElementById('ce-' + ch + '-val').textContent = this.value;
            const r = parseInt(document.getElementById('ce-r-slider').value);
            const g = parseInt(document.getElementById('ce-g-slider').value);
            const b = parseInt(document.getElementById('ce-b-slider').value);
            applyPickedColor(rgbToHex(r, g, b));
        });
    });

    document.getElementById('ce-bg-hex').addEventListener('change', function () {
        if (/^#[0-9a-fA-F]{6}$/.test(this.value)) {
            state.bgColor = this.value;
            document.getElementById('ce-bg-swatch').style.background = this.value;
            if (state.colorTarget === 'bg') syncSlidersFromState();
        }
    });
    document.getElementById('ce-text-hex').addEventListener('change', function () {
        if (/^#[0-9a-fA-F]{6}$/.test(this.value)) {
            state.textColor = this.value;
            document.getElementById('ce-text-swatch').style.background = this.value;
            if (state.colorTarget === 'text') syncSlidersFromState();
        }
    });

    document.getElementById('ce-export-btn').addEventListener('click', function () {
        doExport();
    });
}

/* ===================== 面板开关 ===================== */

function openPanel() {
    document.getElementById('ce-overlay').classList.add('open');
    document.getElementById('ce-panel').classList.add('open');
    updateSelInfo();
}

function closePanel() {
    document.getElementById('ce-overlay').classList.remove('open');
    document.getElementById('ce-panel').classList.remove('open');
}

function updateColorSectionVisibility() {
    const show = state.format === 'img' && state.style === 'default';
    document.getElementById('ce-color-section').style.display = show ? '' : 'none';
}

/* ===================== 颜色选择器 ===================== */

function initColorGrid() {
    const grid = document.getElementById('ce-color-grid');
    PRESET_COLORS.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'ce-grid-swatch';
        swatch.style.background = color;
        swatch.title = color;
        swatch.addEventListener('click', function () { applyPickedColor(color); });
        grid.appendChild(swatch);
    });
}

function drawSpectrum() {
    const canvas = document.getElementById('ce-spectrum');
    if (!canvas) return;
    const container = canvas.parentElement;
    const w = container.clientWidth || 380;
    canvas.width = w;
    canvas.height = 150;
    canvas.style.width = w + 'px';
    canvas.style.height = '150px';
    const ctx = canvas.getContext('2d');
    const hueGrad = ctx.createLinearGradient(0, 0, w, 0);
    hueGrad.addColorStop(0, '#ff0000');
    hueGrad.addColorStop(1 / 6, '#ffff00');
    hueGrad.addColorStop(2 / 6, '#00ff00');
    hueGrad.addColorStop(3 / 6, '#00ffff');
    hueGrad.addColorStop(4 / 6, '#0000ff');
    hueGrad.addColorStop(5 / 6, '#ff00ff');
    hueGrad.addColorStop(1, '#ff0000');
    ctx.fillStyle = hueGrad;
    ctx.fillRect(0, 0, w, 150);
    const whiteGrad = ctx.createLinearGradient(0, 0, 0, 150);
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
    whiteGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, w, 150);
    const blackGrad = ctx.createLinearGradient(0, 0, 0, 150);
    blackGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, w, 150);
}

function pickSpectrum(e) {
    const canvas = document.getElementById('ce-spectrum');
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, canvas.width - 1));
    const y = Math.max(0, Math.min(e.clientY - rect.top, canvas.height - 1));
    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    applyPickedColor(rgbToHex(pixel[0], pixel[1], pixel[2]));
}

function pickSpectrumTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const canvas = document.getElementById('ce-spectrum');
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(touch.clientX - rect.left, canvas.width - 1));
    const y = Math.max(0, Math.min(touch.clientY - rect.top, canvas.height - 1));
    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    applyPickedColor(rgbToHex(pixel[0], pixel[1], pixel[2]));
}

function applyPickedColor(hex) {
    if (state.colorTarget === 'bg') {
        state.bgColor = hex;
        document.getElementById('ce-bg-hex').value = hex;
        document.getElementById('ce-bg-swatch').style.background = hex;
    } else {
        state.textColor = hex;
        document.getElementById('ce-text-hex').value = hex;
        document.getElementById('ce-text-swatch').style.background = hex;
    }
    syncSlidersFromState();
}

function syncSlidersFromState() {
    const hex = state.colorTarget === 'bg' ? state.bgColor : state.textColor;
    const rgb = hexToRgb(hex);
    document.getElementById('ce-r-slider').value = rgb.r;
    document.getElementById('ce-g-slider').value = rgb.g;
    document.getElementById('ce-b-slider').value = rgb.b;
    document.getElementById('ce-r-val').textContent = rgb.r;
    document.getElementById('ce-g-val').textContent = rgb.g;
    document.getElementById('ce-b-val').textContent = rgb.b;
}

/* ===================== 选择模式 ===================== */

function enterSelectionMode() {
    state.selectionMode = true;
    closePanel();
    const allMes = document.querySelectorAll('#chat .mes');
    allMes.forEach(mes => {
        if (mes.querySelector('.ce-checkbox')) return;
        const mesId = mes.getAttribute('mesid');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'ce-checkbox ' + (state.theme === 'light' ? 'theme-light' : 'theme-dark');
        cb.dataset.mesid = mesId;
        cb.checked = state.selectedMesIds.has(mesId);
        cb.addEventListener('click', function (e) { e.stopPropagation(); });
        cb.addEventListener('change', function () {
            if (this.checked) state.selectedMesIds.add(mesId);
            else state.selectedMesIds.delete(mesId);
        });
        mes.style.position = 'relative';
        mes.insertBefore(cb, mes.firstChild);
    });
    if (!document.getElementById('ce-confirm-select-btn')) {
        const btn = document.createElement('button');
        btn.id = 'ce-confirm-select-btn';
        btn.className = state.theme === 'light' ? 'theme-light' : 'theme-dark';
        btn.textContent = '完成选择';
        btn.addEventListener('click', exitSelectionMode);
        document.body.appendChild(btn);
    } else {
        const btn = document.getElementById('ce-confirm-select-btn');
        btn.className = state.theme === 'light' ? 'theme-light' : 'theme-dark';
        btn.style.display = '';
    }
}

function exitSelectionMode() {
    state.selectionMode = false;
    document.querySelectorAll('.ce-checkbox').forEach(cb => cb.remove());
    const confirmBtn = document.getElementById('ce-confirm-select-btn');
    if (confirmBtn) confirmBtn.style.display = 'none';
    updateSelInfo();
    openPanel();
}

function updateSelInfo() {
    const info = document.getElementById('ce-sel-info');
    if (info) info.textContent = '已选 ' + state.selectedMesIds.size + ' 条';
}

/* ===================== 消息收集（核心修复） ===================== */

function collectMessages() {
    const tagsInput = document.getElementById('ce-tags-input').value.trim();
    const filterMode = document.querySelector('input[name="ce-filter"]:checked').value;
    const raw = [];

    if (state.selectMethod === 'manual') {
        state.selectedMesIds.forEach(mesId => {
            const mes = document.querySelector('.mes[mesid="' + mesId + '"]');
            if (mes) {
                const d = extractMessageData(mes);
                if (d) raw.push(d);
            }
        });
    } else if (state.selectMethod === 'all') {
        document.querySelectorAll('#chat .mes').forEach(mes => {
            const d = extractMessageData(mes);
            if (d) raw.push(d);
        });
    } else {
        const start = parseInt(document.getElementById('ce-floor-start').value) || 1;
        const end = parseInt(document.getElementById('ce-floor-end').value) || 999999;
        const allMes = document.querySelectorAll('#chat .mes');
        allMes.forEach((mes, idx) => {
            const floor = idx + 1;
            if (floor >= start && floor <= end) {
                const d = extractMessageData(mes);
                if (d) raw.push(d);
            }
        });
    }

    /*
     * === 核心修复 ===
     * 之前的 bug：分别对 innerText 和 innerHTML 做过滤，
     * 但 innerText 里根本没有任何 HTML 标签，所以正则什么都匹配不到。
     *
     * 修复：只对 innerHTML 做过滤（标签只存在于 HTML 中），
     * 然后从过滤后的 HTML 中派生出纯文本。
     */
    const filtered = [];
    raw.forEach(msg => {
        const filteredHtml = processContent(msg.html, tagsInput, filterMode);

        // 从过滤后的 HTML 派生纯文本
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = filteredHtml;
        const filteredText = tempDiv.innerText.trim();

        if (filteredText) {
            filtered.push({ name: msg.name, text: filteredText, html: filteredHtml });
        }
    });

    return filtered;
}

/* ===================== 导出 ===================== */

function doExport() {
    try {
        const messages = collectMessages();
        if (!messages.length) {
            alert('没有可导出的消息。\n\n请检查：\n1. 是否已选择消息\n2. 标签过滤设置是否正确\n3. "仅保留"模式下，消息中是否存在对应标签');
            return;
        }
        if (state.format === 'txt') {
            exportToTxt(messages);
        } else {
            exportToImage(messages);
        }
    } catch (e) {
        console.error('[ChatExporter] 导出出错:', e);
        alert('导出时发生错误: ' + e.message);
    }
}

function exportToTxt(messages) {
    let content = '';
    messages.forEach(msg => {
        content += msg.name + ':\n' + msg.text + '\n\n';
    });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chat_export_' + Date.now() + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

async function exportToImage(messages) {
    try {
        await loadHtml2Canvas();
    } catch (e) {
        alert('html2canvas 库加载失败，请检查网络。');
        return;
    }
    const container = document.createElement('div');
    container.id = 'ce-render-container';

    switch (state.style) {
        case 'white-card':
            container.className = 'ce-export-white-card'; break;
        case 'dark-minimal':
            container.className = 'ce-export-dark-minimal'; break;
        case 'warm-note':
            container.className = 'ce-export-warm-note'; break;
        default:
            container.className = 'ce-export-default';
            container.style.backgroundColor = state.bgColor;
            container.style.color = state.textColor;
            break;
    }

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'ce-msg';
        div.innerHTML = '<div class="ce-msg-name">' + msg.name + '</div><div class="ce-msg-content">' + msg.html + '</div>';
        container.appendChild(div);
    });

    document.body.appendChild(container);

    try {
        const canvas = await html2canvas(container, {
            backgroundColor: null,
            scale: 2,
            useCORS: true,
        });
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = 'chat_export_' + Date.now() + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        alert('图片生成失败: ' + e.message);
    }

    container.remove();
}

/* ===================== 扩展菜单按钮 ===================== */

function createMenuButton() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu) return;
    if (document.getElementById('ce-ext-menu-item')) return;
    const item = document.createElement('div');
    item.id = 'ce-ext-menu-item';
    item.className = 'list-group-item flex-container flexGap5';
    item.innerHTML = '<div class="fa-solid fa-file-export extensionsMenuExtensionButton"></div><span>聊天导出</span>';
    item.addEventListener('click', function () {
        const trigger = document.getElementById('extensionsMenuButton');
        if (trigger) trigger.click();
        openPanel();
    });
    menu.prepend(item);
}

/* ===================== 初始化 ===================== */

jQuery(async function () {
    console.log('[ChatExporter] v2.4 开始加载...');
    injectStyles();
    createPanel();
    createMenuButton();
    console.log('[ChatExporter] v2.4 加载完成');
});
