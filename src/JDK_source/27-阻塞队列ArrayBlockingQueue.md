---
title: 27-阻塞队列ArrayBlockingQueue
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年12月03日23:24:10 |



## 阻塞队列的概念



阻塞队列就是提供了插入和移除元素允许阻塞的队列。

- 阻塞插入：当队列满了时，线程插入元素到队列会阻塞，直到有空闲位置可以插入；
- 阻塞移除：当队列是空是，线程从队列移除元素会阻塞，直到队列有数据可以移除；



## JUC 的阻塞队列

JUC 里面有如下几个阻塞队列：

- ArrayBlockingQueue：基于数组结构的有界阻塞队列；
- LinkedBlockingQueue：基于链表的无界阻塞队列；
- LinkedBlockingDeque：基于链表的双向无界阻塞队列；
- PriorityBlockingQueue：优先队列，无界阻塞队列；
- DelayQueue：优先级队列实现的无界阻塞队列；
- LinkedTransferQueue：基于链表实现的无界阻塞队列；
- SynchronousQueue：不存储元素的阻塞队列；

后面会依次分析上面这些阻塞队列，本篇分析 ArrayBlockingQueue 的实现。



上面的这些阻塞队列都实现了 BlockingQueue 接口，既然是阻塞队列，那么就会有阻塞入队和出队的 api，看下 BlockingQueue 的接口重要方法的定义。

```java
public interface BlockingQueue<E> extends Queue<E> {
    boolean add(E e);

    boolean offer(E e);

    // 插入元素到队尾，如果没有空间，则一直阻塞等待直到有空间可以插入元素
    void put(E e) throws InterruptedException;

    // 插入元素到队尾，如果没有空间，则最多会等待指定时间
    boolean offer(E e, long timeout, TimeUnit unit)
        throws InterruptedException;
    
    // 移除队首元素，假如没有元素，则一直阻塞直到有元素
    E take() throws InterruptedException;

    // 移除队首元素，假如没有元素，则最多阻塞等待指定时间
    E poll(long timeout, TimeUnit unit)
        throws InterruptedException;

    int remainingCapacity();

    boolean remove(Object o);

    int drainTo(Collection<? super E> c);

    int drainTo(Collection<? super E> c, int maxElements);
}
```







## ArrayBlockingQueue 的概述

ArrayBlockingQueue 的实现非常简单，底层就是一个循环数组，保存一个入队指针和出队指针。

通过 ReentrantLock 控制入队和出队操作，通过 ReentrantLock 的 Condition 条件队列做阻塞唤醒操作。

## 构造函数和成员属性

先看 ArrayBlockingQueue 成员属性

```java
/** The queued items */
// 底层数组
final Object[] items;

/** items index for next take, poll, peek or remove */
// 指向下一次 take，poll，peek 和 remove 的元素
int takeIndex;

/** items index for next put, offer, or add */
// 指向下一次 put，offer 和 add 的元素
int putIndex;

/** Number of elements in the queue */
// 队列中的元素个数
int count;

/** Main lock guarding all access */
// 锁对象
final ReentrantLock lock;

/** Condition for waiting takes */
// 条件队列，当队列空了的时候，需要在这里等待
private final Condition notEmpty;

/** Condition for waiting puts */
// 条件队列，当队列满了的时候，需要在这里等待
private final Condition notFull;
```



| 属性      | 解释                                               |
| --------- | -------------------------------------------------- |
| items     | 底层存储数据的数组                                 |
| takeIndex | 指向下次出队的位置                                 |
| putIndex  | 指向下次入队的位置                                 |
| count     | 队列中的元素个数                                   |
| lock      | 保证入队和出队操作同步的锁对象，可指定是否公平     |
| notEmpty  | 条件队列，当队列空了的时候，出队线程需要在这里等待 |
| notFull   | 条件队列，当队列满了的时候，入队线程需要在这里等待 |





ArrayBlockingQueue 因为是基于数组的阻塞队列，它是有界的，构造函数需要传入队列的容量。

并且它是有支持公平和非公平的，其实就是 ReentrantLock 的公平和非公平的特性。

```java
public ArrayBlockingQueue(int capacity) {
    this(capacity, false);
}

public ArrayBlockingQueue(int capacity, boolean fair) {
    if (capacity <= 0)
        throw new IllegalArgumentException();
    this.items = new Object[capacity];
    lock = new ReentrantLock(fair);
    notEmpty = lock.newCondition();
    notFull =  lock.newCondition();
}

public ArrayBlockingQueue(int capacity, boolean fair,
                          Collection<? extends E> c) {
    this(capacity, fair);

    final ReentrantLock lock = this.lock;
    lock.lock(); // Lock only for visibility, not mutual exclusion
    try {
        int i = 0;
        try {
            for (E e : c) {
                checkNotNull(e);
                items[i++] = e;
            }
        } catch (ArrayIndexOutOfBoundsException ex) {
            throw new IllegalArgumentException();
        }
        count = i;
        putIndex = (i == capacity) ? 0 : i;
    } finally {
        lock.unlock();
    }
}
```

## 入队的核心方法

offer(E)：非阻塞插入元素；

put：阻塞插入元素；

offer(E, long, TimeUnit)：限时阻塞插入元素；

### 非阻塞入队 offer

首先获取锁，获取锁成功后，

- 假如当前队列已经满了，在直接退出返回；
- 假如当前队列未满，调用 ArrayBlockingQueue#enqueue 方法执行入队操作；

```java
// 入队尾
public boolean offer(E e) {
    checkNotNull(e);
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        if (count == items.length)
            // 满了
            return false;
        else {
            // 未满，入队操作
            enqueue(e);
            return true;
        }
    } finally {
        lock.unlock();
    }
}
```



ArrayBlockingQueue#enqueue 

该方法很简单，

- 插入元素；
- 处理环形队列的指针；
- count 计数加 1；
- 因为加入了一个元素，之前可能有的线程因为队列中没有元素而在 notEmpty 上面等待，这里需要唤醒一个线程。

```java
// 只有在获取锁的状态才会进这个方法
private void enqueue(E x) {
    // assert lock.getHoldCount() == 1;
    // assert items[putIndex] == null;
    final Object[] items = this.items;
    // 添加元素
    items[putIndex] = x;
    // 环形数组，重置 putIndex 索引为 0
    if (++putIndex == items.length)
        putIndex = 0;
    count++;
    // 唤醒因为队列没有元素而在 获取元素时阻塞的线程
    notEmpty.signal();
}
```

### 阻塞入队 put

和上面 offer 方法的区别就是，当队列中没有空闲位置时，当前入队线程需要在 notFull 条件队列无限等待，直到出队线程唤醒当前线程。

使用 while 判断是防止虚假唤醒。

```java
// 入队，无限等待
public void put(E e) throws InterruptedException {
    checkNotNull(e);
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        while (count == items.length)
            notFull.await();
        enqueue(e);
    } finally {
        lock.unlock();
    }
}
```

### 限时阻塞入队 offer

关键点就是 `notFull.awaitNanos(nanos)`，假如等待了指定时间后队列还是满的，就直接退出方法，入队失败。

```java
// 尝试入队尾，等待指定时间
public boolean offer(E e, long timeout, TimeUnit unit)
    throws InterruptedException {

    checkNotNull(e);
    long nanos = unit.toNanos(timeout);
    final ReentrantLock lock = this.lock;
    // 获取锁，响应中断
    lock.lockInterruptibly();
    try {
        // 使用 while 循环防止虚假唤醒
        while (count == items.length) {
            if (nanos <= 0)
                return false;
            // 因为队列满了，尝试等待指定时间
            nanos = notFull.awaitNanos(nanos);
        }
        // 入队操作
        enqueue(e);
        return true;
    } finally {
        lock.unlock();
    }
}
```

## 出队的核心方法

### 非阻塞出队 poll 

当队列中还有元素时调用 ArrayBlockingQueue#dequeue 方法出队。

```java
/**
 * 获取并移除队首元素
 */
public E poll() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return (count == 0) ? null : dequeue();
    } finally {
        lock.unlock();
    }
}
```



ArrayBlockingQueue#dequeue

```java
private E dequeue() {
    // assert lock.getHoldCount() == 1;
    // assert items[takeIndex] != null;
    final Object[] items = this.items;
    // 获取旧元素
    @SuppressWarnings("unchecked")
    E x = (E) items[takeIndex];
    items[takeIndex] = null;
    // 环形数组
    if (++takeIndex == items.length)
        takeIndex = 0;
    count--;
    if (itrs != null)
        itrs.elementDequeued();
    // 唤醒在添加元素的时候，唤醒可能阻塞的入队线程
    notFull.signal();
    return x;
}
```

### 阻塞出队 take

```java
/**
 * 获取并移除队首元素，无限等待
 */
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        while (count == 0)
            notEmpty.await();
        return dequeue();
    } finally {
        lock.unlock();
    }
}
```

### 限时阻塞出队 poll

```java
/**
 * 获取并移除队首元素，指定等待超时时间
 */
public E poll(long timeout, TimeUnit unit) throws InterruptedException {
    long nanos = unit.toNanos(timeout);
    final ReentrantLock lock = this.lock;
    // 加锁，响应中断
    lock.lockInterruptibly();
    try {
        while (count == 0) {
            if (nanos <= 0)
                return null;
            // 等待指定时间
            nanos = notEmpty.awaitNanos(nanos);
        }
        return dequeue();
    } finally {
        lock.unlock();
    }
}
```

## 小结

ArrayBlockingQueue 使用独占锁 **ReentrantLock** 来实现同步，**出队和入队都使用同一个锁对象**。

ArrayBlockingQueue 是一个**有界的阻塞队列**，底层使用的是数组数据结构，初始化时需要指定队列的长度。

主要的应用场景就是，队列的元素的**生产者的生产速度和消费者的消费速度大致想当时**。