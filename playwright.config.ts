import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',fullyParallel:false,forbidOnly:!!process.env.CI,retries:process.env.CI?1:0,workers:1,
 reporter:process.env.CI?[['list'],['html',{open:'never'}]]:'list',
 use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'chromium-desktop',use:{...devices['Desktop Chrome']}},
  {name:'chromium-mobile',use:{...devices['Pixel 7']}},
 ],
 webServer:{
  command:'npm run dev -- --host 127.0.0.1',
  url:'http://127.0.0.1:5173/api/health',
  reuseExistingServer:!process.env.CI,
  timeout:120000,
 },
});
