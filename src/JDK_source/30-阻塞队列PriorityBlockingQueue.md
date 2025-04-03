---
title: 30-阻塞队列PriorityBlockingQueue
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年12月07日23:36:25 |

## PriorityBlockingQueue 概述

PriorityBlockingQueue 是基于**堆**的阻塞队列，是一个**无界阻塞队列**。

- PriorityBlockingQueue 是**无界阻塞队列**，队列的大小只受内存限制，所以它的**入队方法是不会阻塞的**，只有出队方法可能会阻塞；
- PriorityBlockingQueue 是一个优先队列，按照**优先级顺序出队**；
- PriorityBlockingQueue 存储的元素需要排序，所以存储的元素类需要实现 **Comparator 接口**；
- PriorityBlockingQueue 内部的**堆结构使用数组**来表示；



PriorityBlockingQueue 默认的初始容量是 11，当容量不够的时候会进行扩容，扩容的时候会使用 CAS 操作 int 数来作为简单的锁操作。



## PriorityBlockingQueue 成员属性

```java
/**
 * Priority queue represented as a balanced binary heap: the two
 * children of queue[n] are queue[2*n+1] and queue[2*(n+1)].  The
 * priority queue is ordered by comparator, or by the elements'
 * natural ordering, if comparator is null: For each node n in the
 * heap and each descendant d of n, n <= d.  The element with the
 * lowest value is in queue[0], assuming the queue is nonempty.
 */
/*
 * 平衡二叉树
 * 父节点 queue[n]
 * 左子节点 queue[2n+1]
 * 右子节点 queue[2n+2]
 */
private transient Object[] queue;

/**
 * The number of elements in the priority queue.
 */
// 优先队列的元素个数
private transient int size;

/**
 * The comparator, or null if priority queue uses elements'
 * natural ordering.
 */
// Comparator，为 null 表示使用元素的自然顺序
private transient Comparator<? super E> comparator;

/**
 * Lock used for all public operations
 */
// 公共操作的锁对象
private final ReentrantLock lock;

/**
 * Condition for blocking when empty
 */
// 条件队列
// PriorityBlockingQueue只有一个条件等待队列——notEmpty，
// 因为构造时不会限制最大容量且会自动扩容，所以插入元素并不会阻塞，仅当队列为空时，才可能阻塞“出队”线程。
private final Condition notEmpty;

/**
 * Spinlock for allocation, acquired via CAS.
 */
// 分配的自旋锁，0 表示空闲，1 表示加锁
private transient volatile int allocationSpinLock;

/**
 * A plain PriorityQueue used only for serialization,
 * to maintain compatibility with previous versions
 * of this class. Non-null only during serialization/deserialization.
 */
// 序列化时使用，以保持与该类的早期版本的兼容性。仅在序列化/反序列化期间为非null。
private PriorityQueue<E> q;
```



| 属性                               | 解释                                                         |
| ---------------------------------- | ------------------------------------------------------------ |
| `Object[] queue`                   | 用数组表示堆<br />父节点 queue[n]<br/>左子节点 queue[2n+1]<br/>右子节点 queue[2n+2] |
| `int size`                         | 队列中的元素个数                                             |
| `Comparator<? super E> comparator` | 指定的比较顺序，为 null 的话表示使用元素的自然顺序排序       |
| `ReentrantLock lock`               | 入队和出队操作的同步对象                                     |
| `Condition notEmpty`               | 当队列中没有元素时，会将出队线程阻塞在此处                   |
| `int allocationSpinLock`           | 作为扩容时的锁，CAS 修改数值                                 |
| `PriorityQueue<E> q`               | 在序列化和反序列化时候使用                                   |

## PriorityBlockingQueue 构造方法

底层数组的默认初始容量是 11。

不传入 Comparator 比较器，表示使用元素的自然顺序排序。

```java
// 创建默认大小的数组，11
public PriorityBlockingQueue() {
    this(DEFAULT_INITIAL_CAPACITY, null);
}

public PriorityBlockingQueue(int initialCapacity) {
    this(initialCapacity, null);
}

public PriorityBlockingQueue(int initialCapacity,
                             Comparator<? super E> comparator) {
    if (initialCapacity < 1)
        throw new IllegalArgumentException();
    this.lock = new ReentrantLock();
    this.notEmpty = lock.newCondition();
    this.comparator = comparator;
    this.queue = new Object[initialCapacity];
}
```



## PriorityBlockingQueue 的核心方法

PriorityBlockingQueue 既然是队列，那么就需要重点看它的**入队和出队方**法了。

因为 PriorityBlockingQueue 是基于堆实现的，所以关于它的入队和出队就涉及到了堆的**上浮和下沉**操作了。

### 入队 offer

因为 PriorityBlockingQueue 是**无界队列**，所以**入队操作是一定会成功的，不会阻塞**。

```java
public boolean offer(E e) {
    if (e == null)
        throw new NullPointerException();
    final ReentrantLock lock = this.lock;
    lock.lock();
    // n：优先队列的元素个数
    // cap：是数组的长度
    int n, cap;
    Object[] array;
    while ((n = size) >= (cap = (array = queue).length))
        // 队列已经满了，进行扩容操作
        tryGrow(array, cap);
    try {
        Comparator<? super E> cmp = comparator;
        if (cmp == null)
            // 使用自然排序
            siftUpComparable(n, e, array);
        else
            // 使用指定的 Comparator 比较器
            siftUpUsingComparator(n, e, array, cmp);
        // 元素个数加 1
        size = n + 1;
        // 唤醒可能因为队列为空而阻塞的出队线程
        notEmpty.signal();
    } finally {
        lock.unlock();
    }
    return true;
}
```

分析下 offer 方法的流程

- 获取锁；
- 校验是否需要扩容，如果需要则扩容；
- 判断当前 PriorityBlockingQueue 是否指定 Comparator 比较器；
  - 假如未指定则使用元素的自然顺序排序，调用 siftUpComparable 方法操作堆的上浮；
  - 假如指定了，则使用指定的比较器排序，调用 siftUpUsingComparator 方法操作堆的上浮；
- 元素插入成功后，增加元素个数的计数 size；
- 唤醒可能因为队列为空而阻塞的出队线程；
- 释放锁；



关于 siftUpComparable 和 siftUpUsingComparator 方法，它们的代码几乎一样，只是一个使用指定的 Comparator 比较器而已。



堆顶存放的优先级高的元素，关于**堆的上浮**，假如堆是这样的`[1,3,5,6,7,8,9]`，流程是

1. 假如要插入 2，**先将要插入的元素放到数组最后**，先将 2 放到数组最后，`[1,3,5,6,7,8,9,  2]`;
2. **然后依次和父节点做比较**；
3. 假如当前元素的优先级要高于父节点，则交换他们的位置，直到新元素上浮到根节点或者父节点的优先级比当前元素高为止；



下面分析 siftUpComparable 的源码

入参：

- k：表示当前元素需要插入的位置，默认值是最后一个位置，就是数组的 size 索引处；
- x：待插入的元素；
- array：表示堆的数组；

```java
private static <T> void siftUpComparable(int k, T x, Object[] array) {
    Comparable<? super T> key = (Comparable<? super T>) x;
    // k 表示，k 初始值是优先队列中的元素个数，所以这里可以看成是先把元素放在数组的 k 位置
    // 假如 k==0，说明已经冒泡到堆顶节点了，
    while (k > 0) {
        int parent = (k - 1) >>> 1;
        // 获取父节点的元素
        Object e = array[parent];
        // 判断待插入节点和父节点的大小
        if (key.compareTo((T) e) >= 0)
            // 待插入节点大，说明已经找到位置了，直接退出循环
            break;
        // 待插入节点小
        array[k] = e;
        // 将 k 赋值为父节点的索引，继续向上冒泡
        k = parent;
    }
    // 插入节点
    array[k] = key;
}

```



### 扩容操作

在入队的时候，假如队列的容量不够，那么需要在入队操作前对数组进行扩容。

具体的方法就是 PriorityBlockingQueue#tryGrow

```java
private void tryGrow(Object[] array, int oldCap) {
    // 先释放锁
    lock.unlock(); // must release and then re-acquire main lock
    // newArray，只有线程扩容完成后，它才不会是null。其余时候，它都是null。
    Object[] newArray = null;
    // CAS 尝试将 allocationSpinLock 0 修改为 1，表示加锁
    if (allocationSpinLock == 0 &&
        UNSAFE.compareAndSwapInt(this, allocationSpinLockOffset,
                                 0, 1)) {
        try {
            // 如果就容量小于64，那么容量翻倍再增加两个位置。否则，新容量 = 旧容量 * 1.5。
            int newCap = oldCap + ((oldCap < 64) ?
                                   (oldCap + 2) : // grow faster if small
                                   (oldCap >> 1));
            if (newCap - MAX_ARRAY_SIZE > 0) {    // possible overflow
                // 处理溢出情况
                int minCap = oldCap + 1;
                if (minCap < 0 || minCap > MAX_ARRAY_SIZE)
                    throw new OutOfMemoryError();
                newCap = MAX_ARRAY_SIZE;
            }
            if (newCap > oldCap && queue == array)
                // 创建新数组
                newArray = new Object[newCap];
        } finally {
            // 解锁
            allocationSpinLock = 0;
        }
    }
    if (newArray == null) // back off if another thread is allocating
        // 如果另一个线程正在分配，让当前线程让步
        Thread.yield();
    // 再加锁
    lock.lock();
    if (newArray != null && queue == array) {
        // 指向新的数组，复制数据
        queue = newArray;
        System.arraycopy(array, 0, newArray, 0, oldCap);
    }
}
```



扩容方法还是比较清晰的，使用一个 int 数 CAS 更新来表示加锁。

假如当前线程未加锁成功，那么会调用 `Thread.yield()` 方法，然后会在调用方继续判断数组容量是否足够

```java
public boolean offer(E e) {
    // .... 省略....

    int n, cap;
    Object[] array;
    while ((n = size) >= (cap = (array = queue).length))
        // 队列已经满了，进行扩容操作
        tryGrow(array, cap);

    // .... 省略....
    return true;
}
```

### 出队 take

当队列中没有元素时，调用 take 方法时会阻塞当前线程，在 notEmpty 条件队列上面等待。

```java
/**
 * 阻塞获取元素
 */
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    E result;
    try {
        while ( (result = dequeue()) == null)
            notEmpty.await();
    } finally {
        lock.unlock();
    }
    return result;
}
```



PriorityBlockingQueue#dequeue 出队操作，这个也很简单，主要是看 siftDownComparable 和 siftDownUsingComparator 处理堆的下沉操作。

```java
// 出队操作
private E dequeue() {
    int n = size - 1;
    if (n < 0)
        // 队列没有元素，返回 null
        return null;
    else {
        Object[] array = queue;
        // result 表示堆顶元素
        E result = (E) array[0];
        // 获取数组（堆中的）最后一个元素
        E x = (E) array[n];
        array[n] = null;
        Comparator<? super E> cmp = comparator;
        if (cmp == null)
            // 下沉
            siftDownComparable(0, x, array, n);
        else
            // 下沉
            siftDownUsingComparator(0, x, array, n, cmp);
        size = n;
        return result;
    }
}
```





当堆顶元素被 take 走后，需要完成堆的下沉操作。

假如堆 是这样的 `[1,3,5,6,7,8,9]`

1. 假如要删除 1，先将数组最后一个节点的放到` array[0]` 的位置，将数组中的最后一个有效数据置为 null，`[9,3,5,6,7,8,null]`
2. 获取左右子节点优先级高的节点（最小堆来说就是值小的节点）， 将当前元素和小的元素交换位置，
3. 直到已经比较到二叉树的最低层了或者当前节点优先级比左右子节点都优先；

```java
/*
 * 下沉操作
 *
 * @param k     初始值是 0
 * @param x     初始值是 array[0]，就是数组的最后一个元素
 * @param array 数组（堆）
 * @param n     size - 1
 */
private static <T> void siftDownComparable(int k, T x, Object[] array,
                                           int n) {
    if (n > 0) {
        // key 是优先级最低的节点
        Comparable<? super T> key = (Comparable<? super T>)x;
        // half 表示满二叉树的底层的最左节点的索引值，当 k == half 时，说明当前 key 已经下坠到最底层了，无需再下坠了
        int half = n >>> 1;           // loop while a non-leaf
        while (k < half) {
            // 表示 k 的左右子节点中，优先级高的节点，初始值是左子节点索引
            int child = (k << 1) + 1; // assume left child is least
            Object c = array[child];
            // 右子节点的索引
            int right = child + 1;
            if (right < n &&
                ((Comparable<? super T>) c).compareTo((T) array[right]) > 0)
                // 表示有右子节点，且右子节点要比左子节点优先级高
                c = array[child = right];
            if (key.compareTo((T) c) <= 0)
                // key 要比 c 的优先级高，找到位置了，退出循环
                break;
            // 这里说明 key 的优先级要比 c 低
            array[k] = c;
            // 继续向下找
            k = child;
        }
        // 走到这里，说明已经找到合适的位置 k 了，赋值即可
        array[k] = key;
    }
}
```



## PriorityBlockingQueue 小结

- PriorityBlockingQueue 是一个**无界阻塞队列**，也是一个**优先队列**，底层使用**数组来表示堆**；
- PriorityBlockingQueue 使用一个 ReentrantLock 作入队出队等操作的同步；
- PriorityBlockingQueue 扩容时，使用一个 int 数 CAS 将值从 0 改为 1，来作为一个简单的锁；
