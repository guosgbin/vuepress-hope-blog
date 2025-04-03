---
title: 03-引用类型原子类AtomicReference
---



| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年08月17日23:19:35 |



## 简介

前面已经介绍了基本类型的原子类 AtomicInteger、AtomicBoolean 和 AtomicLong。本篇讲一下引用类型的原子类 AtomicReference。

AtomicReference 同样是基于 sun.misc.Unsafe 类的 API 来实现的，基本上就是 CAS 了。

因为 CAS 有 ABA 问题，为了解决这个问题又有下面两个类：

1. AtomicStampedReference：**带版本号（int**）；
2. AtomicMarkableReference：**带标记（boolean）**；



## AtomicReference 分析

### AtomicReference 的属性

```java
public class AtomicReference<V> implements java.io.Serializable {
    private static final long serialVersionUID = -1848883965231344442L;

    private static final Unsafe unsafe = Unsafe.getUnsafe();
    // value 在 AtomicReference 的地址偏移量
    private static final long valueOffset;

    static {
        try {
            valueOffset = unsafe.objectFieldOffset
                (AtomicReference.class.getDeclaredField("value"));
        } catch (Exception ex) { throw new Error(ex); }
    }

    // 持有一个对象的引用
    private volatile V value;

    // ...
}
```

AtomicReference 和基本类型原子类的哪些类十分类似，就是多了一个泛型而已，同样是封装了一个 value 属性。

关于 AtomicReference 的 API 也和 AtomicLong 基本上一样，可以自己去看。



AtomicReference 是针对对象的引用的，也就是用 CAS 去操作封装对象的引用。

### AtomicReference 使用模板

```java
AtomicReference<Object> ref = new AtomicReference<>(new Object());
// 自旋 + CAS
for(;;) {
    Object oldObj = ref.get();
    // 对旧的 oldObj 做了一些操作，得到一个新的 Object 对象
    Object newObj = doSomeOperate(oldObj);
    // cas
    if (ref.compareAndSet(oldObj, newObj)) {
         break;
    }
}
```



示例：

首先给个类，后面对这个类的对象做 CAS 操作。

```java
class Stock {
    // 商品名
    private String goodsName;
    // 商品库存
    private Integer count;
}
```



测试：

```java
private Stock stock = new Stock("华为手机", 0);
private AtomicReference<Stock> stockRef = new AtomicReference<>(stock);

@Test
public void testIntroduceRight() throws InterruptedException {
    List<Thread> list = new ArrayList<>();

    Runnable task = () -> {
        for (; ; ) { // 自旋
            Stock stock = stockRef.get();
            Stock newStock = new Stock(stock.getGoodsName(), stock.count + 1);
            // CAS 操作
            if (stockRef.compareAndSet(stock, newStock)) {
                System.out.println(newStock);
                break;
            }
            try {
                TimeUnit.MILLISECONDS.sleep(100);
            } catch (InterruptedException e) {
            }
        }
    };

    for (int i = 0; i < 100; i++) {
        Thread thread = new Thread(task);
        list.add(thread);
        thread.start();
    }

    for (Thread thread : list) {
        thread.join();
    }

    System.out.println("============");
    System.out.println(stockRef.get());
}
```

最后控制台打印的是 100；



### CAS 的 ABA 问题

下面的 sleep 方法是睡眠指定的毫秒数

```java
@Test
public void testABAProblem() throws InterruptedException {
    AtomicReference<Integer> ref = new AtomicReference<>(100);
    Thread t1 = new Thread(() -> {
        sleep(100);
        // 先从 100 设置到 50
        ref.compareAndSet(100, 50);
        sleep(100);
        // 再将 50 恢复到 100
        ref.compareAndSet(50, 100);
        System.out.println("引用值从 100 -> 50 -> 100");
    }, "update-thread");

    Thread t2 = new Thread(() -> {
        Integer value = ref.get();
        System.out.println("===========" + value);
        // 拿到了 value 值，模拟去做别的操作
        sleep(1000);
        boolean setSuccess = ref.compareAndSet(value, 200);
        if (setSuccess) {
            System.out.println(Thread.currentThread().getName() + "发现引用值还是 100，就改成了 200");
        } else {
            System.out.println(Thread.currentThread().getName() + "设置 200 失败");
        }
    }, "read-thread");

    // 打印监控线程
    Thread t3 = new Thread(() -> {
        int i = 0;
        while (true) {
            sleep(10);
            System.out.println(i++ + " " + Thread.currentThread().getName() + " " + ref.get());
        }
    }, "monitor-thread");

    t3.setDaemon(true);
    t3.start();
    TimeUnit.MILLISECONDS.sleep(100);
    t1.start();
    t2.start();

    t1.join();
    t2.join();
    System.out.println("===");
}
```

测试的基本思路如下

有三个线程

1. update-thread：将值从 100 改到 50，再恢复到 100；
2. read-thread：将值从 100 改到 200；
3. monitor-thread：循环打印封装的引用的值；



在 read-thread 线程中，先获取了 AtomicReference 的封装的值，过了一会儿再去更新该值，会发现更新成功，因为这时的值确实是 100，然后更新成了 200。

现象，控制台打印（省略一些）：

```
0 monitor-thread 100
1 monitor-thread 100
......
6 monitor-thread 100
7 monitor-thread 100
read-thread获取到值：100
8 monitor-thread 100
9 monitor-thread 100
......
14 monitor-thread 100
15 monitor-thread 100
16 monitor-thread 50
17 monitor-thread 50
......
22 monitor-thread 50
23 monitor-thread 50
引用值从 100 -> 50 -> 100
24 monitor-thread 100
25 monitor-thread 100
......
86 monitor-thread 100
87 monitor-thread 100
read-thread发现引用值还是 100，就改成了 200
===
88 monitor-thread 200
89 monitor-thread 200
```

这就是 ABA 问题，虽然最终还是从 100 改成了 200，看起来是没什么问题，其实大部分确实没什么问题。但是，有些操作会依赖于对象的变化过程，此时的解决思路一般就是使用版本号（版本号不能回退）。



有个 ABA 问题的场景，例如栈，假如开始的时候如下面所示

```
top
|
V  
A -> B -> C
```

线程 A 使用 CAS 尝试将 top 指针由 A 指向 B，意思就是将 A 弹出。

在线程 A 做 CAS 操作之前，线程 B 做了如下操作，弹出 A 和 B，并压栈了 A ，此时这个栈如下

```
top
|
V  
A -> C
```

在线程 B 操作玩后，线程 A 继续允许上面没运行的 CAS，由于之前是尝试将 top 指针指向 B，那么此次就指向了 B，栈中只剩了一个孤零零的元素 B，这是和预期不符的。

> 关于 ABA 问题可以看 https://en.wikipedia.org/wiki/ABA_problem

## AtomicStampedReference

### AtomicStampedReference 分析

既然 AtomicReference 有 ABA 问题，Doug Lea 整出了带版本号功能的 AtomicStampedReference。

首先看 AtomicStampedReference 的内部类 Pair，主要是封装了两个属性，

1. **reference：原子更新的对象**；
2. **stamp：int 类型的版本号，后续 CAS 更新的时候会校验这个版本号；**

```java
public class AtomicStampedReference<V> {

    private static class Pair<T> {
        // 引用
        final T reference;
        // 版本号
        final int stamp;
        private Pair(T reference, int stamp) {
            this.reference = reference;
            this.stamp = stamp;
        }
        static <T> Pair<T> of(T reference, int stamp) {
            return new Pair<T>(reference, stamp);
        }
    }

    // 封装的对象
    private volatile Pair<V> pair;
    
    // ...
}
```



接下来看 sun.misc.Unsafe 的操作，主要就是通过 sun.misc.Unsafe 获取 pair 属性的相对地址偏移量。

有个 casPair 方法，就是尝试 CAS 操作 Pair 对象。

```java
// Unsafe mechanics

private static final sun.misc.Unsafe UNSAFE = sun.misc.Unsafe.getUnsafe();
private static final long pairOffset =
    objectFieldOffset(UNSAFE, "pair", AtomicStampedReference.class);

private boolean casPair(Pair<V> cmp, Pair<V> val) {
    return UNSAFE.compareAndSwapObject(this, pairOffset, cmp, val);
}

static long objectFieldOffset(sun.misc.Unsafe UNSAFE,
                              String field, Class<?> klazz) {
    try {
        return UNSAFE.objectFieldOffset(klazz.getDeclaredField(field));
    } catch (NoSuchFieldException e) {
        // Convert Exception to corresponding Error
        NoSuchFieldError error = new NoSuchFieldError(field);
        error.initCause(e);
        throw error;
    }
}
```





OK ，版本号机制体现在 AtomicStampedReference#compareAndSet 方法：

可以看到，首先会校验期望引用和期望版本号是否正确，然后才会去调用 CAS 操作。

> 注意：版本号一般要设置一直增加的（一直减少也行），版本号的值不能有回退的操作，否则还是会出现 ABA 问题

```java
/**
 * 带版本号校验的 CAS 更新
 * @param expectedReference 期望值
 * @param newReference 新值
 * @param expectedStamp 期望的版本号
 * @param newStamp 新版本号
 */
public boolean compareAndSet(V   expectedReference,
                             V   newReference,
                             int expectedStamp,
                             int newStamp) {
    Pair<V> current = pair;
    return
        expectedReference == current.reference &&
        expectedStamp == current.stamp &&
        ((newReference == current.reference &&
          newStamp == current.stamp) ||
         casPair(current, Pair.of(newReference, newStamp)));
}
```



### 解决上面的例子的 ABA 问题

```java
/**
 * 解决 ABA 问题
 */
@Test
public void testABAProblem() throws InterruptedException {
    // 初始版本号是 1
    AtomicStampedReference<Integer> ref = new AtomicStampedReference<>(100, 1);
    Thread t1 = new Thread(() -> {
        String name = Thread.currentThread().getName();
        int stamp = ref.getStamp();
        ref.compareAndSet(100, 50, stamp, stamp + 1);
        System.out.printf("%s 引用值从 100 -> 50\n", name);
        sleep(100);
        int stamp2 = ref.getStamp();
        ref.compareAndSet(50, 100, stamp2, stamp2 + 1);
        System.out.printf("%s 引用值从 50 -> 100\n", name);
    }, "update-thread");

    Thread t2 = new Thread(() -> {
        String name = Thread.currentThread().getName();
        Integer value = ref.getReference();
        int stamp = ref.getStamp();
        // 拿到了 value 值，模拟去做别的操作
        sleep(1000);
        boolean updateSuccess = ref.compareAndSet(value, 200, stamp, stamp + 1);
        if (updateSuccess) {
            System.out.printf("%s 更新成功\n", name);
        } else {
            System.out.printf("%s 更新失败，实际的版本号 %s，当前线程得到的版本号 %s\n", name, ref.getStamp(), stamp);
        }
    }, "read-thread");

    Thread t3 = new Thread(() -> {
        int i = 1;
        while (true) {
            sleep(10);
            System.out.printf("%s %s %s 版本号 %s\n", i++, Thread.currentThread().getName(),
                    ref.getReference(), ref.getStamp());
        }
    }, "monitor-thread");

    t3.setDaemon(true);
    t3.start();
    sleep(100);
    t1.start();
    t2.start();

    t1.join();
    t2.join();
    System.out.println("===");
}
```



控制台（省略部分）：

```java
1 monitor-thread 100 版本号 1
2 monitor-thread 100 版本号 1
......
7 monitor-thread 100 版本号 1
8 monitor-thread 100 版本号 1
update-thread 引用值从 100 -> 50
9 monitor-thread 50 版本号 2
10 monitor-thread 50 版本号 2
......
15 monitor-thread 50 版本号 2
16 monitor-thread 50 版本号 2
update-thread 引用值从 50 -> 100
17 monitor-thread 100 版本号 3
18 monitor-thread 100 版本号 3
......
85 monitor-thread 100 版本号 3
86 monitor-thread 100 版本号 3
read-thread 更新失败，实际的版本号 3，当前线程得到的版本号 2
===
87 monitor-thread 100 版本号 3
88 monitor-thread 100 版本号 3
89 monitor-thread 100 版本号 3
```

可以看到，虽然值一样，但是由于版本号不一致，导致更新失败了。

## AtomicMarkableReference

AtomicMarkableReference 也是用来解决 ABA 问题的，和 AtomicStampedReference 的区别就是：

1. AtomicStampedReference 的 Pair 中的版本属性是 int 类型；
2. AtomicMarkableReference 的 Pair 中的属性是 boolean 类型；



AtomicMarkableReference 的 Pair 类

```java
private static class Pair<T> {
    // 引用
    final T reference;
    // 标记位
    final boolean mark;
    private Pair(T reference, boolean mark) {
        this.reference = reference;
        this.mark = mark;
    }
    static <T> Pair<T> of(T reference, boolean mark) {
        return new Pair<T>(reference, mark);
    }
}
```



那这个类有什么用呢？有时候我们并不关心引用变量更改了几次，只是单纯的关心变量**是否更改过**。