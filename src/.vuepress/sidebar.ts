import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  // "/": [
  //   "",
  //   "portfolio",
  //   {
  //     text: "Demo",
  //     icon: "laptop-code",
  //     prefix: "demo/",
  //     link: "demo/",
  //     children: "structure",
  //   },
  //   {
  //     text: "Docs",
  //     icon: "book",
  //     prefix: "guide/",
  //     children: "structure",
  //   },
  //   {
  //     text: "Slides",
  //     icon: "person-chalkboard",
  //     link: "https://ecosystem.vuejs.press/plugins/markdown/revealjs/demo.html",
  //   },
  // ],

  "/JDK_source": "structure",
  "/Redis": "structure",
  "/Netty_source": "structure",
  "/Mybatis_source": "structure",
  "/RocketMQ_source": "structure",
  "/Java_base": "structure",
  "/EffectiveJava_note": "structure",
  "/interviewQA": "structure",
  "/business_issue_accumulations": "structure",
  "/leetcode_record": "structure",

  "/": [
        "" /* / */,
        "contact" /* /contact.html */,
        "about" /* /about.html */,
      ],
});
