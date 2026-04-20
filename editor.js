// ==========================================
// 1. DOM 元素获取
// ==========================================
const editor = document.getElementById('editor');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');
const tocList = document.getElementById('tocList');
const charCountEl = document.getElementById('charCount');

// ==========================================
// 2. 核心工具函数
// ==========================================

/** 实时更新右上角的字符数量 */
function updateCharCount() {
  const text = editor.innerText;
  charCountEl.textContent = `字符数：${text.length}`;
}

// ==========================================
// 3. 页面渲染逻辑
// ==========================================

/** 解析长文本并渲染编辑器和目录 */
function buildEditorAndTOC(text) {
  // 用 liaoyi 和 ailinyi 当作切刀，把整段文字切开，保留切刀本身
  const segments = text.split(/(liaoyi|ailinyi)/);
  
  let editorHTML = '';
  let tocHTML = '';
  let blockIndex = 0;

  // 每次跳 2 步，只看「关键词」和它「后面的内容」
  for (let i = 1; i < segments.length; i += 2) {
    const keyword = segments[i]; // 比如 "liaoyi"
    let content = (segments[i + 1] || '').trim();
    
    // 只清理无用的分割线(---)
    content = content.replace(/\n*-{3,}\n*/g, '').trim();
    
    // 【关键修复】把关键词和后面的内容重新粘合，保证 liaoyi/ailinyi 不丢失！
    const fullContent = keyword + content;
    
    if (!fullContent.trim()) continue;

    let type = 'other';
    let label = '📄 其他';
    if (keyword.includes('liaoyi')) {
      type = 'user'; label = '👤 用户';
    } else if (keyword.includes('ailinyi')) {
      type = 'ai'; label = '🤖 AI';
    }

    // 转义 HTML 防止代码被渲染，并把换行符转成 <br>
    const safeContent = fullContent.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const id = `block-${blockIndex++}`;

 // 截取前 20 个字作为目录预览（现在包含了 liaoyi 等字眼）
    let preview = safeContent.substring(0, 40);
    if (safeContent.length > 40) preview += '...';
    editorHTML += `<div id="${id}" class="msg ${type}">${safeContent}</div>`;
    tocHTML += `<li><a data-target="${id}" class="${type}">${label}：${preview}</a></li>`;
  }

  editor.innerHTML = editorHTML;
  tocList.innerHTML = tocHTML;
  updateCharCount();
}

// ==========================================
// 4. 事件监听
// ==========================================

// 4.1 初始化
chrome.storage.local.get("editorText", (data) => {
  if (data.editorText) {
    buildEditorAndTOC(data.editorText);
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
