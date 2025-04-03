---
title: redis-cli使用
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新增 | 2023年04月11日00:36:04 |

## Redis-cli 支持的所有选项

Redis-cli 支持很多选项，每个 Redis 版本支持的选项不一样。

### Redis 4.0.6 支持的选项

```shell
[Calven.Liu@ALYBJ59-6 ~]$ redis-cli --help
redis-cli 4.0.6

Usage: redis-cli [OPTIONS] [cmd [arg [arg ...]]]
  -h <hostname>      Server hostname (default: 127.0.0.1).
  -p <port>          Server port (default: 6379).
  -s <socket>        Server socket (overrides hostname and port).
  -a <password>      Password to use when connecting to the server.
  -u <uri>           Server URI.
  -r <repeat>        Execute specified command N times.
  -i <interval>      When -r is used, waits <interval> seconds per command.
                     It is possible to specify sub-second times like -i 0.1.
  -n <db>            Database number.
  -x                 Read last argument from STDIN.
  -d <delimiter>     Multi-bulk delimiter in for raw formatting (default: \n).
  -c                 Enable cluster mode (follow -ASK and -MOVED redirections).
  --raw              Use raw formatting for replies (default when STDOUT is
                     not a tty).
  --no-raw           Force formatted output even when STDOUT is not a tty.
  --csv              Output in CSV format.
  --stat             Print rolling stats about server: mem, clients, ...
  --latency          Enter a special mode continuously sampling latency.
                     If you use this mode in an interactive session it runs
                     forever displaying real-time stats. Otherwise if --raw or
                     --csv is specified, or if you redirect the output to a non
                     TTY, it samples the latency for 1 second (you can use
                     -i to change the interval), then produces a single output
                     and exits.
  --latency-history  Like --latency but tracking latency changes over time.
                     Default time interval is 15 sec. Change it using -i.
  --latency-dist     Shows latency as a spectrum, requires xterm 256 colors.
                     Default time interval is 1 sec. Change it using -i.
  --lru-test <keys>  Simulate a cache workload with an 80-20 distribution.
  --slave            Simulate a slave showing commands received from the master.
  --rdb <filename>   Transfer an RDB dump from remote server to local file.
  --pipe             Transfer raw Redis protocol from stdin to server.
  --pipe-timeout <n> In --pipe mode, abort with error if after sending all data.
                     no reply is received within <n> seconds.
                     Default timeout: 30. Use 0 to wait forever.
  --bigkeys          Sample Redis keys looking for big keys.
  --hotkeys          Sample Redis keys looking for hot keys.
                     only works when maxmemory-policy is *lfu.
  --scan             List all keys using the SCAN command.
  --pattern <pat>    Useful with --scan to specify a SCAN pattern.
  --intrinsic-latency <sec> Run a test to measure intrinsic system latency.
                     The test will run for the specified amount of seconds.
  --eval <file>      Send an EVAL command using the Lua script at <file>.
  --ldb              Used with --eval enable the Redis Lua debugger.
  --ldb-sync-mode    Like --ldb but uses the synchronous Lua debugger, in
                     this mode the server is blocked and script changes are
                     are not rolled back from the server memory.
  --help             Output this help and exit.
  --version          Output version and exit.

Examples:
  cat /etc/passwd | redis-cli -x set mypasswd
  redis-cli get mypasswd
  redis-cli -r 100 lpush mylist x
  redis-cli -r 100 -i 1 info | grep used_memory_human:
  redis-cli --eval myscript.lua key1 key2 , arg1 arg2 arg3
  redis-cli --scan --pattern '*:12345*'

  (Note: when using --eval the comma separates KEYS[] from ARGV[] items)

When no command is given, redis-cli starts in interactive mode.
Type "help" in interactive mode for information on available commands
and settings.
```

### Redis 4.0.6 支持的选项介绍

| 选项                        | 含义                                                         |
| --------------------------- | ------------------------------------------------------------ |
| `-h <hostname>`             | 服务器 IP 地址，默认 127.0.0.1                               |
| `-p <port>`                 | 服务器端口，默认 6379                                        |
| `-s <socket>`               | Unix socket 文件连接到服务器                                 |
| `-a <password> `            | 密码                                                         |
| ` -u <uri>`                 | 连接服务器，`redis://password@host:port/dbnum`               |
| `-r <repeat>`               | 重复执行命令 N 次，-1 表示无限次                             |
| `-i <interval>`             | 每个命令执行的间隔时间，单位秒，可以指定小数                 |
| `-n <db>`                   | 选择对应编号的数据库                                         |
| `-x`                        | Read last argument from STDIN                                |
| `  -d <delimiter>`          | Multi-bulk delimiter in for raw formatting (default: \n).    |
| `-c`                        | -c （cluster）是连接 Redis Cluster 节点时需要使用的，-c 选项可以防止 moved 和 ask 异常 |
| `--raw`                     | 命令返回的是格式化后的结果                                   |
| `--no-raw`                  | 命令返回的结果是原始的格式                                   |
| `--csv`                     | 命令以 CSV 格式返回结果，CSV（逗号分隔值）                   |
| `--stat`                    | 实时获取服务器的统计信息，如内存......                       |
| `--latency`                 | 测试客户端到目标 Redis 的网络延迟，原理是客户端每秒发送 100 个 PING 命令到服务端并计算收到回复的时间（单位毫秒），支持和 `--raw` 和 `--csv`一起使用，和这两个一起使用时，可以  `-i` 指定采样时间 |
| `--latency-history`         | 测试客户端到目标 Redis 服务端的一段时间内的最大延迟和平均延迟，默认情况每 15 秒打印一次，可以使用 `-i <interval>`选项修改时间间隔 |
| `--latency-dist`            | 使用统计图表的形式从控制台输出延迟统计信息，可以使用 `-i <interval>`选项修改时间间隔； |
| `--lru-test <keys>`         | 模拟 80% 的请求命中 20% 的缓存的命中率                       |
| `--slave`                   | 把当前客户端模拟成当前 Redis 的从节点，可以用来获取当前 Redis 节点的更新操作。 |
| `--rdb <filename>`          | 请求 Redis 实例生成并发送 RDB 持久化文件，保存在客户端所在的机器。可以用它做持久化文件的定期备份 |
| `--pipe`                    | 将命令封装成 Redis 通信协议定义的数据格式，批量发送给 Redis 执行（单独写一篇文章） |
| `--pipe-timeout <n>`        | `--pipe`配合使用，表示与Redis服务器之间的超时时间，单位为毫秒。该参数的默认值为 30 秒。设置 0 表示一直等待导入数据完成。 |
| `--bigkeys`                 | 使用 SCAN 命令对 Redis 进行采样，从中找到内存占用比较大的键值对 |
| `--hotkeys`                 | 找出服务器中的热 key。当服务器的淘汰策略（maxmemory-policy）是 *lfu 类型才可以 |
| `--scan`                    | 通过 SCAN 命令获取当前服务器的所有键名                       |
| `--pattern <pat>`           | 和`--scan` 选项配合使用，指定匹配规则                        |
| `--intrinsic-latency <sec>` | 测试服务器硬件本身存在的固有延迟                             |
| `--eval <file>`             | Send an EVAL command using the Lua script at `<file>`.       |
| `--ldb`                     | Used with --eval enable the Redis Lua debugger.              |
| `--ldb-sync-mode`           | Like --ldb but uses the synchronous Lua debugger, in this mode the server is blocked and script changes are are not rolled back from the server memory. |
| `--help`                    | 打印帮助                                                     |
| `--version`                 | 打印当前服务器的版本号                                       |

### Redis 6.2.11 支持的选项

```shell
$ ./redis-cli --help
redis-cli 6.2.11 (git:720ea82e)

Usage: redis-cli [OPTIONS] [cmd [arg [arg ...]]]
  -h <hostname>      Server hostname (default: 127.0.0.1).
  -p <port>          Server port (default: 6379).
  -s <socket>        Server socket (overrides hostname and port).
  -a <password>      Password to use when connecting to the server.
                     You can also use the REDISCLI_AUTH environment
                     variable to pass this password more safely
                     (if both are used, this argument takes precedence).
  --user <username>  Used to send ACL style 'AUTH username pass'. Needs -a.
  --pass <password>  Alias of -a for consistency with the new --user option.
  --askpass          Force user to input password with mask from STDIN.
                     If this argument is used, '-a' and REDISCLI_AUTH
                     environment variable will be ignored.
  -u <uri>           Server URI.
  -r <repeat>        Execute specified command N times.
  -i <interval>      When -r is used, waits <interval> seconds per command.
                     It is possible to specify sub-second times like -i 0.1.
  -n <db>            Database number.
  -3                 Start session in RESP3 protocol mode.
  -x                 Read last argument from STDIN.
  -d <delimiter>     Delimiter between response bulks for raw formatting (default: \n).
  -D <delimiter>     Delimiter between responses for raw formatting (default: \n).
  -c                 Enable cluster mode (follow -ASK and -MOVED redirections).
  -e                 Return exit error code when command execution fails.
  --tls              Establish a secure TLS connection.
  --sni <host>       Server name indication for TLS.
  --cacert <file>    CA Certificate file to verify with.
  --cacertdir <dir>  Directory where trusted CA certificates are stored.
                     If neither cacert nor cacertdir are specified, the default
                     system-wide trusted root certs configuration will apply.
  --insecure         Allow insecure TLS connection by skipping cert validation.
  --cert <file>      Client certificate to authenticate with.
  --key <file>       Private key file to authenticate with.
  --tls-ciphers <list> Sets the list of prefered ciphers (TLSv1.2 and below)
                     in order of preference from highest to lowest separated by colon (":").
                     See the ciphers(1ssl) manpage for more information about the syntax of this string.
  --tls-ciphersuites <list> Sets the list of prefered ciphersuites (TLSv1.3)
                     in order of preference from highest to lowest separated by colon (":").
                     See the ciphers(1ssl) manpage for more information about the syntax of this string,
                     and specifically for TLSv1.3 ciphersuites.
  --raw              Use raw formatting for replies (default when STDOUT is
                     not a tty).
  --no-raw           Force formatted output even when STDOUT is not a tty.
  --quoted-input     Force input to be handled as quoted strings.
  --csv              Output in CSV format.
  --show-pushes <yn> Whether to print RESP3 PUSH messages.  Enabled by default when
                     STDOUT is a tty but can be overriden with --show-pushes no.
  --stat             Print rolling stats about server: mem, clients, ...
  --latency          Enter a special mode continuously sampling latency.
                     If you use this mode in an interactive session it runs
                     forever displaying real-time stats. Otherwise if --raw or
                     --csv is specified, or if you redirect the output to a non
                     TTY, it samples the latency for 1 second (you can use
                     -i to change the interval), then produces a single output
                     and exits.
  --latency-history  Like --latency but tracking latency changes over time.
                     Default time interval is 15 sec. Change it using -i.
  --latency-dist     Shows latency as a spectrum, requires xterm 256 colors.
                     Default time interval is 1 sec. Change it using -i.
  --lru-test <keys>  Simulate a cache workload with an 80-20 distribution.
  --replica          Simulate a replica showing commands received from the master.
  --rdb <filename>   Transfer an RDB dump from remote server to local file.
                     Use filename of "-" to write to stdout.
  --pipe             Transfer raw Redis protocol from stdin to server.
  --pipe-timeout <n> In --pipe mode, abort with error if after sending all data.
                     no reply is received within <n> seconds.
                     Default timeout: 30. Use 0 to wait forever.
  --bigkeys          Sample Redis keys looking for keys with many elements (complexity).
  --memkeys          Sample Redis keys looking for keys consuming a lot of memory.
  --memkeys-samples <n> Sample Redis keys looking for keys consuming a lot of memory.
                     And define number of key elements to sample
  --hotkeys          Sample Redis keys looking for hot keys.
                     only works when maxmemory-policy is *lfu.
  --scan             List all keys using the SCAN command.
  --pattern <pat>    Keys pattern when using the --scan, --bigkeys or --hotkeys
                     options (default: *).
  --quoted-pattern <pat> Same as --pattern, but the specified string can be
                         quoted, in order to pass an otherwise non binary-safe string.
  --intrinsic-latency <sec> Run a test to measure intrinsic system latency.
                     The test will run for the specified amount of seconds.
  --eval <file>      Send an EVAL command using the Lua script at <file>.
  --ldb              Used with --eval enable the Redis Lua debugger.
  --ldb-sync-mode    Like --ldb but uses the synchronous Lua debugger, in
                     this mode the server is blocked and script changes are
                     not rolled back from the server memory.
  --cluster <command> [args...] [opts...]
                     Cluster Manager command and arguments (see below).
  --verbose          Verbose mode.
  --no-auth-warning  Don't show warning message when using password on command
                     line interface.
  --help             Output this help and exit.
  --version          Output version and exit.

Cluster Manager Commands:
  Use --cluster help to list all available cluster manager commands.

Examples:
  cat /etc/passwd | redis-cli -x set mypasswd
  redis-cli get mypasswd
  redis-cli -r 100 lpush mylist x
  redis-cli -r 100 -i 1 info | grep used_memory_human:
  redis-cli --quoted-input set '"null-\x00-separated"' value
  redis-cli --eval myscript.lua key1 key2 , arg1 arg2 arg3
  redis-cli --scan --pattern '*:12345*'

  (Note: when using --eval the comma separates KEYS[] from ARGV[] items)

When no command is given, redis-cli starts in interactive mode.
Type "help" in interactive mode for information on available commands
and settings.
```

### Redis 6.2.11 支持的选项介绍

大部分选项在上面的 1.2 节的表格里列出了，这个表格列出上面表格不存在的选项

| 选项                                      | 含义                                                         |
| ----------------------------------------- | ------------------------------------------------------------ |
| `-h <hostname>`                           | 服务器 IP 地址，默认 127.0.0.1                               |
| `-p <port>`                               | 服务器端口，默认 6379                                        |
| `-s <socket>`                             | Unix socket 文件连接到服务器                                 |
| `-a <password> `                          | 密码<br />可以使用 REDISCLI_AUTH 环境变量配置密码，比较安全  |
| `--user <username>`                       | Used to send ACL style 'AUTH username pass'. Needs -a.       |
| ` --pass <password>`                      | Alias of -a for consistency with the new --user option.      |
| ` --askpass`                              | 就是另起一行输入密码，密码是星号展示                         |
| ` -u <uri>`                               | 连接服务器，`redis://password@host:port/dbnum`               |
| `-r <repeat>`                             | 重复执行命令 N 次，-1 表示无限次                             |
| `-i <interval>`                           | 每个命令执行的间隔时间，单位秒，可以指定小数                 |
| `-n <db>`                                 | 选择对应编号的数据库                                         |
| `-3`                                      | 使用 RESP3 协议开启会话                                      |
| `-x`                                      | Read last argument from STDIN                                |
| `  -d <delimiter>`                        | Delimiter between response bulks for raw formatting (default: \n). |
| `-D <delimiter>`                          | Delimiter between responses for raw formatting (default: \n). |
| `-c`                                      | -c （cluster）是连接 Redis Cluster 节点时需要使用的，-c 选项可以防止 moved 和 ask 异常 |
| `-e`                                      | Return exit error code when command execution fails.         |
| `--tls`                                   | Establish a secure TLS connection.                           |
| `--sni <host>`                            | Server name indication for TLS.                              |
| `--cacert <file>`                         | CA Certificate file to verify with                           |
| `--cacertdir <dir>`                       | Directory where trusted CA certificates are stored.If neither cacert nor cacertdir are specified, the default system-wide trusted root certs configuration will apply. |
| `--insecure`                              | Allow insecure TLS connection by skipping cert validation.   |
| `--cert <file>`                           | Client certificate to authenticate with.                     |
| `--key <file>`                            | Private key file to authenticate with.                       |
| `--tls-ciphers <list>`                    | Sets the list of prefered ciphers (TLSv1.2 and below).in order of preference from highest to lowest separated by colon (":").See the ciphers(1ssl) manpage for more information about the syntax of this string. |
| `--tls-ciphersuitess <list>`              | Sets the list of prefered ciphersuites (TLSv1.3).in order of preference from highest to lowest separated by colon (":").See the ciphers(1ssl) manpage for more information about the syntax of this string,and specifically for TLSv1.3 ciphersuites. |
| `--raw`                                   | 命令返回的是格式化后的结果                                   |
| `--no-raw`                                | 命令返回的结果是原始的格式                                   |
| `--quoted-input`                          | Force input to be handled as quoted strings.                 |
| `--csv`                                   | 命令以 CSV 格式返回结果，CSV（逗号分隔值）                   |
| `--show-pushes <yn>`                      | Whether to print RESP3 PUSH messages.  Enabled by default when STDOUT is a tty but can be overriden with --show-pushes no. |
| `--stat`                                  | 实时获取服务器的统计信息，如内存......                       |
| `--latency`                               | 测试客户端到目标 Redis 的网络延迟，原理是客户端每秒发送 100 个 PING 命令到服务端并计算收到回复的时间（单位毫秒），支持和 `--raw` 和 `--csv`一起使用，和这两个一起使用时，可以  `-i` 指定采样时间 |
| `--latency-history`                       | 测试客户端到目标 Redis 服务端的一段时间内的最大延迟和平均延迟，默认情况每 15 秒打印一次，可以使用 `-i <interval>`选项修改时间间隔 |
| `--latency-dist`                          | 使用统计图表的形式从控制台输出延迟统计信息，可以使用 `-i <interval>`选项修改时间间隔； |
| `--lru-test <keys>`                       | 模拟 80% 的请求命中 20% 的缓存的命中率                       |
| `--replica`                               | 把当前客户端模拟成当前 Redis 的从节点，可以用来获取当前 Redis 节点的更新操作。 |
| `--rdb <filename>`                        | 请求 Redis 实例生成并发送 RDB 持久化文件，保存在客户端所在的机器。可以用它做持久化文件的定期备份 |
| `--pipe`                                  | 将命令封装成 Redis 通信协议定义的数据格式，批量发送给 Redis 执行（单独写一篇文章） |
| `--pipe-timeout <n>`                      | `--pipe`配合使用，表示与Redis服务器之间的超时时间，单位为毫秒。该参数的默认值为 30 秒。设置 0 表示一直等待导入数据完成。 |
| `--bigkeys`                               | 使用 SCAN 命令对 Redis 进行采样，从中找到内存占用比较大的键值对 |
| `--memkeys`                               | Sample Redis keys looking for keys consuming a lot of memory. |
| `--memkeys-samples <n>`                   | Sample Redis keys looking for keys consuming a lot of memory.And define number of key elements to sample |
| `--hotkeys`                               | 找出服务器中的热 key。当服务器的淘汰策略（maxmemory-policy）是 *lfu 类型才可以 |
| `--scan`                                  | 通过 SCAN 命令获取当前服务器的所有键名                       |
| `--pattern <pat>`                         | 和`--scan` 选项配合使用，指定匹配规则                        |
| `--quoted-pattern <pat>`                  | Same as --pattern, but the specified string can be quoted, in order to pass an otherwise non binary-safe string. |
| `--intrinsic-latency <sec>`               | 测试服务器硬件本身存在的固有延迟                             |
| `--eval <file>`                           | Send an EVAL command using the Lua script at `<file>`.       |
| `--ldb`                                   | Used with --eval enable the Redis Lua debugger.              |
| `--ldb-sync-mode`                         | Like --ldb but uses the synchronous Lua debugger, in this mode the server is blocked and script changes are are not rolled back from the server memory. |
| `--cluster <command> [args...] [opts...]` | Cluster Manager command and arguments (see below).           |
| `--verbose`                               | Verbose mode.                                                |
| `--no-auth-warning`                       | Don't show warning message when using password on command line interface. |
| `--help`                                  | 打印帮助                                                     |
| `--version`                               | 打印当前服务器的版本号                                       |

## 连接 Redis

默认情况下 redis-cli 连接的服务器是 127.0.0.1 的 6379 端口。

- `-h`：指定 IP；（h，host）
- `-p`：指定端口；（p，port）

```
$ redis-cli -h redis15.localnet.org -p 6390 PING
PONG
```

- `-a`：如果有密码，`-a <password>` 指定密码；（a，auth）

```
$ redis-cli -a myUnguessablePazzzzzword123 PING
PONG
```

> 为了安全，可以使用 `export REDISCLI_AUTH=你的密码`，通过环境变量的方式指定密码。 

- 最后，可以使用` -n <dbnum>` 选项，指定操作的数据库编号（默认操作编号 0 的数据库）；

```
$ redis-cli FLUSHALL
OK
$ redis-cli -n 1 INCR a
(integer) 1
$ redis-cli -n 1 INCR a
(integer) 2
$ redis-cli -n 2 INCR a
(integer) 1
```

## 获取其它程序的内容作为输入

###  -x 选项

现在有一个 test.txt 文件，要把这个文件的内容作为某个 key 的值

test.txt 文件内容如下面的 cat 命令所示

```
$ cat test.txt                               
Hello World
$ ./redis-cli -x set test:key < test.txt
OK
$ ./redis-cli --raw get test:key        
Hello World
```

### 执行文件存储的命令

有一个文件 command.txt，存的数据如下 cat 命令所示，command.txt 中的所有命令都由 redis-cli 连续执行，就好像它们是用户在交互模式下输入的一样。

```
$ cat command.txt                           
SET counter 128
INCR counter
GET counter
$ cat command.txt | ./redis-cli -a master123
(integer) 129
"129"
```

如果需要，可以在文件中引用字符串，因此可以使用带有空格、换行符或其他特殊字符的单个参数：

```
$ cat command.txt
SET arg_example "This is a single argument"
STRLEN arg_example
$ cat command.txt | redis-cli
OK
(integer) 25
```

## 连续执行相同的命令

-  `-r <count>` ：指定重复执行命令的次数，假如要无限执行命令，可以使用 -1 作为值；（r，repeat）
-  `-i <delay>`：每次执行命令的间隔（单位秒，可以使用小数）。不指定这个选项，默认间隔时间是 0；（i，interval）

```
$ ./redis-cli -r 10 INCR counter_value 
(integer) 1
(integer) 2
(integer) 3
(integer) 4
(integer) 5
(integer) 6
(integer) 7
(integer) 8
(integer) 9
(integer) 10
$ ./redis-cli -r 10 -i 0.1 INCR counter_value
(integer) 11
(integer) 12
(integer) 13
(integer) 14
(integer) 15
(integer) 16
(integer) 17
(integer) 18
(integer) 19
(integer) 20
```

无限期执行命令，比如 INFO replication 命令

```
$ ./redis-cli -r 10 -i 1 INFO replication    
# Replication
role:master
connected_slaves:0
master_failover_state:no-failover
master_replid:1bf13e0771fcafcdc0aa2f7ca1c300369543a925
master_replid2:0000000000000000000000000000000000000000
master_repl_offset:0
second_repl_offset:-1
repl_backlog_active:0
repl_backlog_size:1048576
repl_backlog_first_byte_offset:0
repl_backlog_histlen:0

...... 无限打印 ......
```

## --raw 和 --no-raw

- `--no-raw`：要求命令返回的结果必须是原始的格式；
- `--raw`：要求命令返回的是格式化后的结果；

```
$ ./redis-cli set test 你好哇
OK
$ ./redis-cli --no-raw get test
"\xe4\xbd\xa0\xe5\xa5\xbd\xe5\x93\x87"
$ ./redis-cli get test
"\xe4\xbd\xa0\xe5\xa5\xbd\xe5\x93\x87"
$ ./redis-cli --raw get test
你好哇
```

## CSV 输出（逗号分隔值）

redis-cli 中存在 CSV（逗号分隔值）输出功能，用于将数据从 Redis 导出到外部程序。

```
$ ./redis-cli LPUSH mylist a b c d       
(integer) 4
$ ./redis-cli --csv LRANGE mylist 0 -1   
"d","c","b","a"
$ ./redis-cli  LRANGE mylist 0 -1 
1) "d"
2) "c"
3) "b"
4) "a"
```

注意，使用 `--csv` 选项只能将单个命令导出为 CSV 格式，而不能将整个数据库作为 CSV 文件进行导出。



## 实时获取统计信息

`redis-cli --stat`，可以使用 `-i <interval>`选项修改每次打印的间隔时间。

```
$ redis-cli --stat
------- data ------ --------------------- load -------------------- - child -
keys       mem      clients blocked requests            connections          
224616     58.16M   1316    0       292596804 (+0)      248791      
224616     58.50M   1316    0       292596834 (+30)     248791      
224616     58.38M   1316    0       292596856 (+22)     248791      
224616     58.54M   1316    0       292596902 (+46)     248791      
224617     58.75M   1316    0       292596936 (+34)     248791      
224617     58.50M   1316    0       292596975 (+39)     248791      
224617     58.60M   1316    0       292596999 (+24)     248791      
224617     58.22M   1316    0       292597007 (+8)      248791      
224616     58.41M   1316    0       292597043 (+36)     248791      
224616     58.47M   1316    0       292597059 (+16)     248791      
224615     58.16M   1316    0       292597073 (+14)     248791      
224615     58.28M   1316    0       292597089 (+16)     248791
```

## --replica 或 --slave

`--replica` 是新版本的 Redis 的选项，`--slave` 是旧版本的选项。

这个选项是把当前客户端模拟成当前 Redis 的从节点，可以用来获取当前 Redis 节点的更新操作。合理的利用这个选项可以记录当前连接 Redis 节点的一些更新操作，这些更新操作很可能是实际开发业务时需要的数据。

先开一个客户端：

```
$ ./redis-cli -a master123 --replica
Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.
sending REPLCONF capa eof
SYNC with master, discarding 101043241 bytes of bulk transfer...
SYNC done. Logging commands from master.
```

可以看到已经同步完成了，开始记录 master 的写命令了。

这时再开另外一个客户端，执行几个命令

```
127.0.0.1:6379> set name name
OK
127.0.0.1:6379> get name
"name"
127.0.0.1:6379> set name 1
OK
127.0.0.1:6379> del name
(integer) 1
127.0.0.1:6379> set name hello
OK
127.0.0.1:6379> set name 2
OK
127.0.0.1:6379> get name
"2"
127.0.0.1:6379> del name
(integer) 1
127.0.0.1:6379>
```

可以看到第一个客户端记录的信息

```
sending REPLCONF capa eof
SYNC with master, discarding 101043241 bytes of bulk transfer...
SYNC done. Logging commands from master.
"ping"
"SELECT","0"
"set","name","hello"
"set","name","2"
"ping"
"del","name"
"ping"
"ping"
.
.
.
```

> PING 是主从复制使用到的命令。





## 扫描大键

`--bigkeys` 选项使用 SCAN 命令对 Redis 进行采样，从中找到内存占用比较大的键值对，这些键值对可能就是系统的瓶颈。

可以使用 `-i <interval>`选项修改内部每次调用 SCAN 的时间间隔。

```
[Calven.Liu@ALYBJ59-6 ~]$ redis-cli -p 6321 -a uxin001 --bigkeys

# Scanning the entire keyspace to find biggest keys as well as
# average sizes per key type.  You can use -i 0.1 to sleep 0.1 sec
# per 100 SCAN commands (not usually needed).

[00.00%] Biggest hash   found so far 'user_item_push_identifier_3303575322628' with 1 fields
.
.
.
.
[49.02%] Biggest string found so far 'talker_default_kneadface_8' with 7971 bytes
[86.95%] Biggest list   found so far 'cv_actor_perform_radio_drama_list_108_1480950194479562754' with 142 items
[89.94%] Biggest string found so far '1511661600000' with 2829894 bytes

-------- summary -------

Sampled 224618 keys in the keyspace!
Total key length in bytes is 7895074 (avg len 35.15)

Biggest string found '1511661600000' has 2829894 bytes
Biggest   list found 'cv_actor_perform_radio_drama_list_108_1480950194479562754' has 142 items
Biggest    set found 'talker_id_pool_set' has 9759 members
Biggest   hash found 'cache_score_hot_room_list_0' has 33 fields
Biggest   zset found 'user_noble_days' has 812 members

88415 strings with 3998010 bytes (39.36% of keys, avg size 45.22)
2675 lists with 6017 items (01.19% of keys, avg size 2.25)
50332 sets with 70812 members (22.41% of keys, avg size 1.41)
74141 hashs with 110112 fields (33.01% of keys, avg size 1.49)
9055 zsets with 43551 members (04.03% of keys, avg size 4.81)
```

这个命令的缺点是，虽然 `--bigkeys` 选项会扫描整个 Redis，但是只输出每种数据类型 TOP1 的那个 key。但是，实际我们可能需要前 N 个 bigkey。

## 获取键列表

- `--scan`：扫描键；
- `--pattern`：匹配模式；

相当于 SCAN 命令，可以使用 `-i <interval>`选项修改内部每次调用 SCAN 的时间间隔。

下面的 head 表示展示前面 10 个键

```
$ redis-cli --scan --pattern key*  | head -10
key_3303575322628
key_3303602741252
key_3303595335682
key_3300808482818
key_3303586463748
key_3303621804036
key_3175456120834
key_3303585234946
key_3300767391746
key_3303122927636
```

## 监控 Redis 实例的延迟

- `--latency`：测试客户端到目标 Redis 的网络延迟，原理是客户端每秒发送 100 个 PING 命令到服务端并计算收到回复的时间（单位毫秒）；

  ```
  $ redis-cli --latency
  min: 0, max: 5, avg: 0.07 (1265 samples)
  ```

- `--latency-history`：测试客户端到目标 Redis 服务端的一段时间内的最大延迟和平均延迟，默认情况每 15 秒打印一次，可以使用 `-i <interval>`选项修改时间间隔；

  ```
  $ redis-cli --latency-history
  min: 0, max: 1, avg: 0.07 (1478 samples) -- 15.01 seconds range
  min: 0, max: 21, avg: 0.09 (1474 samples) -- 15.01 seconds range
  min: 0, max: 3, avg: 0.08 (1476 samples) -- 15.01 seconds range
  min: 0, max: 1, avg: 0.07 (1476 samples) -- 15.01 seconds range
  $ redis-cli --latency-history -i 5
  min: 0, max: 1, avg: 0.06 (493 samples) -- 5.01 seconds range
  min: 0, max: 1, avg: 0.07 (493 samples) -- 5.01 seconds range
  
  ```

  看一下客户端和服务端不在一个机器的延迟情况

  ```
  $ ./redis-cli -h xx.xxx.xx.x -p 6326 --latency-history -i 1
  Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.
  min: 61, max: 64, avg: 61.79 (14 samples) -- 1.02 seconds range
  min: 60, max: 76, avg: 62.64 (14 samples) -- 1.04 seconds range
  min: 61, max: 64, avg: 61.71 (14 samples) -- 1.03 seconds range
  min: 60, max: 64, avg: 61.36 (14 samples) -- 1.03 seconds range
  min: 60, max: 70, avg: 62.29 (14 samples) -- 1.03 seconds range
  min: 60, max: 64, avg: 61.93 (14 samples) -- 1.03 seconds range
  min: 61, max: 64, avg: 61.57 (14 samples) -- 1.03 seconds range
  min: 60, max: 69, avg: 62.14 (14 samples) -- 1.03 seconds range
  min: 60, max: 64, avg: 61.36 (14 samples) -- 1.03 seconds range
  ```

- `--latency-dist`：使用统计图表的形式从控制台输出延迟统计信息，可以使用 `-i <interval>`选项修改时间间隔；

  ```
  $ redis-cli -a uxin001 --latency-dist
  ---------------------------------------------
  . - * #          .01 .125 .25 .5 milliseconds
  1,2,3,...,9      from 1 to 9     milliseconds
  A,B,C,D,E        10,20,30,40,50  milliseconds
  F,G,H,I,J        .1,.2,.3,.4,.5       seconds
  K,L,M,N,O,P,Q,?  1,2,4,8,16,30,60,>60 seconds
  From 0 to 100%:                    
  ---------------------------------------------
  图表
  ```

- `--intrinsic-latency <sec>`：用于测量 Redis 实例的固有延迟。固有延迟是指在执行一项特定操作时，硬件本身存在的固有延迟。与之相对的是外部延迟，即由于数据传输、处理等原因而引起的额外延迟。举例来说，CPU 从内存中读取数据的延迟包括内存的访问延迟和 CPU 处理数据所需的时间，其中内存的访问延迟就属于 `intrinsic latency`。当使用 `redis-cli --intrinsic-latency` 命令时，Redis 会在不进行任何实际操作的情况下，周期性地发送一个特殊的命令并测量响应时间，从而得出 Redis 实例的固有延迟。这个选项通常用于评估 Redis 实例的性能，并帮助用户更好地优化 Redis 配置和运行环境。

  需要注意的是，由于 `--intrinsic-latency` 选项会使 Redis 实例不断地发送命令，因此可能会对实例的性能造成一定的影响，在生产环境中需要慎重使用。

  ```
  $ ./redis-cli -a master123 --intrinsic-latency 5
  Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.
  Max latency so far: 2 microseconds.
  Max latency so far: 3 microseconds.
  Max latency so far: 17 microseconds.
  Max latency so far: 18 microseconds.
  Max latency so far: 47 microseconds.
  Max latency so far: 63 microseconds.
  Max latency so far: 102 microseconds.
  Max latency so far: 902 microseconds.
  
  4998465 total runs (avg latency: 1.0003 microseconds / 1000.31 nanoseconds per run).
  Worst run took 902x longer than the average latency.
  ```

  上述命令需要在运行 Redis 服务器实例的计算机上执行，不能在其他主机上执行。命令不会连接到 Redis 实例并在本地执行测试。

  在此情况下，系统最差情况下的延迟为 902 微秒，因此可以预期某些查询偶尔会在 1 毫秒以下时间内完成。

## 远程 RDB 备份 

`--rdb` 选项会请求 Redis 实例生成并发送 RDB 持久化文件，保存在客户端所在的机器。可以用它做持久化文件的定期备份

```
$ ./redis-cli --rdb ./596dump.rdb
Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.
sending REPLCONF capa eof
sending REPLCONF rdb-only 1
SYNC sent to master, writing 4094994 bytes to './596dump.rdb'
Transfer finished with success.
```

## LRU 模拟测试

Redis 是一种常用的缓存工具，可以在其中设置一个 LRU 算法以进行对象的驱逐。根据存储的键值对数量以及分配给缓存的内存大小，缓存命中和未命中的次数也会相应地改变。为了能够正确配置缓存，模拟缓存命中率非常有帮助。

Redis-cli 有一种专门的模式，可以模拟 GET 和 SET 操作的行为。在这个模式下，它会使用一种 80-20% 的幂律分布，表示只有 20% 的对象会被 80% 的请求访问到，这在缓存场景中是比较常见的分布情况。

理论上，根据请求分布和 Redis 内存开销的情况，应该可以通过数学公式来计算缓存命中率。但是，Redis 可以配置不同的 LRU 设置（样本数），并且在不同版本之间 Redis 的 LRU 实现也会有很大的改变。同样，每个键所需的内存量也可能在不同版本中发生变化。这就是为什么开发出这个工具的原因：它的主要动机是测试 Redis 的 LRU 实现质量，但现在也可以用来测试特定版本如何以最初预期的配置行为。

要使用此模式，请指定测试中的键数量并将一个合理的 maxmemory 设置为第一次尝试。

重要提示：在 Redis 配置中设置 maxmemory 参数是至关重要的，因为如果没有限制最大内存使用量，缓存命中率最终将达到 100%，因为所有键都可以存储在内存中。如果指定了太多的键并且与最大内存一起使用，最终会使用计算机 RAM 的所有空间。

> 警告：此测试使用 Pipeline 技术，会对服务器造成压力，请勿在生产环境中使用。

测试 1：配置了 100MB 的内存限制（maxmemory 104857600），并使用 1000 万个键进行 LRU 模拟测试，内存淘汰策略用的是 allkeys-lru。

```
$ ./redis-cli --lru-test 10000000
Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.
192250 Gets/sec | Hits: 6741 (3.51%) | Misses: 185509 (96.49%)
185500 Gets/sec | Hits: 18794 (10.13%) | Misses: 166706 (89.87%)
187750 Gets/sec | Hits: 30871 (16.44%) | Misses: 156879 (83.56%)
171000 Gets/sec | Hits: 36806 (21.52%) | Misses: 134194 (78.48%)
184000 Gets/sec | Hits: 48342 (26.27%) | Misses: 135658 (73.73%)
183750 Gets/sec | Hits: 56834 (30.93%) | Misses: 126916 (69.07%)
184250 Gets/sec | Hits: 64535 (35.03%) | Misses: 119715 (64.97%)
181500 Gets/sec | Hits: 70484 (38.83%) | Misses: 111016 (61.17%)
172500 Gets/sec | Hits: 72462 (42.01%) | Misses: 100038 (57.99%)
160500 Gets/sec | Hits: 68569 (42.72%) | Misses: 91931 (57.28%)
164500 Gets/sec | Hits: 71001 (43.16%) | Misses: 93499 (56.84%)
159750 Gets/sec | Hits: 69116 (43.27%) | Misses: 90634 (56.73%)
162250 Gets/sec | Hits: 70300 (43.33%) | Misses: 91950 (56.67%)
154500 Gets/sec | Hits: 66959 (43.34%) | Misses: 87541 (56.66%)
153000 Gets/sec | Hits: 66574 (43.51%) | Misses: 86426 (56.49%)
159250 Gets/sec | Hits: 69483 (43.63%) | Misses: 89767 (56.37%)
161750 Gets/sec | Hits: 70525 (43.60%) | Misses: 91225 (56.40%)
161500 Gets/sec | Hits: 70513 (43.66%) | Misses: 90987 (56.34%)
157250 Gets/sec | Hits: 68404 (43.50%) | Misses: 88846 (56.50%)
161750 Gets/sec | Hits: 70613 (43.66%) | Misses: 91137 (56.34%)
161000 Gets/sec | Hits: 69970 (43.46%) | Misses: 91030 (56.54%)
161750 Gets/sec | Hits: 70405 (43.53%) | Misses: 91345 (56.47%)
161750 Gets/sec | Hits: 70700 (43.71%) | Misses: 91050 (56.29%)
160750 Gets/sec | Hits: 70437 (43.82%) | Misses: 90313 (56.18%)
161000 Gets/sec | Hits: 69885 (43.41%) | Misses: 91115 (56.59%)
155000 Gets/sec | Hits: 67698 (43.68%) | Misses: 87302 (56.32%)
159500 Gets/sec | Hits: 69818 (43.77%) | Misses: 89682 (56.23%)
161000 Gets/sec | Hits: 70211 (43.61%) | Misses: 90789 (56.39%)
160750 Gets/sec | Hits: 70448 (43.82%) | Misses: 90302 (56.18%)
160250 Gets/sec | Hits: 70235 (43.83%) | Misses: 90015 (56.17%)
161250 Gets/sec | Hits: 70241 (43.56%) | Misses: 91009 (56.44%)
161250 Gets/sec | Hits: 70456 (43.69%) | Misses: 90794 (56.31%)
158000 Gets/sec | Hits: 69050 (43.70%) | Misses: 88950 (56.30%)
162250 Gets/sec | Hits: 70933 (43.72%) | Misses: 91317 (56.28%)
162750 Gets/sec | Hits: 71523 (43.95%) | Misses: 91227 (56.05%)
162000 Gets/sec | Hits: 70773 (43.69%) | Misses: 91227 (56.31%)
161750 Gets/sec | Hits: 71039 (43.92%) | Misses: 90711 (56.08%)
161250 Gets/sec | Hits: 70740 (43.87%) | Misses: 90510 (56.13%)
```

该程序每秒显示一次统计数据。在最初的几秒钟内，开始向缓存填充数据。未命中率随后稳定为可以预期的实际数字：56% 左右。

对于某些用例，59% 的未命中率可能是不可接受的，因此 100MB 的内存是不够的。观察一个使用 0.5 GB 内存的示例。几分钟后，输出稳定为以下数字：

```
$ ./redis-cli -a master123 --lru-test 10000000
175500 Gets/sec | Hits: 172606 (98.35%) | Misses: 2894 (1.65%)
175250 Gets/sec | Hits: 172435 (98.39%) | Misses: 2815 (1.61%)
173750 Gets/sec | Hits: 170917 (98.37%) | Misses: 2833 (1.63%)
165750 Gets/sec | Hits: 163111 (98.41%) | Misses: 2639 (1.59%)
```



官方文档还有下面几个没有在本文档提现

> https://redis.io/docs/ui/cli

- Command line usage
- String quoting and escaping
- SSL/TLS
- Mass insertion of data using `redis-cli`
- Running Lua scripts
- Pub/sub mode
- Monitoring commands executed in Redis





















