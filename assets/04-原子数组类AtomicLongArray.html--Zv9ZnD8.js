import{_ as s}from"./plugin-vue_export-helper-DlAUqK2U.js";import{c as a,b as n,o as l}from"./app-dJCILimo.js";const t={};function h(e,i){return l(),a("div",null,i[0]||(i[0]=[n(`<table><thead><tr><th>版本</th><th>内容</th><th>时间</th></tr></thead><tbody><tr><td>V1</td><td>新建</td><td>2022年08月18日09:16:28</td></tr></tbody></table><h2 id="简介" tabindex="-1"><a class="header-anchor" href="#简介"><span>简介</span></a></h2><p>原子数组就是能以原子的方式操作数组中的每一个元素，需要注意的是，是原子操作数组中的每个元素，而不是原子操作数组。</p><p>在 JUC 包中有如下几种原子数组：</p><ol><li>AtomicLongArray；</li><li>AtomicIntegerArray；</li><li>AtomicReferenceArray；</li></ol><p>本篇以 AtomicLongArray 为例分析，其他两种的实现相似。</p><h2 id="atomiclongarray" tabindex="-1"><a class="header-anchor" href="#atomiclongarray"><span>AtomicLongArray</span></a></h2><div class="language-java line-numbers-mode" data-highlighter="shiki" data-ext="java" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code><span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">public</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> class</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;"> AtomicLongArray</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> implements</span><span style="--shiki-light:#C18401;--shiki-dark:#E06C75;"> java.io.</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;">Serializable</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;"> {</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    private</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> static</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> final</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> long</span><span style="--shiki-light:#E45649;--shiki-dark:#E06C75;"> serialVersionUID </span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">=</span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;"> -</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;">2308431214976778248L</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    private</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> static</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> final</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;"> Unsafe</span><span style="--shiki-light:#E45649;--shiki-dark:#E06C75;"> unsafe </span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">=</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;"> Unsafe</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">.</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">getUnsafe</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">();</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">    // 数组的第一个元素相对该数组的地址偏移量</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    private</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> static</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> final</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> int</span><span style="--shiki-light:#E45649;--shiki-dark:#E06C75;"> base </span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">=</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;"> unsafe</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">.</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">arrayBaseOffset</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">(</span><span style="--shiki-light:#C18401;--shiki-dark:#C678DD;">long</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">[].</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;">class</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">);</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">    // 用于快速计算索引 i 处的相对地址偏移量</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    private</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> static</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> final</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> int</span><span style="--shiki-light:#E45649;--shiki-dark:#E06C75;"> shift</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">    // 当前封装的数组</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    private</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> final</span><span style="--shiki-light:#C18401;--shiki-dark:#C678DD;"> long</span><span style="--shiki-light:#E45649;--shiki-dark:#E06C75;">[] array</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">  	// ...</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>先看一下 AtomicLongArray 类的一些属性：</p><ol><li>unsafe：就是 sun.misc.Unsafe 类对象；</li><li>base：数组的第一个元素在相对该数组的地址偏移量；</li><li>shift：用于位运算，计算数组中索引 i 处的元素相对 base 的地址偏移量；</li><li>array：AtomicLongArray 封装的数组；</li></ol><blockquote><p>AtomicLongArray 使用的是 final 关键字在多线程环境下的语义（如果把数组定义为 volatile 类型，其里面的数组元素在读写方面是没有 volatile 语义的）</p></blockquote><p>下面看下 shift 字段的值的获取和使用</p><p>获取：</p><div class="language-java line-numbers-mode" data-highlighter="shiki" data-ext="java" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code><span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">static</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> {</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">    // 获取数组中每个元素占用的字节数</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    int</span><span style="--shiki-light:#E45649;--shiki-dark:#E06C75;"> scale </span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">=</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;"> unsafe</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">.</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">arrayIndexScale</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">(</span><span style="--shiki-light:#C18401;--shiki-dark:#C678DD;">long</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">[].</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;">class</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">);</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    if</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> ((scale </span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">&amp;</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> (scale </span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">-</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> 1</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">)) </span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">!=</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> 0</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">)</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">        throw</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> new</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;"> Error</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">(</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;">&quot;data type scale not a power of two&quot;</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">)</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">    // 获取数组中每个元素占用的字节数是 2 的几次幂，用于后面做位运算</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">    shift </span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">=</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> 31</span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;"> -</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;"> Integer</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">.</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">numberOfLeadingZeros</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">(scale);</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><ol><li>首先通过 sun.misc.Unsafe 获取数组中相邻元素的地址偏移量的间隔值 scale；</li><li>校验数组中每个元素占的地址是否是 2 的 n 次幂；</li><li>因为 scale 需要是 2 的 n 次幂，所以通过 <code>31 - Integer.numberOfLeadingZeros(scale);</code>可以得出 scale 到底是 2 的几次幂，赋值给 shift 变量；</li></ol><p>使用：</p><div class="language-java line-numbers-mode" data-highlighter="shiki" data-ext="java" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code><span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">/**</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> * 获取索引 i 位置的元素的地址偏移量</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> */</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">private</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> static</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> long</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;"> byteOffset</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">(</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">int</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> i) {</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    return</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> ((</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">long</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">) i </span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">&lt;&lt;</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> shift) </span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">+</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> base</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>这样我们就可以通过 AtomicLongArray#byteOffset 方法得到原子数组中的每一个元素相对数组的地址偏移量了，这样就可以针对数组中的每一个元素进行 CAS 操作了。</p><p>AtomicLongArray 的 API 就比较简单，举一个例子来看：</p><p>AtomicLongArray#getAndSet</p><div class="language-java line-numbers-mode" data-highlighter="shiki" data-ext="java" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code><span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">/**</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> *</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> * </span><span style="--shiki-light:#A626A4;--shiki-light-font-style:italic;--shiki-dark:#C678DD;--shiki-dark-font-style:italic;">@param</span><span style="--shiki-light:#383A42;--shiki-light-font-style:italic;--shiki-dark:#E06C75;--shiki-dark-font-style:italic;"> i</span><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> 索引</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> * </span><span style="--shiki-light:#A626A4;--shiki-light-font-style:italic;--shiki-dark:#C678DD;--shiki-dark-font-style:italic;">@param</span><span style="--shiki-light:#383A42;--shiki-light-font-style:italic;--shiki-dark:#E06C75;--shiki-dark-font-style:italic;"> 新值</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> * </span><span style="--shiki-light:#A626A4;--shiki-light-font-style:italic;--shiki-dark:#C678DD;--shiki-dark-font-style:italic;">@return</span><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> 返回旧值</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"> */</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">public</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> final</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> long</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;"> getAndSet</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">(</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">int</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> i</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">,</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> long</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> newValue) {</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    return</span><span style="--shiki-light:#E45649;--shiki-dark:#E5C07B;"> unsafe</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">.</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">getAndSetLong</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">(array, </span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">checkedByteOffset</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">(i), newValue);</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>sun.misc.Unsafe#getAndSetLong</p><div class="language-java line-numbers-mode" data-highlighter="shiki" data-ext="java" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code><span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">public</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> final</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> long</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;"> getAndSetLong</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">(</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;">Object</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> o</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">,</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> long</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> offset</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">,</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> long</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> newValue) {</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    long</span><span style="--shiki-light:#E45649;--shiki-dark:#E06C75;"> v</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    do</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> {</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">        v </span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">=</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;"> getLongVolatile</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">(o</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">,</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> offset)</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">    } </span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">while</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> (</span><span style="--shiki-light:#383A42;--shiki-dark:#56B6C2;">!</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">compareAndSwapLong</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">(o</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">,</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> offset</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">,</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> v</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">,</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> newValue))</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    return</span><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;"> v</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#E06C75;">}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="其它原子数组" tabindex="-1"><a class="header-anchor" href="#其它原子数组"><span>其它原子数组</span></a></h2><p>关于另外两个原子数组，实现和 AtomicLongArray 基本上一样，大家可以自己看。</p><ol><li>AtomicIntegerArray；</li><li>AtomicReferenceArray；</li></ol>`,26)]))}const r=s(t,[["render",h]]),d=JSON.parse('{"path":"/JDK_source/04-%E5%8E%9F%E5%AD%90%E6%95%B0%E7%BB%84%E7%B1%BBAtomicLongArray.html","title":"04-原子数组类AtomicLongArray","lang":"en-US","frontmatter":{"title":"04-原子数组类AtomicLongArray","description":"简介 原子数组就是能以原子的方式操作数组中的每一个元素，需要注意的是，是原子操作数组中的每个元素，而不是原子操作数组。 在 JUC 包中有如下几种原子数组： AtomicLongArray； AtomicIntegerArray； AtomicReferenceArray； 本篇以 AtomicLongArray 为例分析，其他两种的实现相似。 Ato...","head":[["meta",{"property":"og:url","content":"https://blog.guosgbin.cn/JDK_source/04-%E5%8E%9F%E5%AD%90%E6%95%B0%E7%BB%84%E7%B1%BBAtomicLongArray.html"}],["meta",{"property":"og:title","content":"04-原子数组类AtomicLongArray"}],["meta",{"property":"og:description","content":"简介 原子数组就是能以原子的方式操作数组中的每一个元素，需要注意的是，是原子操作数组中的每个元素，而不是原子操作数组。 在 JUC 包中有如下几种原子数组： AtomicLongArray； AtomicIntegerArray； AtomicReferenceArray； 本篇以 AtomicLongArray 为例分析，其他两种的实现相似。 Ato..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"en-US"}],["meta",{"property":"og:updated_time","content":"2025-04-03T07:07:29.000Z"}],["meta",{"property":"article:modified_time","content":"2025-04-03T07:07:29.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"04-原子数组类AtomicLongArray\\",\\"image\\":[\\"\\"],\\"dateModified\\":\\"2025-04-03T07:07:29.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"超威蓝猫 Dylan Kwok\\",\\"url\\":\\"\\",\\"email\\":\\"guosgbin@163.com\\"}]}"]]},"git":{"createdTime":1743664049000,"updatedTime":1743664049000,"contributors":[{"name":"Dylan Kwok","username":"","email":"guosgbin@163.com","commits":1}]},"readingTime":{"minutes":2.35,"words":705},"filePathRelative":"JDK_source/04-原子数组类AtomicLongArray.md","localizedDate":"April 3, 2025","autoDesc":true}');export{r as comp,d as data};
