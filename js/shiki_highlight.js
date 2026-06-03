function copyCodeBlock(btn) {
  const block = btn.closest('.code-block');
  const template = block.querySelector('template.raw-code');
  if (!template) return;

  const code = template.textContent;

  navigator.clipboard.writeText(code).then(() => {
    // 复制成功：切换为对勾状态
    btn.classList.add('copied');
    setTimeout(() => {
      btn.classList.remove('copied');
    }, 2000);
  }).catch(err => {
    console.error('复制失败：', err);
  });
}