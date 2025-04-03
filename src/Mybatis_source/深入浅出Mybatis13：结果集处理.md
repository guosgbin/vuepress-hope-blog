---
title: 13-结果集处理
---

| 版本 | 内容 | 时间                  |
| ---- | ---- | --------------------- |
| V1   | 新建 | 2021年6月20日23:32:33 |

## ResultContext

ResultContext接口表示结果上下文，每个对象对应数据库操作的一条数据。

**有一个默认的实现类DefaultResultContext**

成员变量如下：

```java
// 结果对象
private T resultObject;
// 表明当前对象是第几个结果对象
private int resultCount;
// 是否使用完毕，true-表示结果已经被取走
private boolean stopped;
```

## ResultHandler

ResultHandler对象表示结果处理器，数据库操作后得到的结果会交给它处理，也就是处理ResultContext。

它有两个实现类DefaultMapResultHandler和DefaultResultHandler。

DefaultMapResultHandler：处理Map类型的结果。

DefaultResultHandler：处理List类型的结果。



关于DefaultMapResultHandler

成员变量如下

```java
// Map形式的映射结果
private final Map<K, V> mappedResults;
// Map的键。由用户指定，是结果对象中的某个属性名
private final String mapKey;
private final ObjectFactory objectFactory;
private final ObjectWrapperFactory objectWrapperFactory;
private final ReflectorFactory reflectorFactory;
```

处理ResultContext对象。

```java
/**
 * 处理一个结果
 *
 * @param context 一个结果
 */
@Override
public void handleResult(ResultContext<? extends V> context) {
    // 从结果上下文中取出结果对象
    final V value = context.getResultObject();
    // 获得结果对象的元对象
    final MetaObject mo = MetaObject.forObject(value, objectFactory, objectWrapperFactory, reflectorFactory);
    // TODO is that assignment always true?
    // 基于元对象取出key对应的值
    final K key = (K) mo.getValue(mapKey);
    mappedResults.put(key, value);
}
```



而DefaultResultHandler的就比较简单了

成员变量就是一个List集合

```java
private final List<Object> list;
```

处理ResultContext对象就是直接添加到List集合中去。

```java
@Override
public void handleResult(ResultContext<?> context) {
    list.add(context.getResultObject());
}
```

## ResultSetWrapper

顾名思义ResultSetWrapper就是对JDK的ResultSet对象的封装，装饰器模式。

## ResultSetHandler

ResultSetHandler是用于处理结果集的，嵌套结果集和普通结果集都是这个类来处理的。

本篇看一个最简单的流程，同时也是大部分情况走的流程。

org.apache.ibatis.executor.resultset.DefaultResultSetHandler#handleResultSets方法来处理结果集，针对但结果集的操作会到`handleResultSet()`方法，

```java
private void handleResultSet(ResultSetWrapper rsw, ResultMap resultMap, List<Object> multipleResults, ResultMapping parentMapping) throws SQLException {
    try {
        if (parentMapping != null) {
            // 嵌套的结果
            // 向子方法传入parentMapping。处理结果中的记录。
            handleRowValues(rsw, resultMap, null, RowBounds.DEFAULT, parentMapping);
        } else {
            if (resultHandler == null) {
                // defaultResultHandler能够将结果对象聚合成一个List返回
                DefaultResultHandler defaultResultHandler = new DefaultResultHandler(objectFactory);
                // 处理结果中的记录。
                handleRowValues(rsw, resultMap, defaultResultHandler, rowBounds, null);
                multipleResults.add(defaultResultHandler.getResultList());
            } else {
                handleRowValues(rsw, resultMap, resultHandler, rowBounds, null);
            }
        }
    } finally {
        // issue #228 (close resultsets)
        closeResultSet(rsw.getResultSet());
    }
}
```



会调用`handleRowValues()`方法

```java
public void handleRowValues(ResultSetWrapper rsw, ResultMap resultMap, ResultHandler<?> resultHandler, RowBounds rowBounds, ResultMapping parentMapping) throws SQLException {
    if (resultMap.hasNestedResultMaps()) {
        // 前置校验
        ensureNoRowBounds();
        checkResultHandler();
        // 处理嵌套映射
        handleRowValuesForNestedResultMap(rsw, resultMap, resultHandler, rowBounds, parentMapping);
    } else {
        // 处理单层映射
        handleRowValuesForSimpleResultMap(rsw, resultMap, resultHandler, rowBounds, parentMapping);
    }
}
```



关注处理单层映射`handleRowValuesForSimpleResultMap()`

```java
private void handleRowValuesForSimpleResultMap(ResultSetWrapper rsw, ResultMap resultMap, ResultHandler<?> resultHandler, RowBounds rowBounds, ResultMapping parentMapping)
    throws SQLException {
    DefaultResultContext<Object> resultContext = new DefaultResultContext<>();
    // 当前要处理的结果集
    ResultSet resultSet = rsw.getResultSet();
    // 根据翻页配置，跳过指定的行
    skipRows(resultSet, rowBounds);
    // 持续处理下一条结果，判断条件为：还有结果需要处理 && 结果集没有关闭 && 还有下一条结果
    while (shouldProcessMoreRows(resultContext, rowBounds) && !resultSet.isClosed() && resultSet.next()) {
        // 获得最终要使用的resultMap
        ResultMap discriminatedResultMap = resolveDiscriminatedResultMap(resultSet, resultMap, null);
        // 拿到了一行记录，并且将其转化为一个对象
        Object rowValue = getRowValue(rsw, discriminatedResultMap, null);
        // 把这一行记录转化出的对象存起来
        storeObject(resultHandler, resultContext, rowValue, parentMapping, resultSet);
    }
}
```



最终会`getRowValue()`方法将一行记录转换成对象

首先会反射创建映射的结果集对象，然后会根据自动映射和手动映射给对象的属性赋值。

```java
private Object getRowValue(ResultSetWrapper rsw, ResultMap resultMap, String columnPrefix) throws SQLException {
    final ResultLoaderMap lazyLoader = new ResultLoaderMap();
    // 创建这一行记录对应的对象
    Object rowValue = createResultObject(rsw, resultMap, lazyLoader, columnPrefix);
    if (rowValue != null && !hasTypeHandlerForResultObject(rsw, resultMap.getType())) {
        // 根据对象得到其MetaObject
        final MetaObject metaObject = configuration.newMetaObject(rowValue);
        boolean foundValues = this.useConstructorMappings;
        // 是否允许自动映射未明示的字段
        if (shouldApplyAutomaticMappings(resultMap, false)) {
            // 自动映射未明示的字段
            foundValues = applyAutomaticMappings(rsw, resultMap, metaObject, columnPrefix) || foundValues;
        }
        // 按照明示的字段进行重新映射
        foundValues = applyPropertyMappings(rsw, resultMap, metaObject, lazyLoader, columnPrefix) || foundValues;
        foundValues = lazyLoader.size() > 0 || foundValues;
        rowValue = foundValues || configuration.isReturnInstanceForEmptyRow() ? rowValue : null;
    }
    return rowValue;
}
```

在拿到一条记录之后，就会调用org.apache.ibatis.executor.resultset.DefaultResultSetHandler#storeObject方法存储得到的对象。

```java
private void storeObject(ResultHandler<?> resultHandler, DefaultResultContext<Object> resultContext, Object rowValue, ResultMapping parentMapping, ResultSet rs) throws SQLException {
    if (parentMapping != null) {
        // 存在父级，则将这一行记录对应的结果对象绑定到父级结果上
        linkToParents(rs, parentMapping, rowValue);
    } else {
        // 使用resultHandler存储对象
        callResultHandler(resultHandler, resultContext, rowValue);
    }
}

private void callResultHandler(ResultHandler<?> resultHandler, DefaultResultContext<Object> resultContext, Object rowValue) {
    resultContext.nextResultObject(rowValue);
    ((ResultHandler<Object>) resultHandler).handleResult(resultContext);
}
```


