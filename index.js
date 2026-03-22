import { getContext } from '../../../extensions.js';

// ================================================================
//  Chat Exporter v2.0 — 聊天记录导出器
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

function processContent(content, tagsInput, filterMode) {
    if (!tagsInput || !filterMode || filterMode === '0') return content;
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    if (!tags.length) return content;
    if (filterMode === '1') {
        let r = content;
        tags.forEach(tag => { r = r.replace(new RegExp('<' + tag + '>[\\s\\S]*?<\\/' + tag + '>', 'gi'), ''); });
        return r;
    }
    if (filterMode === '2') {
        const kept = [];
        tags.forEach(tag => {
            let m; const re = new RegExp('<' + tag + '>([\\s\\S]*?)<\\/' + tag + '>', 'gi');
            while ((m = re.exec(content)) !== null) kept.push(m[1]);
        });
        return kept.join('\n\n');
    }
    return content;
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
    background: rgba(0,0,0,0.55); z-index: 2147483640;
    backdrop-filter: blur(3px);
    opacity:0; pointer-events:none;
    transition: opacity .25s ease;
}
#ce-overlay.open { opacity:1; pointer-events:auto; }

/* ===== 面板 ===== */
#ce-panel {
    position: fixed; top:50%; left:50%;
    transform: translate(-50%,-50%) scale(0.92);
    width: 430px; max-width:94vw; max-height:88vh;
    background: #2a2a2e; border:1px solid #555; border-radius:14px;
    z-index: 2147483641; display:flex; flex-direction:column;
    overflow:hidden; box-shadow: 0 24px 80px rgba(0,0,0,.6);
    font-family: -apple-system,'Segoe UI','Microsoft YaHei',sans-serif;
    color:#e0e0e0; font-size:13px;
    opacity:0; pointer-events:none;
    transition: opacity .25s ease, transform .25s ease;
}
#ce-panel.open {
    opacity:1; pointer-events:auto;
    transform: translate(-50%,-50%) scale(1);
}

/* 头部 */
.ce-header {
    display:flex; justify-content:space-between; align-items:center;
    padding:13px 18px; background:#333; border-bottom:1px solid #4a4a4a;
    font-size:15px; font-weight:600; flex-shrink:0;
}
.ce-close {
    cursor:pointer; font-size:22px; color:#888;
    width:30px; height:30px; display:flex; align-items:center; justify-content:center;
    border-radius:6px; transition:all .15s;
}
.ce-close:hover { color:#fff; background:#555; }

/* 主体 */
.ce-body { padding:14px 18px; overflow-y:auto; flex:1; }
.ce-body::-webkit-scrollbar { width:6px; }
.ce-body::-webkit-scrollbar-track { background:transparent; }
.ce-body::-webkit-scrollbar-thumb { background:#555; border-radius:3px; }

/* 区段 */
.ce-section { margin-bottom:16px; }
.ce-section-title {
    font-size:11px; font-weight:700; color:#999;
    margin-bottom:8px; text-transform:uppercase; letter-spacing:1.5px;
}

/* 单选组 */
.ce-radio-group { display:flex; gap:14px; flex-wrap:wrap; }
.ce-radio-group label {
    display:flex; align-items:center; gap:5px; cursor:pointer; font-size:13px; color:#ccc;
}
.ce-radio-group input[type="radio"] { accent-color:#5b9bd5; margin:0; }

/* 输入框 */
.ce-input {
    width:100%; padding:7px 10px; background:#363639; border:1px solid #555;
    border-radius:6px; color:#e0e0e0; font-size:13px; outline:none;
    box-sizing:border-box; transition:border-color .2s;
}
.ce-input:focus { border-color:#5b9bd5; }
.ce-number-input {
    width:80px; padding:6px 8px; background:#363639; border:1px solid #555;
    border-radius:6px; color:#e0e0e0; font-size:13px; outline:none; text-align:center;
    box-sizing:border-box;
}

/* 按钮 */
.ce-btn {
    padding:7px 16px; border:1px solid #555; border-radius:6px;
    background:#3a3a3e; color:#e0e0e0; cursor:pointer; font-size:13px;
    transition:all .15s; user-select:none;
}
.ce-btn:hover { background:#4a4a4e; border-color:#777; }
.ce-btn-primary { background:#5b9bd5; border-color:#5b9bd5; color:#fff; font-weight:600; }
.ce-btn-primary:hover { background:#6daae0; }

/* 样式卡片 */
.ce-style-cards { display:flex; gap:8px; flex-wrap:wrap; }
.ce-style-card {
    flex:1; min-width:85px; padding:8px 6px; border:2px solid #4a4a4e;
    border-radius:10px; text-align:center; cursor:pointer;
    transition:all .15s; background:#333;
}
.ce-style-card:hover { border-color:#888; }
.ce-style-card.active { border-color:#5b9bd5; background:#2e3a4a; }
.ce-style-preview {
    width:100%; height:42px; border-radius:6px;
    display:flex; align-items:center; justify-content:center;
    font-weight:bold; font-size:16px; margin-bottom:5px;
}
.ce-style-card span { font-size:11px; color:#aaa; }

/* 颜色区域 */
.ce-color-row {
    display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap;
}
.ce-color-row label { font-size:12px; color:#bbb; white-space:nowrap; }
.ce-hex-input {
    width:76px; padding:5px 8px; background:#363639; border:1px solid #555;
    border-radius:5px; color:#e0e0e0; font-size:12px; font-family:monospace; outline:none;
    box-sizing:border-box;
}
.ce-hex-input:focus { border-color:#5b9bd5; }
.ce-swatch {
    width:26px; height:26px; border-radius:5px; border:2px solid #666; cursor:pointer; flex-shrink:0;
}

/* 颜色目标切换 */
.ce-target-btns { display:flex; gap:6px; margin-bottom:10px; }
.ce-target-btn {
    flex:1; padding:6px; border:1px solid #555; border-radius:6px;
    background:#3a3a3e; color:#bbb; cursor:pointer; font-size:12px;
    text-align:center; transition:all .15s;
}
.ce-target-btn.active { background:#5b9bd5; border-color:#5b9bd5; color:#fff; }

/* 调色盘标签 */
.ce-picker-tabs { display:flex; gap:4px; margin-bottom:8px; }
.ce-picker-tab {
    flex:1; padding:5px; border:1px solid #555; border-radius:5px;
    background:#3a3a3e; color:#bbb; cursor:pointer; font-size:11px;
    text-align:center; transition:all .15s;
}
.ce-picker-tab.active { background:#555; color:#fff; border-color:#777; }

/* 调色盘内容 */
.ce-picker-pane { display:none; }
.ce-picker-pane.active { display:block; }

/* 色块网格 */
.ce-color-grid {
    display:grid; grid-template-columns:repeat(8,1fr); gap:4px;
}
.ce-grid-swatch {
    aspect-ratio:1; border-radius:4px; cursor:pointer;
    border:2px solid transparent; transition:all .12s; box-sizing:border-box;
}
.ce-grid-swatch:hover { transform:scale(1.2); border-color:#fff; z-index:1; position:relative; }

/* 光谱画布 */
#ce-spectrum {
    width:100%; height:150px; border-radius:6px; cursor:crosshair; border:1px solid #555;
    display:block;
}

/* 滑块 */
.ce-slider-row { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.ce-slider-row label { font-size:13px; font-weight:700; width:14px; text-align:center; }
.ce-slider-row input[type="range"] { flex:1; height:6px; }
#ce-r-slider { accent-color:#f44336; }
#ce-g-slider { accent-color:#4caf50; }
#ce-b-slider { accent-color:#2196f3; }
.ce-slider-val { font-size:11px; font-family:monospace; color:#aaa; width:28px; text-align:right; }

/* 楼层范围 */
.ce-floor-range { display:flex; align-items:center; gap:8px; margin-top:6px; }

/* 选择信息 */
.ce-select-info { font-size:12px; color:#888; }

/* 底部导出行 */
.ce-export-row {
    padding:12px 18px; border-top:1px solid #3e3e42;
    display:flex; justify-content:center; flex-shrink:0;
}

/* ===== 悬浮按钮 ===== */
#ce-float-btn {
    position:fixed; right:28px; top:80px;
    width:48px; height:48px; background:#3e3e42; color:#ccc;
    border-radius:50%; display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    cursor:grab; z-index:2147483630;
    box-shadow:0 4px 14px rgba(0,0,0,.5);
    font-size:11px; font-weight:700; user-select:none;
    border:2px solid #666; transition:background .15s, box-shadow .15s;
}
#ce-float-btn:hover { background:#555; box-shadow:0 6px 20px rgba(0,0,0,.6); }
#ce-float-btn i { font-size:17px; margin-bottom:1px; }

/* ===== 完成选择按钮 ===== */
#ce-confirm-select-btn {
    position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
    padding:12px 36px; background:#2e7d32; color:#fff; border:none;
    border-radius:26px; font-size:15px; font-weight:600; cursor:pointer;
    z-index:2147483645; box-shadow:0 4px 20px rgba(46,125,50,.5);
    transition:all .2s; user-select:none;
}
#ce-confirm-select-btn:hover { background:#388e3c; transform:translateX(-50%) scale(1.05); }

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
            <span>📤 聊天记录导出器</span>
            <div class="ce-close" id="ce-close-btn">×</div>
        </div>
        <div class="ce-body">

            <!-- 消息选择 -->
            <div class="ce-section">
                <div class="ce-section-title">消息选择</div>
                <div class="ce-radio-group">
                    <label><input type="radio" name="ce-sel-method" value="manual" checked> 手动勾选</label>
                    <label><input type="radio" name="ce-sel-method" value="range"> 按楼层范围</label>
                </div>
                <div id="ce-manual-area" style="margin-top:8px">
                    <div style="display:flex;align-items:center;gap:10px">
                        <button class="ce-btn" id="ce-sel-btn">开启选择模式</button>
                        <span class="ce-select-info" id="ce-sel-info">已选 0 条</span>
                    </div>
                </div>
                <div id="ce-range-area" style="display:none;margin-top:8px">
                    <div class="ce-floor-range">
                        <span style="color:#999;font-size:12px">楼层</span>
                        <input type="number" class="ce-number-input" id="ce-floor-start" placeholder="起始" min="1">
                        <span style="color:#666">~</span>
                        <input type="number" class="ce-number-input" id="ce-floor-end" placeholder="结束" min="1">
                    </div>
                </div>
            </div>

            <!-- 标签过滤 -->
            <div class="ce-section">
                <div class="ce-section-title">标签过滤</div>
                <input type="text" class="ce-input" id="ce-tags-input" placeholder="标签名，如 thinking, note（留空则不过滤）">
                <div class="ce-radio-group" style="margin-top:8px">
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
                            <label style="color:#f66">R</label>
                            <input type="range" id="ce-r-slider" min="0" max="255" value="245">
                            <span class="ce-slider-val" id="ce-r-val">245</span>
                        </div>
                        <div class="ce-slider-row">
                            <label style="color:#6c6">G</label>
                            <input type="range" id="ce-g-slider" min="0" max="255" value="245">
                            <span class="ce-slider-val" id="ce-g-val">245</span>
                        </div>
                        <div class="ce-slider-row">
                            <label style="color:#68f">B</label>
                            <input type="range" id="ce-b-slider" min="0" max="255" value="245">
                            <span class="ce-slider-val" id="ce-b-val">245</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
        <div class="ce-export-row">
            <button class="ce-btn ce-btn-primary" id="ce-export-btn" style="width:170px;padding:10px;font-size:14px">导 出</button>
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
    // 隐藏面板
    closePanel();

    // 添加复选框
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

    // 显示完成按钮
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

    // 移除复选框
    document.querySelectorAll('.ce-checkbox').forEach(cb => cb.remove());

    // 隐藏完成按钮
    const confirmBtn = document.getElementById('ce-confirm-select-btn');
    if (confirmBtn) confirmBtn.style.display = 'none';

    // 重新打开面板
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

/* ===================== 悬浮按钮（可拖动） ===================== */

function createFloatingButton() {
    if (document.getElementById('ce-float-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'ce-float-btn';
    btn.innerHTML = '<i class="fa-solid fa-file-export"></i><div style="font-size:9px;margin-top:1px">导出</div>';
    document.body.appendChild(btn);

    let isDragging = false;
    let hasMoved = false;
    let startX, startY, btnX, btnY;

    btn.addEventListener('mousedown', function (e) {
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = btn.getBoundingClientRect();
        btnX = rect.left;
        btnY = rect.top;
        btn.style.cursor = 'grabbing';
        btn.style.transition = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            hasMoved = true;
            btn.style.left = (btnX + dx) + 'px';
            btn.style.top = (btnY + dy) + 'px';
            btn.style.right = 'auto';
        }
    });

    document.addEventListener('mouseup', function () {
        if (!isDragging) return;
        isDragging = false;
        btn.style.cursor = 'grab';
        btn.style.transition = '';
        if (!hasMoved) {
            openPanel();
        }
    });

    // 触屏支持
    btn.addEventListener('touchstart', function (e) {
        isDragging = true;
        hasMoved = false;
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        const rect = btn.getBoundingClientRect();
        btnX = rect.left;
        btnY = rect.top;
        btn.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (!isDragging) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            hasMoved = true;
            btn.style.left = (btnX + dx) + 'px';
            btn.style.top = (btnY + dy) + 'px';
            btn.style.right = 'auto';
        }
    }, { passive: true });

    document.addEventListener('touchend', function () {
        if (!isDragging) return;
        isDragging = false;
        btn.style.transition = '';
        if (!hasMoved) {
            openPanel();
        }
    });
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
        // 尝试关闭扩展菜单
        const trigger = document.getElementById('extensionsMenuButton');
        if (trigger) trigger.click();
        openPanel();
    });
    menu.prepend(item);
}

/* ===================== 初始化 ===================== */

jQuery(async function () {
    console.log('[ChatExporter] v2.0 开始加载...');
    injectStyles();
    createPanel();
    createFloatingButton();
    createMenuButton();
    console.log('[ChatExporter] v2.0 加载完成');
});
