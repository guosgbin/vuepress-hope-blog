---
title: 05-原子操作类AtomicReferenceFieldUpdater
---



| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2022年08月21日17:51:02 |



## 简介

在 JUC 包中有三个原子操作类

1. AtomicIntegerFieldUpdater；
2. AtomicLongFieldUpdater；
3. AtomicReferenceFieldUpdater；

看名字就能知道它们针对的类型了，本篇针对 AtomicIntegerFieldUpdater 类来分析，其他两个类的实现方式类似。

## 引入

模拟多个线程更新 People 类的 money 变量；

提供了两个增加的方法，一个是使用 AtomicIntegerFieldUpdater 来更新的，一个直接自增的。

```java
class People {
    private volatile int money;
    private static final AtomicIntegerFieldUpdater<People> MONEY_UPDATER =
            AtomicIntegerFieldUpdater.newUpdater(People.class, "money");

    public void addMoneyAtomic() {
        MONEY_UPDATER.addAndGet(this, 1);
    }

    public void addMoney() {
        money++;
    }

    public int getMoney() {
        return money;
    }
}
```



首先用 `addMoney()` 方法测试，最终控制台打印的大概率不是 1000，使用`addMoneyAtomic()`一定是 1000 了。

```java
@Test
public void test() throws InterruptedException {
    People people = new People();
    Random random = new Random();
    List<Thread> list = new ArrayList<>();

    for (int i = 0; i < 1000; i++) {
        Thread t = new Thread(() -> {
            sleep(random.nextInt(100));
            people.addMoneyAtomic();
        });
        list.add(t);
        t.start();
    }

    for (Thread thread : list) {
        thread.join();
    }

    System.out.println(people.getMoney());
}
```



单纯从功能上来讲，使用 AtomicIntegerFieldUpdater 实现的并发控制，其它原子类也能实现，例如 AtomicInteger 。至于为什么引入 AtomicIntegerFieldUpdater 这几种类后面分析，下面看下 AtomicIntegerFieldUpdater 的原理。

## AtomicIntegerFieldUpdater

### AtomicIntegerFieldUpdater 初始化

外部获取 AtomicIntegerFieldUpdater 对象只能通过 AtomicIntegerFieldUpdater#newUpdater 方法，

```java
@CallerSensitive
public static <U> AtomicIntegerFieldUpdater<U> newUpdater(Class<U> tclass,
                                                          String fieldName) {
    return new AtomicIntegerFieldUpdaterImpl<U>
        (tclass, fieldName, Reflection.getCallerClass());
}
```

其实就是创建一个内部类 AtomicIntegerFieldUpdaterImpl，下面看下这个内部类的字段和构造方法

```java
private static final class AtomicIntegerFieldUpdaterImpl<T>
    extends AtomicIntegerFieldUpdater<T> {
    private static final sun.misc.Unsafe U = sun.misc.Unsafe.getUnsafe();
    private final long offset;
    /**
     * if field is protected, the subclass constructing updater, else
     * the same as tclass
     */
    private final Class<?> cclass;
    /** class holding the field */
    private final Class<T> tclass;

    AtomicIntegerFieldUpdaterImpl(final Class<T> tclass,
                                  final String fieldName,
                                  final Class<?> caller) {
        // 更新的字段
        final Field field;
        // 更新的字段的修饰符
        final int modifiers;
        try {
            // 获取要更新字段的对象
            field = AccessController.doPrivileged(
                new PrivilegedExceptionAction<Field>() {
                    public Field run() throws NoSuchFieldException {
                        return tclass.getDeclaredField(fieldName);
                    }
                });
            // 获取修饰符
            modifiers = field.getModifiers();
            // 校验是否有访问权限
            sun.reflect.misc.ReflectUtil.ensureMemberAccess(
                caller, tclass, null, modifiers);
            ClassLoader cl = tclass.getClassLoader();
            ClassLoader ccl = caller.getClassLoader();
            if ((ccl != null) && (ccl != cl) &&
                ((cl == null) || !isAncestor(cl, ccl))) {
                // 检查包权限
                sun.reflect.misc.ReflectUtil.checkPackageAccess(tclass);
            }
        } catch (PrivilegedActionException pae) {
            throw new RuntimeException(pae.getException());
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }

        // 必须是 int
        if (field.getType() != int.class)
            throw new IllegalArgumentException("Must be integer type");

        // 必须是 volatile 修饰
        if (!Modifier.isVolatile(modifiers))
            throw new IllegalArgumentException("Must be volatile type");

        // Access to protected field members is restricted to receivers only
        // of the accessing class, or one of its subclasses, and the
        // accessing class must in turn be a subclass (or package sibling)
        // of the protected member's defining class.
        // If the updater refers to a protected field of a declaring class
        // outside the current package, the receiver argument will be
        // narrowed to the type of the accessing class.
        this.cclass = (Modifier.isProtected(modifiers) &&
                       tclass.isAssignableFrom(caller) &&
                       !isSamePackage(tclass, caller))
                      ? caller : tclass;
        this.tclass = tclass;
        this.offset = U.objectFieldOffset(field);
    }
}
```

OK，AtomicIntegerFieldUpdaterImpl 整了一大堆，其实就是校验了一堆东西。

从上基本可以看到使用 AtomicIntegerFieldUpdater 的一些限制

1. 操作的字段不能是 static 修饰的；
2. 操作的字段必须是 volatile 修饰的；
3. 操作的字段不能是 final 修饰的（当然 final 字段和 volatile 是不能修饰一个字段的）；
4. 对于 AtomicIntegerFieldUpdater 来说，操作的字段必须是 int 类型的，（AtomicLongFieldUpdater 操作的必须是 long 类型的字段）；
5. 假如 AtomicIntegerFieldUpdater 的对象在类 A 中，那么希望原子操作的字段必须对 AtomicIntegerFieldUpdater 可见，也就是 AtomicIntegerFieldUpdater 能够访问到；

### CAS 操作

拿 AtomicIntegerFieldUpdater#compareAndSet 举例，最终会调到下面的方法，其中 U 就是 sun.misc.Unsafe 对象。

```java
public final boolean compareAndSet(T obj, int expect, int update) {
    accessCheck(obj);
    return U.compareAndSwapInt(obj, offset, expect, update);
}
```

其他 API 都是通过 sun.misc.Unsafe 处理的，可自行查看。

## 引入 AtomicIntegerFieldUpdater 原因

AtomicIntegerFieldUpdater 这几个类能实现的功能，那些原子类 AtomicInteger 也能做到，那么为什么要引入 AtomicIntegerFieldUpdater 呢？

1. 对于某个字段我们想要原子更新它，但是也有不需要原子更新它的需求，这时候就可以用 AtomicIntegerFieldUpdater 了；
2. AtomicIntegerFieldUpdater 这种类可以节约内存，一般用 AtomicIntegerFieldUpdater 都用 static final 修饰。假如使用原子类 AtomicInteger，在对象很多的情况下会额外占用不少内存。

> 参考 https://cloud.tencent.com/developer/article/1520161