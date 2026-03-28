import { getContext } from '../../../extensions.js';

// ================================================================
//  Chat Exporter v2.8 — 聊天记录导出器
// ================================================================

const state = {
    selectedMesIds: new Set(),
    style: 'default',
    format: 'img',
    exportLayout: 'pc',
    bgColor: '#ffffff',
    textColor: '#000000',
    colorTarget: 'bg',
    selectMethod: 'manual',
    selectionMode: false,
    theme: 'light',
    compressLevel: '1.0' // 图片压缩等级 (默认不压缩)
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

/* ===================== 样式注入 ===================== */

function injectStyles() {
    if (document.getElementById('ce-injected-styles')) return;
    const el = document.createElement('style');
    el.id = 'ce-injected-styles';
    el.textContent = `
/* ===== 遮罩 ===== */
#ce-overlay, #ce-search-overlay {
    position:fixed; top:0; left:0; width:100vw; height:100vh;
    background:rgba(0,0,0,0.7); z-index:2147483640;
    opacity:0; pointer-events:none; transition:opacity .2s ease;
    display: none; /* 修复：默认彻底隐藏，避免干扰SillyTavern加载 */
}
#ce-search-overlay { z-index:2147483645; }
#ce-overlay.open, #ce-search-overlay.open {
    opacity:1; pointer-events:auto;
    display: block; /* 修复：打开时显示 */
}

/* ===== 面板基础 ===== */
#ce-panel {
    position:fixed; top:5vh; left:50%;
    transform:translateX(-50%);
    width:440px; max-width:92vw; height:auto; max-height:90vh;
    border-radius:12px;
    z-index:2147483641; display:flex; flex-direction:column;
    overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.6);
    font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;
    font-size:13px;
    opacity:0; pointer-events:none;
    transition:opacity .2s ease;
    display: none; /* 修复：默认彻底隐藏，避免干扰SillyTavern加载 */
}
#ce-panel.open {
    opacity:1; pointer-events:auto;
    display: flex; /* 修复：打开时显示 */
}

/* ===== 搜索弹窗 ===== */
#ce-search-panel {
    position:fixed; top:8vh; left:50%;
    transform:translateX(-50%);
    width:90vw; max-width:550px; height:80vh; /* 强制高度开启内部滚动 */
    border-radius:12px;
    z-index:2147483646; display:flex; flex-direction:column;
    overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.6);
    font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;
    opacity:0; pointer-events:none;
    transition:opacity .2s ease;
    display: none;
}
#ce-search-panel.open {
    opacity:1; pointer-events:auto;
    display: flex;
}
.ce-search-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; flex-shrink:0; gap:10px; }
.ce-search-input { flex:1; padding:8px 12px; border-radius:6px; outline:none; font-size:14px; border:1px solid transparent; }
.ce-search-count { font-size:12px; white-space:nowrap; }
.ce-search-close { font-size:24px; cursor:pointer; padding:0 5px; line-height:1; }
.ce-search-body { flex:1; overflow-y:auto; padding:12px 16px; -webkit-overflow-scrolling:touch; }
.ce-search-body::-webkit-scrollbar { width:6px; }
.ce-search-body::-webkit-scrollbar-thumb { background:#888; border-radius:3px; }
.ce-search-item { padding:12px; margin-bottom:12px; border-radius:8px; cursor:pointer; transition:background .2s; }
.ce-search-item-header { font-size:12px; font-weight:bold; margin-bottom:6px; }
.ce-search-item-text { font-size:13px; line-height:1.5; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.ce-search-highlight { color:#ff4d4f; font-weight:bold; background:rgba(255,77,79,0.1); border-radius:2px; padding:0 2px; }

/* ===== 手机/平板适配 ===== */
@media (max-width:768px) {
    .ce-style-cards { display:grid !important; grid-template-columns:1fr 1fr !important; }
    .ce-color-row { flex-wrap:wrap !important; }
}

/* ===== 日间主题 (纯白) ===== */
#ce-panel.theme-light, #ce-search-panel.theme-light { background:#ffffff; color:#000000; border:1px solid #cccccc; }
#ce-panel.theme-light .ce-header, #ce-search-panel.theme-light .ce-search-header { background:#ffffff; border-bottom:1px solid #eeeeee; }
#ce-panel.theme-light .ce-close { color:#000000; }
#ce-panel.theme-light .ce-close:hover { background:#f0f0f0; }
#ce-panel.theme-light .ce-theme-btn { background:#f0f0f0; color:#000000; border:1px solid #cccccc; }
#ce-panel.theme-light .ce-section { background:#ffffff; border:1px solid #eeeeee; }
#ce-panel.theme-light .ce-section-title { color:#000000; }
#ce-panel.theme-light .ce-input,
#ce-panel.theme-light .ce-number-input,
#ce-panel.theme-light .ce-hex-input { background:#ffffff; border:1px solid #cccccc; color:#000000; }
#ce-panel.theme-light .ce-btn { background:#f0f0f0; border:1px solid #cccccc; color:#000000; }
#ce-panel.theme-light .ce-btn:hover { background:#e0e0e0; }
#ce-panel.theme-light .ce-btn-primary { background:#000000; color:#ffffff; border-color:#000000; }
#ce-panel.theme-light .ce-btn-primary:hover { background:#333333; }
#ce-panel.theme-light .ce-style-card { background:#ffffff; border:2px solid #eeeeee; }
#ce-panel.theme-light .ce-style-card.active { border-color:#000000; background:#f9f9f9; }
#ce-panel.theme-light .ce-target-btn, #ce-panel.theme-light .ce-picker-tab { background:#f0f0f0; border:1px solid #cccccc; color:#000000; }
#ce-panel.theme-light .ce-target-btn.active, #ce-panel.theme-light .ce-picker-tab.active { background:#000000; color:#ffffff; }
#ce-panel.theme-light .ce-export-row { background:#ffffff; border-top:1px solid #eeeeee; }
/* 搜索专属 - 日间 */
#ce-search-panel.theme-light .ce-search-input { background:#f0f2f5; color:#000000; }
#ce-search-panel.theme-light .ce-search-close { color:#000000; opacity:0.6; }
#ce-search-panel.theme-light .ce-search-close:hover { opacity:1; }
#ce-search-panel.theme-light .ce-search-item { background:#f9f9f9; border:1px solid #eeeeee; }
#ce-search-panel.theme-light .ce-search-item-header { color:#555; }
#ce-search-panel.theme-light .ce-search-item-text { color:#222; }
#ce-search-panel.theme-light .ce-search-item:hover { background:#f0f2f5; border-color:#ccc; }

/* ===== 夜间主题 (纯黑) ===== */
#ce-panel.theme-dark, #ce-search-panel.theme-dark { background:#000000; color:#ffffff; border:1px solid #333333; }
#ce-panel.theme-dark .ce-header, #ce-search-panel.theme-dark .ce-search-header { background:#000000; border-bottom:1px solid #333333; }
#ce-panel.theme-dark .ce-close { color:#ffffff; }
#ce-panel.theme-dark .ce-close:hover { background:#222222; }
#ce-panel.theme-dark .ce-theme-btn { background:#222222; color:#ffffff; border:1px solid #444444; }
#ce-panel.theme-dark .ce-section { background:#000000; border:1px solid #222222; }
#ce-panel.theme-dark .ce-section-title { color:#ffffff; }
#ce-panel.theme-dark .ce-input,
#ce-panel.theme-dark .ce-number-input,
#ce-panel.theme-dark .ce-hex-input { background:#000000; border:1px solid #444444; color:#ffffff; }
#ce-panel.theme-dark .ce-btn { background:#222222; border:1px solid #444444; color:#ffffff; }
#ce-panel.theme-dark .ce-btn:hover { background:#333333; }
#ce-panel.theme-dark .ce-btn-primary { background:#ffffff; color:#000000; border-color:#ffffff; }
#ce-panel.theme-dark .ce-btn-primary:hover { background:#cccccc; }
#ce-panel.theme-dark .ce-style-card { background:#000000; border:2px solid #222222; }
#ce-panel.theme-dark .ce-style-card.active { border-color:#ffffff; background:#111111; }
#ce-panel.theme-dark .ce-target-btn, #ce-panel.theme-dark .ce-picker-tab { background:#222222; border:1px solid #444444; color:#ffffff; }
#ce-panel.theme-dark .ce-target-btn.active, #ce-panel.theme-dark .ce-picker-tab.active { background:#ffffff; color:#000000; }
#ce-panel.theme-dark .ce-export-row { background:#000000; border-top:1px solid #333333; }
/* 搜索专属 - 夜间 */
#ce-search-panel.theme-dark .ce-search-input { background:#1a1a1a; color:#ffffff; border:1px solid #333; }
#ce-search-panel.theme-dark .ce-search-close { color:#ffffff; opacity:0.6; }
#ce-search-panel.theme-dark .ce-search-close:hover { opacity:1; }
#ce-search-panel.theme-dark .ce-search-item { background:#111111; border:1px solid #333333; }
#ce-search-panel.theme-dark .ce-search-item-header { color:#aaa; }
#ce-search-panel.theme-dark .ce-search-item-text { color:#eee; }
#ce-search-panel.theme-dark .ce-search-item:hover { background:#1a1a1a; border-color:#555; }

/* ===== 通用组件 ===== */
.ce-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; font-size:15px; font-weight:bold; flex-shrink:0; }
.ce-theme-btn { padding:6px 12px; border-radius:4px; font-size:12px; cursor:pointer; }
.ce-close { cursor:pointer; font-size:20px; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:6px; }
.ce-body { padding:16px 20px; overflow-y:auto; flex:1; -webkit-overflow-scrolling:touch; }
.ce-body::-webkit-scrollbar { width:6px; }
.ce-body::-webkit-scrollbar-track { background:transparent; }
.ce-body::-webkit-scrollbar-thumb { background:#888; border-radius:3px; }
.ce-section { margin-bottom:18px; padding:14px; border-radius:8px; }
.ce-section-title { font-size:13px; font-weight:bold; margin-bottom:12px; }
.ce-radio-group { display:flex; gap:14px; flex-wrap:wrap; }
.ce-radio-group label { display:flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; }
.ce-input { width:100%; padding:10px 12px; border-radius:6px; font-size:13px; outline:none; box-sizing:border-box; }
.ce-number-input { width:80px; padding:8px; border-radius:6px; font-size:13px; outline:none; text-align:center; box-sizing:border-box; }
.ce-btn { padding:10px 16px; border-radius:6px; cursor:pointer; font-size:13px; transition:all .2s; user-select:none; font-weight:bold; }
.ce-style-cards { display:flex; gap:10px; flex-wrap:wrap; }
.ce-style-card { flex:1; min-width:85px; padding:12px 8px; border-radius:8px; text-align:center; cursor:pointer; transition:all .2s; }
.ce-style-preview { width:100%; height:42px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:16px; margin-bottom:8px; border:1px solid #ccc; }
.ce-style-card span { font-size:12px; font-weight:bold; }
.ce-color-row { display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
.ce-hex-input { width:80px; padding:8px; border-radius:6px; font-size:12px; font-family:monospace; outline:none; box-sizing:border-box; }
.ce-swatch { width:32px; height:32px; border-radius:6px; border:1px solid #888; cursor:pointer; flex-shrink:0; }
.ce-target-btns { display:flex; gap:8px; margin-bottom:12px; }
.ce-target-btn { flex:1; padding:10px; border-radius:6px; cursor:pointer; font-size:12px; text-align:center; font-weight:bold; }
.ce-picker-tabs { display:flex; gap:6px; margin-bottom:10px; }
.ce-picker-tab { flex:1; padding:8px; border-radius:6px; cursor:pointer; font-size:12px; text-align:center; font-weight:bold; }
.ce-picker-pane { display:none; }
.ce-picker-pane.active { display:block; }
.ce-color-grid { display:grid; grid-template-columns:repeat(8,1fr); gap:6px; }
.ce-grid-swatch { aspect-ratio:1; border-radius:4px; cursor:pointer; border:1px solid #888; box-sizing:border-box; }
#ce-spectrum { width:100%; height:150px; border-radius:6px; cursor:crosshair; border:1px solid #888; display:block; }
.ce-slider-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.ce-slider-row label { font-size:13px; font-weight:bold; width:14px; text-align:center; }
.ce-slider-row input[type="range"] { flex:1; height:6px; }
.ce-slider-val { font-size:12px; font-family:monospace; width:30px; text-align:right; }
.ce-export-row { padding:16px 20px; display:flex; justify-content:center; flex-shrink:0; }

/* ===== 自定义圆形复选框 ===== */
.ce-checkbox {
    appearance:none !important; -webkit-appearance:none !important;
    position:absolute !important; left:10px !important; top:12px !important;
    width:24px !important; height:24px !important;
    border-radius:50% !important;
    border:2px solid #888888 !important;
    cursor:pointer !important; margin:0 !important;
    z-index:2147483635 !important;
    background:transparent !important;
    background-image:none !important; /* 修复重叠 */
    transition:all .2s;
}
.ce-checkbox::before { display: none !important; content: none !important; } /* 修复重叠 */
.ce-checkbox.theme-light:checked { background:#000000 !important; border-color:#000000 !important; }
.ce-checkbox.theme-dark:checked { background:#ffffff !important; border-color:#ffffff !important; }
.ce-checkbox:checked::after {
    content:''; position:absolute;
    left:7px; top:3px; width:6px; height:11px;
    border:solid; border-width:0 2px 2px 0;
    transform:rotate(45deg);
}
.ce-checkbox.theme-light:checked::after { border-color:#ffffff; }
.ce-checkbox.theme-dark:checked::after { border-color:#000000; }

/* ===== 完成选择按钮 (移动端完美适配防遮挡) ===== */
#ce-confirm-select-btn {
    position:fixed !important; bottom:60px !important; left:50% !important;
    transform:translateX(-50%) !important;
    padding:16px 40px !important; border-radius:30px !important;
    font-size:16px !important; font-weight:bold !important; cursor:pointer !important;
    z-index:2147483647 !important;
    box-shadow:0 8px 24px rgba(0,0,0,0.5) !important;
    width:max-content !important;
}
@media (max-width:768px) {
    #ce-confirm-select-btn {
        bottom:15vh !important; /* 手机端改为百分比高度，躲避输入法和工具栏 */
        width:80% !important;
        text-align:center !important;
    }
}

#ce-confirm-select-btn.theme-light { background:#000000 !important; color:#ffffff !important; border:1px solid #000000 !important; }
#ce-confirm-select-btn.theme-dark { background:#ffffff !important; color:#000000 !important; border:1px solid #ffffff !important; }

/* ===== 渲染容器基础 ===== */
#ce-render-container { position:absolute; top:-99999px; left:-99999px; }

/* ===== 电脑版排版 (默认 800px) ===== */
.ce-export-default { padding:28px; line-height:1.9; font-size:15px; font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif; }
.ce-export-default .ce-msg { margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid rgba(128,128,128,.3); }
.ce-export-default .ce-msg:last-child { border-bottom:none; margin-bottom:0; }
.ce-export-default .ce-msg-name { font-weight:bold; margin-bottom:6px; font-size:14px; }

.ce-export-white-card { padding:24px; background:#f0f2f5; line-height:1.85; font-size:15px; font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif; color:#333; }
.ce-export-white-card .ce-msg { background:#fff; border-radius:12px; padding:18px 22px; margin-bottom:14px; box-shadow:0 1px 4px rgba(0,0,0,.08); }
.ce-export-white-card .ce-msg:last-child { margin-bottom:0; }
.ce-export-white-card .ce-msg-name { font-weight:bold; color:#1a73e8; margin-bottom:8px; font-size:13px; }

.ce-export-dark-minimal { padding:28px; background:#1a1a2e; line-height:1.85; font-size:15px; font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif; color:#e2e2e2; }
.ce-export-dark-minimal .ce-msg { padding-bottom:16px; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,.1); }
.ce-export-dark-minimal .ce-msg:last-child { border-bottom:none; margin-bottom:0; }
.ce-export-dark-minimal .ce-msg-name { font-weight:bold; color:#8b92ff; margin-bottom:6px; font-size:13px; }

.ce-export-warm-note { padding:30px 34px; background:#faf6ee; line-height:2; font-size:15px; font-family:Georgia,'Noto Serif SC','Source Han Serif SC',serif; color:#4a3f2f; }
.ce-export-warm-note .ce-msg { padding-left:16px; margin-bottom:18px; border-left:3px solid #c9a96e; }
.ce-export-warm-note .ce-msg:last-child { margin-bottom:0; }
.ce-export-warm-note .ce-msg-name { font-weight:bold; color:#8b6c2a; margin-bottom:6px; font-size:13px; }

/* ===== 手机版排版优化 (覆盖基础样式) ===== */
.ce-layout-mobile { font-size:16px !important; }
.ce-layout-mobile.ce-export-default { padding:20px; }
.ce-layout-mobile.ce-export-white-card { padding:16px; }
.ce-layout-mobile.ce-export-dark-minimal { padding:20px; }
.ce-layout-mobile.ce-export-warm-note { padding:24px 20px; }
.ce-layout-mobile .ce-msg-name { font-size:15px !important; }

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
            <span>聊天记录导出器</span>
            <div style="display:flex;align-items:center;gap:12px;">
                <div class="ce-theme-btn" id="ce-theme-btn">切换夜间</div>
                <div class="ce-close" id="ce-close-btn">X</div>
            </div>
        </div>
        <div class="ce-body">
            <div class="ce-section" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <span>快速跳转</span>
                <input type="number" class="ce-number-input" id="ce-jump-input" placeholder="楼层" min="1">
                <button class="ce-btn" id="ce-jump-btn">跳转</button>
                <button class="ce-btn" id="ce-jump-top-btn">回顶</button>
                <button class="ce-btn" id="ce-jump-bottom-btn">回底</button>
                <div style="flex:1"></div>
                <button class="ce-btn" id="ce-open-search-btn">搜索消息</button>
            </div>
            <div class="ce-section" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <span>消息隐藏与显示</span>
                <input type="number" class="ce-number-input" id="ce-hide-start" placeholder="起始" min="1">
                <span>至</span>
                <input type="number" class="ce-number-input" id="ce-hide-end" placeholder="结束" min="1">
                <button class="ce-btn" id="ce-hide-btn">隐藏</button>
                <button class="ce-btn" id="ce-show-btn">显示</button>
            </div>
            <div class="ce-section">
                <div class="ce-section-title">消息选择</div>
                <div class="ce-radio-group">
                    <label><input type="radio" name="ce-sel-method" value="manual" checked> 手动勾选</label>
                    <label><input type="radio" name="ce-sel-method" value="range"> 按楼层范围</label>
                    <label><input type="radio" name="ce-sel-method" value="all"> 全部导出</label>
                </div>
                <div id="ce-manual-area" style="margin-top:12px">
                    <div style="display:flex;align-items:center;gap:10px">
                        <button class="ce-btn" id="ce-sel-btn">开启选择模式</button>
                        <span id="ce-sel-info">已选 0 条</span>
                    </div>
                </div>
                <div id="ce-range-area" style="display:none;margin-top:12px">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span>楼层</span>
                        <input type="number" class="ce-number-input" id="ce-floor-start" placeholder="起始" min="1">
                        <span>至</span>
                        <input type="number" class="ce-number-input" id="ce-floor-end" placeholder="结束" min="1">
                    </div>
                </div>
            </div>
            <div class="ce-section">
                <div class="ce-section-title">标签过滤</div>
                <input type="text" class="ce-input" id="ce-tags-input" placeholder="标签名，如 thinking（留空不过滤）">
                <div class="ce-radio-group" style="margin-top:12px">
                    <label><input type="radio" name="ce-filter" value="0" checked> 不过滤</label>
                    <label><input type="radio" name="ce-filter" value="1"> 去除标签及内容</label>
                    <label><input type="radio" name="ce-filter" value="2"> 仅保留标签内内容</label>
                </div>
            </div>
            <div class="ce-section">
                <div class="ce-section-title">导出格式与排版</div>
                <div class="ce-radio-group" style="margin-bottom:12px;">
                    <label><input type="radio" name="ce-format" value="txt"> TXT 文本</label>
                    <label><input type="radio" name="ce-format" value="img" checked> 图片导出</label>
                </div>
                <div class="ce-radio-group" id="ce-layout-group" style="margin-bottom:12px;">
                    <label><input type="radio" name="ce-layout" value="pc" checked> 电脑版 (宽屏)</label>
                    <label><input type="radio" name="ce-layout" value="mobile"> 手机版 (窄屏阅读)</label>
                </div>
                <div class="ce-radio-group" id="ce-compress-group">
                    <label><input type="radio" name="ce-compress" value="1.0" checked> 原画质</label>
                    <label><input type="radio" name="ce-compress" value="0.8"> 轻度压缩(0.8)</label>
                    <label><input type="radio" name="ce-compress" value="0.6"> 中度压缩(0.6)</label>
                    <label><input type="radio" name="ce-compress" value="0.4"> 极限压缩(0.4)</label>
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
                    <span>背景色</span>
                    <input type="text" class="ce-hex-input" id="ce-bg-hex" value="#ffffff">
                    <div class="ce-swatch" id="ce-bg-swatch" style="background:#ffffff"></div>
                    <div style="flex:1"></div>
                    <span>文字色</span>
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
                            <label>R</label>
                            <input type="range" id="ce-r-slider" min="0" max="255" value="255">
                            <span class="ce-slider-val" id="ce-r-val">255</span>
                        </div>
                        <div class="ce-slider-row">
                            <label>G</label>
                            <input type="range" id="ce-g-slider" min="0" max="255" value="255">
                            <span class="ce-slider-val" id="ce-g-val">255</span>
                        </div>
                        <div class="ce-slider-row">
                            <label>B</label>
                            <input type="range" id="ce-b-slider" min="0" max="255" value="255">
                            <span class="ce-slider-val" id="ce-b-val">255</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="ce-export-row">
            <button class="ce-btn ce-btn-primary" id="ce-export-btn" style="width:100%;padding:14px;font-size:16px;border-radius:8px;">确 认 导 出</button>
        </div>
    </div>

    <!-- 独立的搜索消息弹窗 -->
    <div id="ce-search-overlay"></div>
    <div id="ce-search-panel" class="theme-light">
        <div class="ce-search-header">
            <input type="text" class="ce-search-input" id="ce-search-input" placeholder="输入关键字搜索...">
            <span class="ce-search-count" id="ce-search-count">0 条匹配</span>
            <div class="ce-search-close" id="ce-search-close">×</div>
        </div>
        <div class="ce-search-body" id="ce-search-results">
            <!-- 搜索结果在这里显示 -->
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    setupPanelEvents();
    setupSearchPanelEvents();
}

/* ===================== 面板事件 ===================== */

function setupPanelEvents() {
    document.getElementById('ce-theme-btn').addEventListener('click', function () {
        const panel = document.getElementById('ce-panel');
        const searchPanel = document.getElementById('ce-search-panel');
        if (state.theme === 'light') {
            state.theme = 'dark';
            panel.classList.remove('theme-light');
            panel.classList.add('theme-dark');
            searchPanel.classList.remove('theme-light');
            searchPanel.classList.add('theme-dark');
            this.textContent = '切换日间';
        } else {
            state.theme = 'light';
            panel.classList.remove('theme-dark');
            panel.classList.add('theme-light');
            searchPanel.classList.remove('theme-dark');
            searchPanel.classList.add('theme-light');
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

    document.getElementById('ce-jump-top-btn').addEventListener('click', function () {
        const chat = document.getElementById('chat');
        if (chat) chat.scrollTo({ top: 0, behavior: 'instant' });
        closePanel();
    });

    document.getElementById('ce-jump-bottom-btn').addEventListener('click', function () {
        const chat = document.getElementById('chat');
        if (chat) chat.scrollTo({ top: chat.scrollHeight, behavior: 'instant' });
        closePanel();
    });

    document.getElementById('ce-hide-btn').addEventListener('click', function () {
        const start = parseInt(document.getElementById('ce-hide-start').value);
        const end = parseInt(document.getElementById('ce-hide-end').value);
        if (!start || !end || start > end) return alert('请输入有效的楼层范围');
        if (window.SlashCommandParser && window.SlashCommandParser.execute) {
            window.SlashCommandParser.execute('/hide ' + start + '-' + end);
            closePanel();
        } else {
            alert('调用失败，当前酒馆版本不支持此原生指令。');
        }
    });

    document.getElementById('ce-show-btn').addEventListener('click', function () {
        const start = parseInt(document.getElementById('ce-hide-start').value);
        const end = parseInt(document.getElementById('ce-hide-end').value);
        if (!start || !end || start > end) return alert('请输入有效的楼层范围');
        if (window.SlashCommandParser && window.SlashCommandParser.execute) {
            window.SlashCommandParser.execute('/unhide ' + start + '-' + end);
            closePanel();
        } else {
            alert('调用失败，当前酒馆版本不支持此原生指令。');
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
        state.selectedMesIds.clear(); // 每次开启选择前自动清空旧记忆
        enterSelectionMode();
    });

    document.querySelectorAll('input[name="ce-format"]').forEach(r => {
        r.addEventListener('change', function () {
            state.format = this.value;
            const showImgOptions = this.value === 'img';
            document.getElementById('ce-style-section').style.display = showImgOptions ? '' : 'none';
            document.getElementById('ce-layout-group').style.display = showImgOptions ? 'flex' : 'none';
            document.getElementById('ce-compress-group').style.display = showImgOptions ? 'flex' : 'none';
            updateColorSectionVisibility();
        });
    });

    document.querySelectorAll('input[name="ce-layout"]').forEach(r => {
        r.addEventListener('change', function () {
            state.exportLayout = this.value;
        });
    });

    document.querySelectorAll('input[name="ce-compress"]').forEach(r => {
        r.addEventListener('change', function () {
            state.compressLevel = this.value; // 保存图片压缩档次
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

/* ===================== 搜索弹窗事件 ===================== */

function setupSearchPanelEvents() {
    const searchOverlay = document.getElementById('ce-search-overlay');
    const searchPanel = document.getElementById('ce-search-panel');
    const searchInput = document.getElementById('ce-search-input');
    const searchResults = document.getElementById('ce-search-results');
    const searchCount = document.getElementById('ce-search-count');

    // 打开搜索弹窗
    document.getElementById('ce-open-search-btn').addEventListener('click', function () {
        searchOverlay.classList.add('open');
        searchPanel.classList.add('open');
        searchInput.value = '';
        searchResults.innerHTML = '';
        searchCount.textContent = '0 条匹配';
        setTimeout(() => searchInput.focus(), 100);
    });

    // 关闭搜索弹窗
    const closeSearch = () => {
        searchOverlay.classList.remove('open');
        searchPanel.classList.remove('open');
    };
    document.getElementById('ce-search-close').addEventListener('click', closeSearch);
    searchOverlay.addEventListener('click', closeSearch);

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 实时搜索逻辑
    searchInput.addEventListener('input', function () {
        const keyword = this.value.trim().toLowerCase();
        searchResults.innerHTML = '';

        if (!keyword) {
            searchCount.textContent = '0 条匹配';
            return;
        }

        const allMes = document.querySelectorAll('#chat .mes');
        let matchCount = 0;

        allMes.forEach((mes, idx) => {
            const textEl = mes.querySelector('.mes_text');
            if (!textEl) return;

            let name = "User";
            const context = typeof getContext === 'function' ? getContext() : null;
            const chatArray = context ? context.chat : [];
            const mesId = mes.getAttribute('mesid');
            if (chatArray && chatArray[mesId] && chatArray[mesId].name) {
                name = chatArray[mesId].name;
            } else {
                const nameEl = mes.querySelector('.ch_name');
                name = nameEl ? nameEl.innerText.trim() : (mes.getAttribute('ch_name') || "User");
            }

            // 精准提取段落 (优先匹配 p 或 div 子元素，若无则整段提取)
            const paragraphs = Array.from(textEl.querySelectorAll('p, div')).filter(el => el.textContent.trim() !== '');
            const targets = paragraphs.length > 0 ? paragraphs : [textEl];

            targets.forEach(target => {
                const text = target.innerText || target.textContent;
                if (name.toLowerCase().includes(keyword) || text.toLowerCase().includes(keyword)) {
                    matchCount++;
                    const floor = idx + 1;

                    // 安全提取并高亮关键字
                    const safeText = text.replace(/</g, '<').replace(/>/g, '>');
                    const regex = new RegExp('(' + escapeRegExp(keyword) + ')', 'gi');
                    const highlightedText = safeText.replace(regex, '<span class="ce-search-highlight">$1</span>');

                    const item = document.createElement('div');
                    item.className = 'ce-search-item';
                    item.innerHTML = `
                        <div class="ce-search-item-header">第 ${floor} 层 | ${name}</div>
                        <div class="ce-search-item-text">${highlightedText}</div>
                    `;

                    // 点击精准跳转到对应的段落
                    item.addEventListener('click', () => {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        // 添加目标段落黄色闪烁提示反馈
                        const oldBg = target.style.backgroundColor;
                        const oldTrans = target.style.transition;
                        target.style.transition = 'background-color 0.3s';
                        target.style.backgroundColor = 'rgba(255, 215, 0, 0.4)';
                        setTimeout(() => {
                            target.style.backgroundColor = oldBg;
                            setTimeout(() => target.style.transition = oldTrans, 300);
                        }, 1500);

                        closeSearch();
                        closePanel();
                    });

                    searchResults.appendChild(item);
                }
            });
        });

        searchCount.textContent = `${matchCount} 条匹配`;
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

/* ===================== 核心：原生文本提取与过滤 ===================== */

function collectMessages() {
    const tagsInput = document.getElementById('ce-tags-input').value.trim();
    const filterMode = document.querySelector('input[name="ce-filter"]:checked').value;
    const raw = [];

    const context = typeof getContext === 'function' ? getContext() : null;
    const chatArray = context ? context.chat : [];

    const processMes = (mes) => {
        const mesId = mes.getAttribute('mesid');
        const textEl = mes.querySelector('.mes_text');
        if (!textEl) return; // 只要有聊天内容，就绝对不跳过！

        // 修复：优先从酒馆底层数据获取名字，没有DOM元素也不怕漏掉用户消息
        let name = "User";
        if (chatArray && chatArray[mesId] && chatArray[mesId].name) {
            name = chatArray[mesId].name;
        } else {
            const nameEl = mes.querySelector('.ch_name');
            name = nameEl ? nameEl.innerText.trim() : (mes.getAttribute('ch_name') || "User");
        }

        let rawText = "";
        let hasRaw = false;

        if (chatArray && chatArray[mesId] && chatArray[mesId].mes) {
            rawText = chatArray[mesId].mes;
            hasRaw = true;
        } else {
            rawText = textEl.innerText;
        }

        raw.push({ name, rawText, html: textEl.innerHTML, hasRaw });
    };

    if (state.selectMethod === 'manual') {
        state.selectedMesIds.forEach(mesId => {
            const mes = document.querySelector('.mes[mesid="' + mesId + '"]');
            if (mes) processMes(mes);
        });
    } else if (state.selectMethod === 'all') {
        document.querySelectorAll('#chat .mes').forEach(mes => processMes(mes));
    } else {
        const start = parseInt(document.getElementById('ce-floor-start').value) || 1;
        const end = parseInt(document.getElementById('ce-floor-end').value) || 999999;
        const allMes = document.querySelectorAll('#chat .mes');
        allMes.forEach((mes, idx) => {
            const floor = idx + 1;
            if (floor >= start && floor <= end) processMes(mes);
        });
    }

    const filtered = [];
    const tags = tagsInput.split(',').map(t => t.trim().replace(/^<\/?|\/?>$/g, '')).filter(Boolean);

    raw.forEach(msg => {
        let processedText = msg.rawText;
        let keptText = [];

        if (tags.length && filterMode !== '0') {
            tags.forEach(tag => {
                const re = new RegExp('<\\s*' + tag + '\\b[^>]*>([\\s\\S]*?)<\\s*\\/\\s*' + tag + '\\s*>', 'gi');
                if (filterMode === '1') {
                    processedText = processedText.replace(re, '');
                } else if (filterMode === '2') {
                    let m;
                    while ((m = re.exec(msg.rawText)) !== null) {
                        if (m[1].trim()) keptText.push(m[1].trim());
                    }
                }
            });

            if (filterMode === '2') {
                processedText = keptText.join('\n\n');
            }
        }

        if (!processedText.trim()) return;

        let finalHtml = msg.html;

        if (tags.length && filterMode !== '0' && msg.hasRaw) {
            try {
                if (window.marked && window.marked.parse) {
                    finalHtml = window.marked.parse(processedText);
                } else if (window.showdown && window.showdown.Converter) {
                    const conv = new window.showdown.Converter();
                    finalHtml = conv.makeHtml(processedText);
                } else {
                    finalHtml = processedText
                        .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
                        .replace(/\n/g, '<br>');
                }
            } catch(e) {
                finalHtml = processedText.replace(/\n/g, '<br>');
            }
        } else if (filterMode === '2' && !msg.hasRaw) {
             finalHtml = processedText.replace(/\n/g, '<br>');
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = finalHtml;
        const finalText = tempDiv.innerText.trim() || processedText;

        filtered.push({ name: msg.name, text: finalText, html: finalHtml });
    });

    return filtered;
}

/* ===================== 导出 ===================== */

async function doExport() {
    try {
        const messages = collectMessages();
        if (!messages.length) {
            alert('没有可导出的消息。请检查是否已选择消息，或标签过滤设置是否正确。');
            return;
        }
        if (state.format === 'txt') {
            exportToTxt(messages);
        } else {
            await exportToImage(messages);
        }

        // 导出完成后重置多选状态
        state.selectedMesIds.clear();
        updateSelInfo();

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

    // 动态应用宽度设置
    container.style.width = state.exportLayout === 'mobile' ? '450px' : '800px';

    let baseClass = '';
    switch (state.style) {
        case 'white-card': baseClass = 'ce-export-white-card'; break;
        case 'dark-minimal': baseClass = 'ce-export-dark-minimal'; break;
        case 'warm-note': baseClass = 'ce-export-warm-note'; break;
        default:
            baseClass = 'ce-export-default';
            container.style.backgroundColor = state.bgColor;
            container.style.color = state.textColor;
            break;
    }

    // 如果是手机版排版，追加修饰类名
    if (state.exportLayout === 'mobile') {
        baseClass += ' ce-layout-mobile';
    }
    container.className = baseClass;

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

        // 动态判断压缩等级
        if (state.compressLevel === '1.0') {
            a.href = canvas.toDataURL('image/png');
            a.download = 'chat_export_' + Date.now() + '.png';
        } else {
            const quality = parseFloat(state.compressLevel);
            a.href = canvas.toDataURL('image/jpeg', quality);
            a.download = 'chat_export_compressed_' + Date.now() + '.jpg';
        }

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
    console.log('[ChatExporter] v2.8 开始加载...');
    injectStyles();
    createPanel();
    createMenuButton();
    console.log('[ChatExporter] v2.8 加载完成');
});
