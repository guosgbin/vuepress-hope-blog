---
title: Linux命令
---



[[TOC]]

## Linux 命令基础格式

通用格式：

``` 
command [-options] [parameter]
```

- command：命令本身含义；
- options：「可选，非必填」命令的一些选项，可以通过选项控制命令的行为细节；
- parameter：「可选，非必填」 命令的参数，多数用于命令的指向目标等；

## 文件管理相关命令

### cat 命令

连接多个文件并打印到标准输出。有如下作用：

- 显示文件内容，如果没有文件或文件为`-`则读取标准输入；
- 将多个文件的内容进行连接并打印到标准输出；
- 显示文件内容中的不可见字符（控制字符、换行符、制表符等）；

> 查看**体积较大的文件**时建议使用使用`less`、`more`命令或`emacs`、`vi`等文本编辑器。

用法：

```
cat [OPTION]... [FILE]...
```

一些选项：

```shell
  -A, --show-all           等价于"-vET"组合选项。
  -b, --number-nonblank    只对非空行编号，从1开始编号，覆盖"-n"选项。
  -e                       等价于"-vE"组合选项。
  -E, --show-ends          在每行的结尾显示'$'字符。
  -n, --number             对所有行编号，从1开始编号。
  -s, --squeeze-blank      压缩连续的空行到一行。
  -t                       等价于"-vT"组合选项。
  -T, --show-tabs          使用"^I"表示TAB（制表符）。
  -u                       (ignored)
  -v, --show-nonprinting   使用"^"和"M-"符号显示控制字符，除了LFD（line feed，即换行符'\n'）和TAB（制表符）。
  --help     display this help and exit
  --version  output version information and exit
```



一些案例：

```shell
# 展示 1.txt 文件内容
cat 1.txt

# 展示 1.txt 文件内容，显示行号
cat -n 1.txt

# 合并文件并输出，合并到 all.txt
cat 1.txt 2.txt > all.txt

# 将 1.txt 文件的内容追加到 existing_file.txt 文件里
cat 1.txt >> existing_file.txt 

# 将文件内容通过管道传递给其他命令:
cat filename | grep "pattern"

# 显示特定行范围的内容:
cat filename | sed -n '2,5p'

# 逆序显示文件内容:
tac filename
```





## 磁盘管理相关命令

### cd 改变工作目录

Linux cd（英文全拼：change directory）命令用于改变当前工作目录的命令，切换到指定的路径。

若目录名称省略，则变换至使用者的 home 目录 (也就是刚 login 时所在的目录)。

另外，**~ 也表示为 home 目录 的意思， . 则是表示目前所在的目录， .. 则表示目前目录位置的上一层目录**。

```
cd [dirName]
```

- dirName：要切换的目标目录，可以是相对路径或绝对路径。

案例

- 切换到上次访问的目录：`cd -`，这个 `-` 其实就是 `$OLDPWD` 环境变量保存的值，旧目录，同样还有`$PWD`
- 切换到环境变量指定的目录：`cd $VAR_NAME`

### df 查看文件磁盘的使用情况

Linux df（英文全拼：disk free） 命令用于显示目前在 Linux 系统上的文件系统磁盘使用情况统计。

```
df [OPTION]... [FILE]...
```

一般来说，

- `df -h` 用的最多
- 如果要展示的单位统一为 k 或者 m，可以使用 `df -k` 和 `df -m`，等价 ` df --block-size 1k` 和 ` df --block-size 1m`

当然如果不关心磁盘使用量，只想看看磁盘的大小，可以使用 `lsblk` 命令

```
$ lsblk
NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINT
vda    253:0    0   100G  0 disk 
└─vda1 253:1    0   100G  0 part /
vdb    253:16   0   500G  0 disk 
└─vdb1 253:17   0 499.8G  0 part /data
vdc    253:32   0   500G  0 disk 
└─vdc1 253:33   0   500G  0 part /docker_data
```

### du 显示目录或文件的大小

 du （英文全拼：disk usage）命令用于显示目录或文件的大小。du 会显示指定的目录或文件所占用的磁盘空间。

```shell
du [选项] [文件或目录]
```

常用选项：

- **-h, --human-readable:** 以人类可读的方式显示文件大小，以 K、M、G 等单位表示。
- **-s, --summarize:** 仅显示总计大小，而不显示每个子目录的大小。
- **-c, --total:** 在总计行之前显示所有子目录的大小总和。
- **-k:** 以千字节为单位显示文件大小。
- **-m:** 以兆字节为单位显示文件大小。
- **--max-depth=N:** 限制显示深度，只显示到指定深度的目录。

### pushd、popd、dirs 命令

可以使用 pushd 和 popd 命令来代替 cd 命令。从命令就可以看出来是关于目录的一个栈，也就是说我们可以把最近访问的目录放到栈中，然后可以直接跳转到栈中的任意一个目录。

可以使用 `help pushd` 等命令来查看帮助：

- **添加目录到栈，并切换到指定目录**：

```
pushd [-n] [+N | -N | dir]

	Add directories to stack.
        Adds a directory to the top of the directory stack, or rotates
        the stack, making the new top of the stack the current working
        directory.  With no arguments, exchanges the top two directories.

 	Options:
      -n        Suppresses the normal change of directory when adding
        directories to the stack, so only the stack is manipulated.
    
    Arguments:
      +N        Rotates the stack so that the Nth directory (counting
        from the left of the list shown by `dirs', starting with
        zero) is at the top.
    
      -N        Rotates the stack so that the Nth directory (counting
        from the right of the list shown by `dirs', starting with
        zero) is at the top.
    
      dir       Adds DIR to the directory stack at the top, making it the
        new current working directory.
```

- **移除栈顶目录，并切换到下一个目录**：

```
popd [-n] [+N | -N]
    Remove directories from stack.
    
    Removes entries from the directory stack.  With no arguments, removes
    the top directory from the stack, and changes to the new top directory.
    
    Options:
      -n        Suppresses the normal change of directory when removing
        directories from the stack, so only the stack is manipulated.
    
    Arguments:
      +N        Removes the Nth entry counting from the left of the list
        shown by `dirs', starting with zero.  For example: `popd +0'
        removes the first directory, `popd +1' the second.
    
      -N        Removes the Nth entry counting from the right of the list
        shown by `dirs', starting with zero.  For example: `popd -0'
        removes the last directory, `popd -1' the next to last.
```

- **查看栈内元素**，常用的是 `dirs -v`：

```
dirs [-clpv] [+N] [-N]
    Display directory stack.
    
    Display the list of currently remembered directories.  Directories
    find their way onto the list with the `pushd' command; you can get
    back up through the list with the `popd' command.
    
    Options:
      -c        clear the directory stack by deleting all of the elements
      -l        do not print tilde-prefixed versions of directories relative
        to your home directory
      -p        print the directory stack with one entry per line
      -v        print the directory stack with one entry per line prefixed
        with its position in the stack
    
    Arguments:
      +N        Displays the Nth entry counting from the left of the list shown by
        dirs when invoked without options, starting with zero.
    
      -N        Displays the Nth entry counting from the right of the list shown by
        dirs when invoked without options, starting with zero.
```



举个使用的案例：

- 使用 pushd 将三个目录添加到栈中；

```shell
[root@root ~]$ dirs -v
 0  ~
[root@root ~]$ pushd /data/docker5
/data/docker5 ~
[root@root docker5]$ pushd ../docker7
/data/docker7 /data/docker5 ~
[root@root docker7]$ pushd /data/soft/nginx
/data/soft/nginx /data/docker7 /data/docker5 ~
[root@root nginx]$ dirs -v
 0  /data/soft/nginx
 1  /data/docker7
 2  /data/docker5
 3  ~
```

-  在最近的两个目录之间切换：用 pushd 不加参数即可

```shell
root@root nginx]$ pwd
/data/soft/nginx
[root@root nginx]$ pushd
/data/docker7 /data/soft/nginx /data/docker5 ~
[root@root docker7]$ pwd
/data/docker7
```

- 在多个目录之间切换：用 `pushd +1`，`push +2`， `pushd -2` 这些命令可以指定目录切换。

```shell
[root@root docker7]$ dirs -v
 0  /data/docker7
 1  /data/soft/nginx
 2  /data/docker5
 3  ~
[root@root docker7]$ pushd +2
/data/docker5 ~ /data/docker7 /data/soft/nginx
[root@root docker5]$ pwd
/data/docker5
```

### ls 查询目录下的列表

ls（英文全拼： list directory contents）命令用于显示指定工作目录下之内容（列出目前工作目录所含的文件及子目录)

```
ls [options] [directory...]
```

| 选项 | 含义                                                         |
| ---- | ------------------------------------------------------------ |
| -a   | 显示所有文件及目录(**.** 开头的隐藏文件也会列出)  （a 表示 all 的意思） |
| -d   | 只列出目录（不递归列出目录内的文件）。（d 表示 directory 的意思） |
| -l   | 以长格式显示文件和目录信息，包括权限、所有者、大小、创建时间等 |
| -r   | 倒序显示文件和目录                                           |
| -t   | 将按照修改时间排序，最新的文件在最前面                       |
| -A   | 同 -a ，但不列出 "." (目前目录) 及 ".." (父目录)             |
| -F   | 在列出的文件名称后加一符号；例如可执行档则加 "*", 目录则加 "/" |
| -R   | 递归显示目录中的所有文件和子目录                             |
| -lh  | 以人类可读的方式显示当前目录中的文件和目录大小               |

不光是 ls 可以搭配通配符使用，其他类似于 grep、find 命令也可以搭配通配符使用。常用的通配符有以下四种：

| 通配符 | 含义                       | 简单示例     |
| ------ | -------------------------- | ------------ |
| *      | 代表任意个数字符           | ab*.txt      |
| ？     | 代表任意一个字符           | ab?.txt      |
| []     | 匹配字符组里的任意一个     | ab[cdgk].txt |
| [a-g]  | 匹配从a到d内的任意一个字符 | ab[a-g].txt  |



ll 命令的返回值

```
$ ll
total 16
-rw-r--r--  1 root root    0 Jun 30  2021 1.txt
drwxr-xr-x 24 root root 4096 Sep 25 11:55 applog
drwxr-xr-x  4 root root 4096 Dec  3  2020 es
drwxr-xr-x  4 root root 4096 Dec  3  2020 es1
drwxr-xr-x 26 root root 4096 Apr 20  2023 soft
-rw-r--r--  1 root root    0 Jun 30  2021 stack.txt
```

| 含义                  |                                                              |
| --------------------- | ------------------------------------------------------------ |
| 第一列的第一个字符    | - 表示普通文件<br />d 表示目录<br />l 表示符号链接<br />（其他一般见的少） |
| 第一列的其他 9 个字符 | 表示文件或目录的访问权限，分别对应三个字符一组的 **rwx** 权限 （readable、writable、executable）<br />r 表示读取权限<br />w 表示写入权限<br />x 表示执行权限<br />- 表示没有对应权限<br />前三个字符表示**所有者**的权限，中间三个字符表示**所属组**的权限，后三个字符表示**其他用户**的权限 |
| 第三列                | 表示拥有者                                                   |
| 第四列                | 表示所属群组                                                 |
| 第五列                | 表示文档容量大小，单位字节                                   |
| 第六列                | 表示文档最后修改时间，注意不是文档的创建时间哦               |
| 第七列                | 表示文档名称。以点(.)开头的是隐藏文档                        |

### pwd 展示当前目录路径

Linux pwd（英文全拼：print work directory） 命令用于显示工作目录。执行 pwd 指令可立刻得知您目前所在的工作目录的绝对路径名称。

### mkdir 创建文件夹

Linux mkdir（英文全拼：make directory）命令用于创建目录。（如果目录名中包含空格或特殊字符，建议使用引号将目录名括起来，以防止解释错误。）

```shell
mkdir [选项] 目录名
```

常用选项：

- **-p, --parents:** 递归创建目录，即如果上级目录不存在，则一并创建。
- **-m, --mode=权限:** 设置目录的权限，默认为 777。

示例用法：

- 在当前目录下创建一个名为 "example" 的目录：

```shell
mkdir example
```

- 递归创建目录，如果上级目录不存在也一并创建：

```shell
mkdir -p path/to/your/directory
```

- 指定目录权限为 755（rwxr-xr-x）:

```shell
mkdir -m 755 your_directory
```

### rmdir 删除空文件夹

Linux rmdir（英文全拼：remove directory）命令删除空的目录。

> - `rmdir` 只能删除空目录。如果目录中包含文件或子目录，删除操作将失败。
> - 若要删除非空目录及其内容，可以使用 `rm` 命令，例如 `rm -r 目录路径`。

```
rmdir [选项] 目录
```

选项：

- **-p, --parents**：是当子目录被删除后使它也成为空目录的话，则顺便一并删除。
- **-v, --verbose**：显示命令执行过程中的详细信息。

### tree 树状打印目录

Linux tree命令用于以树状图列出目录的内容。

执行tree指令，它会列出指定目录下的所有文件，包括子目录里的文件。

> 太多了，直接去看官方的文档吧，命令 `man tree`

```
tree [-acdfghilnpqrstuvxACDFQNSUX] [-H baseHREF] [-T title ] [-L level [-R]]
        [-P pattern] [-I pattern] [-o filename] [--version] [--help] [--inodes]
        [--device] [--noreport] [--nolinks] [--dirsfirst] [--charset charset]
        [--filelimit[=]#] [--si] [--timefmt[=]<f>] [<directory list>]
```

常用的选项：

- **-a, --all**：显示所有文件和目录，包括隐藏文件（以`.`开头的文件）。
- **-L, --level [深度]**：限制树的深度，指定展示的层级深度。
- **-d, --dirs-only**：只显示目录。
- **-f, --fullpath**：显示每个文件或目录的完整路径。
- **-h, --human-readable**：以易读的格式显示文件大小。
- **-i, --no-indent**：不缩进显示。
- **-P, --matchdirs [匹配模式]**：只显示与给定模式匹配的目录和文件。
- **-s, --si**：以国际单位制（如 kB, MB）而非字节显示文件大小。
- **-t, --timefmt [格式字符串]**：使用自定义时间格式显示文件修改时间。

如果我们要使用通配符来查找，可以使用 `-P` 选项，规则如下：

```
Valid wildcard opera‐tors are `*' (any zero or more characters), `?' (any single character), `[...]' (any single character listed between brackets (optional - (dash) for character range may be used: ex:[A-Z]), and `[^...]' (any single character not listed in brackets) and `|' separates alternate patterns.
```

例如：

```shell
tree -P "*.log"
```

## 备份压缩相关命令

### bzip2 相关命令

#### bzip2 命令

`bzip2` 是一个用于在 Linux 系统中进行数据压缩和解压缩的工具，它主要用于替代 `gzip`，以更高的压缩比提供文件压缩。

> 若没有加上任何参数，bzip2压缩完文件后会产生.bz2的压缩文件，并删除原始的文件。
>
> 可以同时压缩多个文件，每个文件都会生成相应的 `.bz2` 压缩文件。

```shell
bzip2 [选项] [文件...]
```

常见选项：

- `-d` 或 `--decompress`: 解压缩文件。

- `-z` 或 `--compress`: 压缩文件（默认行为，可省略）。

- `-k` 或 `--keep`: 保留原始文件，不删除压缩前的文件。

- `-f` 或 `--force`: 强制覆盖已存在的压缩文件。

- `-t` 或 `--test`: 测试压缩文件的完整性。

- `-c` 或 `--stdout`: 将压缩或解压后的内容输出到标准输出。

- `-v` 或 `--verbose`: 显示详细信息，包括压缩比和压缩速度。

- `-9` 到 `-1`: 设置压缩级别，数字越大，压缩比越高，但耗时更长。默认为 `-9`。



案例：

```shell
# 压缩文件，-v 表示展示压缩详情，比如压缩比信息
bzip2 -v 1.txt

# 压缩文件，-v 表示展示压缩详情，比如压缩比信息，-k 表示保留源文件
bzip2 -vk 1.txt

# 校验压缩文件是否正常，-t 表示校验，-v 表示展示详情
bzip2 -tv 1.txt.bz2

# 解压文件，-d 表示解压，-v 表示展示解压详情
bzip2 -dv 1.txt.bz2

# 解压文件，-d 表示解压，-v 表示展示解压详情，-k 表示保留源文件
bzip2 -dvk 1.txt.bz2
```



指定压缩级别的案例：

```shell
# 指定压缩级别 1 来压缩 script.tar，输出为 
# script.tar: 11.230:1,  0.712 bits/byte, 91.10% saved, 705454080 in, 62819302 out.
bzip2 -vf -1 script.tar

# 指定压缩级别 9 来压缩 script.tar，输出为 
# script.tar: 20.947:1,  0.382 bits/byte, 95.23% saved, 705454080 in, 33678480 out.
bzip2 -vf -9 script.tar
```

#### bunzip 命令

Linux bunzip2 命令是 .bz2 文件的解压缩程序。

bunzip2 可解压缩 .bz2 格式的压缩文件。bunzip2 实际上是 bzip2 的符号连接，执行 bunzip2 与 bzip2 -d 的效果相同。

> `bunzip2`  default action is to decompress.

```shell
bunzip2 [-fkLsvV] [.bz2压缩文件]
```

选项：

- `-f`或`--force`：解压缩时，若输出的文件与现有文件同名时，预设不会覆盖现有的文件；
- `-k`或`--keep`：在解压缩后，预设会删除原来的压缩文件。若要保留压缩文件，请使用此参数；
- `-s`或`--small`：降低程序执行时，内存的使用量；
- `-v`或`--verbose`：解压缩文件时，显示详细的信息；

#### bzip2recover

Linux bzip2recover命令用来修复损坏的.bz2文件。

bzip2是以区块的方式来压缩文件，每个区块视为独立的单位。因此，当某一区块损坏时，便可利用bzip2recover，试着将文件中的区块隔开来，以便解压缩正常的区块。通常只适用在压缩文件很大的情况。

```shell
bzip2recover [.bz2 压缩文件]
```

#### bzcat

**bzcat命令** 无需解压缩指定的.bz2文件，即可显示解压缩后的文件内容。

> `bzcat` default action is to decompress to stdout.

```
bzcat [.bz2 压缩文件]
```

一些案例：

```shell
# 这会将 example.bz2 解压缩并将内容输出到标准输出。
bzcat example.bz2

# 将解压缩后的内容保存到文件：
bzcat example.bz2 > output.txt

# 使用通配符查看多个文件,并将内容输出到标准输出：
bzcat *.bz2

# 结合其他命令进行管道操作
bzcat example.bz2 | grep "pattern"

# 压缩文件内容的行数统计
bzcat example.bz2 | wc -l
```

#### bzmore 和 bzless

**bzmore命令** 用于查看bzip2压缩过的文本文件的内容，当下一屏显示不下时可以实现分屏显示。

```shell
bzmore  [.bz2 压缩文件]
```

**bzless命令** 是增强“.bz2”压缩包查看器，bzless比bzmore命令功能更加强大。

```
bzless  [.bz2 压缩文件]
```

#### bzgrep

> 如果你希望在二进制文件上执行搜索，可以考虑使用其他工具，如 `grep`。如果你确定要使用 `bzgrep`，请确保你的文件是文本文件，或者使用合适的选项来处理二进制文件。

```shell
bzgrep [grep_options] pattern [files]
```

选项：

- `-r`：递归地搜索子目录。
- `-n`：显示匹配行的行号。
- `-i`：对大小写不敏感地搜索。
- `-v`：显示不包含指定模式的行。
- `-C NUM`：显示匹配行的前后 NUM 行作为上下文。
- `-E`：使用扩展正则表达式进行搜索。
- `-f FILE`：从指定文件中读取模式。
- `-`：从标准输入读取模式。

案例：

```shell
# 基本搜索
bzgrep "pattern" example.bz2

# 递归搜索多个文件：
bzgrep -r "pattern" *.bz2

# 显示匹配行的行号
bzgrep -n "pattern" example.bz2

# 忽略大小写进行搜索
bzgrep -i "pattern" example.bz2

# 显示非匹配行：
bzgrep -v "pattern" example.bz2

# 显示匹配行的上下文：
bzgrep -C 2 "pattern" example.bz2


# 使用正则表达式进行搜索：
bzgrep -E "pattern1|pattern2" example.bz2

# 从标准输入读取模式：
echo "pattern" | bzgrep -f - example.bz2
```

#### 其他命令 bzdiff 和 bzcmp

略，应该没啥用的机会

### gz 相关命令

#### gzip 命令

Linux gzip 命令用于压缩文件。

gzip 是个使用广泛的压缩程序，文件经它压缩过后，其名称后面会多出 ".gz" 的扩展名。

```shell
gzip [选项] [参数]
```

常用选项：

- `-d`或`--decompress` 　解开压缩文件。
- `-f`或`--force `　强行压缩文件。不理会文件名称或硬连接是否存在以及该文件是否为符号连接。
- `-l`或`--list` 　列出压缩文件的相关信息。
- `-n`或`--no-name` 　压缩文件时，不保存原来的文件名称及时间戳记。
- `-N`或`--name` 　压缩文件时，保存原来的文件名称及时间戳记。
- `-r`或`--recursive` 　递归处理，将指定目录下的所有文件及子目录一并处理。
- `-t`或`--test` 　测试压缩文件是否正确无误。
- `-v`或`--verbose` 　显示指令执行过程。
- `-<压缩效率>`　压缩效率是一个介于1－9的数值，预设值为"6"，指定愈大的数值，压缩效率就会愈高。
- `--best` 　此参数的效果和指定"-9"参数相同。
- `--fast` 　此参数的效果和指定"-1"参数相同。
- `-c`或`--stdout`或`--to-stdout`：保留原始文件，生成标准输出流（结合重定向使用）。

案例：

```shell
# 将当前目录下的各个文件都压缩成 gz 文件
# -v 表示展示详情
gzip -v *

# 将当前目录下的各个 gz 文件都解压
# -v 表示展示详情，-d 表示解压
gzip -dv *

# 保留原始文件，把压缩流重定向到新文件
# -v 表示展示详情，-c 保留原始文件，生成标准输出流
gzip -vc 1.txt > 1.txt.gz 

# 保留原始文件，把解压流重定向到新文件
# -v 表示展示详情，-c 保留原始文件，生成标准输出流，-d 解压
gzip -dvc 1.txt.gz > 1.txt
```

#### gunzip 命令

**gunzip命令** 用来解压缩文件。gunzip是个使用广泛的解压缩程序，它用于解开被gzip压缩过的文件，这些压缩文件预设最后的扩展名为.gz。事实上gunzip就是gzip的硬连接，因此不论是压缩或解压缩，都可通过gzip指令单独完成。

```shell
gunzip [选项] [文件列表...]
```

- `-c`或`--stdout`或`--to-stdout`：把解压后的文件输出到标准输出设备；
- `-f`或`-force`：强行解开压缩文件，不理会文件名称或硬连接是否存在以及该文件是否为符号连接；
- `-l`或`--list`：列出压缩文件的相关信息；
- `-n`或`--no-name`：解压缩时，若压缩文件内含有原来的文件名称及时间戳记，则将其忽略不予处理；
- `-N`或`--name`：解压缩时，若压缩文件内含有原来的文件名称及时间戳记，则将其回存到解开的文件上；
- `-q`或`--quiet`：不显示警告信息；
- `-r`或`--recursive`：递归处理，将指定目录下的所有文件及子目录一并处理；
- `-t`或`--test`：测试压缩文件是否正确无误；
- `-v`或`--verbose`：显示指令执行过程；



案例

```shell
# 解压并保留源文件，-v 表示展示详情，-c 表示输出到标准输出设备
gunzip -cv 1.txt.gz > 1.txt
```

#### zcat

Uncompress FILEs to standard output.

```shell
zcat [OPTION]... [FILE]...
```

> 通常，`zcat` 不接受特定的选项，但它可以与其他工具（如 `grep` 或 `less`）一起使用，以实现更复杂的操作。

选项：

- `-f`, `--force`       force; read compressed data even from a terminal
- `-l`, `--list`        显示压缩包中文件的列表
- `-q`, `--quiet`       禁用警告信息
- `-r`, `--recursive`   在目录上执行递归操作；
- `-t`, `--test`        测试压缩文件的完整性；
- `-v`, `--verbose`     展示详情

#### zmore 和 zless

```shell
# Like 'more', but operate on the uncompressed contents of any compressed FILEs.
zmore [OPTION]... [FILE]...

# Like 'less', but operate on the uncompressed contents of any compressed FILEs.
# Options are the same as for 'less'.
zless [OPTION]... [FILE]...
```

### tar 命令

首先要弄清两个概念：打包和压缩。打包是指将一大堆文件或目录变成一个总的文件；压缩则是将一个大的文件通过一些压缩算法变成一个小文件。

为什么要区分这两个概念呢？这源于 **Linux 中很多压缩程序只能针对一个文件进行压缩，这样当你想要压缩一大堆文件时，你得先将这一大堆文件先打成一个包（tar命令），然后再用压缩程序进行压缩（gzip bzip2命令）**

`tar` 命令是用于在 Linux 系统上进行归档和压缩的工具。它的名称来源于“tape archive”（磁带归档），最初是用于在磁带上创建归档文件。以下是 `tar` 命令的一般语法：

```shell
tar [选项] [文件/目录]
```

常用选项：

- `-c, --create`：创建新的归档文件。
- `-x, --extract`：从归档文件中提取内容。
- `-v, --verbose`：详细模式，显示处理的文件列表。
- `-f, --file`：指定归档文件的名称。（**切记，这个参数是最后一个参数，后面只能接归档文件的名字**。）
- `-z, --gzip`：使用gzip进行压缩。
- `-j, --bzip2`：使用bzip2进行压缩。
- `-t, --list`：列出归档文件的内容。
- `-C, --directory`：指定解压缩时要切换到的目录。



**简单的打包和提取文件的参数的案例**

```shell
# 将 test 文件夹打包成 aa.tar 文件
# c 表示创建新的文件，v 表示展示处理详情，f 表示指定归档的名称
tar -cvf aa.tar ./test

# 将 test 文件夹打包成 aa.tar 文件，并移除源文件
tar -cvf aa.tar ./test/ --remove-files

# 列出 aa.tar 中的所有文件，目录和文件
# t 表示列出所有内容，v 表示展示详情，f 表示指定归档的名称
tar -tvf ./aa.tar

# 表示将 4.gif 文件添加到 aa.tar 归档文件中去
# r 表示添加文件
tar -rf aa.tar ./4.gif

# 表示提取 aa.tar 中的所有文件
# x 表示提取文件
tar -xvf aa.tar

# 表示提取 aa.tar 中的所有文件，并指定存放的目录
# -C 表示指定存放的目录
tar -xvf aa.tar -C ./destDir
```



为了方便用户在打包解包的同时可以压缩或解压文件，tar 提供了一种特殊的功能。这就是 tar 可以在打包或解包的同时调用其它的压缩程序，比如调用 gzip、bzip2 等。

#### tar 调用 gzip

gzip 是 GNU 组织开发的一个压缩程序，.gz 结尾的文件就是 gzip 压缩的结果。与 gzip 相对的解压程序是 gunzip。tar 命令中用小写 z 代表用 gzip 算法来压缩/解压。

```shell
# 表示使用 gzip 来压缩打包 test 文件/文件夹
# -z 表示使用 gzip 算法
tar -zcvf test.tar.gz ./test

# 表示使用 gzip 来解压 test.tar.gz 文件
# -z 表示使用 gzip 算法，-C 表示指定存放的目录
tar -zxvf test.tar.gz -C ./destDir
```

#### tar 调用 bzip2

bzip2 是一个压缩能力更强的压缩程序，.bz2 结尾的文件就是 bzip2 压缩的结果。与 bzip2 相对的解压程序是 bunzip2。tar 中使用 -j 这个参数来调用 bzip2 算法来压缩/解压。

```shell
# 表示使用 gzip 来压缩打包 test 文件/文件夹
# -j 表示使用 bzip2 算法
tar -jcvf test.tar.bz2 ./test

# 表示使用 gzip 来解压 test.tar.gz 文件
# -j 表示使用 bzip2 算法，-C 表示指定存放的目录
tar -jxvf test.tar.bz2 -C ./destDir
```

### 压缩解压相关总结

压缩：

```shell
# 将目录里所有jpg文件打包成 tar.jpg 
tar –cvf jpg.tar *.jpg

# 将目录里所有jpg文件打包成 jpg.tar 后，并且将其用 gzip 压缩，生成一个 gzip 压缩过的包，命名为 jpg.tar.gz 
tar –czf jpg.tar.gz *.jpg

# 将目录里所有jpg文件打包成 jpg.tar 后，并且将其用 bzip2 压缩，生成一个 bzip2 压缩过的包，命名为jpg.tar.bz2 
tar –cjf jpg.tar.bz2 *.jpg

# rar格式的压缩
rar a jpg.rar *.jpg

# zip格式的压缩
zip jpg.zip *.jpg
```

解压：

```shell
# 解 tar 包
tar –xvf file.tar     

# 解压 tar.gz 
tar -xzvf file.tar.gz

# 解压 tar.bz2
tar -xjvf file.tar.bz2

# 解压 rar 
unrar e file.rar

# 解压 zip 
unzip file.zip
```





## 查看进程占用的端口

首先用 jps 查看 Java 进程号是多少，然后使用下面的命令查看端口号

```
lsof -i -n -P | grep 进程号
```



```
lsof -i -n -P | grep  6506
```







```
[root@7c506abe092f /]# lsof -i -n -P | grep 1852
java       1852   root   30u  IPv6   65341625      0t0  TCP 127.0.0.1:60580->127.0.0.1:2181 (ESTABLISHED)
java       1852   root   80u  IPv6   65338573      0t0  TCP 172.17.0.2:45114->172.17.0.2:8006 (ESTABLISHED)
java       1852   root   81u  IPv6   65344388      0t0  TCP 172.17.0.2:45120->172.17.0.2:8006 (ESTABLISHED)
java       1852   root   82u  IPv6   65344389      0t0  TCP 172.17.0.2:45128->172.17.0.2:8006 (ESTABLISHED)
java       1852   root   83u  IPv6   65350858      0t0  TCP 172.17.0.2:45130->172.17.0.2:8006 (ESTABLISHED)
java       1852   root  152u  IPv6   65350929      0t0  TCP *:12580 (LISTEN)
java       1852   root  153u  IPv6   65350930      0t0  TCP *:12584 (LISTEN)
java       1852   root  154u  IPv6   65350931      0t0  TCP *:8282 (LISTEN)
java       1852   root  158u  IPv6   65341866      0t0  TCP *:8586 (LISTEN)
java       1852   root  170u  IPv6   65341872      0t0  TCP *:8585 (LISTEN)
java       1852   root  180u  IPv6   66473641      0t0  TCP 172.17.0.2:12580->111.198.71.157:50164 (ESTABLISHED)
java       1852   root  181u  IPv6   65338695      0t0  TCP *:5443 (LISTEN)
java       1852   root  197u  IPv6   66476431      0t0  TCP 172.17.0.2:12580->111.198.71.157:50165 (ESTABLISHED)
java       1852   root  198u  IPv6   66473843      0t0  TCP 172.17.0.2:12580->111.198.71.157:50166 (ESTABLISHED)
java       1852   root  199u  IPv6   66473905      0t0  TCP 172.17.0.2:12580->111.198.71.157:50167 (ESTABLISHED)
```





还有一种

```shell
ss -tulnp | grep 19285
```

4946 是进程号

```
# ss -tulnp | grep 19285
tcp    LISTEN     0      128      :::12585                :::*                   users:(("java",pid=19285,fd=276))
tcp    LISTEN     0      128      :::12586                :::*                   users:(("java",pid=19285,fd=275))
tcp    LISTEN     0      100      :::8181                 :::*                   users:(("java",pid=19285,fd=321))
tcp    LISTEN     0      128      :::12581                :::*                   users:(("java",pid=19285,fd=316))
```

## 其他

查看 18点到 23 点的日志大小总和

```shell
-rw-r--r-- 1 root root  171M Dec 11 00:59 info.log.20231211-00.gz
-rw-r--r-- 1 root root   75M Dec 11 01:59 info.log.20231211-01.gz
-rw-r--r-- 1 root root   36M Dec 11 02:59 info.log.20231211-02.gz
-rw-r--r-- 1 root root   21M Dec 11 03:59 info.log.20231211-03.gz
-rw-r--r-- 1 root root   14M Dec 11 04:59 info.log.20231211-04.gz
-rw-r--r-- 1 root root   14M Dec 11 05:59 info.log.20231211-05.gz
-rw-r--r-- 1 root root   21M Dec 11 06:59 info.log.20231211-06.gz
-rw-r--r-- 1 root root   34M Dec 11 07:59 info.log.20231211-07.gz
-rw-r--r-- 1 root root   44M Dec 11 08:59 info.log.20231211-08.gz
-rw-r--r-- 1 root root   56M Dec 11 09:59 info.log.20231211-09.gz
-rw-r--r-- 1 root root   70M Dec 11 10:59 info.log.20231211-10.gz
-rw-r--r-- 1 root root   74M Dec 11 11:59 info.log.20231211-11.gz
-rw-r--r-- 1 root root  119M Dec 11 12:59 info.log.20231211-12.gz
-rw-r--r-- 1 root root  101M Dec 11 13:59 info.log.20231211-13.gz
-rw-r--r-- 1 root root  220M Dec 11 14:59 info.log.20231211-14.gz
-rw-r--r-- 1 root root  272M Dec 11 15:59 info.log.20231211-15.gz
-rw-r--r-- 1 root root  273M Dec 11 16:59 info.log.20231211-16.gz
-rw-r--r-- 1 root root  261M Dec 11 17:59 info.log.20231211-17.gz
-rw-r--r-- 1 root root  313M Dec 11 18:59 info.log.20231211-18.gz
-rw-r--r-- 1 root root  436M Dec 11 19:59 info.log.20231211-19.gz
-rw-r--r-- 1 root root  964M Dec 11 20:59 info.log.20231211-20.gz
-rw-r--r-- 1 root root  1.2G Dec 11 21:59 info.log.20231211-21.gz
-rw-r--r-- 1 root root  1.2G Dec 11 22:59 info.log.20231211-22.gz
-rw-r--r-- 1 root root  821M Dec 11 23:59 info.log.20231211-23.gz
```

awk

```shell
$ ll | grep info.log.20231211 | awk '$8 ~ /^1[89]|2[0123]/ {total += $5} END {print "Total size from 18:00 to 23:59: " total/1024/1024/1024 " G"}'
Total size from 18:00 to 23:59: 4.79167 G
```

### 查看机器的架构

```
uname -a
```

eg.

```
Linux example.com 5.10.0-rc4-amd64 #1 SMP Debian 5.10~rc4-1~exp1 (2020-11-02) x86_64 GNU/Linux
```

