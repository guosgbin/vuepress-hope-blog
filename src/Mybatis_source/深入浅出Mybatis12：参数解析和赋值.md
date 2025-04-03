---
title: 12-参数解析和赋值
---

| 版本 | 内容 | 时间                  |
| ---- | ---- | --------------------- |
| V1   | 新建 | 2021年6月20日20:16:48 |

摘要：本篇主要分析映射接口的方法的参数的解析和参数值是如何赋值给占位符的。

## 获取入参和设置参数入口

### 保存参数值入口

org.apache.ibatis.reflection.ParamNameResolver#ParamNameResolver

就是ParamNameResolver的构造方法，会在org.apache.ibatis.binding.MapperMethod.MethodSignature#MethodSignature方法中会去创建一个ParamNameResolver对象。

### 获取参数值入口

在org.apache.ibatis.binding.MapperMethod#execute处会根据SQL的类型调用sqlSession的不同方法，但是它们都会执行下面的获取参数的方法：

```java
Object param = method.convertArgsToSqlCommandParam(args);
```

最终会调用org.apache.ibatis.reflection.ParamNameResolver#getNamedParams方法。

### 设置参数入口

在执行器做查询或者更新操作的时候，会创建一个StatementHandler对象，实际生产中大部分都是PreparedStatementHandler处理器。

在BaseStatementHandler中有一个ParameterHandler类型的成员变量，它就是用来设置参数的。

```java
protected final ParameterHandler parameterHandler;
```

org.apache.ibatis.executor.SimpleExecutor#prepareStatement方法：

```java
private Statement prepareStatement(StatementHandler handler, Log statementLog) throws SQLException {
    Statement stmt;
    Connection connection = getConnection(statementLog);
    stmt = handler.prepare(connection, transaction.getTimeout());
    handler.parameterize(stmt);
    return stmt;
}
```

最终会调用StatementHandler的`handler()`方法，在PreparedStatementHandler处理器中其实就是委托给了parameterHandler去设置参数。

## 参数解析器ParamNameResolver

ParamNameResolver的作用是用来解析Mapper接口的方法的参数的。

有两个重要的成员变量：最终解析出来的参数都存放到了SortedMap中保存。

```java
private final SortedMap<Integer, String> names; // 方法入参的参数次序表。键为参数次序，值为参数名称或者参数@Param注解的值

/**
 * 方法入参中是否含有@Param注解
 */
private boolean hasParamAnnotation;
```

### 参数解析的构造方法

在org.apache.ibatis.binding.MapperMethod.MethodSignature#MethodSignature方法中会去创建一个ParamNameResolver对象。

```java
public ParamNameResolver(Configuration config, Method method) {
    // 获取配置类中的配置， 是否需要使用实际的参数名
    this.useActualParamName = config.isUseActualParamName();
    // 获取方法的入参类型列表
    final Class<?>[] paramTypes = method.getParameterTypes();
    // 获取所有参数的注解 二维数组
    final Annotation[][] paramAnnotations = method.getParameterAnnotations();
    final SortedMap<Integer, String> map = new TreeMap<>();
    // 二维数组的长度
    int paramCount = paramAnnotations.length;
    // get names from @Param annotations
    // 循环处理各个参数
    for (int paramIndex = 0; paramIndex < paramCount; paramIndex++) {
        if (isSpecialParameter(paramTypes[paramIndex])) {
            // 跳过特殊的参数 RowBounds和ResultHandler类型的参数
            continue;
        }
        String name = null;
        for (Annotation annotation : paramAnnotations[paramIndex]) {
            if (annotation instanceof Param) {
                // 假如该入参有@Param注解，将hasParamAnnotation置为true
                hasParamAnnotation = true;
                // name改为 @Param的value值
                name = ((Param) annotation).value();
                break;
            }
        }
        // 到此处说明 没有@Param注解
        if (name == null) {
            // @Param was not specified.
            // 否则，保留参数的原有名称
            // 注意：需要在idea的设置里面 设置 -parameters 才会暂时参数原名，否则展示的还是arg1，arg2
            if (useActualParamName) {
                name = getActualParamName(method, paramIndex);
            }
            if (name == null) {
                // 参数名称取不到，则按照参数index命名
                // use the parameter index as the name ("0", "1", ...)
                // gcode issue #71
                name = String.valueOf(map.size());
            }
        }
        // 添加到map中
        map.put(paramIndex, name);
    }
    names = Collections.unmodifiableSortedMap(map);
}
```

假如Mapper映射接口如下：

```java
void testMethod01(Integer age);
void testMethod02(@Param("bigAge") Integer age);
void testMethod03(String name, Integer age);
void testMethod04(String name,  @Param("bigAge") Integer age);
void testMethod05(Map<Integer, String> map);
void testMethod06(User user);
void testMethod07(@Param("userrrr") User user);
```

那么调用构造方法执行完毕的map集合的数据如下：

```
{0=arg0}
{0=bigAge}
{0=arg0, 1=arg1}
{0=arg0, 1=bigAge}
{0=arg0}
{0=arg0}
{0=userrrr}
```

### 获取解析出得参数

先看结论：

单个参数：默认不做任何处理，除非设置了@Param注解。

多个参数：转换成map，也就是param1，param2这种。

```java
public Object getNamedParams(Object[] args) {
    // 入参个数
    final int paramCount = names.size();
    if (args == null || paramCount == 0) {
        return null;
    } else if (!hasParamAnnotation && paramCount == 1) {
        // 没有@param注解且 入参只有一个，直接拿第一个入参
        Object value = args[names.firstKey()];
        return wrapToMapIfCollection(value, useActualParamName ? names.get(0) : null);
    } else {
        // 此处情况
        // case1 有@param注解
        // case2 入参不止一个
        final Map<String, Object> param = new ParamMap<>();
        int i = 0;
        for (Map.Entry<Integer, String> entry : names.entrySet()) {
            // 首先按照类注释中提供的key,存入一遍   【参数的@Param名称 或者 参数排序：实参值】
            // 注意，key和value交换了位置
            param.put(entry.getValue(), args[entry.getKey()]);
            // add generic param names (param1, param2, ...)
            final String genericParamName = GENERIC_NAME_PREFIX + (i + 1);
            // ensure not to overwrite parameter named with @Param
            // 再按照param1, param2, ...的命名方式存入一遍
            if (!names.containsValue(genericParamName)) {
                param.put(genericParamName, args[entry.getKey()]);
            }
            i++;
        }
        return param;
    }
}
```

假如Mapper映射接口如下：

```java
void testMethod01(Integer age);
void testMethod02(@Param("bigAge") Integer age);
void testMethod03(String name, Integer age);
void testMethod04(String name,  @Param("bigAge") Integer age);
void testMethod05(Map<Integer, String> map);
void testMethod06(User user);
void testMethod07(@Param("userrrr") User user);
```

方法的入参依次如下：

```java
(new Object[]{333});
(new Object[]{555});
(new Object[]{"大烧瓶", 333});
(new Object[]{"大烧瓶", 666});

HashMap<Object, Object> map = new HashMap<>();
map.put(1,"111");
map.put(2,"222");
Object namedParams1 = resolver1.getNamedParams(new Object[]{map});

User user = new User();
user.setName("孔洁");
user.setAge(23);

User user = new User();
user.setName("李老八");
user.setAge(27);
```

方法的返回结果依次为：

```
333
{bigAge=555, param1=555}
{arg1=333, arg0=大烧瓶, param1=大烧瓶, param2=333}
{arg0=大烧瓶, bigAge=666, param1=大烧瓶, param2=666}
{1=111, 2=222}

User{id=null, name='孔洁', age=23, sex=null, address=null, birthday=null, createTime=null, updateTime=null}

{userrrr=User{id=null, name='孔洁', age=23, sex=null, address=null, birthday=null, createTime=null, updateTime=null}, param1=User{id=null, name='孔洁', age=23, sex=null, address=null, birthday=null, createTime=null, updateTime=null}}
```

## 参数处理器ParamHandler

前面分析了PreparedStatementHandler处理器会调用ParameterHandler的`setParameters()`方法给参数赋值

```java
@Override
public void setParameters(PreparedStatement ps) {
    ErrorContext.instance().activity("setting parameters").object(mappedStatement.getParameterMap().getId());
    // 取出参数列表
    List<ParameterMapping> parameterMappings = boundSql.getParameterMappings();
    if (parameterMappings != null) {
        for (int i = 0; i < parameterMappings.size(); i++) {
            ParameterMapping parameterMapping = parameterMappings.get(i);
            // ParameterMode.OUT是CallableStatement的输出参数，已经单独注册。故忽略
            if (parameterMapping.getMode() != ParameterMode.OUT) {
                Object value;
                // 取出属性名称,就是#{}中的名称
                String propertyName = parameterMapping.getProperty();
                // foreach标签的额外参数
                if (boundSql.hasAdditionalParameter(propertyName)) { // issue #448 ask first for additional params
                    // 从附加参数中读取属性值
                    value = boundSql.getAdditionalParameter(propertyName);
                } else if (parameterObject == null) {
                    value = null;
                } else if (typeHandlerRegistry.hasTypeHandler(parameterObject.getClass())) {
                    // 参数对象是基本类型，则参数对象即为参数值
                    value = parameterObject;
                } else {
                    // 参数对象是复杂类型，取出参数对象的该属性值
                    MetaObject metaObject = configuration.newMetaObject(parameterObject);
                    value = metaObject.getValue(propertyName);
                }
                // 确定该参数的处理器
                TypeHandler typeHandler = parameterMapping.getTypeHandler();
                JdbcType jdbcType = parameterMapping.getJdbcType();
                if (value == null && jdbcType == null) {
                    jdbcType = configuration.getJdbcTypeForNull();
                }
                try {
                    // 此方法最终根据参数类型，调用java.sql.PreparedStatement类中的参数赋值方法，对SQL语句中的参数赋值
                    typeHandler.setParameter(ps, i + 1, value, jdbcType);
                } catch (TypeException | SQLException e) {
                    throw new TypeException("Could not set parameters for mapping: " + parameterMapping + ". Cause: " + e, e);
                }
            }
        }
    }
}
```

关于上面的这个判断，其实是针对foreach标签的额外参数的设置。

```java
// foreach标签的额外参数
if (boundSql.hasAdditionalParameter(propertyName)) { // issue #448 ask first for additional params
    // 从附加参数中读取属性值
    value = boundSql.getAdditionalParameter(propertyName);
}
```

