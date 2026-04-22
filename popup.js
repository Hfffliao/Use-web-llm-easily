import logger from './logger.js';
let UserName, AiName;

// 封装获取用户信息的函数
async function initUserInfo() {
    const user = await chrome.storage.local.get("UserName");
    const ai = await chrome.storage.local.get("AiName");
    return {
        UserName: user.UserName || '用户',
        AiName: ai.AiName || '助手'
    };
}
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化用户信息
    const userInfo = await initUserInfo();
    UserName = userInfo.UserName;
    AiName = userInfo.AiName;
    console.log(`用户：${UserName}，AI：${AiName}`);

    document.getElementById('extractBtn').addEventListener('click', async () => {
        console.log("点击按钮")
        try {
            console.log("popup加载，检查配置");


            // 检查值是否存在
            if (!UserName || !AiName) {
                console.log("未找到配置，显示表单");
                // 显示表单
                document.getElementById('configForm').style.display = 'block';
                document.getElementById('extractContainer').style.display = 'none';
                document.getElementById('userNameInput').focus();

            } else {
                console.log("已获取到用户名和AI名称");
                // 保持按钮可见
                document.getElementById('extractBtn').style.display = 'block';
                document.getElementById('configForm').style.display = 'none';
                extractMsg();

                // 显示表单
            }
        } catch (error) {
            console.error("配置检查出错:", error);
            alert("配置检查失败，请重试");
        }

    });
    // 新增：处理表单提交
    document.getElementById('saveConfigBtn').addEventListener('click', async () => {
        const newUserName = document.getElementById('userNameInput').value;
        const newAiName = document.getElementById('aiNameInput').value;

        if (newUserName && newAiName) {
            // 保存到存储
            await chrome.storage.local.set({
                "UserName": newUserName,
                "AiName": newAiName
            });
            console.log("用户名和AI名称已保存");

            // 隐藏表单并恢复按钮
            document.getElementById('configForm').style.display = 'none';
            document.getElementById('extractContainer').style.display = 'block';

            // 继续执行原有逻辑
            await processExtraction();
        } else {
            alert("用户名和AI名称不能为空");
        }
    });
});
async function extractMsg() {
    // 获取存储值
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
        func: extractFunc,
        args: [UserName, AiName, true]   // ✅ 关键：将用户名和 AI 名作为参数传入
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
    console.log('finalText:' + finalText);
    return finalText;
}
// 专为你当前网站定制的精准提取逻辑 —— 小米 MiMo版
function extractSpecificChat_xiaomimimo(UserName, AiName, ifLog) {
    function log(...args) {
        if (ifLog) {
            console.log(...args);
        }
    }
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
    console.log('finalText:' + finalText);
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
            console.log('text:' + text);
            finalText += prefix + text + "\n\n-------------------\n\n";
            isFirstNode = false; // 第一个有效节点已处理
        }
    });

    // 6. 兜底方案
    if (finalText.trim() === "") {
        finalText = window.getSelection().toString();
    }
    // console.log('finalText:' + finalText);
    return finalText;
}