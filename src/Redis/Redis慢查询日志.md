---
title: Redis慢查询日志
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新增 | 2023年04月09日22:36:04 |

本文参考：

- http://redisbook.com/preview/server/execute_command.html
- https://blog.csdn.net/wwh578867817/article/details/123173543

## Redis 执行一个命令的整个过程

> http://redisbook.com/preview/server/execute_command.html

一个命令请求从发送到获得回复的过程大致如下：

1. **发送命令请求**：Redis 客户端将命令请求转换成协议格式，通过套接字发送给 Redis 服务器；
2. **读取命令请求**：Redis 服务器读取来自 Redis 客户端的请求命令，并将其保存到客户端状态的输入缓冲区里面；
3. **解析命令参数**：Redis 服务器将命令解析为命令名和参数，并在内部执行相应的处理逻辑；
4. **执行命令逻辑**：Redis 服务器根据命令类型和具体的参数，在数据库中执行相应的操作；
5. **存储命令结果**：Redis 服务器将命令执行后得到的结果存储在输出缓冲区中；
6. **发送命令结果**：Redis 服务器从输出缓冲区中读取命令结果，并将其通过网络协议发送给客户端。

> Redis 6 后的多线程部分只是用来处理网络数据的读写和协议解析，执行命令还是单线程的。但如果严格来讲从 Redis 4 之后并不是单线程，除了主线程外，它也有后台线程在处理一些较为缓慢的操作，例如清理脏数据、无用连接的释放、大 key 的删除等等。

## 慢查询的两个配置参数

### 慢查询的两个配置

在 Redis 的配置文件中有下面两个配置项

```
slowlog-log-slower-than 10000
slowlog-max-len 128
```

- **slowlog-log-slower-than**：表示 Redis 命令执行超过多长时间（微秒）才会被记录在慢查询日志中；
  - 如果配置中输入一个负数，则会禁用慢查询日志；
  - 如果输入 0，则会记录每个命令的执行情况；
- **slowlog-max-len**：表示慢查询日志的长度。当日志条数已经满了时，新的命令被记录时，最旧的记录将从队列中移除；

### 在线修改慢查询的两个配置

这两个参数可以使用 **CONFIG SET** 命令在线修改

```
CONFIG SET parameter value
```



先看一下之前的配置的值

```
127.0.0.1:6379> config get *slow*
1) "slowlog-max-len"
2) "128"
3) "slowlog-log-slower-than"
4) "10000"
```

在线修改

```
127.0.0.1:6379> config set slowlog-log-slower-than 100
OK
127.0.0.1:6379> config set slowlog-max-len 1024
OK
127.0.0.1:6379>
127.0.0.1:6379> config get *slow*
1) "slowlog-max-len"
2) "1024"
3) "slowlog-log-slower-than"
4) "100"
```

可以使用 **CONFIG REWRITE** 将配置持久化本地配置文件中

```
127.0.0.1:6379> config rewrite
OK
```

可以去本地配置文件查看，确实是持久化到了本地配置文件中。

## 查看慢查询日志

慢查询日志是存放在 Redis 的内存列表中，我们需要通过命令来访问慢查询日志。

### SLOWLOG GET：获取慢查询日志

> https://redis.io/commands/slowlog-get/

```
SLOWLOG GET [count]
```

默认返回最近的 10 条慢查询日志。

可选的 count 参数限制返回条目的数量，因此该命令最多返回 count 个条目，特殊数字 -1 表示返回所有条目。

看个案例，为了看慢查询日志，我临时把 slowlog-log-slower-than 改成 1 了：

```
127.0.0.1:6379> slowlog get
1) 1) (integer) 4
   2) (integer) 1680796134
   3) (integer) 560
   4) 1) "set"
      2) "name"
      3) "hello"
   5) "127.0.0.1:51612"
   6) ""
2) 1) (integer) 3
   2) (integer) 1680796120
   3) (integer) 6027
   4) 1) "config"
      2) "rewrite"
   5) "127.0.0.1:51612"
   6) ""
```

慢查询日志中的每个条目由下面 6 个值组成：

1. 慢查询日志的标识 ID（唯一性）；
2. 记录日志的 Unix 时间戳；
3. 命令耗时（微秒）；
4. 执行命令和参数的数组；
5. 客户端 IP 和端口（仅限 4.0 或更高版本）；
6. 客户端名称（如果通过 CLIENT SETNAME 命令设置，仅限 4.0 或更高版本）；

> Starting with Redis version 4.0.0: Added client IP address, port and name to the reply.

### SLOWLOG LEN：获取慢查询日志列表的长度

> https://redis.io/commands/slowlog-len/

```
SLOWLOG LEN
```

看个例子：

```
127.0.0.1:6379> slowlog len
(integer) 6
```

一旦慢查询日志列表的长度达到 slowlog-max-len 限制，每当创建新的慢查询日志时，都会删除最旧慢查询日志。可以使用 SLOWLOG RESET 命令清除慢查询日志。

### SLOWLOG RESET：重置慢查询日志

> https://redis.io/commands/slowlog-reset/

```
SLOWLOG RESET
```

对慢查询日志列表做清空操作。一旦清空，永远无法找回。

```
127.0.0.1:6379> slowlog len
(integer) 9
127.0.0.1:6379> slowlog reset
OK
127.0.0.1:6379> slowlog len
(integer) 0
```

## 运维实践

需要注意的是，慢查询记录的是命令的执行时间，并不包括命令排队和网络传输的时间。所以客户端执行命令的时间会大于命令的实际执行时间。因为命令执行排队机制，慢查询会导致其它命令级联阻塞，因此当客户端出现请求超时时，需要检查该时间点是否有对应的慢查询，从而分析出是否是慢查询导致的命令级联阻塞。

- **slowlog-log-slower-than**：默认值超过 10 毫秒就是慢查询，这个值需要根据 Redis 的并发量来调整该值。因为 Redis 的命令都是单线程执行的，对于高流量的场景，如果命令执行时间在 1 毫秒以上，那么 Redis 最多可支撑的 OPS 不到 1000。所以对于高 OPS 的场景的 Redis 建议给这个配置项设置为 1 毫秒；
- **slowlog-max-len**：线上建议调大慢查询查询列表，记录慢查询时 Redis 会对长命令做截断操作，并不会占用大量内存。线上可设置为 1000 以上。因为慢查询列表是一个长度有限制的 FIFO 的队列，所以可能会有记录丢失的情况，我们可以定时调用 SLOW GET 命令将慢查询日志持久化到其他存储中；

| 参数                    | 说明                                                         | 设置建议                           |
| ----------------------- | ------------------------------------------------------------ | ---------------------------------- |
| slowlog-log-slower-than | 设置慢查询阈值，执行时间超过阈值后会被记录到慢日志。<br />单位为微秒（μs）。负数会禁用慢日志，而零值会强制记录每个命令。 | 不要设置过大，通常设置 1ms。       |
| slowlog-max-len         | 设置慢日志的长度。当记录新命令并且慢速日志已达到其最大长度时，最旧的命令将从记录的命令队列中删除以腾出空间。 | 不要设置过小，通常设置 1000 左右。 |
