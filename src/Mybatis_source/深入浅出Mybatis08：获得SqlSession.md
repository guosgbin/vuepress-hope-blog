---
title: 08-获得SqlSession
---

| 版本 | 内容 | 时间                  |
| ---- | ---- | --------------------- |
| V1   | 新建 | 2021年6月14日18:44:17 |

摘要：本文介绍如何创建SqlSession对象，并且创建Executor执行器的流程。

## 如何SqlSession对象

在前面我们通过SqlSessionFactoryBuilder创建了一个SqlSessionFactory工厂，创建SqlSession用到了工厂模式。

SqlSessionFactory是一个接口，有一个默认的实现DefaultSqlSessionFactory，里面有很多`openSession()`的重载方法。

空参的方法最终会调用到下面的`openSession()`方法。

```java
/**
 * 从数据源中获取SqlSession对象
 *
 * @param execType 执行器类型
 * @param level 事务隔离级别
 * @param autoCommit 是否自动提交事务
 * @return SqlSession对象
 */
private SqlSession openSessionFromDataSource(ExecutorType execType, TransactionIsolationLevel level, boolean autoCommit) {
    Transaction tx = null;
    try {
        // 找出要使用的指定环境
        final Environment environment = configuration.getEnvironment();
        // 从环境中获取事务工厂
        final TransactionFactory transactionFactory = getTransactionFactoryFromEnvironment(environment);
        // 从事务工厂中生产事务
        tx = transactionFactory.newTransaction(environment.getDataSource(), level, autoCommit);
        // 创建执行器
        final Executor executor = configuration.newExecutor(tx, execType);
        // 创建DefaultSqlSession对象
        return new DefaultSqlSession(configuration, executor, autoCommit);
    } catch (Exception e) {
        closeTransaction(tx); // may have fetched a connection so lets call close()
        throw ExceptionFactory.wrapException("Error opening session.  Cause: " + e, e);
    } finally {
        ErrorContext.instance().reset();
    }
}
```

先从configuration中得到之前解析全局配置文件时的Environment对象。

然后获得环境中的TransactionFactory事务工厂，这是个接口，主要是按照配置文件在设置的配置的，如下面的transactionManager标签配置的JDBC类型，那么我们得到的就是JdbcTransactionFactory工厂，然后通过这个工厂创建一个JdbcTransaction事务对象出来。

```xml
 <!--配置默认的数据库环境-->
    <environments default="dev">
        <!--定义一个数据库连接环境-->
        <environment id="dev">
            <!--设置事务管理方式，选择JDBC管理事务-->
            <transactionManager type="JDBC"/>
            <!--设置数据源，POOLED，UNPOOLED，JNDI，使用POOLED-->
            <dataSource type="POOLED">
                <property name="driver" value="com.mysql.jdbc.Driver"/>
                <property name="url" value="jdbc:mysql://127.0.0.1/mybatis_example"/>
                <property name="username" value="root"/>
                <property name="password" value="root"/>
            </dataSource>
        </environment>
    </environments>
```

最后通过configuration对象创建一个Executor执行器出来，将Executor执行器作为参数创建一个默认的DefaultSqlSession对象。

## 创建执行器

在openSessionFromDataSource方法中有一行代码

```java
final Executor executor = configuration.newExecutor(tx, execType);
```

newExecutor方法：

```java
/**
 * 创建一个执行器
 *
 * @param transaction 事务
 * @param executorType 数据库操作类型
 * @return 执行器
 */
public Executor newExecutor(Transaction transaction, ExecutorType executorType) {
    executorType = executorType == null ? defaultExecutorType : executorType;
    executorType = executorType == null ? ExecutorType.SIMPLE : executorType;
    Executor executor;
    // 根据数据操作类型创建实际执行器
    if (ExecutorType.BATCH == executorType) {
        executor = new BatchExecutor(this, transaction);
    } else if (ExecutorType.REUSE == executorType) {
        executor = new ReuseExecutor(this, transaction);
    } else {
        executor = new SimpleExecutor(this, transaction);
    }
    // 根据配置文件中settings节点cacheEnabled配置项确定是否启用缓存
    // 如果配置启用缓存
    if (cacheEnabled) {
        // 使用CachingExecutor装饰实际执行器
        executor = new CachingExecutor(executor);
    }
    // 为执行器增加拦截器（插件），以启用各个拦截器的功能
    executor = (Executor) interceptorChain.pluginAll(executor);
    return executor;
}
```

在Configuration类中的成员变量可以看到Mybatis的二级缓存是默认开启的（当然需要你去映射文件设置`<cache>`或`<cache-ref>`才会真的生效），所以每次会先创建CachingExecutor对象，使用装饰者模式将真正的Executor执行器

```java
protected boolean cacheEnabled = true;
```

## DefaultSqlSession类

DefaultSqlSession类是SqlSession接口的一个默认实现，它的成员属性如下，它的属性中有一个特别重要的属性是Executor对象。

```java
// 配置信息
private final Configuration configuration;
// 执行器
private final Executor executor;
// 是否自动提交
private final boolean autoCommit;
// 缓存是否已经被污染
private boolean dirty;
// 游标列表
private List<Cursor<?>> cursorList;
```

SqlSession类使用门面模式将一些操作暴露给调用方。在DefaultSqlSession类中提供了很多的增删改查的方法，但是这些操作最终都委托给了Executor对象，Executor对象才是真正去执行语句的对象。

增删改查这些四种操作，其实可以分为两种，一种是查，另一种是改，增删改都是改。

查询操作最终都是调用`selectList`方法：

```java
/**
 * 查询结果列表
 *
 * @param <E> 返回的列表元素的类型
 * @param statement SQL语句
 * @param parameter 参数对象
 * @param rowBounds  翻页限制条件
 * @return 结果对象列表
 */
private <E> List<E> selectList(String statement, Object parameter, RowBounds rowBounds, ResultHandler handler) {
    try {
        // 获取查询语句
        MappedStatement ms = configuration.getMappedStatement(statement);
        // 委托给执行器去查询
        return executor.query(ms, wrapCollection(parameter), rowBounds, handler);
    } catch (Exception e) {
        throw ExceptionFactory.wrapException("Error querying database.  Cause: " + e, e);
    } finally {
        ErrorContext.instance().reset();
    }
}
```

而那些增删改操作都调用的是`update`方法：

```java
@Override
public int update(String statement, Object parameter) {
    try {
        dirty = true;
        MappedStatement ms = configuration.getMappedStatement(statement);
        // 委托给执行器去修改
        return executor.update(ms, wrapCollection(parameter));
    } catch (Exception e) {
        throw ExceptionFactory.wrapException("Error updating database.  Cause: " + e, e);
    } finally {
        ErrorContext.instance().reset();
    }
}
```

除开增删改查这些操作，还有关于食物相关的操作，例如`commit()`，`rollback()`等。