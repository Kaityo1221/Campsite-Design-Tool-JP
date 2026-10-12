import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'.',
 testMatch:['x01-idb-browser.spec.mjs'],
 timeout:60000,
 expect:{timeout:15000},
 retries:0,
 reporter:[['list']],
 use:{baseURL:'http://127.0.0.1:4178',browserName:'chromium',headless:true,viewport:{width:393,height:852}},
 webServer:{
  command:'python3 -m http.server 4178 --bind 127.0.0.1',
  cwd:process.cwd(),
  url:'http://127.0.0.1:4178/creative-next/qa/x01-idb-browser.html',
  reuseExistingServer:false,
  timeout:15000
 }
});