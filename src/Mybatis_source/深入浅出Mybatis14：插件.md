---
title: 14-插件
---

| 版本 | 内容 | 时间                  |
| ---- | ---- | --------------------- |
| V1   | 新建 | 2021年6月21日23:14:56 |

## 插件入门案例

在学习插件之前，看一个入门的插件案例

拦截器类：

```java
@Intercepts(@Signature(
        // 要拦截的类
        type = StatementHandler.class,
        // 要拦截的类中的拦截的方法
        method = "prepare",
        // 拦截方法的入参的类型
        args = {Connection.class, Integer.class}
))
public class SimpleIntercept implements Interceptor {
    private String beforeInfo;
    private String afterInfo;

    /**
     * 拦截方法做的事
     *
     * @param invocation
     * @return
     * @throws Throwable
     */
    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        System.out.println("拦截prepare方法之前: " + beforeInfo);
        StatementHandler statementHandler = (StatementHandler) invocation.getTarget();
        String sql = statementHandler.getBoundSql().getSql();
        System.out.println("此次要执行的SQL是 --> " + sql);
        // 执行原有方法
        Object proceed = invocation.proceed();
        System.out.println("拦截prepare方法之后: " + afterInfo);
        return proceed;
    }

//    @Override
//    public Object plugin(Object target) {
//        return null;
//    }

    /**
     * 赋值属性
     * @param properties
     */
    @Override
    public void setProperties(Properties properties) {
        beforeInfo = String.valueOf(properties.get("beforeInfo"));
        afterInfo = String.valueOf(properties.get("afterInfo"));
    }
}
```

全局配置文件注册插件：

```xml
<plugins>
    <plugin interceptor="cn.guosgbin.mybatis.example.plugin.SimpleIntercept">
        <property name="beforeInfo" value="配置的开始参数"/>
        <property name="afterInfo" value="配置的结束参数"/>
    </plugin>
</plugins>
```

执行一个SQL控制台打印：

```
拦截prepare方法之前: 配置的开始参数
此次要执行的SQL是 --> SELECT * FROM tb_user WHERE
         
             id in (  
                ?
             , 
                ?
             )
2021-06-21 22:34:21,138 375    [           main] DEBUG per.UserMapper.selectUserByIds  - ==>  Preparing: SELECT * FROM tb_user WHERE id in ( ? , ? )
拦截prepare方法之后: 配置的结束参数
```

## 插件开发

开发Mybatis插件需要实现一个Interceptor接口，重写它的方法。在类上使用@Intercepts注解。

上面的案例中，我们是这样写的

```java
@Intercepts(@Signature(
        // 要拦截的类
        type = StatementHandler.class,
        // 要拦截的类中的拦截的方法
        method = "prepare",
        // 拦截方法的入参的类型
        args = {Connection.class, Integer.class}
))
```

@Intercepts注解中是@Signature注解的数组。@Signature的属性如下

- type：表示要拦截的类。在Mybatis中支持拦截的有Executor、StatementHandler、ParamHandler、ResultSetHandler这几个对象。
- method：表示拦截的类的那一个方法。
- args：表示拦截的方法的入参类型。



关于Interceptor接口，它的源码如下

```java
/**
 * @author Clinton Begin
 */
public interface Interceptor {

  Object intercept(Invocation invocation) throws Throwable;

  default Object plugin(Object target) {
    return Plugin.wrap(target, this);
  }

  default void setProperties(Properties properties) {
    // NOP
  }

}
```

- intercept：是我们每次拦截到指定方法后，会执行此处的代码。
- plugin：默认方法，实现类可以选择重写该方法，作用是把输入的对象转为一个新的对象输出。
- setProperties：默认方法，实现类可以选择重写该方法，为拦截器设置属性。

## 源码分析

Mybatis的插件机制使用了责任链模式和代理模式。

### 解析插件配置入口

既然插件是在全局配置文件中去配置的，很明显注册插件就是在XMLConfigBuilder#parseConfiguration方法中处理的。

```java
private void pluginElement(XNode parent) throws Exception {
    if (parent != null) {
        for (XNode child : parent.getChildren()) {
            // 获取拦截器的全限定
            String interceptor = child.getStringAttribute("interceptor");
            // 获取设置的属性
            Properties properties = child.getChildrenAsProperties();
            Interceptor interceptorInstance = (Interceptor) resolveClass(interceptor).getDeclaredConstructor().newInstance();
            interceptorInstance.setProperties(properties);
            // 添加到拦截器链中
            configuration.addInterceptor(interceptorInstance);
        }
    }
}
```

最终都存到了的Configuration的InterceptorChain属性中去了

```java
protected final InterceptorChain interceptorChain = new InterceptorChain();
```

InterceptorChain类的代码如下，可以看到都添加到interceptors列表中去了。

```java
/**
 * @author Clinton Begin
 */
public class InterceptorChain {

    private final List<Interceptor> interceptors = new ArrayList<>();

    public Object pluginAll(Object target) {
        for (Interceptor interceptor : interceptors) {
            target = interceptor.plugin(target);
        }
        return target;
    }

    public void addInterceptor(Interceptor interceptor) {
        interceptors.add(interceptor);
    }

    public List<Interceptor> getInterceptors() {
        return Collections.unmodifiableList(interceptors);
    }

}
```

### Configuration简单工厂

前面我们说了，Myabtis中只能对Executor、StatementHandler、ParamHandler、ResultSetHandler这几个类进行拦截，这是因为这几个对象的创建都是在Configuration类中，Configuration作为了一个简单工厂的角色。

拿StatementHandler的创建举例，在每次创建后都会调用拦截器链interceptorChain的`pluginAll()`方法。

```java
public StatementHandler newStatementHandler(Executor executor, MappedStatement mappedStatement, Object parameterObject, RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) {
    StatementHandler statementHandler = new RoutingStatementHandler(executor, mappedStatement, parameterObject, rowBounds, resultHandler, boundSql);
    statementHandler = (StatementHandler) interceptorChain.pluginAll(statementHandler);
    return statementHandler;
}
```

而`pluginAll()`方法其实就是循环调用Interceptor的`plugin()`方法，Interceptor接口中它是一个默认方法，我们自己写的插件可以选择性的实现`plugin()`方法。

默认的实现是调用Plugin的静态方法`wrap()`去创建一个动态代理对象。

### Plugin

Plugin类是一个Mybatis插件体系的核心类。实现了InvocationHandler接口。

上面说到在默认情况下`pluginAll()`会挨个调用多个拦截器的`plugin()`方法，默认情况是调用Plugin的静态方法`wrap()`去创建一个动态代理对象。

```java
public static Object wrap(Object target, Interceptor interceptor) {
    Map<Class<?>, Set<Method>> signatureMap = getSignatureMap(interceptor);
    Class<?> type = target.getClass();
    Class<?>[] interfaces = getAllInterfaces(type, signatureMap);
    if (interfaces.length > 0) {
        return Proxy.newProxyInstance(
            type.getClassLoader(),
            interfaces,
            new Plugin(target, interceptor, signatureMap));
    }
    return target;
}
```

首先会`getSignatureMap()`方法，这时候就回去解析类上的@Intercepts注解了。这个方法会将这些拦截器的类型作为key，要拦截的方法的集合作为value存到signatureMap中。

```java
private static Map<Class<?>, Set<Method>> getSignatureMap(Interceptor interceptor) {
  Intercepts interceptsAnnotation = interceptor.getClass().getAnnotation(Intercepts.class);
  // issue #251
  if (interceptsAnnotation == null) {
    throw new PluginException("No @Intercepts annotation was found in interceptor " + interceptor.getClass().getName());
  }
  Signature[] sigs = interceptsAnnotation.value();
  Map<Class<?>, Set<Method>> signatureMap = new HashMap<>();
  for (Signature sig : sigs) {
    Set<Method> methods = MapUtil.computeIfAbsent(signatureMap, sig.type(), k -> new HashSet<>());
    try {
      Method method = sig.type().getMethod(sig.method(), sig.args());
      methods.add(method);
    } catch (NoSuchMethodException e) {
      throw new PluginException("Could not find method on " + sig.type() + " named " + sig.method() + ". Cause: " + e, e);
    }
  }
  return signatureMap;
}
```

当执行了我们要拦截的方法时，会调用Plugin的`invoke()`方法。

会先得到先前存储的要拦截的方法，假如是@Signature注解配置的要拦截的对象，就会去执行我们写的拦截器的`intercept()`方法。假如不是要拦截的方法就不拦截了。

```java
@Override
public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    try {
        Set<Method> methods = signatureMap.get(method.getDeclaringClass());
        if (methods != null && methods.contains(method)) {
            return interceptor.intercept(new Invocation(target, method, args));
        }
        return method.invoke(target, args);
    } catch (Exception e) {
        throw ExceptionUtil.unwrapThrowable(e);
    }
}
```