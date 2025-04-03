---
title: Redis发布订阅
---

| 版本 | 内容 | 时间                |
| ---- | ---- | ------------------- |
| V1   | 新增 | 2023-04-19 01:01:12 |

本文参考：

- https://redis.io/docs/manual/pubsub/

## 发布订阅概述

Redis 提供了基于“发布/订阅”模式的消息机制，让客户端（消息发布者）通过广播的方式，将消息同步发送给可能存在的多个客户端（订阅者），并且消息发布的客户端不需要知道接收消息的客户端的具体信息。

- **订阅者（subscriber）**：客户端通过订阅特定的频道（channel）来接收发送给该频道的消息；
- **发送者（publisher）**：客户端通过向频道（channel）发送消息，传递给对应的订阅者；

**一个频道（channel）可以由任意多个订阅者（subscriber），一个订阅者（subscriber）也可以同时订阅任意多个频道（channel）。**

除了订阅指定的 channel 外，还可以订阅模式（pattern）来接收消息：每当发布者向某个 channel 发送消息的时候，不仅 channel 的订阅者会收到消息，与 channel 匹配的所有模式的订阅者也会收到消息。

例如现在有一个频道名为 channel.test，订阅者 A 订阅了这个频道，同时订阅者 B 订阅了 channel* 这个频道。假如现在给 channel.test 频道发送消息，订阅者 A 和 B 都会收到消息。

## 发布订阅相关的命令

| 命令                 | 含义                                               | 使用方式                                             |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| PUBLISH              | 向频道发送消息                                     | PUBLISH channel message                              |
| SUBSCRIBE            | 订阅指定频道                                       | SUBSCRIBE channel [channel ...]                      |
| UNSUBSCRIBE          | 取消订阅指定频道<br />无参表示取消订阅所有频道     | UNSUBSCRIBE [channel [channel ...]]                  |
| PSUBSCRIBE           | 按照模式订阅                                       | PSUBSCRIBE pattern [pattern ...]                     |
| PUNSUBSCRIBE         | 取消按照模式订阅                                   | PUNSUBSCRIBE [pattern [pattern ...]]                 |
| PUBSUB CHANNELS      | 查看当前订阅的所有频道                             | PUBSUB CHANNELS [pattern]                            |
| PUBSUB NUMSUB        | 查看给定频道的订阅者数量                           | PUBSUB NUMSUB [channel [channel ...]]                |
| PUBSUB NUMPAT        | 查看按照模式订阅的总数量                           | PUBSUB NUMPAT                                        |
| PUBSUB SHARDCHANNELS | 查看当前的分片频道，<br />7.0.0 版本新增           | PUBSUB SHARDCHANNELS [pattern]                       |
| PUBSUB SHARDNUMSUB   | 查看指定分片频道的订阅者数量，<br />7.0.0 版本新增 | PUBSUB SHARDNUMSUB [shardchannel [shardchannel ...]] |
| SPUBLISH             | 给分片频道发送消息<br />7.0.0 版本新增             | SPUBLISH shardchannel message                        |
| SSUBSCRIBE           | 订阅分片频道<br />7.0.0 版本新增                   | SSUBSCRIBE shardchannel [shardchannel ...]           |
| SUNSUBSCRIBE         | 取消订阅分片频道<br />7.0.0 版本新增               | SUNSUBSCRIBE [shardchannel [shardchannel ...]]       |

### 简单的发布订阅

开启两个客户端订阅，客户端 A 订阅 test1 频道，客户端 B 订阅 test1 和 test2 频道

#### SUBSCRIBE 订阅消息

**客户端订阅一个或多个频道**

```
SUBSCRIBE channel [channel ...]
```

返回值：每次订阅成功一个频道后，都会想执行命令的客户端返回一条订阅信息

1. 第一个元素：subscribe，表示是 SUBSCRIBE 命令的订阅消息；
2. 第二个元素：表示被订阅的频道的名字；
3. 第三个元素：表示当前客户端订阅了多少个频道；

需要注意的是：一旦客户端进入订阅状态，除开  `SUBSCRIBE`, [`SSUBSCRIBE`](https://redis.io/commands/ssubscribe), [`PSUBSCRIBE`](https://redis.io/commands/psubscribe), [`UNSUBSCRIBE`](https://redis.io/commands/unsubscribe), [`SUNSUBSCRIBE`](https://redis.io/commands/sunsubscribe), [`PUNSUBSCRIBE`](https://redis.io/commands/punsubscribe), [`PING`](https://redis.io/commands/ping), [`RESET`](https://redis.io/commands/reset) 和 [`QUIT`](https://redis.io/commands/quit) 命令，其它命令都不接受。

> 但是，如果使用 RESP3（请参阅 HELLO 命令），则客户端可以在订阅状态下发出任何命令。
>
> https://redis.io/commands/hello/
>
> `>= 6.2.0`: [`RESET`](https://redis.io/commands/reset) can be called to exit subscribed state.



客户端 A 订阅 test1 频道

```
127.0.0.1:6379> SUBSCRIBE test1
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "test1"
3) (integer) 1
```

客户端 B 订阅 test1 和 test2 频道

```
127.0.0.1:6379> SUBSCRIBE test1 test2
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "test1"
3) (integer) 1
1) "subscribe"
2) "test2"
3) (integer) 2
```

#### PUBLISH 发布消息

客户端发布消息到频道

```
SUBSCRIBE channel [channel ...]
```

返回值：**命令的返回值表示有多少个订阅者接收到了这条消息。**

TODO-KWOK 集群模式的限制



开启一个新的客户端给 test1 通道发消息：

```
127.0.0.1:6379> PUBLISH test1 hello-test1
(integer) 2
```

客户端 A 的情况，接收到了消息

```
127.0.0.1:6379> SUBSCRIBE test1 test2
Reading messages... (press Ctrl-C to quit)
...
...
1) "message"
2) "test1"
3) "hello-test1"
```

客户端 B 的情况，接收到了消息

```
127.0.0.1:6379> SUBSCRIBE test1
Reading messages... (press Ctrl-C to quit)
...
...
1) "message"
2) "test1"
3) "hello-test1"
```

**接收频道消息的信息**

1. 第一个元素：message，表明该消息是一个频道消息；
2. 第二个元素：表示消息来自于那个频道；
3. 第三个元素：表示真正的消息内容；



发布者给 test2 发消息，只会有客户端 B 接收到消息，可自行测试。

#### UNSUBSCRIBE 取消订阅频道

**取消订阅给定频道，如果没有给定频道名称，则取消订阅以前订阅的所有频道。**

```
UNSUBSCRIBE [channel [channel ...]]
```

返回值：

1. 第一个元素：unsubscribe，表面该消息是一条取消订阅的消息；
2. 第二个元素：表示取消订阅频道的名字；
3. 第三个元素：表示客户端在执行取消订阅操作后，目前仍在订阅的频道数量；



新开一个客户端，取消订阅 test1 频道（为什么新开客户端，后面会说）

```
127.0.0.1:6379> UNSUBSCRIBE test1
1) "unsubscribe"
2) "test1"
3) (integer) 0
```

需要注意的是，虽然 Redis 提供了 UNSUBSCRIBE 命令来取消订阅频道，但是 **Redis 各个客户端对 Pub/Sub 功能的支持方式并不相同，所以并非所有客户端都能使用 UNSUBSCRIBE 来执行取消订阅操作**。例如 Redis 自带的 redis-cli 客户端在执行 SUBSCRIBE 命令之后就会进入阻塞状态，无法再执行其他命令，用户只能 Ctrl-C 退出 redis-cli，所以 redis-cli 客户端并不支持使用  UNSUBSCRIBE 命令。

### 按照模式订阅

#### PSUBSCRIBE 订阅消息

```
PSUBSCRIBE pattern [pattern ...]
```

按照模式订阅，支持 glob-style 匹配

- `h?llo`，会订阅 `hello`, `hallo` 和 `hxllo` 频道；
- `h*llo` ，会订阅 `hllo` 和 `heeeello` 频道；
- `h[ae]llo` ，会订阅 `hello` 和  `hallo`频道 ，但是不会 `hillo` 频道；

需要注意的是：一旦客户端进入订阅状态，除开  `SUBSCRIBE`, [`SSUBSCRIBE`](https://redis.io/commands/ssubscribe), [`PSUBSCRIBE`](https://redis.io/commands/psubscribe), [`UNSUBSCRIBE`](https://redis.io/commands/unsubscribe), [`SUNSUBSCRIBE`](https://redis.io/commands/sunsubscribe), [`PUNSUBSCRIBE`](https://redis.io/commands/punsubscribe), [`PING`](https://redis.io/commands/ping), [`RESET`](https://redis.io/commands/reset) 和 [`QUIT`](https://redis.io/commands/quit) 命令，其它命令都不接受。



新开一个客户端订阅模式 `test*`

```
127.0.0.1:6379> PSUBSCRIBE test*
Reading messages... (press Ctrl-C to quit)
1) "psubscribe"
2) "test*"
3) (integer) 1
```

返回值：

- 第一个元素：psubscribe，表明消息是是由 PSUBSCRIBE 发起的一个订阅消息；
- 第二个元素：被订阅的模式；
- 第三个元素：客户端目前订阅模式的数量；

此时另一个客户端发送给 test1 频道发送一个消息，当前客户端会接收到消息

```
127.0.0.1:6379> PSUBSCRIBE test*
Reading messages... (press Ctrl-C to quit)
...
...
1) "pmessage"
2) "test*"
3) "test2"
4) "hello-test-pattern"
```

返回值：

- 第一个元素：pmessage，表示这是一条模式消息而不是订阅消息或频道消息；
- 第二个元素：被匹配的模式；
- 第三个元素：与模式相匹配的频道；
- 第四个元素：消息的内容；

> - `>= 6.2.0`: [`RESET`](https://redis.io/commands/reset) can be called to exit subscribed state.

#### UNSUBSCRIBE 取消订阅消息

取消订阅给定模式，无参表示取消订阅所有模式。

```
PUNSUBSCRIBE [pattern [pattern ...]]
```

和 UNSUBSCRIBE 命令一样，**Redis 各个客户端对 Pub/Sub 功能的支持方式并不相同，所以并非所有客户端都能使用 PUNSUBSCRIBE 来执行取消订阅模式操作**。例如 Redis 自带的 redis-cli 客户端在执行 PSUBSCRIBE 命令之后就会进入阻塞状态，无法再执行其他命令，用户只能 Ctrl-C 退出 redis-cli，所以 redis-cli 客户端并不支持使用  PUNSUBSCRIBE 命令。



UNSUBSCRIBE 命令的返回值

```
127.0.0.1:6379> PUNSUBSCRIBE test*
1) "punsubscribe"
2) "test*"
3) (integer) 0
```

返回值：

- 第一个元素：punsubscribe，表明该消息是 PUNSUBSCRIBE 命令的一个取消订阅模式的消息；
- 第二个元素：被取消订阅的模式；
- 第三个元素：客户端在执行当前取消订阅的操作后，仍在订阅的模式数量；

### PUBSUB 查看发布订阅的相关信息

#### PUBSUB CHANNELS 查看订阅的频道

列出目前被订阅的所有频道，如果给定了可选的 pattern 参数，那么只会列出与给定 pattern 匹配的频道。

```
PUBSUB CHANNELS [pattern]
```



```
127.0.0.1:6379> pubsub channels
1) "test2"
2) "test1"
```



TODO-KWOK 集群问题

#### PUBSUB NUMSUB 查看频道的订阅者数量

查看任意多个频道的订阅者数量（不包括订阅模式的客户端）

```
PUBSUB NUMSUB [channel [channel ...]]
```



```
127.0.0.1:6379> pubsub numsub test1 test2
1) "test1"
2) (integer) 2
3) "test2"
4) (integer) 1
```

TODO-KWOK 集群问题

#### PUBSUB NUMPAT 查看订阅模式的总数量

查看当前被订阅模式的总数量（使用 PSUBSCRIBE 命令执行）。请注意，这不是订阅模式的客户端数量，而是所有客户端订阅的唯一模式的总数。

```
PUBSUB NUMPAT
```



```
127.0.0.1:6379> pubsub numpat
(integer) 1
```

### 同时匹配模式和频道订阅的问题

如果客户端订阅了与已发布消息匹配的多个模式，或者如果它订阅了与消息匹配的模式和通道，则客户端可能会多次收到同一条消息。

- 如果订阅者订阅了多个与发布消息的频道匹配的模式，客户端可能会多次收到同一条消息；
- 如果订阅者订阅了一个频道，又订阅了一个匹配这个频道的模式，客户端可能会多次收到同一条消息；

例如：

```
SUBSCRIBE foo
PSUBSCRIBE f*
```

在上面的示例中，如果将消息发送到频道 foo，则客户端将收到两条消息：一条是 message 类型，一条是 pmessage 类型。
