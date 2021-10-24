# bizify

## Lerna 使用
> https://github.com/lerna/lerna

```bash
# 初始化依赖（包含子包）和链接跨包依赖
lerna bootstrap

# 创建一个子包
lerna create <pkg>

# 遍历执行每个包下的script，如果不存在则忽略
lerna run [script]

# 安装依赖包，可使用 lerna add --help 查看帮助
lerna add <pkg>
# 在特定的子包中安装依赖，可增加参数 --dev --peer
lerna add <pkg> --scope=xxx
```
