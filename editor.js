import logger from './logger.js';
let  UserName, AiName ;//定义用户信息

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
function buildEditorAndTOC(text,UserName,AiName) {
  const sep = '-------------------';
  const segments = text.split(new RegExp('(' + sep.replace(/-/g, '\\-') + ')', 'g'));

  let editorHTML = '';
  let tocHTML = '';
  let blockIndex = 0;

  function JudgeTheType(texts) {
    if (!texts) return { type: 'empty', label: '' };
    if (texts === sep) return { type: 'separator', label: '' };
    const trimmed = texts.trim();
    let type = 'other', label = '📄 其他';
    console.log(UserName+':'+AiName)
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
        // 真正的分隔线
        editorHTML += `<div class="separator">${raw}</div>`;
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
        currentRaw += sep + segments[i + 2];
        //吞并的段属性用第一段的
        i += 2; // 跳过被吃掉的分隔符和 other 段
      } else {
        break; // 下下段不是 other，停止吞并
      }
    }
//为了防止html在编辑框内渲染导致无法编辑
    const safeContent = currentRaw
          .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    const id = `block-${blockIndex++}`;
    let preview = safeContent.substring(0, 60);
    if (safeContent.length > 60) preview += '...';

    editorHTML += `<div id="${id}" class="msg ${currentInfo.type}">${safeContent}</div>`;
    tocHTML += `<li><a data-target="${id}" class="${currentInfo.type}">${currentInfo.label}：${preview}</a></li>`;
  }

  editor.innerHTML = editorHTML;
  tocList.innerHTML = tocHTML;
  updateCharCount();
}




// ==========================================
// 4. 事件监听
// ==========================================

// 4.1 初始化
chrome.storage.local.get("editorText",async (data) => {
    const userInfo = await initUserInfo();
    UserName = userInfo.UserName;
    AiName = userInfo.AiName;
    
    // 后续逻辑
    console.log(`用户：${UserName}，AI：${AiName}`);
    if (data.editorText) {
        buildEditorAndTOC(data.editorText,UserName,AiName);
        chrome.storage.local.remove("editorText");
    } else {
        updateCharCount();
    }
});

// 4.2 实时字数统计
editor.addEventListener('input', updateCharCount);

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
    const text = editor.innerText;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
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
    updateCharCount();
    editor.focus();
});
