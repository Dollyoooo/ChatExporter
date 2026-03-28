import { getContext } from '../../../extensions.js';
import { executeSlashCommands } from '../../../slash-commands/SlashCommandParser.js';

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
    compressLevel: '1.0'
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

function injectStyles() {
    if (document.getElementById('ce-injected-styles')) return;
    const el = document.createElement('style');
    el.id = 'ce-injected-styles';
    el.textContent = `
    #ce-overlay, #ce-search-overlay { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); z-index:2147483640; opacity:0; pointer-events:none; transition:opacity .2s ease; display: none; }
    #ce-search-overlay { z-index:2147483645; }
    #ce-overlay.open, #ce-search-overlay.open { opacity:1; pointer-events:auto; display: block; }
    #ce-panel { position:fixed; top:5vh; left:50%; transform:translateX(-50%); width:480px; max-width:92vw; height:auto; max-height:90vh; border-radius:12px; z-index:2147483641; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.6); font-family:-apple-system,sans-serif; font-size:13px; opacity:0; pointer-events:none; transition:opacity .2s ease; display: none; }
    #ce-panel.open { opacity:1; pointer-events:auto; display: flex; }
    #ce-search-panel { position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:440px; max-width:92vw; height:60vh; max-height:800px; border-radius:12px; z-index:2147483646; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.6); font-family:-apple-system,sans-serif; opacity:0; pointer-events:none; transition:opacity .2s ease; display: none; box-sizing: border-box; }
    #ce-search-panel.open { opacity:1; pointer-events:auto; display: flex; }
    @media (max-width:768px) { .ce-style-cards { display:grid !important; grid-template-columns:1fr 1fr !important; } .ce-color-row { flex-wrap:wrap !important; } #ce-search-panel { width: 90vw !important; max-width: 90vw !important; height: 75vh !important; } .ce-search-input { width: 100%; box-sizing: border-box; } }
    #ce-panel.theme-light, #ce-search-panel.theme-light { background:#ffffff; color:#000000; border:1px solid #cccccc; }
    #ce-panel.theme-light .ce-header, #ce-search-panel.theme-light .ce-search-header { background:#ffffff; border-bottom:1px solid #eeeeee; }
    #ce-panel.theme-light .ce-btn-primary { background:#000000; color:#ffffff; }
    #ce-panel.theme-light .ce-btn-primary:hover { background:#333333; }
    #ce-panel.theme-light .ce-style-card.active { border-color:#000000; background:#f9f9f9; }
    #ce-panel.theme-dark, #ce-search-panel.theme-dark { background:#000000; color:#ffffff; border:1px solid #333333; }
    #ce-panel.theme-dark .ce-header, #ce-search-panel.theme-dark .ce-search-header { background:#000000; border-bottom:1px solid #333333; }
    #ce-panel.theme-dark .ce-btn-primary { background:#ffffff; color:#000000; }
    #ce-panel.theme-dark .ce-btn-primary:hover { background:#cccccc; }
    #ce-panel.theme-dark .ce-style-card.active { border-color:#ffffff; background:#111111; }
    .ce-header, .ce-search-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; font-weight:bold; }
    .ce-theme-btn { padding:6px 12px; border-radius:4px; cursor:pointer; }
    .ce-close, .ce-search-close { cursor:pointer; font-size:22px; width:30px; height:30px; display:flex; align-items:center; justify-content:center; }
    .ce-body, .ce-search-body { padding:16px 20px; overflow-y:auto; flex:1; }
    .ce-section { margin-bottom:18px; padding:14px; border-radius:8px; border:1px solid var(--SmartThemeBorderColor, #ccc); }
    .ce-btn { padding:10px 16px; border-radius:6px; cursor:pointer; font-weight:bold; text-align:center; }
    .ce-input, .ce-number-input, .ce-search-input, .ce-hex-input { padding:8px; border-radius:6px; outline:none; border:1px solid var(--SmartThemeBorderColor, #ccc); background:transparent; color:inherit; }
    .ce-style-cards { display:flex; gap:10px; flex-wrap:wrap; }
    .ce-style-card { flex:1; min-width:85px; padding:12px 8px; border-radius:8px; text-align:center; cursor:pointer; border:2px solid transparent; }
    .ce-style-preview { height:42px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:bold; margin-bottom:8px; border:1px solid #ccc; }
    .ce-color-grid { display:grid; grid-template-columns:repeat(8,1fr); gap:6px; }
    .ce-grid-swatch { aspect-ratio:1; border-radius:4px; cursor:pointer; border:1px solid #888; }
    .ce-checkbox { appearance:none; position:absolute!important; left:10px!important; top:12px!important; width:24px!important; height:24px!important; border-radius:50%!important; border:2px solid #888!important; cursor:pointer!important; z-index:2147483635!important; transition:all .2s; }
    .ce-checkbox:checked { background:#000!important; border-color:#000!important; }
    .ce-checkbox:checked::after { content:''; position:absolute; left:7px; top:3px; width:6px; height:11px; border:solid #fff; border-width:0 2px 2px 0; transform:rotate(45deg); }
    #ce-confirm-select-btn { position:fixed!important; bottom:120px!important; left:50%!important; transform:translateX(-50%)!important; padding:16px 40px!important; border-radius:30px!important; font-size:16px!important; font-weight:bold!important; cursor:pointer!important; z-index:2147483647!important; box-shadow:0 8px 24px rgba(0,0,0,0.5)!important; background:#000!important; color:#fff!important; }
    #ce-render-container { position:absolute; top:-99999px; left:-99999px; }
    .ce-export-default { padding:28px; line-height:1.9; font-size:15px; font-family:-apple-system,sans-serif; }
    .ce-export-default .ce-msg { margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid rgba(128,128,128,.3); }
    .ce-export-default .ce-msg-name { font-weight:bold; margin-bottom:6px; font-size:14px; }
    .ce-export-white-card { padding:24px; background:#f0f2f5; line-height:1.85; font-size:15px; color:#333; }
    .ce-export-white-card .ce-msg { background:#fff; border-radius:12px; padding:18px 22px; margin-bottom:14px; box-shadow:0 1px 4px rgba(0,0,0,.08); }
    .ce-export-dark-minimal { padding:28px; background:#1a1a2e; line-height:1.85; font-size:15px; color:#e2e2e2; }
    .ce-export-dark-minimal .ce-msg { padding-bottom:16px; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,.1); }
    .ce-export-warm-note { padding:30px 34px; background:#faf6ee; line-height:2; font-size:15px; color:#4a3f2f; }
    .ce-export-warm-note .ce-msg { padding-left:16px; margin-bottom:18px; border-left:3px solid #c9a96e; }
    `;
    document.head.appendChild(el);
}

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
            <div class="ce-section" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-weight:bold;">快速导航</span>
                <button class="ce-btn" id="ce-scroll-top-btn" style="padding:8px 12px;">回顶</button>
                <button class="ce-btn" id="ce-scroll-bottom-btn" style="padding:8px 12px;">回底</button>
                <div style="width:1px;height:20px;background:#ccc;margin:0 4px;"></div>
                <input type="number" class="ce-number-input" id="ce-jump-input" placeholder="楼层" min="1" style="width:60px;">
                <button class="ce-btn" id="ce-jump-btn" style="padding:8px 12px;">跳转</button>
                <div style="flex:1"></div>
                <button class="ce-btn ce-btn-primary" id="ce-open-search-btn" style="padding:8px 14px;">搜索消息</button>
            </div>
            <div class="ce-section">
                <div class="ce-section-title">消息隐藏与显示系统</div>
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
                    <span>区间</span>
                    <input type="number" class="ce-number-input" id="ce-vis-start" placeholder="起始层" style="width:75px;">
                    <span>至</span>
                    <input type="number" class="ce-number-input" id="ce-vis-end" placeholder="结束层" style="width:75px;">
                </div>
                <div style="display:flex;gap:10px;">
                    <button class="ce-btn" id="ce-hide-btn" style="flex:1;background:#e53935;color:#fff;border:none;">隐藏选中层</button>
                    <button class="ce-btn" id="ce-unhide-btn" style="flex:1;background:#43a047;color:#fff;border:none;">显示选中层</button>
                </div>
            </div>
            <div class="ce-section">
                <div class="ce-section-title">导出选择</div>
                <div style="display:flex; gap:14px; margin-bottom:12px;">
                    <label><input type="radio" name="ce-sel-method" value="manual" checked> 手动</label>
                    <label><input type="radio" name="ce-sel-method" value="range"> 范围</label>
                    <label><input type="radio" name="ce-sel-method" value="all"> 全部</label>
                </div>
                <div id="ce-manual-area">
                    <button class="ce-btn" id="ce-sel-btn">开启多选模式</button>
                    <span id="ce-sel-info" style="margin-left:10px;">已选 0 条</span>
                </div>
                <div id="ce-range-area" style="display:none;">
                    起始: <input type="number" class="ce-number-input" id="ce-floor-start" min="1" style="width:60px; margin-right:10px;">
                    结束: <input type="number" class="ce-number-input" id="ce-floor-end" min="1" style="width:60px;">
                </div>
            </div>
            <div class="ce-section">
                <div class="ce-section-title">标签过滤</div>
                <input type="text" class="ce-input" id="ce-tags-input" placeholder="标签名，如 thinking（留空不过滤）" style="width:100%;">
                <div style="display:flex; gap:14px; margin-top:10px;">
                    <label><input type="radio" name="ce-filter" value="0" checked> 不过滤</label>
                    <label><input type="radio" name="ce-filter" value="1"> 删标签</label>
                    <label><input type="radio" name="ce-filter" value="2"> 仅保留</label>
                </div>
            </div>
            <div class="ce-section">
                <div class="ce-section-title">格式与排版</div>
                <div style="display:flex; gap:14px; margin-bottom:12px;">
                    <label><input type="radio" name="ce-format" value="txt"> TXT</label>
                    <label><input type="radio" name="ce-format" value="img" checked> 图片</label>
                </div>
                <div id="ce-layout-group" style="display:flex; gap:14px; margin-bottom:12px;">
                    <label><input type="radio" name="ce-layout" value="pc" checked> 电脑版</label>
                    <label><input type="radio" name="ce-layout" value="mobile"> 手机版</label>
                </div>
                <div id="ce-compress-group" style="display:flex; gap:14px;">
                    <label><input type="radio" name="ce-compress" value="1.0" checked> 原画质</label>
                    <label><input type="radio" name="ce-compress" value="0.8"> 压缩</label>
                </div>
            </div>
            <div class="ce-section" id="ce-style-section">
                <div class="ce-section-title">导出样式</div>
                <div class="ce-style-cards">
                    <div class="ce-style-card active" data-style="default"><div class="ce-style-preview" style="background:#ffffff;color:#000">Aa</div>默认</div>
                    <div class="ce-style-card" data-style="white-card"><div class="ce-style-preview" style="background:#f0f2f5;color:#333"><div style="background:#fff;padding:2px;border-radius:4px;">Aa</div></div>简约白卡</div>
                    <div class="ce-style-card" data-style="dark-minimal"><div class="ce-style-preview" style="background:#1a1a2e;color:#e2e2e2">Aa</div>深色极简</div>
                    <div class="ce-style-card" data-style="warm-note"><div class="ce-style-preview" style="background:#faf6ee;color:#4a3f2f;border-left:3px solid #c9a96e;">Aa</div>暖色便签</div>
                </div>
            </div>
            <div class="ce-section" id="ce-color-section">
                <div class="ce-section-title">默认颜色调节</div>
                <div style="display:flex; align-items:center; gap:8px;">
                    背景 <input type="text" class="ce-hex-input" id="ce-bg-hex" value="#ffffff">
                    字色 <input type="text" class="ce-hex-input" id="ce-text-hex" value="#000000">
                </div>
                <div class="ce-color-grid" id="ce-color-grid" style="margin-top:10px;"></div>
            </div>
        </div>
        <div style="padding:16px;">
            <button class="ce-btn ce-btn-primary" id="ce-export-btn" style="width:100%;padding:14px;font-size:16px;">确 认 导 出</button>
        </div>
    </div>
    <div id="ce-search-overlay"></div>
    <div id="ce-search-panel" class="theme-light">
        <div class="ce-search-header">
            <input type="text" class="ce-search-input" id="ce-search-input" placeholder="输入关键字搜索...">
            <span id="ce-search-count" style="margin-left:10px;">0 条匹配</span>
            <div class="ce-search-close" id="ce-search-close" style="margin-left:auto;">×</div>
        </div>
        <div class="ce-search-body" id="ce-search-results"></div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    setupPanelEvents();
    setupSearchPanelEvents();
}

function setupPanelEvents() {
    document.getElementById('ce-theme-btn').addEventListener('click', function () {
        const p = document.getElementById('ce-panel'), s = document.getElementById('ce-search-panel');
        if (state.theme === 'light') { state.theme = 'dark'; p.className='theme-dark'; s.className='theme-dark'; this.textContent='切换日间'; }
        else { state.theme = 'light'; p.className='theme-light'; s.className='theme-light'; this.textContent='切换夜间'; }
    });

    document.getElementById('ce-close-btn').addEventListener('click', closePanel);
    document.getElementById('ce-overlay').addEventListener('click', closePanel);

    document.getElementById('ce-jump-btn').addEventListener('click', function () {
        const floor = parseInt(document.getElementById('ce-jump-input').value);
        const allMes = document.querySelectorAll('#chat .mes');
        if (floor && floor >= 1 && floor <= allMes.length) { allMes[floor - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); closePanel(); }
    });

    document.getElementById('ce-scroll-top-btn').addEventListener('click', () => { document.querySelectorAll('#chat .mes')[0]?.scrollIntoView(); closePanel(); });
    document.getElementById('ce-scroll-bottom-btn').addEventListener('click', () => { const m = document.querySelectorAll('#chat .mes'); m[m.length-1]?.scrollIntoView(); closePanel(); });

    const execCmd = async (action) => {
        const s = document.getElementById('ce-vis-start').value, e = document.getElementById('ce-vis-end').value;
        if(s && e) await executeSlashCommands('/' + action + ' ' + s + '-' + e);
        closePanel();
    };
    document.getElementById('ce-hide-btn').addEventListener('click', () => execCmd('hide'));
    document.getElementById('ce-unhide-btn').addEventListener('click', () => execCmd('unhide'));

    document.querySelectorAll('input[name="ce-sel-method"]').forEach(r => {
        r.addEventListener('change', function () {
            state.selectMethod = this.value;
            document.getElementById('ce-manual-area').style.display = this.value === 'manual' ? '' : 'none';
            document.getElementById('ce-range-area').style.display = this.value === 'range' ? '' : 'none';
        });
    });

    document.getElementById('ce-sel-btn').addEventListener('click', () => { state.selectedMesIds.clear(); enterSelectionMode(); });

    document.querySelectorAll('input[name="ce-format"]').forEach(r => {
        r.addEventListener('change', function () {
            state.format = this.value;
            const isImg = this.value === 'img';
            document.getElementById('ce-style-section').style.display = isImg ? '' : 'none';
            document.getElementById('ce-layout-group').style.display = isImg ? 'flex' : 'none';
            document.getElementById('ce-compress-group').style.display = isImg ? 'flex' : 'none';
            document.getElementById('ce-color-section').style.display = (isImg && state.style === 'default') ? '' : 'none';
        });
    });

    document.querySelectorAll('input[name="ce-layout"]').forEach(r => r.addEventListener('change', function () { state.exportLayout = this.value; }));
    document.querySelectorAll('input[name="ce-compress"]').forEach(r => r.addEventListener('change', function () { state.compressLevel = this.value; }));

    document.querySelectorAll('.ce-style-card').forEach(card => {
        card.addEventListener('click', function () {
            document.querySelectorAll('.ce-style-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            state.style = this.dataset.style;
            document.getElementById('ce-color-section').style.display = (state.format === 'img' && state.style === 'default') ? '' : 'none';
        });
    });

    const grid = document.getElementById('ce-color-grid');
    PRESET_COLORS.slice(0, 32).forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'ce-grid-swatch';
        swatch.style.background = color;
        swatch.addEventListener('click', () => {
            state.bgColor = color;
            document.getElementById('ce-bg-hex').value = color;
        });
        grid.appendChild(swatch);
    });

    document.getElementById('ce-bg-hex').addEventListener('change', function() { if(/^#[0-9a-fA-F]{6}$/.test(this.value)) state.bgColor = this.value; });
    document.getElementById('ce-text-hex').addEventListener('change', function() { if(/^#[0-9a-fA-F]{6}$/.test(this.value)) state.textColor = this.value; });

    document.getElementById('ce-export-btn').addEventListener('click', doExport);
}

function setupSearchPanelEvents() {
    document.getElementById('ce-open-search-btn').addEventListener('click', function () {
        document.getElementById('ce-search-overlay').classList.add('open');
        document.getElementById('ce-search-panel').classList.add('open');
        document.getElementById('ce-search-input').focus();
    });
    const closeSearch = () => { document.getElementById('ce-search-overlay').classList.remove('open'); document.getElementById('ce-search-panel').classList.remove('open'); };
    document.getElementById('ce-search-close').addEventListener('click', closeSearch);

    document.getElementById('ce-search-input').addEventListener('input', function () {
        const keyword = this.value.trim().toLowerCase();
        const results = document.getElementById('ce-search-results');
        results.innerHTML = '';
        let count = 0;
        if (!keyword) { document.getElementById('ce-search-count').textContent = '0 条匹配'; return; }

        document.querySelectorAll('#chat .mes').forEach((mes, idx) => {
            const text = mes.querySelector('.mes_text')?.innerText || '';
            const nameEl = mes.querySelector('.ch_name');
            const name = nameEl ? nameEl.innerText : 'User';
            if (name.toLowerCase().includes(keyword) || text.toLowerCase().includes(keyword)) {
                count++;
                const item = document.createElement('div');
                item.className = 'ce-section';
                item.style.cursor = 'pointer';
                item.innerHTML = `<div style="font-weight:bold;margin-bottom:5px;">层 ${idx+1} | ${name}</div><div>${text}</div>`;
                item.addEventListener('click', () => { mes.scrollIntoView(); closeSearch(); closePanel(); });
                results.appendChild(item);
            }
        });
        document.getElementById('ce-search-count').textContent = count + ' 条匹配';
    });
}

function openPanel() { document.getElementById('ce-overlay').classList.add('open'); document.getElementById('ce-panel').classList.add('open'); }
function closePanel() { document.getElementById('ce-overlay').classList.remove('open'); document.getElementById('ce-panel').classList.remove('open'); }

function enterSelectionMode() {
    closePanel();
    document.querySelectorAll('.ce-checkbox').forEach(cb => cb.remove());
    document.querySelectorAll('#chat .mes').forEach(mes => {
        const mesId = mes.getAttribute('mesid');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'ce-checkbox';
        cb.checked = state.selectedMesIds.has(mesId);
        cb.addEventListener('click', e => e.stopPropagation());
        cb.addEventListener('change', function () { this.checked ? state.selectedMesIds.add(mesId) : state.selectedMesIds.delete(mesId); });
        mes.style.position = 'relative';
        mes.insertBefore(cb, mes.firstChild);
    });

    if (!document.getElementById('ce-confirm-select-btn')) {
        const btn = document.createElement('button');
        btn.id = 'ce-confirm-select-btn';
        btn.textContent = '完成选择';
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ce-checkbox').forEach(cb => cb.remove());
            btn.style.display = 'none';
            document.getElementById('ce-sel-info').textContent = '已选 ' + state.selectedMesIds.size + ' 条';
            openPanel();
        });
        document.body.appendChild(btn);
    } else { document.getElementById('ce-confirm-select-btn').style.display = ''; }
}

function collectMessages() {
    const raw = [];
    const processMes = (mes) => {
        const textEl = mes.querySelector('.mes_text');
        if (!textEl) return;
        const nameEl = mes.querySelector('.ch_name');
        raw.push({ name: nameEl ? nameEl.innerText : 'User', rawText: textEl.innerText, html: textEl.innerHTML });
    };

    if (state.selectMethod === 'manual') {
        state.selectedMesIds.forEach(id => {
            const mes = document.querySelector('.mes[mesid="' + id + '"]');
            if (mes) processMes(mes);
        });
    } else if (state.selectMethod === 'all') {
        document.querySelectorAll('#chat .mes').forEach(processMes);
    } else {
        const s = parseInt(document.getElementById('ce-floor-start').value) || 1;
        const e = parseInt(document.getElementById('ce-floor-end').value) || 999999;
        document.querySelectorAll('#chat .mes').forEach((mes, idx) => { if (idx+1 >= s && idx+1 <= e) processMes(mes); });
    }

    const tagsInput = document.getElementById('ce-tags-input').value.trim();
    const filterMode = document.querySelector('input[name="ce-filter"]:checked').value;
    const tags = tagsInput.split(',').filter(Boolean);
    const filtered = [];

    raw.forEach(msg => {
        let text = msg.rawText;
        if (tags.length && filterMode !== '0') {
            tags.forEach(t => {
                const re = new RegExp('<\\s*'+t+'[^>]*>([\\s\\S]*?)<\\/\\s*'+t+'\\s*>', 'gi');
                if (filterMode === '1') text = text.replace(re, '');
                else if (filterMode === '2') {
                    let kept = [];
                    let m; while ((m = re.exec(msg.rawText))) kept.push(m[1]);
                    text = kept.join('\\n\\n');
                }
            });
        }
        if (text.trim()) filtered.push({ name: msg.name, text: text, html: text.replace(/\\n/g, '<br>') });
    });
    return filtered;
}

async function doExport() {
    const msgs = collectMessages();
    if (!msgs.length) return alert('没有可导出的消息');

    if (state.format === 'txt') {
        let c = msgs.map(m => m.name + ':\\n' + m.text).join('\\n\\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([c], { type: 'text/plain' }));
        a.download = 'export.txt';
        a.click();
    } else {
        await loadHtml2Canvas();
        const container = document.createElement('div');
        container.id = 'ce-render-container';
        container.style.width = state.exportLayout === 'mobile' ? '450px' : '800px';

        let cName = 'ce-export-default';
        if(state.style === 'white-card') cName = 'ce-export-white-card';
        if(state.style === 'dark-minimal') cName = 'ce-export-dark-minimal';
        if(state.style === 'warm-note') cName = 'ce-export-warm-note';

        container.className = cName;
        if(state.style === 'default') {
            container.style.backgroundColor = state.bgColor;
            container.style.color = state.textColor;
        }

        msgs.forEach(m => {
            const d = document.createElement('div');
            d.className = 'ce-msg';
            d.innerHTML = '<div class="ce-msg-name">' + m.name + '</div><div>' + m.html + '</div>';
            container.appendChild(d);
        });
        document.body.appendChild(container);

        try {
            const canvas = await html2canvas(container, { backgroundColor: null, scale: 2 });
            const a = document.createElement('a');
            a.href = canvas.toDataURL(state.compressLevel === '1.0' ? 'image/png' : 'image/jpeg', parseFloat(state.compressLevel));
            a.download = 'export.png';
            a.click();
        } catch(e) { alert('生成失败: ' + e.message); }
        container.remove();
    }
}

function createMenuButton() {
    const inject = () => {
        // 定位点1：顶部导航栏的扩展拼图菜单
        const topMenu = document.getElementById('extensionsMenu');
        if (topMenu && !document.getElementById('ce-ext-top-item')) {
            const item = document.createElement('div');
            item.id = 'ce-ext-top-item';
            item.className = 'list-group-item flex-container flexGap5';
            item.style.cursor = 'pointer';
            item.innerHTML = '<div class="fa-solid fa-file-export extensionsMenuExtensionButton"></div><span>聊天导出面板</span>';
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                openPanel();
                // 自动关闭下拉菜单
                const menuBtn = document.getElementById('extensionsMenuButton');
                if (menuBtn) menuBtn.click();
            });
            topMenu.prepend(item);
        }

        // 定位点2：右侧面板内的扩展设置页 (魔棒面板)
        const rightPanel = document.getElementById('rm_extensions_block') || document.getElementById('extensions_settings');
        if (rightPanel && !document.getElementById('ce-ext-right-item')) {
            const item = document.createElement('div');
            item.id = 'ce-ext-right-item';
            item.className = 'inline-drawer';
            item.style.cursor = 'pointer';
            item.style.padding = '12px';
            item.style.marginTop = '10px';
            item.style.marginBottom = '10px';
            item.style.border = '1px solid var(--SmartThemeBorderColor, #555)';
            item.style.borderRadius = '8px';
            item.style.background = 'var(--SmartThemeBlurTintColor, rgba(0,0,0,0.1))';
            item.innerHTML = '<div style="display:flex; align-items:center; gap:10px; font-weight:bold; font-size:14px;"><div class="fa-solid fa-file-export" style="font-size:18px;"></div><span>打开聊天导出面板</span></div>';
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                openPanel();
            });
            rightPanel.prepend(item);
        }
    };

    // 无论酒馆界面怎么切换和刷新，每2秒钟检测并强行渲染一次，确保绝对能找到入口！
    setInterval(inject, 2000);
}

// 启动入口
jQuery(async function () {
    injectStyles();
    createPanel();
    createMenuButton();
});
