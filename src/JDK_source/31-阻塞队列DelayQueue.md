---
title: 31-阻塞队列DelayQueue
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年12月10日16:28:54 |

## DelayQueue 概述

DelayQueue 是一个特殊的阻塞队列，内部存储的元素需要时间 Delayed 接口。

看下 DelayQueue 的继承关系

```java
public class DelayQueue<E extends Delayed> extends AbstractQueue<E>
    implements BlockingQueue<E> {
	// ... 省略...
}
```



看下 Delayed 接口的定义

```java
public interface Delayed extends Comparable<Delayed> {

    /**
     * Returns the remaining delay associated with this object, in the
     * given time unit.
     *
     * @param unit the time unit
     * @return the remaining delay; zero or negative values indicate
     * that the delay has already elapsed
     */
    long getDelay(TimeUnit unit);
}
```

Delayed 接口的 **getDelay 方法的作用是返回元素剩余的有效时间**。

**Delayed 接口还继承了 Comparable 接口**，目的是方便比较两个对象的大小。



DelayQueue 内部**使用优先队列 PriorityQueue** 来实现延迟出队的功能，队列中最快过期的元素在优先队列的堆顶（**小顶堆**）。

存储的元素需要实现 Delayed 接口，当 **getDelay 方法的返回值小于等于 0 的时候才认为元素到期，需要出队**。



## DelayQueue 案例

前面分析过调度线程池 ScheduledThreadPoolExecutor 的源码，里面也实现了一个延迟队列 DelayedWorkQueue。其实代码和 DelayQueue 的是一样。

这里我把 ScheduledThreadPoolExecutor 的代码改变一下作为 DelayQueue 的案例。



DelayQueue 队列中存储的元素需要实现 Delayed 接口，我们定义一个 Delayed 的类。

从 ScheduledFutureTask 抄出来的：

```java
class Task implements Delayed {
    /**
     * Sequence number to break ties FIFO
     */
    // 任务的序列号，用于 compareTo 方法时比较
    private final long sequenceNumber;

    /**
     * The time the task is enabled to execute in nanoTime units
     */
    // Task 有效的截止时间
    private long time;

    private static final AtomicLong atomic = new AtomicLong(0);
    private static DateTimeFormatter formatter = DateTimeFormatter.ofPattern("HH:mm:ss");


    public Task(long time) {
        this.sequenceNumber = atomic.getAndIncrement();
        this.time = time;
    }

    // 获取延迟时间
    public long getDelay(TimeUnit unit) {
        return unit.convert(time - System.currentTimeMillis(), MILLISECONDS);
    }

    /*
     * 因为实现了 Comparable 接口，需要重写
     * a negative integer, zero, or a positive integer as this object is
     * less than, equal to, or greater than the specified object.
     */
    public int compareTo(Delayed other) {
        if (other == this) // compare zero if same object
            return 0;
        if (other instanceof Task) {
            Task x = (Task) other;
            long diff = time - x.time;
            if (diff < 0)
                return -1;
            else if (diff > 0)
                return 1;
            else if (sequenceNumber < x.sequenceNumber)
                return -1;
            else
                return 1;
        }
        // 不是 Task 类型，直接比较 time 大小
        long diff = getDelay(MILLISECONDS) - other.getDelay(MILLISECONDS);
        return (diff < 0) ? -1 : (diff > 0) ? 1 : 0;
    }

    @Override
    public String toString() {
        return "Task{" +
                "sequenceNumber=" + sequenceNumber +
                ", time=" + formatter.format(LocalDateTime.ofInstant(new Date(time).toInstant(), ZoneId.of("+8"))) +
                '}';
    }
}
```



定义一个生产者和一个消费者

```java
class Consumer implements Runnable {
    private DelayQueue<Task> delayQueue;

    public Consumer(DelayQueue<Task> delayQueue) {
        this.delayQueue = delayQueue;
    }

    @Override
    public void run() {
        // 消费数据
        while (true) {
            try {
                Task task = delayQueue.take();
                System.out.println(Thread.currentThread().getName() + ": take " + task);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }
}

class Producer implements Runnable {
    private DelayQueue<Task> delayQueue;

    public Producer(DelayQueue<Task> delayQueue) {
        this.delayQueue = delayQueue;
    }

    @Override
    public void run() {
        // 生产数据
        int i = 5;
        while (i-- > 0) {
            long currentTime = System.currentTimeMillis();
            long remainTime = ThreadLocalRandom.current().nextInt(1000, 100000);

            Task task = new Task(currentTime + remainTime);
            delayQueue.put(task);
            System.out.println(Thread.currentThread().getName() + ": put " + task);

            try {
                TimeUnit.SECONDS.sleep(1);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }
}
```



测试：

```java
public static void main(String[] args) {
    DelayQueue<Task> delayQueue = new DelayQueue<>();
    new Thread(new Producer(delayQueue), "producer").start();
    new Thread(new Consumer(delayQueue), "consumer").start();

}
```



控制台：

```
producer: put Task{sequenceNumber=0, time=15:54:36}
producer: put Task{sequenceNumber=1, time=15:54:14}
producer: put Task{sequenceNumber=2, time=15:53:21}
producer: put Task{sequenceNumber=3, time=15:54:48}
producer: put Task{sequenceNumber=4, time=15:54:22}

consumer: take Task{sequenceNumber=2, time=15:53:21}
consumer: take Task{sequenceNumber=1, time=15:54:14}
consumer: take Task{sequenceNumber=4, time=15:54:22}
consumer: take Task{sequenceNumber=0, time=15:54:36}
consumer: take Task{sequenceNumber=3, time=15:54:48}
```



可以看到的是，生产者生产出来的 Task 对象的有效时间都不同，消费者消费的时候按照时间顺序从 DelayQueue 中消费数据。

## DelayQueue 的成员属性

```java
// 锁对象
private final transient ReentrantLock lock = new ReentrantLock();
// 优先队列
private final PriorityQueue<E> q = new PriorityQueue<E>();

private Thread leader = null;

private final Condition available = lock.newCondition();
```



- `ReentrantLock lock`：入队出队同步操作的锁对象；
- `PriorityQueue<E> q`：内部使用的优先队列；
- `Thread leader`：等待堆顶元素出队的线程；
- `Condition available`：条件队列，阻塞唤醒线程用的；



## DelayQueue 构造函数

```java
public DelayQueue() {}

public DelayQueue(Collection<? extends E> c) {
    this.addAll(c);
}
```



## DelayQueue 核心方法

既然是队列，那么核心方法就是入队和出队；

先看出队的操作，因为入队的代码关联到出队的部分逻辑，要不然不容易懂。

入队操作目前我们就认为就是直接添加到优先队列中去了，看完出队操作，再来看入队；



### 出队 take

出队操作可能会阻塞线程。

```java
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        // 自旋，退出自旋说明获取到任务了，或者收到了中断异常
        for (;;) {
            // 查看堆顶元素
            E first = q.peek();
            // case 堆顶没有元素，当前线程需要在此处无限等待
            if (first == null)
                available.await();
            // case 堆顶有元素
            else {
                // 获取堆顶元素的延迟时间
                long delay = first.getDelay(NANOSECONDS);
                if (delay <= 0)
                    // 已经过期了，则调用 poll 移出元素
                    return q.poll();
                // 走到这里，说明堆顶元素还未到期
                first = null; // don't retain ref while waiting
                if (leader != null)
                    // 无限等待，
                    // 有堆顶任务，会在最下面的 finally 块里唤醒
                    // 没有堆顶任务，会在添加 offer 任务的时候唤醒
                    available.await();
                else {
                    // 走到这里，说明 leader 还未被占用，当前线程占用 leader
                    Thread thisThread = Thread.currentThread();
                    leader = thisThread;
                    try {
                        // 注意，这整块代码都在锁里面的
                        // 等待指定时间，这个 delay 是堆顶任务要执行相对时间
                        // 等待指定时间后会自动唤醒，也可能是 offer 了一个优先级更高的任务，这时也会唤醒这里的
                        // 从这里醒来肯定是拿到锁了的
                        available.awaitNanos(delay);
                    } finally {
                        // 如果唤醒后，leader 还是当前线程，需要置空
                        if (leader == thisThread)
                            leader = null;
                    }
                }
            }
        }
    } finally {
        if (leader == null && q.peek() != null)
            // 说明队列中还有下一个等待者，需要唤醒，让他去尝试获取最新的堆顶节点
            available.signal();
        lock.unlock();
    }
}
```

分析下上面阻塞获取任务是如何实现的。

上面获取任务的操作在持有锁的情况下操作的，AQS 的条件队列也需要配合锁对象来使用。

- 首先拿到锁后会开启一个 for 循环，退出自旋的情况就是获得到任务了，或者被中断了。
- 在自旋里，假如优先队列中没有任务，则线程会被无限挂起；
- 假如优先队列中有任务，会判断任务是否已经到了执行时间了。假如已经到任务的执行时间，则会重新排序堆中的元素，向上冒泡，并将任务返回给调用方。
- 假如优先队列中的堆顶任务还未到执行时间，需要根据 leader 属性来走不同的分支，leader 是正在等待获取堆顶任务的线程；
  - 假如 leader 是空，当前线程占用 leader，并限时等待，这个时间就是任务执行的相对时间；
  - 假如 leader 不是空，说明已经有线程在占用 leader 了，它在等待堆顶任务，当前线程需要无限等待，后续会被唤醒；
- 在最后的 finally 块中，假如 leader 是空且优先队列中还有任务，则需要唤醒阻塞的线程。这个线程就是在 take 方法的这个位置阻塞的。

```java
if (leader != null)
// 无限等待，
// 有堆顶任务，会在最下面的 finally 块里唤醒
// 没有堆顶任务，会在添加 offer 任务的时候唤醒
available.await();
else {
    // ...省略
}
```



### 入队 put

```java
// 延迟队列元素入队
public boolean offer(E e) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 插入优先队列
        q.offer(e);
        if (q.peek() == e) {
            leader = null;
            available.signal();
        }
        return true;
    } finally {
        lock.unlock();
    }
}
```



分析下这个操作的原理

```java
if (q.peek() == e) {
    leader = null;
    available.signal();
}
```

堆顶元素是当前新入队的元素时有两种情况

1. 当前任务是第一个添加到堆内的任务，当前任务加入到 queue 之前，take() 线程会直接到 available不设置超时时间的挂起，因为是第一个加入的任务，此时 leader 是 null 的，调用 signal 方法会唤醒一个线程去消费；
2. 当前任务优先级比较高，冒泡到堆顶了，因为之前堆顶的元素可能占用了 leader 属性，leader  线程可能正在超时挂起，这时需要将其置为 null，并唤醒 leader 线程，唤醒之后就会检查堆顶，如果堆顶任务可以消费，则直接获取走了。否则继续成为 leader 线程继续等待；

## 小结

DelayQueue 是一个无界的阻塞队列，存储的元素需要实现 Delayed 接口，只有元素的过期时间到了才会从队列中移除。
