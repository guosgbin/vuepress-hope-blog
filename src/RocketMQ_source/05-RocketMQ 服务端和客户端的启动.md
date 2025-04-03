---
title: 05-RocketMQ 服务端和客户端的启动
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2023年06月07日22:28:39 |

## RocketMQ 内的服务端和客户端

RocketMQ 中有四种角色，各个角色内部对应 Netty 服务端和客户端的角色如下：

- NameServer：服务端，因为 Broker 需要和 NameServer 维护心跳，Producer 和 Consumer 都需要从 Nameserver 获取路由信息；
- Broker（master 和 salve）：服务端和客户端。和 NameServer 维护心跳时作为客户端；在与 Producer 和 Consumer 交互时是作为服务端的；
- Producer：客户端。从 NameServer 拉取路由信息；发送消息到 Broker；
- Consumer：客户端。从 NameServer 拉取路由信息；从 Broker 拉取消息；

本篇不会分析所有的客户端和服务端的启动流程，它们的代码基本上都是 Netty 的模板代码。以 NameServer 为例分析服务端的启动，以 Broker 为例分析客户端的启动。

## NameServer 服务端启动

在 NameServer 的启动流程中，会调用 NamesrvController#start 方法，如下：

```java
public void start() throws Exception {
    // 服务器网络层启动
    this.remotingServer.start();

    if (this.fileWatchService != null) {
        this.fileWatchService.start();
    }
}
```

调用了 NettyRemotingServer#start 方法去启动服务端。启动服务端的代码基本上就是 Netty 服务端的模板代码。基本流程就是创建主 Reactor 线程组和从 Reactor 线程组，然后创建 ServerBootstrap 对象，最后绑定端口启动服务端。

### 创建主从 Reactor 线程组

创建注册 Reactor 线程组的代码并不在 NamesrvController#start 方法中，而是在 NettyRemotingServer 的构造方法中。根据 useEpoll() 方法来决定是使用 Epoll 还是 NIO 的线程组。

```java
public NettyRemotingServer(final NettyServerConfig nettyServerConfig,
    final ChannelEventListener channelEventListener) {
    // 服务器向客户端主动发起请求时，并发限制
    // 1.单向请求的并发限制
    // 2.异步请求的并发限制
    super(nettyServerConfig.getServerOnewaySemaphoreValue(), nettyServerConfig.getServerAsyncSemaphoreValue());
    // Netty 服务端
    this.serverBootstrap = new ServerBootstrap();
    // Netty 的一些配置
    this.nettyServerConfig = nettyServerConfig;
    // Netty 的一些事件
    this.channelEventListener = channelEventListener;

    // ...... 省略 publicExecutor 线程池的代码......

    // 创建两个 Netty 线程组，Boss 和 Worker
    if (useEpoll()) {
        // 创建 Epoll Boss 线程组
        this.eventLoopGroupBoss = new EpollEventLoopGroup(1, new ThreadFactory() {
            // ...... 省略线程工厂的代码 ......
        });

        // I/O 线程池
        this.eventLoopGroupSelector = new EpollEventLoopGroup(nettyServerConfig.getServerSelectorThreads(), new ThreadFactory() {
            // ...... 省略线程工厂的代码 ......
        });
    } else {
        // 创建 Nio 线程组
        this.eventLoopGroupBoss = new NioEventLoopGroup(1, new ThreadFactory() {
            // ...... 省略线程工厂的代码 ......
        });

        // I/O 线程组
        this.eventLoopGroupSelector = new NioEventLoopGroup(nettyServerConfig.getServerSelectorThreads(), new ThreadFactory() {
            // ...... 省略线程工厂的代码 ......
        });
    }

    loadSslContext();
}
```

### 创建 ChannelHandler 使用的线程池

在真正进行业务操作前还需要经过一些 ChannelHandler 进行处理，例如 SSL 相关、网络数据编解码等等。可以为这些 ChannelHandler 指定一个线程池，让其使用这个线程池来处理任务。回到 NettyRemotingServer#start 方法：

```java
// 当向 ChannelPipeline 添加 Handler 指定了 group，
// 网络 I/O 事件传播到当前 Handler 时，事件处理由分配给 Handler 的线程执行
this.defaultEventExecutorGroup = new DefaultEventExecutorGroup(
    nettyServerConfig.getServerWorkerThreads(),
    new ThreadFactory() {

        private AtomicInteger threadIndex = new AtomicInteger(0);

        @Override
        public Thread newThread(Runnable r) {
            return new Thread(r, "NettyServerCodecThread_" + this.threadIndex.incrementAndGet());
        }
    });
```

### 创建可共享的 ChannelHandler

Netty 服务端中有一些 ChannelHandler 是可共享的，其实就是它们是线程安全的。主要有：

- HandshakeHandler：处理 SSL 的；
- NettyEncoder：数据编码工作；
- NettyConnectManageHandler：监听 Channel 变化的；
- NettyServerHandler：真正处理业务的处理器；

```java
private void prepareSharableHandlers() {
    handshakeHandler = new HandshakeHandler(TlsSystemConfig.tlsMode);
    // 编码器
    encoder = new NettyEncoder();
    // 监听 Channel 变化的 Handler
    connectionManageHandler = new NettyConnectManageHandler();
    // 根据 RemotingCommand 中的 type 和 code 做不同的业务处理
    serverHandler = new NettyServerHandler();
}
```

### 创建 ServerBootstrap 对象

没什么好说的，就是创建 ServerBootstrap 对象。

- 赋值主从 Reactor 线程组；
- 设置服务端的 TCP 参数；
- 设置客户端的  TCP 参数；
- 设置客户端出站缓冲区的高低水位；
- 设置 Netty 是否使用池化内存；

```java
ServerBootstrap childHandler =
    this.serverBootstrap.group(this.eventLoopGroupBoss, this.eventLoopGroupSelector)
        .channel(useEpoll() ? EpollServerSocketChannel.class : NioServerSocketChannel.class)
        .option(ChannelOption.SO_BACKLOG, nettyServerConfig.getServerSocketBacklog())
        .option(ChannelOption.SO_REUSEADDR, true)
        .option(ChannelOption.SO_KEEPALIVE, false)
        .childOption(ChannelOption.TCP_NODELAY, true)
        .localAddress(new InetSocketAddress(this.nettyServerConfig.getListenPort()))
        .childHandler(new ChannelInitializer<SocketChannel>() {
            @Override
            public void initChannel(SocketChannel ch) throws Exception {
                // 添加客户端管道
                ch.pipeline()
                        // 指定线程池
                    .addLast(defaultEventExecutorGroup, HANDSHAKE_HANDLER_NAME, handshakeHandler)
                    .addLast(defaultEventExecutorGroup,
                        encoder,
                        new NettyDecoder(),
                        new IdleStateHandler(0, 0, nettyServerConfig.getServerChannelMaxIdleTimeSeconds()),
                        connectionManageHandler,
                        serverHandler
                    );
            }
        });
if (nettyServerConfig.getServerSocketSndBufSize() > 0) {
    log.info("server set SO_SNDBUF to {}", nettyServerConfig.getServerSocketSndBufSize());
    childHandler.childOption(ChannelOption.SO_SNDBUF, nettyServerConfig.getServerSocketSndBufSize());
}
if (nettyServerConfig.getServerSocketRcvBufSize() > 0) {
    log.info("server set SO_RCVBUF to {}", nettyServerConfig.getServerSocketRcvBufSize());
    childHandler.childOption(ChannelOption.SO_RCVBUF, nettyServerConfig.getServerSocketRcvBufSize());
}
// 设置 Netty 的出站缓冲区的高低水位，控制读写，防止 OOM
// 出站缓冲区的数据大于 高水位，通道置于不可写状态，直到出站缓冲区的数据小于 低水位，通道置于可写状态
if (nettyServerConfig.getWriteBufferLowWaterMark() > 0 && nettyServerConfig.getWriteBufferHighWaterMark() > 0) {
    log.info("server set netty WRITE_BUFFER_WATER_MARK to {},{}",
            nettyServerConfig.getWriteBufferLowWaterMark(), nettyServerConfig.getWriteBufferHighWaterMark());
    childHandler.childOption(ChannelOption.WRITE_BUFFER_WATER_MARK, new WriteBufferWaterMark(
            nettyServerConfig.getWriteBufferLowWaterMark(), nettyServerConfig.getWriteBufferHighWaterMark()));
}

if (nettyServerConfig.isServerPooledByteBufAllocatorEnable()) {
    childHandler.childOption(ChannelOption.ALLOCATOR, PooledByteBufAllocator.DEFAULT);
}
```

### 绑定端口启动服务端

NameServer 绑定 9876 端口，启动 NameServer 服务。

```java
try {
    // 绑定端口 9876
    ChannelFuture sync = this.serverBootstrap.bind().sync();
    InetSocketAddress addr = (InetSocketAddress) sync.channel().localAddress();
    this.port = addr.getPort();
} catch (InterruptedException e1) {
    throw new RuntimeException("this.serverBootstrap.bind().sync() InterruptedException", e1);
}
```

## Broker 客户端启动

目光关注到 BrokerController#start 方法

```java
public void start() throws Exception {
    // ...... 省略其他模块的启动 ......

    // broker 作为 Netty 服务端启动
    if (this.remotingServer != null) {
        this.remotingServer.start();
    }

    // broker 作为 Netty 服务端启动，vip 通道
    if (this.fastRemotingServer != null) {
        this.fastRemotingServer.start();
    }

    // ...... 省略其他模块的启动 ......

    // broker 作为 Netty 客户端
    if (this.brokerOuterAPI != null) {
        this.brokerOuterAPI.start();
    }

    // ...... 省略其他模块的启动 ......
}
```

Broker 中启动了两个服务端 remotingServer 和 fastRemotingServer，关于它们的区别我后面文章具体分析。

调用了 BrokerOuterAPI#start 启动客户端。其中 BrokerOuterAPI 内部封装了 RemotingClient。这个 BrokerOuterAPI#start  方法很简单，就是调用内部封装的 NettyRemotingClient 的 start 方法。

```java
public void start() {
    this.remotingClient.start();
}
```

那么接下来分析下 Broker 作为客户端的启动流程

### 创建 Reactor 线程组

创建 Reactor 线程组的操作在 NettyRemotingClient 的构造方法中：

```java
public NettyRemotingClient(final NettyClientConfig nettyClientConfig,
                            final ChannelEventListener channelEventListener) {
    // ...... 省略其他操作 ......

    // NEtty 的 worker 线程组，一个线程池
    this.eventLoopGroupWorker = new NioEventLoopGroup(1, new ThreadFactory() {
        private AtomicInteger threadIndex = new AtomicInteger(0);

        @Override
        public Thread newThread(Runnable r) {
            return new Thread(r, String.format("NettyClientSelector_%d", this.threadIndex.incrementAndGet()));
        }
    });

    // ...... 省略其他操作 ......
}
```

### 创建 ChannelHandler 使用的线程池

和 NameServer 服务端一样需要创建一个 ChannelHandler 处理时使用的线程池

```java
// 创建 Netty Handler 使用的线程池，默认 4 个
this.defaultEventExecutorGroup = new DefaultEventExecutorGroup(
    nettyClientConfig.getClientWorkerThreads(),
    new ThreadFactory() {

        private AtomicInteger threadIndex = new AtomicInteger(0);

        @Override
        public Thread newThread(Runnable r) {
            return new Thread(r, "NettyClientWorkerThread_" + this.threadIndex.incrementAndGet());
        }
    });
```

### 创建 Bootstrap 对象

```java
Bootstrap handler = this.bootstrap.group(this.eventLoopGroupWorker)
    .channel(NioSocketChannel.class)
    .option(ChannelOption.TCP_NODELAY, true)
    .option(ChannelOption.SO_KEEPALIVE, false)
    .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, nettyClientConfig.getConnectTimeoutMillis())
    .handler(new ChannelInitializer<SocketChannel>() {
        @Override
        public void initChannel(SocketChannel ch) throws Exception {
            ChannelPipeline pipeline = ch.pipeline();
            if (nettyClientConfig.isUseTLS()) {
                if (null != sslContext) {
                    pipeline.addFirst(defaultEventExecutorGroup, "sslHandler", sslContext.newHandler(ch.alloc()));
                    log.info("Prepend SSL handler");
                } else {
                    log.warn("Connections are insecure as SSLContext is null!");
                }
            }
            // 添加 Handler 到管道，使用指定线程池
            pipeline.addLast(
                defaultEventExecutorGroup,
                new NettyEncoder(),
                new NettyDecoder(),
                new IdleStateHandler(0, 0, nettyClientConfig.getClientChannelMaxIdleTimeSeconds()),
                new NettyConnectManageHandler(),
                new NettyClientHandler());
        }
    });
if (nettyClientConfig.getClientSocketSndBufSize() > 0) {
    log.info("client set SO_SNDBUF to {}", nettyClientConfig.getClientSocketSndBufSize());
    handler.option(ChannelOption.SO_SNDBUF, nettyClientConfig.getClientSocketSndBufSize());
}
if (nettyClientConfig.getClientSocketRcvBufSize() > 0) {
    log.info("client set SO_RCVBUF to {}", nettyClientConfig.getClientSocketRcvBufSize());
    handler.option(ChannelOption.SO_RCVBUF, nettyClientConfig.getClientSocketRcvBufSize());
}
// Netty 写缓冲区高低水位
if (nettyClientConfig.getWriteBufferLowWaterMark() > 0 && nettyClientConfig.getWriteBufferHighWaterMark() > 0) {
    log.info("client set netty WRITE_BUFFER_WATER_MARK to {},{}",
            nettyClientConfig.getWriteBufferLowWaterMark(), nettyClientConfig.getWriteBufferHighWaterMark());
    handler.option(ChannelOption.WRITE_BUFFER_WATER_MARK, new WriteBufferWaterMark(
            nettyClientConfig.getWriteBufferLowWaterMark(), nettyClientConfig.getWriteBufferHighWaterMark()));
}
```

### 连接服务端

需要注意的是在调用 NettyRemotingClient#start 客户端启动后，并没有直接连接服务端。以 Broker 为例，在向服务端发送请求的时候才会去尝试连接服务端。例如 broker 向 NameServer 注册自己的请求，会调用 BrokerOuterAPI#registerBroker 方法，最终会调用 NettyRemotingClient#invokeSync 方法，如下：

```java
@Override
public RemotingCommand invokeSync(String addr, final RemotingCommand request, long timeoutMillis)
    throws InterruptedException, RemotingConnectException, RemotingSendRequestException, RemotingTimeoutException {
    long beginStartTime = System.currentTimeMillis();
    // 获取或者创建一个客户端和服务端的通道 Channel
    final Channel channel = this.getAndCreateChannel(addr);
    // 校验通道的状态，条件成立则说明客户端和服务端的通到已经连接，可以通信
    if (channel != null && channel.isActive()) {
        // ...... 省略发送 RPC 的操作 ......
    } else {
        this.closeChannel(addr, channel);
        throw new RemotingConnectException(addr);
    }
}
```

关键点就是这一行代码，参数 addr 就是我们要访问的 NameServer 的地址和端口。

```java
final Channel channel = this.getAndCreateChannel(addr);
```

那么继续查看 NettyRemotingClient#getAndCreateChannel 方法

```java
private Channel getAndCreateChannel(final String addr) throws RemotingConnectException, InterruptedException {
    if (null == addr) {
        return getAndCreateNameserverChannel();
    }

    // 从 channelTables 中查找可用的连接 Channel
    ChannelWrapper cw = this.channelTables.get(addr);
    if (cw != null && cw.isOK()) {
        // 返回已经存在的 Channel
        return cw.getChannel();
    }

    // 创建新的 Channel
    return this.createChannel(addr);
}
```

这个方法就是从本地 HashMap 缓存中尝试获取已经存在的连接，假如不存在就调用 NettyRemotingClient#createChannel 去创建一个新的连接。

```java
private Channel createChannel(final String addr) throws InterruptedException {
    // ...... 省略其他操作 ......

    // 连接指定地址的服务器
    ChannelFuture channelFuture = this.bootstrap.connect(RemotingHelper.string2SocketAddress(addr));
    log.info("createChannel: begin to connect remote host[{}] asynchronously", addr);
    cw = new ChannelWrapper(channelFuture);
    // 添加到映射表
    this.channelTables.put(addr, cw);

    // ...... 省略其他操作 ......
}
```

## 小结

本篇文章分析了 NameServer 作为服务端的启动流程，Broker 作为客户端的启动流程。对于 Broker 作为服务器的启动流程、还有 Producer 和 Comsumer 作为客户端的启动流程我们有分析，其实它们的流程和前文分析的都大同小异。