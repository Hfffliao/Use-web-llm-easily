import logger from './logger.js';
// ========== 新增：注入左右布局样式 ==========
const style = document.createElement('style');
style.innerHTML = `
  .message-wrapper {
    display: flex;
    margin-bottom: 16px;
    align-items: flex-start;
  }
  .role-label {
    min-width: 80px;
    font-weight: bold;
    padding: 4px 8px;
    text-align: right;
    flex-shrink: 0;
    user-select: none; /* 防止选中角色名 */
    background-color: #f9f9f9;
    border-radius: 4px;
  }
  .user-label { color: #0078d4; }
  .ai-label { color: #107c10; }
  .other-label { color: #666; }
  .msg-content {
    flex-grow: 1;
    padding: 4px 8px;
    margin-left: 8px;
    border-left: 2px solid #e0e0e0;
    white-space: pre-wrap;
    word-break: break-word;
    outline: none;
    min-height: 1em;
  }
     /* 👇 新增这三条 */
  .msg-content.user-label { background-color: #e8f4fd; }
  .msg-content.ai-label  { background-color: #edf7ed; }
  .msg-content.other-label { background-color: #f5f5f5; }
`;
document.head.appendChild(style);

// ========== 新增：单次对话类 ==========
class ChatMessage {
    constructor(role, content, id) {
        this.role = role; // 'user', 'ai', 'other'
        this.content = content; // 纯文本内容//目前留空
        this.id = id; // DOM 对应的 id
    }
}

let chatMessages = []; // 保存所有的对话对象

let UserName, AiName;//定义用户信息

// ==========================================
// 1. DOM 元素获取
// ==========================================
const editor = document.getElementById('editor');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');
const tocList = document.getElementById('tocList');
const charCountEl = document.getElementById('charCount');
//====================================
// 2. 核心工具函数
// ==========================================

// 封装获取用户信息的函数
async function initUserInfo() {
    const user = await chrome.storage.local.get("UserName");
    const ai = await chrome.storage.local.get("AiName");
    return {
        UserName: user.UserName || '用户',
        AiName: ai.AiName || '助手'
    };
}
/** 实时更新右上角的字符数量 */
function updateCharCount() {
    const text = editor.innerText;
    charCountEl.textContent = `字符数：${text.length}`;
}

// ==========================================
// 3. 页面渲染逻辑
// ==========================================

//能处理一个回复里有一条分割线的情况和有连续两条分割线的情况
//连续分割线的致命 Bug：假设文本里出现了两次分割线 ---\n---。你的旧代码里 JudgeTheType(segments[i+1]) 会把第二个分割线误判为 other（因为它不以 liaoyi 开头），导致真正的分割线被吞掉。新代码在 JudgeTheType 里加了 if (texts === sep) return 'separator'，彻底免疫了这个 Bug。
/** 解析长文本并渲染编辑器和目录 */
function buildEditorAndTOC(text, UserName, AiName) {
    const sep = '-------------------';
    const segments = text.split(new RegExp('(' + sep.replace(/-/g, '\\-') + ')', 'g'));

    let editorHTML = '';
    let tocHTML = '';
    let blockIndex = 0;
    chatMessages = []; // 重新构建时清空对象数组

    function JudgeTheType(texts) {
        if (!texts) return { type: 'empty', label: '' };
        if (texts === sep) return { type: 'separator', label: '' };
        const trimmed = texts.trim();
        let type = 'other', label = '📄 其他';
        console.log(UserName + ':' + AiName)
        console.log(trimmed)
        if (trimmed.startsWith(UserName)) { type = 'user'; label = '👤'; }
        else if (trimmed.startsWith(AiName)) { type = 'ai'; label = '🤖'; }
        return { type, label };
    }

    for (let i = 0; i < segments.length; i++) {
        const raw = segments[i];
        if (raw === '') continue;

        // ========== 遇到分割线 ==========
        if (raw === sep) {
            const nextInfo = JudgeTheType(segments[i + 1]);
            if (nextInfo.type === 'other') {
                // 分割线后面是 other，跳过，让 other 段去吞它
                continue;
            } else {
                // 真正的分隔线//注释来防止编辑文本里面有真正的分割线
                // editorHTML += `<div class="separator">${raw}</div>`;
                continue;
            }
        }

        // ========== 遇到内容段 ==========
        let currentRaw = raw;
        let currentInfo = JudgeTheType(raw);

        // while 循环：不断往后吃 分隔符+other，直到条件不满足
        while (segments[i + 1] === sep) {
            const nextNextInfo = JudgeTheType(segments[i + 2]);
            if (nextNextInfo.type === 'other') {
                currentRaw += sep + segments[i + 2];//吞并的段属性用第一段的
                i += 2; // 跳过被吃掉的分隔符和 other 段
            } else {
                break; // 下下段不是 other，停止吞并
            }
        }
        // 剥离前缀，提取纯文本内容  创建单次对话对象并存入数组
        let pureContent = currentRaw.trim();
        if (currentInfo.type === 'user') {
            if (pureContent.startsWith(`${UserName}：\n`)) pureContent = pureContent.substring(`${UserName}：\n`.length);
            else if (pureContent.startsWith(`${UserName}：`)) pureContent = pureContent.substring(`${UserName}：`.length);
        } else if (currentInfo.type === 'ai') {
            if (pureContent.startsWith(`${AiName}：\n`)) pureContent = pureContent.substring(`${AiName}：\n`.length);
            else if (pureContent.startsWith(`${AiName}：`)) pureContent = pureContent.substring(`${AiName}：`.length);
        }

        const msgId = `block-${blockIndex++}`;
        const role = currentInfo.type;

        //创建单次对话对象并存入数组
        chatMessages.push(new ChatMessage(role, "", msgId));



        //为了防止html在编辑框内渲染导致无法编辑
        const safeContent = pureContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');

        const roleLabel = role === 'user' ? `${UserName}：` : (role === 'ai' ? `${AiName}：` : '📄 其他：');
        const labelClass = role === 'user' ? 'user-label' : (role === 'ai' ? 'ai-label' : 'other-label');

        // 核心修改：构建左右布局 DOM
        editorHTML += `
      <div class="message-wrapper" id="${msgId}">
        <div class="role-label ${labelClass}">${roleLabel}</div>
        <div class="msg-content ${labelClass}" id="${msgId}-content">${safeContent}</div>
      </div>
    `;

        let preview = safeContent.substring(0, 60).replace(/\n/g, ' ');
        if (safeContent.length > 60) preview += '...';
        tocHTML += `<li><a data-target="${msgId}" class="${role}">${currentInfo.label}：${preview}</a></li>`;
    }
    //上述逻辑处理完成后无法处理最后一行的分隔符，
    // 因为最后一个分隔符后面没有user或ai名，被当作内容加到上一个对话
    //editorHTML 最后50个字符中的分隔符进行替换
    const targetSep = '-------------------'; // 注意：这里写你实际的分隔符，原代码是19个横线
    if (editorHTML.length > 50) {
        // 截取前部分和最后50个字符
        let head = editorHTML.substring(0, editorHTML.length - 50);
        let tail = editorHTML.substring(editorHTML.length - 50);
        // 将最后50个字符中的分隔符（连同它前面可能由换行转义来的 <br>）替换为空
        tail = tail.replace(`<br>${targetSep}`, '');
        editorHTML = head + tail;
    } else {
        // 如果总长度不超过50，直接在全文替换
        editorHTML = editorHTML.replace(`<br>${targetSep}`, '');
    }
    editor.innerHTML = editorHTML;
    tocList.innerHTML = tocHTML;
    updateCharCount();
}




// ==========================================
// 4. 事件监听
// ==========================================

// 4.1 初始化
chrome.storage.local.get("editorText", async (data) => {
    const userInfo = await initUserInfo();
    UserName = userInfo.UserName;
    AiName = userInfo.AiName;

    // 后续逻辑
    console.log(`用户：${UserName}，AI：${AiName}`);
    if (data.editorText) {
        buildEditorAndTOC(data.editorText, UserName, AiName);
        chrome.storage.local.remove("editorText");
    } else {
        updateCharCount();
    }
});


// 4.2 实时字数统计及目录预览更新
editor.addEventListener('input', (e) => {
    updateCharCount();
    // 实时更新右侧目录的预览文字
    const contentEl = e.target.closest('.msg-content');
    if (contentEl) {
        const msgId = contentEl.id.replace('-content', '');
        const tocLink = tocList.querySelector(`a[data-target="${msgId}"]`);
        if (tocLink) {
            const currentText = contentEl.innerText;
            let preview = currentText.substring(0, 60).replace(/\n/g, ' ');
            if (currentText.length > 60) preview += '...';

            const msg = chatMessages.find(m => m.id === msgId);
            const labelEmoji = msg && msg.role === 'user' ? '👤' : (msg && msg.role === 'ai' ? '🤖' : '📄');
            tocLink.innerText = `${labelEmoji}：${preview}`;
        }
    }
});
// 4.3 目录点击跳转
tocList.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const targetElement = document.getElementById(a.getAttribute('data-target'));
    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});

// 4.4 强制回车只换行
editor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertLineBreak');
    }
});

// 4.5 复制按钮
copyBtn.addEventListener('click', () => {
    const contentEls = document.querySelectorAll('.msg-content');
    if (contentEls.length === 0 && !editor.innerText.trim()) return;

    let textToCopy = "";
    // 直接从当前 DOM 实时读取，保证与用户看到的内容完全同步
    contentEls.forEach((contentEl, index) => {
        const msgId = contentEl.id.replace('-content', '');
        const msg = chatMessages.find(m => m.id === msgId);
        if (!msg) return;

        let prefix = '';
        if (msg.role === 'user') prefix = `${UserName}：\n`;
        else if (msg.role === 'ai') prefix = `${AiName}：\n`;

        // 核心：实时获取用户当前编辑后的纯文本
        textToCopy += prefix + contentEl.innerText;

        // 只要不是最后一条，就在后面补上分割符
        if (index < contentEls.length - 1) {
            textToCopy += "\n\n-------------------\n\n";
        } else {
            textToCopy += "\n\n-------------------\n" + "User：" + "\n";
        }
    });

    if (!textToCopy.trim()) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = copyBtn.innerText;
        copyBtn.innerText = '已复制!';
        copyBtn.style.background = '#ffb900';
        copyBtn.style.color = 'black';
        setTimeout(() => {
            copyBtn.innerText = originalText;
            copyBtn.style.background = '#107c10';
            copyBtn.style.color = 'white';
        }, 2000);
    });
});


// 4.6 清空按钮
clearBtn.addEventListener('click', () => {
    editor.innerHTML = '';
    tocList.innerHTML = '';
    chatMessages = []; // 清空对话对象数组
    updateCharCount();
    editor.focus();
});

