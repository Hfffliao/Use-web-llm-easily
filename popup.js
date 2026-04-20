document.getElementById('extractBtn').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractSpecificChat
  });

  const extractedText = results[0].result;

  // 存入缓存
  await chrome.storage.local.set({ "editorText": extractedText });

  // 打开全屏编辑器
  chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
  window.close();
});

// 专为你当前网站定制的精准提取逻辑
function extractSpecificChat() {
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
  allMessages.forEach(node => {
    let text = "";

    if (node.classList.contains('answer-content-wrap')) {
      // 关键：如果带有“思考”特征的类，就跳过这一整块
      if (node.classList.contains('text-advance-thinking-content')) {
        return; // 直接跳过，不取这段“思考”
      }

      // 否则是正式回复，正常取文本
      text = node.innerText.trim();
    } else {
      // 用户提问：正常取文本
      text = node.innerText.trim();
    }

    if (text) {
      const prefix = node.classList.contains('question-text-style') ? 'liaoyi提问：\n' : 'ailinyi回答：\n';
      finalText += prefix + text + "\n\n-------------------\n\n";
    }
  });

  // 6. 兜底方案
  if (finalText.trim() === "") {
    finalText = window.getSelection().toString();
  }
  console.log(finalText);
  return finalText;
}
