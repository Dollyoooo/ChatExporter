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

function processContent(content, tagsInput, filterMode) {
    if (!tagsInput) return content;
    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
    if (tags.length === 0) return content;

    let result = content;

    if (filterMode === '1') {
        tags.forEach(tag => {
            const regex = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi');
            result = result.replace(regex, '');
        });
    } else if (filterMode === '2') {
        let keptText = [];
        tags.forEach(tag => {
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
            let match;
            while ((match = regex.exec(content)) !== null) {
                keptText.push(match[1]);
            }
        });
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

    const tagsInput = prompt("请输入需要处理的标签名（如 thinking,note，多个用逗号分隔）。\n如果不处理，请直接点击确定或取消留空：");
    let filterMode = null;
    if (tagsInput) {
        filterMode = prompt("请选择标签处理模式：\n1 = 去除标签及内部文字\n2 = 仅导出标签内部文字");
    }

    const selectedMessages = [];
    selectedElements.each(function() {
        const mesElement = $(this).closest('.mes');
        const name = mesElement.attr('ch_name');

        let rawText = mesElement.find('.mes_text').text();
        let rawHtml = mesElement.find('.mes_text').html();

        let processedText = processContent(rawText, tagsInput, filterMode);
        let processedHtml = processContent(rawHtml, tagsInput, filterMode);

        if (processedText.trim() !== "") {
            selectedMessages.push({ name, text: processedText, html: processedHtml });
        }
    });

    if (selectedMessages.length === 0) {
        alert("经过标签过滤后，没有剩下任何内容可导出。");
        cleanup();
        return;
    }

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
    // 为了防止重复加载，先移除可能存在的旧按钮
    $('#chat-export-btn').remove();

    // 创建一个纯净的按钮，不再使用酒馆菜单的类名
    const exportBtn = $(`<div id="chat-export-btn" class="fa-solid fa-camera" title="点击导出聊天记录"></div>`);
    exportBtn.on('click', toggleSelectionMode);

    // 直接将按钮挂载到网页的最外层主体(body)上，避免被其他菜单遮挡
    $('body').append(exportBtn);
});

