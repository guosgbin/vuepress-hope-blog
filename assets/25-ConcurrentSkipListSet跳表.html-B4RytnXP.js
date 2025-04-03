import{_ as s}from"./plugin-vue_export-helper-DlAUqK2U.js";import{c as t,b as a,o as n}from"./app-dJCILimo.js";const e={};function l(h,i){return n(),t("div",null,i[0]||(i[0]=[a(`<table><thead><tr><th>版本</th><th>内容</th><th>时间</th></tr></thead><tbody><tr><td>V1</td><td>新建</td><td>2022年11月13日18:33:11</td></tr></tbody></table><h2 id="concurrentskiplistset-概述" tabindex="-1"><a class="header-anchor" href="#concurrentskiplistset-概述"><span>ConcurrentSkipListSet 概述</span></a></h2><p>ConcurrentSkipListSet 就是我们认知的 Set 集合，只不过底层是通过跳表实现的。</p><p>JDK 提供的 HashSet 内部的操作都是委托给 HashMap 实现的，ConcurrentSkipListSet 也是这样，其内部的操作都是委托 ConcurrentSkipListMap 实现的。</p><h2 id="concurrentskiplistset-原理" tabindex="-1"><a class="header-anchor" href="#concurrentskiplistset-原理"><span>ConcurrentSkipListSet 原理</span></a></h2><p>ConcurrentSkipListSet 的内部有一个 ConcurrentSkipListMap 类型的属性：</p><div class="language-java line-numbers-mode" data-highlighter="shiki" data-ext="java" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code><span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">/**</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> * The underlying map. Uses Boolean.TRUE as value for each</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> * element.  This field is declared final for the sake of thread</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> * safety, which entails some ugliness in clone().</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> */</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">private</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> final</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;"> ConcurrentNavigableMap</span><span style="--shiki-light:#E45649;--shiki-dark:#ABB2BF;">&lt;</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;">E</span><span style="--shiki-light:#E45649;--shiki-dark:#ABB2BF;">,</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;">Object</span><span style="--shiki-light:#E45649;--shiki-dark:#ABB2BF;">&gt;</span><span style="--shiki-light:#E45649;--shiki-dark:#E06C75;"> m</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>看一个 ConcurrentSkipListSet 的构造方法，可以看到是直接创建一个 ConcurrentSkipListMap 对象，Set 内部的操作都是委托给 ConcurrentSkipListMap 对象的。</p><div class="language-java line-numbers-mode" data-highlighter="shiki" data-ext="java" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code><span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">public</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;"> ConcurrentSkipListSet</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">() {</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">    m </span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">=</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> new</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;"> ConcurrentSkipListMap</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">&lt;</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;">E</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">,</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;">Object</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">&gt;</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">()</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>所以 ConcurrentSkipListSet 就是一种跳表的数据结构，它的时间复杂度</p><table><thead><tr><th style="text-align:left;">Algorithm</th><th><strong>Average</strong></th><th><strong>Worst case</strong></th></tr></thead><tbody><tr><td style="text-align:left;">Space</td><td>O(n)</td><td>O(nlogn)</td></tr><tr><td style="text-align:left;">Search</td><td>O(logn)</td><td>O(n)</td></tr><tr><td style="text-align:left;">Insert</td><td>O(logn)</td><td>O(n)</td></tr><tr><td style="text-align:left;">Delete</td><td>O(logn)</td><td>O(n)</td></tr></tbody></table><p>看下 ConcurrentSkipListSet 的增删改查的方法</p><div class="language-java line-numbers-mode" data-highlighter="shiki" data-ext="java" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code><span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">public</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> boolean</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;"> add</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">(</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;">E</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> e) {</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    return</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;"> m</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">.</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">putIfAbsent</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">(e, </span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;">Boolean</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">.</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;">TRUE</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">)</span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;"> ==</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> null</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">public</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> boolean</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;"> remove</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">(</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;">Object</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> o) {</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    return</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;"> m</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">.</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">remove</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">(o, </span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;">Boolean</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">.</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;">TRUE</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">);</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">public</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> int</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;"> size</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">() {</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    return</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;"> m</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">.</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">size</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">();</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">public</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> boolean</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;"> isEmpty</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">() {</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    return</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;"> m</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">.</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">isEmpty</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">();</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>可以看到基本上都是调用的 ConcurrentSkipListMap 的对应的方法。</p><p>需要注意的是，因为 ConcurrentSkipListMap 的 key 和 value 都不允许为空，所以 ConcurrentSkipListSet 都给 value 设置为 Boolean.TRUE。</p>`,15)]))}const r=s(e,[["render",l]]),d=JSON.parse('{"path":"/JDK_source/25-ConcurrentSkipListSet%E8%B7%B3%E8%A1%A8.html","title":"25-ConcurrentSkipListSet跳表","lang":"en-US","frontmatter":{"title":"25-ConcurrentSkipListSet跳表","description":"ConcurrentSkipListSet 概述 ConcurrentSkipListSet 就是我们认知的 Set 集合，只不过底层是通过跳表实现的。 JDK 提供的 HashSet 内部的操作都是委托给 HashMap 实现的，ConcurrentSkipListSet 也是这样，其内部的操作都是委托 ConcurrentSkipListMap 实...","head":[["meta",{"property":"og:url","content":"https://blog.guosgbin.cn/JDK_source/25-ConcurrentSkipListSet%E8%B7%B3%E8%A1%A8.html"}],["meta",{"property":"og:title","content":"25-ConcurrentSkipListSet跳表"}],["meta",{"property":"og:description","content":"ConcurrentSkipListSet 概述 ConcurrentSkipListSet 就是我们认知的 Set 集合，只不过底层是通过跳表实现的。 JDK 提供的 HashSet 内部的操作都是委托给 HashMap 实现的，ConcurrentSkipListSet 也是这样，其内部的操作都是委托 ConcurrentSkipListMap 实..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"en-US"}],["meta",{"property":"og:updated_time","content":"2025-04-03T07:07:29.000Z"}],["meta",{"property":"article:modified_time","content":"2025-04-03T07:07:29.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"25-ConcurrentSkipListSet跳表\\",\\"image\\":[\\"\\"],\\"dateModified\\":\\"2025-04-03T07:07:29.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"超威蓝猫 Dylan Kwok\\",\\"url\\":\\"\\",\\"email\\":\\"guosgbin@163.com\\"}]}"]]},"git":{"createdTime":1743664049000,"updatedTime":1743664049000,"contributors":[{"name":"Dylan Kwok","username":"","email":"guosgbin@163.com","commits":1}]},"readingTime":{"minutes":1.07,"words":321},"filePathRelative":"JDK_source/25-ConcurrentSkipListSet跳表.md","localizedDate":"April 3, 2025","autoDesc":true}');export{r as comp,d as data};
