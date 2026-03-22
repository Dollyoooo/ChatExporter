import { getContext } from '../../../extensions.js';

// ================================================================
//  Chat Exporter v2.1 — 聊天记录导出器
// ================================================================

/* ===================== 状态 ===================== */
const state = {
    selectedMesIds: new Set(),
    style: 'default',
    format: 'img',
    bgColor: '#f5f5f5',
    textColor: '#333333',
    colorTarget: 'bg',
    selectMethod: 'manual',
    selectionMode: false,
};

/* ===================== 预设色板 ===================== */
const PRESET_COLORS = [
    '#ffffff','#f5f5f5','#e0e0e0','#bdbdbd','#9e9e9e','#757575','#424242','#212121',
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

// 彻底修复的标签过滤，暴力匹配所有换行、段落打断和转义变体
function processContent(content, tagsInput, filterMode) {
    if (!tagsInput || !filterMode || filterMode === '0') return content;
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    if (!tags.length) return content;

    let result = content;
    if (filterMode === '1') {
        tags.forEach(tag => {
            // 兼容原生HTML、转义符，以及被酒馆Markdown打断的标签结构
            const re1 = new RegExp('<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '>', 'gi');
            const re2 = new RegExp('<' + tag + '\\b[^&]*>[\\s\\S]*?<\\/' + tag + '>', 'gi');
            // 兼容某些极端情况：标签内部被强制插入了 <p> 等元素
            const re3 = new RegExp('<' + tag + '\\b[\\s\\S]*?<\\/' + tag + '>', 'gi');
            result = result.replace(re1, '').replace(re2, '').replace(re3, '');
        });
        return result;
    }
    if (filterMode === '2') {
        const kept = [];
        tags.forEach(tag => {
            const re1 = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'gi');
            const re2 = new RegExp('<' + tag + '\\b[^&]*>([\\s\\S]*?)<\\/' + tag + '>', 'gi');
            let m;
            while ((m = re1.exec(content)) !== null) kept.push(m[1]);
            while ((m = re2.exec(content)) !== null) kept.push(m[1]);
        });
        return kept.join('\n\n');
    }
    return result;
}

function extractMessageData(mes) {
    let name = mes.getAttribute('ch_name') || '';
    if (!name) {
        const n = mes.querySelector('.ch_name, .name_text');
        name = n ? n.textContent : '未知';
    }
    const textEl = mes.querySelector('.mes_text');
    if (!textEl) return null;
    return { name: name.trim(), text: textEl.innerText || '', html: textEl.innerHTML || '' };
}

/* ===================== 样式注入 ===================== */

function injectStyles() {
    if (document.getElementById('ce-injected-styles')) return;
    const el = document.createElement('style');
    el.id = 'ce-injected-styles';
    el.textContent = `

/* ===== 遮罩层 ===== */
#ce-overlay {
    position: fixed; top:0; left:0; width:100vw; height:100vh;
    background: rgba(0,0,0,0.4); z-index: 2147483640;
    backdrop-filter: blur(4px);
    opacity:0; pointer-events:none;
    transition: opacity .3s ease;
}
#ce-overlay.open { opacity:1; pointer-events:auto; }

/* ===== 面板 (更通透的毛玻璃效果) ===== */
#ce-panel {
    position: fixed; top:50%; left:50%;
    transform: translate(-50%,-50%) scale(0.92);
    width: 440px; max-width:94vw; max-height:88vh;
    /* 大幅降低黑色底色，提高透明度 */
    background: rgba(45, 48, 55, 0.15);
    /* 增强模糊效果，确保背景花哨时文字依然清晰 */
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    z-index: 2147483641; display:flex; flex-direction:column;
    /* 减轻阴影的沉重感 */
    overflow:hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.2);
    font-family: -apple-system,'Segoe UI','Microsoft YaHei',sans-serif;
    color: #f0f0f0; font-size:13px;
    opacity:0; pointer-events:none;
    transition: opacity .3s cubic-bezier(0.4, 0, 0.2, 1), transform .3s cubic-bezier(0.4, 0, 0.2, 1);
}
#ce-panel.open {
    opacity:1; pointer-events:auto;
    transform: translate(-50%,-50%) scale(1);
}

/* 头部 */
.ce-header {
    display:flex; justify-content:space-between; align-items:center;
    /* 改为微白底色，去掉沉重的黑色 */
    padding:16px 20px; background: rgba(255, 255, 255, 0.05);
    border-bottom:1px solid rgba(255,255,255,0.08);
    font-size:15px; font-weight:600; flex-shrink:0;
}
.ce-close {
    cursor:pointer; font-size:22px; color:#aaa;
    width:30px; height:30px; display:flex; align-items:center; justify-content:center;
    border-radius:6px; transition:all .15s;
}
.ce-close:hover { color:#fff; background:rgba(255,255,255,0.1); }

/* 主体 */
.ce-body { padding:16px 20px; overflow-y:auto; flex:1; }
.ce-body::-webkit-scrollbar { width:6px; }
.ce-body::-webkit-scrollbar-track { background:transparent; }
.ce-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.2); border-radius:3px; }

/* 区段 */
.ce-section { margin-bottom:18px; }
.ce-section-title {
    font-size:11px; font-weight:700; color:#aaa;
    margin-bottom:10px; text-transform:uppercase; letter-spacing:1.5px;
}

/* 单选组 */
.ce-radio-group { display:flex; gap:14px; flex-wrap:wrap; }
.ce-radio-group label {
    display:flex; align-items:center; gap:5px; cursor:pointer; font-size:13px; color:#ddd;
}
.ce-radio-group input[type="radio"] { accent-color:#5b9bd5; margin:0; }

/* 输入框 */
.ce-input {
    width:100%; padding:8px 12px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15);
    border-radius:8px; color:#fff; font-size:13px; outline:none;
    box-sizing:border-box; transition:border-color .2s;
}
.ce-input:focus { border-color:#5b9bd5; background:rgba(0,0,0,0.3); }
.ce-number-input {
    width:80px; padding:6px 8px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15);
    border-radius:6px; color:#fff; font-size:13px; outline:none; text-align:center;
    box-sizing:border-box;
}

/* 按钮 */
.ce-btn {
    padding:8px 16px; border:1px solid rgba(255,255,255,0.15); border-radius:8px;
    background:rgba(255,255,255,0.05); color:#fff; cursor:pointer; font-size:13px;
    transition:all .2s; user-select:none;
}
.ce-btn:hover { background:rgba(255,255,255,0.15); border-color:rgba(255,255,255,0.3); }
.ce-btn-primary { background:#5b9bd5; border-color:#5b9bd5; color:#fff; font-weight:600; }
.ce-btn-primary:hover { background:#6daae0; border-color:#6daae0; }

/* 样式卡片 */
.ce-style-cards { display:flex; gap:10px; flex-wrap:wrap; }
.ce-style-card {
    flex:1; min-width:85px; padding:10px 8px; border:2px solid rgba(255,255,255,0.1);
    border-radius:12px; text-align:center; cursor:pointer;
    transition:all .2s; background:rgba(0,0,0,0.2);
}
.ce-style-card:hover { border-color:rgba(255,255,255,0.3); }
.ce-style-card.active { border-color:#5b9bd5; background:rgba(91,155,213,0.15); }
.ce-style-preview {
    width:100%; height:42px; border-radius:8px;
    display:flex; align-items:center; justify-content:center;
    font-weight:bold; font-size:16px; margin-bottom:6px;
}
.ce-style-card span { font-size:11px; color:#bbb; }

/* 颜色区域 */
.ce-color-row {
    display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;
}
.ce-color-row label { font-size:12px; color:#ccc; white-space:nowrap; }
.ce-hex-input {
    width:76px; padding:6px 8px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15);
    border-radius:6px; color:#fff; font-size:12px; font-family:monospace; outline:none;
    box-sizing:border-box;
}
.ce-swatch {
    width:28px; height:28px; border-radius:6px; border:2px solid rgba(255,255,255,0.2); cursor:pointer; flex-shrink:0;
}

/* 颜色目标切换 */
.ce-target-btns { display:flex; gap:8px; margin-bottom:12px; }
.ce-target-btn {
    flex:1; padding:8px; border:1px solid rgba(255,255,255,0.15); border-radius:8px;
    background:rgba(255,255,255,0.05); color:#ccc; cursor:pointer; font-size:12px;
    text-align:center; transition:all .2s;
}
.ce-target-btn.active { background:#5b9bd5; border-color:#5b9bd5; color:#fff; }

/* 调色盘标签 */
.ce-picker-tabs { display:flex; gap:6px; margin-bottom:10px; }
.ce-picker-tab {
    flex:1; padding:6px; border:1px solid rgba(255,255,255,0.1); border-radius:6px;
    background:rgba(0,0,0,0.2); color:#bbb; cursor:pointer; font-size:11px;
    text-align:center; transition:all .2s;
}
.ce-picker-tab.active { background:rgba(255,255,255,0.15); color:#fff; border-color:rgba(255,255,255,0.3); }

/* 调色盘内容 */
.ce-picker-pane { display:none; }
.ce-picker-pane.active { display:block; }

/* 色块网格 */
.ce-color-grid {
    display:grid; grid-template-columns:repeat(8,1fr); gap:6px;
}
.ce-grid-swatch {
    aspect-ratio:1; border-radius:6px; cursor:pointer;
    border:2px solid transparent; transition:all .15s; box-sizing:border-box;
}
.ce-grid-swatch:hover { transform:scale(1.2); border-color:#fff; z-index:1; position:relative; box-shadow:0 4px 8px rgba(0,0,0,0.3); }

/* 光谱画布 */
#ce-spectrum {
    width:100%; height:150px; border-radius:8px; cursor:crosshair; border:1px solid rgba(255,255,255,0.15);
    display:block;
}

/* 滑块 */
.ce-slider-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.ce-slider-row label { font-size:13px; font-weight:700; width:14px; text-align:center; }
.ce-slider-row input[type="range"] { flex:1; height:6px; }
#ce-r-slider { accent-color:#ff5252; }
#ce-g-slider { accent-color:#69f0ae; }
#ce-b-slider { accent-color:#448aff; }
.ce-slider-val { font-size:12px; font-family:monospace; color:#ccc; width:30px; text-align:right; }

/* 楼层范围 */
.ce-floor-range { display:flex; align-items:center; gap:8px; margin-top:8px; }

/* 选择信息 */
.ce-select-info { font-size:12px; color:#aaa; }

/* 底部导出行 */
.ce-export-row {
    padding:14px 20px; border-top:1px solid rgba(255,255,255,0.08);
    background:rgba(0,0,0,0.1);
    display:flex; justify-content:center; flex-shrink:0;
}

/* ===== 完成选择按钮 ===== */
#ce-confirm-select-btn {
    position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
    padding:14px 40px; background:rgba(46,125,50,0.9); color:#fff; border:1px solid rgba(255,255,255,0.2);
    border-radius:30px; font-size:15px; font-weight:600; cursor:pointer;
    z-index:2147483645; box-shadow:0 8px 24px rgba(0,0,0,0.4);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    transition:all .2s; user-select:none;
}
#ce-confirm-select-btn:hover { background:rgba(56,142,60,1); transform:translateX(-50%) scale(1.05); }

/* ===== 消息复选框 ===== */
.ce-checkbox {
    position:absolute !important; left:6px !important; top:10px !important;
    width:20px !important; height:20px !important; z-index:2147483635 !important;
    cursor:pointer !important; accent-color:#5b9bd5 !important;
    margin:0 !important;
}

/* ===== 导出渲染容器 ===== */
#ce-render-container {
    position:absolute; top:-99999px; left:-99999px; width:800px;
}

/* --- 默认样式 --- */
.ce-export-default {
    padding:28px; line-height:1.9; font-size:15px;
    font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;
}
.ce-export-default .ce-msg {
    margin-bottom:18px; padding-bottom:14px;
    border-bottom:1px solid rgba(128,128,128,.18);
}
.ce-export-default .ce-msg:last-child { border-bottom:none; margin-bottom:0; }
.ce-export-default .ce-msg-name { font-weight:700; margin-bottom:6px; font-size:14px; }

/* --- 简约白卡 --- */
.ce-export-white-card {
    padding:24px; background:#f0f2f5; line-height:1.85; font-size:15px;
    font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif; color:#333;
}
.ce-export-white-card .ce-msg {
    background:#fff; border-radius:12px; padding:18px 22px;
    margin-bottom:14px; box-shadow:0 1px 4px rgba(0,0,0,.08);
}
.ce-export-white-card .ce-msg:last-child { margin-bottom:0; }
.ce-export-white-card .ce-msg-name {
    font-weight:700; color:#1a73e8; margin-bottom:8px; font-size:13px;
    letter-spacing:.5px;
}

/* --- 深色极简 --- */
.ce-export-dark-minimal {
    padding:28px; background:#1a1a2e; line-height:1.85; font-size:15px;
    font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif; color:#e2e2e2;
}
.ce-export-dark-minimal .ce-msg {
    padding-bottom:16px; margin-bottom:16px;
    border-bottom:1px solid rgba(255,255,255,.06);
}
.ce-export-dark-minimal .ce-msg:last-child { border-bottom:none; margin-bottom:0; }
.ce-export-dark-minimal .ce-msg-name {
    font-weight:600; color:#8b92ff; margin-bottom:6px; font-size:13px;
}

/* --- 暖色便签 --- */
.ce-export-warm-note {
    padding:30px 34px; background:#faf6ee; line-height:2; font-size:15px;
    font-family:Georgia,'Noto Serif SC','Source Han Serif SC',serif; color:#4a3f2f;
}
.ce-export-warm-note .ce-msg {
    padding-left:16px; margin-bottom:18px;
    border-left:3px solid #c9a96e;
}
.ce-export-warm-note .ce-msg:last-child { margin-bottom:0; }
.ce-export-warm-note .ce-msg-name {
    font-weight:700; color:#8b6c2a; margin-bottom:6px; font-size:13px;
}

/* ===== 扩展菜单项 ===== */
#ce-ext-menu-item { cursor:pointer; }
#ce-ext-menu-item:hover { background:rgba(255,255,255,.08); }

    `;
    document.head.appendChild(el);
}

/* ===================== 面板创建 ===================== */

function createPanel() {
    const html = `
    <div id="ce-overlay"></div>
    <div id="ce-panel">
        <div class="ce-header">
            <div style="display:flex; align-items:center; gap:8px;">
                <!-- 纯代码绘制的 SVG 图标 -->
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>聊天记录导出器</span>
            </div>
            <div class="ce-close" id="ce-close-btn">×</div>
        </div>
        <div class="ce-body">

            <!-- 楼层跳转 -->
            <div class="ce-section" style="display:flex; align-items:center; gap:10px; background:rgba(0,0,0,0.15); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                <span style="font-weight:600; color:#ddd;">快速跳转</span>
                <input type="number" class="ce-number-input" id="ce-jump-input" placeholder="楼层" min="1" style="width:80px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);">
                <button class="ce-btn" id="ce-jump-btn" style="background:rgba(255,255,255,0.1); border:none;">跳转</button>
            </div>

            <!-- 消息选择 -->
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
                        <span style="color:#aaa;font-size:12px">楼层</span>
                        <input type="number" class="ce-number-input" id="ce-floor-start" placeholder="起始" min="1">
                        <span style="color:#888">~</span>
                        <input type="number" class="ce-number-input" id="ce-floor-end" placeholder="结束" min="1">
                    </div>
                </div>
            </div>

            <!-- 标签过滤 -->
            <div class="ce-section">
                <div class="ce-section-title">标签过滤</div>
                <input type="text" class="ce-input" id="ce-tags-input" placeholder="标签名，如 thinking, note（留空则不过滤）">
                <div class="ce-radio-group" style="margin-top:10px">
                    <label><input type="radio" name="ce-filter" value="0" checked> 不过滤</label>
                    <label><input type="radio" name="ce-filter" value="1"> 去除标签</label>
                    <label><input type="radio" name="ce-filter" value="2"> 仅保留</label>
                </div>
            </div>

            <!-- 导出格式 -->
            <div class="ce-section">
                <div class="ce-section-title">导出格式</div>
                <div class="ce-radio-group">
                    <label><input type="radio" name="ce-format" value="txt"> TXT 文本文件</label>
                    <label><input type="radio" name="ce-format" value="img" checked> PNG 图片</label>
                </div>
            </div>

            <!-- 导出样式 -->
            <div class="ce-section" id="ce-style-section">
                <div class="ce-section-title">导出样式</div>
                <div class="ce-style-cards">
                    <div class="ce-style-card active" data-style="default">
                        <div class="ce-style-preview" style="background:#f5f5f5;color:#333">Aa</div>
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

            <!-- 默认颜色调节 -->
            <div class="ce-section" id="ce-color-section">
                <div class="ce-section-title">默认颜色调节</div>
                <div class="ce-color-row">
                    <label>背景色</label>
                    <input type="text" class="ce-hex-input" id="ce-bg-hex" value="#f5f5f5">
                    <div class="ce-swatch" id="ce-bg-swatch" style="background:#f5f5f5"></div>
                    <div style="flex:1"></div>
                    <label>文字色</label>
                    <input type="text" class="ce-hex-input" id="ce-text-hex" value="#333333">
                    <div class="ce-swatch" id="ce-text-swatch" style="background:#333333"></div>
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
                            <input type="range" id="ce-r-slider" min="0" max="255" value="245">
                            <span class="ce-slider-val" id="ce-r-val">245</span>
                        </div>
                        <div class="ce-slider-row">
                            <label style="color:#69f0ae">G</label>
                            <input type="range" id="ce-g-slider" min="0" max="255" value="245">
                            <span class="ce-slider-val" id="ce-g-val">245</span>
                        </div>
                        <div class="ce-slider-row">
                            <label style="color:#448aff">B</label>
                            <input type="range" id="ce-b-slider" min="0" max="255" value="245">
                            <span class="ce-slider-val" id="ce-b-val">245</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
        <div class="ce-export-row">
            <button class="ce-btn ce-btn-primary" id="ce-export-btn" style="width:180px;padding:12px;font-size:15px;border-radius:24px;box-shadow:0 4px 12px rgba(91,155,213,0.3)">导 出</button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    setupPanelEvents();
}

/* ===================== 面板事件绑定 ===================== */

function setupPanelEvents() {
    // 关闭
    document.getElementById('ce-close-btn').addEventListener('click', closePanel);
    document.getElementById('ce-overlay').addEventListener('click', closePanel);

    // 楼层跳转
    document.getElementById('ce-jump-btn').addEventListener('click', function() {
        const floor = parseInt(document.getElementById('ce-jump-input').value);
        if (!floor || floor < 1) return;
        const allMes = document.querySelectorAll('#chat .mes');
        if (floor <= allMes.length) {
            allMes[floor - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
            closePanel(); // 跳转后自动关闭面板方便查看
        } else {
            alert('楼层不存在，当前最大楼层为 ' + allMes.length);
        }
    });

    // 选择方式切换
    document.querySelectorAll('input[name="ce-sel-method"]').forEach(r => {
        r.addEventListener('change', function () {
            state.selectMethod = this.value;
            document.getElementById('ce-manual-area').style.display = this.value === 'manual' ? '' : 'none';
            document.getElementById('ce-range-area').style.display = this.value === 'range' ? '' : 'none';
        });
    });

    // 选择模式按钮
    document.getElementById('ce-sel-btn').addEventListener('click', function () {
        enterSelectionMode();
    });

    // 格式切换
    document.querySelectorAll('input[name="ce-format"]').forEach(r => {
        r.addEventListener('change', function () {
            state.format = this.value;
            document.getElementById('ce-style-section').style.display = this.value === 'img' ? '' : 'none';
            updateColorSectionVisibility();
        });
    });

    // 样式卡片
    document.querySelectorAll('.ce-style-card').forEach(card => {
        card.addEventListener('click', function () {
            document.querySelectorAll('.ce-style-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            state.style = this.dataset.style;
            updateColorSectionVisibility();
        });
    });

    // 颜色目标切换
    document.querySelectorAll('.ce-target-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.ce-target-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            state.colorTarget = this.dataset.target;
            syncSlidersFromState();
        });
    });

    // 调色盘标签
    document.querySelectorAll('.ce-picker-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.ce-picker-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const tabName = this.dataset.tab;
            document.querySelectorAll('.ce-picker-pane').forEach(p => {
                p.classList.toggle('active', p.dataset.tab === tabName);
            });
            if (tabName === 'spectrum') {
                setTimeout(drawSpectrum, 20);
            }
        });
    });

    // 初始化色块网格
    initColorGrid();

    // 光谱画布事件
    const canvas = document.getElementById('ce-spectrum');
    let specDrag = false;
    canvas.addEventListener('mousedown', function (e) { specDrag = true; pickSpectrum(e); });
    canvas.addEventListener('mousemove', function (e) { if (specDrag) pickSpectrum(e); });
    document.addEventListener('mouseup', function () { specDrag = false; });

    // RGB滑块
    ['r', 'g', 'b'].forEach(ch => {
        document.getElementById('ce-' + ch + '-slider').addEventListener('input', function () {
            document.getElementById('ce-' + ch + '-val').textContent = this.value;
            const r = parseInt(document.getElementById('ce-r-slider').value);
            const g = parseInt(document.getElementById('ce-g-slider').value);
            const b = parseInt(document.getElementById('ce-b-slider').value);
            applyPickedColor(rgbToHex(r, g, b));
        });
    });

    // HEX输入
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

    // 导出按钮
    document.getElementById('ce-export-btn').addEventListener('click', doExport);
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
        swatch.addEventListener('click', function () {
            applyPickedColor(color);
        });
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

    // 水平色相渐变
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

    // 纵向白色覆盖
    const whiteGrad = ctx.createLinearGradient(0, 0, 0, 150);
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
    whiteGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, w, 150);

    // 纵向黑色覆盖
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
        cb.className = 'ce-checkbox';
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
        btn.textContent = '✓ 完成选择';
        btn.addEventListener('click', exitSelectionMode);
        document.body.appendChild(btn);
    } else {
        document.getElementById('ce-confirm-select-btn').style.display = '';
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

/* ===================== 消息收集 ===================== */

function collectMessages() {
    const tagsInput = document.getElementById('ce-tags-input').value.trim();
    const filterMode = document.querySelector('input[name="ce-filter"]:checked')?.value || '0';
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

    // 标签过滤
    const filtered = [];
    raw.forEach(msg => {
        const text = processContent(msg.text, tagsInput, filterMode);
        const html = processContent(msg.html, tagsInput, filterMode);
        if (text.trim()) {
            filtered.push({ name: msg.name, text, html });
        }
    });

    return filtered;
}

/* ===================== 导出 ===================== */

function doExport() {
    const messages = collectMessages();
    if (!messages.length) {
        alert('没有可导出的消息。\n请先选择消息或检查标签过滤设置。');
        return;
    }

    if (state.format === 'txt') {
        exportToTxt(messages);
    } else {
        exportToImage(messages);
    }
}

function exportToTxt(messages) {
    let content = '';
    messages.forEach(msg => {
        const cleanText = msg.text.replace(/<br\s*\/?>/gi, '\n');
        content += msg.name + ':\n' + cleanText + '\n\n';
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
            container.className = 'ce-export-white-card';
            break;
        case 'dark-minimal':
            container.className = 'ce-export-dark-minimal';
            break;
        case 'warm-note':
            container.className = 'ce-export-warm-note';
            break;
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
    // 菜单里的图标也换成一个内置的 FontAwesome 图标，去掉 emoji
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
    console.log('[ChatExporter] v2.1 开始加载...');
    injectStyles();
    createPanel();
    createMenuButton();
    console.log('[ChatExporter] v2.1 加载完成');
});
