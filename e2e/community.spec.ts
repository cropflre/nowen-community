import {test,expect} from '@playwright/test';
test('community home, themes and responsive navigation',async({page,isMobile})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/好的想法/})).toBeVisible();
 await expect(page.getByText('开放注册 · 内容先审')).toBeVisible();
 const before=await page.locator('html').getAttribute('data-theme');
 await page.getByRole('button',{name:'切换明暗主题'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme',before==='dark'?'light':'dark');
 if(isMobile){
  await page.getByRole('button',{name:'打开导航'}).click();
  await expect(page.getByRole('navigation',{name:'社区板块'})).toBeVisible();
  await page.getByRole('button',{name:'关闭导航'}).click();
 }
});
test('open registration, draft autosave and pending-only submission',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:/登录 \/ 注册/}).click();
 await page.getByRole('button',{name:'免费注册'}).click();
 const username='e2e'+Date.now().toString(36).slice(-10);
 await page.getByPlaceholder('英文字母、数字或下划线').fill(username);
 await page.getByPlaceholder('在社区展示的名称').fill('测试创作者');
 await page.getByPlaceholder('至少 12 位密码').fill('A long and unique test password! 2026');
 await expect(page.getByPlaceholder('管理员提供的一次性邀请码')).toHaveCount(0);
 await page.getByRole('button',{name:'创建账号'}).click();
 await expect(page.getByRole('button',{name:/测试创作者.*退出/})).toBeVisible({timeout:15000});
 await page.getByRole('button',{name:'开启一个话题'}).click();
 await page.getByPlaceholder('用一句话描述你想讨论的事情').fill('我的第一篇弄文社区话题');
 await page.getByPlaceholder('分享你的想法，支持 Markdown 语法…').fill('这是通过 Playwright 浏览器端测试发布的 Markdown 内容。');
 await expect(page.getByRole('status')).toContainText(/草稿已保存|保存中/,{timeout:15000});
 await page.getByRole('button',{name:'提交审核'}).click();
 await expect(page.getByText('已提交审核，审核通过后其他用户才能看到')).toBeVisible({timeout:15000});
 const me=await page.request.get('/api/v1/me/topics');
 expect(me.ok()).toBeTruthy();
 const json=await me.json();
 expect(json.items.some((item:{status:string;title:string})=>item.title==='我的第一篇弄文社区话题'&&item.status==='pending')).toBeTruthy();
});
test('admin page is denied to non-administrators',async({page})=>{
 await page.goto('/admin');
 await expect(page.getByRole('heading',{name:'无访问权限'})).toBeVisible();
});
