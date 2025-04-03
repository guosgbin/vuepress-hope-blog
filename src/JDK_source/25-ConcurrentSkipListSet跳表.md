---
title: 25-ConcurrentSkipListSet跳表
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年11月13日18:33:11 |

## ConcurrentSkipListSet 概述

ConcurrentSkipListSet 就是我们认知的 Set 集合，只不过底层是通过跳表实现的。

JDK 提供的 HashSet 内部的操作都是委托给 HashMap 实现的，ConcurrentSkipListSet 也是这样，其内部的操作都是委托 ConcurrentSkipListMap 实现的。

## ConcurrentSkipListSet 原理

ConcurrentSkipListSet 的内部有一个 ConcurrentSkipListMap 类型的属性：

```java
/**
 * The underlying map. Uses Boolean.TRUE as value for each
 * element.  This field is declared final for the sake of thread
 * safety, which entails some ugliness in clone().
 */
private final ConcurrentNavigableMap<E,Object> m;
```

看一个 ConcurrentSkipListSet 的构造方法，可以看到是直接创建一个 ConcurrentSkipListMap 对象，Set 内部的操作都是委托给 ConcurrentSkipListMap 对象的。

```java
public ConcurrentSkipListSet() {
    m = new ConcurrentSkipListMap<E,Object>();
}
```

所以 ConcurrentSkipListSet 就是一种跳表的数据结构，它的时间复杂度

| Algorithm | **Average** | **Worst case** |
| :-------- | ----------- | -------------- |
| Space     | O(n)        | O(nlogn)       |
| Search    | O(logn)     | O(n)           |
| Insert    | O(logn)     | O(n)           |
| Delete    | O(logn)     | O(n)           |



看下 ConcurrentSkipListSet 的增删改查的方法

```java
public boolean add(E e) {
    return m.putIfAbsent(e, Boolean.TRUE) == null;
}

public boolean remove(Object o) {
    return m.remove(o, Boolean.TRUE);
}

public int size() {
    return m.size();
}

public boolean isEmpty() {
    return m.isEmpty();
}
```

可以看到基本上都是调用的 ConcurrentSkipListMap 的对应的方法。

需要注意的是，因为 ConcurrentSkipListMap 的 key 和 value 都不允许为空，所以 ConcurrentSkipListSet 都给 value 设置为 Boolean.TRUE。