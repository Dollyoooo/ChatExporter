import { getContext } from '../../../extensions.js';

// ========== 工具函数：加载 html2canvas ==========
function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        if (window.html2canvas) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ========== 全局状态 ==========
let isSelectionMode = false;

// ========== 创建悬浮按钮 ==========
function createFloatingButton() {
    // 如果已经存在就不要重复创建
    if (document.getElementById('chat-exporter-floating-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'chat-exporter-floating-btn';
    btn.innerText = '导出';

    // 全部使用内联样式，避免任何CSS加载失败或被覆盖的问题
    btn.style.cssText = `
        position: fixed;
        right: 30px;
        top: 80px;
        width: 50px;
        height: 50px;
        background-color: #4a4a4a;
        color: #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
        font-size: 12px;
        font-weight: bold;
        user-select: none;
        border: 2px solid #888888;
    `;

    btn.addEventListener('mouseenter', function() {
        btn.style.backgroundColor = '#666666';
        btn.style.transform = 'scale(1.1)';
    });

    btn.addEventListener('mouseleave', function() {
        btn.style.backgroundColor = '#4a4a4a';
        btn.style.transform = 'scale(1.0)';
    });

    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        toggleSelectionMode();
    });

    document.body.appendChild(btn);
}

// ========== 创建复选框 ==========
function addCheckboxes() {
    const allMessages = document.querySelectorAll('.mes');
    allMessages.forEach(function(mes) {
        if (mes.querySelector('.chat-export-cb')) return;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'chat-export-cb';
        cb.style.cssText = `
            position: absolute;
            left: 5px;
            top: 10px;
            width: 20px;
            height: 20px;
            z-index: 2147483646;
            cursor: pointer;
            accent-color: #4a90d9;
        `;
        cb.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        mes.style.position = 'relative';
        mes.insertBefore(cb, mes.firstChild);
    });
}

// ========== 移除复选框 ==========
function removeCheckboxes() {
    const cbs = document.querySelectorAll('.chat-export-cb');
    cbs.forEach(function(cb) {
        cb.remove();
    });
}

// ========== 切换选择模式 ==========
function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    const btn = document.getElementById('chat-exporter-floating-btn');

    if (isSelectionMode) {
        addCheckboxes();
        btn.innerText = '确认';
        btn.style.backgroundColor = '#2e7d32';
        btn.style.borderColor = '#66bb6a';
        alert('已开启选择模式。\n请勾选需要导出的消息，然后点击绿色的"确认"按钮。');
    } else {
        showExportMenu();
        btn.innerText = '导出';
        btn.style.backgroundColor = '#4a4a4a';
        btn.style.borderColor = '#888888';
    }
}

// ========== 标签过滤函数 ==========
function processContent(content, tagsInput, filterMode) {
    if (!tagsInput) return content;

    var tags = tagsInput.split(',');
    var cleanTags = [];
    for (var i = 0; i < tags.length; i++) {
        var t = tags[i].trim();
        if (t !== '') cleanTags.push(t);
    }
    if (cleanTags.length === 0) return content;

    var result = content;

    if (filterMode === '1') {
        // 去除标签及其内部文字
        for (var j = 0; j < cleanTags.length; j++) {
            var tag = cleanTags[j];
            var regex = new RegExp('<' + tag + '>[\\s\\S]*?<\\/' + tag + '>', 'gi');
            result = result.replace(regex, '');
        }
    } else if (filterMode === '2') {
        // 仅保留标签内的文字
        var keptText = [];
        for (var k = 0; k < cleanTags.length; k++) {
            var tag2 = cleanTags[k];
            var regex2 = new RegExp('<' + tag2 + '>([\\s\\S]*?)<\\/' + tag2 + '>', 'gi');
            var match;
            while ((match = regex2.exec(content)) !== null) {
                keptText.push(match[1]);
            }
        }
        result = keptText.join('\n\n');
    }

    return result;
}

// ========== 导出菜单 ==========
function showExportMenu() {
    var checkedBoxes = document.querySelectorAll('.chat-export-cb:checked');

    if (checkedBoxes.length === 0) {
        alert('未选择任何消息，已退出导出模式。');
        removeCheckboxes();
        return;
    }

    // 询问标签过滤
    var tagsInput = prompt(
        '请输入需要处理的标签名（多个用英文逗号分隔）。\n' +
        '例如：thinking,note\n' +
        '如果不需要过滤，直接点确定留空即可：'
    );

    var filterMode = null;
    if (tagsInput && tagsInput.trim() !== '') {
        filterMode = prompt(
            '请选择处理模式（输入数字）：\n' +
            '1 = 去除这些标签及内部文字\n' +
            '2 = 仅导出这些标签内部的文字'
        );
    }

    // 收集选中的消息
    var selectedMessages = [];
    checkedBoxes.forEach(function(cb) {
        var mesElement = cb.closest('.mes');
        if (!mesElement) return;

        var nameEl = mesElement.querySelector('.ch_name, .name_text');
        var name = '';
        if (mesElement.getAttribute('ch_name')) {
            name = mesElement.getAttribute('ch_name');
        } else if (nameEl) {
            name = nameEl.textContent;
        } else {
            name = '未知';
        }

        var textEl = mesElement.querySelector('.mes_text');
        if (!textEl) return;

        var rawText = textEl.innerText || textEl.textContent || '';
        var rawHtml = textEl.innerHTML || '';

        var processedText = processContent(rawText, tagsInput, filterMode);
        var processedHtml = processContent(rawHtml, tagsInput, filterMode);

        if (processedText.trim() !== '') {
            selectedMessages.push({
                name: name,
                text: processedText,
                html: processedHtml
            });
        }
    });

    if (selectedMessages.length === 0) {
        alert('经过标签过滤后没有剩余内容，已退出。');
        removeCheckboxes();
        return;
    }

    // 询问导出格式
    var exportType = prompt(
        '已选择 ' + selectedMessages.length + ' 条消息。\n' +
        '请输入导出格式：\n' +
        'txt = 导出为文本文件\n' +
        'img = 导出为图片'
    );

    if (exportType === 'txt') {
        exportToTxt(selectedMessages);
        removeCheckboxes();
    } else if (exportType === 'img') {
        var bgType = prompt(
            '请选择图片背景颜色（输入数字）：\n' +
            '1 = 白底黑字\n' +
            '2 = 黑底白字\n' +
            '3 = 浅黄便签'
        );
        var bgClass = 'export-bg-white';
        if (bgType === '2') bgClass = 'export-bg-black';
        if (bgType === '3') bgClass = 'export-bg-yellow';
        exportToImage(selectedMessages, bgClass);
    } else {
        alert('未选择有效格式，已退出。');
        removeCheckboxes();
    }
}

// ========== 导出为TXT ==========
function exportToTxt(messages) {
    var content = '';
    for (var i = 0; i < messages.length; i++) {
        var msg = messages[i];
        var cleanText = msg.text.replace(/<br\s*\/?>/gi, '\n');
        content += msg.name + ':\n' + cleanText + '\n\n';
    }

    var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'chat_export.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ========== 导出为图片 ==========
async function exportToImage(messages, bgClass) {
    try {
        await loadHtml2Canvas();
    } catch (e) {
        alert('html2canvas 库加载失败，请检查网络连接。');
        removeCheckboxes();
        return;
    }

    // 创建临时渲染容器
    var container = document.createElement('div');
    container.id = 'export-canvas-container';
    container.className = bgClass;

    for (var i = 0; i < messages.length; i++) {
        var msg = messages[i];
        var msgDiv = document.createElement('div');
        msgDiv.style.marginBottom = '16px';
        msgDiv.innerHTML = '<strong>' + msg.name + '</strong><br>' + msg.html;
        container.appendChild(msgDiv);
    }

    document.body.appendChild(container);

    try {
        var canvas = await html2canvas(container, {
            backgroundColor: null,
            scale: 2,
            useCORS: true
        });

        var link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'chat_export.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        alert('图片生成失败：' + e.message);
    }

    container.remove();
    removeCheckboxes();
}

// ========== 插件入口 ==========
jQuery(async function() {
    console.log('[ChatExporter] 插件开始加载...');
    createFloatingButton();
    console.log('[ChatExporter] 插件加载完成。');
});
