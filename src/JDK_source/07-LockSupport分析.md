---
title: 07-LockSupport分析
---



| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年09月05日00:35:26 |

## LockSupport 简介

LockSupport 是 JUC 包的一个用于阻塞和唤醒线程的工具类。park 系列方法会阻塞当前线程，unpark 方法会唤醒指定的线程。（其实这两个方法都是基于 sun.misc.Unsafe 类来实现的）

LockSupport 使用会对每个线程维持一个叫“许可证”的东西（boolean），我们可以把它当成只有 1 个许可证的Semaphore。

## 使用案例

下面给的是源码中的案例：

```java
class FIFOMutex {
    // 当锁用
    private final AtomicBoolean locked = new AtomicBoolean(false);
    // 等待队列
    private final Queue<Thread> waiters = new ConcurrentLinkedQueue<Thread>();

    /**
     * 加锁
     *
     * 1.先将当前线程加入到等待队列；
     * 2.判断当前线程是否是等待队列的队首线程，只有队首线程才有资格获取锁
     * 3.获取锁失败则 park 阻塞，获取成功则从等待队列移除
     */
    public void lock() {
        boolean wasInterrupted = false;
        Thread current = Thread.currentThread();
        waiters.add(current);
        // Block while not first in queue or cannot acquire lock
        while (waiters.peek() != current || !locked.compareAndSet(false, true)) {
            // 不是队首线程或者是队首线程但是抢锁失败，阻塞当前线程
            LockSupport.park(this);
            if (Thread.interrupted()) // ignore interrupts while waiting
                wasInterrupted = true;
        }
        waiters.remove();
        if (wasInterrupted)          // reassert interrupt status on exit
            current.interrupt();
    }

    public void unlock() {
        locked.set(false);
        // 唤醒队首线程
        LockSupport.unpark(waiters.peek());
    }
}
```

这是一种FIFO类型的独占锁，可以把这种锁看成是 ReentrantLock 的公平锁简单版本，且是不可重入的，就是说当一个线程获得锁后，其它等待线程以 FIFO 的调度方式等待获取锁。

## Unsafe 的阻塞和唤醒的方法

LockSupport 里面的阻塞和唤醒的方法都是基于 sun.misc.Unsafe 类来实现的，所以我们先来看下 Unsafe 类的相关方法。

### Unsafe#park

阻塞当前线程

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

先说明一下参数：

1. boolean isAbsolute：表示阻塞时间 time 是否是绝对时间；
2. long time：表示阻塞时间；



阻塞当前线程，会在以下几种情况返回

1. 其他线程调用 unpark 方法让当前线程被唤醒；
2. 超时时间到了就会被唤醒；
3. 其他线程调用了当前线程的 interrupt 方法中断了当前线程，当前线程就会被唤醒；
4. 虚假唤醒；

### Unsafe#unpark

唤醒被 park 后阻塞的线程。

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

### 总结

前面我们说了 park 和 unpark 会给线程维持一个许可证（boolean），当调用 unpark 的时候就会给许可证置为 true，调用 park 的时候就会将许可证置为 false。

无论 unpark 调用多少次都只会有一个许可证，unpark 可以先于 park 方法，也就是说当某个线程先调用了 unpark 方法，那么该线程后续调用 park 方法也不会阻塞，只是会消耗这个许可证。

## LockSupport 的 API

### LockSupport#setBlocker

```java
/*
 * 记录了当前线程阻塞时是被谁阻塞的，用于线程监控和分析
 */
private static void setBlocker(Thread t, Object arg) {
    // Even though volatile, hotspot doesn't need a write barrier here.
    UNSAFE.putObject(t, parkBlockerOffset, arg);
}
```

设置这个 Object 对象一般供监视、诊断工具确定线程受阻塞的原因时使用，写个测试案例然后用 jstack 查看。

```java
public class LockSupportTest {
    public static void main(String[] args) {
        LockSupportTest obj = new LockSupportTest();
        LockSupport.park(obj);
        System.out.println("结束");
    }
}
```

运行之后 jstack 部分显示如下：

```
"main" #1 prio=5 os_prio=31 tid=0x00007f968180c000 nid=0x1703 waiting on condition [0x000000030d4b9000]
   java.lang.Thread.State: WAITING (parking)
        at sun.misc.Unsafe.park(Native Method)
        - parking to wait for  <0x000000076adaaa78> (a test.java.util.concurrent.locks.LockSupportTest)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:175)
        at test.java.util.concurrent.locks.LockSupportTest.main(LockSupportTest.java:26)
```

### park 相关方法

（1）保存当前线程阻塞是被那个对象阻塞的；

```java
public static void park(Object blocker) {
    Thread t = Thread.currentThread();
    setBlocker(t, blocker);
    // 阻塞线程
    UNSAFE.park(false, 0L);
    setBlocker(t, null);
}
```

（2）保存当前线程阻塞是被那个对象阻塞的，并增加了最大的阻塞时间；

```java
public static void parkNanos(Object blocker, long nanos) {
    if (nanos > 0) {
        Thread t = Thread.currentThread();
        setBlocker(t, blocker);
        // 阻塞线程 nanos 时间
        UNSAFE.park(false, nanos);
        setBlocker(t, null);
    }
}
```

（3）保存当前线程阻塞是被那个对象阻塞的，并增加了阻塞的截止时间；

```java
public static void parkUntil(Object blocker, long deadline) {
    Thread t = Thread.currentThread();
    setBlocker(t, blocker);
    // true 表示绝对时间，阻塞到 deadline 为止
    UNSAFE.park(true, deadline);
    setBlocker(t, null);
}
```

（4）一直阻塞当前线程；

```java
public static void park() {
    UNSAFE.park(false, 0L);
}
```

（5）设置最大阻塞时长；

```java
public static void parkNanos(long nanos) {
    if (nanos > 0)
        // 阻塞 nanos 秒
        UNSAFE.park(false, nanos);
}
```

（6）设置阻塞的截止时间；

```java
public static void parkUntil(long deadline) {
    // 阻塞到绝对时间 deadline 为止
    UNSAFE.park(true, deadline);
}
```

### unpark

其实就是直接调的 Unsafe#unpark 方法。

```java
public static void unpark(Thread thread) {
    if (thread != null)
        // 唤醒线程
        UNSAFE.unpark(thread);
}
```

## 小结

 LockSupport 的 park 方法在下面这几种情况发生之前都会阻塞：

1. 调用了 unpark 方法；
2. park 的线程被中断了；
3. 设置的超时时间到了；
4. 被虚假唤醒了；



使用 park 方法需要注意的地方，一般 park 方法需要在一个循环体中使用，这是为了防止线程被唤醒后，循环条件可能还是不满足，假如此处不判断继续向下运行是有问题的。

模板如下

```java
while(条件) {
    LockSupport.park();
}
```



注意：park 方法是会响应中断的，但是不会抛出异常。