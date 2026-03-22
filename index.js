import { getContext } from '../../../extensions.js';

function loadHtml2Canvas() {
    return new Promise((resolve) => {
        if (window.html2canvas) return resolve();
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

let isSelectionMode = false;
function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    if (isSelectionMode) {
        $('.mes').each(function() {
            if ($(this).find('.chat-export-checkbox').length === 0) {
                $(this).prepend('<input type="checkbox" class="chat-export-checkbox">');
            }
        });
        alert("已开启选择模式，请勾选需要导出的消息，然后再次点击导出按钮。");
    } else {
        showExportMenu();
    }
}

// 核心过滤函数
function processContent(content, tagsInput, filterMode) {
    if (!tagsInput) return content;

    // 将输入的字符串按逗号分割，去除空格，过滤掉空值
    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
    if (tags.length === 0) return content;

    let result = content;

    if (filterMode === '1') {
        // 模式1：去除标签及其内部文字
        tags.forEach(tag => {
            // 正则匹配 <tag>任意内容</tag>，忽略大小写，全局匹配
            const regex = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi');
            result = result.replace(regex, '');
        });
    } else if (filterMode === '2') {
        // 模式2：仅导出标签内的文字
        let keptText = [];
        tags.forEach(tag => {
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
            let match;
            while ((match = regex.exec(content)) !== null) {
                // match[1] 是捕获组，即标签内部的纯内容
                keptText.push(match[1]);
            }
        });
        // 将提取出的多个标签内容合并
        result = keptText.join('<br><br>');
    }

    return result;
}

function showExportMenu() {
    const selectedElements = $('.chat-export-checkbox:checked');
    if (selectedElements.length === 0) {
        alert("未选择任何消息，已退出导出模式。");
        cleanup();
        return;
    }

    // 1. 询问过滤设置
    const tagsInput = prompt("请输入需要处理的标签名（如 thinking,note，多个用逗号分隔）。\n如果不处理，请直接点击确定或取消留空：");
    let filterMode = null;
    if (tagsInput) {
        filterMode = prompt("请选择标签处理模式：\n1 = 去除标签及内部文字\n2 = 仅导出标签内部文字");
    }

    // 2. 提取并清洗消息
    const selectedMessages = [];
    selectedElements.each(function() {
        const mesElement = $(this).closest('.mes');
        const name = mesElement.attr('ch_name');

        let rawText = mesElement.find('.mes_text').text();
        let rawHtml = mesElement.find('.mes_text').html();

        // 对文本和HTML都进行清洗
        let processedText = processContent(rawText, tagsInput, filterMode);
        let processedHtml = processContent(rawHtml, tagsInput, filterMode);

        // 如果清洗后内容为空（比如选择了仅保留，但该段落没有标签），则跳过该条消息
        if (processedText.trim() !== "") {
            selectedMessages.push({ name, text: processedText, html: processedHtml });
        }
    });

    if (selectedMessages.length === 0) {
        alert("经过标签过滤后，没有剩下任何内容可导出。");
        cleanup();
        return;
    }

    // 3. 询问导出格式
    const exportType = prompt("请输入导出格式：\n输入 'txt' 导出文本\n输入 'img' 导出图片");

    if (exportType === 'txt') {
        exportToTxt(selectedMessages);
        cleanup();
    } else if (exportType === 'img') {
        const bgType = prompt("请输入背景颜色：\n1 = 白底\n2 = 黑底\n3 = 浅黄便签");
        let bgClass = 'export-bg-white';
        if (bgType === '2') bgClass = 'export-bg-black';
        if (bgType === '3') bgClass = 'export-bg-yellow';
        exportToImage(selectedMessages, bgClass);
    } else {
        cleanup();
    }
}

function exportToTxt(messages) {
    let content = "";
    messages.forEach(msg => {
        // 将 HTML 的 <br> 转换回换行符，以防过滤模式2产生了 <br>
        let cleanText = msg.text.replace(/<br>/gi, '\n');
        content += `${msg.name}: \n${cleanText}\n\n`;
    });
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "chat_export.txt";
    link.click();
}

async function exportToImage(messages, bgClass) {
    await loadHtml2Canvas();

    const container = $('<div id="export-canvas-container"></div>').addClass(bgClass);
    messages.forEach(msg => {
        container.append(`<div><strong>${msg.name}</strong><br>${msg.html}<br><br></div>`);
    });
    $('body').append(container);

    html2canvas(container[0]).then(canvas => {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "chat_export.png";
        link.click();

        container.remove();
        cleanup();
    });
}

function cleanup() {
    $('.chat-export-checkbox').remove();
    isSelectionMode = false;
}

jQuery(async () => {
    const exportBtn = $(`<div id="chat-export-btn" class="fa-solid fa-camera extensionsMenuExtensionButton" title="导出聊天记录"></div>`);
    exportBtn.on('click', toggleSelectionMode);
    $('#extensionsMenu').prepend(exportBtn);
});
