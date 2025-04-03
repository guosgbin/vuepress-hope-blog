---
title: 23-CopyOnWriteArraySet写时复制
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年11月04日13:27:47 |



## 概述

CopyOnWriteArraySet 中的所有操作都是通过 CopyOnWriteArrayList 实现的。

所以 CopyOnWriteArraySet 其实没什么好分析的，大概分析下。



## 构造方法和属性

```java
// 该 set 是通过 cow 实现的
private final CopyOnWriteArrayList<E> al;

/**
 * Creates an empty set.
 */
public CopyOnWriteArraySet() {
    al = new CopyOnWriteArrayList<E>();
}
```

可以看到就是创建一个 CopyOnWriteArrayList 对象。



## 增删改查

下面看下它的增删改查的方法，就是直接调用的 CopyOnWriteArrayList 的方法

```java
// 调用 cow 的不重复添加的方法
public boolean add(E e) {
    return al.addIfAbsent(e);
}

public boolean remove(Object o) {
    return al.remove(o);
}
```



## 迭代器

```java
public Iterator<E> iterator() {
    return al.iterator();
}
```

获取的迭代器也是 CopyOnWriteArrayList 的迭代器。

## 小结

使用 CopyOnWriteArrayList 实现 Set 的一些操作，它的特性如下：
1. 适用于数据量很小的集合，读操作远远大于写操作；
2. 线程安全；
3. 写操作的消耗很昂贵，因为都需要复制底层数组；
4. 迭代器不支持 remove 操作；
5. 通过迭代器的遍历很快，不会遇到其他线程的干扰。迭代器依赖于构造迭代器时数组的不变快照。
