---
title: 02-基本类型原子类AtomicLong
---



| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年08月17日22:20:04 |



## 简介

在 JUC 中有三个基本类型的原子操作类 AtomicInteger、AtomicBoolean 和 AtomicLong，就是能够原子更新 int，boolean 和 long 类型的值，这三个类的实现方式类似，本篇以 AtomicLong 分析。

## AtomicLong 属性

```java
public class AtomicLong extends Number implements java.io.Serializable {
    private static final long serialVersionUID = 1927816293512124184L;
    private static final Unsafe unsafe = Unsafe.getUnsafe();
    // value 的偏移量
    private static final long valueOffset;

    static {
        try {
            // 获取 value 变量在 AtomicLong 类中的偏移量，保存到 valueOffset 中
            valueOffset = unsafe.objectFieldOffset
                (AtomicLong.class.getDeclaredField("value"));
        } catch (Exception ex) { throw new Error(ex); }
    }

    // 实际操作的变量值，初始值为 0
    // volatile 保证了线程之间的可见性
    private volatile long value;

	// ...
}
```

AtomicLong 中封装了 long 类型的 value 字段，通过 Unsafe 类的 api 获取 value 属性在 AtomicLong 中的地址偏移量 valueOffset，后面就可以直接通过 valueOffset 去访问 value 了。



## AtomicLong 的 API

AtomicLong 中的大部分操作都是通过 Unsafe 类的 api 处理的，基本的处理思想就是“自旋+CAS”，只有设置成功后才退出循环。

例如：

```java
public final long getAndIncrement() {
    return unsafe.getAndAddLong(this, valueOffset, 1L);
}
```

其中 sun.misc.Unsafe#getAndAddLong

```java
public final long getAndAddLong(Object o, long offset, long delta) {
    long v;
    do {
        v = getLongVolatile(o, offset);
    } while (!compareAndSwapLong(o, offset, v, v + delta));
    return v;
}
```

其他 API 可以自行去看源码，都是一样的处理逻辑。



关于 AtomicLong#lazySet 的方法，可以看看下面的链接

>  https://blog.csdn.net/ITer_ZC/article/details/40744485
>
> http://ifeve.com/juc-atomic-class-lazyset-que/
>
> https://blog.csdn.net/szhlcy/article/details/102561224