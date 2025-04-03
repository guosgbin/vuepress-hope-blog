---
title: 08-AQS简单介绍
---



| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年09月06日00:24:48 |

## AQS 简介

AbstractQueuedSynchronizer（后面简称为 AQS） 是整个 JUC 包的核心，JUC 包下的许多组件都是基于这个抽象类来实现的，其实就是使用了模板方法，让不同的子类去实现。

我们常用的同步器 ReentrantLock、CountDownLatch、CyclicBarrier 这些都是基于 AQS 的。 

AQS 里面维护一个同步状态（资源），一个等待队列和一个 condition 队列分析。

<br>

**AQS 支持独占模式和共享模式**，具体由子类实现。

1. 独占模式：某一时刻只能有一个线程能够获取资源；
2. 共享模式：某一时刻可以有多个线程能够获取资源；

<br>

**AQS 支持公平锁和非公平锁。**

1. 公平锁：根据尝试获取锁的先后顺序来获取锁，就是先到先得；
2. 非公平锁：不是先到先得，前面的线程并没有优先获取锁的优势。我们熟知的 synchronized 就是一个非公平锁；

<br>

**AQS 支持类似 Object 类提供的 wait，notify，notifyAll 机制，但是功能更强大。**

<br>

**AQS 支持中断和超时机制**。

## 资源是什么？

在 AQS 中的同步状态（资源）就是一个 int 类型的值，对不同的同步器来说含义是不同的

```java
private volatile int state;
```

| 同步器         | 同步状态含义                                                 |
| -------------- | ------------------------------------------------------------ |
| CountDownLatch | 资源 state 表示一个计数器的值，创建时 state 赋值初始值 n，当 n > 0 时表示需要阻塞线程，当 n 减到 0 时表示所有阻塞的线程可以继续运行； |
| ReentrantLock  | 资源 state 表示锁是否占用<br>当 state = 0 时表示锁是空闲状态<br>当 state = 1 时表示锁已经被某个线程占用了<br>当 state > 1 时表示锁重入了 |
| Semaphore      | 资源 state 表示许可证 or 令牌，创建时给 state 赋值初始值 n，当 n > 0 时表示当前线程可以获取这个许可证并继续向下运行。当 n = 0 时表示没有许可证了，当前线程需要阻塞并等待别的线程归还许可证； |
| CyclicBarrier  | 资源 state 表示的意思和 Semaphore 一样，可以把 CyclicBarrier 看成是一个可循环使用的 Semaphore； |



在 JUC 中还有一个 AbstractQueuedLongSynchronizer 类，和 AbstractQueuedSynchronizer 的区别就是前者的同步状态是 long 类型的，而后者的同步状态是 int 类型的，就这个区别。

## 提供模板方法

AQS 提供了一些模板方法，具体由子类去实现，如下：

| 抽象方法          |                  |
| ----------------- | ---------------- |
| tryAcquire        | 尝试获取独占资源 |
| tryRelease        | 尝试释放独占资源 |
| tryAcquireShared  | 尝试获取共享资源 |
| tryReleaseShared  | 尝试释放共享资源 |
| isHeldExclusively | 释放时独占模式   |

我们常用的 ReentrantLock 就是使用独占模式的一个例子，它的内部实现了 tryAcquire，tryAcquireShared，isHeldExclusively 方法，我们后面具体分析。

## 等待队列

等待队列是一个 FIFO 队列，是Craig，Landin和Hagersten锁（CLH锁）的一种变种，采用双向链表实现。

先看下等待队列的节点的定义，就是一个内部类 Node。

```java
static final class Node {
    /** Marker to indicate a node is waiting in shared mode */
    // 共享模式节点
    static final Node SHARED = new Node();
    /** Marker to indicate a node is waiting in exclusive mode */
    // 独占模式节点
    static final Node EXCLUSIVE = null;

    static final int CANCELLED =  1;
    static final int SIGNAL    = -1;
    static final int CONDITION = -2;
    static final int PROPAGATE = -3;

    // 当前节点的状态
    volatile int waitStatus;
    // 前驱
    volatile Node prev;
    // 后驱
    volatile Node next;
    // 结点包装的线程
    volatile Thread thread;
    // Condition队列使用，存储condition队列中的后继节点 单向链表
    Node nextWaiter;
}
```

分析下属性：

- 这个队列是一个双向链表，所以 Node 里面定义了代表前驱的 prev 指针和代表后驱的指针 next；
- 线程需要在队列中排队，thread 属性就是当前节点封装的线程对象；
- SHARED 和 EXCLUSIVE 是一个标记，标记当前节点是在什么模式（独占 or 共享）下加入等待的；
- 前面说了 AQS 支持类似 wait 和 notify 的机制，其实是通过一个 condition 队列实现的，它是一个单向链表，nextWaiter 属性就维护了后驱指针；
- waitStatus 属性表示当前节点的状态，取值和它们的含义如下表所示：



| key       | 值   | 含义                                                         |
| --------- | ---- | ------------------------------------------------------------ |
| CANCELLED | 1    | 表示当前线程等待超时或者被中断，被取消排队了，取消争抢锁     |
| SIGNAL    | -1   | 表示当前线程可以唤醒它的 next 节点                           |
| CONDITION | -2   | 表示线程在条件队列里等待                                     |
| PROPAGATE | -3   | 用于将唤醒后继线程传递下去，这个状态的引入是为了完善和增强共享锁的唤醒机制； |
|           | 0    | 等待队列里的初始状态                                         |

## Condition 条件等待

Synchronized 同步锁在同步代码块中可以通过锁对象的 wait 和 notify 方法来实现线程同步。

对于 JUC 中的 Condition 接口，配合 Lock 锁也可以实现线程同步，通过 Condition 接口中的 await 和 signal 方法实现。

一个 Synchronized 锁只能有一个共享的变量锁对象的 wait 和 notify 来实现线程同步，而一个 Lock 锁可配合多个 Condition 实例使用。

Condition 必须和 Lock 配合使用，这和 Synchronized 的使用要求是一样的。



在 AbstractQueuedSynchronizer.Node 的属性中有个 nextWaiter 属性前面没有分析过，这个 nextWaiter 的含义是指向条件队列中当前节点的后驱节点。

条件队列是一个单向链表，通过 nextWaiter 连接。

当我们调用 await 方法后，当前线程就会被封装成一个节点加入到条件队列中去。因为 Lock 可以配合多个 Condition 使用，每个 Condition 都有自己的条件队列。

当调用指定 Condition 的 signal 方法后，就会将它的条件队列中的节点迁移到等待队列中，等待唤醒。当唤醒之前就会尝试重新获取锁，当获取到锁之后就可以执行自己的业务代码了。

