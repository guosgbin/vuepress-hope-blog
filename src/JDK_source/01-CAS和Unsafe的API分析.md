---
title: 01-CAS和Unsafe的API分析
---



| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年08月17日13:25:22 |



## CAS 操作

### CAS

CAS 是一种实现并发算法时常用的技术，自旋锁和乐观锁的实现都用到了 CAS 算法。

JUC 并发包的绝大多数工具类，如原子类 AtomicInteger 和重入锁 ReentrantLock，它们的源码实现中都有 CAS 的身影。CAS 是 Compare And Swap 的简称，即比较再替换。它是计算机处理器提供的一个原子指令，保证了比较和替换两个操作的原子性。

CAS操作涉及三个操作数：CAS（V，E，N）。

1. **V：要读写的内存地址；**
2. **E：进行比较的值E（预期值）；**
3. **N：拟写入的新值。**

CAS操作含义：当且仅当内存地址 V 中的值等于预期值 E 时，将内存 V 中的值改为 A，否则不操作。

**因为 CAS 是一条 CPU 的原子指令**，在执行过程中不允许被中断，所以不会造成所谓的数据不一致问题。



### CAS 的问题

（1） ABA 问题

如果一个变量 V 初次读取的时候是 A 值，那在赋值的时候检查到它仍然是 A 值，是否就能说明它的值没有被其他线程修改过了吗？很明显是不能的，因为在这段时间它的值可能被改为其他值，然后又改回 A，那 CAS 操作就会误认为它从来没有被修改过。这个问题被称为 CAS 操作的＂ABA＂问题。ABA 问题的产生是因为一个变量的值从 A 改为 B，随后又从 B 改回 A。如果变量的值只能朝一个方向转换就不会有这个问题，比如使用版本号或者时间戳机制，版本号机制是每次更改版本号变量时将版本号递增加 1，这样就不会存在这个问题了。

JDK 中的 AtomicStampedReference 类使用的就是版本号，它给每个变量都配备了一个版本号字段，来避免 ABA 问题的产生。

> 关于 ABA 问题可以看 wiki 百科
>
> https://en.wikipedia.org/wiki/ABA_problem



（2）循环时间长开销大

自旋 CAS（也就是更新不成功就一直循环执行直到成功）如果长时间不成功，会给 CPU 带来非常大的执行开销。遇到这种情况，就需要对 CAS 操作限制重试上限，如果重试次数达到最大值，可以通过直接退出或者采用其他方式来替代 CAS。

比如 synchronized 同步锁，轻量级锁通过 CAS 自旋等待锁释放，在线程竞争激烈的情况下，自旋次数达到一定数量时，synchronized 内部会升级为重量级锁。

（3）只能保证一个共享变量的原子操作

CAS 操作只对单个共享变量有效，当操作跨多个共享变量时 CAS 	无效。

## Unsafe 的 API

### 类、对象和变量相关的方法

#### getObject

获取对象 o 中内存偏移地址为 offset 的 field 对应值。

这个方法无视修饰符的抑制，也就是无视 private，protected，default。

```java
public native Object getObject(Object o, long offset);
```



#### putObject

向对象 o 中内存偏移地址为 offset 的 field 对应值设置为 x。

```java
public native void putObject(Object o, long offset, Object x);
```



#### getObjectVolatile

获取对象 o 中内存偏移地址为 offset 的 field 对应值，加了 volatile 语义，也就是强制从主存读取。

```java
public native Object getObjectVolatile(Object o, long offset);
```



#### putObjectVolatile

向对象 o 中内存偏移地址为 offset 的 field 对应值设置为 x，使用了 volatile 语义。

```java
public native void    putObjectVolatile(Object o, long offset, Object x);
```



#### staticFieldOffset

返回给定的静态属性在它的类的存储分配中的位置（偏移地址）

这个方法仅仅针对静态属性，使用在非静态属性上会抛出异常。

```java
public native long staticFieldOffset(Field f);
```



#### objectFieldOffset

获取指定类中指定字段的内存偏移地址，可以通过该偏移地址直接读写实例对象中该变量的值。

这个方法仅仅针对非静态属性，使用在静态属性上会抛出异常。

```java
public native long objectFieldOffset(Field f);
```



#### arrayBaseOffset

获取数组类型的第一个元素的地址偏移量

```java
public native int arrayBaseOffset(Class<?> arrayClass);
```



#### arrayIndexScale

返回数组类型的比例因子，就是数组中元素偏移地址的增量，因为数组中的元素的地址是连续的。

```java
public native int arrayIndexScale(Class<?> arrayClass);
```

### CAS 操作

主要有三个，都是以 compareAndSwap 开头的方法。

参数解释

```
/*
 * @param o 对象
 * @param offset 对象中需要更新的变量的内存偏移量
 * @param expected 期望值
 * @param x 待更新的值
 */
```



```java
/**
 * Atomically update Java variable to <tt>x</tt> if it is currently
 * holding <tt>expected</tt>.
 * @return <tt>true</tt> if successful
 */
public final native boolean compareAndSwapObject(Object o, long offset,
                                                 Object expected,
                                                 Object x);

/**
 * Atomically update Java variable to <tt>x</tt> if it is currently
 * holding <tt>expected</tt>.
 * @return <tt>true</tt> if successful
 */
public final native boolean compareAndSwapInt(Object o, long offset,
                                              int expected,
                                              int x);

/**
 * Atomically update Java variable to <tt>x</tt> if it is currently
 * holding <tt>expected</tt>.
 * @return <tt>true</tt> if successful
 */
public final native boolean compareAndSwapLong(Object o, long offset,
                                               long expected,
                                               long x);
```

### 线程调度

```java
/**
 * Block current thread, returning when a balancing
 * <tt>unpark</tt> occurs, or a balancing <tt>unpark</tt> has
 * already occurred, or the thread is interrupted, or, if not
 * absolute and time is not zero, the given time nanoseconds have
 * elapsed, or if absolute, the given deadline in milliseconds
 * since Epoch has passed, or spuriously (i.e., returning for no
 * "reason"). Note: This operation is in the Unsafe class only
 * because <tt>unpark</tt> is, so it would be strange to place it
 * elsewhere.
 */
public native void park(boolean isAbsolute, long time);
```

参数：

1. isAbsolute：阻塞时间time是否是绝对时间；
2. time：阻塞时间；



- 如果 isAbsolute = false 且 time = 0，表示一直阻塞。
- 如果 isAbsolute = false 且 time ＞ 0，表示等待指定时间后线程会被唤醒。time 为相对时间，即当前线程在等待time 毫秒后会被唤醒。
- 如果 isAbsolute = true 且 time ＞ 0，表示到达指定时间线程会被唤醒。time 是绝对时间，是某一个时间点是换算成相对于新纪元之后的毫秒值。



线程调用park方法阻塞后被唤醒时机有：

1. 其他线程以当前线程作为参数调用了 unpark 方法，当前线程被唤醒。
2. 当 time＞0 时，当设置的 time 时间到了，线程会被唤醒。
3. 其他线程调用了当前线程的 interrupt 方法中断了当前线程，当前线程被唤醒。



```java
/**
 * Unblock the given thread blocked on <tt>park</tt>, or, if it is
 * not blocked, cause the subsequent call to <tt>park</tt> not to
 * block.  Note: this operation is "unsafe" solely because the
 * caller must somehow ensure that the thread has not been
 * destroyed. Nothing special is usually required to ensure this
 * when called from Java (in which there will ordinarily be a live
 * reference to the thread) but this is not nearly-automatically
 * so when calling from native code.
 * @param thread the thread to unpark.
 *
 */
public native void unpark(Object thread);
```

这个方法的作用是唤醒调用 park 后被阻塞的线程，参数 thread 为需要唤醒的线程。



park 和 unpark 方法会对每个线程维持一个许可（boolean值）。

unpark 调用时，如果当前线程还未进入 park 方法，则许可为true。

unpark 函数可以先于 park 调用。比如线程 B 调用 unpark 函数，给线程 A 发了一个“许可”，那么当线程 A 调用park时，它发现已经有“许可”了，那么它会马上再继续运行。

park 调用时，判断许可是否为 true，如果是 true，则继续往下执行；如果是 false，则等待，直到许可为 true。

“许可”是 boolean 值，不能叠加，是“一次性”的。比如线程 B 连续调用了三次 unpark 函数（许可 = true），当线程 A 调用 park s函数就使用掉这个“许可”（许可 = false）。如果线程 A 再次调用 park，则进入阻塞等待状态。

### 锁

```java
/** Lock the object.  It must get unlocked via {@link #monitorExit}. */
// 加锁，可重入的
@Deprecated
public native void monitorEnter(Object o);

/**
 * Unlock the object.  It must have been locked via {@link
 * #monitorEnter}.
 */
// 释放锁
@Deprecated
public native void monitorExit(Object o);

/**
 * Tries to lock the object.  Returns true or false to indicate
 * whether the lock succeeded.  If it did, the object must be
 * unlocked via {@link #monitorExit}.
 */
// 尝试加锁
@Deprecated
public native boolean tryMonitorEnter(Object o);
```