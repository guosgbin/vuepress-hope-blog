---
title: Redis键空间通知
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2023年04月22日17:29:04 |

> 本文档翻译自：https://redis.io/docs/manual/keyspace-notifications/

## keyspace notification 简介

键空间通知使得客户端可以通过订阅频道或模式， 来接收那些以某种方式改动了 Redis 数据集的事件。

举个例子，以下是一些键空间通知发送的事件的例子：

- 所有修改键的命令；
- 所有接收到 `[LPUSH key value [value …])`命令的键；
- `0` 号数据库中所有已过期的键；

注意：事件通过 Redis 的订阅与发布功能（Pub/Sub）来进行分发， 因此所有支持订阅与发布功能的客户端都可以在无须做任何修改的情况下， 直接使用键空间通知功能。Redis Pub/Sub 是 fire and forget，也就是说，如果你的 Pub/Sub 客户端断开连接，然后重新连接，那么在客户端断开连接期间传递的所有事件都会丢失。

## 事件通知类型

Redis 中的键空间通知机制，**对于每个修改数据库的操作，通过发送两种不同类型的事件来通知应用程序**。这样，应用程序可以及时了解 Redis 数据空间的变化情况，从而做出相应的处理。

例如，针对数据库 0 中名为 mykey 的键的 DEL 操作将触发两条消息的传递，完全等同于以下两个 PUBLISH 命令：

```
PUBLISH __keyspace@0__:mykey del
PUBLISH __keyevent@0__:del mykey
```

- 第一个频道 `__keyspace@0__:mykey` 监听针对数据库 0 中的键 mykey 的所有事件。

- 另一个频道 `__keyevent@0__:del` 只监听数据库 0 中的键 mykey 的 DEL 操作事件。

以 `keyspace` 为前缀的频道被称为键空间通知（key-space notification）， 而以 `keyevent` 为前缀的频道则被称为键事件通知（key-event notification）。

在前面的示例中，为键 mykey 生成了一个 del 事件，会触发两条消息：

- 键空间（Key-space）频道的订阅者会接收到该键被操作的操作名字，案例中就是 `del` 了；
- 键事件（Key-event）频道的订阅者会接收到被操作的键的名字，案例中就是`mykey`了；

当然我们可以只启用一种通知机制，只关注我们感兴趣的事件子集。

## 配置

默认情况下，键空间事件通知被禁用，因为该功能会占用一些 CPU 资源。使用 redis.conf 的 notify-keyspace-events 或通过 CONFIG SET 启用通知。

- 将参数设置为空字符串会禁用通知；
- 启用该功能，需要使用了由多个字符组成的非空字符串；

根据下表来设置，其中每个字符都有特殊含义：

> 注意：每个版本的 Redis 中支持的不一样，需要关注各个版本的配置文件支持那=哪些配置

```
K     Keyspace events, published with __keyspace@<db>__ prefix.
E     Keyevent events, published with __keyevent@<db>__ prefix.
g     Generic commands (non-type specific) like DEL, EXPIRE, RENAME, ...
$     String commands
l     List commands
s     Set commands
h     Hash commands
z     Sorted set commands
t     Stream commands
d     Module key type events
x     Expired events (events generated every time a key expires)
e     Evicted events (events generated when a key is evicted for maxmemory)
m     Key miss events (events generated when a key that doesn't exist is accessed)
n     New key events (Note: not included in the 'A' class)
A     Alias for "g$lshztxed", so that the "AKE" string means all the events except "m" and "n".
```

**字符串中至少应包含 K 或 E，否则无论字符串的其余部分如何，都不会传递任何事件。**

例如，只为列表启用键空间（Key-space）事件，配置参数必须设置为 `Kl`，等等。

您可以使用字符串 `KEA` 来启用大多数类型的事件。

## 命令产生的通知

根据以下列表，不同的命令会生成不同类型的事件。

有很多通知的时间，具体可看官网的解释 https://redis.io/docs/manual/keyspace-notifications/#events-generated-by-different-commands。

这里说一些命令产生的通知：

- DEL 命令删除一个键时会产生一个 `del` 事件的通知；
- RENAME 生成两个事件，源键的 `rename_from `事件和目标键的 `rename_to`事件；
- SET 及其所有变体（SETEX、SETNX、GETSET）生成 `set`事件。 SETEX 也会产生过期事件；
- 每当一个键因为过期而被删除时，产生一个 `expired` 通知；
- 每当一个键因为 `maxmemory` 政策而被删除以回收内存时，产生一个 `evicted` 通知；、
- 每次将新键添加到数据集中时，都会生成一个 `new`事件；

> 注意：各个版本的 Redis 支持的事件的情况不一样。

需要注意的是：**所有命令仅在目标键真正被修改时才会生成事件**。例如，从 set 中删除一个不存在的元素的 SREM 实际上不会更改键的值，因此不会生成任何事件。

测试一下：

客户端 A 订阅 `__keyspace@0__:mykey` 模式

```
127.0.0.1:6379> auth master123
OK
127.0.0.1:6379> config set notify-keyspace-events KEA
OK
127.0.0.1:6379> psubscribe '__keyspace@0__:mykey'
Reading messages... (press Ctrl-C to quit)
1) "psubscribe"
2) "__keyspace@0__:mykey"
3) (integer) 1
1) "pmessage"
2) "__keyspace@0__:mykey"
3) "__keyspace@0__:mykey"
4) "set"
1) "pmessage"
2) "__keyspace@0__:mykey"
3) "__keyspace@0__:mykey"
4) "del"
```

客户端 B 操作键 mykey

```
127.0.0.1:6379> set mykey aaa
OK
127.0.0.1:6379> get mykey
"aaa"
127.0.0.1:6379> del mykey
(integer) 1
```

## 键过期的事件

在 Redis 中键过期删除有两种触发方式：

- 惰性删除：当某个键被访问时，会检查键是否过期，假如过期了就删除键；
- 定时删除：Redis 的定期任务会渐进地查找并删除那些过期的键，从而处理那些已经过期、但是不会被访问到的键；

当过期键被以上两个触发方式发现过期时， 将键从 Redis 中删除时， Redis 会产生一个 `expired` 通知。

因为惰性删除和定时删除的存在，所以过期键的 `expired` 通知可能并不是实时的，Redis 产生 `expired` 通知的时间为过期键被删除的时候， 而不是键的生存时间变为 `0` 的时候。

> 拿 Redis 的定时任务作为延迟任务执行并不靠谱，不知道网络上用这个方式做延迟任务的是怎么想的:sweat_smile: