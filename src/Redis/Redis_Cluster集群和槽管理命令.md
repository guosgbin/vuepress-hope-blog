---
title: Redis Cluster集群和槽管理命令
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2023年05月05日23:25:49 |

> 大部分内容来自 redis 使用手册，测试版本 Redis 6.2.6

## 集群和槽管理命令概述

Redis 提供了一些以 CLUSTER 开头的管理命令，它们又分为：

- 集群和集群节点的管理命令
- 槽管理命令；

实际上 redis-cli --cluster 就是由 CLUSTER 命令实现的。

## 从节点的读命令的执行权限

集群的从节点默认情况下只会对主节点进行复制，但是不会处理客户端发送的任何命令的请求：每当从节点接收到命令请求的时候，它只会向客户端发送转向消息，引导客户端向某个主节点重新发送命令请求。

### READONLY：打开读命令执行权限

执行 READONLY 命令可以让客户端临时获取在从服务器上执行读命令的权限。该命令只对执行了该命令的客户端有效，并不会影响正在访问相同从节点的其他客户端。

### READWRITE：关闭读命令执行权限

执行 READWRITE 命令可以关闭某个客户端对从节点的读命令的执行权限。

## 集群管理命令

### CLUSTER MEET：添加节点到集群

```
CLUSTER MEET ip port [cluster-bus-port]
```

> https://redis.io/commands/cluster-meet/

#### 单个集群添加一个节点

假设现在启动了三个节点 30001、30002、30003

随便看一个节点的信息，可以看到这些节点之间并没有建立集群。

```
$ ./redis-cli --cluster info 127.0.0.1:30001
127.0.0.1:30001 (c85f1e08...) -> 0 keys | 0 slots | 0 slaves.
[OK] 0 keys in 1 masters.
0.00 keys per slot on average.
```

使用 CLUSTER MEET 将 30002、30003 添加到集群

```
127.0.0.1:30001> CLUSTER MEET 127.0.0.1 30002
OK
127.0.0.1:30001> CLUSTER MEET 127.0.0.1 30003
OK
```

再次查看集群信息，可以看到 3 个节点已经建立连接了，但是槽还未分配。

```
$ ./redis-cli --cluster info 127.0.0.1:30001
127.0.0.1:30001 (c85f1e08...) -> 0 keys | 0 slots | 0 slaves.
127.0.0.1:30002 (3a5a7687...) -> 0 keys | 0 slots | 0 slaves.
127.0.0.1:30003 (4d7842cf...) -> 0 keys | 0 slots | 0 slaves.
```

#### 单个集群添加多个节点

前面已经启动了三个节点 30001、30002、30003，并且建立了连接。

假如现在有另外三个节点 30004、30005、30006，它们之间也建立了连接，如下：

```
$ ./redis-cli --cluster info 127.0.0.1:30004
127.0.0.1:30004 (5386f4d1...) -> 0 keys | 0 slots | 0 slaves.
127.0.0.1:30006 (c1b06fee...) -> 0 keys | 0 slots | 0 slaves.
127.0.0.1:30005 (c37de5d4...) -> 0 keys | 0 slots | 0 slaves.
```

假如要将后面三个节点的集群加入到前面的集群，只需要将后面的集群中的一个节点加入到前面的集群即可

```
127.0.0.1:30006> CLUSTER MEET 127.0.0.1 30001
OK
```

看下集群信息，可以看到两个集群已经变成一个了。

```
 uxindylan@DylanMac  bin  ./redis-cli --cluster info 127.0.0.1:30001
127.0.0.1:30001 (c85f1e08...) -> 0 keys | 0 slots | 0 slaves.
127.0.0.1:30006 (c1b06fee...) -> 0 keys | 0 slots | 0 slaves.
127.0.0.1:30002 (3a5a7687...) -> 0 keys | 0 slots | 0 slaves.
127.0.0.1:30003 (4d7842cf...) -> 0 keys | 0 slots | 0 slaves.
127.0.0.1:30004 (5386f4d1...) -> 0 keys | 0 slots | 0 slaves.
127.0.0.1:30005 (c37de5d4...) -> 0 keys | 0 slots | 0 slaves.
[OK] 0 keys in 6 masters.
0.00 keys per slot on average.
```

### CLUSTER NODES：查看集群节点信息

> https://redis.io/commands/cluster-nodes/



```
127.0.0.1:30006> CLUSTER NODES
5386f4d1b90669c873c13c5fc1b0ad59048dd47b 127.0.0.1:30004@40004 slave c85f1e08b06bae3ec104ae40c8a78fece1b20acf 0 1683210449285 1 connected
c85f1e08b06bae3ec104ae40c8a78fece1b20acf 127.0.0.1:30001@40001 master - 0 1683210449587 1 connected 0-5460
4d7842cf1838e2efa9a348415aa7b992e9ea3462 127.0.0.1:30003@40003 master - 0 1683210448780 3 connected 10923-16383
c1b06feefec9a26716a0aaca0fd99350c5737d03 127.0.0.1:30006@40006 myself,slave 4d7842cf1838e2efa9a348415aa7b992e9ea3462 0 1683210449000 3 connected
c37de5d41257ed4631690fcb68b0f6fe25516571 127.0.0.1:30005@40005 slave 3a5a7687277162bf766c6fe8e23269ef909ed3bd 0 1683210448578 4 connected
3a5a7687277162bf766c6fe8e23269ef909ed3bd 127.0.0.1:30002@40002 master - 0 1683210448578 4 connected 5461-10922
```



```
<id> <ip:port@cport[,hostname[,auxiliary_field=value]*]> <flags> <master> <ping-sent> <pong-recv> <config-epoch> <link-state> <slot> <slot> ... <slot>
```

输出行各项信息的意义：

- 节点 id：节点 id 在集群中是唯一的；
- 地址和端口：记录 IP 地址和端口。@ 符号左边的是节点的客户端端口，@ 符号右边的是集群节点之间的通信端口；
- 角色和状态：记录节点当前的角色以及状态，下面是一些值的含义
  - myself：表示客户端当前正在连接的节点；
  - master：表示主节点；
  - slave：表示从节点；
  - fail?：表示当前节点正处于疑似下线状态；
  - fail：表示节点已经下线；
  - nofailover：该节点开启了 cluster-replica-no-failover 选项，带有这个标志的从节点即使在主节点下线的情况下，也不会主动执行故障转移操作；
  - handshake：集群正在与这个节点握手，尚未确定它的状态；
  - noaddr：目前还不清楚这个节点的具体地址；
  - moflags：目前还不清楚这个节点担任的角色以及它所处的状态；
- 主节点 ID：如果该节点是一个从节点，会显示它的主节点。如果节点是一个从节点，这里只会展示 - 符号；
- 发送 PING 消息的时间：节点最近一次向其他节点发送 PING 消息的时间戳，毫秒。如果该节点与其他节点的连接正常，并且它发送的 PING 消息也没有阻塞，那么这个值将会被设置为 0；
- 收到 PONG 消息的时间：节点最近一次接收到其他节点发送的 PONG 消息的时间戳，毫秒；
- 配置纪元；
- 连接状态：节点集群总线的连接状态。connected 表示连接正常，disconnected 表示连接断开；
- 负责的槽：显示节点目前负责处理的槽以及这些槽所处的状态，如下是一些值：
  - 连续的槽：当 CLUSTER NODES 命令遇到连续的槽号时，会以 start_slot-end_slot 格式打印；
  - 不连续的槽：当 CLUSTER NODES 命令遇到不连续的槽号时，单独打印出不连续的槽号；
  - 正在导入的槽：如果节点正在从另一个节点导入某个槽，那么 CLUSTER NODES 命令将以 [slot_number-<-importing_from_node_id] 的格式打印出被导入的槽以及该槽原来所在的节点；
  - 正在迁移的槽：如果节点正在将自己的某个槽迁移到另外一个节点，那么 CLUSTER NODES 命令将以 [slot_number->-migrating_to_node_id] 格式打印出被迁移的槽以及该槽正在迁移的目标节点；



下面是导入槽和迁移槽的一些值的案例

- `[93-<-292f8b365bb7edb5e285caf0b7e6ddc7265d2f4f]`
- `[1002-<-67ed2db8d677e59ec4a4cefb06858cf2a1a89fa1]`
- `[77->-e7d1eecce10fd6bb5eb35b9f99a514335d9ba9ca]`
- `[16311->-292f8b365bb7edb5e285caf0b7e6ddc7265d2f4f]`

### CLUSTER MYID：查看当前节点的 ID

> https://redis.io/commands/cluster-myid/

```
127.0.0.1:30006> CLUSTER MYID
"c1b06feefec9a26716a0aaca0fd99350c5737d03"
```

### CLUSTER INFO：查看集群信息

> https://redis.io/commands/cluster-info/

```
127.0.0.1:30006> CLUSTER INFO
cluster_state:ok
cluster_slots_assigned:16384
cluster_slots_ok:16384
cluster_slots_pfail:0
cluster_slots_fail:0
cluster_known_nodes:6
cluster_size:3
cluster_current_epoch:6
cluster_my_epoch:3
cluster_stats_messages_ping_sent:5794
cluster_stats_messages_pong_sent:6091
cluster_stats_messages_meet_sent:2
cluster_stats_messages_sent:11887
cluster_stats_messages_ping_received:6090
cluster_stats_messages_pong_received:5796
cluster_stats_messages_meet_received:1
cluster_stats_messages_received:11887
```

- cluster_state：状态是 ok 节点是否能够接收查询。fail 如果至少有一个散列槽未绑定（没有关联的节点），处于错误状态（服务于它的节点被标记为 FAIL 标志），或者如果该节点无法访问大多数主节点。
- cluster_slots_assigned：已经分配的槽的数量。这个数字应该是 16384 节点才能正常工作，这表示所有槽都已经被分配给集群中的节点了；
- cluster_slots_ok：处于在线状态的槽的数量。
- cluster_slots_pfail：处于疑似下线状态的槽的数量。当一个主节点处于疑似下线状态时，分配给它的所有槽都会处于疑似下线状态；
- cluster_slots_fail：处于下线状态的槽的数量。当一个主节点处于下线状态时，分配给它的所有槽都会处于下线状态；
- cluster_known_nodes：集群中目前包含的节点数量。包括集群中的主节点数量、从节点数量以及以及发送了 CLUSTER MEET 命令但尚未得到回应的新节点数量；
- cluster_size：集群中分配了槽的节点数量；
- cluster_current_epoch：集群目前的纪元；
- cluster_my_epoch：当前节点所处的配置纪元（config epoch），也就是集群赋予给这个及诶单的配置信息版本号；
- cluster_stats_messages_ping_sent：当前节点发送 ping 消息的数量；
- cluster_stats_messages_pong_sent：当前节点发送 pong 消息的数量；
- cluster_stats_messages_meet_sent：当前节点发送 meet 消息的数量；
- cluster_stats_messages_sent：当前节点通过集群总线发送的消息总数量；
- cluster_stats_messages_ping_received：当前节点接收 ping 消息的数量；
- cluster_stats_messages_pong_received：当前节点接收 pong 消息的数量；
- cluster_stats_messages_meet_received：当前节点接收 meet 消息的数量；
- cluster_stats_messages_received：当前节点通过集群总线接收到的消息总数量；

### CLUSTER FORGET：从集群中移除节点

> https://redis.io/commands/cluster-forget/

当用户不再需要集群中的某个节点时，可以通过执行以下命令将其移除

```
CLUSTER FORGET node-id
```

与 CLUSTER MEET 命令引发的节点添加消息不一样，CLUSTER FORGET 命令引发的节点移除消息并不会通过 Gossip 协议传播至集群中的其他节点：

当用户向一个节点发送 CLUSTER FORGET 命令，让它去移除集群中的另一个节点时，接收到命令的节点只是暂时屏蔽了用户指定的节点，但这个被屏蔽的节点对于集群中的其他节点仍然是可见的。为此，要让集群真正地移除一个节点，用户必须向集群中的所有节点都发送相同的 CLUSTER FORGET 命令，并且这一动作必须在 60s 之内完成，否则被暂时屏蔽的节点就会因为 Gossip 协议的作用而被重新添加到集群中。

解释一下为什么该命令不仅需要从节点表中删除给定节点，还需要防止其在一段时间内被重新插入。假设我们有四个节点 A、B、C和 D。为了最终只保留三个节点（A、B、C），我们可以按照以下步骤进行操作：

1. 将所有槽从 D 重分片到节点 A、B、C；
2. D 现在已经是空的了，但仍然列在 A、B和 C 的节点列表中；
3. 连接 A 节点客户端，并发送 CLUSTER FORGET D 命令；
4. B 向节点 A 发送一个心跳包，其中列出了节点 D；
5. A 不再知道节点 D（参见步骤3），因此它开始与 D 进行握手；
6. D 重新添加到 A 的节点列表中；

因此我们需要尽快向所有节点发送 CLUSTER FORGET 命令。由于这个问题，该命令实现了一个带有过期时间的禁止列表。

FORGET 命令的实际作用如下：

1. 从节点列表中删除指定的节点；
2. 被删除的节点 ID 被添加到禁止列表中，持续 60 秒；
3. 当处理来自其他节点心跳包中时，节点将跳过禁止列表中列出的所有节点 ID。 这样我们就有了 60 秒的时间窗口来通知集群中的所有节点，我们希望移除一个节点；

假如现在集群有 30001、30002、30003、30004、30005、30006 节点，如果要移除 30006 节点，则需要在其他每个节点都执行一次 `CLUSTER FORGET node-id` 命令，且必须再 1 分钟以内操作完。

假如嫌弃麻烦可以结合使用 `redis-cli --cluster call` 一次性执行 `CLUSTER FORGET node-id` 命令。

### CLUSTER REPLICATE：将节点变为从节点

> https://redis.io/commands/cluster-replicate/

接受一个主节点 ID 作为参数，并将执行该命令的节点变成给定主节点的从节点：

```
CLUSTER REPLICATE node-id
```

该命令将一个节点重新设置为指定主节点的从节点。一旦节点变成另一个主节点的副本，不需要通知其他节点进行更改：节点之间的心跳包会自动传播新的配置。

用户指定的主节点必须与当前节点在同一个集群中。

如果执行命令的节点本身就是一个从节点，那么它将会立即清空数据库，并开始复制指定的主节点的数据；

如果接收该命令的节点不是从节点，是主节点，则只有满足以下附加条件才能成功执行该命令并将节点转换为从节点：

- 节点未分配任何哈希槽；
- 节点为空，数据库中没有任何数据，也就是没有键值对；

如果命令执行成功，则新的从节点将立即尝试联系其主节点进行复制。

> 需要注意的是，集群中只能对主节点进行复制。在单机 Redis 的时候，用户可以让一个从服务器去复制另外一个从服务器，组成链式架构。但是 Redis 集群中只允许节点对主节点进行复制。

例如：现在有 30001、30002、30003、30004、30005、30006 节点组成的集群，其中 30001、30002、30003 是集群的主节点，30004、30005、30006 是它们各自的从节点。

```
$ ./redis-cli --cluster info 127.0.0.1:30006                                                                
127.0.0.1:30001 (c85f1e08...) -> 0 keys | 5461 slots | 1 slaves.
127.0.0.1:30003 (4d7842cf...) -> 0 keys | 5461 slots | 1 slaves.
127.0.0.1:30002 (3a5a7687...) -> 0 keys | 5462 slots | 1 slaves.
[OK] 0 keys in 3 masters.
0.00 keys per slot on average.
```

使用 CLUSTER REPLICATE 命令将 30006 转为 30001 的从节点。

```
127.0.0.1:30006> cluster replicate c85f1e08b06bae3ec104ae40c8a78fece1b20acf
OK
```

再看下集群的信息，可以看到 30001 现在有两个从节点了。

```
./redis-cli --cluster info 127.0.0.1:30006
127.0.0.1:30001 (c85f1e08...) -> 0 keys | 5461 slots | 2 slaves.
127.0.0.1:30003 (4d7842cf...) -> 0 keys | 5461 slots | 0 slaves.
127.0.0.1:30002 (3a5a7687...) -> 0 keys | 5462 slots | 1 slaves.
[OK] 0 keys in 3 masters.
0.00 keys per slot on average.
```

### CLUSTER REPLICAS：查看节点的所有从节点

> https://redis.io/commands/cluster-replicas/
>
> https://redis.io/commands/cluster-slaves/

接收一个主节点的集群节点 ID，返回所有的从节点的信息，返回数据的格式和 CLUSTER NODES 命令返回的一样。

```
CLUSTER REPLICAS node-id
```

例如：

```
127.0.0.1:30001> cluster replicas c85f1e08b06bae3ec104ae40c8a78fece1b20acf
1) "5386f4d1b90669c873c13c5fc1b0ad59048dd47b 127.0.0.1:30004@40004 slave c85f1e08b06bae3ec104ae40c8a78fece1b20acf 0 1683263939000 1 connected"
2) "c1b06feefec9a26716a0aaca0fd99350c5737d03 127.0.0.1:30006@40006 slave c85f1e08b06bae3ec104ae40c8a78fece1b20acf 0 1683263939532 1 connected"
```

> 旧版本的命令是  CLUSTER SLAVES node-id

### CLUSTER FAILOVER：强制故障转移

> https://redis.io/commands/cluster-failover/

用户可以通过向从节点发送以下命令（只能对从节点发送该命令），让它发起一次对自身主节点的故障转移操作：

```
CLUSTER FAILOVER [FORCE | TAKEOVER]
```

手动故障转移是一种特殊类型的故障转移，通常在没有实际故障的情况下执行。我们希望以安全的方式将当前主节点与其一个从节点进行交换（也就是我们向其发送命令的节点），而不会出现任何数据丢失。手动故障转移的流程如下：

1. 从节点告诉主节点停止处理客户端的查询；
2. 主节点向从节点回复当前的复制偏移量；
3. 从节点等待复制偏移量匹配，确保它在继续之前已经处理了主节点的所有数据；
4. 从节点启动故障转移，从大多数主节点获取新的配置历史，并广播新的配置；
5. 旧的主节点接收到配置更新：解除阻塞其客户端并开始回复重定向消息，以便他们与新的主节点继续通信；

#### FORCE 选项

如果使用 FORCE 选项，则从节点不会与可能无法访问的主节点执行任何握手，而是尽快启动故障转移，直接从第 4 步开始。这在我们希望在主节点不可达时启动手动故障转移时非常有用。

但是，即使使用 FORCE，我们仍然需要大多数主节点可用才能授权故障转移并为即将成为主节点的从节点生成新的配置历史。

#### TAKEOVER 选项

有时候，我们需要从节点在没有其他节点同意的情况下进行故障转移。一个实际的使用场景是，在所有主节点都挂掉或被分区的情况下，将位于不同数据中心的从节点大规模提升为主节点，以执行数据中心切换。

使用 TAKEOVER 选项会强制执行故障转移，而无需得到集群的授权。收到 CLUSTER FAILOVER TAKEOVER 命令的从节点会：

1. 自行生成一个新的 configEpoch，取当前最大的 epoch 并递增它，如果本地配置 epoch 已经是最大值，则不递增。
2. 将自己分配为主节点的所有哈希槽，并尽快向每个可达节点传播新的配置信息，最终传播到所有节点。

值得注意的是，TAKEOVER 违反了 Redis Cluster 的“最后一次故障转移胜利原则”，因为使用此选项生成的配置历史与正常生成的配置历史有所不同，有以下几点：

1. 我们不能保证它实际上就是更高的配置历史，因为 TAKEOVER 可以在少数派之间使用，并且不执行任何消息交换来生成新的配置历史。
2. 如果我们生成的配置历史与其他实例的配置历史冲突，那么最终就会使用配置历史冲突解决算法将其中一个实例的配置历史移出。

因此，TAKEOVER 选项需要谨慎使用。

#### 小结

在给定了 FORCE 选项时，从节点将在不尝试与主节点进行握手的情况下，直接实施故障转移。这种做法可以让用户在主节点已经下线的情况下立即开始故障转移。

需要注意的是，即使用户给定了 FORCE 选项，从节点对主节点的故障转移操作仍然要经过集群中大多数主节点的同意才能够真正执行。但如果用户给定了 TAKEOVER 选项，那么从节点将在不询问集群中其他节点意见的情况下，直接对主节点实施故障转移。

CLUSTER FAILOVER，除非指定 TAKEOVER 选项，否则不会同步执行故障转移。它只是安排了一次手动故障转移，跳过了故障检测阶段。OK 回复并不保证故障转移一定会成功。

只有当从节点被大多数主节点识别为从节点时，才能将其升级为主节点。如果从节点是新添加到集群中的节点（例如在升级后），那么可能还没有被所有主节点识别。为了检查主节点是否已经知道新的从节点，您可以向每个主节点发送 CLUSTER NODES 或 CLUSTER REPLICAS，并检查它是否出现为从节点，然后再向从节点发送 CLUSTER FAILOVER 命令。

要检查故障转移是否实际上已经发生，您可以使用 ROLE、INFO REPLICATION（在故障转移成功后显示“role:master”）或 CLUSTER NODES 来验证集群状态是否在发送命令后发生了变化。

要检查故障转移是否失败，请检查从节点的日志，查看是否记录了“Manual failover timed out”。如果在几秒钟后从节点放弃了故障转移，则会记录这个信息。

### CLUSTER RESET：重置节点

> https://redis.io/commands/cluster-reset/

```
CLUSTER RESET [HARD | SOFT]
```

该命令可以以不同程度的方式重置 Redis Cluster 节点，可以是 HARD 重置或 SOFT 重置。需要注意的是，如果主节点持有一个或多个键，则此命令对主节点无效。在这种情况下，要完全重置主节点，必须首先删除所有键，例如通过使用 FLUSHALL 命令，然后再使用 CLUSTER RESET 命令进行重置。

对节点的影响：

1. 集群中的所有其他节点都会被忘记；
2. 分配的哈希槽将被重置，因此哈希槽与节点的映射将完全清除；
3. 如果该节点是从节点，则它将转换为（空）主节点。其数据集将被清除，最终该节点将成为空数据的主节点；
4. 仅适用于 HARD 重置：生成新的节点 ID；
5. 仅适用于 HARD 重置：当前 epoch 和 configEpoch 变量设置为 0；
6. 新配置将在节点集群配置文件中持久化到磁盘上；

> 默认是 SOFT

## 槽管理命令

### CLUSTER SLOTS：查看槽和节点的映射关系

> https://redis.io/commands/cluster-slots/
>
> 
>
> As of Redis version 7.0.0, this command is regarded as deprecated.
>
> It can be replaced by [`CLUSTER SHARDS`](https://redis.io/commands/cluster-shards) when migrating or writing new code.

查看槽和集群中的映射关系

```
CLUSTER SLOTS
```

返回值是一个嵌套数组：

- 槽范围开始编号；
- 槽范围结束编号；
- 主节点的信息；
- 后续都是从节点的信息；

例如：

```
127.0.0.1:30001> CLUSTER SLOTS
1) 1) (integer) 0
   2) (integer) 5460
   3) 1) "127.0.0.1"
      2) (integer) 30001
      3) "c85f1e08b06bae3ec104ae40c8a78fece1b20acf"
   4) 1) "127.0.0.1"
      2) (integer) 30004
      3) "5386f4d1b90669c873c13c5fc1b0ad59048dd47b"
   5) 1) "127.0.0.1"
      2) (integer) 30006
      3) "c1b06feefec9a26716a0aaca0fd99350c5737d03"
2) 1) (integer) 5461
   2) (integer) 10922
   3) 1) "127.0.0.1"
      2) (integer) 30002
      3) "3a5a7687277162bf766c6fe8e23269ef909ed3bd"
   4) 1) "127.0.0.1"
      2) (integer) 30005
      3) "c37de5d41257ed4631690fcb68b0f6fe25516571"
3) 1) (integer) 10923
   2) (integer) 16383
   3) 1) "127.0.0.1"
      2) (integer) 30003
      3) "4d7842cf1838e2efa9a348415aa7b992e9ea3462"
```

### CLUSTER ADDSLOTS：分配槽给节点

> https://redis.io/commands/cluster-addslots/

将给定的一个或任意多个槽指派给当前节点

```
CLUSTER ADDSLOTS slot [slot ...]
```

需要注意的是：

- 该命令只在接收命令的节点认为所有指定的槽位当前未被分配的情况下才有效；
- 如果一个槽位已经被其他节点（包括自己）所拥有，那么该节点将拒绝接管该槽位；
- 如果同一个槽位被指定多次，则该命令将失败；
- 执行该命令可能会产生一些副作用，例如，如果在参数中指定的槽位之一被设置为正在导入状态，那么当节点将未绑定的槽位分配给自身后，该状态将被清除；

举例：

现在的槽的情况：

```
27.0.0.1:30001> CLUSTER SLOTS
1) 1) (integer) 0
   2) (integer) 0
   3) 1) "127.0.0.1"
      2) (integer) 30001
      3) "c85f1e08b06bae3ec104ae40c8a78fece1b20acf"
   4) 1) "127.0.0.1"
      2) (integer) 30004
      3) "5386f4d1b90669c873c13c5fc1b0ad59048dd47b"
   5) 1) "127.0.0.1"
      2) (integer) 30006
      3) "c1b06feefec9a26716a0aaca0fd99350c5737d03"
2) 1) (integer) 6
   2) (integer) 5460
   3) 1) "127.0.0.1"
      2) (integer) 30001
      3) "c85f1e08b06bae3ec104ae40c8a78fece1b20acf"
   4) 1) "127.0.0.1"
      2) (integer) 30004
      3) "5386f4d1b90669c873c13c5fc1b0ad59048dd47b"
   5) 1) "127.0.0.1"
      2) (integer) 30006
      3) "c1b06feefec9a26716a0aaca0fd99350c5737d03"
3) 1) (integer) 5461
   2) (integer) 10922
   3) 1) "127.0.0.1"
      2) (integer) 30002
      3) "3a5a7687277162bf766c6fe8e23269ef909ed3bd"
   4) 1) "127.0.0.1"
      2) (integer) 30005
      3) "c37de5d41257ed4631690fcb68b0f6fe25516571"
4) 1) (integer) 10923
   2) (integer) 16383
   3) 1) "127.0.0.1"
      2) (integer) 30003
      3) "4d7842cf1838e2efa9a348415aa7b992e9ea3462"
```

将没有的槽 1,2,3,4,5 分配给 30001 主节点

```
127.0.0.1:30001> CLUSTER ADDSLOTS 1 2 3 4 5
OK
```

再次看下集群的槽分配情况

```
127.0.0.1:30001> CLUSTER SLOTS
1) 1) (integer) 0
   2) (integer) 5460
   3) 1) "127.0.0.1"
      2) (integer) 30001
      3) "c85f1e08b06bae3ec104ae40c8a78fece1b20acf"
   4) 1) "127.0.0.1"
      2) (integer) 30004
      3) "5386f4d1b90669c873c13c5fc1b0ad59048dd47b"
   5) 1) "127.0.0.1"
      2) (integer) 30006
      3) "c1b06feefec9a26716a0aaca0fd99350c5737d03"
2) 1) (integer) 5461
   2) (integer) 10922
   3) 1) "127.0.0.1"
      2) (integer) 30002
      3) "3a5a7687277162bf766c6fe8e23269ef909ed3bd"
   4) 1) "127.0.0.1"
      2) (integer) 30005
      3) "c37de5d41257ed4631690fcb68b0f6fe25516571"
3) 1) (integer) 10923
   2) (integer) 16383
   3) 1) "127.0.0.1"
      2) (integer) 30003
      3) "4d7842cf1838e2efa9a348415aa7b992e9ea3462"
```

假如再给 30001 添加槽 1，就会报错：

```
127.0.0.1:30001> CLUSTER ADDSLOTS 1
(error) ERR Slot 1 is already busy
```

需要注意的是，一旦一个节点将一组槽位分配给自己后，它会在心跳包头中开始传播这些信息。然而，其他节点只有在它们尚未将该槽位与其他节点绑定，或者当前广播新哈希槽位的节点的配置时期大于表中当前列出的节点时，才会接受这些信息。

这意味着这个命令应该仅由 Redis Cluster 管理应用程序使用（例如 redis-cli），如果在不正确的上下文中使用该命令，则可能会使集群处于错误状态，甚至导致数据丢失。因此，在使用该命令时需要非常小心谨慎。

### CLUSTER DELSLOTS：撤销对节点分配的槽

> https://redis.io/commands/cluster-delslots/

撤销对节点的槽指派：

```
CLUSTER DELSLOTS slot [slot ...]
```

在一个接收到 CLUSTER DELSLOTS 命令并因此删除指定哈希槽位关联的节点上下文中，我们称这些哈希槽位为未绑定状态。需要注意的是，当一个节点没有配置来处理某些哈希槽位（可以通过 CLUSTER ADDSLOTS 命令完成），且未收到任何有关谁拥有这些哈希槽位的信息时（这可以从心跳或更新消息中得知），未绑定哈希槽位的存在就会自然而然地产生。

如果一个有未绑定哈希槽位的节点收到来自另一个声称拥有其中某些哈希槽位的节点的心跳包，则它们之间会立即建立关联。此外，如果收到的心跳或更新消息的配置时期大于该节点本身的配置时期，则会重新建立关联。

需要注意的是：

- 该命令仅在所有指定的槽位都已与某个节点相关联的情况下才有效。
- 如果同一个槽位被指定多次，则该命令将失败。
- 由于未能覆盖所有哈希槽，执行该命令可能会导致节点进入下线状态。

举例：

假如现在的集群的槽分配如下：

```
127.0.0.1:30001> CLUSTER SLOTS
1) 1) (integer) 0
   2) (integer) 5460
   3) 1) "127.0.0.1"
      2) (integer) 30001
      3) "c85f1e08b06bae3ec104ae40c8a78fece1b20acf"
   4) 1) "127.0.0.1"
      2) (integer) 30004
      3) "5386f4d1b90669c873c13c5fc1b0ad59048dd47b"
   5) 1) "127.0.0.1"
      2) (integer) 30006
      3) "c1b06feefec9a26716a0aaca0fd99350c5737d03"
2) 1) (integer) 5461
   2) (integer) 10922
   3) 1) "127.0.0.1"
      2) (integer) 30002
      3) "3a5a7687277162bf766c6fe8e23269ef909ed3bd"
   4) 1) "127.0.0.1"
      2) (integer) 30005
      3) "c37de5d41257ed4631690fcb68b0f6fe25516571"
3) 1) (integer) 10923
   2) (integer) 16383
   3) 1) "127.0.0.1"
      2) (integer) 30003
      3) "4d7842cf1838e2efa9a348415aa7b992e9ea3462"
```

将主节点 30001 的 1,2,3,4,5 槽移除分配

```
127.0.0.1:30001> CLUSTER DELSLOTS 1 2 3 4 5
OK
```

再次查看集群的槽分配状态，可以看到 30001 还有个不连续的槽 0。

```
127.0.0.1:30001> CLUSTER SLOTS
1) 1) (integer) 0
   2) (integer) 0
   3) 1) "127.0.0.1"
      2) (integer) 30001
      3) "c85f1e08b06bae3ec104ae40c8a78fece1b20acf"
   4) 1) "127.0.0.1"
      2) (integer) 30004
      3) "5386f4d1b90669c873c13c5fc1b0ad59048dd47b"
   5) 1) "127.0.0.1"
      2) (integer) 30006
      3) "c1b06feefec9a26716a0aaca0fd99350c5737d03"
2) 1) (integer) 6
   2) (integer) 5460
   3) 1) "127.0.0.1"
      2) (integer) 30001
      3) "c85f1e08b06bae3ec104ae40c8a78fece1b20acf"
   4) 1) "127.0.0.1"
      2) (integer) 30004
      3) "5386f4d1b90669c873c13c5fc1b0ad59048dd47b"
   5) 1) "127.0.0.1"
      2) (integer) 30006
      3) "c1b06feefec9a26716a0aaca0fd99350c5737d03"
3) 1) (integer) 5461
   2) (integer) 10922
   3) 1) "127.0.0.1"
      2) (integer) 30002
      3) "3a5a7687277162bf766c6fe8e23269ef909ed3bd"
   4) 1) "127.0.0.1"
      2) (integer) 30005
      3) "c37de5d41257ed4631690fcb68b0f6fe25516571"
4) 1) (integer) 10923
   2) (integer) 16383
   3) 1) "127.0.0.1"
      2) (integer) 30003
      3) "4d7842cf1838e2efa9a348415aa7b992e9ea3462"
```

### CLUSTER KEYSLOT：查看键所属的槽

> https://redis.io/commands/cluster-keyslot/

查看键所属的槽：

```
CLUSTER KEYSLOT key
```

返回一个整数，标识指定键哈希到的哈希槽。该命令主要用于调试和测试。

例如：

```
127.0.0.1:30001> CLUSTER KEYSLOT key1
(integer) 9189
127.0.0.1:30001> CLUSTER KEYSLOT key2
(integer) 4998
127.0.0.1:30001> CLUSTER KEYSLOT key3
(integer) 935
127.0.0.1:30001> CLUSTER KEYSLOT {tag}:key1
(integer) 8338
127.0.0.1:30001> CLUSTER KEYSLOT {tag}:key2
(integer) 8338
```

可以看到使用了 hash tag 的 key 被分配到同一个槽上去了。

### CLUSTER FLUSHSLOTS：撤销分配给节点的所有槽

> https://redis.io/commands/cluster-flushslots/

撤销分配给节点的所有槽（只能在数据库为空时调用）

```
CLUSTER FLUSHSLOTS
```

### CLUSTER COUNTKEYSINSLOT：查看槽内的键数量

> https://redis.io/commands/cluster-countkeysinslot/

查看槽内的键数量，该命令仅查询本地数据集，因此当指定的槽不属于当前节点时将始终返回 0。

```
CLUSTER COUNTKEYSINSLOT slot
```

例如假如想知道 935 槽中有多少个 key

```
127.0.0.1:30001> CLUSTER COUNTKEYSINSLOT 935
(integer) 1
```

### CLUSTER GETKEYSINSLOT：获取槽包含的键

> https://redis.io/commands/cluster-getkeysinslot/

获取槽包含的键，count 参数控制返回最大的 key 的数量（指定的槽必须是分配给当前节点的）

```
CLUSTER GETKEYSINSLOT slot count
```

例如，假如想知道 935 槽中有哪些 key（返回 1 个 key，是因为我的数据库 935 槽只有一个 key）

```
127.0.0.1:30001> CLUSTER GETKEYSINSLOT 935 10
1) "key3"
```

### CLUSTER SETSLOT：改变槽的状态

> https://redis.io/commands/cluster-setslot/

改变槽的状态，

```
CLUSTER SETSLOT slot <IMPORTING node-id | MIGRATING node-id | NODE node-id | STABLE>
```

4 个子命令，它们可以改变给定槽在节点中的状态，从而实现节点之间的槽迁移以及集群重分片：

#### IMPORTING：导入槽

通过在节点上执行 IMPORTING 子命令，用户可以让节点的指定槽进入“导入中”（importing）状态，处于该状态的槽允许从源节点中导入槽数据：

```
CLUSTER SETSLOT <slot> IMPORTING <source-node-id>
```

准备目标节点从指定源节点导入键。该命令只有在节点尚未拥有指定哈希槽时才能生效。当一个槽被设置为导入状态时，节点的行为会发生以下变化：关于这个哈希槽的命令将被拒绝，并像往常一样生成MOVED重定向。但在命令跟随ASKING命令的情况下，此命令将被执行。

这样，当处于迁移状态的节点产生 ASK 重定向时，客户端将联系目标节点，发送 ASKING，紧接着发送命令。这样，在旧节点中不存在的键或已经迁移到目标节点的键上执行命令，从而保证：

1. 新键始终在目标节点中创建。在哈希槽迁移期间，我们只需要移动旧键，而不是新键。
2. 关于已经迁移的键的命令在迁移目标节点的上下文中正确处理，以确保一致性。
3. 没有 ASKING 时，行为与通常相同。这可以确保具有错误哈希槽映射的客户端不会因为错误写入目标节点，从而创建尚未迁移的键的新版本。

#### MIGRATING：迁移槽

```
CLUSTER SETSLOT <slot> MIGRATING <destination-node-id>
```

该子命令将槽设置为迁移状态。为了将槽设置为此状态，接收该命令的节点必须是哈希槽所有者，否则将返回错误。

当一个槽被设置为迁移状态时，节点的行为会发生以下变化：

- 当接收到关于现有键的命令时，该命令将按照通常的方式进行处理。
- 如果接收到关于不存在键的命令，则节点会生成一个ASK重定向，并要求客户端只重新尝试将该特定查询发送到目标节点。在这种情况下，客户端不应更新其哈希槽到节点映射。
- 如果命令包含多个键，但没有任何一个存在，则行为与第二点相同。如果所有键都存在，则行为与第一点相同。但是，如果只有部分键存在，则该命令会生成 TRYAGAIN 错误，以便感兴趣的键可以完成迁移到目标节点，从而使多键命令可以执行。

#### NODE：将槽分配给节点

```
CLUSTER SETSLOT <slot> NODE <node-id>
```

NODE 子命令是语义最复杂的一个，它将哈希槽与指定节点关联。但该命令仅在特定情况下生效，具体副作用取决于槽的状态。以下是该命令的前置条件和副作用集：

1. 如果当前哈希槽所有者是接收该命令的节点，但由于该命令的影响，该槽将被分配给另一个节点，则如果该哈希槽在接收命令的节点中仍有键，则命令将返回错误；
2. 如果哈希槽处于迁移状态，则在将槽分配给另一个节点时，状态会被清除；
3. 如果哈希槽在接收命令的节点中处于导入状态，并且该命令将该槽分配给该节点（这发生在将哈希槽从一个节点重新分片到另一个节点的过程中），则该命令具有以下副作用：
   1. A）导入状态被清除。
   2. B）如果该节点的配置时期尚未是集群中最大的，则生成一个新的配置时期并将其分配给自己。这样，其新的哈希槽所有权将超过以前由先前的故障转移或槽迁移创建的任何旧配置。

需要注意的是，步骤 3 是 Redis Cluster 节点在没有其他节点同意的情况下创建新配置时期的唯一时间。这仅会在进行手动配置时发生。但这不可能创建一个非暂态设置，其中两个节点具有相同的配置时期，因为 Redis Cluster 使用配置时期冲突解析算法。

#### STABLE：移除槽的导入/迁移状态

这个子命令只是从槽中清除节点指定槽的“导入中”或“迁移中”状态。它主要用于通过 redis-cli --cluster fix 修复处于错误状态的集群。通常，在使用 SETSLOT ... NODE ... 子命令结束迁移时，这两个状态会自动清除。正常情况下，用户并不需要执行 STABLE 子命令。STABLE 子命令的唯一作用，就是在槽迁移出错或者重分片出错时，手动移除相应节点的槽状态。

```
CLUSTER SETSLOT <slot> STABLE
```

## 其他命令

https://redis.io/commands/asking/

https://redis.io/commands/cluster-addslotsrange/

https://redis.io/commands/cluster-bumpepoch/

https://redis.io/commands/cluster-count-failure-reports/

https://redis.io/commands/cluster-delslotsrange/

https://redis.io/commands/cluster-links/

https://redis.io/commands/cluster-myshardid/

https://redis.io/commands/cluster-saveconfig/

https://redis.io/commands/cluster-set-config-epoch/

https://redis.io/commands/cluster-shards/
