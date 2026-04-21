document.getElementById('extractBtn').addEventListener('click', async () => {
    console.log("点击按钮")

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // 2. 获取该标签页的 URL（需要扩展拥有 "tabs" 权限）
    const currentUrl = tab.url;
    console.log('目前url:${currentUrl}')

    // 3. 根据 URL 中包含的域名选择对应的提取函数
    let extractFunc = null;

    if (currentUrl.includes('deepseek')) {
        console.log("当前界面deepseek")
        extractFunc = extractSpecificChat_deepseek;      // 自定义的 DeepSeek 提取函数
    } else if (currentUrl.includes('chatglm')) {
        console.log("当前界面chatglm")
        extractFunc = extractSpecificChat_zhipu;       // 自定义的 ChatGLM 提取函数
    } else if (currentUrl.includes('xiaomimimo')) {
        console.log("当前界面xiaomimimo")

        extractFunc = extractSpecificChat_xiaomimimo;    // 自定义的小米米墨提取函数
    } else if (currentUrl.includes('qianwen')) {
        console.log("当前界面qianwen")

        extractFunc = extractSpecificChat_qianwen;       // 自定义的千问提取函数
    } else {
        throw new Error('不支持的聊天页面，请检查域名是否包含 deepseek/chatglm/xiaomimimo/qianwen');
    }

    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractFunc
    });

    const extractedText = results[0].result;

    // 存入缓存
    await chrome.storage.local.set({ "editorText": extractedText });

    // 打开全屏编辑器
    chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
    window.close();
});




// 专为你当前网站定制的精准提取逻辑
function extractSpecificChat_zhipu() {
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
                prefix = node.classList.contains('question-text-style') ? 'liaoyi提问：\n' : 'ailinyi回答：\n';
            } else {
                if (!text.startsWith('liaoyi')) {
                    prefix = 'liaoyi提问：\n';
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
    console.log('finalText:' + finalText);
    return finalText;
}
// 专为你当前网站定制的精准提取逻辑 —— 小米 MiMo Studio 示例版
function extractSpecificChat_xiaomimimo() {
    // 1. 精准抓取用户的提问
    const userMsgs = document.querySelectorAll('.bg-mimo-bg-message');
    console.log(userMsgs)
    // 2. 精准抓取大模型的回复
    // 靠这个提取ai的话
    const aiNodes = document.querySelectorAll('.markdown-prose');
    console.log(aiNodes)
    //对过滤后的每个节点，删除其子树中带属性 '.container-jWOenb' 的元素
    // 删除所有带 .container-jWOenb 属性的元素（包括思考区域）

    aiNodes.forEach(node => {
        const thinkElements = node.querySelectorAll('.mb-2');
         thinkElements.forEach(el => el.remove());
    });
    console.log(aiNodes)

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
    console.log(allMessages);

    let finalText = "";

    // 5. 按排好的顺序提取纯文本
    let isFirstNode = true; // 标志变量，用于判断是否是第一个节点

    allMessages.forEach(node => {
        let text = node.innerText.trim();
        if (text) {
            let prefix = ""; // 默认不加前缀

            if (!isFirstNode) {
                prefix = node.classList.contains('bg-mimo-bg-message') ? 'liaoyi提问：\n' : 'ailinyi回答：\n';
            } else {
                if (!text.startsWith('liaoyi')) {
                    prefix = 'liaoyi提问：\n';
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
    console.log('finalText:' + finalText);
    return finalText;
}
// 专为deepseek网站定制的精准提取逻辑
function extractSpecificChat_deepseek() {
    // 1. 精准抓取用户的提问
    const userMsgs = document.querySelectorAll('.fbb737a4');
    // console.log(userMsgs)
    // 2. 精准抓取大模型的回复  这个抓到的aiMsgs是包含用户的话的，但是用户的话属性包含d29f3d7d，ai的没有，
    // 靠这个提取ai的话
    const aiAndUserMsgs = document.querySelectorAll('.ds-message');
    console.log(aiAndUserMsgs)
    const aiNodes = Array.from(aiAndUserMsgs).filter(node => !node.classList.contains('d29f3d7d'));
    // console.log(aiNodes)
    //对过滤后的每个节点，删除其子树中带属性 '_74c0879' 的元素
    // 删除所有带 _74c0879 属性的元素（包括思考区域）
    // 对过滤后的每个节点，删除其子树中带属性 '_74c0879' 的元素
    aiNodes.forEach(node => {
        const thinkElements = node.querySelectorAll('[_74c0879]');
        thinkElements.forEach(el => el.remove());
    });
    // console.log(aiNodes)

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
                prefix = node.classList.contains('fbb737a4') ? 'liaoyi提问：\n' : 'ailinyi回答：\n';
            } else {
                if (!text.startsWith('liaoyi')) {
                    prefix = 'liaoyi提问：\n';
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
    console.log('finalText:' + finalText);
    return finalText;
}

// 专为qianwen网站定制的精准提取逻辑
function extractSpecificChat_qianwen() {
    // 1. 精准抓取用户的提问
    const userMsgs = document.querySelectorAll('.bubble-VIVxZ8');
    console.log(userMsgs)
    // 2. 精准抓取大模型的回复
    // 靠这个提取ai的话
    const aiNodes = document.querySelectorAll('[data-msgid$="-answer"]');
    console.log(aiNodes)
    //对过滤后的每个节点，删除其子树中带属性 '.container-jWOenb' 的元素
    // 删除所有带 .container-jWOenb 属性的元素（包括思考区域）

    aiNodes.forEach(node => {
        const thinkElements = node.querySelectorAll('.container-jWOenb');
         thinkElements.forEach(el => el.remove());
    });
    console.log(aiNodes)

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
    console.log(allMessages);

    let finalText = "";

    // 5. 按排好的顺序提取纯文本
    let isFirstNode = true; // 标志变量，用于判断是否是第一个节点

    allMessages.forEach(node => {
        let text = node.innerText.trim();
        if (text) {
            let prefix = ""; // 默认不加前缀

            if (!isFirstNode) {
                prefix = node.classList.contains('bubble-VIVxZ8') ? 'liaoyi提问：\n' : 'ailinyi回答：\n';
            } else {
                if (!text.startsWith('liaoyi')) {
                    prefix = 'liaoyi提问：\n';
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
    console.log('finalText:' + finalText);
    return finalText;
}