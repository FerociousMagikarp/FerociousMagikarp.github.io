function copyCodeBlock(btn) {
  const block = btn.closest('.code-block');
  if (!block) return;

  let code = '';
  const codeElem = block.querySelector('pre code');
  if (codeElem) {
    // 查找所有行（你的结构里是 .line）
    const lines = codeElem.querySelectorAll('.line');
    if (lines.length) {
      // 逐行提取纯文本，用换行符连接
      code = Array.from(lines).map(line => line.textContent).join('\n');
    } else {
      // 降级：没有 .line 就直接取全部文本（可能无换行，但至少能复制）
      code = codeElem.textContent;
    }
  } else {
    console.error('未找到代码块');
    return;
  }

  // 复制到剪贴板（带降级支持）
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 2000);
    }).catch(err => {
      console.error('Clipboard API 失败:', err);
      fallbackCopy(code, btn);
    });
  } else {
    fallbackCopy(code, btn);
  }
}

function fallbackCopy(text, btn) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const success = document.execCommand('copy');
    if (success) {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 2000);
    } else {
      alert('复制失败，请手动复制');
    }
  } catch (err) {
    console.error('降级复制失败:', err);
    alert('复制失败，请手动复制');
  }
  document.body.removeChild(textarea);
}