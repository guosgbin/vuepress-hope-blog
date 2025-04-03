---
title: 15-客户端处理READ事件概述
date: 2022-03-10 09:04:53
tags: 
  - Netty
categories:
  - Netty
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年03月10日09:04:53 |
| V2   | 重构 | 2023年05月25日21:48:30 |

## 回顾

### NioEventLoop 处理 I/O 事件入口

 在上一篇文章中，主要分析了服务端处理客户端的连接，也就是处理 ACCEPT 事件。本篇主要分析客户端读取数据的逻辑，也就是处理 READ 事件。在 NioEventLoop#run 方法中，循环处理异步任务和 I/O 事件。NioEventLoop#run 方法伪代码如下：

```java
@Override
protected void run() {
    // epoll bug的一个特征计数变量
    int selectCnt = 0;
    for (;;) {
        try {
            // ....... 1. 检查是否有任务和就绪的I/O事件需要处理 ......
            // ....... 2. 处理任务和就绪I/O事件的 ......
        } catch (CancelledKeyException e) {
            // ....... 省略异常处理 ......
        } catch (Error e) {
            throw e;
        } catch (Throwable t) {
            handleLoopException(t);
        } finally {
                // ....... 3. 检查 Reactor 线程的状态，必要时走关闭流程 ......
            } catch (Error e) {
                throw e;
            } catch (Throwable t) {
                handleLoopException(t);
            }
        }
    }
}
```

当有 I/O 事件就绪后，就会调用 NioEventLoop#processSelectedKeys() 方法处理 I/O 事件，最终会调用到 NioEventLoop#processSelectedKey(SelectionKey, AbstractNioChannel) 方法，伪代码如下：

```java
/**
 * 处理通道 AbstractNioChannel 的IO事件
 */
private void processSelectedKey(SelectionKey k, AbstractNioChannel ch) {
    // NioServerSocketChannel -> NioMessageUnsafe
    // NioSocketChannel -> NioByteUnsafe
    final AbstractNioChannel.NioUnsafe unsafe = ch.unsafe();
   
   // ...... 省略一些校验 ......

    try {
        // 获取 IO 事件类型
        int readyOps = k.readyOps();

        if ((readyOps & SelectionKey.OP_CONNECT) != 0) {
            // 处理 OP_CONNECT 事件
        }

        if ((readyOps & SelectionKey.OP_WRITE) != 0) {
            // 处理 OP_WRITE 事件
        }

        // Also check for readOps of 0 to workaround possible JDK bug which may otherwise lead
        // to a spin loop
        if ((readyOps & (SelectionKey.OP_READ | SelectionKey.OP_ACCEPT)) != 0 || readyOps == 0) {
            // 处理 OP_READ、OP_ACCEPT 事件，和可能的 JDK NIO bug
            unsafe.read();
        }
    } catch (CancelledKeyException ignored) {
        // key失效则close这个channel
        unsafe.close(unsafe.voidPromise());
    }
}
```

本篇文章分析的入口就是 `unsafe.read()`，处理 READ 事件。因为分析的是客户端处理 READ 事件，所以此处的 Unsafe 实例是 AbstractNioByteChannel.NioByteUnsafe。

### NioSocketChannel 的创建流程

NioSocketChannel 的构造方法

```java
public NioSocketChannel(Channel parent, SocketChannel socket) {
    super(parent, socket);
    config = new NioSocketChannelConfig(this, socket.socket());
}
```

先是 super 调用父类的构造方法，调用父类的构造方法主要做的事情如下：

1. 创建 UnSafe 实例，对于客户端 NioSocketChannel 来说就是 NioByteUnSafe 实例；
2. 创建并初始化客户端的 Pipeline；
3. 赋值感兴趣的事件 READ；
4. 将 JDK 的客户端 Channel 设置为非阻塞模式；

这部分之前在分析启动流程时说过，这里主要分析 NioSocketChannelConfig 的创建流程。

NioSocketChannelConfig 的构造方法

```java
private NioSocketChannelConfig(NioSocketChannel channel, Socket javaSocket) {
    super(channel, javaSocket);
    calculateMaxBytesPerGatheringWrite();
}
```

calculateMaxBytesPerGatheringWrite 不知道干嘛的，先留一个坑 TODO-KWOK

super 调用父类的构造方法：

```java
public DefaultSocketChannelConfig(SocketChannel channel, Socket javaSocket) {
    super(channel);
    this.javaSocket = ObjectUtil.checkNotNull(javaSocket, "javaSocket");

    // Enable TCP_NODELAY by default if possible.
    if (PlatformDependent.canEnableTcpNoDelayByDefault()) {
        try {
            setTcpNoDelay(true);
        } catch (Exception e) {
            // Ignore.
        }
    }
}
```

这个构造方法主要做的事情就是设置了 TCP 的 TCP_NODELAY 属性。

继续 super 调用父类的构造方法：

```java
public DefaultChannelConfig(Channel channel) {
    // 创建 DefaultChannelConfig 对象，传入默认的 AdaptiveRecvByteBufAllocator
    this(channel, new AdaptiveRecvByteBufAllocator());
}
```

又看到 AdaptiveRecvByteBufAllocator 对象了，它的作用就是控制读循环次数和预测下次读数据的 ByteBuf 的大小。后面的构造方法重载就不分析了，主要就是设置默认的读循环次数为 16。

DefaultChannelConfig#setRecvByteBufAllocator(RecvByteBufAllocator, ChannelMetadata)

```java
private void setRecvByteBufAllocator(RecvByteBufAllocator allocator, ChannelMetadata metadata) {
    checkNotNull(allocator, "allocator");
    checkNotNull(metadata, "metadata");
    if (allocator instanceof MaxMessagesRecvByteBufAllocator) {
        // 设置 MaxMessagesRecvByteBufAllocator 的 maxMessagesPerRead 的默认值 16
        ((MaxMessagesRecvByteBufAllocator) allocator).maxMessagesPerRead(metadata.defaultMaxMessagesPerRead());
    }
    setRecvByteBufAllocator(allocator);
}
```

小结一下 NioSocketChannel 创建过程中做了什么事情：

1. 创建 UnSafe 实例，对于客户端 NioSocketChannel 来说就是 NioByteUnSafe 实例；
2. 创建并初始化客户端的 Pipeline；
3. 赋值感兴趣的事件 READ；
4. 将 JDK 的客户端 Channel 设置为非阻塞模式；
5. 设置了 TCP 的 TCP_NODELAY 属性；
6. 创建 AdaptiveRecvByteBufAllocator，并赋值默认读循环 16 次；

## NioByteUnsafe#read 方法整体流程

### 整体流程图

![客户端处理READ事件](./15-客户端处理READ事件概述/客户端处理READ事件.png)

### 客户端处理 READ 事件流程概述

NioByteUnsafe#read

```java
    /**
     * 1 通过 doReadBytes(byteBuf) 方法,从底层NIO 通道中读取数据到输入缓冲区ByteBuf 中。
     * 2 通过 pipeline.fireChannelRead(...) 方法，发送ChannelRead读取事件。
     * 3 通过 allocHandle.continueReading() 判断是否需要继续读取。
     * 4 这次读取完成，调用 pipeline.fireChannelReadComplete() 方法，发送 ChannelReadComplete 读取完成事件。
     */
    @Override
    public final void read() {
        // 获取客户端的配置Config对象
        final ChannelConfig config = config();
        if (shouldBreakReadReady(config)) {
            clearReadPending();
            return;
        }
        // 获取客户端的pipeline对象
        final ChannelPipeline pipeline = pipeline();
        // 获取缓冲区分配器，默认是PooledByteBufAllocator
        final ByteBufAllocator allocator = config.getAllocator();
        // 控制读循环和预测下次创建的bytebuf的容量大小
        final RecvByteBufAllocator.Handle allocHandle = recvBufAllocHandle();
        // 清空上一次读取的字节数，每次读取时搜重新计算
        allocHandle.reset(config);

        ByteBuf byteBuf = null;
        boolean close = false;
        try {
            do {
                // 参数是缓冲区内存分配器
                // allocHandle只是预测分配多大的内存`
                byteBuf = allocHandle.allocate(allocator);
                // doReadBytes(byteBuf) 读取当前Socket读缓冲区的数据到byteBuf对象中
                allocHandle.lastBytesRead(doReadBytes(byteBuf));
                // channel底层Socket读缓冲区 已经完全读取完毕会返回0，或者是Channel对端关闭了 返回-1
                if (allocHandle.lastBytesRead() <= 0) {
                    // nothing was read. release the buffer.
                    byteBuf.release();
                    byteBuf = null;
                    close = allocHandle.lastBytesRead() < 0;
                    if (close) {
                        // There is nothing left to read as we received an EOF.
                        // 此时是 -1
                        readPending = false;
                    }
                    break;
                }

                // 更新缓冲区预测分配器 读取消息数量
                allocHandle.incMessagesRead(1);
                readPending = false;
                // 因为 TCP 有粘包问题
                // 向客户端pipeline发送channelRead事件，该pipeline实现了channelRead的Handler就可以进行业务处理了
                pipeline.fireChannelRead(byteBuf);
                byteBuf = null;
            } while (allocHandle.continueReading());

            // 读取操作完毕
            allocHandle.readComplete();
            // 触发管道的fireChannelReadComplete事件
            pipeline.fireChannelReadComplete();

            if (close) {
                // 如果连接对端关闭了，则关闭读操作
                closeOnRead(pipeline);
            }
        } catch (Throwable t) {
            handleReadException(pipeline, byteBuf, t, close, allocHandle);
        } finally {
            // 假如读操作完毕，且没有配置自动读，则从选择的Key兴趣集中移除读操作事件
            if (!readPending && !config.isAutoRead()) {
                removeReadOp();
            }
        }
    }
}
```

客户端处理 READ 事件的主要流程如下：

1.  处理 TCP 半关闭（Half-Close）；
2.  获取缓存区分配器 ByteBufAllocator 和控制读循环和预测缓存大小的分配器 RecvByteBufAllocator.Handle；
3.  `allocHandle.reset(config)`，循环前重置一些数据，如清空上一次读取的字节数；
4.  do...while... 循环读取数据；
   1.  `allocHandle.allocate(allocator)` 预测当前循环需要使用多大的 ByteBuf；
   2.  通过 `doReadBytes(byteBuf)` 方法，从底层 NIO 通道中读取数据到输入缓冲区 ByteBuf 中，如果所有数据都读取完毕，或者对端关闭连接了，就退出循环；
   3.  `allocHandle.incMessagesRead(1)` 更新缓冲区预测分配器，增加读循环次数；
   4.  ` pipeline.fireChannelRead(byteBuf)`，向客户端 pipeline 发送 channelRead 事件；
   5.   while 循环的条件 `allocHandle.continueReading()`，判断是否允许继续循环读数据；
5.  处理自适应扩容缩容；
5.  当前次数数据读取完毕或者循环读到了上限 16 次（可能 16 次都没读完），`pipeline.fireChannelReadComplete()` 向客户端管道发送 channelReadComplete 事件；

## 小结

本篇只是分析了客户端处理 READ 事件的主要流程，详细步骤并没有分析。其实就是一个 do...while... 循环读取数据，每次读取到数据就向客户端 Pipeline 传递一个 channelRead 事件，当数据读取完毕或者到了读循环上限后，就会退出 while 循环，并且传递一个 channelReadComplete 事件。

可以看到关键点就是 AdaptiveRecvByteBufAllocator 对象了，会在下一篇详细分析这个对象的作用。