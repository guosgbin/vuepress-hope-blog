---
title: 02-入门案例
---



| 版本 | 内容 | 时间                 |
| ---- | ---- | -------------------- |
| V1   | 新建 | 2021年6月6日18:39:06 |

**首先需要在pom文件在增加mybatis的依赖**

```xml
<properties>
    <maven.compiler.source>8</maven.compiler.source>
    <maven.compiler.target>8</maven.compiler.target>

    <mybatis.version>3.5.7</mybatis.version>
</properties>

<dependencies>
    <dependency>
        <groupId>org.mybatis</groupId>
        <artifactId>mybatis</artifactId>
        <version>${mybatis.version}</version>
    </dependency>
    <!--Junit单元测试-->
    <dependency>
        <groupId>junit</groupId>
        <artifactId>junit</artifactId>
        <version>4.12</version>
        <scope>test</scope>
    </dependency>
    <!--MySql的数据库驱动-->
    <dependency>
        <groupId>mysql</groupId>
        <artifactId>mysql-connector-java</artifactId>
        <version>5.1.46</version>
    </dependency>
    <!--Mybatis依赖的日志包-->
    <dependency>
        <groupId>log4j</groupId>
        <artifactId>log4j</artifactId>
        <version>1.2.17</version>
    </dependency>
</dependencies>
```

**再创建一个配置文件mybatis.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE configuration
        PUBLIC "-//mybatis.org//DTD Config 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-config.dtd">
<!--mybatis的核心配置文件，主要配置数据库连接信息-->
<configuration>

    <settings>
        <!--开启mybatis二级缓存-->
        <setting name="cacheEnabled" value="true"></setting>
    </settings>

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
    <!-- 映射文件的位置 -->
    <mappers>
        <package name="cn.guosgbin.mybatis.example.mapper"/>
    </mappers>
</configuration>
```

**创建一个实体类**

```java
public class User implements Serializable {
    private static final long serialVersionUID = 5954602998605246077L;
    
    private int id;
    private String name;
    private int age;
    private int sex;
    private int address;

    private LocalDate birthday;
    private LocalDate createTime;
    private LocalDate updateTime;

    // 省略其他方法
    
}
```

**创建持久层接口**

```java
public interface UserMapper {
    /**
     * 查询所有的用户
     */
    List<User> list();
}
```

**创建mapper.xml**

```xml
<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE mapper
        PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<!--namespace：给哪个接口配置的映射，写接口的全限定类名-->
<mapper namespace="cn.guosgbin.mybatis.example.mapper.UserMapper">

    <!--select标签：表示要执行查询语句； id：给接口里哪个方法配置的，写方法名；resultType：结果集封装类型-->
    <select id="list" resultType="cn.guosgbin.mybatis.example.entity.User">
        select * from tb_user
    </select>
    
</mapper>
```

**一切准备完毕后，编写测试文件进行测试**

```java
public class quickstartTest {
    @Test
    public void testQuickStart() throws IOException {
        // 1. 读取核心配置文件SqlMapConfig.xml
        InputStream is = Resources.getResourceAsStream("mybatis.xml");
        // 2. 创建SqlSessionFactoryBuilder构造者对象
        SqlSessionFactoryBuilder builder = new SqlSessionFactoryBuilder();
        // 3. 使用构造者builder，根据配置文件的信息is，构造一个SqlSessionFactory工厂对象
        SqlSessionFactory factory = builder.build(is);
        // 4. 使用工厂对象factory，生产一个SqlSession对象
        SqlSession session = factory.openSession();
        // 5. 使用SqlSession对象，获取映射器UserDao接口的代理对象
        UserMapper dao = session.getMapper(UserMapper.class);
        // 6. 调用UserDao代理对象的方法，查询所有用户
        List<User> users = dao.list();
        for (User user : users) {
            System.out.println(user);
        }
        //7. 释放资源
        session.close();
        is.close();
    }
}
```

入门案例到此结束，后面按照这个流程来对源码进行阅读。