---
title: 28-阻塞队列LinkedBlockingQueue
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年12月04日16:19:38 |

## LinkedBlockingQueue概述

LinkedBlockingQueue 是基于链表的无界阻塞队列，FIFO。

LinkedBlockingQueue 和 ArrayBlockingQueue 一样都是基于 ReentrantLock 做线程同步的，它们的区别是：

- ArrayBlockingQueue 内部只有一个锁对象，这个锁对象同时控制队列的入队和出队；
- LinkedBlockingQueue 有两个锁对象，分别控制着入队和出队；



## 节点对象

LinkedBlockingQueue 是基于链表实现的，Node 类就一个元素对象和指针。

```java
// 节点对象
static class Node<E> {
    E item;

    /**
     * One of:
     * - the real successor Node
     * - this Node, meaning the successor is head.next
     * - null, meaning there is no successor (this is the last node)
     */
    Node<E> next;

    Node(E x) { item = x; }
}
```

## LinkedBlockingQueue 成员属性

```java
// 队列的容量
private final int capacity;

/** Current number of elements */
// 元素个数
private final AtomicInteger count = new AtomicInteger();

/**
 * Head of linked list.
 * Invariant: head.item == null
 */
// 头节点指针 head.item == null
transient Node<E> head;

/**
 * Tail of linked list.
 * Invariant: last.next == null
 */
// 尾结点指针 last.next == null
private transient Node<E> last;

/** Lock held by take, poll, etc */
private final ReentrantLock takeLock = new ReentrantLock();

/** Wait queue for waiting takes */
// 队列空时，出队线程在该条件队列等待
private final Condition notEmpty = takeLock.newCondition();

/** Lock held by put, offer, etc */
private final ReentrantLock putLock = new ReentrantLock();

/** Wait queue for waiting puts */
// 队列满时，入队线程在该条件队列等待
private final Condition notFull = putLock.newCondition();
```

| 属性                     | 说明                                                         |
| ------------------------ | ------------------------------------------------------------ |
| `int capacity`           | 队列的容量，默认是 Integer.MAX_VALUE                         |
| `AtomicInteger count`    | 队列内元素的个数，使用原子类来存储，因为LinkedBlockingQueue 里面入队何处对是不同的锁对象控制。 |
| `Node<E> head`           | 指向队列的头指针，不存储数据，`head.item == null`            |
| `Node<E> last`           | 指向队列尾结点的指针，`last.next == null`                    |
| `ReentrantLock takeLock` | 出队的锁对象                                                 |
| `Condition notEmpty `    | 队列空时，出队线程在该条件队列等待                           |
| `ReentrantLock putLock`  | 入队的锁对象                                                 |
| `Condition notFull`      | 队列满时，入队线程在该条件队列等待                           |

## LinkedBlockingQueue 构造函数

可以看到，LinkedBlockingQueue 默认的队列的容量是 Integer.MAX_VALUE。

初始情况下，新建一个 item 为 null 的 Node 节点，head 节点和 last 节点都指向这个节点。

```java
public LinkedBlockingQueue() {
    this(Integer.MAX_VALUE);
}

public LinkedBlockingQueue(int capacity) {
    if (capacity <= 0) throw new IllegalArgumentException();
    this.capacity = capacity;
    // 创建头尾节点的指针
    last = head = new Node<E>(null);
}

public LinkedBlockingQueue(Collection<? extends E> c) {
    this(Integer.MAX_VALUE);
    final ReentrantLock putLock = this.putLock;
    putLock.lock(); // Never contended, but necessary for visibility
    try {
        int n = 0;
        for (E e : c) {
            if (e == null)
                throw new NullPointerException();
            if (n == capacity)
                throw new IllegalStateException("Queue full");
            enqueue(new Node<E>(e));
            ++n;
        }
        count.set(n);
    } finally {
        putLock.unlock();
    }
}
```

## 核心方法

### 阻塞入队 put

流程：

1. 创建 Node 对象封装元素；
2. 尝试获取锁对象；
3. 当队列满了的时候，当前线程就在 notFull 挂起等待。否则调用 LinkedBlockingQueue#enqueue 方法入队；
4. 增加计数，假如增加计数后队列还未满，则需要唤醒可能在 notFull 上阻塞的线程（入队线程）；
5. 最后假如 `c == 0`，说明插入该节点前队列是空的，需要尝试唤醒一个在 notEmpty 上阻塞的线程（出队线程）；

```java
// 入队尾
public void put(E e) throws InterruptedException {
    if (e == null) throw new NullPointerException();
    int c = -1;
    Node<E> node = new Node<E>(e);
    final ReentrantLock putLock = this.putLock;
    final AtomicInteger count = this.count;
    // 获取锁，响应中断
    putLock.lockInterruptibly();
    try {
        while (count.get() == capacity) {
            // 等待消费线程唤醒
            notFull.await();
        }
        enqueue(node);
        // 增加计数
        c = count.getAndIncrement();
        if (c + 1 < capacity)
            notFull.signal();
    } finally {
        putLock.unlock();
    }
    if (c == 0)
        signalNotEmpty();
}

private void signalNotEmpty() {
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lock();
    try {
        notEmpty.signal();
    } finally {
        takeLock.unlock();
    }
}
```

### 阻塞出队 take

流程：

1. 尝试获取出队的锁对象；
2. 假如队列是空的，那么就需要当前线程在 notEmpty 上面等待；
3. 假如队列不是空的，那么就调用 LinkedBlockingQueue#dequeue 方法进行出队操作；
4. 减少计数；
5. 假如 c > 1，说明移除元素后队列中还有元素，需要唤醒因为没有元素而等待的线程；
6. 最后，假如`c == capacity`，说明出队之前队列是满的，此次将队列由满变为不满了，需要尝试唤醒阻塞的入队线程；

```java
/**
 * 获取队首元素，无限等待
 */
public E take() throws InterruptedException {
    E x;
    int c = -1;
    final AtomicInteger count = this.count;
    final ReentrantLock takeLock = this.takeLock;
    // 获取锁，响应中断
    takeLock.lockInterruptibly();
    try {
        while (count.get() == 0) {
            // 进入这里说明队列没有元素，需要等待元素入队，无限等待
            notEmpty.await();
        }
        // 出队
        x = dequeue();
        // 计数减少
        c = count.getAndDecrement();
        // c > 1 说明当前移除元素不是队列中的最后一个元素，需要唤醒因为没有元素而等待的线程
        if (c > 1)
            notEmpty.signal();
    } finally {
        takeLock.unlock();
    }
    // c == capacity 说明出队之前队列是满的，此次将队列由满变为不满了，
    if (c == capacity)
        signalNotFull();
    return x;
}

private void signalNotFull() {
    final ReentrantLock putLock = this.putLock;
    putLock.lock();
    try {
        notFull.signal();
    } finally {
        putLock.unlock();
    }
}
```

## 小结

- LinkedBlockingQueue 是基于链表的阻塞队列；
- LinkedBlockingQueue 类似无界队列，默认容量是`Integer.MAX_VALUE`；
- LinkedBlockingQueue 使用两个独立的 ReentrantLock 对象，分别保证出队和入队操作线程安全，这样就可以同时入队和出队了；
- LinkedBlockingQueue 的 ReentrantLock 都是默认的非公平策略，不可指定；

