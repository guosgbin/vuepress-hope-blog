---
title: Netty相关问题
date: 2026-06-24 20:01:54
tags: 
  - interview
categories:
  - interviewQA
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2026年06月24日20:01:54 |

## 基础概念

### 什么是 BIO、NIO、AIO

- **BIO：阻塞同步**，应用调用读 → **内核没数据就一直阻塞等待**，直到数据就绪才返回。
- **NIO：非阻塞同步**，应用调用读 → **没数据立刻返回，不阻塞**；通过 **Selector（选择器）自己轮询检查** 哪些连接已就绪；**不是系统主动回调通知**。
- **AIO：非阻塞异步**，应用调用读 → **立刻返回**；**内核自动完成数据读取**，数据就绪后**主动回调通知**应用；应用无需主动检查。

总结：**BIO：等着数据来**；**NIO：自己去查数据来没来**；**AIO：数据来了系统叫我**

### Java NIO 三大核心组件是什么？分别作用？

NIO（Non-blocking IO，同步非阻塞 IO）核心三要素，区别于传统 BIO 一连接一线程模型。

**Channel 通道**

**作用**

数据**双向读写**通道，相当于 BIO 里的 Socket/InputStream/OutputStream，但 Channel 支持双向读写，不能直接操作数据，必须配合 Buffer。

**常见实现**

- FileChannel：文件 IO
- SocketChannel：TCP 客户端网络通道
- ServerSocketChannel：TCP 服务端监听通道
- DatagramChannel：UDP 通道

**特点**

- 双向可读可写
- 支持非阻塞模式
- 所有数据必须通过 Buffer 中转

---

**Buffer 缓冲区**

**作用**

**数据容器**，所有读写操作都先经过 Buffer，底层是数组，存放要收发 / 读写的数据。

**核心属性**

- capacity：缓冲区总容量（固定）
- position：当前读写位置
- limit：读写边界
- mark：标记位置

**常用实现**

ByteBuffer（最常用，字节缓冲区）、CharBuffer、IntBuffer、LongBuffer 等

**关键方法**

- put ()：写入数据
- get ()：读取数据
- flip ()：切换写模式→读模式（重置 limit、position）
- clear ()：清空缓冲区，切换回写模式

---

**Selector 选择器（多路复用器）**

**作用**

**单线程管理多个 Channel**，实现 IO 多路复用，解决 BIO 线程资源浪费问题。

一个 Selector 线程可以监听成千上万个 Channel，只处理有就绪事件的通道。

**监听四种就绪事件**

1. OP_ACCEPT：ServerSocketChannel 接收连接就绪
2. OP_CONNECT：SocketChannel 连接服务端完成
3. OP_READ：通道有数据可读
4. OP_WRITE：通道可写入数据

**工作流程**

1. Channel 注册到 Selector，并绑定监听事件
2. 调用`select()`阻塞等待就绪通道
3. 获取就绪的 SelectionKey 集合，遍历处理对应 IO 事件

### 为什么不直接用 JDK NIO，选择 Netty

- **屏蔽底层 NIO 所有坑**：空轮询 Bug、ET 读写、堆外内存泄漏、Selector 重建全部内部解决；
- **大幅降低开发难度**：封装 ByteBuf、Reactor 线程模型、责任链、拆包解码器；
- **性能更好**：内存池、JNI epoll、主从线程分离，GC 压力更低；
- **生态完善**：内置 HTTP、WebSocket、Protobuf、SSL、心跳、限流等组件；
- **稳定成熟**：大量中间件底层依赖（Dubbo、Spring Cloud Gateway、RocketMQ、Elasticsearch），经过海量并发验证。

### IO多路复用

I/O 复用是一种 I/O 模式，通过这种模式可以同时监听多个 I/O 事件，从而有效地管理多个 I/O 操作。在实际应用中，常见的 I/O 复用技术包括 select、poll 和 epoll。

1. **select**：
   - 监视一组文件描述符，当其中任何一个文件描述符就绪时，`select` 将通知程序可以执行 I/O 操作。
   - 文件描述符数量受 `FD_SETSIZE` 限制（通常 1024），超过需要手动修改宏或切分。
   - 内核每次调用都要 **拷贝 fd 集合**，大量 fd 时效率低。
2. **poll**：
   - 不受 fd 数量限制，结构简单。
   - 内核每次调用仍需扫描整个数组，仍是 O(n) 复杂度，所以大量 fd 性能下降。
3. **epoll**：
   - Linux 特有，事件驱动，性能高。
   - `epoll` 分为 **水平触发（LT）** 和 **边缘触发（ET）**。
     - LT（默认）：fd 一直就绪，应用可以重复读。
     - ET：fd 只通知一次，需要一次性读完或写完。
   - 内核维护就绪 fd 链表，处理大规模并发 O(1)，相比 select/poll 性能更好。

I/O 复用的优势在于可以同时管理多个 I/O 事件，避免了传统阻塞模式下需要为每个连接创建一个线程或进程的开销，从而提高了系统资源利用率和性能。因此，在高并发的网络编程场景下，常常会选择使用 I/O 复用来实现高效的事件驱动的网络通信。

![image-20260624201017391](./Netty%E7%9B%B8%E5%85%B3%E9%97%AE%E9%A2%98_img/image-20260624201017391.png)

### Epoll 水平触发 LT、边缘触发 ET？

- **水平触发 LT（默认）：只要缓冲区还有数据，就一直通知你**
- **边缘触发 ET：只有状态变化时（无→有），才通知你一次**

---

水平触发的特点：

- 不会丢数据
- 不容易出错
- **Netty 默认使用 LT**（**Netty 追求：通用、安全、简单、不出 BUG，业务代码不用小心翼翼处理，LT 最适合大多数业务。**）
- 编程简单

---

边缘触发的特点：

- 效率更高，减少通知次数
- **必须配合非阻塞 + 循环 read 直到 EAGAIN**
- 编程难度高，容易漏数据
- Redis、Nginx 用 ET（极致性能、超低开销、少内核交互**ET 只通知一次，减少用户态 <-> 内核态切换 → 更快，减少 epoll 调用次数**

---

| 特性         | LT 水平触发            | ET 边缘触发                  |
| ------------ | ---------------------- | ---------------------------- |
| 触发时机     | 缓冲区有数据就一直通知 | 状态切换瞬间仅通知一次       |
| 代码复杂度   | 简单，不用一次性读完   | 复杂，必须循环读完全部数据   |
| 唤醒次数     | 多，频繁就绪           | 极少，性能更好               |
| 适用场景     | 简单程序、低并发       | 高并发中间件（Netty、Nginx） |
| 丢失数据风险 | 无                     | 不循环读会丢数据             |

![image-20260624201114738](./Netty%E7%9B%B8%E5%85%B3%E9%97%AE%E9%A2%98_img/image-20260624201114738.png)

### Channel、ChannelHandler、ChannelPipeline、ChannelHandlerContext 四者关系？

**一、核心从属关系一句话**

1. **一个 Channel 唯一绑定一个 ChannelPipeline**
2. **Pipeline 内部是双向链表，存放多个 ChannelHandler**
3. **每一个 Handler 绑定一个独有的 ChannelHandlerContext（ctx）**
4. ctx 是 Handler 和 Pipeline/Channel 交互的桥梁

层级从属：

```
Channel` → 持有 `ChannelPipeline` → Pipeline 持有多个 `ChannelHandler` → 每个 Handler 配套一个 `ChannelHandlerContext
```

---

**二、各个组件内容**

- **Channel**（连接）

  代表一条 TCP 连接，是 IO 载体。核心持有 ChannelPipeline，任何 Channel 都一定有且仅有一条 Pipeline，一一对应，生命周期同步。

- **ChannelPipeline**（处理器流水线 / 双向链表）

  每条 Channel 独一份，本质是 Handler 链表，内置两个固定节点：

  - HeadContext（头节点，底层 IO 读写入口）
  - TailContext（尾节点，异常兜底）

  所有 `addLast/addFirst` 添加的自定义 Handler 都插在头尾中间。

  职责：分发入站 / 出站事件，驱动 Handler 按顺序执行。

- **ChannelHandler**（逻辑处理器）

  真正处理读写、连接、异常的业务单元，分入站 / 出站。

  Handler 本身是**无状态逻辑**，不持有通道、流水线引用，依靠上下文完成交互。

  同一个 Handler 实例可以被多条 Channel 共用（无状态前提下）。

- **ChannelHandlerContext**（上下文 ctx）

  **重点：每个 Handler 对应独立 ctx，不是全局唯一**

  - ctx 内部绑定三样东西：当前 Handler、所属 Pipeline、所属 Channel；
  - ctx 保存当前 Handler 在链表中的位置，控制事件传播；
  - 提供读写、关闭、转发事件的 API。

## Reactor 线程模型

### NIO 的 3 种 Reactor 模式

① **Reactor 单线程模式**

所有操作都由一个线程处理，包括 **accept、读写、注册事件、扫描事件**。

- 当 IO 密集和业务处理都在一个线程时，会成为 **系统瓶颈**。
- Redis 使用单线程是因为它大多数操作非常快，避免了线程切换开销，但不适合 CPU 密集型业务。

![image-20230721210304692](./Netty%E7%9B%B8%E5%85%B3%E9%97%AE%E9%A2%98_img/image-20230721210304692-9944586.png)

② **Reactor 多线程模式**

- Reactor 负责监听事件（accept / IO 事件触发）。
- 事件分发给线程池处理复杂业务（解码/处理/编码）。

- 这种模式属于 **主线程负责 IO，工作线程负责业务逻辑**。
- 提升了并发处理能力，但仍然可能受单线程监听队列或线程池调度限制。

![image-20230721210829367](./Netty%E7%9B%B8%E5%85%B3%E9%97%AE%E9%A2%98_img/image-20230721210829367-9944910.png)

③ **Reactor 主从多线程**

- 主 Reactor 负责 **accept**。
- 从 Reactor 负责 **读写处理**。
- 多个从 Reactor 可以分摊读写压力，提升高并发处理能力。

- 与 Netty/Nginx 架构对应：
  - Netty：主线程（boss group）处理连接，worker group 处理 IO。
  - Nginx：master 进程负责监听，worker 进程负责请求处理。

![image-20230721210842645](./Netty%E7%9B%B8%E5%85%B3%E9%97%AE%E9%A2%98_img/image-20230721210842645-9944923.png)



![image-20260624202423060](./Netty%E7%9B%B8%E5%85%B3%E9%97%AE%E9%A2%98_img/image-20260624202423060.png)

### Boss EventLoop、Worker EventLoop 各自职责？为什么要分开？

**一、Boss EventLoop（主 Reactor）职责**

Boss 线程组默认**单线程**，只负责 TCP 连接建立，不处理数据读写：

1. 绑定端口，监听 `NioServerSocketChannel` 的 `OP_ACCEPT` 事件；
2. 接收客户端三次握手，完成 TCP 连接；
3. 创建新的 `NioSocketChannel`（客户端连接通道）；
4. 将新建的 SocketChannel 注册到 **Worker EventLoopGroup** 里某个空闲 Worker EventLoop；
5. 少量辅助：处理服务端监听通道自身的异常、关闭等事件。

核心特点：只做连接接受，**不处理任何业务读写**，任务极轻。

---

**二、Worker EventLoop（从 Reactor）职责**

Worker 是一组多线程 IO 线程，处理所有已建立连接的数据交互：

1. 每个 Worker 内部持有一个 Selector，轮询绑定在自己身上的所有 SocketChannel；
2. 处理通道四类 IO 就绪事件：`OP_READ`、`OP_WRITE`、连接激活 / 断开；
3. 驱动当前 Channel 的 `ChannelPipeline` 执行所有 Handler（解码、业务、编码、心跳等）；
4. 执行异步任务、定时任务（`eventLoop.execute()` / `schedule()`）；
5. 通道关闭、资源释放、异常统一处理。

关键规则：一条 SocketChannel 全程只会绑定**同一个 Worker EventLoop**，不存在多线程并发竞争通道。

---

**三、为什么 Boss 和 Worker 必须分开（核心 4 个原因）**

- **职责隔离，互不阻塞，保障接入能力**

  - 如果把「接受连接」和「读写业务」放在同一组线程：

    一旦某个 Handler 出现阻塞操作（数据库、同步 RPC、大计算），整个线程被卡住，Selector 无法执行 `select()`，新客户端连接无法被接受，服务直接无法接入新流量。

  - Boss 只做轻量连接受理，永远不会被业务阻塞，**无论 Worker 多忙，端口始终能正常接收新连接**。

- **任务量级完全不同，资源分配解耦**

  - Boss 任务极少：一台服务每秒几千上万连接，单线程完全扛得住；

  - Worker 任务繁重：百万长连接、高频读写、编解码、心跳检测，需要多线程均分压力。

  分开后可以独立配置线程数：

  ```
  new NioEventLoopGroup(1); // Boss固定少量
  new NioEventLoopGroup(16); // Worker根据CPU核心扩容
  ```

- **两类 Channel 隔离，避免事件互相干扰**

  - Boss 持有 `NioServerSocketChannel`（监听端口的父通道）；

  - Worker 持有大量 `NioSocketChannel`（客户端子通道）。

  如果共用一个 Selector：

  大量读写事件会频繁唤醒 Selector，淹没 `OP_ACCEPT` 事件，造成新连接响应延迟。拆分后监听事件独立调度，响应更快。

- **故障隔离，Worker 故障不影响服务监听**

  - 若 Worker 线程死循环、死锁、长时间阻塞，只会影响已建立的旧连接；

  - Boss 线程独立运行，依旧可以正常接收新客户端，新连接分配到其他健康 Worker，服务不会彻底 “卡死无响应”。

---

**四、补充完整流程演示**

1. Boss EventLoop 轮询到 OP_ACCEPT，拿到客户端连接；
2. 新建 NioSocketChannel；
3. 通过轮询算法选出一个 Worker EventLoop；
4. SocketChannel 注册到该 Worker 的 Selector；
5. 后续所有读写、心跳、业务逻辑全由这个 Worker 处理；
6. Boss 释放，继续等待下一个客户端连接。

### EventLoop 是什么？

`EventLoop` = Netty 封装的**单个 Reactor IO 线程**，底层包含：

- 一个 JDK NIO `Selector`（多路复用器）
- 一个无限循环任务队列（普通任务 + 定时任务）

---

核心工作原理：

1. `select()` 阻塞轮询，等待 Channel IO 就绪事件；
2. 处理就绪 Channel 的读写事件，驱动 Pipeline Handler；
3. 执行队列中的普通异步任务、定时延时任务。

约束：**绑定到该 EventLoop 的所有 Channel，所有 IO 操作都只由这一条线程串行执行**，天然不用加锁。

---

一个 EventLoop 管理的 Channel 数量没有固定硬上限，**理论支持成千上万甚至十万级 Channel**，取决于两点：

NIO 多路复用是**单线程监听大量文件描述符**，不存在 “一个线程只能处理少量连接” 的限制，瓶颈不在连接数量，而在：

- 每条 Channel 读写数据量；
- Handler 内是否有阻塞操作（DB、同步调用、大计算会拖垮整个线程上所有连接）；
- JVM 堆外内存、句柄上限。

### 为什么业务耗时操作不能放在 EventLoop？

**一、EventLoop 核心执行规则**

- **一个 EventLoop = 唯一一条 IO 线程**，串行执行三件事：

  - selector 轮询 IO 就绪事件（读写、连接）
  - 处理 Channel 流水线所有 Handler（解码、编码、业务逻辑）
  - 执行该线程内的普通任务、定时任务

- 所有绑定到此 EventLoop 的 Channel，共用这一条线程

  同一个 EventLoop 上成千上万个连接，全部排队串行处理。

- **线程一旦被阻塞，整个循环停滞，不会释放。**

---

**二、为什么耗时业务不能写在 EventLoop（Worker 线程）**

耗时操作举例：同步查 MySQL、同步 RPC、文件 IO、复杂循环计算、睡眠、锁等待等。

Worker IO 线程的设计目标是**快速处理读写事件，不阻塞**，任何耗时操作都会霸占线程，导致循环卡死。

---

**三、阻塞 EventLoop 带来的连锁后果**

- **当前线程上所有连接全部卡死、无响应**

  EventLoop 是串行执行，一旦进入耗时阻塞逻辑，`select()` 轮询、其他 Channel 的读写事件全部排队等待。

  比如：线程上有 1000 条长连接，其中一条请求执行 2s SQL 查询，这 2s 内其余 999 条连接：

  - 新消息无法读取

  - 响应数据发不出去

  - 心跳检测无法执行，服务端判定客户端超时断开，大量连接集体断连、超时。

- **服务吞吐暴跌，请求堆积**

  Worker 线程池总线程数有限（默认 CPU*2），只要多个 Handler 阻塞，很快所有 Worker 全部被占满；

  新客户端连接分配不到空闲 Worker，新请求直接堆积，接口大量超时。

- **定时任务、心跳检测失效**

  `IdleStateHandler` 心跳、定时重发、定时统计等任务都在 EventLoop 任务队列执行；

  线程阻塞时定时任务无法按时执行，心跳超时误杀正常连接。

- **任务队列无限膨胀，OOM 风险**

  阻塞期间大量新读写事件、异步任务不断丢进该 EventLoop 的任务队列；

  队列持续积压，占用堆内存，严重时触发 JVM 内存溢出。

## 内存模型 & 零拷贝

### Netty 堆内存 HeapBuffer 和堆外内存 DirectBuffer 区别？优缺点？

**一、底层本质**

- HeapBuffer（堆缓冲区）

  底层是 JVM 堆内 byte []，受 GC 管理，属于 Java 堆内存。

  ```
  // 底层存储
  byte[] array;
  ```

  分配：`UnpooledHeapByteBuf`、池化 `PooledHeapByteBuf`

- DirectBuffer（堆外 / 直接缓冲区）

  操作系统本地内存（堆外，C 堆），不在 JVM 堆中，通过操作系统 `malloc` 分配，不受 GC 直接管控。

  底层依赖 `sun.misc.Unsafe` 操作内存地址。

  分配：`UnpooledDirectByteBuf`、池化 `PooledDirectByteBuf`

---

**二、核心读写流程差异**

- **HeapBuffer 写网卡流程**

  Java 堆 → 内核临时 Direct 缓冲区 → 网卡

  - JDK 底层需要**临时拷贝**：把堆内 byte [] 复制到一块临时堆外内存；

  - 再调用 write 系统调用发送；

  - **一次网络写多一次内存拷贝，**高吞吐下开销明显。

- **DirectBuffer 写网卡流程**

  堆外内存 → 网卡

  无需中间拷贝，直接交给内核发送，**零拷贝基础**。

- **读网卡流程同理**

  - HeapBuffer：内核数据先读到临时堆外，再拷贝到 Java 堆 byte []；两次拷贝

  - DirectBuffer：内核直接读到堆外内存，**一次拷贝**

### Netty 内存池和非内存池区别，默认使用哪个？

Netty **4.x 全局默认：PooledByteBufAllocator（池化）**

---

**PooledByteBufAllocator 池化分配器**

**原理**

预先向操作系统申请一块**连续大块堆 / 堆外内存**，维护一套内存池（基于 jemalloc 内存分配算法）。

程序需要 ByteBuf 时，从池中切一小块复用；释放时不归还操作系统，放回池缓存复用。

分为池化堆缓冲 `PooledHeapByteBuf`、池化堆外缓冲 `PooledDirectByteBuf`。

**优点**

- **分配 / 释放性能极高**

  避免频繁调用操作系统 `malloc/free`，减少系统调用开销；高并发频繁创建销毁 ByteBuf 场景 CPU 大幅降低。

- **减少内存碎片**

  统一大块内存管理，不会频繁申请释放小块堆外内存产生大量碎片。

- **降低 Full GC 频率**

  堆外内存复用，不会频繁创建、回收 DirectBuffer，减少堆外内存回收触发的 FullGC。

- **适配高并发网关、RPC、IM、百万长连接等生产场景。**

**缺点**

- 启动时会预先占用一部分内存，进程常驻内存更高；
- 内存池实现复杂，少量极端场景可能出现池内内存泄漏（引用计数没释放）。

---

**UnpooledByteBufAllocator 非池化分配器**

**原理**

每次创建 ByteBuf 都**直接向 JVM / 操作系统申请全新内存**，释放时立刻还给系统。

对应 `UnpooledHeapByteBuf`、`UnpooledDirectByteBuf`。

**优点**

1. 实现简单，无内存池缓存，进程闲置时内存占用更低；
2. 不会存在池内缓存内存无法释放的问题，调试简单。

**缺点**

1. 频繁读写场景下，反复 malloc/free，系统调用多，CPU 开销大；
2. 大量 DirectBuffer 频繁创建销毁极易产生堆外内存碎片；
3. 大量堆外缓冲区回收时容易触发 Full GC，高并发下吞吐下降。

---

| 对比项   | PooledByteBufAllocator（池化，默认）        | UnpooledByteBufAllocator（非池化）               |
| -------- | ------------------------------------------- | ------------------------------------------------ |
| 内存管理 | 预分配大块内存，切块复用                    | 每次新建 / 释放，直接操作系统申请                |
| 分配性能 | 高，无频繁系统调用                          | 低，大量 malloc/free                             |
| 内存碎片 | 少，统一池化管理                            | 多，频繁小块堆外分配                             |
| GC 压力  | 小，缓冲区复用，回收少                      | 大，频繁销毁 DirectBuffer 易 FullGC              |
| 常驻内存 | 偏高，池缓存不释放给系统                    | 低，用完立即归还                                 |
| 适用场景 | 服务端、网关、RPC、高并发长连接（生产默认） | 测试程序、低并发短连接、Android 客户端、简单工具 |

### Netty 内存泄漏检测

**Netty 内存泄漏检测 = 引用计数 + 弱引用 + 引用队列 + 抽样跟踪 + 栈记录**，用来检测 “ByteBuf 被 GC 了但业务没调用 release” 的释放底层内存的泄漏。

---

**为什么会漏**

Netty **直接内存（Direct Memory）/ 池化内存**靠自己管理，不受 JVM GC 直接管理，而是由 Netty 自己的生命周期管理

- ByteBuf 是 ReferenceCounted：
  - 初始 `refCnt=1`
  - `retain()` → +1
  - `release()` → -1；**减到 0 才真正释放内存（还给堆 / 池）**

---

**问题的本质**

- JVM 只负责 Java 对象是否可达，但 JVM 不认识 Netty 的引用计数
- 如果业务忘了 `release()` → `refCnt` 永远不为 0
- 但 `ByteBuf` 对象本身没人引用了 → 于是 ByteBuf 对象**被 JVM GC 掉**
- 结果：**直接内存没释放，对象 GC 没了 → 典型堆外内存泄漏**Netty

---

**核心组件：ResourceLeakDetector**

负责给 `ByteBuf` 加 “跟踪壳”，关键成员：

```java
class ResourceLeakDetector<T> {
    Set<DefaultResourceLeak<?>> allLeaks;   // 所有正在跟踪的 leak
    ReferenceQueue<Object> refQueue;        // 弱引用被 GC 时入队
    Level level;                             // 检测级别
    int samplingInterval;                    // 抽样间隔（默认 1%）
}
```

---

**检测原理：弱引用 + 引用队列**

分配时：

包装成 “可跟踪” 的 ByteBuf，按**抽样率**（默认 1%）决定是否跟踪当前 `ByteBuf`，抽样命中 → 创建 **DefaultResourceLeak（继承 WeakReference）**。

- 把 `ByteBuf` 包成弱引用
- 加入 `allLeaks`，关联到 `refQueue`
- 记录**分配 / 访问堆栈**（高级级别）

放回 `LeakAwareByteBuf` 给业务用



**正常释放**：release → 取消跟踪

业务正确 `release()`：

- `refCnt` 到 0 → 释放底层内存
- 调用 DefaultResourceLeak#close()
  - 从 `allLeaks` 移除
  - `clear()` 弱引用 → **不会进 refQueue**
- 安全，不报泄漏



**泄漏发生**：没 release → GC 后入队

- 业务**没调用 release** → `refCnt` 永不为 0
- 业务不再引用 `ByteBuf` → **JVM GC 回收 ByteBuf 对象**
- 因为是**弱引用**，GC 时把 `DefaultResourceLeak` 加入 `refQueue`



检测触发：Netty 不会专门开后台线程检测泄漏，而是在“下一次分配 ByteBuf”时顺便扫描。下次分配时扫队列

**每次新分配 ByteBuf 时**：

- `ResourceLeakDetector` 去 `refQueue.poll()`

- 拿到 DefaultResourceLeak → 说明：

  > ByteBuf 被 GC 了，但没 release → **内存泄漏！**

- 打日志：

```
LEAK: ByteBuf.release() was not called before it's garbage-collected.
```

---

通过 JVM 参数控制：`-Dio.netty.leakDetectionLevel=xxx`

- **DISABLED**：关闭，无开销
- **SIMPLE（默认）**：抽样 1%，只报泄漏，**无堆栈**
- **ADVANCED**：抽样 1%，**带分配 / 访问堆栈**（定位代码）
- **PARANOID**：抽样 100%，全量跟踪，**最准、开销最大**

![image-20260624203143662](./Netty%E7%9B%B8%E5%85%B3%E9%97%AE%E9%A2%98_img/image-20260624203143662.png)

### ByteBuf 的引用计数机制原理，什么时候必须手动释放？

底层字段：`refCnt`，初始值 = **1**。

- `retain()`：引用计数 +1
- `release()`：引用计数 -1

---

**Netty 自动释放场景（不用手动 release）**

Netty 流水线会自动帮你释放，**入站处理器 `channelRead` 中如果不传递、不持有 buf，无需手动释放**：

- `ChannelInboundHandler.channelRead(...)`
  - 如果你没有把 ByteBuf 存到集合 / 异步线程，也没有转发给下一个 Handler；
  - pipeline 尾部 `TailContext` 会自动执行 `buf.release()`。
- 调用 `ctx.writeAndFlush(buf)`
  - Netty 发送完毕后，内部自动 release，业务无需手动释放。
- 使用 `ByteBufUtil.readBytes`、复制出新 ByteBuf 且不持有原对象，原对象由 pipeline 释放。

---

**必须手动调用 release () /retain () 的所有场景**

- **场景 1：消费完数据，不再向后传递（不再调用 fireChannelRead）**

  如果不 release → refCnt 永远 = 1，堆外内存泄漏，进程内存持续上涨。

- **场景 2：将 ByteBuf 异步交给其他线程 / 业务线程池**

  IO 线程处理完把 buf 丢给异步线程，此时主线程退出 channelRead，tail 会自动 release 回收内存，异步线程拿到已销毁的 buf 报错。

  解决：异步传递前先 `retain()`，异步逻辑执行完再 `release()`。

### Netty 零拷贝体现在哪几个地方

**先区分两个概念**

1. **OS 底层零拷贝**：减少内核缓冲区与用户缓冲区之间的数据拷贝（`mmap`、`sendfile(FileRegion)`）
2. **Netty 应用层逻辑零拷贝**：不复制内存数据，仅包装引用，避免堆内内存拷贝（`CompositeByteBuf`、包装类 `WrappedBuffer`）

---

**一、FileRegion（sendfile 系统调用，文件传输零拷贝）**

**底层原理**

封装 JDK `FileChannel.transferTo()`，底层 Linux 调用 `sendfile()` 系统调用。传统文件发送流程（四次拷贝）：

1. 磁盘 → 内核页缓存（DMA）
2. 内核页缓存 → JVM 堆内存（CPU 拷贝）
3. JVM 堆 → Socket 内核缓冲区（CPU 拷贝）
4. Socket 缓冲区 → 网卡（DMA）

**sendfile 优化后（两次拷贝，无用户态参与）：**

1. 磁盘 → 内核页缓存（DMA）

2. 内核页缓存 → Socket 缓冲区（CPU 少量元数据拷贝）

   全程**不经过 JVM 用户堆**，**省去两次用户 / 内核态数据拷贝。**

**使用场景**：大文件下载、静态资源传输；

---

**二、mmap 内存映射（MappedByteBuffer）**

**原理**

`mmap` 将磁盘文件直接映射到**进程堆外虚拟内存**，操作系统页缓存和应用内存地址映射同一块空间。

传统读文件：磁盘→内核缓存→JVM 堆（两次拷贝）

mmap：磁盘数据加载到内核页缓存，应用直接通过堆外地址访问，**省去内核→用户堆 CPU 拷贝**。

Netty 中通过 `ByteBufAllocator.ioBuffer()` + `MappedByteBuffer` 封装使用。

**对比 FileRegion**

- mmap：可读可写，支持修改文件内容；
- FileRegion (sendfile)：只读发送，性能更高，适合纯下发文件。

**缺点**

mmap 会占用进程虚拟内存，大文件映射容易耗尽虚拟地址空间，需手动释放 `MappedByteBuffer`。

---

**三、CompositeByteBuf（逻辑拼接零拷贝，应用层）**

**问题背景**

业务常需要拼接多段缓冲区（请求头 + 请求体、多包合并），普通做法：开辟一块新内存，把多个 ByteBuf 数据全部复制进去，产生大量 CPU 拷贝。

**原理**

`CompositeByteBuf` 内部维护一个 ByteBuf 链表，**不复制任何底层数据**，仅保存每一段缓冲区的引用、偏移、长度；对外对外表现为一块连续逻辑缓冲区。遍历读取时依次遍历链表中的原始 buf，**底层内存互不拷贝。**

---

**四、Wrapped Buffer 包装缓冲区（slice /duplicate/ Unpooled.wrappedBuffer）**

**核心原理**

**完全共享底层原始内存，不复制数据，仅创建独立读写指针（index、mark）**，属于纯逻辑视图零拷贝。

1. `buf.slice(start, len)`：截取一段视图，共享底层内存，独立读写索引；
2. `buf.duplicate()`：完整复制视图，读写索引独立，底层内存共用；
3. `Unpooled.wrappedBuffer(bytes)`：把已有 byte [] 包装成 ByteBuf，不拷贝数组，直接引用原数组。

## 编解码 & 粘包拆包

### 什么是黏包和半包？

概念：

- **黏包：**发送 N 次独立消息，接收**一次 recv 读出多条拼在一起的数据**。一次性接收多条消息；	

  例：发`ABC`、`DEF`，收到`ABCDEF`

- **半包：**发送**1 条完整消息**，接收分多次读完，单次只拿到片段。**分好几次接收不完整的消息；**

  例：发`ABCDEF`，第一次收`ABC`、第二次收`DEF`

> 本质：**TCP 是流式字节流，只管可靠传字节，不分消息包边界；UDP 是报文，自带边界，无粘半包**

---

黏包产生原因：

- **发送端：Nagle 算法攒小包**

  短数据频繁 write，TCP 不会立刻发包，放到内核发送缓冲区凑大块一起发送，多条数据合并成一个 TCP 报文 → 接收一次性拿到多条 = 黏包。

- **接收端：读数据太慢**

  多个 TCP 报文陆续到达内核接收缓冲区堆积，应用一次 recv 把缓冲区全部读完，多条消息粘连。

> 无论大包小包，只要多条消息连续进入字节流，都可能一次 recv 读到一起，**不只小包才黏包**。

---

半包产生原因：

- **底层分片：MSS/MTU 限制**

  发送端应用数据 > MSS → **TCP 在本机提前拆分多段报文**（TCP 分段），分成多个 TCP 包发送，**这就是半包最核心来源之一**。

- **应用缓冲区太小**

  内核缓冲区已经存了完整消息，但你`recv(buf, 3)`接收 buf 只开 3 字节，一次只能读 3 个字节，剩余数据留在内核缓冲区，下次再读 → 半包。

> **MSS：TCP 单个报文能承载的「应用数据最大字节数」，不含 TCP 头、IP 头**。
>
> 以太网默认 MTU=1500： MSS=1500−20−20=1460

---

**多发少收→黏包；大包拆分 / 读区过小→半包**。

![6f13117b-8e80-47e9-861d-d3a35c83d2e4](./Netty%E7%9B%B8%E5%85%B3%E9%97%AE%E9%A2%98_img/6f13117b-8e80-47e9-861d-d3a35c83d2e4.png)

### Netty 四大内置拆包解码器

- **固定长度解码器**

  约定每条消息字节长度固定，每次累积缓冲区数据达到指定长度，就截取一条完整消息输出，剩余数据留存下次继续拼接。

- **换行分隔解码器**

  以换行符 `\n` 或 `\r\n` 作为消息结束分隔符，读到换行就截取一条消息；支持限制最大长度，超长抛异常防止恶意数据包攻击。

- **自定义分隔符解码器**

  自定义任意字节数组作为消息分隔标记（可单分隔符、双分隔符），读到分隔符切割消息；

- **长度域解码器（最常用，RPC / 私有二进制标准）**

  报文结构固定：**[消息头 (长度域) + 消息体]**

  读取指定偏移位置的长度字段，根据读出的长度值读取完整消息体，一次性拆分整条报文。

  ```java
  public LengthFieldBasedFrameDecoder(
      int maxFrameLength,        // 单条报文最大字节，防攻击
      int lengthFieldOffset,     // 长度域在报文中的偏移
      int lengthFieldLength,     // 长度域占用几个字节(1/2/4/8)
      int lengthAdjustment,      // 长度值修正量
      int initialBytesToStrip    // 输出时丢弃前面多少字节头
  )
  ```

### Netty 是如何处理黏包和半包的？

**Netty 是如何处理黏包的？**

- Netty 通过 **LengthFieldBasedFrameDecoder** 处理粘包。它会先读取**消息头里的长度字段**，知道整个数据包的大小，从而**准确分割出独立完整的消息**，避免多条消息粘在一起。

**Netty 是如何处理半包的？**

- Netty 通过 **LengthFieldBasedFrameDecoder** 处理半包。解码器**内部维护累积缓冲区**，如果当前收到的数据**不满足长度字段指定的大小**，就**暂存数据、继续等待**，直到凑够完整消息才向上传递，从根本上避免半包问题。

### Netty 的异常处理

**一、异常传播底层机制**

1. 所有异常统一通过 `ctx.fireExceptionCaught(Throwable)` 入站事件向后传递（head → tail）
2. 事件一旦在某个 Handler 被处理，**不继续调用 fireExceptionCaught**，传递终止；
3. 若整条 Pipeline 没有任何 Handler 处理异常，最终走到内置 `TailContext`，默认行为：
   - 打印异常日志；
   - 直接关闭当前 Channel。
4. 异常不分入站出站，统一走 `exceptionCaught(ctx, cause)` 方法。

---

**二、四类异常来源 & 产生场景**

- **解码异常（ByteToMessageDecoder / 内置拆包器）**
  - 报文超长 `TooLongFrameException`、非法长度、魔数不匹配、二进制格式错误；
  - decode () 抛出异常后自动触发 `fireExceptionCaught`，默认关连接。
- **业务 Handler 处理异常**
  - channelRead0、channelActive 等业务逻辑空指针、类型转换、自定义业务异常。
- **IO 底层网络异常**
  - 连接断开、重置、读写超时、SocketException、IOError、远程强制关闭。
- **出站编码 / 发送异常**
  - writeAndFlush 时序列化失败、缓冲区溢出、通道已关闭发送数据。

---

**三、三种异常处理方案（从局部到全局）**

**方案 1：局部 try-catch（仅单 Handler 内捕获，不扩散）**

适用：单条坏包不想断开整条长连接，只丢弃当前报文，继续服务后续数据。

```java
@Override
protected void decode(ChannelHandlerContext ctx, ByteBuf in, List<Object> out) throws Exception {
    try {
        // 报文解析逻辑
    } catch (Throwable e) {
        log.error("解析报文失败，丢弃当前包", e);
        in.clear(); // 清空本次脏数据，不向上抛异常
    }
}
```

**方案 2：自定义全局异常处理器（生产标准推荐）**

使用 `ChannelDuplexHandler`，放在 Pipeline**最后一位**，兜底捕获全链路所有异常，统一处理日志、错误响应、关闭策略、监控告警。

```java
public class GlobalExceptionHandler extends ChannelDuplexHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
        Channel channel = ctx.channel();
        String channelId = channel.id().asShortText();
        log.error("通道[{}]发生异常", channelId, cause);

        // 区分异常类型差异化处理
        if (cause instanceof TooLongFrameException) {
            // 报文超长，返回错误再关闭
            RespMsg error = new RespMsg(-1, "报文超出最大限制");
            sendErrAndClose(ctx, error);
        } else if (cause instanceof DecodeException) {
            RespMsg error = new RespMsg(-2, "非法协议报文");
            sendErrAndClose(ctx, error);
        } else if (cause instanceof IOException) {
            log.warn("客户端主动断开连接 channel:{}", channelId);
            ctx.close();
        } else {
            // 未知异常，直接关闭通道释放资源
            ctx.close();
        }
    }

    // 写完响应再关闭，防止消息丢失
    private void sendErrAndClose(ChannelHandlerContext ctx, RespMsg msg) {
        if (ctx.channel().isActive()) {
            ctx.writeAndFlush(msg).addListener(ChannelFutureListener.CLOSE);
        }
    }
}
```

---

**方案 3：重写 Handler 自身 exceptionCaught（分层处理）**

适用于需要单独处理本层专属异常（如编码异常、鉴权异常），处理后可选择是否继续向后传递：

```java
@Override
public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
    if (cause instanceof AuthException) {
        // 单独处理鉴权失败
        ctx.writeAndFlush(new RespMsg(-99, "未授权")).addListener(ChannelFutureListener.CLOSE);
    } else {
        // 其他异常继续向后抛给全局处理器
        super.exceptionCaught(ctx, cause);
    }
}
```

---

**四、关键配套工具：ChannelFutureListener 处理发送异常**

调用 writeAndFlush 返回 ChannelFuture，可监听发送是否失败：

```java
ctx.writeAndFlush(resp).addListener(future -> {
    if (!future.isSuccess()) {
        log.error("消息发送失败", future.cause());
        ctx.close();
    }
});
```

---

**五、超时类异常统一处理（IdleStateHandler）**

```java
@Override
public void userEventTriggered(ChannelHandlerContext ctx, Object evt) throws Exception {
    if (evt instanceof IdleStateEvent) {
        IdleStateEvent event = (IdleStateEvent) evt;
        if (event.state() == IdleState.ALL_IDLE) {
            log.warn("通道长时间无读写，关闭空闲连接");
            ctx.close();
        }
    } else {
        super.userEventTriggered(ctx, evt);
    }
}
```

## 网络可靠性、心跳、空闲检测

### Netty 空闲检测处理器

**一、核心作用**

检测 TCP 通道**长时间没有读、写、任何读写数据**，判定为空闲连接，触发空闲事件，开发者可主动关闭闲置长连接，解决两大线上问题：

1. **僵死连接**：客户端异常断网、断电、进程崩溃，没有发送四次挥手，服务端一直保留无效连接，占用文件句柄、内存；
2. **连接资源泄露**：大量闲置长连接堆积，打满系统句柄上限，新客户端无法接入；
3. **心跳保活配套**：结合空闲检测做心跳机制，长时间无交互主动断开。

`IdleStateHandler` 是 Netty 应用层空闲检测处理器，通过定时任务记录通道最后读写时间，超时抛出空闲用户事件；用于识别僵死长连接、实现心跳保活，主动释放闲置 TCP 通道，避免文件句柄耗尽，事件通过 `userEventTriggered` 捕获处理。

---

**二、构造方法三个核心超时参数**

```java
public IdleStateHandler(
    long readerIdleTimeSeconds,   // 读空闲：多久没收到客户端数据
    long writerIdleTimeSeconds,   // 写空闲：多久没向客户端发数据
    long allIdleTimeSeconds,      // 全空闲：既没读也没写
    TimeUnit unit
)
```

三种空闲状态（IdleState）

- `READER_IDLE`：读空闲，超过指定时间客户端没发任何数据；
- `WRITER_IDLE`：写空闲，服务端长时间没主动下发消息；
- `ALL_IDLE`：全空闲，双向长时间无数据交互（业务最常用）。

---

**三、底层实现原理**

- 内部基于 NioEventLoop 的定时任务 `schedule()`，不新开线程，无额外线程开销；
- 每次通道发生读 / 写事件时，刷新最后读写时间戳；
- 定时轮询对比当前时间与最后读写时间，超过阈值则向 Pipeline 抛出 `IdleStateEvent` 用户事件；
- 事件属于用户自定义事件，**不会进入 exceptionCaught**，必须重写 `userEventTriggered()` 捕获。

### IdleStateHandler 实现服务端心跳检测 + 清理僵死连接

**一、整体思路**

1. 客户端定时发**心跳包（Ping）**；
2. 服务端通过 `IdleStateHandler` 监控**读空闲**：超时没收到任何客户端数据（含心跳），判定客户端掉线 / 断网；
3. 触发空闲事件后主动关闭 Channel，释放无效连接；
4. 配套心跳响应（Pong），客户端确认服务端在线。

参数设计建议

- 客户端：每 10s 发送一次 Ping 心跳；
- 服务端读空闲超时设为 15s：连续 15s 没收到客户端任何数据（业务消息 / 心跳）就断开。

---

**二、实现步骤**

- 步骤 1：Pipeline 添加 IdleStateHandler

  放在**拆包解码器前面**，保证所有读事件都刷新时间戳：

- 步骤 2：自定义 HeartBeatHandler 处理心跳 + 空闲断开

  - 收到客户端 Ping 心跳，立即返回 Pong；
  - 捕获 `READER_IDLE` 空闲事件，关闭死连接。

---

**三、底层执行流程**

- 客户端正常：每 10s 发 Ping → 服务端触发读操作，刷新空闲计时，永远不会超时；
- 客户端正常下线：发送关闭信号，Channel 正常关闭；
- 客户端异常断网 / 断电 / 崩溃：不会发四次挥手，服务端无任何读事件；
  - 15s 后 IdleStateHandler 触发 `READER_IDLE` 用户事件；
  - `userEventTriggered` 捕获事件，执行 `ctx.close()`；
  - 释放该连接占用的文件句柄、内存，防止僵死连接堆积。

### TCP 原生 KeepAlive 和 Netty IdleStateHandler 区别

**一、底层本质完全不同**

**① TCP KeepAlive（操作系统内核层）**

属于 TCP 协议栈内置机制，**内核定时发送空 TCP ACK 探测包**，完全不经过应用程序，和业务数据无关。

```
tcp_keepalive_time = 7200    # 连接闲置2小时才开始探测
tcp_keepalive_intvl = 75     # 探测包间隔75s
tcp_keepalive_probes = 9     # 连续9次失败判定断开
```

Netty 开启方式：

```
serverSocketChannelOption(ChannelOption.SO_KEEPALIVE, true);
```

**② IdleStateHandler（Netty 应用层）**

基于 EventLoop 定时任务，**只统计业务 ByteBuf 读写事件**，只识别应用层数据；

无业务报文（心跳 / 业务消息）才会触发空闲事件，由业务代码自主控制断开逻辑。

---

**二、核心对比**

| 对比维度         | TCP KeepAlive 内核保活                                       | IdleStateHandler 应用层空闲检测                              |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 层级             | OS 内核 TCP 栈，不占用应用线程                               | Netty 应用层，绑定 IO 线程定时任务                           |
| 检测依据         | 纯 TCP 空探测包，**不看业务数据**                            | 只看业务读写 ByteBuf，TCP 空包无效                           |
| 超时精度         | 默认 2 小时起步，粒度粗，调内核参数需改服务器配置            | 秒级自定义（15s/30s），代码控制无需改服务器                  |
| 能否感知应用卡死 | 不能。客户端进程卡死但网络正常，内核 ACK 正常交互，连接不会断 | 能。客户端不发业务心跳直接判定僵死，精准识别客户端假死       |
| 业务联动能力     | 无，只能单纯断开连接，无法回复心跳 Pong、打印业务日志、告警  | 可自定义：回复心跳、记录连接、告警、优雅关闭、区分读写 / 全空闲 |
| 网络代理穿透     | 部分网关 / 负载均衡会丢弃 TCP Keepalive 探测包，失效         | 业务心跳是正常数据包，代理正常转发，稳定性更高               |
| 资源开销         | 极低，内核处理无应用开销                                     | 极低，复用 EventLoop 已有定时任务，无额外线程                |
| 配置方式         | 需修改系统内核参数，全局生效，容器环境改配置麻烦             | 代码内配置，单服务独立控制，容器 / 云环境无限制              |

### Netty 断线重连怎么实现？客户端断开后自动重试连接？

**一、核心思路**

1. 监听通道关闭事件 `channelInactive`、连接失败 `connectFuture.isFailure()`；
2. 连接断开 / 失败后，**延迟一定时间**提交重连任务到 EventLoop；
3. 重连任务必须丢到当前旧通道的 EventLoop，保证线程安全；
4. 指数退避重试（避免风暴式并发重连打垮服务端），设置最大重试间隔。

**关键约束**

重连逻辑不能新开普通线程池，必须使用 `ctx.channel().eventLoop().schedule()`：

- Channel、Bootstrap 非线程安全，只有归属的 EventLoop 线程能操作；
- 复用 IO 线程定时能力，无额外线程开销。

---

**二、完整方案**

- 客户端启动类 + 重连入口

  ```java
   // 底层连接逻辑
      private void doConnect() {
          ChannelFuture future = bootstrap.connect(host, port);
          future.addListener((ChannelFutureListener) f -> {
              if (f.isSuccess()) {
                  // 连接成功，重置退避时间
                  currentDelay = INIT_DELAY;
                  System.out.println("连接服务端成功");
              } else {
                  // 连接失败，触发重连
                  System.err.println("连接失败，" + currentDelay + "ms后重试");
                  scheduleReconnect(f.channel().eventLoop());
              }
          });
      }
  
      // 延迟重连：指数退避
      public void scheduleReconnect(EventLoop loop) {
          loop.schedule(() -> {
              doConnect();
              // 翻倍延迟，不超过最大值
              currentDelay = Math.min(currentDelay * 2, MAX_DELAY);
          }, currentDelay, TimeUnit.MILLISECONDS);
      }
  ```

- 业务处理器：监听通道关闭，触发重连

  ```java
  public class ClientBusinessHandler extends ChannelInboundHandlerAdapter {
      private final NettyReconnectClient client;
  
      public ClientBusinessHandler(NettyReconnectClient client) {
          this.client = client;
      }
  
      // 通道断开触发（服务端主动关闭、网络断连、空闲关闭都会进来）
      @Override
      public void channelInactive(ChannelHandlerContext ctx) {
          System.err.println("通道断开，准备重连");
          // 交给客户端调度重连
          client.scheduleReconnect(ctx.channel().eventLoop());
      }
  
      // 读写异常断开
      @Override
      public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
          System.err.println("通道异常：" + cause.getMessage());
          ctx.close(); // 关闭通道后触发 channelInactive 自动重连
      }
  }
  ```

---

**三、两种触发重连的场景**

1. **连接建立阶段失败**（服务未启动、端口不通、网络不通）

   `bootstrap.connect().addListener` 监听到 `isFailure()`，调度延迟重连；

2. **连接成功后中途断开**（服务端关闭、断网、空闲超时、IO 异常）

   - 通道关闭触发 `channelInactive()`；
   - 读写异常 `exceptionCaught` 手动 close，间接触发 `channelInactive`；

   统一调用 `scheduleReconnect` 重试。

### Netty 的出站缓冲区

**一、什么是出站缓冲区**

每个 `Channel` 内部持有一块**发送缓冲区（ChannelWriteBuffer）**，属于应用层缓冲，在 Netty 层面，位于用户代码与操作系统 Socket 发送缓冲区之间。

**底层是双向链表队列**，缓存待发送的 ByteBuf / Java 对象；

调用 `ctx.write(msg)` / `ctx.writeAndFlush(msg)` 时数据先进入这块缓冲区，而非直接调用系统 send。

两个核心区分：

1. **Netty 应用层出站缓冲区**：Netty 自己管理，ByteBuf 排队队列；
2. **OS Socket 发送缓冲区**：内核 TCP 缓冲区，操作系统管理。

---

**二、write () 和 writeAndFlush () 的本质区别**

- `ctx.write(msg)`
  - 只把消息写入**Channel 出站缓冲区队列**，**不触发底层系统调用发送**，数据停留在 Netty 内存，不会刷到网卡。
  - 适用场景：批量组装多条消息，最后统一一次 flush，减少系统调用提升性能。
- `ctx.flush()`
  - 把缓冲区中所有排队数据，一次性写入操作系统 Socket 发送缓冲区。
- `ctx.writeAndFlush(msg)`
  - 等价 `write + flush`：写入缓冲区并立刻刷新发送。

### Netty 发送缓冲区高低水位

**一、核心概念**

每个 Channel 有独立**Netty 应用层出站发送缓冲区**（待发送消息队列总字节数），通过 `WriteBufferWaterMark` 设置两个阈值：

- `lowWaterMark` 低水位（默认 32KB）
- `highWaterMark` 高水位（默认 64KB）

这是 Netty 实现**流量反压**的核心机制，用来防止下游消费慢、网络阻塞时，无限堆积待发送 ByteBuf 导致 OOM。

---

**二、水位线触发逻辑**

**① 缓冲区字节上涨，超过高水位 highWaterMark**

当排队待发数据总字节 ≥ highWaterMark：

- `channel.isWritable()` 返回 **false**；
- 触发 `channelWritabilityChanged(ctx)` 用户事件；
- 含义：发送队列积压严重，网络 / 对端消费跟不上，**不能再大量生产消息写入**，否则内存持续暴涨。

**② 后续 flush 发送，缓冲区回落至低水位 lowWaterMark 以下**

数据不断刷到内核 Socket 缓冲区，队列总字节 ≤ lowWaterMark：

- `channel.isWritable()` 变回 **true**；
- 再次触发 `channelWritabilityChanged(ctx)`；
- 含义：积压缓解，可恢复正常推送消息。

> 关键：不会中间状态一低于 high 就恢复，必须跌到 low 才恢复可写，避免频繁切换抖动。

---

**三、isWritable () 作用**

```
channel.isWritable()` / `ctx.channel().isWritable()
```

用来判断当前通道发送缓冲区是否过载：

- true：缓冲区压力正常，放心 write 数据；
- false：发送队列积压严重，执行限流、暂停推送。

适用场景：IM 推送、网关下行、服务端主动批量下发消息。

### Netty 消息下发推送积压

**积压直观表现**

- `channel.isWritable()` 返回 `false`，触发 `channelWritabilityChanged` 不可写事件；
- 内存持续上涨（大量 Direct 堆外 ByteBuf 无法 release）；
- 消息发送延迟越来越高，推送卡顿；
- 严重堆外内存溢出 OOM、GC 频繁；
- 大量未完成的 ChannelFuture 堆积，发送回调迟迟不执行；
- 监控看到单连接出站字节数只增不减。

---

**根本成因（四大类）**

**1）下游消费速度跟不上上游生产速度（最常见）**

IM、消息推送、网关下行场景：服务端疯狂发消息，客户端读逻辑阻塞 / 处理慢，客户端 OS 接收缓冲区打满，TCP 滑动窗口缩为 0，内核无法接收更多数据，Netty 队列持续堆积。

**2）网络链路阻塞**

跨机房、弱网、高延迟、防火墙限流、带宽打满、专线故障，TCP 传输速率极低。

**3）代码错误导致数据无法刷出**

1. 只调用 `write()`，忘记 `flush()` / `writeAndFlush`，数据永久卡在 Netty 队列；
2. 批量 write 但长时间不 flush，刻意攒包逻辑忘记统一刷新；
3. EventLoop 线程被同步阻塞（DB、RPC、循环计算），无法执行 flush 系统调用。

**4）对端僵死连接**

客户端断电、断网、进程崩溃，无四次挥手，TCP 窗口卡死，内核缓冲区满，发送一直阻塞。

---

**排查流程**

- **步骤 1：判断是否真的发送队列积压**

  - **方式 1：代码埋点监控水位与可写状态**，在 `channelWritabilityChanged` 打印日志：
  - **方式 2：JVM 诊断工具查看 ByteBuf 内存占用**
    - `jmap -dump:format=b,file=netty.hprof 进程号` 导出堆快照；
    - MAT 分析：筛选 `PooledDirectByteBuf` / `UnpooledDirectByteBuf`，看哪个 Channel 持有海量缓冲区；
    - 若大量 ByteBuf 归属同一个 Channel，就是该连接发送队列积压。
  - **方式 3：监控指标**：埋点采集每个 Channel 出站待发送字节、总连接待发字节，指标持续走高无回落 = 积压。

- **步骤 2：区分是「Netty 队列堵」还是「TCP 内核缓冲区堵」**

  排查 TCP 滑动窗口（内核层面）

  - **Linux 命令查看连接 TCP 状态：**

    ```
    # 查看TCP滑动窗口、接收缓冲区、发送缓冲区
    ss -it state ESTABLISHED
    ```

    - `cwnd` 很小：`cwnd`：拥塞窗口，数值越小代表网络越差
    - `rcvwnd=0`：客户端内核接收缓冲区**完全满了**，告诉发送方「不要再发任何数据」；

    - 发送端 `Send-Q` 队列数值持续很大：内核发送缓冲区塞满。

  - **查看 TCP 重传**：segments retransmited 重传计数

    ```
    netstat -s | grep TCP
    ```

    TCP 重传包数量暴涨 → 网络链路故障、丢包导致发送卡住。

- **步骤 3：分层定位根因**

  - **根因 A：EventLoop IO 线程阻塞**（代码问题）：抓取线程栈 `jstack 进程号`；
    - **根因 B：只 write 不 flush，代码遗漏刷新**：检索项目代码，是否存在循环 write，末尾无 flush；
  - **根因 C：客户端消费慢、TCP 窗口 0（下游瓶颈）**：`ss` 看到对端 `rcvwnd=0`；服务端内存持续涨，断开客户端后内存立刻回落；服务端发送前判断 `channel.isWritable()`，不可写时限流、缓存消息、暂停推送；
  - **根因 D：网络故障、丢包、跨机房延迟高**：`ping / mtr` 查看延迟、丢包率；TCP 重传计数持续上涨（`segments retransmited`）；
  - **根因 E：僵死连接堆积（客户端异常断连）**：大量 ESTABLISHED 假连接，无数据交互；解决：配置读空闲检测，超时主动 close 通道，释放堆积缓冲区。

## Netty 核心优化 & 底层机制

### Netty 开启内存池有什么性能提升？

- **大幅减少系统调用 malloc /free**

  非池化 Unpooled 每次创建 Direct Buffer：直接调用操作系统 `malloc` 申请堆外内存；释放调用 `free`。高并发下每秒成千上万次系统调用，用户态↔内核态频繁上下文切换，CPU 损耗极高。

  **池化逻辑**：启动时预分配大块连续内存块，业务申请 ByteBuf 时从池内切割小块复用；释放不还给 OS，放回缓存复用**消除高频 malloc/free，CPU 显著下降**。

- **减少堆外内存碎片（DirectBuffer 关键痛点）**

  Direct 堆外内存频繁小块申请、释放会产生大量内存碎片：

  操作系统内存不连续，后续大内存分配失败，触发频繁 Full GC 回收堆外内存，STW 卡顿。

  Pooled 基于 jemalloc 内存管理思路，统一大块内存管理，按规格分缓存池，碎片极少。

- **降低 Full GC 频率**

  堆外内存依靠堆内`DirectByteBuffer`的虚引用 Cleaner 回收，大量缓冲区对象晋升到老年代后，Young GC 无法清理；当堆外占用达到`MaxDirectMemorySize`阈值，JDK 会强制 Full GC 扫描全堆回收虚引用释放堆外内存；非池化频繁分配释放产生大量碎片，分配大块内存失败时会反复触发 Full GC，造成长时间 STW 业务卡顿。

  池化内存长期复用，堆外内存块生命周期长，不会频繁创建销毁，Full GC 大幅减少，服务吞吐、延迟更稳定。

- **分配 / 释放速度更快**

  内存池内部是无锁缓存（ThreadLocalCache），每个 IO 线程自有缓存块，本地分配无需竞争锁；

  非池化每次都走操作系统内存分配，耗时远高于池内缓存取用。

- **高吞吐、小包场景优势放大**

  RPC、网关、IM 每秒十万级报文，大量临时 ByteBuf 创建销毁；池化复用内存块，减少内存操作耗时，整体 QPS 提升明显。

### Netty 为什么这么快

**一、底层 IO 模型层面**

- **基于 IO 多路复用，单线程处理万级连接**

  Java NIO / Linux Epoll，一个 IO 线程通过一个 Selector 监听成千上万个 Channel，不用一连接一线程（BIO）。

  - BIO：1 连接 = 1 线程，百万连接直接线程爆炸、上下文切换拉满；

  - Netty：少量 EventLoop 线程即可承载十万长连接，线程切换开销极低。

- **Linux 环境原生 Epoll 边缘触发 ET，碾压 JDK 自带 poll**

  - JDK NIO 底层 Linux 用 poll，水平触发 LT，每次轮询重复返回就绪 fd，无效系统调用多；

  - Netty Epoll：内核原生 epoll，ET 边缘触发，仅状态变更通知一次，减少大量空轮询、系统调用、上下文切换；

  - 彻底解决 JDK NIO 经典**空轮询 CPU 100% bug**，线上稳定性大幅提升。

- **区分 Boss/Worker 职责，分工隔离无竞争**

  - BossGroup：固定 1 线程只做 accept、建立连接，轻量无瓶颈；

  - WorkerGroup：纯负责读写、编解码、业务逻辑，职责拆分互不干扰；

  新连接分发使用轮询分配到不同 EventLoop，连接负载均衡。

---

**二、线程模型设计（无锁是最大提速点）**

**单 Channel 绑定唯一 EventLoop，天然无锁**

一条连接所有读、写、事件、handler 执行，永远固定在同一个 IO 线程。

- 业务代码不需要对 Channel 加锁，消除锁竞争、CAS、阻塞等待；
- 普通 Java 多线程并发场景大量锁开销在这里完全消失。

---

**三、内存管理极致优化（减少 GC、减少系统调用）**

- **PooledByteBufAllocator 堆内外内存池（默认开启）**
  - 复用大块内存，消除频繁 `malloc/free` 系统调用，减少用户态内核态切换；
  - 减少堆外内存碎片，避免频繁 Full GC；
  - 减少大量 DirectByteBuffer 小对象创建，降低虚引用扫描 STW 停顿。
- **零拷贝机制，减少数据内存拷贝**
  - **堆外 DirectBuffer**：网卡读写直接操作堆外内存，不用 JVM 堆 <-> 内核缓冲区二次拷贝；
  - `FileRegion` sendfile 零拷贝：文件下发直接内核转发，不经过应用进程；
  - CompositeByteBuf 组合缓冲区：逻辑拼接多个 Buffer，不做实际内存复制。

---

**五、发送队列流量控制，防止雪崩 OOM**

**高低水位 WriteBufferWaterMark 做应用层反压：**

- 下游消费慢、网络拥堵时，通过 `isWritable()` 限流，不再疯狂写入消息；
- 避免 DirectBuffer 无限堆积、堆外内存暴涨、Full GC 卡顿、服务雪崩；

普通原生 NIO 需要自己实现队列限流，Netty 原生内置。

## Netty/Linux 的参数调整

![9125d187-131e-4a35-8d07-0e9b9ba09897](./Netty%E7%9B%B8%E5%85%B3%E9%97%AE%E9%A2%98_img/9125d187-131e-4a35-8d07-0e9b9ba09897.png)

**TCP 底层参数调优**

服务端：

1. SO_BACKLOG —— 全连接队列大小，**处理全连接队列溢出**，高并发必调大。
2. SO_REUSEADDR —— 端口复用，重启快速绑定端口，避免端口占用报错。

客户端

1. SO_KEEPALIVE —— TCP 保活，清理死连接，防止 CLOSE_WAIT、FD 泄漏。长连接用的，通过周期性发送探测数据包。
2. TCP_NODELAY —— 禁用 Nagle 算法（必开），**禁用小包合并，降低延迟**，高并发必开。
3. SO_RCVBUF / SO_SNDBUF —— 接收 / 发送缓冲区，大流量、高吞吐场景调大。
   1. 如果发送缓冲区太小，发送方发送的数据可能会被阻塞，直到缓冲区有足够的空间来存储数据。如果发送缓冲区太大，可能会导致过多的内存占用；通常调成带宽和延时的乘积；
   2. TCP 数据接收缓冲区大小；通常调成带宽和延时的乘积；



### BossGroup / WorkerGroup 线程数

- **BossGroup 固定 1** 即可（**accept 本身是极轻量内核操作，没有业务逻辑、无阻塞 IO，速度极快**，单线程完全扛住上万并发建连，不存在瓶颈。，不需要多线程）

- **WorkerGroup**

  - **方案 1：线程数 = CPU 核心数（CPU 密集型）**

    如果你的 Handler 内部有大量计算、序列化、加密、复杂业务逻辑，CPU 容易打满。

    线程数等于物理核，避免 CPU 频繁上下文切换。

  - **方案 2：线程数 = CPU 核数 × 2（IO 密集型，Netty 默认）**

    适用：RPC、网关、IM，Handler 里会同步调用 DB、Redis、第三方 HTTP 接口。

    - IO 阻塞时线程会空闲等待，CPU 资源没利用；
    - 多一倍线程可以让其他连接的读写逻辑占用空闲 CPU，提升整体吞吐；
    - 现代服务器大多有超线程（1 核 2 线程），×2 刚好匹配超线程架构。

> Worker 线程不能过多 / 过少，过多切换开销大，过少容易线程阻塞引发全连接卡顿、发送队列积压。

### SO_SNDBUF / SO_RCVBUF

二者是**操作系统内核 TCP 缓冲区大小**，和 Netty 应用层出站水位缓冲区是两层完全独立的缓存：

- `SO_SNDBUF`：内核**发送缓冲区**（写缓冲）

  程序调用 write 发送数据，先拷贝到这里，内核再分批发给网卡；

- `SO_RCVBUF`：内核**接收缓冲区**（读缓冲）

  网卡收到数据先存入这里，应用调用 read 再取走。

---

Netty 代码里配置 `SO_SNDBUF`、`SO_RCVBUF` 只是**单连接的缓冲区上限**，真正能生效的最大值受系统全局内核参数封顶：

- `/proc/sys/net/core/wmem_max`：所有连接 SO_SNDBUF 最大允许值
- `/proc/sys/net/core/rmem_max`：所有连接 SO_RCVBUF 最大允许值

---

**情况 1：你的 Netty 设置值 ≤ 默认 wmem_max/rmem_max**

**不用改 Linux 参数**，代码配置直接生效。

Linux 默认一般是 128KB、256KB，绝大多数 RPC、IM、网关默认够用。

**情况 2：你想设置更大缓冲区（比如 512KB、1MB）**

代码里写 `SO_SNDBUF = 1024*1024`，但系统 `wmem_max` 只有 262144，**设置直接失效，内核只会给到上限值**，必须手动调大 `wmem_max / rmem_max`。

> **普通微服务 RPC、短请求、小包通讯**
>
> 默认内核缓冲上限足够，完全不需要修改 wmem_max/rmem_max；
>
> **文件上传下载、视频流、海量下行推送、跨机房高吞吐**
>
> 需要调大内核全局上限，才能让 Netty 配置的大缓冲区生效，减少系统调用、提升吞吐。

### 端口复用 SO_REUSEADDR（服务端）

**允许一个端口「快速被重复使用」，解决重启服务报错：Address already in use**

TCP 连接关闭后会进入 `TIME_WAIT` 状态（默认 2MSL，通常 1 分钟），此时内核会锁住该端口，防止旧连接残留报文干扰新服务。

开启 `SO_REUSEADDR` 后：

- 进程退出后无需等待 TIME_WAIT 结束，立刻重新绑定同一个端口；
- 同一机器多个进程可绑定**相同端口、不同 IP**；
- 多实例灰度、服务快速重启、容器频繁启停必备。



**为什么需要端口复用？**（最核心 2 个原因）

① 服务重启 / 崩溃后，能快速重新启动

这是**最常用、最重要**的原因。

线上场景：

- 你的 Netty 服务用了 **8080 端口**
- 突然 kill 掉、重启、发布新版本
- 正常情况下：**端口被系统占着，不让你立刻绑定**
- 开启 SO_REUSEADDR：**立刻就能绑定重启**

② 高并发短连接下，防止端口被 TIME_WAIT 占死

TCP 主动关闭连接的一方会进入 **TIME_WAIT**（等待 2MSL，大约 1 分钟）。

如果不开启端口复用：

- 大量 TIME_WAIT 占用端口
- 新连接无法绑定端口 → **服务无法建立连接**

开启后：

- 可以**快速复用**处于 TIME_WAIT 的端口
- 保证高并发下端口不会枯竭

### 消除小包延迟 TCP_NODELAY（客户端）

关闭 Nagle 算法，**消除小包延迟**，低延迟通信必备。

- **Nagle 算法默认行为（TCP_NODELAY=false）**
  - 内核会缓存小数据包，攒到一定大小或收到对端 ACK 才批量发送，目的减少网络小包、降低带宽损耗。
  - 副作用：高频短报文（RPC、心跳、IM）会出现**毫秒级延迟毛刺**。
- TCP_NODELAY=true 效果
  - 禁用缓存，应用调用 write 后报文立刻发往网卡，无攒包等待，延迟极低。

**适用 / 不适用场景**

✅ 开启：RPC、微服务、IM、游戏、心跳包（高频小包，追求低延迟）

❌ 关闭：文件传输、大文件下载（追求带宽，不在乎延迟）

### TCP 半连接队列 + 全连接队列 SO_BACKLOG（服务端）

设置 TCP **半连接队列 + 全连接队列总长度上限**，控制服务端能积压多少待接受 TCP 连接。

**TCP 三次握手两个队列**

1. **半连接队列（SYN 队列）**：客户端发 SYN，服务回 SYN+ACK，未完成握手；

2. **全连接队列（ACCEPT 队列）**：三次握手完整完成，等待应用程序 `accept()` 取走连接。

   `SO_BACKLOG` 限制**全连接队列最大长度**。

**队列满会发生什么？**

全连接队列打满后，新完成握手的连接直接丢弃；高并发建连场景出现**客户端连接超时、Connection refused**。

服务启动瞬间大量客户端同时建立长连接，全连接队列溢出，客户端连不上服务，调大 backlog 缓解。

---

- **全连接队列长度（SO_BACKLOG 要和它对齐）**：min(backlog,somaxconn)，net.core.somaxconn，somaxconn 是Linux内核参数，默认128，可通过/proc/sys/net/core/somaxconn进行配置；业务的 listen(fd, backlog) 的 backlog；
- **半连接队列长度**：tcp_max_syn_backlog，内核参数，通过/proc/sys/net/ipv4/tcp_max_syn_backlog来设置；net.core.somaxconn，somaxconn 是Linux内核参数，默认128，可通过/proc/sys/net/core/somaxconn进行配置；业务 tcp 调用 listen(fd, backlog) 的 backlog；
  - TIME_WAIT 回收（高并发长连接必开），net.ipv4.tcp_tw_reuse = 1，**复用 TIME_WAIT 端口**，解决端口耗尽问题。

---

```
net.ipv4.tcp_syncookies = 1
```

半连接队列打满兜底，抵御 SYN 洪水攻击，生产必须开启。当半连接队列打满时，内核不再存储半连接信息，利用客户端 IP + 端口 + 时间加密生成 cookie 放在 SYN+ACK 中；

### TCP 保活 SO_KEEPALIVE（客户端）

开启操作系统内核层 TCP 保活探测，用来**检测底层网络链路是否断开**（网线拔断、断电、路由故障、防火墙断流等无四次挥手的场景）。

开启 SO_KEEPALIVE 后由这三个参数控制探测时机：

- `tcp_keepalive_time`：连接空闲多久无数据，才开始发送保活探测包，默认 7200s（2 小时）。
- `tcp_keepalive_intvl`：探测包发送间隔，默认 75s。
- `tcp_keepalive_probes`：连续多少次探测无 ACK，判定连接死亡，内核直接关闭 TCP。

底层探测逻辑：

- 通道长时间无任何收发数据，达到 `tcp_keepalive_time`；
- 内核自动发送**空 TCP ACK 探测包**（不含业务数据）；
- 收到对端 ACK → 链路正常，重置计时；
- 连续多次无应答 → 内核标记连接失效，主动断开 Socket。

### 高低水位

每个 Channel 独立拥有**应用层出站发送队列**，所有 `write()` 未刷入内核 Socket 的 ByteBuf 字节总和会实时统计。

通过 `WriteBufferWaterMark` 配置两个阈值：

- `lowWaterMark` 低水位：默认 32KB
- `highWaterMark` 高水位：默认 64KB

作用：实现**流量反压**，防止下游消费慢、网络拥堵时无限堆积发送数据，堆外内存暴涨 OOM。

---

- 数据上涨，超过 highWaterMark

  队列总字节 ≥ 高水位：

  - `channel.isWritable()` 返回 `false`

  - 触发 `channelWritabilityChanged()` 事件

    含义：发送积压严重，不能继续大量下发消息，必须限流。

- 持续 flush 发送，数据回落至 lowWaterMark 以下

  内核不断取走数据，队列字节 ≤ 低水位：

  - `channel.isWritable()` 变回 `true`
  - 再次触发 `channelWritabilityChanged()`

  含义：积压缓解，恢复正常推送。

> 关键点：不会一低于高水位就恢复可写，必须跌到低水位才放开，避免频繁抖动、反复切换状态。

### 文件句柄 ulimit

- **文件句柄（最大连接数靠它**）：程序最多可以打开的文件数目。因为对于服务器网络应用来说，每个连接的建立都需要打开一个 「文件」。具体而言，**在建立 TCP 连接时，系统将为每个 TCP 连接创建一个 Socket 句柄，也就是文件句柄**。但是 Linux 系统对每个进程能够打开的文件句柄数量做了限制，如果超出限制就会报错，默认是 1024。通过 **ulimit -n [xxx]** 命令增大允许的文件句柄数目。可以考虑将 ulimit 命令作为启动脚本的一部分；


```
[im_user@bjvpc22-202 ~]$ ulimit -a
core file size          (blocks, -c) unlimited
data seg size           (kbytes, -d) unlimited
scheduling priority             (-e) 0
file size               (blocks, -f) unlimited
pending signals                 (-i) 61386
max locked memory       (kbytes, -l) 64
max memory size         (kbytes, -m) unlimited
open files                      (-n) 655350
pipe size            (512 bytes, -p) 8
POSIX message queues     (bytes, -q) 819200
real-time priority              (-r) 0
stack size              (kbytes, -s) 8192
cpu time               (seconds, -t) unlimited
max user processes              (-u) 61386
virtual memory          (kbytes, -v) unlimited
file locks                      (-x) unlimited
```

