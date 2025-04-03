---
title: 04-原子数组类AtomicLongArray
---



| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年08月18日09:16:28 |

## 简介

原子数组就是能以原子的方式操作数组中的每一个元素，需要注意的是，是原子操作数组中的每个元素，而不是原子操作数组。

在 JUC 包中有如下几种原子数组：

1. AtomicLongArray；
2. AtomicIntegerArray；
3. AtomicReferenceArray；



本篇以 AtomicLongArray 为例分析，其他两种的实现相似。

## AtomicLongArray



```java
public class AtomicLongArray implements java.io.Serializable {
    private static final long serialVersionUID = -2308431214976778248L;

    private static final Unsafe unsafe = Unsafe.getUnsafe();
    // 数组的第一个元素相对该数组的地址偏移量
    private static final int base = unsafe.arrayBaseOffset(long[].class);
    // 用于快速计算索引 i 处的相对地址偏移量
    private static final int shift;
    // 当前封装的数组
    private final long[] array;

  	// ...
}
```

先看一下 AtomicLongArray 类的一些属性：

1. unsafe：就是 sun.misc.Unsafe 类对象；
2. base：数组的第一个元素在相对该数组的地址偏移量；
3. shift：用于位运算，计算数组中索引 i 处的元素相对 base 的地址偏移量；
4. array：AtomicLongArray 封装的数组；

> AtomicLongArray 使用的是 final 关键字在多线程环境下的语义（如果把数组定义为 volatile 类型，其里面的数组元素在读写方面是没有 volatile 语义的）



下面看下 shift 字段的值的获取和使用

获取：

```java
static {
    // 获取数组中每个元素占用的字节数
    int scale = unsafe.arrayIndexScale(long[].class);
    if ((scale & (scale - 1)) != 0)
        throw new Error("data type scale not a power of two");
    // 获取数组中每个元素占用的字节数是 2 的几次幂，用于后面做位运算
    shift = 31 - Integer.numberOfLeadingZeros(scale);
}
```

1. 首先通过 sun.misc.Unsafe 获取数组中相邻元素的地址偏移量的间隔值 scale；
2. 校验数组中每个元素占的地址是否是 2 的 n 次幂；
3. 因为 scale 需要是 2 的 n 次幂，所以通过 `31 - Integer.numberOfLeadingZeros(scale);`可以得出 scale 到底是 2 的几次幂，赋值给 shift 变量；



使用：

```java
/**
 * 获取索引 i 位置的元素的地址偏移量
 */
private static long byteOffset(int i) {
    return ((long) i << shift) + base;
}
```

这样我们就可以通过 AtomicLongArray#byteOffset 方法得到原子数组中的每一个元素相对数组的地址偏移量了，这样就可以针对数组中的每一个元素进行 CAS 操作了。



AtomicLongArray 的 API 就比较简单，举一个例子来看：

AtomicLongArray#getAndSet

```java
/**
 *
 * @param i 索引
 * @param 新值
 * @return 返回旧值
 */
public final long getAndSet(int i, long newValue) {
    return unsafe.getAndSetLong(array, checkedByteOffset(i), newValue);
}
```

sun.misc.Unsafe#getAndSetLong

```java
public final long getAndSetLong(Object o, long offset, long newValue) {
    long v;
    do {
        v = getLongVolatile(o, offset);
    } while (!compareAndSwapLong(o, offset, v, newValue));
    return v;
}
```



## 其它原子数组

关于另外两个原子数组，实现和 AtomicLongArray 基本上一样，大家可以自己看。

1. AtomicIntegerArray；
2. AtomicReferenceArray；