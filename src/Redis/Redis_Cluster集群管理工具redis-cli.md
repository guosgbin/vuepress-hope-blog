---
title: Redis Cluster集群管理工具redis-cli
---

| 版本 | 内容 | 时间                |
| ---- | ---- | ------------------- |
| V1   | 新建 | 2023-05-04 20:45:56 |

> 大部分内容来自 redis 使用手册

## 集群管理工具 redis-cli

Redis 版本 6.2.6

通过 `redis-cli --cluster help` 可以看到所有的集群相关的管理命令。

```
$ ./redis-cli --cluster help                 
Cluster Manager Commands:
  create         host1:port1 ... hostN:portN				# 创建集群
                 --cluster-replicas <arg>					# 从节点个数
  check          host:port									# 检查集群
                 --cluster-search-multiple-owners			# 检查是否有槽同时被分配给多个节点
  info           host:port									# 查看集群信息
  fix            host:port									# 修复集群
                 --cluster-search-multiple-owners			# 检查是否有槽同时被分配给多个节点
                 --cluster-fix-with-unreachable-masters
  reshard        host:port									# 重分片
                 --cluster-from <arg>						# 需要从哪些源节点上迁移slot，可从多个源节点完成迁移，以逗号隔开，传递的是节点的node id
                 --cluster-to <arg>							# slot需要迁移的目的节点的node id，目的节点只能填写一个，不传递该参数的话，则会在迁移过程中提示用户输入
                 --cluster-slots <arg>						# 需要迁移的slot数量，不传递该参数的话，则会在迁移过程中提示用户输入。
                 --cluster-yes								# 指定迁移时的确认输入
                 --cluster-timeout <arg>					# 超时时间
                 --cluster-pipeline <arg>					# 是否使用 pipeline
                 --cluster-replace							# 是否直接replace到目标节点
  rebalance      host:port									# 重平衡
                 --cluster-weight <node1=w1...nodeN=wN>		# 指定权重
                 --cluster-use-empty-masters				# 设置可以让没有槽的空节点也分配相应的槽（默认不允许）
                 --cluster-timeout <arg>					# 超时时间
                 --cluster-simulate							# 模拟重平衡，并不会迁移节点
                 --cluster-pipeline <arg>					# 是否使用 pipeline
                 --cluster-threshold <arg>					# 阈值
                 --cluster-replace							# 是否直接replace到目标节点
  add-node       new_host:new_port existing_host:existing_port # 添加节点
                 --cluster-slave							# 作为从节点
                 --cluster-master-id <arg>					# 作为那个主节点的从节点	
  del-node       host:port node_id							# 删除节点
  call           host:port command arg arg .. arg			# 执行命令
                 --cluster-only-masters
                 --cluster-only-replicas
  set-timeout    host:port milliseconds						# 设置超时时间 cluster-node-timeout
  import         host:port									# 导入数据
                 --cluster-from <arg>						# 单机 redis 数据源
                 --cluster-from-user <arg>
                 --cluster-from-pass <arg>
                 --cluster-from-askpass
                 --cluster-copy								# 复制
                 --cluster-replace							# 覆盖同名键
  backup         host:port backup_directory					# 备份
  help           

For check, fix, reshard, del-node, set-timeout you can specify the host and port of any working node in the cluster.

Cluster Manager Options:
  --cluster-yes  Automatic yes to cluster commands prompts
```

## 子命令介绍

### create 创建集群

表示创建一个集群，`host1:port1` 表示集群中的节点的 IP 和端口，其中可选的 `--cluster-replicas` 表示为主节点设置几个从节点。

```
create host1:port1 ... hostN:portN --cluster-replicas <arg>
```

举个例子：表示建立一个 3 主 3 从的集群。

```
redis-cli --cluster create 127.0.0.1:30001 127.0.0.1:30002 127.0.0.1:30003 127.0.0.1:30004 127.0.0.1:30005 127.0.0.1:30006 --cluster-replicas 1
```

### check 检查集群

通过 check 子命令，可以查看集群的配置是否正常，只需要连接一个集群中的节点即可。

`--cluster-search-multiple-owners` 表示检查是否有槽同时被分配给了多个节点

```
check host:port --cluster-search-multiple-owners
```

举例：对于一个正常运行的集群，对其执行 check 子命令将得到一切正常的结果

```
$ ./redis-cli --cluster check 127.0.0.1:30001
127.0.0.1:30001 (7a606264...) -> 0 keys | 5461 slots | 1 slaves.
127.0.0.1:30003 (7ffb7490...) -> 0 keys | 5461 slots | 1 slaves.
127.0.0.1:30002 (b894fa8e...) -> 0 keys | 5462 slots | 1 slaves.
[OK] 0 keys in 3 masters.
0.00 keys per slot on average.
>>> Performing Cluster Check (using node 127.0.0.1:30001)
M: 7a6062647ca518602bfd4df53aa05e8b91685492 127.0.0.1:30001
   slots:[0-5460] (5461 slots) master
   1 additional replica(s)
M: 7ffb74903c1f83e972db6aa4ccbea7d05c78522e 127.0.0.1:30003
   slots:[10923-16383] (5461 slots) master
   1 additional replica(s)
S: 348c9f527752ea19f29ccf662e939d6c6dc10678 127.0.0.1:30004
   slots: (0 slots) slave
   replicates 7ffb74903c1f83e972db6aa4ccbea7d05c78522e
S: 49eb6dbcb6bd920702a8d8c4d4d76b1b621b7b9a 127.0.0.1:30006
   slots: (0 slots) slave
   replicates b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf
M: b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf 127.0.0.1:30002
   slots:[5461-10922] (5462 slots) master
   1 additional replica(s)
S: e9afac3ecc6ca627830cf24d5fd0834d6b747b31 127.0.0.1:30005
   slots: (0 slots) slave
   replicates 7a6062647ca518602bfd4df53aa05e8b91685492
[OK] All nodes agree about slots configuration.
>>> Check for open slots...
>>> Check slots coverage...
[OK] All 16384 slots covered.
```

### info 集群信息

子命令 info 查看集群信息，只需要连接集群中的一个节点即可。

```
info host:port
```

命令返回的信息包括：

- 主节点的地址以及运行 ID，它们存储的键数量以及负责的槽数量，以及它们拥有的从节点数量；
- 集群包含的数据库键数量以及主节点数量，以及每个槽平均存储的键数量；

```
$ ./redis-cli --cluster info 127.0.0.1:30001     
127.0.0.1:30001 (7a606264...) -> 0 keys | 5461 slots | 1 slaves.
127.0.0.1:30003 (7ffb7490...) -> 0 keys | 5461 slots | 1 slaves.
127.0.0.1:30002 (b894fa8e...) -> 0 keys | 5462 slots | 1 slaves.
[OK] 0 keys in 3 masters.
0.00 keys per slot on average.
```

### fix 修复槽错误

当集群在重分片、重平衡或者槽迁移的过程中出现错误时，执行 cluster 的子命令 fix 可以让涉及的槽重新回到正常状态。

```
fix host:port							    # 修复集群
  --cluster-search-multiple-owners			# 检查是否有槽同时被分配给多个节点
  --cluster-fix-with-unreachable-masters
```

如果 fix 命令在检查集群之后没有发现任何异常，那么它将不做任何动作，直接退出。

### reshard 重分片

将指定数量的槽从原节点迁移至目标节点，被迁移的槽将交由后者负责，并且槽中已有的数据也会陆续从原节点转移至目标节点

```
reshard  host:port
	--cluster-from <arg>  	# 源节点 id
	--cluster-to <arg>   	# 目标节点 id
	--cluster-slots <arg>	# 要迁移槽的数量
	--cluster-yes			# 直接 yes 执行
	--cluster-timeout <arg>	# 迁移的超时时间
	--cluster-pipeline <arg># 是否使用 pipeline
	--cluster-replace		# 是否直接 replace 到目标节点
```

例如：

将 30001 端口的 redis 实例（节点 ID 是 7a6062647ca518602bfd4df53aa05e8b91685492）迁移 10 个槽位到 30002 的 redis 实例（节点 ID 是）b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf。

```
$ ./redis-cli --cluster reshard 127.0.0.1:30001 --cluster-from 7a6062647ca518602bfd4df53aa05e8b91685492 --cluster-to b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf --cluster-slots 10 
>>> Performing Cluster Check (using node 127.0.0.1:30001)
M: 7a6062647ca518602bfd4df53aa05e8b91685492 127.0.0.1:30001
   slots:[0-5460] (5461 slots) master
   1 additional replica(s)
M: 7ffb74903c1f83e972db6aa4ccbea7d05c78522e 127.0.0.1:30003
   slots:[10923-16383] (5461 slots) master
   1 additional replica(s)
S: 348c9f527752ea19f29ccf662e939d6c6dc10678 127.0.0.1:30004
   slots: (0 slots) slave
   replicates 7ffb74903c1f83e972db6aa4ccbea7d05c78522e
S: 49eb6dbcb6bd920702a8d8c4d4d76b1b621b7b9a 127.0.0.1:30006
   slots: (0 slots) slave
   replicates b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf
M: b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf 127.0.0.1:30002
   slots:[5461-10922] (5462 slots) master
   1 additional replica(s)
S: e9afac3ecc6ca627830cf24d5fd0834d6b747b31 127.0.0.1:30005
   slots: (0 slots) slave
   replicates 7a6062647ca518602bfd4df53aa05e8b91685492
[OK] All nodes agree about slots configuration.
>>> Check for open slots...
>>> Check slots coverage...
[OK] All 16384 slots covered.

Ready to move 10 slots.
  Source nodes:
    M: 7a6062647ca518602bfd4df53aa05e8b91685492 127.0.0.1:30001
       slots:[0-5460] (5461 slots) master
       1 additional replica(s)
  Destination node:
    M: b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf 127.0.0.1:30002
       slots:[5461-10922] (5462 slots) master
       1 additional replica(s)
  Resharding plan:
    Moving slot 0 from 7a6062647ca518602bfd4df53aa05e8b91685492
    Moving slot 1 from 7a6062647ca518602bfd4df53aa05e8b91685492
    Moving slot 2 from 7a6062647ca518602bfd4df53aa05e8b91685492
    Moving slot 3 from 7a6062647ca518602bfd4df53aa05e8b91685492
    Moving slot 4 from 7a6062647ca518602bfd4df53aa05e8b91685492
    Moving slot 5 from 7a6062647ca518602bfd4df53aa05e8b91685492
    Moving slot 6 from 7a6062647ca518602bfd4df53aa05e8b91685492
    Moving slot 7 from 7a6062647ca518602bfd4df53aa05e8b91685492
    Moving slot 8 from 7a6062647ca518602bfd4df53aa05e8b91685492
    Moving slot 9 from 7a6062647ca518602bfd4df53aa05e8b91685492
Do you want to proceed with the proposed reshard plan (yes/no)? yes
Moving slot 0 from 127.0.0.1:30001 to 127.0.0.1:30002: 
Moving slot 1 from 127.0.0.1:30001 to 127.0.0.1:30002: 
Moving slot 2 from 127.0.0.1:30001 to 127.0.0.1:30002: 
Moving slot 3 from 127.0.0.1:30001 to 127.0.0.1:30002: 
Moving slot 4 from 127.0.0.1:30001 to 127.0.0.1:30002: 
Moving slot 5 from 127.0.0.1:30001 to 127.0.0.1:30002: 
Moving slot 6 from 127.0.0.1:30001 to 127.0.0.1:30002: 
Moving slot 7 from 127.0.0.1:30001 to 127.0.0.1:30002: 
Moving slot 8 from 127.0.0.1:30001 to 127.0.0.1:30002: 
Moving slot 9 from 127.0.0.1:30001 to 127.0.0.1:30002: 
```

迁移前的集群信息

```
$ ./redis-cli --cluster info 127.0.0.1:30001 127.0.0.1:30001 (7a606264...) -> 0 keys | 5461 slots | 1 slaves.
127.0.0.1:30003 (7ffb7490...) -> 0 keys | 5461 slots | 1 slaves.
127.0.0.1:30002 (b894fa8e...) -> 0 keys | 5462 slots | 1 slaves.
[OK] 0 keys in 3 masters.
0.00 keys per slot on average.
```

迁移后的集群信息

```
$ ./redis-cli --cluster info 127.0.0.1:30001
127.0.0.1:30001 (7a606264...) -> 0 keys | 5451 slots | 1 slaves.
127.0.0.1:30003 (7ffb7490...) -> 0 keys | 5461 slots | 1 slaves.
127.0.0.1:30002 (b894fa8e...) -> 0 keys | 5472 slots | 1 slaves.
[OK] 0 keys in 3 masters.
0.00 keys per slot on average.
```

### rebalance 重平衡

允许用户在有需要时重新分配各个节点负责的槽数量，从而使得各个节点的负载压力趋于平衡：

```
rebalance      host:port					# 指定集群的任意一节点进行平衡集群节点slot数量
    --cluster-weight <node1=w1...nodeN=wN>	# 指定集群节点的权重
    --cluster-use-empty-masters				# 设置可以让没有分配slot的主节点参与，默认不允许
    --cluster-timeout <arg>					# 设置命令的超时时间
    --cluster-simulate						# 模拟rebalance操作，不会真正执行迁移操作
    --cluster-pipeline <arg>				# 定义cluster getkeysinslot命令一次取出的key数量，默认值为10
    --cluster-threshold <arg>				# 迁移的槽阈值超过threshold，执行rebalance操作
    --cluster-replace						# 是否直接replace到目标节点
```

例如：

假设我们现在的集群有 30001、30002 和 30003 这 3 个主节点，它们分别被分配了 3000、11384 和 2000 个槽：

```
$ ./redis-cli --cluster info 127.0.0.1:30001 
127.0.0.1:30001 (7a606264...) -> 0 keys | 3000 slots | 1 slaves.
127.0.0.1:30003 (7ffb7490...) -> 0 keys | 2000 slots | 1 slaves.
127.0.0.1:30002 (b894fa8e...) -> 0 keys | 11384 slots | 1 slaves.
```

上面的三个节点的负载不均和，需要重新平衡一下：

```
$ ./redis-cli --cluster rebalance 127.0.0.1:30001
>>> Performing Cluster Check (using node 127.0.0.1:30001)
[OK] All nodes agree about slots configuration.
>>> Check for open slots...
>>> Check slots coverage...
[OK] All 16384 slots covered.
>>> Rebalancing across 3 nodes. Total weight = 3.00
Moving 3461 slots from 127.0.0.1:30002 to 127.0.0.1:30003
#####################################################################################.
.
.
Moving 2462 slots from 127.0.0.1:30002 to 127.0.0.1:30001
#####################################################################################.
.
.
```

rebalance 之后重新趋于平衡

```
$ ./redis-cli --cluster info 127.0.0.1:30001     
127.0.0.1:30001 (7a606264...) -> 0 keys | 5462 slots | 1 slaves.
127.0.0.1:30003 (7ffb7490...) -> 0 keys | 5461 slots | 1 slaves.
127.0.0.1:30002 (b894fa8e...) -> 0 keys | 5461 slots | 1 slaves.
[OK] 0 keys in 3 masters.
0.00 keys per slot on average.
```



rebalance 的其他选项

- `--cluster-weight <node1=w1...nodeN=wN>`：指定集群节点的权重，权重较大的节点将被指派更多槽。就可以让性能更强的节点负担更多负载；（默认权重是 1.0，假如设置为 0 表示不分配槽给它）
- `--cluster-use-empty-masters`：设置可以让没有槽的空节点也分配相应的槽（默认不允许）；
- `--cluster-timeout <arg>`：超时时间；
- `--cluster-simulate`：模拟重平衡操作，并不会真的迁移槽；
- `--cluster-pipeline <arg>`：是否使用 pipeline，定义 cluster getkeysinslot 命令一次取出的 key 数量，默认值为 10；
- `--cluster-threshold <arg>`：rebalance 命令在执行时会根据各个节点目前负责的槽数量以及用户给定的权重计算出每个节点应该负责的槽数量（期望槽数量），如果这个槽数量与节点目前负责的槽数量之间的比率超过了指定的阈值，那么就会触发槽的重分配操作。触发重分配操作的阈值默认为 2.0，也就是期望槽数量与实际槽数量之间不能相差超过两倍，用户也可以通过该选项来指定自己想要的阈值；
- `--cluster-replace`：是否直接 replace 到目标节点；

### add-node 添加节点

添加一个节点到集群中去，指定一个已经在集群中的节点即可。

```
add-node   new_host:new_port existing_host:existing_port
    --cluster-slave
    --cluster-master-id <arg>
```

例如：假如现在新增一个 30007 端口的节点到集群中，30001 端口的节点已经在集群中了。

先启动 30007

```
redis-server redis-30007.conf
```

加入前的集群信息

```
$ ./redis-cli --cluster info 127.0.0.1:30001                        
127.0.0.1:30001 (7a606264...) -> 0 keys | 5462 slots | 1 slaves.
127.0.0.1:30003 (7ffb7490...) -> 0 keys | 2000 slots | 1 slaves.
127.0.0.1:30002 (b894fa8e...) -> 0 keys | 8922 slots | 1 slaves.
[OK] 0 keys in 3 masters.
0.00 keys per slot on average.
```

加入集群

```
$ ./redis-cli --cluster add-node 127.0.0.1:30007 127.0.0.1:30001
>>> Adding node 127.0.0.1:30007 to cluster 127.0.0.1:30001
>>> Performing Cluster Check (using node 127.0.0.1:30001)
M: 7a6062647ca518602bfd4df53aa05e8b91685492 127.0.0.1:30001
   slots:[2461-5460],[6461-8922] (5462 slots) master
   1 additional replica(s)
M: 7ffb74903c1f83e972db6aa4ccbea7d05c78522e 127.0.0.1:30003
   slots:[14384-16383] (2000 slots) master
   1 additional replica(s)
S: 348c9f527752ea19f29ccf662e939d6c6dc10678 127.0.0.1:30004
   slots: (0 slots) slave
   replicates 7ffb74903c1f83e972db6aa4ccbea7d05c78522e
S: 49eb6dbcb6bd920702a8d8c4d4d76b1b621b7b9a 127.0.0.1:30006
   slots: (0 slots) slave
   replicates b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf
M: b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf 127.0.0.1:30002
   slots:[0-2460],[5461-6460],[8923-14383] (8922 slots) master
   1 additional replica(s)
S: e9afac3ecc6ca627830cf24d5fd0834d6b747b31 127.0.0.1:30005
   slots: (0 slots) slave
   replicates 7a6062647ca518602bfd4df53aa05e8b91685492
[OK] All nodes agree about slots configuration.
>>> Check for open slots...
>>> Check slots coverage...
[OK] All 16384 slots covered.
>>> Send CLUSTER MEET to node 127.0.0.1:30007 to make it join the cluster.
[OK] New node added correctly.
```

加入后的集群信息

```
$ ./redis-cli --cluster info 127.0.0.1:30001               
127.0.0.1:30001 (7a606264...) -> 0 keys | 5462 slots | 1 slaves.
127.0.0.1:30003 (7ffb7490...) -> 0 keys | 2000 slots | 1 slaves.
127.0.0.1:30002 (b894fa8e...) -> 0 keys | 8922 slots | 1 slaves.
127.0.0.1:30007 (3f88a5c9...) -> 0 keys | 0 slots | 0 slaves.
[OK] 0 keys in 4 masters.
0.00 keys per slot on average.
```

其他选项：在默认情况下，add-node 命令添加的新节点将作为主节点存在。如果用户想要添加的新节点为从节点，那么可以在执行命令的同时，通过给定以下两个可选项来将新节点设置为从节点：

```
--cluster-slave
--cluster-master-id <arg> # 表示作为那个节点 id 的从节点
```

### del-node 删除节点

从集群中删除一个节点，指定一个已经在集群中的节点即可，node_id 表示要移除的节点 id。

```
del-node host:port node_id
```

例如：删除刚刚增加的 30007 节点

删除前的集群信息

```
$ ./redis-cli --cluster info 127.0.0.1:30001                                                
127.0.0.1:30001 (7a606264...) -> 0 keys | 4096 slots | 1 slaves.
127.0.0.1:30003 (7ffb7490...) -> 0 keys | 4096 slots | 1 slaves.
127.0.0.1:30002 (b894fa8e...) -> 0 keys | 4096 slots | 1 slaves.
127.0.0.1:30007 (3f88a5c9...) -> 0 keys | 4096 slots | 0 slaves.
[OK] 0 keys in 4 masters.
0.00 keys per slot on average.
```

先将 30007 的槽迁移走，使用 rebalance（使用 reshard 也可以）

```
>>> Rebalancing across 4 nodes. Total weight = 3.00
Moving 1366 slots from 127.0.0.1:30007 to 127.0.0.1:30001
.
.
.
Moving 1365 slots from 127.0.0.1:30007 to 127.0.0.1:30003
.
.
.
Moving 1365 slots from 127.0.0.1:30007 to 127.0.0.1:30002
.
.
.
```

迁移后的集群信息

```
$ ./redis-cli --cluster info 127.0.0.1:30001                                         127.0.0.1:30001 (7a606264...) -> 0 keys | 5462 slots | 1 slaves.
127.0.0.1:30003 (7ffb7490...) -> 0 keys | 5461 slots | 1 slaves.
127.0.0.1:30002 (b894fa8e...) -> 0 keys | 5461 slots | 2 slaves.
[OK] 0 keys in 3 masters.
0.00 keys per slot on average.
```

删除节点

```
$ ./redis-cli --cluster del-node 127.0.0.1:30001 3f88a5c9cdddde757e30d6da6b2aa161c94fe42c>>> Removing node 3f88a5c9cdddde757e30d6da6b2aa161c94fe42c from cluster 127.0.0.1:30001
>>> Sending CLUSTER FORGET messages to the cluster...
>>> Sending CLUSTER RESET SOFT to the deleted node.
```

删除后的集群信息

```
$ ./redis-cli --cluster info 127.0.0.1:30001                                             
127.0.0.1:30001 (7a606264...) -> 0 keys | 5462 slots | 1 slaves.
127.0.0.1:30003 (7ffb7490...) -> 0 keys | 5461 slots | 1 slaves.
127.0.0.1:30002 (b894fa8e...) -> 0 keys | 5461 slots | 1 slaves.
[OK] 0 keys in 3 masters.
0.00 keys per slot on average.
```

### call 执行命令

在整个集群的所有节点上执行给定的命令：

```
call host:port command arg arg .. arg
    --cluster-only-masters  # 仅主节点
    --cluster-only-replicas	# 仅从节点
```

例如：

```
$ ./redis-cli --cluster call 127.0.0.1:30001 ping
>>> Calling ping
127.0.0.1:30001: PONG
127.0.0.1:30003: PONG
127.0.0.1:30004: PONG
127.0.0.1:30006: PONG
127.0.0.1:30002: PONG
127.0.0.1:30005: PONG
```

或者执行 role 命令

```
$ ./redis-cli --cluster call 127.0.0.1:30001 role            
>>> Calling role
127.0.0.1:30001: master
33614
127.0.0.1
30005
33614
127.0.0.1:30003: master
33614
127.0.0.1
30004
33614
127.0.0.1:30004: slave
127.0.0.1
30003
connected
33614
127.0.0.1:30006: slave
127.0.0.1
30002
connected
33614
127.0.0.1:30002: master
33614
127.0.0.1
30006
33614
127.0.0.1:30005: slave
127.0.0.1
30001
connected
33614
```

### set-timeout 设置超时时间

为集群的所有节点重新设置 cluster-node-timeout 选项的值：

```
set-timeout    host:port milliseconds
```

例如：将集群内所有节点的 cluster-node-timeout 选项的值设置为 3000：

```
$ ./redis-cli --cluster set-timeout 127.0.0.1:30001 3000
>>> Reconfiguring node timeout in every cluster node...
*** New timeout set for 127.0.0.1:30001
*** New timeout set for 127.0.0.1:30003
*** New timeout set for 127.0.0.1:30004
*** New timeout set for 127.0.0.1:30006
*** New timeout set for 127.0.0.1:30002
*** New timeout set for 127.0.0.1:30005
>>> New node timeout set. 6 OK, 0 ERR.
```

### import 导入数据

将给定单机 Redis 服务器的数据导入集群中

```
import host:port
    --cluster-from <arg>		# 单机 redis 来源
    --cluster-from-user <arg>	
    --cluster-from-pass <arg>
    --cluster-from-askpass
    --cluster-copy				# 复制，保留单机 redis 的数据（不指定会删除单机中的数据）
    --cluster-replace			# 同名键冲突，覆盖同名键（不指定会中断导入操作）
```

例如：导入 6379 端口的数据到集群中。

```
redis-cli --cluster import 127.0.0.1:30001 --cluster-from 127.0.0.1:6379 --cluster-copy --cluster-replace
```

### backup 备份集群数据

备份集群数据，也就是 RDB 文件了。

```
backup host:port backup_directory
```

例如：

```
$ ./redis-cli --cluster backup 127.0.0.1:30001 /soft
>>> Performing Cluster Check (using node 127.0.0.1:30001)
M: 7a6062647ca518602bfd4df53aa05e8b91685492 127.0.0.1:30001
   slots:[3827-5460],[6461-8922] (4096 slots) master
   1 additional replica(s)
M: 7ffb74903c1f83e972db6aa4ccbea7d05c78522e 127.0.0.1:30003
   slots:[2731-3826],[5461-5730],[9558-10287],[14384-16383] (4096 slots) master
   1 additional replica(s)
S: 348c9f527752ea19f29ccf662e939d6c6dc10678 127.0.0.1:30004
   slots: (0 slots) slave
   replicates 7ffb74903c1f83e972db6aa4ccbea7d05c78522e
S: 49eb6dbcb6bd920702a8d8c4d4d76b1b621b7b9a 127.0.0.1:30006
   slots: (0 slots) slave
   replicates b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf
M: b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf 127.0.0.1:30002
   slots:[0-2730],[5731-6460],[8923-9557],[10288-14383] (8192 slots) master
   1 additional replica(s)
S: e9afac3ecc6ca627830cf24d5fd0834d6b747b31 127.0.0.1:30005
   slots: (0 slots) slave
   replicates 7a6062647ca518602bfd4df53aa05e8b91685492
[OK] All nodes agree about slots configuration.
>>> Check for open slots...
>>> Check slots coverage...
[OK] All 16384 slots covered.
>>> Node 127.0.0.1:30001 -> Saving RDB...
SYNC sent to master, writing 179 bytes to '/soft/redis-node-127.0.0.1-30001-7a6062647ca518602bfd4df53aa05e8b91685492.rdb'
Transfer finished with success.
>>> Node 127.0.0.1:30003 -> Saving RDB...
SYNC sent to master, writing 179 bytes to '/soft/redis-node-127.0.0.1-30003-7ffb74903c1f83e972db6aa4ccbea7d05c78522e.rdb'
Transfer finished with success.
>>> Node 127.0.0.1:30002 -> Saving RDB...
SYNC sent to master, writing 179 bytes to '/soft/redis-node-127.0.0.1-30002-b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf.rdb'
Transfer finished with success.
Saving cluster configuration to: /soft/nodes.json
[OK] Backup created into: /soft
```

执行完后，将会在指定的文件夹中找到对应的 RDB 文件和一个 JSON 文件

```
redis-node-127.0.0.1-30001-7a6062647ca518602bfd4df53aa05e8b91685492.rdb
redis-node-127.0.0.1-30002-b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf.rdb
redis-node-127.0.0.1-30003-7ffb74903c1f83e972db6aa4ccbea7d05c78522e.rdb
nodes.json
```

JSON 文件内容如下

```json
[
  {
    "name": "7a6062647ca518602bfd4df53aa05e8b91685492",
    "host": "127.0.0.1",
    "port": 30001,
    "replicate": null,
    "slots": [[3827,5460],[6461,8922]],
    "slots_count": 4096,
    "flags": "master",
    "current_epoch": 13
  },
  {
    "name": "7ffb74903c1f83e972db6aa4ccbea7d05c78522e",
    "host": "127.0.0.1",
    "port": 30003,
    "replicate": null,
    "slots": [[2731,3826],[5461,5730],[9558,10287],[14384,16383]],
    "slots_count": 4096,
    "flags": "master",
    "current_epoch": 14
  },
  {
    "name": "348c9f527752ea19f29ccf662e939d6c6dc10678",
    "host": "127.0.0.1",
    "port": 30004,
    "replicate": "7ffb74903c1f83e972db6aa4ccbea7d05c78522e",
    "slots": [],
    "slots_count": 0,
    "flags": "slave",
    "current_epoch": 14
  },
  {
    "name": "49eb6dbcb6bd920702a8d8c4d4d76b1b621b7b9a",
    "host": "127.0.0.1",
    "port": 30006,
    "replicate": "b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf",
    "slots": [],
    "slots_count": 0,
    "flags": "slave",
    "current_epoch": 17
  },
  {
    "name": "b894fa8eae24d0ffec68bf0e7ada98fd2f5b37cf",
    "host": "127.0.0.1",
    "port": 30002,
    "replicate": null,
    "slots": [[0,2730],[5731,6460],[8923,9557],[10288,14383]],
    "slots_count": 8192,
    "flags": "master",
    "current_epoch": 17
  },
  {
    "name": "e9afac3ecc6ca627830cf24d5fd0834d6b747b31",
    "host": "127.0.0.1",
    "port": 30005,
    "replicate": "7a6062647ca518602bfd4df53aa05e8b91685492",
    "slots": [],
    "slots_count": 0,
    "flags": "slave",
    "current_epoch": 13
  }
]
```

