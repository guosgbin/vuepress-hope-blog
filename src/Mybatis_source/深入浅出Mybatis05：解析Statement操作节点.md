---
title: 05-解析Statement操作节点
---



| 版本 | 内容 | 时间                 |
| ---- | ---- | -------------------- |
| V1   | 新建 | 2021年6月8日22:38:42 |


摘要：本篇主要讲解是Mybatis是如何解析Mapper映射文件中的数据库操作节点，也就是SELECT、INSERT、UPDATE、DELETE这四个节点。

## XML方式

### XML方式的解析入口

在XMLMapperBuilder类的`buildStatementFromContext()`方法，入参时Mapper文件中的所有的SELECT、INSERT、UPDATE、DELETE标签得到的XNode对象。

```java
private void buildStatementFromContext(List<XNode> list, String requiredDatabaseId) {
    for (XNode context : list) {
        final XMLStatementBuilder statementParser = new XMLStatementBuilder(configuration, builderAssistant, context, requiredDatabaseId);
        try {
            statementParser.parseStatementNode();
        } catch (IncompleteElementException e) {
            // 解析错误的话，是会放到configuration存起来，后续处理
            configuration.addIncompleteStatement(statementParser);
        }
    }
}
```

循环遍历每个结点，然后创建一个XMLStatementBuilder来解析每个节点。

### 准备

在看XMLStatementBuilder的`parseStatementNode()`源码之前，我们需要回顾下CURD标签都有哪些属性可以配置。

**SELECT标签**

```
id="selectPerson"
parameterType="int"
parameterMap="deprecated"
resultType="hashmap"
resultMap="personResultMap"
flushCache="false"
useCache="true"
timeout="10"
fetchSize="256"
statementType="PREPARED"
resultSetType="FORWARD_ONLY"
databaseId="dev"
resultOrdered="false"
resultSets="blogs,authors"
```

**insert和update标签**

```
id
parameterTyp
parameterMap
flushCache
timeout
statementType
useGeneratedKeys
keyProperty
keyColumn
databaseId
```

**insert标签**

```
id
parameterTyp
parameterMap
flushCache
timeout
statementType
databaseId
```

在insert标签中，有一个子标签`<selectKey>`。

许多数据库都支持主键自增，例如MySQL，SQL Server，这是我们可以使用insert标签的useGeneratedKeys属性来得到自增主键。但是也有一个数据库不支持自动生成主键的，这时候就可以使用`<selectKey>`标签来进行操作了。

关于自增主键的类Myabtis中提供了两种：

1. SelectKeyGenerator：为不支持生产主键的数据库准备的。
2. Jdbc3KeyGenerator：为有支持生产主键的数据库准备的，其实它只是将数据库生成的主键回填到Java对象中，并没有生成主键的能力。

本篇的重点不是解析自增主键，关于这个后面有机会讲。

**selectKey 标签的属性**

```
keyProperty
keyColumn
resultType
order
statementType
```

### parseStatementNode方法

```java
/**
 * 解析select、insert、update、delete这四类节点
 */
public void parseStatementNode() {
  // 读取当前节点的id与databaseId
  String id = context.getStringAttribute("id");
  String databaseId = context.getStringAttribute("databaseId");
  // 验证节点的id与databaseId是否和当前Configuration中的databaseId是否是一致的。
  // MyBatis允许多数据库配置，所以有些语句只对特定数据库生效
  if (!databaseIdMatchesCurrent(id, databaseId, this.requiredDatabaseId)) {
    return;
  }

  // 获取节点名称 select update等
  String nodeName = context.getNode().getNodeName();
  // 变大写 得到SQL语句的类型
  SqlCommandType sqlCommandType = SqlCommandType.valueOf(nodeName.toUpperCase(Locale.ENGLISH));
  // 是否是查询语句
  boolean isSelect = sqlCommandType == SqlCommandType.SELECT;
  // 是否有flushCache属性，有个默认值是!isSelect，也就是说是查询语句的话flushCache就是关掉的，反之开着
  boolean flushCache = context.getBooleanAttribute("flushCache", !isSelect);
  // 是否有useCache属性，有个默认isSelect，也就是说查询语句是会去使用缓存的
  boolean useCache = context.getBooleanAttribute("useCache", isSelect);
  // 是否右resultOrdered属性，默认false
  boolean resultOrdered = context.getBooleanAttribute("resultOrdered", false);

  // Include Fragments before parsing
  // 处理语句中的Include节点  <include refid="somethingId"/>
  XMLIncludeTransformer includeParser = new XMLIncludeTransformer(configuration, builderAssistant);
  includeParser.applyIncludes(context.getNode());

  // 获得入参类型
  String parameterType = context.getStringAttribute("parameterType");
  Class<?> parameterTypeClass = resolveClass(parameterType);

  // 语句类型 默认是XMLLanguageDriver
  String lang = context.getStringAttribute("lang");
  LanguageDriver langDriver = getLanguageDriver(lang);

  // Parse selectKey after includes and remove them.
  // 这是生成主键的
  // 处理SelectKey节点，在这里会将KeyGenerator加入到Configuration.keyGenerators中
  processSelectKeyNodes(id, parameterTypeClass, langDriver);

  // Parse the SQL (pre: <selectKey> and <include> were parsed and removed)
  // 此时，<selectKey> 和 <include> 标签都已被解析完毕并被删除，开始进行SQL解析
  KeyGenerator keyGenerator;
  String keyStatementId = id + SelectKeyGenerator.SELECT_KEY_SUFFIX;
  keyStatementId = builderAssistant.applyCurrentNamespace(keyStatementId, true);
  // 判断是否已经有解析好的KeyGenerator
  if (configuration.hasKeyGenerator(keyStatementId)) {
    keyGenerator = configuration.getKeyGenerator(keyStatementId);
  } else {
    // 全局或者本语句只要启用自动key生成，则使用key生成
    keyGenerator = context.getBooleanAttribute("useGeneratedKeys",
        configuration.isUseGeneratedKeys() && SqlCommandType.INSERT.equals(sqlCommandType))
        ? Jdbc3KeyGenerator.INSTANCE : NoKeyGenerator.INSTANCE;
  }

  // 获取标签中的各个配置属性
  SqlSource sqlSource = langDriver.createSqlSource(configuration, context, parameterTypeClass);
  StatementType statementType = StatementType.valueOf(context.getStringAttribute("statementType", StatementType.PREPARED.toString()));
  Integer fetchSize = context.getIntAttribute("fetchSize");
  Integer timeout = context.getIntAttribute("timeout");
  String parameterMap = context.getStringAttribute("parameterMap");
  String resultType = context.getStringAttribute("resultType");
  Class<?> resultTypeClass = resolveClass(resultType);
  String resultMap = context.getStringAttribute("resultMap");
  String resultSetType = context.getStringAttribute("resultSetType");
  ResultSetType resultSetTypeEnum = resolveResultSetType(resultSetType);
  if (resultSetTypeEnum == null) {
    resultSetTypeEnum = configuration.getDefaultResultSetType();
  }
  String keyProperty = context.getStringAttribute("keyProperty");
  String keyColumn = context.getStringAttribute("keyColumn");
  String resultSets = context.getStringAttribute("resultSets");

  // 在MapperBuilderAssistant的帮助下创建MappedStatement对象，并写入到Configuration中
  builderAssistant.addMappedStatement(id, sqlSource, statementType, sqlCommandType,
      fetchSize, timeout, parameterMap, parameterTypeClass, resultMap, resultTypeClass,
      resultSetTypeEnum, flushCache, useCache, resultOrdered,
      keyGenerator, keyProperty, keyColumn, databaseId, langDriver, resultSets);
}
```

接口看到`parseStatementNode()`方法又臭又长，我们来梳理一下整个流程

1. 获取标签的id和databaseId，判断当前的语句的databaseId是否是configuration中设置的databaseId，因为MyBatis允许多数据库配置，所以有些语句只对特定数据库生效。
2. 获取SQL语句的类型，也就是SqlCommandType枚举中的那些类型了。
3. 获取flushCache、useCache、resultOrdered等属性。
4. 使用XMLIncludeTransformer类来解析`<includ>`标签。
5. 处理`useGeneratedKeys`属性和`<selectKey>`标签，用于处理数据库的记录的主键。
6. 解析标签内的SQL，得到SqlSource对象。
7. 获取其他属性的值。
8. 最后调用addMappedStatement方法，构建MappedStatement对象并设置到configuration全局配置类中。

## 注解方式

### 注解方式的解析入口

在MapperAnnotationBuilder类的`parse() `方法中，最终会调用`parseStatement(method)`方法去解析Statement操作节点

### parseStatement方法

```java
/**
 * 解析该方法。主要是解析该方法上的注解信息
 *
 * @param method 要解析的方法
 */
void parseStatement(Method method) {
    // 通过getParameterType方法获取参数类型
    final Class<?> parameterTypeClass = getParameterType(method);
    // 获取方法的LanguageDriver
    final LanguageDriver languageDriver = getLanguageDriver(method);
    // 通过注解获取SqlSource
    getAnnotationWrapper(method, true, statementAnnotationTypes).ifPresent(statementAnnotation -> {
        // statementAnnotation变量是statementAnnotation类型
        final SqlSource sqlSource = buildSqlSource(statementAnnotation.getAnnotation(), parameterTypeClass, languageDriver, method);
        // 获取SQL语句的类型
        final SqlCommandType sqlCommandType = statementAnnotation.getSqlCommandType();
        // 获取方法上可能存在的配置信息，配置信息由@Options注解指定
        final Options options = getAnnotationWrapper(method, false, Options.class).map(x -> (Options)x.getAnnotation()).orElse(null);
        final String mappedStatementId = type.getName() + "." + method.getName();

        // 主键自动生成的处理

        // 用默认值初始化各项设置

        // 返回结果ResultMap处理

        // 将获取的映射信息存入Configuration
    }
```

这个方法也很长，所以省略了一些内容，其实和XML解析的流程和思想是一样的，只不过解析的对象不一样了，一个是XML，一个是注解。

