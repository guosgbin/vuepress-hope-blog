---
title: 09-线程体系-NioEventLoop开启Selector及优化
date: 2022-02-23 18:38:06
tags: 
  - Netty
categories:
  - Netty
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年2月23日18:38:06  |
| V2   | 重构 | 2023年05月20日17:14:52 |

## 开启 Selector 入口

在 NioEventLoop 的构造方法中调用 NioEventLoop#openSelector 方法开启 Selector。

```java
NioEventLoop(NioEventLoopGroup parent, Executor executor, SelectorProvider selectorProvider,
             SelectStrategy strategy, RejectedExecutionHandler rejectedExecutionHandler,
             EventLoopTaskQueueFactory taskQueueFactory, EventLoopTaskQueueFactory tailTaskQueueFactory) {
    // 参数一：当前NioEventLoop所属的NioEventLoopGroup
    // 参数二：ThreadPerTaskExecutor, 是在Group中创建的
    // 参数三：
    // 参数四：最终返回的是一个队列，最大程度是Integer.MAX_VALUE，最小是16
    // 参数五：大部分用不到这个queue
    // 参数六：线程池拒绝策略
    super(parent, executor, false, newTaskQueue(taskQueueFactory), newTaskQueue(tailTaskQueueFactory),
            rejectedExecutionHandler);
    this.provider = ObjectUtil.checkNotNull(selectorProvider, "selectorProvider");
    this.selectStrategy = ObjectUtil.checkNotNull(strategy, "selectStrategy");
    // 创建包装后的Selector和未包装的Selector实例
    // 也就是每个NioEventLoop都持有有一个Selector实例
    final SelectorTuple selectorTuple = openSelector();
    this.selector = selectorTuple.selector;
    this.unwrappedSelector = selectorTuple.unwrappedSelector;
}
```

## Selector 优化

### Selector 优化开关

在 JDK NIO 的 API 中开启 Selector，只需要调用 Selector.open() 或者 SelectorProvider 的 openSelector() 方法即可。

**Netty 针对 Selector 有一个优化开关，优化开关如下，可以用通过 io.netty.noKeySetOptimization 参数设置，false 表示不进行优化，使用原生的 Selector。**

```java
private static final boolean DISABLE_KEY_SET_OPTIMIZATION =
        SystemPropertyUtil.getBoolean("io.netty.noKeySetOptimization", false);
```

### 为什么要优化原生的 Selector

sun.nio.ch.SelectorImpl 对象中的 selectedKeys 和  publicSelectedKeys 两个 HashSet 集合 。

- selectedKeys：已经就绪的 SelectionKey 的集合，拥有所有操作事件准备就绪的 Key；
- publicSelectedKeys：外部访问就绪的通道的 SelectionKey 的集合， 它是由 selectedKeys 集合包装成不可修改的集合；

```java
public abstract class SelectorImpl extends AbstractSelector {
    protected Set<SelectionKey> selectedKeys = new HashSet();
    protected HashSet<SelectionKey> keys = new HashSet();
    private Set<SelectionKey> publicKeys;
    private Set<SelectionKey> publicSelectedKeys;
 
    // 省略其他......
}
```

优化原生的 Selector 的原因如下：

1. **在 JDK 原生的 NIO 中，已经就绪通道的 SelectionKey 是存在 HashSet 中的，因为 HashSet 的 add 方法在发送哈希冲突时候的消耗的时间比较多，最差的情况下时间复杂度是 O(n)；**
2. **在处理完就绪通道的 SelectionKey 的时候，都需要手动去调用 remove 方法去移除已经处理完的 SelectionKey，比较麻烦；**

### NioEventLoop#openSelector 方法

```java
private SelectorTuple openSelector() {
    final Selector unwrappedSelector;
    try {
        // 获取 JDK 原生的选择器对象
        unwrappedSelector = provider.openSelector();
    } catch (IOException e) {
        throw new ChannelException("failed to open a new selector", e);
    }

    if (DISABLE_KEY_SET_OPTIMIZATION) {
        // 配置的是不优化选择器，直接返回
        return new SelectorTuple(unwrappedSelector);
    }

    // 使用反射机制，获取JDK底层的Selector的Class对象
    Object maybeSelectorImplClass = AccessController.doPrivileged(new PrivilegedAction<Object>() {
        @Override
        public Object run() {
            try {
                return Class.forName(
                        "sun.nio.ch.SelectorImpl",
                        false,
                        PlatformDependent.getSystemClassLoader());
            } catch (Throwable cause) {
                return cause;
            }
        }
    });

    // ......省略异常处理的逻辑......

    final Class<?> selectorImplClass = (Class<?>) maybeSelectorImplClass;
    // 当前NioEventLoop的Selector就绪事件的集合
    final SelectedSelectionKeySet selectedKeySet = new SelectedSelectionKeySet();

    Object maybeException = AccessController.doPrivileged(new PrivilegedAction<Object>() {
        @Override
        public Object run() {
            try {
                // 通过反射获取原生 selectorImpl 的 selectedKeys 和 publicSelectedKeys 两个字段
                Field selectedKeysField = selectorImplClass.getDeclaredField("selectedKeys");
                Field publicSelectedKeysField = selectorImplClass.getDeclaredField("publicSelectedKeys");
                
                // ......省略 JDK8 以上的处理和一些权限校验的代码......

                // 将上面获取的两个属性重新赋值为Netty的SelectedSelectionKeySet
                selectedKeysField.set(unwrappedSelector, selectedKeySet);
                publicSelectedKeysField.set(unwrappedSelector, selectedKeySet);
                return null;
            } catch (NoSuchFieldException e) {
                return e;
            } catch (IllegalAccessException e) {
                return e;
            }
        }
    });

    // ......省略异常处理的逻辑......
    
    selectedKeys = selectedKeySet;
    logger.trace("instrumented a special java.util.Set into: {}", unwrappedSelector);
    return new SelectorTuple(unwrappedSelector,
                             new SelectedSelectionKeySetSelector(unwrappedSelector, selectedKeySet));
}
```

上面的方法省略了一些不重要的代码。主要流程如下

- 假如未开启优化，直接返回 SelectorTuple 封装的 Selector；
- 假如开启了 Selector 优化，通过反射将已经优化过的 SelectedSelectionKeySet 替换 selectedKeys 和 publicSelectedKeys 两个 HashSet 集合 。

关键的是两个对象 SelectedSelectionKeySet 和 SelectedSelectionKeySetSelector，这两个对象是 Selector 优化的关键。

## SelectedSelectionKeySet 类

前面已经说过在 JDK 原生的 NIO 中，已经就绪通道的 SelectionKey 是存在 HashSet 中的。假如 Netty 开启了优化 Selector，那么当通道事件就绪后 SelectionKey 将会存在 SelectedSelectionKeySet 类中。因为在 NioEventLoop#openSelector  方法中已经将这两个 HashSet 替换成 SelectedSelectionKeySet 了。

接下来分析下 SelectedSelectionKeySet 的原理：

```java
/**
 * 简化在轮询事件时的操作，不需要每次轮询都移除key
 */
final class SelectedSelectionKeySet extends AbstractSet<SelectionKey> {

    // 准备就绪的 Key 的容器
    SelectionKey[] keys;
    // 数组可读大小
    int size;

    SelectedSelectionKeySet() {
        keys = new SelectionKey[1024];
    }

    @Override
    public boolean add(SelectionKey o) {
        if (o == null) {
            return false;
        }

        keys[size++] = o;
        // 数组占满时，扩容操作
        if (size == keys.length) {
            increaseCapacity();
        }

        return true;
    }

    @Override
    public boolean remove(Object o) {
        return false;
    }

    @Override
    public boolean contains(Object o) {
        return false;
    }

    @Override
    public int size() {
        return size;
    }

    @Override
    public Iterator<SelectionKey> iterator() {
        return new Iterator<SelectionKey>() {
            private int idx;

            @Override
            public boolean hasNext() {
                return idx < size;
            }

            @Override
            public SelectionKey next() {
                if (!hasNext()) {
                    throw new NoSuchElementException();
                }
                return keys[idx++];
            }

            @Override
            public void remove() {
                throw new UnsupportedOperationException();
            }
        };
    }

    void reset() {
        reset(0);
    }

    void reset(int start) {
        // 将key数组从start位到size位全置为null
        Arrays.fill(keys, start, size, null);
        size = 0;
    }

    private void increaseCapacity() {
        SelectionKey[] newKeys = new SelectionKey[keys.length << 1];
        System.arraycopy(keys, 0, newKeys, 0, size);
        keys = newKeys;
    }
}
```

关键点：

- **使用数组代替 HashSet 来存储 SelectionKey，重写了 add() 和 iterator() 方法，使用数组的遍历效率更高；**
- **提供了 reset() 的 API，这样可以方便在处理完就绪事件的 SelectionKey 后清空已经出来完的事件了；**

## SelectedSelectionKeySetSelector 类

SelectedSelectionKeySetSelector 是 Netty 优化后的 Selector。它继承自JDK 的抽象类 java.nio.channels.Selector。

```java
final class SelectedSelectionKeySetSelector extends Selector {
    private final SelectedSelectionKeySet selectionKeys;
    private final Selector delegate;
 
    // ......省略成员方法......
    
}
```

可以看到有两个成员属性 SelectedSelectionKeySet 和 Selector。SelectedSelectionKeySetSelector 中的所有 API 最后都是委托给 JDK 原生的 Selector 去处理的。

在 SelectedSelectionKeySetSelector#select 相关的方法中，会先调用上一节提到的 reset()  的 API，这样就可以自动的清除已经处理完的通道的就绪事件的 SelectionKey，不用像使用原生 API 那样手动清除了。

```java
@Override
public int selectNow() throws IOException {
    selectionKeys.reset();
    return delegate.selectNow();
}

@Override
public int select(long timeout) throws IOException {
    selectionKeys.reset();
    return delegate.select(timeout);
}

@Override
public int select() throws IOException {
    selectionKeys.reset();
    return delegate.select();
}
```

## 小结

**JDK 原生的 Selector 实现通道就绪事件是保存在 HashSet 中的，插入和遍历效率不高，而且每次处理完就绪事件后都要手动清空这个 HashSet。Netty 针对这些痛点进行了优化，使用数组替代 HashSet，每次自动清理处理完的就绪事件。**

还有一个重要原因是，数组可以利用 CPU 缓存行的优势来提高遍历的效率。