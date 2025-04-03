---
title: 13-MappedFile和MappedFileQueue分析
---



| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年08月10日21:10:24 |
| V2   | 重构 | 2023年06月18日17:23:49 |

## 引入

RocketMQ 中存储的三个存储相关的文件 CommitLog、ComsumeQueue 和 IndexFile 这些类的底层都是基于 MappedFile 来实现的，所以在分析这些类之前需要先了解 MappedFile 类。

MappedFile 中用的是 mmap 技术，具体的 mmap 技术可以去看这篇文章 <a href='https://www.cnblogs.com/huxiao-tee/p/4660352.html#4008787'>mmap 是什么</a> 

内存映射是一种将文件的一部分直接映射到进程的虚拟地址空间中，使得这部分区域的访问就像访问内存一样。在使用内存映射时，应用程序不需要调用系统调用来读取或写入文件内容，而是可以通过对内存地址的直接访问来完成操作。

内存映射创建了一个虚拟地址空间范围，它可以被当作一个数组来访问。与普通的数组不同的是，内存映射数组的内容实际上是存储在文件中的。当应用程序访问内存映射数组时，操作系统会自动将相应的文件数据读取到内存中。

内存映射技术具有以下特点：

1. **避免了频繁的系统调用**：内存映射技术可以减少I/O系统调用的次数，提高访问文件的效率。
2. **简化了文件访问**：使用内存映射技术可以将文件访问看作是对内存的访问，简化了应用程序的代码和运行逻辑。
3. **共享内存**：多个进程可以同时共享同一个文件的内存映射，使得进程之间的通信更加高效。
4. **可以实现随机访问**：内存映射技术可以实现对文件的随机访问，从而支持大型文件的读写。

但是，内存映射技术也有一些限制。由于内存映射是将文件直接映射到内存中，所以需要足够的内存来存储文件数据。此外，使用内存映射技术时需要注意控制内存区域的大小，以免过度消耗系统资源。

## MappedFile

### MappedFile 继承体系

```java
public class MappedFile extends ReferenceResource {
    // ...
}
```

MappedFile 继承抽象类 ReferenceResource。

### ReferenceResource 分析

ReferenceResource 是引用计数相关的抽象类

ReferenceResource 的字段如下

```java
public abstract class ReferenceResource {
    // 引用数量，初始值 1，当引用数量 <= 0 的时候，表示该资源可以释放了，没有任何其他程序依赖它了
    protected final AtomicLong refCount = new AtomicLong(1);
    // 是否存活，false 表示资源处于非存活状态，不可用
    protected volatile boolean available = true;
    // 是否已经清理了，当调用了子类的 cleanup 方法后，该值设置为 true，表示资源已经全部释放了
    protected volatile boolean cleanupOver = false;
    // 第一次 shutdown 时间，第一次关闭资源可能会失败，
    // 比如说外部程序还依赖当前资源 refCount > 0，此时在这记录初次关闭的时间，
    // 之后再次关闭该资源的时候，会传递一个 interval 参数，如果   系统当前时间 - firstShutdownTimestamp > interval，则强制关闭
    private volatile long firstShutdownTimestamp = 0;
}
```

关于这个类的方法，既然是引用计数相关的，那重要的方法就两个了，

1. 使用资源，增加引用计数；
2. 释放资源，减少引用计数；

具体方法细节后面分析

### MappedFile 属性

```java
public class MappedFile extends ReferenceResource {
    public static final int OS_PAGE_SIZE = 1024 * 4;
    protected static final InternalLogger log = InternalLoggerFactory.getLogger(LoggerName.STORE_LOGGER_NAME);
    private static final AtomicLong TOTAL_MAPPED_VIRTUAL_MEMORY = new AtomicLong(0);
    private static final AtomicInteger TOTAL_MAPPED_FILES = new AtomicInteger(0);
    protected final AtomicInteger wrotePosition = new AtomicInteger(0);
    protected final AtomicInteger committedPosition = new AtomicInteger(0);
    private final AtomicInteger flushedPosition = new AtomicInteger(0);
    protected int fileSize;
    protected FileChannel fileChannel;
    protected ByteBuffer writeBuffer = null;
    protected TransientStorePool transientStorePool = null;
    private String fileName;
    private long fileFromOffset;
    private File file;
    private MappedByteBuffer mappedByteBuffer;
    private volatile long storeTimestamp = 0;
    private boolean firstCreateInQueue = false;
}
```

| 属性                                   | 作用                                                         |
| -------------------------------------- | ------------------------------------------------------------ |
| int OS_PAGE_SIZE                       | 操作系统内存页的大小，默认 4 KB                              |
| AtomicLong TOTAL_MAPPED_VIRTUAL_MEMORY | 当前 Java 进程中所有的 MappedFile 占用的总虚拟内存的大小     |
| AtomicInteger TOTAL_MAPPED_FILES       | 当前 Java 进程下所有的 MappedFile 的个数                     |
| AtomicInteger wrotePosition            | 当前 MappedFile 文件的写指针，从 0 开始                      |
| AtomicInteger committedPosition        | 开启了 TransientStorePool 才会使用，表示 commit 提交指针，先 commit 到内存映射的 bytebuffer 中 |
| AtomicInteger flushedPosition          | MappedFile 数据的刷盘点， flushedPosition 之前的数据都是安全落盘的数据，flushedPosition 到 wrotePosition 之间的数据属于脏页 |
| int fileSize                           | MappedFile 文件的大小                                        |
| FileChannel fileChannel                | MappedFile 文件的通道                                        |
| ByteBuffer writeBuffer                 | 开启了 TransientStorePool 才会使用，先临时存储写入的消息     |
| TransientStorePool transientStorePool  | 堆外内存池，用于实现内存级别的读写分离。需要配置开启该机制   |
| String fileName                        | 当前 MappedFile 的文件名，就是 CommitLog 和 ConsumeQueue 的名字 |
| long fileFromOffset                    | 文件名转 long 的值，其实就是该文件的初始偏移量               |
| File file                              | 文件对象                                                     |
| MappedByteBuffer mappedByteBuffer      | 物理文件对应的内存映射缓冲区 buffer，访问虚拟内存            |
| long storeTimestamp                    | 文件最后一次写入的时间                                       |
| boolean firstCreateInQueue             | 当前文件如果是该目录下的第一个文件则为 true。其实就是是否是 MappedFileQueue 队列中的第一个文件 |

### MappedFile 初始化

接下来看 MappedFile 文件的创建，主要看 MappedFile#init(java.lang.String, int) 方法

```java
private void init(final String fileName, final int fileSize) throws IOException {
    // 文件名
    this.fileName = fileName;
    // 文件大小
    this.fileSize = fileSize;
    // 创建文件对象
    this.file = new File(fileName);
    // 文件名转 long，也就是该文件的初始偏移量
    this.fileFromOffset = Long.parseLong(this.file.getName());
    boolean ok = false;

    // 确定父级目录是否存在，不存在就创建一个
    ensureDirOK(this.file.getParent());

    try {
        // 创建文件通道
        this.fileChannel = new RandomAccessFile(this.file, "rw").getChannel();
        // 获取内存映射缓冲区
        // 将文件内容使用 NIO 的内存映射 Buffer 将文件映射到内存中
        this.mappedByteBuffer = this.fileChannel.map(MapMode.READ_WRITE, 0, fileSize);
        TOTAL_MAPPED_VIRTUAL_MEMORY.addAndGet(fileSize);
        TOTAL_MAPPED_FILES.incrementAndGet();
        ok = true;
    }
    
    // ...... 省略异常处理 ......
    
    } finally {
        if (!ok && this.fileChannel != null) {
            this.fileChannel.close();
        }
    }
}
```

很简单，就是创建一个文件 File，并将其映射到内存中，保存到 mappedByteBuffer 中。

### MappedFile 的主要 api

1. MappedFile#appendMessage：有一些重载方法，追加消息到 MappedFile 文件；
2. MappedFile#flush：刷盘方法，将内存中的数据写入磁盘；
3. MappedFile#selectMappedBuffer：创建 MappedByteBuffer 的副本，指定开始位置和大小做切片；
4. MappedFile#destroy：销毁映射文件对象，删除 MappedFile 对应的文件；
5. MappedFile#cleanup：释放堆外内存 mappedByteBuffer；

#### 写消息到 MappedFile

MappedFile#appendMessagesInner

```java
public AppendMessageResult appendMessagesInner(final MessageExt messageExt, final AppendMessageCallback cb,
        PutMessageContext putMessageContext) {
    // ...... 省略 ......

    // 获取当前内存映射文件的写指针
    int currentPos = this.wrotePosition.get();

    // 条件成立说明当前文件还未写满，可以继续写
    if (currentPos < this.fileSize) {
        // 创建内存切片
        ByteBuffer byteBuffer = writeBuffer != null ? writeBuffer.slice() : this.mappedByteBuffer.slice();
        // 将切片的 byteBuffer 设置数据写入位点
        byteBuffer.position(currentPos);
        AppendMessageResult result;
        if (messageExt instanceof MessageExtBrokerInner) {
            // case:单条消息
            /*
                * 向内存映射追加数据
                * param 1: 当前文件的起始偏移地址
                * param 2: 当前文件对应的 MappedByteBuffer slice 后的切片
                * param 3: 当前文件还剩多少空间可以写入
                * param 4: 需要写入的消息（就是根据生产者发送过来的消息，封装了个新的）
                * param 5:
                */
            result = cb.doAppend(this.getFileFromOffset(), byteBuffer, this.fileSize - currentPos,
                    (MessageExtBrokerInner) messageExt, putMessageContext);
        }
        // ...... 省略处理批量消息和异常的情况   ......

        // 更新数据写入位点，加上刚刚写入的数据量
        this.wrotePosition.addAndGet(result.getWroteBytes());
        // 保存最后一条 msg 的存储时间
        this.storeTimestamp = result.getStoreTimestamp();
        return result;
    }

    // ...... 省略 ......
}
```

写消息的流程

1. 首先获取当前文件的写指针的位置 currentPos ，校验当前 MappedFile 文件是否写满；
2. 获取内存切片，设置切片出来的 ByteBuffer 的指针为 currentPos；
3. 根据消息类型走不同的分支，就是调用 AppendMessageCallback#doAppend 方法去写入；
4. 更新当前 MappedFile 文件的写指针位置，保存最后一次写入的时间戳；

#### MappedFile#flush

MappedFile#flush

```java
/**
 * 刷盘，将内存中的数据写入磁盘，永久存储在磁盘中
 *
 * @param flushLeastPages 刷盘的最小页数 （等于 0 时，属于强制刷盘， > 0时，需要脏页数据达到 flushLeastPages 时才进行物理刷盘）
 * @return The current flushed position
 */
public int flush(final int flushLeastPages) {
    if (this.isAbleToFlush(flushLeastPages)) {
        if (this.hold()) { // 引用计数自增，保证刷盘过程中，不会释放资源
            // 获取数据写入位点
            int value = getReadPosition();

            try {
                //We only append data to fileChannel or mappedByteBuffer, never both.
                if (writeBuffer != null || this.fileChannel.position() != 0) {
                    this.fileChannel.force(false);
                } else {
                    // 落盘，将内存中的数据持久化到磁盘中
                    this.mappedByteBuffer.force();
                }
            } catch (Throwable e) {
                log.error("Error occurred when force data to disk.", e);
            }

            // 写入位点赋值给刷盘点
            this.flushedPosition.set(value);
            // 引用计数 -1
            this.release();
        } else {
            log.warn("in flush, hold failed, flush offset = " + this.flushedPosition.get());
            this.flushedPosition.set(getReadPosition());
        }
    }
    // 返回最新的刷盘点
    return this.getFlushedPosition();
}
```

刷盘方法，有一个参数 flushLeastPages ，

1. 当 flushLeastPages 小于等于 0 时，表示强制刷盘，只要有脏数据就刷盘；
2. 当 flushLeastPages 大于 0 时，需要脏页数据达到 flushLeastPages 时才进行刷盘；

在 MappedFile 中有个表示刷盘位点的指针 flushedPosition，还有表示写入位点的指针 wrotePosition。

 flushedPosition 到 wrotePosition 之间的数据就是脏数据，等待刷盘的数据，而 flushedPosition 之前的数据都是已经安全落盘的数据。



刷盘的流程：

1. 首先根据入参 flushLeastPages 校验当前是否可以进行刷盘；
2. 假如可以刷盘，就调用 ReferenceResource#hold 方法给当前 MappedFile 的引用计数加 1；
3. 调用 api 强制刷盘；
4. 更新刷盘点 flushedPosition，MappedFile 的引用计数减 1；

#### MappedFile#selectMappedBuffer

在看这个方法之前需要看一下 SelectMappedBufferResult 类的属性

```java
public class SelectMappedBufferResult {

    // 切片出来的 buffer 在 commitLog的偏移量
    private final long startOffset;

    // 切片出来的 buffer
    private final ByteBuffer byteBuffer;

    // 大小
    private int size;

    // 属于哪一个 mappedFile
    private MappedFile mappedFile;
}
```

| 属性        | 含义                                                         |
| ----------- | ------------------------------------------------------------ |
| startOffset | 从 MappedFile 中切片出来的 Buffer 的在 MappedFile 的物理偏移量 |
| byteBuffer  | 切片出来的 buffer                                            |
| size        | 切片出来的 buffer 的 size                                    |
| mappedFile  | 从那个 MappedFile 中切片出来的                               |



OK 那么来看切片方法了，看注释就行了。

```java
/**
 * 创建 mappedByteBuffer 副本
 * 会增加引用计数
 *
 * @param pos 开始位置
 * @param size 大小
 */
public SelectMappedBufferResult selectMappedBuffer(int pos, int size) {
    // 获取当前文件的写入位点
    int readPosition = getReadPosition();
    if ((pos + size) <= readPosition) {
        if (this.hold()) { // 增加引用计数
            ByteBuffer byteBuffer = this.mappedByteBuffer.slice();
            byteBuffer.position(pos);
            // 切片一个新的 buffer
            ByteBuffer byteBufferNew = byteBuffer.slice();
            byteBufferNew.limit(size);
            return new SelectMappedBufferResult(this.fileFromOffset + pos, byteBufferNew, size, this);
        } else {
            // ...... 省略日志打印 ......
        }
    } else {
       // ...... 省略日志打印 ......
    }

    return null;
}
```

#### MappedFile#destroy

销毁映射文件对象，删除 MappedFile 对应的文件；

```java
/**
 * 删除当前文件
 *
 * @param intervalForcibly 表示拒绝被销毁的最大存活时间
 * @return
 */
public boolean destroy(final long intervalForcibly) {
    // 关闭文件
    this.shutdown(intervalForcibly);

    if (this.isCleanupOver()) {
        try {
            // 关闭通道
            this.fileChannel.close();
            log.info("close file channel " + this.fileName + " OK");

            long beginTime = System.currentTimeMillis();
            // 删除文件
            boolean result = this.file.delete();
            // ...... 省略日志打印 ......
        } catch (Exception e) {
            log.warn("close file channel " + this.fileName + " Failed. ", e);
        }

        return true;
    } else {
        // ...... 省略日志打印 ......
    }

    return false;
}
```



需要看下 ReferenceResource#shutdown 方法

```java
/**
 * 关闭资源
 *
 * @param intervalForcibly 强制关闭的时间间隔
 */
public void shutdown(final long intervalForcibly) {
    if (this.available) {
        this.available = false;
        // 初次关闭时的系统时间
        this.firstShutdownTimestamp = System.currentTimeMillis();
        // 引用计数 -1，有可能释放了资源，也有可能未释放
        this.release();
    } else if (this.getRefCount() > 0) {
        // 校验当前时间和第一次尝试关闭的时间是否大于 传入的时间间隔
        if ((System.currentTimeMillis() - this.firstShutdownTimestamp) >= intervalForcibly) {
            this.refCount.set(-1000 - this.getRefCount());
            // 释放资源
            this.release();
        }
    }
}

public void release() {
    long value = this.refCount.decrementAndGet();
    if (value > 0)
        return;

    // 执行到这里，说明当前资源没有其他程序依赖了，可以调用子类的 cleanup 方法释放资源了
    synchronized (this) {

        // 调用子类释放内存
        this.cleanupOver = this.cleanup(value);
    }
}
```

调用 ReferenceResource#shutdown 方法有可能并不会立刻释放资源。

假如当前 MappedFile 引用次数很多的话，

1. 在第一次调用该方法会将 available 属性设置为 false，
2. 后续调用该方法时就会走下面的 else if 分支了，回去校验当前时间和 firstShutdownTimestamp 的时间间隔，再去调用 release 方法；

## MappedFileQueue

### MappedFileQueue 概述

MappedFileQueue 就是用来管理 MappedFile 文件的，里面有个 List 的属性用来存储 MappedFile 文件。

对于 CommitLog 来说，会有多个 CommitLog 文件，一个文件对应一个 MappedFile 对象，所以需要一个容器来管理这些 MappedFile 对象。

### MappedFileQueue 属性

```java
private static final int DELETE_FILES_BATCH_MAX = 10;
private final String storePath;
protected final int mappedFileSize;
protected final CopyOnWriteArrayList<MappedFile> mappedFiles = new CopyOnWriteArrayList<MappedFile>();
private final AllocateMappedFileService allocateMappedFileService;
protected long flushedWhere = 0;
private long committedWhere = 0;
private volatile long storeTimestamp = 0;
```

| 属性                      | 含义                                                         |
| ------------------------- | ------------------------------------------------------------ |
| DELETE_FILES_BATCH_MAX    | 常量，最大删除 MappedFile 文件的个数                         |
| storePath                 | MappedFileQueue 管理的目录，例如 commitLog: ../store/commitlog |
| mappedFileSize            | 目录下单个文件的大小，<br> commitLog文件默认 1g，<br>consumerQueue 文件默认 20 * 30w 字节 |
| mappedFiles               | 存放 MappedFile 的 List                                      |
| allocateMappedFileService | 创建 MappedFile 内存映射文件的服务，内部有自己的线程         |
| flushedWhere              | 目录下的当前刷盘指针，表示该指针之前的所有数据全部持久化到磁盘 |
| committedWhere            | 当前数据提交指针，内存中 ByteBuffer z当前的写指针，该值大于、等于 flushedWhere。 |
| storeTimestamp            | 当前目录下最后一条 msg 的存储时间                            |

### MappedFileQueue 构造方法

```java
/**
 * 创建 MappedFileQueue 对象
 *
 * @param storePath 存储的目录
 * @param mappedFileSize 单个 MappedFileSize 文件的大小
 * @param allocateMappedFileService 创建 MappedFile 文件的服务
 */
public MappedFileQueue(final String storePath, int mappedFileSize,
    AllocateMappedFileService allocateMappedFileService) {
    this.storePath = storePath;
    this.mappedFileSize = mappedFileSize;
    this.allocateMappedFileService = allocateMappedFileService;
}
```

### MappedFileQueue 的方法

关于 MappedFileQueue 方法就是一些针对 MappedFile 的操作，具体使用时分析（后续分析）

## 小结

RocketMQ 中的 CommitLog、ConsumeQueue 和 IndexFile 这些文件底层都是基于 MappedFile 来实现的。

MappedFile 自带简单的引用计数功能。

MappedFile 主要用了 mmap + pageCache 来实现的。
