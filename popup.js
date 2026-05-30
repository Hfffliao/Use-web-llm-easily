import logger from './logger.js';

document.addEventListener('DOMContentLoaded', async () => {

    document.getElementById('extractBtn').addEventListener('click', async () => {
        logger.info("点击按钮")
        try {
            extractMsg();
        } catch (error) {
            logger.error("配置检查出错:", error);
            alert("配置检查失败，请重试");
        }

    });
   
document.getElementById('usageBtn').addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("help.html")
    });
    window.close();
  });

    // 新增：处理配置表单提交
    // document.getElementById('saveConfigBtn').addEventListener('click', async () => {

    // });
});
async function extractMsg() {
    // 获取存储值
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // 2. 获取该标签页的 URL（需要扩展拥有 "tabs" 权限）
    const currentUrl = tab.url;

    // 3. 根据 URL 中包含的域名选择对应的提取函数
    let extractFunc = null;
    let newAiName = '';
    if (currentUrl.includes('deepseek')) {
        extractFunc = extractSpecificChat_deepseek;
        newAiName = 'deepseek';    // 自定义的 DeepSeek 提取函数
    } else if (currentUrl.includes('chatglm')) {
        extractFunc = extractSpecificChat_zhipu;
        newAiName = 'chatglm';       // 自定义的 ChatGLM 提取函数
    } else if (currentUrl.includes('xiaomimimo')) {
        extractFunc = extractSpecificChat_xiaomimimo;
        newAiName = 'xiaomimimo';
    } else if (currentUrl.includes('qianwen')) {
        extractFunc = extractSpecificChat_qianwen;
        newAiName = 'qianwen';        // 自定义的千问提取函数

    } else if (currentUrl.includes('doubao.com')) {
        extractFunc = extractSpecificChat_doubao;
        newAiName = 'doubao';

    } else {
        throw new Error('不支持的聊天页面，请检查域名是否包含 deepseek/chatglm/xiaomimimo/qianwen');
    }
    //将模型名保存到配置
    const newUserName = 'User';
    if (newUserName && newAiName) {
        // 保存到存储
        await chrome.storage.local.set({
            "UserName": newUserName,
            "AiName": newAiName
        });


    } else {
        alert("用户名和AI名称不能为空");
    }
    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractFunc,
        args: [newUserName, newAiName, false]   // ✅ 关键：将用户名和 AI 名作为参数传入
    });

    const extractedText = results[0].result;

    // 存入缓存
    await chrome.storage.local.set({ "editorText": extractedText });

    // 打开全屏编辑器
    chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
    window.close();
}




// 专为你智普网站定制的精准提取逻辑
function extractSpecificChat_zhipu(UserName, AiName, ifLog) {
    function log(...args) {
        if (ifLog) {
            console.log(...args);
        }
    }
    // 1. 精准抓取用户的提问
    const userMsgs = document.querySelectorAll('.pr.question-text-style');
    // 2. 精准抓取大模型的回复
    const aiMsgs = document.querySelectorAll('.answer-content-wrap');

    // 3. 把它们合并到一个数组里
    const allMessages = [...userMsgs, ...aiMsgs];

    // 4. 核心步骤：按照它们在网页中原本的从上到下的顺序进行排序
    // 这样就能保证“提问1 -> 回答1 -> 提问2 -> 回答2”的顺序不会乱
    allMessages.sort((a, b) => {
        const position = a.compareDocumentPosition(b);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1; // a 在 b 前面
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;   // a 在 b 后面
        return 0;
    });

    let finalText = "";

    // 5. 按排好的顺序提取纯文本
    let isFirstNode = true; // 标志变量，用于判断是否是第一个节点

    allMessages.forEach(node => {
        let text = "";

        if (node.classList.contains('answer-content-wrap')) {
            if (node.classList.contains('text-advance-thinking-content')) {
                return; // 跳过“思考”块
            }
            text = node.innerText.trim();
        } else {
            text = node.innerText.trim();
        }

        if (text) {
            let prefix = ""; // 默认不加前缀

            if (!isFirstNode) {
                prefix = node.classList.contains('question-text-style') ? `${UserName}：\n` : `${AiName}：\n`;
            } else {
                if (!text.startsWith(UserName)) {
                    prefix = `${UserName}：\n`;
                }
            }

            finalText += prefix + text + "\n\n-------------------\n\n";
            isFirstNode = false; // 第一个有效节点已处理
        }
    });

    // 6. 兜底方案
    if (finalText.trim() === "") {
        finalText = window.getSelection().toString();
    }
    return finalText;
}
// 专为当前网站定制的精准提取逻辑 —— 小米 MiMo版
function extractSpecificChat_xiaomimimo(UserName, AiName, ifLog) {
    function log(...args) {
        if (ifLog) {
            console.log(...args);
        }
    }
    // 1. 精准抓取用户的提问
    const userMsgs = document.querySelectorAll('.bg-mimo-bg-message');
    // 2. 精准抓取大模型的回复
    // 靠这个提取ai的话
    const aiNodes = document.querySelectorAll('.markdown-prose');
    //对过滤后的每个节点，删除其子树中带属性 '.container-jWOenb' 的元素
    // 删除所有带 .container-jWOenb 属性的元素（包括思考区域）

    aiNodes.forEach(node => {
        const thinkElements = node.querySelectorAll('.mb-2');
        thinkElements.forEach(el => el.remove());
    });

    //ai的话包含思考，子树有_74c0879独特属性，去除这些属性的就是ai的回答


    // 3. 把它们合并到一个数组里
    const allMessages = [...userMsgs, ...aiNodes];

    // 4. 核心步骤：按照它们在网页中原本的从上到下的顺序进行排序
    // 这样就能保证“提问1 -> 回答1 -> 提问2 -> 回答2”的顺序不会乱
    allMessages.sort((a, b) => {
        const position = a.compareDocumentPosition(b);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1; // a 在 b 前面
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;   // a 在 b 后面
        return 0;
    });

    let finalText = "";

    // 5. 按排好的顺序提取纯文本
    let isFirstNode = true; // 标志变量，用于判断是否是第一个节点

    allMessages.forEach(node => {
        let text = node.innerText.trim();
        if (text) {
            let prefix = ""; // 默认不加前缀

            if (!isFirstNode) {
                prefix = node.classList.contains('bg-mimo-bg-message') ? `${UserName}：\n` : `${AiName}：\n`;
            } else {
                if (!text.startsWith(UserName)) {
                    prefix = `${UserName}：\n`;
                }
            }

            finalText += prefix + text + "\n\n-------------------\n\n";
            isFirstNode = false; // 第一个有效节点已处理
        }
    });

    // 6. 兜底方案
    if (finalText.trim() === "") {
        finalText = window.getSelection().toString();
    }
    return finalText;
}
// 专为deepseek网站定制的精准提取逻辑
function extractSpecificChat_deepseek(UserName, AiName, ifLog) {
    function log(...args) {
        if (ifLog) {
            console.log(...args);
        }
    }
    // 1. 精准抓取用户的提问
    const userMsgs = document.querySelectorAll('.fbb737a4');
    log(userMsgs);
    // 2. 精准抓取大模型的回复  这个抓到的aiMsgs是包含用户的话的，但是用户的话属性包含d29f3d7d，ai的没有，
    // 靠这个提取ai的话
    const aiAndUserMsgs = document.querySelectorAll('.ds-message');
    log(aiAndUserMsgs)
    const aiNodes = Array.from(aiAndUserMsgs).filter(node => !node.classList.contains('d29f3d7d'));
    log(aiNodes)
    //对过滤后的每个节点，删除其子树中带属性 '_74c0879' 的元素
    // 删除所有带 _74c0879 属性的元素（包括思考区域）
    // 对过滤后的每个节点，删除其子树中带属性 '_74c0879' 的元素
    aiNodes.forEach(node => {
        const thinkElements = node.querySelectorAll('.ds-think-content');
        log(thinkElements)
        thinkElements.forEach(el => el.remove());
    });
    log(aiNodes)
    //ai的话包含思考，子树有_74c0879独特属性，去除这些属性的就是ai的回答


    // 3. 把它们合并到一个数组里
    const allMessages = [...userMsgs, ...aiNodes];

    // 4. 核心步骤：按照它们在网页中原本的从上到下的顺序进行排序
    // 这样就能保证“提问1 -> 回答1 -> 提问2 -> 回答2”的顺序不会乱
    allMessages.sort((a, b) => {
        const position = a.compareDocumentPosition(b);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1; // a 在 b 前面
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;   // a 在 b 后面
        return 0;
    });

    let finalText = "";

    // 5. 按排好的顺序提取纯文本
    let isFirstNode = true; // 标志变量，用于判断是否是第一个节点

    allMessages.forEach(node => {
        let text = node.innerText.trim();
        if (text) {
            let prefix = ""; // 默认不加前缀

            if (!isFirstNode) {
                prefix = node.classList.contains('fbb737a4') ? `${UserName}：\n` : `${AiName}：\n`;
            } else {
                if (!text.startsWith(UserName)) {
                    prefix = `${UserName}：\n`;
                }
            }

            finalText += prefix + text + "\n\n-------------------\n\n";
            isFirstNode = false; // 第一个有效节点已处理
        }
    });

    // 6. 兜底方案
    if (finalText.trim() === "") {
        finalText = window.getSelection().toString();
    }
    log('finalText:' + finalText);
    return finalText;
}

// 专为qianwen网站定制的精准提取逻辑
function extractSpecificChat_qianwen(UserName, AiName, ifLog) {
    function log(...args) {
        if (ifLog) {
            console.log(...args);
        }
    }
    // 1. 精准抓取用户的提问
    const userMsgs = document.querySelectorAll('.bubble-VIVxZ8');
    // 2. 精准抓取大模型的回复
    // 靠这个提取ai的话
    const aiNodes = document.querySelectorAll('[data-msgid$="-answer"]');
    //对过滤后的每个节点，删除其子树中带属性 '.container-jWOenb' 的元素
    // 删除所有带 .container-jWOenb 属性的元素（包括思考区域）

    aiNodes.forEach(node => {
        const thinkElements = node.querySelectorAll('.container-jWOenb');
        thinkElements.forEach(el => el.remove());
    });

    //ai的话包含思考，子树有_74c0879独特属性，去除这些属性的就是ai的回答


    // 3. 把它们合并到一个数组里
    const allMessages = [...userMsgs, ...aiNodes];

    // 4. 核心步骤：按照它们在网页中原本的从上到下的顺序进行排序
    // 这样就能保证“提问1 -> 回答1 -> 提问2 -> 回答2”的顺序不会乱
    allMessages.sort((a, b) => {
        const position = a.compareDocumentPosition(b);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1; // a 在 b 前面
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;   // a 在 b 后面
        return 0;
    });

    let finalText = "";

    // 5. 按排好的顺序提取纯文本
    let isFirstNode = true; // 标志变量，用于判断是否是第一个节点

    allMessages.forEach(node => {
        let text = node.innerText.trim();
        if (!text) {
            text = node.innerHTML.trim();
        }
        if (text) {
            let prefix = ""; // 默认不加前缀

            if (!isFirstNode) {
                prefix = node.classList.contains('bubble-VIVxZ8') ? `${UserName}：\n` : `${AiName}：\n`;
            } else {
                if (!text.startsWith(UserName)) {
                    prefix = `${UserName}：\n`;
                }
            }
            finalText += prefix + text + "\n\n-------------------\n\n";
            isFirstNode = false; // 第一个有效节点已处理
        }
    });

    // 6. 兜底方案
    if (finalText.trim() === "") {
        finalText = window.getSelection().toString();
    }
    return finalText;
}

// 豆包 Web 聊天记录提取函数：重叠窗口合并 + 底部强制补抓版
// 重点修复：
// 1. 虚拟列表顶部 / 中间顺序偶尔错乱
// 2. 最底部最后一条消息漏抓
// 3. 新版豆包 receive-message-box:text 回复结构
// 4. flow-markdown-body / mdbox-theme-next 正文容器
async function extractSpecificChat_doubao(UserName = '用户', AiName = '豆包', ifLog = false) {
    function log(...args) {
        if (ifLog) console.log(...args);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function cleanText(text) {
        return (text || '')
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function removeNoise(root) {
        if (!root) return;

        const selectors = [
            // 思考 / 推理
            '[data-plugin-identifier*="think" i]',
            '[data-plugin-identifier*="reason" i]',
            '[data-testid*="think" i]',
            '[data-testid*="reason" i]',
            '[class*="think" i]',
            '[class*="thinking" i]',
            '[class*="reason" i]',
            '[class*="reasoning" i]',
            '[class*="cot" i]',
            '[aria-label*="思考"]',
            '[aria-label*="推理"]',
            '[aria-label*="深度思考"]',

            // 搜索资料 / 引用资料
            '[data-plugin-identifier*="search_query_result_block"]',
            '[data-plugin-identifier*="block_type:10025"]',
            '[data-plugin-identifier*="reference" i]',
            '[data-plugin-identifier*="citation" i]',

            // 操作栏
            '[data-foundation-type*="action-bar"]',
            '[data-foundation-type*="message-action-bar"]',
            '[data-foundation-type="send-message-action-bar"]',
            '[data-foundation-type="receive-message-action-bar"]',
            '.message-action-bar-raqbg0',
            '.message-action-button-main',
            '.message-action-button-third',
            '[class*="message-action"]',
            '[data-dbx-name="button"]',

            // 媒体 / 图标 / 按钮
            '.carousel',
            '[class*="carousel"]',
            '.semi-image-preview-group',
            '[class*="image-wrapper"]',
            '[class*="image-container"]',
            '[class*="skeleton"]',
            'picture',
            'img',
            'video',
            'canvas',
            'button',
            'svg'
        ];

        selectors.forEach(selector => {
            root.querySelectorAll(selector).forEach(el => el.remove());
        });

        // 兜底删除短标题型思考块
        root.querySelectorAll('div, section, details').forEach(el => {
            const t = cleanText(el.innerText);
            if (
                t &&
                t.length <= 100 &&
                /^(思考|思考过程|深度思考|推理|推理过程|已深度思考|正在思考)/.test(t)
            ) {
                el.remove();
            }
        });
    }

    function isBadText(text) {
        const t = cleanText(text);
        if (!t) return true;

        return (
            /^找到\s*\d+\s*篇资料参考/.test(t) ||
            /^资料参考$/.test(t) ||
            /^参考资料$/.test(t) ||
            /^引用资料$/.test(t) ||
            /^复制$/.test(t) ||
            /^朗读$/.test(t) ||
            /^重新生成$/.test(t)
        );
    }

    function extractTextFromNode(node) {
        if (!node) return '';

        const clone = node.cloneNode(true);
        removeNoise(clone);

        return cleanText(clone.innerText);
    }

    function extractDoubaoAiText(root) {
        if (!root) return '';

        const texts = [];

        const contentBlockSelector = [
            '[data-plugin-identifier*="receive-message-box:text"]',
            '[data-plugin-identifier*="block_type:10000"]',
            '[data-container-type="box"][data-plugin-identifier*="receive-message"]'
        ].join(',');

        const markdownSelector = [
            '.flow-markdown-body',
            '.mdbox-theme-next',
            '.md-box-root',
            '.container-qX9Csx.md-box-root',
            '[class*="flow-markdown-body"]',
            '[class*="mdbox-theme"]'
        ].join(',');

        // 1. 优先从 AI 正文 block 提取
        const contentBlocks = Array.from(root.querySelectorAll(contentBlockSelector));

        contentBlocks.forEach(block => {
            if (
                block.closest('[data-plugin-identifier*="search_query_result_block"]') ||
                block.closest('[data-plugin-identifier*="block_type:10025"]')
            ) {
                return;
            }

            const sourceNode = block.querySelector(markdownSelector) || block;
            const text = extractTextFromNode(sourceNode);

            if (!isBadText(text)) {
                texts.push(text);
            }
        });

        // 2. 兜底 Markdown 容器
        if (texts.length === 0) {
            const mdRoots = Array.from(root.querySelectorAll(markdownSelector)).filter(node => {
                return !node.closest('[data-plugin-identifier*="search_query_result_block"]') &&
                    !node.closest('[data-plugin-identifier*="block_type:10025"]') &&
                    !node.closest('[data-foundation-type*="action-bar"]') &&
                    !node.closest('[class*="message-action"]');
            });

            mdRoots.forEach(node => {
                const text = extractTextFromNode(node);

                if (!isBadText(text)) {
                    texts.push(text);
                }
            });
        }

        // 3. 最后兜底接收消息盒子
        if (texts.length === 0) {
            const receiveBox = root.querySelector(
                '[data-plugin-identifier*="receive-message"], [data-container-type="box"]'
            );

            if (receiveBox) {
                const text = extractTextFromNode(receiveBox);

                if (!isBadText(text)) {
                    texts.push(text);
                }
            }
        }

        return cleanText(texts.join('\n\n'));
    }

    function getScrollableCandidates() {
        const all = [
            document.scrollingElement,
            document.documentElement,
            document.body,
            ...document.querySelectorAll('main, section, div')
        ].filter(Boolean);

        const unique = Array.from(new Set(all));

        return unique
            .filter(el => {
                const style = window.getComputedStyle(el);
                const overflowY = style.overflowY;

                return (
                    el.scrollHeight > el.clientHeight + 200 &&
                    ['auto', 'scroll', 'overlay', 'visible'].includes(overflowY)
                );
            })
            .map(el => {
                const hasMessage = !!el.querySelector?.('[data-message-id], .v_list_row');

                return {
                    el,
                    score: el.scrollHeight + el.clientHeight + (hasMessage ? 100000000 : 0),
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight
                };
            })
            .sort((a, b) => b.score - a.score);
    }

    function findMainScrollContainer() {
        const candidates = getScrollableCandidates();

        log('doubao scroll candidates:', candidates.map(item => ({
            tag: item.el.tagName,
            className: item.el.className,
            id: item.el.id,
            scrollHeight: item.scrollHeight,
            clientHeight: item.clientHeight,
            score: item.score
        })));

        return candidates[0]?.el || document.scrollingElement || document.documentElement || document.body;
    }

    const scroller = findMainScrollContainer();
    const originalScrollTop = scroller.scrollTop;

    // 全局消息表：存消息内容
    const messageMap = new Map();
    function getMessageAbsoluteY(root) {
    const row = root.closest('.v_list_row') || root;

    const rowRect = row.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();

    // 关键：
    // row 相对滚动容器顶部的位置 + 当前滚动距离 = 在完整滚动内容里的绝对位置
    const absoluteY = scroller.scrollTop + rowRect.top - scrollerRect.top;

    if (Number.isFinite(absoluteY)) {
        return absoluteY;
    }

    return Number.POSITIVE_INFINITY;
}

    // 全局顺序数组：只存 id
    const messageSequence = [];

    function getRootVisualY(root) {
        const row = root.closest('.v_list_row') || root;
        const rect = row.getBoundingClientRect();
        return rect.top;
    }

    function getFallbackSortY(root) {
        const row = root.closest('.v_list_row');

        if (!row) {
            const rect = root.getBoundingClientRect();
            return rect.top + (scroller.scrollTop || window.scrollY || 0);
        }

        const inlineY = row.style.getPropertyValue('--vlist-row-transform-y');
        if (inlineY) {
            const n = parseFloat(inlineY);
            if (!Number.isNaN(n)) return n;
        }

        const styleText = row.getAttribute('style') || '';
        const varMatch = styleText.match(/--vlist-row-transform-y\s*:\s*([-\d.]+)px/);
        if (varMatch) {
            const n = parseFloat(varMatch[1]);
            if (!Number.isNaN(n)) return n;
        }

        const computedTransform = window.getComputedStyle(row).transform;
        if (computedTransform && computedTransform !== 'none') {
            const matrixMatch = computedTransform.match(/matrix\(([^)]+)\)/);
            if (matrixMatch) {
                const parts = matrixMatch[1].split(',').map(v => parseFloat(v.trim()));
                if (parts.length >= 6 && !Number.isNaN(parts[5])) {
                    return parts[5];
                }
            }

            const matrix3dMatch = computedTransform.match(/matrix3d\(([^)]+)\)/);
            if (matrix3dMatch) {
                const parts = matrix3dMatch[1].split(',').map(v => parseFloat(v.trim()));
                if (parts.length >= 16 && !Number.isNaN(parts[13])) {
                    return parts[13];
                }
            }
        }

        const rect = row.getBoundingClientRect();
        return rect.top + (scroller.scrollTop || window.scrollY || 0);
    }

    function extractOneMessage(root) {
        const messageId = root.getAttribute('data-message-id');
        if (!messageId) return null;

        let role = '';
        let text = '';

        const userNode = root.querySelector(
            [
                '.bg-g-send-msg-bubble-bg',
                '[class*="send-msg-bubble"]',
                '[data-plugin-identifier*="send-message-box"]',
                '[data-plugin-identifier*="send-message"]'
            ].join(',')
        );

        if (userNode) {
            text = extractTextFromNode(userNode);
            if (!isBadText(text)) role = 'user';
        } else {
            text = extractDoubaoAiText(root);
            if (!isBadText(text)) role = 'ai';
        }

        if (!role || !text) return null;

     return {
    id: messageId,
    role,
    text,
    absoluteY: getMessageAbsoluteY(root),
    fallbackSortY: getFallbackSortY(root),
    visualY: getRootVisualY(root)
};
    }

    function getCurrentViewportMessages() {
    const roots = Array.from(document.querySelectorAll('[data-message-id]'))
        .sort((a, b) => getMessageAbsoluteY(a) - getMessageAbsoluteY(b));

    const list = [];

    roots.forEach(root => {
        const msg = extractOneMessage(root);
        if (!msg) return;

        if (!list.some(x => x.id === msg.id)) {
            list.push(msg);
        }
    });

    return list;
}

    function indexOfSubsequence(sequence, sub) {
        if (!sub.length || sub.length > sequence.length) return -1;

        for (let i = 0; i <= sequence.length - sub.length; i++) {
            let ok = true;

            for (let j = 0; j < sub.length; j++) {
                if (sequence[i + j] !== sub[j]) {
                    ok = false;
                    break;
                }
            }

            if (ok) return i;
        }

        return -1;
    }

    function longestOverlapSuffixPrefix(a, b) {
        // 找 a 的后缀和 b 的前缀的最长重叠
        const max = Math.min(a.length, b.length);

        for (let len = max; len >= 1; len--) {
            let ok = true;

            for (let i = 0; i < len; i++) {
                if (a[a.length - len + i] !== b[i]) {
                    ok = false;
                    break;
                }
            }

            if (ok) return len;
        }

        return 0;
    }

    function mergeViewportMessages(viewMessages) {
        if (!viewMessages.length) return;

        // 先更新 messageMap
        viewMessages.forEach(msg => {
            const old = messageMap.get(msg.id);

           if (!old) {
    messageMap.set(msg.id, {
        ...msg,
        ySamples: Number.isFinite(msg.absoluteY) ? [msg.absoluteY] : []
    });
} else {
    if (msg.text.length > old.text.length) {
        old.text = msg.text;
        old.role = msg.role;
    }

    old.fallbackSortY = msg.fallbackSortY;
    old.visualY = msg.visualY;

    if (Number.isFinite(msg.absoluteY)) {
        if (!old.ySamples) old.ySamples = [];
        old.ySamples.push(msg.absoluteY);

        // 防止采样数组无限增长
        if (old.ySamples.length > 10) {
            old.ySamples.shift();
        }

        // 用最新采样更新 absoluteY
        old.absoluteY = msg.absoluteY;
    }
}
        });

        const ids = viewMessages.map(m => m.id);

        if (messageSequence.length === 0) {
            messageSequence.push(...ids);
            return;
        }

        // 如果当前窗口整体已经是全局序列的子序列，说明只是重复采集
        const existingIndex = indexOfSubsequence(messageSequence, ids);
        if (existingIndex !== -1) {
            return;
        }

        // 找当前窗口与全局序列尾部的重叠
        const overlap = longestOverlapSuffixPrefix(messageSequence, ids);

        if (overlap > 0) {
            const appendIds = ids.slice(overlap);
            appendIds.forEach(id => {
                if (!messageSequence.includes(id)) {
                    messageSequence.push(id);
                }
            });
            return;
        }

        // 如果没有尾部重叠，尝试用当前窗口里任意已存在的 id 做锚点插入
        let anchorInView = -1;
        let anchorInSeq = -1;

        for (let i = 0; i < ids.length; i++) {
            const idx = messageSequence.indexOf(ids[i]);
            if (idx !== -1) {
                anchorInView = i;
                anchorInSeq = idx;
                break;
            }
        }

        if (anchorInView !== -1) {
            const before = ids.slice(0, anchorInView).filter(id => !messageSequence.includes(id));
            const after = ids.slice(anchorInView + 1).filter(id => !messageSequence.includes(id));

            // before 插在锚点前
            if (before.length) {
                messageSequence.splice(anchorInSeq, 0, ...before);
                anchorInSeq += before.length;
            }

            // after 插在锚点后
            if (after.length) {
                messageSequence.splice(anchorInSeq + 1, 0, ...after);
            }

            return;
        }

        // 最后兜底：没有任何重叠，说明步子可能跳太大了。
        // 这里按滚动方向追加，至少不丢。
        ids.forEach(id => {
            if (!messageSequence.includes(id)) {
                messageSequence.push(id);
            }
        });
    }

    function collectCurrentViewport() {
        const viewMessages = getCurrentViewportMessages();
        mergeViewportMessages(viewMessages);

        log('viewport ids:', viewMessages.map(m => m.id));
        log('doubao collected message count:', messageMap.size);
        log('doubao sequence count:', messageSequence.length);
    }

    async function scrollToRealTopOnly() {
        let stableCount = 0;
        let lastTop = -1;
        let lastHeight = -1;

        for (let i = 0; i < 100; i++) {
            scroller.scrollTop = 0;
            scroller.dispatchEvent(new Event('scroll', { bubbles: true }));

            await sleep(240);

            const nowTop = scroller.scrollTop;
            const nowHeight = scroller.scrollHeight;

            const topStable = Math.abs(nowTop - lastTop) < 2 && nowTop <= 2;
            const heightStable = Math.abs(nowHeight - lastHeight) < 2;

            if (topStable && heightStable) {
                stableCount++;
            } else {
                stableCount = 0;
            }

            if (stableCount >= 4) {
                break;
            }

            lastTop = nowTop;
            lastHeight = nowHeight;
        }
    }

    async function scrollToRealBottomAndCollect() {
        // 重点修复：最下面一条消息没收集到
        // 连续多次滚到底，并且每次都采集，直到 scrollTop / scrollHeight 稳定
        let stableCount = 0;
        let lastTop = -1;
        let lastHeight = -1;
        let lastCount = -1;

        for (let i = 0; i < 40; i++) {
            const maxTop = scroller.scrollHeight - scroller.clientHeight;
            scroller.scrollTop = maxTop;
            scroller.dispatchEvent(new Event('scroll', { bubbles: true }));

            await sleep(260);
            collectCurrentViewport();

            const nowTop = scroller.scrollTop;
            const nowHeight = scroller.scrollHeight;
            const nowCount = messageMap.size;

            const topStable = Math.abs(nowTop - lastTop) < 2;
            const heightStable = Math.abs(nowHeight - lastHeight) < 2;
            const countStable = nowCount === lastCount;

            if (topStable && heightStable && countStable) {
                stableCount++;
            } else {
                stableCount = 0;
            }

            if (stableCount >= 5) {
                break;
            }

            lastTop = nowTop;
            lastHeight = nowHeight;
            lastCount = nowCount;
        }

        // 再补抓几次，处理最后一条异步渲染
        for (let i = 0; i < 8; i++) {
            await sleep(180);
            collectCurrentViewport();
        }
    }

    async function scrollDownAndCollect() {
        const MAX_STEPS = 3000;
        let samePositionCount = 0;

        for (let step = 0; step < MAX_STEPS; step++) {
            collectCurrentViewport();

            const beforeTop = scroller.scrollTop;
            const maxTop = scroller.scrollHeight - scroller.clientHeight;

            if (beforeTop >= maxTop - 3) {
                break;
            }

            // 步长进一步减小，增加窗口重叠，减少顺序错乱
            const stepSize = Math.max(scroller.clientHeight * 0.28, 180);
            const nextTop = Math.min(beforeTop + stepSize, maxTop);

            scroller.scrollTop = nextTop;
            scroller.dispatchEvent(new Event('scroll', { bubbles: true }));

            await sleep(280);
            collectCurrentViewport();

            const afterTop = scroller.scrollTop;

            if (Math.abs(afterTop - beforeTop) < 2) {
                samePositionCount++;
            } else {
                samePositionCount = 0;
            }

            if (samePositionCount >= 8) {
                break;
            }
        }

        // 到底部后强制补抓
        await scrollToRealBottomAndCollect();
    }

   function compareMessageIdAsc(a, b) {
    try {
        const ai = BigInt(a);
        const bi = BigInt(b);

        if (ai < bi) return -1;
        if (ai > bi) return 1;
        return 0;
    } catch (e) {
        return String(a).localeCompare(String(b));
    }
}
function medianNumber(values) {
    const nums = values
        .filter(Number.isFinite)
        .slice()
        .sort((a, b) => a - b);

    if (!nums.length) return Number.POSITIVE_INFINITY;

    const mid = Math.floor(nums.length / 2);

    if (nums.length % 2 === 1) {
        return nums[mid];
    }

    return (nums[mid - 1] + nums[mid]) / 2;
}
function buildFinalMessages() {
    return Array.from(messageMap.values()).sort((a, b) => {
        const ay = medianNumber(a.ySamples || [a.absoluteY]);
        const by = medianNumber(b.ySamples || [b.absoluteY]);

        if (ay !== by) return ay - by;

        // 如果 absoluteY 一样，再用 fallbackSortY 兜底
        const af = Number.isFinite(a.fallbackSortY)
            ? a.fallbackSortY
            : Number.POSITIVE_INFINITY;

        const bf = Number.isFinite(b.fallbackSortY)
            ? b.fallbackSortY
            : Number.POSITIVE_INFINITY;

        if (af !== bf) return af - bf;

        // 最后才用 message-id，注意只是兜底，不作为主排序
        try {
            const ai = BigInt(a.id);
            const bi = BigInt(b.id);

            if (ai < bi) return -1;
            if (ai > bi) return 1;
            return 0;
        } catch {
            return String(a.id).localeCompare(String(b.id));
        }
    });
}

    // 主流程：
    // 1. 先滚到真正顶部，不采集，避免历史消息加载时污染顺序
    await scrollToRealTopOnly();

    // 2. 清空全局数据，从顶部开始重建完整序列
    messageMap.clear();
    messageSequence.length = 0;

    // 3. 顶部先多采几次，避免第一屏未完全渲染
    for (let i = 0; i < 5; i++) {
        await sleep(160);
        collectCurrentViewport();
    }

    // 4. 小步长向下滚动，依靠重叠窗口合并顺序
    await scrollDownAndCollect();

    // 5. 恢复原始滚动位置
    scroller.scrollTop = originalScrollTop;
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }));

    const allMessages = buildFinalMessages();

    let finalText = '';

    allMessages.forEach(msg => {
        const prefix = msg.role === 'user'
            ? `${UserName}：\n`
            : `${AiName}：\n`;

        finalText += prefix + msg.text + '\n\n-------------------\n\n';
    });

    if (finalText.trim() === '') {
        finalText = cleanText(window.getSelection().toString());
    }

    log('doubao final message count:', allMessages.length);
    log('doubao final sequence:', messageSequence);
    log('doubao final messages:', allMessages);
    log('doubao finalText:', finalText);

    return finalText;
}
