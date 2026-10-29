export function escapeHtml(input: string): string {
  return input.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function seoTopicHtml(document: string, item: { title: string; content: string; slug: string }): string {
  const title = escapeHtml(item.title) + ' · 弄文社区';
  const desc = escapeHtml(item.content.replace(/[#*>\[\]`]/g, '').slice(0, 150));
  const canonical = 'https://community.nowen.cn/t/' + encodeURIComponent(item.slug);
  const article = '<article class="seo-article"><h1>' + escapeHtml(item.title) +
    '</h1><p>' + escapeHtml(item.content.slice(0, 12000)).replaceAll('\n', '<br>') + '</p></article>';
  return document.replace(/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>')
    .replace('</head>', '<meta name="description" content="' + desc + '"><link rel="canonical" href="' + canonical + '"></head>')
    .replace('<div id="root"></div>', '<div id="root">' + article + '</div>');
}
