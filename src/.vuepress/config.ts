import { defineUserConfig } from "vuepress";

import theme from "./theme.js";

export default defineUserConfig({
  // 导入字体
  head: [
    // 导入相应链接
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },],
    ["link", { href: "https://fonts.googleapis.com/css2?family=LXGW+WenKai+Mono+TC", rel: "stylesheet",},],
    ["link", { href: "https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC", rel: "stylesheet",},],
    
  ],



  base: "/",

  lang: "en-US",
  title: "",
  description: "",

  theme,

  // Enable it with pwa
  // shouldPrefetch: false,
});
