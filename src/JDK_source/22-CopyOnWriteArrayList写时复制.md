---
title: 22-CopyOnWriteArrayList写时复制
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年11月04日13:17:01 |

## CopyOnWriteArrayList 概述

CopyOnWriteArrayList 针对读操作未加锁，对所有的写操作加锁。使用的是「写时复制」的思想，也就是在写操作的时候会复制一份新的数组去修改。

适用于读操作的次数远远大于写操作的次数的场景。

## 核心属性

CopyOnWriteArrayList 有两个核心属性，

- ReentrantLock lock；
- Object[] array；

CopyOnWriteArrayList 的思想是「写时复制」，就是写操作时，会复制一份数组出来，在写操作期间其他线程读取的数据还是之前的旧数组，等待写操作完成后会将底层数组的引用设置为新的数组。

CopyOnWriteArrayList 的写操作都是需要使用 ReentrantLock 进行同步操作的。

## 核心方法

既然是集合，那么核心方法就是添加和删除了。



### 添加操作

CopyOnWriteArrayList#add(E)

添加操作很简单，就是先获取锁，然后复制一个新的数组出来，然后将新的数组设置到 CopyOnWriteArrayList 的array 属性。

```java
/*
 * 添加元素，需要获取互斥锁
 */
public boolean add(E e) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 获取旧数组
        Object[] elements = getArray();
        int len = elements.length;
        // 复制一个新的数组
        Object[] newElements = Arrays.copyOf(elements, len + 1);
        // 将最后一个位置赋值为新添加的值
        newElements[len] = e;
        // 重新设置数组
        setArray(newElements);
        return true;
    } finally {
        lock.unlock();
    }
}
```



### 删除操作

CopyOnWriteArrayList#remove(int)

删除操作也是需要先获取锁对象，复制一份新的数组出来，然后再新的数组上进行删除操作，操作完后，就将新的数组设置到 CopyOnWriteArrayList 的 array 属性。

```java
/*
 * 移除 index 位置的元素，需要获取互斥锁
 */
public E remove(int index) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 获取旧数组
        Object[] elements = getArray();
        int len = elements.length;
        // 获取 index 位置的元素值
        E oldValue = get(elements, index);
        int numMoved = len - index - 1;
        if (numMoved == 0)
            // numMoved == 0 说明移除的是集合的最后一个元素
            setArray(Arrays.copyOf(elements, len - 1));
        else {
            // 创建新的数组
            Object[] newElements = new Object[len - 1];
            // 这两个复制数组的操作就是为了删除 index 位置的元素
            System.arraycopy(elements, 0, newElements, 0, index);
            System.arraycopy(elements, index + 1, newElements, index, numMoved);
            // 重新设置数组
            setArray(newElements);
        }
        return oldValue;
    } finally {
        lock.unlock();
    }
}
```



### 写操作小结

除开上面的添加和删除方法，其他写操作的流程都是个样的：

1. 获取锁；
2. 复制一个新的数组，操作新数组；
3. 设置新数组到 CopyOnWriteArrayList 的 array 属性；
4. 释放锁；

## 迭代器 COWIterator

```java
static final class COWIterator<E> implements ListIterator<E> {
    /** Snapshot of the array */
    // 数组的快照
    private final Object[] snapshot;
    /** Index of element to be returned by subsequent call to next.  */
    // 后续调用 next 将返回的元素的索引
    private int cursor;

    private COWIterator(Object[] elements, int initialCursor) {
        cursor = initialCursor;
        snapshot = elements;
    }

    public boolean hasNext() {
        return cursor < snapshot.length;
    }

    public boolean hasPrevious() {
        return cursor > 0;
    }

    @SuppressWarnings("unchecked")
    public E next() {
        if (! hasNext())
            throw new NoSuchElementException();
        return (E) snapshot[cursor++];
    }

    @SuppressWarnings("unchecked")
    public E previous() {
        if (! hasPrevious())
            throw new NoSuchElementException();
        return (E) snapshot[--cursor];
    }

    public int nextIndex() {
        return cursor;
    }

    public int previousIndex() {
        return cursor-1;
    }

    /**
     * Not supported. Always throws UnsupportedOperationException.
     * @throws UnsupportedOperationException always; {@code remove}
     *         is not supported by this iterator.
     */
    public void remove() {
        throw new UnsupportedOperationException();
    }

    /**
     * Not supported. Always throws UnsupportedOperationException.
     * @throws UnsupportedOperationException always; {@code set}
     *         is not supported by this iterator.
     */
    public void set(E e) {
        throw new UnsupportedOperationException();
    }

    /**
     * Not supported. Always throws UnsupportedOperationException.
     * @throws UnsupportedOperationException always; {@code add}
     *         is not supported by this iterator.
     */
    public void add(E e) {
        throw new UnsupportedOperationException();
    }

    @Override
    public void forEachRemaining(Consumer<? super E> action) {
        Objects.requireNonNull(action);
        Object[] elements = snapshot;
        final int size = elements.length;
        for (int i = cursor; i < size; i++) {
            @SuppressWarnings("unchecked") E e = (E) elements[i];
            action.accept(e);
        }
        cursor = size;
    }
}
```



在分析 COWIterator 之前先看下获取 COWIterator 的方式：

获取迭代器的方法

```java
public Iterator<E> iterator() {
    return new COWIterator<E>(getArray(), 0);
}
```

CopyOnWriteArrayList#getArray 方法就是获取 CopyOnWriteArrayList 的 array 属性，

```java
final Object[] getArray() {
    return array;
}
```

可以看到，传入 COWIterator 的数组只是在某一时刻的快照，CopyOnWriteArrayList 的数组可能会在 COWIterator 迭代的过程中被修改了。



下面讲下 COWIterator 的特点：

1. 这是迭代器可以正向迭代，也可以方向迭代；
2. 迭代的数组是**创建的时刻**的 CopyOnWriteArrayList 的数组的**一个快照**；
3. 这个迭代器不会抛出 ConcurrentModificationException，**不支持修改操作**，修改操作会抛出 UnsupportedOperationException；

## 小结

**对比 ArrayList 说说 CopyOnWriteArrayList 的增删改查实现原理？** 

ArrayList 和 CopyOnWriteArrayList 底层都是通过数组来实现的，它们的读写操作区别是

- ArrayList 的读写操作都没有进行同步，所有它是线程不安全的；
- CopyOnWriteArrayList 的读操作没有进行同步，但是写操作都是通过 ReentrantLock 进行同步的。基于「写时复制」的思想。
  - 某个线程进行写操作时需要获取锁，获取到锁后复制一个新的数组操作，操作完后设置到 CopyOnWriteArrayList 的 array 属性中去；
  - 其他线程获取的数据可能不是最新的；



**弱一致性的迭代器 COWIterator 的原理是怎么样的？**

- 传入的数组是创建 COWIterator 那个时刻的数组快照，所以可能迭代的数据可能不是最新的；



**CopyOnWriteArrayList 有何缺陷，说说其应用场景？**

- 缺陷：
  - 在写操作时需要复制一个新的数组，假如数据量很大的话，就是一个很大的开销了。
  - CopyOnWriteArrayList 的数据是最终一致性的，不满足实时的要求；
- 应用场景是在读操作的次数远远大于写操作的次数；
